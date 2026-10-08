(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'databases', title: 'Databases under load', short: 'Databases',
    blurb: 'Deadlocks in production, the index a query ignores, ALTER TABLE on 200 million rows at peak, documents that embed or reference, and quorum reads and writes.',
    items: [
      /* ───────────── 1. deadlocks ───────────── */
      {
        lesson: 'db-deadlock', title: 'You have deadlocks in production. How do you fix them?', mins: 10,
        remember: 'A deadlock is a cycle of transactions each waiting for a lock another holds. Make cycles impossible by taking locks in one global order; keep the retry as a safety net, not the fix.',
        cue: '«deadlock detected» or SQLSTATE 40P01 in the logs → find the two statements in the log detail and ask whether they lock the same rows in different orders',
        body: R`
          ## The mechanism

          1. Transfer A moves money from account 3 to account 7: it updates row 3 (and holds its lock until commit).
          2. Transfer B moves money from 7 to 3: it updates row 7.
          3. A now needs row 7 and waits for B. B needs row 3 and waits for A.
          4. Neither can proceed. In PostgreSQL, a transaction that has waited «deadlock_timeout» (1 s by default) checks for a cycle; finding one, it aborts itself with «ERROR: deadlock detected» (SQLSTATE 40P01). The other continues.

          Cycles are not only pairs: the simulator's first deadlock is usually three or four transfers long.

          @sim deadlock

          Lock in request order, then sorted order, and compare: no deadlocks, and many times the throughput, because each deadlock also holds every other transfer queued behind its locks for a second.

          ## Diagnosing one

          - PostgreSQL logs both sides: the processes, the locks each waited for, and (with the default settings) the statements. «log_lock_waits» additionally logs any lock wait longer than «deadlock_timeout»; it is off by default in PostgreSQL 18.
          - Look for the same rows or tables reached **in different orders** by different code paths: a transfer in each direction, a batch job that updates in id order next to a request that updates in a different order, a parent-then-child path next to a child-then-parent one.

          ## Fixing it, best first

          1. **One global lock order.** Sort the ids and lock in that order. With «SELECT … FOR UPDATE ORDER BY id», take every row you need up front, in order.
          2. **Fewer, shorter locks.** Keep transactions short, never wait on the network inside one, and let the database do arithmetic («SET balance = balance - 500») instead of read-modify-write in the application.
          3. **Retry on 40P01**, with a little jittered backoff, as a safety net. Retrying alone leaves a second of stall per deadlock and a convoy behind it.

          ~~~sql Take both rows in id order, up front
          BEGIN;
          SELECT id FROM accounts WHERE id IN (3, 7) ORDER BY id FOR UPDATE;
          UPDATE accounts SET balance_cents = balance_cents - 500 WHERE id = 3;
          UPDATE accounts SET balance_cents = balance_cents + 500 WHERE id = 7;
          COMMIT;
          ~~~

          :::aside Deadlocks you did not write
          Foreign keys take a share lock on the referenced row, so inserting children while another transaction updates the parent can join a cycle. MySQL's InnoDB adds gap and next-key locks on index ranges under REPEATABLE READ, so two inserts into the same range can deadlock with no explicit locking at all.
          :::

          @lab pg:locks Watch a real deadlock happen, with real process ids, in the Postgres Lab

          @quiz 0
        `,
        quiz: [
          { q: 'Two code paths update the same two rows, one in order (A, B) and one in order (B, A). The fix that removes the deadlock is…', options: ['Raise deadlock_timeout', 'Retry on 40P01', 'Lock both rows in the same order everywhere', 'Switch to SERIALIZABLE'], answer: 2, why: 'A cycle needs two orders. One global order makes it impossible; retrying only recovers after the stall.' },
        ],
        defend: [
          {
            q: 'You have deadlocks in production. How do you fix them?',
            weak: 'We added retries for the deadlock exception, so the transactions succeed eventually.',
            whyWeak: 'Retries recover from deadlocks; they do not remove them. Each one still stalls for deadlock_timeout and blocks everything queued behind it.',
            follow: [
              { q: 'What exactly is a deadlock, mechanically?', a: 'A cycle in the waits-for graph: each transaction holds a lock that the next one in the cycle is waiting for. Nothing in the cycle can proceed until one is aborted.' },
              { q: 'How does PostgreSQL resolve one?', a: 'A transaction that has waited deadlock_timeout (1 s by default) checks for a cycle; if it finds one it aborts itself with 40P01, releasing its locks so the rest can continue.' },
              { q: 'How do you find which code paths are involved?', a: 'The deadlock log entry names both processes, the locks they waited on and their statements. Then look for the same rows locked in different orders, or parent and child rows locked in opposite orders.' },
              { q: 'What is the structural fix?', a: 'One global lock order: sort ids and lock in that order, ideally taking every row up front with SELECT … ORDER BY id FOR UPDATE. Then shorten transactions and push arithmetic into the UPDATE.' },
              { q: 'Do you still retry?', a: 'Yes, on 40P01 and serialization failures, with jittered backoff and a cap, as a safety net. The retry must be idempotent, so the whole transaction is retried, not one statement.' },
            ],
            strong: [
              'A deadlock is a cycle of lock waits; PostgreSQL detects it after deadlock_timeout and aborts one transaction with 40P01.',
              'Diagnose from the deadlock log: two code paths taking the same locks in different orders.',
              'Fix with a single global lock order, locking up front where possible.',
              'Shorter transactions and in-database arithmetic reduce the window.',
              'Retry the whole transaction on 40P01 as a safety net, not as the fix.',
            ],
            flags: ['Retries as the whole answer', 'Raising deadlock_timeout', 'Cannot describe the cycle', 'Does not know how to find the two code paths'],
          },
        ],
      },

      /* ───────────── 2. indexes ───────────── */
      {
        lesson: 'db-index', title: 'There is an index. Why does the query ignore it?', mins: 11,
        remember: 'The planner uses an index when it estimates that it is cheaper. It skips it when the query does not match the index\'s shape, when too many rows match, or when its statistics are wrong.',
        cue: 'a sequential scan on a column you indexed → check the predicate\'s shape, the share of rows it matches, and estimated versus actual rows in EXPLAIN ANALYZE',
        body: R`
          A B-tree index is the column's values in sorted order, each pointing at its row. It can answer equality, ranges, «IN», «ORDER BY … LIMIT», and «LIKE 'abc%'» prefixes (in PostgreSQL, with the C collation or a «text_pattern_ops» index). The planner compares the estimated cost of using it with the cost of reading the table; reading pages in order is cheap («seq_page_cost» 1.0), jumping to scattered pages is not («random_page_cost» 4.0 by default).

          ## Why it is ignored

          **1. Too many rows match.** If the query returns a large share of the table, visiting rows one index entry at a time costs more than reading the whole table in order. A bitmap scan sits in between: collect matching pages from the index, then read them in order.

          **2. The predicate does not match the index.**

          | The query says | The index is on | Fix |
          |---|---|---|
          | «WHERE lower(email) = ?» | «email» | an expression index on «lower(email)» |
          | «WHERE created_at::date = '2026-10-01'» | «created_at» | rewrite as a range: «created_at >= … AND created_at < …» |
          | «WHERE price * 1.1 > 100» | «price» | move the arithmetic to the constant: «price > 100 / 1.1» |
          | «WHERE name LIKE '%son'» | «name» | a trigram (GIN) index, or full-text search |
          | «WHERE b = ?» | «(a, b)» | an index on «(b)», or (b, a); see below |

          **3. The leftmost-prefix rule.** A composite index on «(a, b)» is sorted by «a» first. A filter on «b» alone has no starting point, so traditionally the index cannot be searched. PostgreSQL 18 added **skip scan**: when «a» has few distinct values, the planner can search the index once per value of «a». It helps; it does not make column order irrelevant. Put equality columns first and the range column last.

          **4. Wrong statistics.** The planner works from sampled statistics. After a bulk load with no «ANALYZE», or when two columns are correlated (city and country), its row estimates are off by orders of magnitude and it picks the wrong plan. Compare *estimated* and *actual* rows in «EXPLAIN ANALYZE»; correlated columns can get extended statistics.

          **5. Other shapes.** «OR» across different columns (it needs both indexed, then combines bitmaps), «!=» and «NOT IN» (rarely selective), a type mismatch between the column and the parameter, or a table so small a scan is cheaper.

          ~~~sql Read the plan, with real row counts and buffers
          EXPLAIN (ANALYZE, BUFFERS)
          SELECT * FROM orders WHERE customer_id = 42 AND created_at >= now() - interval '30 days';
          ~~~

          :::pitfall Forcing the planner
          «SET enable_seqscan = off» in a session shows what the planner thinks the index plan costs, which is useful for diagnosis. As a fix it is wrong: it hides the misestimate, and the next data change makes it worse.
          :::

          An **index-only scan** answers from the index alone, but only for pages the visibility map marks all-visible; on a table that has not been vacuumed recently it still visits the heap.

          @lab pg:scans Scan types on a real Postgres: why it ignores your index, with exercises
          @lab pg:composite Composite indexes and column order, hands on

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Index on «(tenant_id, created_at)». Which query uses it best?', options: ['«WHERE created_at > now() - interval \'1 day\'»', '«WHERE tenant_id = 7 AND created_at > now() - interval \'1 day\'»', '«WHERE created_at::date = current_date»', '«WHERE tenant_id <> 7»'], answer: 1, why: 'Equality on the leading column, then a range on the next: one contiguous slice of the index.' },
          { q: '«EXPLAIN ANALYZE» shows estimated rows 12, actual rows 480,000. What do you suspect first?', options: ['A missing index', 'Stale or insufficient statistics', 'Too little memory', 'A slow disk'], answer: 1, why: 'A misestimate that large means the planner is working from wrong statistics; run ANALYZE, then consider extended statistics.' },
        ],
        defend: [
          {
            q: 'There is an index on the column, but the query does a sequential scan. Why?',
            weak: 'Postgres sometimes ignores indexes. We could force it with a hint or disable sequential scans.',
            whyWeak: 'It treats the planner as random. The planner chose a cheaper-looking plan for a reason, and forcing it hides the reason.',
            follow: [
              { q: 'Give me the main reasons in order of likelihood.', a: 'The predicate does not match the index (a function, a cast, arithmetic on the column, a leading wildcard, or the wrong column order); the query matches too many rows to make random reads worth it; or the statistics are stale or the columns correlated, so the estimates are wrong.' },
              { q: 'How do you tell which one it is?', a: 'EXPLAIN (ANALYZE, BUFFERS): look at the filter versus the index condition, and compare estimated and actual rows. A big gap means statistics; a filter on a wrapped column means shape; a large actual share means it was right.' },
              { q: 'The index is on (a, b) and the query filters on b. What happens?', a: 'Traditionally the index cannot be searched without a value for a. PostgreSQL 18 can skip-scan when a has few distinct values. Otherwise add an index led by b, or reorder if no query needs a first.' },
              { q: 'When is the sequential scan the right choice?', a: 'When a large share of rows match, or the table is small: reading pages in order beats jumping around for each row.' },
            ],
            strong: [
              'The planner picks the cheapest estimated plan; random page reads cost more than sequential ones.',
              'Shape mismatches: functions, casts, arithmetic on the column, leading wildcards, column order.',
              'Selectivity: if many rows match, a scan is genuinely cheaper.',
              'Statistics: compare estimated and actual rows; ANALYZE, extended statistics.',
              'Diagnose with EXPLAIN ANALYZE; never fix by forcing the planner.',
            ],
            flags: ['"Postgres ignores indexes sometimes"', 'Disabling seqscan as the fix', 'Does not read EXPLAIN ANALYZE', 'Believes column order never matters'],
          },
        ],
      },

      /* ───────────── 3. ALTER at peak ───────────── */
      {
        lesson: 'db-alter', title: 'ALTER TABLE on 200 million rows at peak traffic', mins: 13,
        remember: 'The danger is usually not how long the change takes but the lock queue: an ALTER waiting for its exclusive lock blocks every query that arrives after it. Set a short lock_timeout, retry, and turn rewrites into expand-and-contract.',
        cue: 'a migration on a big, busy table → classify it (metadata-only, scan, or rewrite), check for long transactions, and run it with lock_timeout and retries',
        body: R`
          ## The trap: the lock queue

          Most «ALTER TABLE» forms take an **ACCESS EXCLUSIVE** lock, which conflicts with everything, even plain SELECTs. A lock request waits behind earlier requests it conflicts with, and later requests wait behind it.

          1. A report query has been reading the table for 40 seconds (it holds ACCESS SHARE).
          2. The migration runs «ALTER TABLE orders ADD COLUMN note text»: a metadata-only change that needs milliseconds once it has its lock. It cannot get the lock until the report finishes, so it waits.
          3. Every new query on «orders» needs ACCESS SHARE, which conflicts with the *waiting* ACCESS EXCLUSIVE, so each one queues behind the ALTER.
          4. The connection pool fills with blocked queries within a fraction of a second; new requests cannot get a connection and fail.
          5. The outage lasts until the report finishes, for a change that would have taken milliseconds.

          @sim lockqueue

          With no lock_timeout, the instant change causes a 32-second outage. With a 200 ms lock_timeout, the migration gives up quickly, traffic flows, and a later attempt lands once the report has finished.

          ## Step 1: classify the change

          | Kind | Examples | Cost at 200 M rows |
          |---|---|---|
          | **Metadata only** | ADD COLUMN, nullable or with a non-volatile default (PostgreSQL 11+); DROP COLUMN; SET DEFAULT; raising a varchar limit | milliseconds, once the lock is granted |
          | **Scan, no rewrite** | ADD CHECK or FOREIGN KEY; SET NOT NULL | a full scan under the lock, unless split (below) |
          | **Rewrite** | ALTER COLUMN TYPE to a non-binary-compatible type; ADD COLUMN with a volatile default such as «clock_timestamp()»; adding an identity or stored generated column | every row rewritten under ACCESS EXCLUSIVE: an outage measured in minutes |

          ## Step 2: make each kind safe

          **Every DDL statement:** set a short «lock_timeout» (hundreds of milliseconds) and retry with backoff. Check «pg_stat_activity» for long-running transactions first, since one idle-in-transaction session can block the lock for hours.

          ~~~sql A metadata-only change, done safely
          SET lock_timeout = '200ms';
          ALTER TABLE orders ADD COLUMN note text;   -- on 55P03 (lock_not_available), wait and retry
          ~~~

          **Indexes:** «CREATE INDEX CONCURRENTLY» builds without blocking writes (it takes SHARE UPDATE EXCLUSIVE). It cannot run inside a transaction block, and if it fails it leaves an INVALID index to drop and retry.

          **Constraints:** add them «NOT VALID» (no scan, brief lock), then «VALIDATE CONSTRAINT» separately, which scans under SHARE UPDATE EXCLUSIVE and lets reads and writes continue. For NOT NULL, add a «CHECK (col IS NOT NULL) NOT VALID», validate it, then «SET NOT NULL» skips its scan because the valid check proves there are no nulls (PostgreSQL 18 can also mark a NOT NULL constraint itself NOT VALID).

          **Rewrites: expand and contract.** Never rewrite a hot table in place.

          1. **Expand:** add the new column (metadata only).
          2. **Dual-write:** the application (or a trigger) writes both the old and new columns.
          3. **Backfill** existing rows in batches: a few thousand rows per transaction by primary-key range, a pause between batches, watching replication lag and vacuum, recording the last id so it can resume.
          4. **Switch reads** to the new column, behind a flag.
          5. **Contract:** stop writing the old column; drop it in a later release.

          :::pitfall One giant UPDATE
          «UPDATE orders SET new_col = …» on 200 million rows is one transaction: it writes a new version of every row, generates enormous WAL, lags every replica, bloats the table, and holds row locks until it commits. Batches keep each of those small.
          :::

          :::aside MySQL
          InnoDB can add a column instantly («ALGORITHM=INSTANT», since 8.0.12; at any position since 8.0.29), but every DDL still needs a metadata lock, which queues exactly like PostgreSQL's. For changes that need a copy, gh-ost (reads the binlog, no triggers) and pt-online-schema-change (triggers) build a shadow table and swap it in.
          :::

          @lab pg:migrations Zero-downtime schema changes on a real Postgres, with exercises

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: '«ALTER TABLE orders ADD COLUMN note text» is metadata-only. Why can it still cause an outage?', options: ['It rewrites the table', 'While it waits for its ACCESS EXCLUSIVE lock, every later query queues behind it', 'It drops indexes', 'It disables autovacuum'], answer: 1, why: 'The lock queue: a waiting exclusive request blocks later conflicting requests, even plain SELECTs.' },
          { q: 'Which change rewrites the whole table in PostgreSQL?', options: ['ADD COLUMN with DEFAULT 0', 'ADD COLUMN with DEFAULT clock_timestamp()', 'Raising varchar(50) to varchar(100)', 'ADD CONSTRAINT … NOT VALID'], answer: 1, why: 'A volatile default must be computed per row. Constant defaults are stored as metadata.' },
        ],
        defend: [
          {
            q: 'You need to ALTER a 200-million-row table at peak traffic. Walk me through it.',
            weak: 'We run the migration in a maintenance window, or we just run it: adding a column is fast in modern Postgres.',
            whyWeak: 'It ignores the lock queue, which turns even a fast ALTER into an outage when something holds the table, and it has no plan for changes that rewrite.',
            follow: [
              { q: 'Adding a column is metadata-only. What can still go wrong?', a: 'It needs ACCESS EXCLUSIVE. If a long query or an idle transaction holds the table, the ALTER waits, and every later query queues behind it; the pool fills and requests fail until the blocker finishes.' },
              { q: 'How do you run it safely?', a: 'Check pg_stat_activity for long transactions, SET lock_timeout to a few hundred milliseconds, and retry with backoff on lock_not_available. The ALTER either gets in quickly or steps aside.' },
              { q: 'The change is a column type change. Now what?', a: 'That rewrites the table under an exclusive lock: minutes of outage. Use expand and contract: add a new column, dual-write, backfill in batches, switch reads, drop the old one later.' },
              { q: 'How do you backfill 200 million rows?', a: 'Batches of a few thousand by primary-key range, one transaction each, throttled, watching replication lag and vacuum, resumable from the last id. Never one UPDATE over the whole table.' },
              { q: 'You also need an index and a NOT NULL constraint.', a: 'CREATE INDEX CONCURRENTLY outside a transaction, dropping it if it ends INVALID. For NOT NULL: a CHECK (col IS NOT NULL) NOT VALID, VALIDATE it, then SET NOT NULL, which skips the scan.' },
            ],
            strong: [
              'Most ALTERs take ACCESS EXCLUSIVE; the lock queue makes a waiting ALTER block all later queries.',
              'Classify: metadata-only, scan, or rewrite.',
              'Short lock_timeout with retries; check for long transactions first.',
              'CREATE INDEX CONCURRENTLY; NOT VALID then VALIDATE for constraints.',
              'Rewrites become expand-and-contract with a batched, throttled, resumable backfill.',
            ],
            flags: ['"It is fast, so it is safe"', 'No lock_timeout', 'One giant UPDATE for the backfill', 'Plans a rewrite of a hot table in place'],
          },
        ],
      },

      /* ───────────── 4. MongoDB modelling ───────────── */
      {
        lesson: 'db-mongo', title: 'Documents: embed or reference?', mins: 9,
        remember: 'A document is both the unit you read in one go and the unit that is updated atomically. Embed what is read and changed together and stays bounded; reference what grows without limit or is shared and changed on its own.',
        cue: 'an array inside a document that can grow with usage (comments, events, followers) → reference it, or keep only a bounded subset embedded',
        body: R`
          MongoDB's own guidance is a single sentence: data that is accessed together should be stored together. Two properties of a document decide what "together" can mean:

          - **One read.** An embedded order with its line items comes back in one fetch, with no join.
          - **One atomic write.** A write to a single document is atomic, so the order and its items change together without a transaction.

          ## Embed when

          - The child belongs to the parent ("has-a", "contains"): an order's line items, a user's addresses.
          - It is read with the parent nearly every time.
          - It is bounded: a handful, or a known maximum.

          ## Reference when

          - **It grows without bound.** Comments on a popular post, events on a device, followers of an account. Every append rewrites a bigger document, and eventually it hits the **16 MiB** document limit. MongoDB lists unbounded arrays as an anti-pattern.
          - **It is shared.** A product appears in thousands of orders. Embedding it copies it everywhere; reference it, but **copy the fields that must not change** (the price paid) into the order.
          - **It is updated on its own, often, by many writers.** One hot document becomes a contention point.
          - **It is read on its own.** Embedded data cannot be fetched without its parent.

          ## The hybrids interviewers like

          | Pattern | Shape | Example |
          |---|---|---|
          | Subset | embed the few you show, reference the rest | the 10 newest reviews on the product; all reviews in their own collection |
          | Extended reference | reference, plus a copy of the fields you display | an order holds «customer_id» and the customer's name |
          | Bucket | group many small items into bounded documents | one document per device per hour of readings |

          ## Joins and transactions exist, at a price

          «$lookup» joins collections, and multi-document transactions exist (replica sets since 4.0, sharded clusters since 4.2). Both cost more than a single-document read or write. A design that needs them on every request has probably drawn its document boundaries in the wrong place.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A post can get hundreds of thousands of comments. How do you store them?', options: ['Embed all comments in the post', 'Comments in their own collection, referencing the post; maybe embed the latest few', 'One document per comment, embedding the whole post', 'A single global comments document'], answer: 1, why: 'Unbounded growth breaks the 16 MiB limit and makes every write rewrite a large document. Reference, with the subset pattern for display.' },
          { q: 'An order references a product. The product\'s price changes next week. What should the order show?', options: ['The new price', 'The price paid, copied into the order at purchase', 'Whatever $lookup returns', 'Nothing: prices belong to products'], answer: 1, why: 'Facts at the time of the order are the order\'s data. Copy them in; reference the product for everything else.' },
        ],
        defend: [
          {
            q: 'Embed or reference? How do you decide in a document database?',
            weak: 'Embedding is faster because there are no joins, so we embed as much as possible.',
            whyWeak: 'It optimises one read and ignores growth, sharing, write contention and the document size limit.',
            follow: [
              { q: 'What does embedding buy you, precisely?', a: 'One read for the whole aggregate, and atomic updates because a single-document write is atomic.' },
              { q: 'When does embedding go wrong?', a: 'When the embedded part grows without bound (it approaches the 16 MiB limit and every write rewrites more), when it is shared across many parents, when many writers update it independently, or when it is needed on its own.' },
              { q: 'A product is referenced by orders. Anything to embed anyway?', a: 'The fields that must reflect the time of purchase, such as name and price paid. That is the extended-reference pattern.' },
              { q: 'Comments on a post: what shape?', a: 'A separate comments collection referencing the post, plus the latest few embedded for display (the subset pattern).' },
              { q: 'When would you reach for a multi-document transaction?', a: 'Rarely, for genuine cross-aggregate invariants. If most requests need one, the document boundaries are probably wrong.' },
            ],
            strong: [
              'A document is the unit of a single read and of an atomic write.',
              'Embed owned, bounded data that is read and changed together.',
              'Reference unbounded, shared, independently updated or independently read data.',
              'Know the hybrids: subset, extended reference, bucket.',
              'Copy point-in-time facts into the referencing document.',
            ],
            flags: ['"Always embed"', 'Unbounded arrays', 'Ignores the 16 MiB limit', 'Joins and transactions on every request'],
          },
        ],
      },

      /* ───────────── 5. quorum ───────────── */
      {
        lesson: 'db-quorum', title: 'Tunable consistency: quorum reads and writes', mins: 10,
        remember: 'With RF replicas, a write acknowledged by W and a read from R are guaranteed to overlap when R + W > RF. QUORUM is a majority, so QUORUM writes and reads overlap and tolerate a minority of replicas down.',
        cue: '"we use Cassandra (or Dynamo) with ONE" → ask what a read right after a write may return, and what R + W is against RF',
        body: R`
          In Cassandra (and other Dynamo-style stores) each key lives on **RF** replicas, and every request chooses its own **consistency level**: how many replicas must answer before the coordinator replies.

          | Level | Replicas that must answer |
          |---|---|
          | ONE, TWO, THREE | that many |
          | QUORUM | a majority: floor(RF / 2) + 1 (across all datacenters) |
          | LOCAL_QUORUM | a majority in the coordinator's datacenter |
          | EACH_QUORUM | a majority in every datacenter |
          | ALL | every replica |
          | ANY (writes only) | one replica, or just a hint stored by the coordinator |

          ## Why R + W > RF matters

          A write succeeds once W replicas have it; the others catch up later. A read asks R replicas and returns the value with the newest timestamp. If R + W > RF, every possible set of R replicas includes at least one of the W, so the read sees the latest acknowledged write. Cassandra's own docs describe this overlap as W + R > RF.

          @sim quorum

          Try ONE and ONE (a read can miss the write two times in three), then QUORUM and QUORUM, then take replicas down.

          ## The trade, per request

          | Writes / reads | Overlap with RF = 3 | Survives replicas down |
          |---|---|---|
          | QUORUM / QUORUM | yes (2 + 2 > 3) | 1 for both |
          | ONE / ONE | no | 2 for both, but reads can be stale |
          | ALL / ONE | yes (3 + 1 > 3) | writes fail with 1 down |
          | ONE / ALL | yes | reads fail with 1 down |

          Across datacenters, LOCAL_QUORUM keeps requests off the WAN; the overlap guarantee then holds within one datacenter only.

          ## What overlap does not give you

          - **Not linearisable for concurrent writes.** Conflicts are resolved by write timestamp: last write wins, and Cassandra's correctness depends on synchronised clocks (NTP). Two concurrent writes can lose one silently.
          - **Compare-and-set** («INSERT … IF NOT EXISTS», «UPDATE … IF balance = 100») needs lightweight transactions, which run Paxos at SERIAL or LOCAL_SERIAL and cost several round trips.
          - **Convergence is background work.** Hinted handoff (a coordinator holds writes for a down replica for up to «max_hint_window», 3 hours by default), read repair and regular repairs bring lagging replicas up to date.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'RF = 5. What is QUORUM?', options: ['2', '3', '4', '5'], answer: 1, why: 'floor(5 / 2) + 1 = 3. It tolerates two replicas down.' },
          { q: 'RF = 3, writes at ONE, reads at QUORUM. Does a read always see the latest acknowledged write?', options: ['Yes', 'No: 1 + 2 is not greater than 3', 'Only in one datacenter', 'Only with lightweight transactions'], answer: 1, why: 'R + W = 3, not more than RF = 3, so a read can pick the two replicas the write has not reached.' },
        ],
        defend: [
          {
            q: 'Explain tunable consistency with quorum reads and writes.',
            weak: 'Cassandra is eventually consistent, but QUORUM makes it strongly consistent.',
            whyWeak: 'It skips the mechanism (the overlap of read and write sets), the availability cost, and what quorum still does not guarantee.',
            follow: [
              { q: 'Why exactly does QUORUM plus QUORUM see the latest write?', a: 'Two majorities of the same replicas always share at least one member, so R + W > RF: some replica in every read set has the write, and the read returns the newest timestamp.' },
              { q: 'With RF = 3, how many replicas can you lose?', a: 'QUORUM needs 2, so one replica per key can be down for both reads and writes. With two down, QUORUM fails; ONE still works but may be stale.' },
              { q: 'Is it now linearisable?', a: 'No. Concurrent writes are resolved by timestamp (last write wins), so clock skew can pick the wrong one. Compare-and-set needs lightweight transactions (Paxos, SERIAL).' },
              { q: 'You run two datacenters. Which level?', a: 'Usually LOCAL_QUORUM for both, to keep latency local, accepting that the guarantee is per datacenter; EACH_QUORUM for writes that must be durable in every region before acknowledging.' },
              { q: 'How do lagging replicas catch up?', a: 'Hinted handoff for short outages (up to the hint window, 3 hours by default), read repair, and regular anti-entropy repair.' },
            ],
            strong: [
              'Per-request consistency: how many of RF replicas must answer.',
              'R + W > RF guarantees overlap; QUORUM is floor(RF/2) + 1.',
              'Availability: QUORUM tolerates a minority down; ALL tolerates none.',
              'Not linearisable: last write wins by timestamp; LWT (Paxos) for compare-and-set.',
              'LOCAL_QUORUM versus EACH_QUORUM across datacenters; hints and repair for convergence.',
            ],
            flags: ['"QUORUM means strongly consistent", full stop', 'Cannot do the R + W arithmetic', 'Ignores clocks and last-write-wins', 'Uses ALL for durability without noticing the availability cost'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
