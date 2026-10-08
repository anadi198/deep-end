(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'distributed', title: 'Distributed state', short: 'Distributed',
    blurb: 'Two services that disagree, CAP and PACELC as a working tool, and consistent hashing.',
    items: [
      /* ───────────── 1. drift ───────────── */
      {
        lesson: 'ds-drift', title: 'Two services disagree about the state of the world', mins: 12,
        remember: 'Give every fact one owner. Publish its changes from the owner\'s own transaction (an outbox or the change log), apply them idempotently and in version order, and reconcile against the owner on a schedule, because something will still slip through.',
        cue: 'code that commits to the database and then publishes an event (or calls another service) → ask what happens if the process dies between the two',
        body: R`
          An order service owns orders. A shipping service keeps its own copy of each order's status, fed by events. One day support finds orders that are PAID in one and still CREATED in the other.

          ## How copies drift

          1. **The dual write.** The order service commits, then publishes. If it dies between the two, the event is never sent. If it publishes first and then fails to commit, the event describes something that never happened.
          2. **Lost, duplicated and reordered events.** Redelivery is normal; a retried older event can arrive after a newer one.
          3. **A consumer that applies blindly.** A duplicate PAID sends a second receipt; a late PAID overwrites SHIPPED.
          4. **Everything else.** A consumer bug, a manual fix in one database, a partial failure halfway through a multi-step workflow.

          @sim drift

          Try each publishing mode with each consumer, then turn on reconciliation.

          ## Prevent: publish from the owner's transaction

          **The transactional outbox.** In the same transaction as the business change, insert the event into an «outbox» table. A separate relay reads the outbox and publishes each row, retrying until the broker acknowledges, then marks it sent. The event exists if and only if the change committed. Delivery becomes at least once, so duplicates are possible but loss is not ([microservices.io: transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)).

          ~~~sql The change and its event commit together
          BEGIN;
          UPDATE orders SET status = 'PAID', version = version + 1 WHERE id = 7;
          INSERT INTO outbox (aggregate_id, type, version, payload)
          VALUES (7, 'OrderPaid', 4, '{"order_id": 7, "amount_cents": 500}');
          COMMIT;
          ~~~

          **Change data capture** reaches the same place from the other side: a connector (Debezium, for example) reads the database's write-ahead log and turns committed changes, often rows of an outbox table, into events. Nothing can commit without appearing in the log.

          ## Apply: idempotent and in version order

          - **Skip duplicates** by event id (the Requests module's processed-events table).
          - **Never move backwards.** Each event carries the entity's version; apply a status only if its version is newer than the stored one.
          - **Run each event's side effect once**, keyed by its event id, even if its status update was skipped as stale: a late PAID event still owes its receipt.

          ## Detect and repair: reconcile

          Even with all of that, copies drift through bugs and manual changes. A **reconciliation job** periodically compares the copy with the owner: by key, by a version, or by a hash per batch of keys. It reports and repairs differences by re-reading the owner, never by hand-editing the copy, and it keeps an audit of what it changed. Reconciliation bounds how long a disagreement can last; it does not resend side effects that were missed.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'The service commits an order, then publishes «OrderPaid». The pod is killed between the two. What now?', options: ['The broker retries', 'The order is paid in the database and no event exists; consumers will never hear of it', 'The transaction rolls back', 'Kafka exactly-once covers it'], answer: 1, why: 'That is the dual-write problem. The outbox makes the event part of the same commit.' },
          { q: 'With an outbox, which failure is still possible?', options: ['Lost events', 'Duplicate events', 'Events for uncommitted changes', 'None'], answer: 1, why: 'The relay may publish a row and crash before marking it sent, so it publishes it again. Consumers must be idempotent.' },
        ],
        defend: [
          {
            q: 'Two services disagree about the state of an order. How did it happen, and how do you stop it happening again?',
            weak: 'Probably a network glitch dropped an event. We will add retries to the publisher.',
            whyWeak: 'Retries do not help an event that was never created: the classic cause is the dual write. And there is no plan to detect or repair drift that has already happened.',
            follow: [
              { q: 'What is the dual-write problem?', a: 'Writing to the database and publishing to the broker are two separate operations. A crash between them loses the event (commit first) or publishes a change that never committed (publish first).' },
              { q: 'How does the transactional outbox fix it?', a: 'The event row is inserted in the same transaction as the change, so both commit or neither does. A relay publishes outbox rows until acknowledged. Delivery becomes at least once.' },
              { q: 'What must the consumer do?', a: 'Skip duplicates by event id, apply a status only when its version is newer than the stored one, and run each event\'s side effect once even if its status update was stale.' },
              { q: 'Drift happened anyway. How do you find and fix it?', a: 'A reconciliation job comparing the copy with the owner by key and version, or by hash per batch; repair by re-reading the owner, with an audit trail. Alert on the mismatch rate.' },
              { q: 'Why not just call the other service synchronously instead?', a: 'It is still two writes in two places, with the same partial-failure problem, plus coupling the two services\' availability. You would need the same idempotency and reconciliation.' },
            ],
            strong: [
              'One owner per fact; other services hold copies.',
              'Dual writes lose or invent events; the outbox or CDC ties publishing to the commit.',
              'Consumers dedupe by event id and apply in version order; side effects run once per event.',
              'Reconciliation against the owner detects and repairs what still slips through, with an audit.',
              'Delivery is at least once by design; duplicates are expected, loss is not.',
            ],
            flags: ['"Add retries to the publisher" for a lost event', 'No idea of the dual-write problem', 'Last-arrival-wins updates', 'Fixes drift by hand-editing the copy'],
          },
        ],
      },

      /* ───────────── 2. CAP ───────────── */
      {
        lesson: 'ds-cap', title: 'CAP and PACELC, as a working tool', mins: 9,
        remember: 'CAP only bites during a network partition: then each operation either refuses to answer (consistency) or answers with possibly stale data (availability). The rest of the time the trade is latency against consistency (PACELC).',
        cue: '"we chose an AP database" → ask which operations can tolerate stale reads, and what each one does during a partition and on an ordinary day',
        body: R`
          ## CAP, stated precisely

          When the network splits the nodes into groups that cannot talk to each other, an operation that reaches one side can either:

          - **refuse** (or wait) until it can coordinate with the other side, which keeps every read seeing the latest write (**consistency**, meaning linearisability), or
          - **answer** from what that side has, which keeps every request answered (**availability**) at the cost of possibly stale or conflicting data.

          Partitions are not optional in a real network, so "pick two of three" is misleading. The useful question is: **during a partition, which way does each operation go?** (Gilbert and Lynch proved the theorem in 2002.)

          ## PACELC: the other 99.9% of the time

          Daniel Abadi's extension (IEEE Computer, 2012): if there is a **P**artition, choose **A** or **C**; **E**lse, choose **L**atency or **C**onsistency. Waiting for remote replicas costs latency on every request, partition or not, and that is the trade systems actually make all day.

          | System, as usually run | During a partition | Normally |
          |---|---|---|
          | PostgreSQL, primary with async replicas | the primary keeps writing; a failover can lose recently acknowledged writes | reads from replicas are fast but can be stale |
          | Cassandra at ONE | answers on both sides; reconciles later | low latency, stale reads possible |
          | Cassandra at QUORUM | the minority side refuses | each request waits for a majority |
          | etcd, ZooKeeper | the minority side refuses | every write waits for a majority |
          | Kafka with «acks=all», «min.insync.replicas=2» | refuses writes when too few replicas are in sync | each write waits for the in-sync replicas |

          Kafka's broker defaults are «min.insync.replicas=1» and «unclean.leader.election.enable=false»: out of the box it will not elect an out-of-date leader, but with one in-sync replica required, an acknowledged write can still live on only the leader.

          ## Decide per operation, not per system

          | Operation | Needs | So |
          |---|---|---|
          | Reading your own profile after editing it | read-your-writes | read from the primary, or from a replica that has caught up to your write |
          | A like counter | eventual | any replica, any staleness |
          | Taking the last seat on a flight | linearisable | one place decides: the primary, a quorum, or a lock |
          | Showing a balance | at least monotonic reads | do not go backwards between two page loads |

          The consistency models in that column, from strongest: linearisable, sequential, causal, then the session guarantees (read-your-writes, monotonic reads), then eventual.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'According to CAP, when must a system choose between consistency and availability?', options: ['Always', 'Only during a network partition', 'Only under heavy load', 'Only with more than three nodes'], answer: 1, why: 'Without a partition both are possible; the everyday trade is latency against consistency (PACELC).' },
          { q: 'A user edits their profile and the next page shows the old version. Which guarantee was missing?', options: ['Linearisability across all users', 'Read-your-writes', 'Eventual consistency', 'Partition tolerance'], answer: 1, why: 'The read went to a replica that had not caught up with the user\'s own write. Route that user\'s reads to the primary or a caught-up replica.' },
        ],
        defend: [
          {
            q: 'Explain the CAP theorem, and how it affected a design decision you made.',
            weak: 'You can have two of consistency, availability and partition tolerance. We chose availability and partition tolerance, so we use eventual consistency.',
            whyWeak: '"Two of three" misstates it, partitions are not optional, and one label for the whole system hides the per-operation decisions that matter.',
            follow: [
              { q: 'State CAP precisely.', a: 'During a network partition, an operation on one side can either refuse until it can coordinate (staying linearisable) or answer from local data (staying available, possibly stale). Without a partition, you can have both.' },
              { q: 'What is PACELC and why does it matter more day to day?', a: 'Else, latency versus consistency: waiting for replicas costs latency on every request. That trade applies all the time, partitions or not.' },
              { q: 'Where does a Postgres primary with async replicas sit?', a: 'Replica reads can be stale; a failover can lose recently acknowledged writes because replication is asynchronous. Synchronous replicas trade latency for not losing them.' },
              { q: 'Which operations in your system need what?', a: 'Name them: the last seat or the account balance needs one place to decide (linearisable); a user\'s own edits need read-your-writes; counters and feeds can be eventual.' },
            ],
            strong: [
              'CAP applies during partitions: refuse (consistency) or answer possibly stale (availability).',
              'PACELC: otherwise, latency versus consistency, on every request.',
              'Real systems sit at different points, often configurably (Cassandra levels, Kafka in-sync replicas, sync replication).',
              'Choose per operation, naming the consistency model each needs.',
            ],
            flags: ['"Pick two of three"', 'Treats partition tolerance as optional', 'One label for the whole system', 'Cannot name a consistency model weaker than linearisable and stronger than eventual'],
          },
        ],
      },

      /* ───────────── 3. consistent hashing ───────────── */
      {
        lesson: 'ds-hash', title: 'Consistent hashing', mins: 9,
        remember: 'hash(key) mod N moves almost every key when N changes. A hash ring moves only about 1/N of them, and virtual nodes (many points per node) keep the load even.',
        cue: 'sharding or a cache cluster that will grow or shrink → ask how many keys move when a node is added, and how load stays even',
        body: R`
          ## The problem with mod N

          Placing keys with «hash(key) mod N» is perfectly even, until N changes. Going from 5 to 6 nodes changes the remainder for about five keys in six. For a cache cluster that is a near-total miss storm (the Caching module's stampede, everywhere at once); for a sharded database it is a near-total migration.

          ## The ring

          1. Hash the keys and the nodes onto the same circle of numbers (0 to 2^32 − 1, wrapping round).
          2. A key belongs to the first node clockwise from it.
          3. A new node takes over only the arc just before it, all of it from one neighbour; a removed node hands its arc to its successor.

          About 1/(N + 1) of keys move when a node is added: the minimum possible, since the new node must end up with its share.

          @sim ring

          Compare **hash mod N** with the ring, then set the virtual nodes to 1 and watch the busiest node.

          ## Virtual nodes

          With one point per node, arcs are uneven: one node may own twice its share, and a new node relieves only one neighbour. Giving every node many points ("virtual nodes", popularised by Amazon's Dynamo paper in 2007) evens the arcs out, spreads a new node's intake across all the others, and lets a bigger machine take more points. Cassandra's default configuration gives each node 16 tokens.

          ## Replication and hot keys

          - Replicas usually go on the next RF distinct nodes clockwise, so one ring decides both placement and replication.
          - Hashing spreads *keys*, not *load*: one very hot key still lands on one node.

          ## Alternatives worth naming

          | Scheme | Idea | Trade |
          |---|---|---|
          | Rendezvous (highest random weight) | for each key, pick the node with the highest hash(key, node) | minimal movement, no ring; computes a hash per node per lookup |
          | Jump consistent hash (Lamping and Veach, 2014) | a tiny function mapping a key to a bucket number | no memory and very even, but nodes can only be added or removed at the end |
          | Fixed slots (Redis Cluster's 16,384) | keys hash to slots; slots are assigned to nodes | moving a slot is explicit and incremental |

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A cache cluster of 9 nodes uses hash mod N. You add a tenth. Roughly what share of keys now map to a different node?', options: ['10%', '50%', '90%', '100%'], answer: 2, why: 'Changing N changes most remainders: about N/(N + 1). A ring would move about 1/10.' },
          { q: 'What do virtual nodes fix?', options: ['Hot keys', 'Uneven arcs, so some nodes own far more keys than others', 'Replication lag', 'Hash collisions'], answer: 1, why: 'Many points per node average out arc lengths. A single hot key is still on one node.' },
        ],
        defend: [
          {
            q: 'Why consistent hashing? Walk me through it.',
            weak: 'It distributes keys evenly across servers, so no server is overloaded.',
            whyWeak: 'mod N already distributes evenly. The point is how few keys move when servers are added or removed, and that is not mentioned.',
            follow: [
              { q: 'What is wrong with hash mod N?', a: 'When N changes, most keys get a new remainder, so nearly every key moves: a full miss storm for a cache, a full migration for a store.' },
              { q: 'How does the ring avoid that?', a: 'Keys and nodes hash onto one circle and a key belongs to the next node clockwise. Adding a node takes only the arc before it from one neighbour: about 1/(N+1) of keys.' },
              { q: 'One node holds 40% of the keys. Why, and what fixes it?', a: 'With few points per node, arc lengths vary a lot. Virtual nodes, many points per node, even them out and spread a new node\'s intake across everyone.' },
              { q: 'Where do replicas go?', a: 'On the next RF distinct nodes clockwise, so the same ring handles placement and replication.' },
              { q: 'Does it fix hot keys?', a: 'No: a single key always maps to one node. Hot keys need a local cache in front, or splitting the key into several copies.' },
            ],
            strong: [
              'mod N moves almost every key when N changes.',
              'The ring moves about 1/(N+1) of keys on an add: the minimum possible.',
              'Virtual nodes even out ownership, spread rebalancing, and allow weighting.',
              'Replicas on the next RF distinct nodes clockwise.',
              'It spreads keys, not one key\'s load; alternatives include rendezvous, jump hash and fixed slots.',
            ],
            flags: ['Only says "even distribution"', 'Does not know how many keys move', 'Never heard of virtual nodes', 'Claims it solves hot keys'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
