(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'design', title: 'Three design sketches', short: 'Design',
    blurb: 'Quick looks at three classic design prompts: a URL shortener, a news feed and a payment system. The shape, the decisions that matter, and where each one breaks.',
    intro: R`
      Each sketch follows the same order, and the same order works in an interview:

      1. **The ask**: what it must do, and the numbers that size it.
      2. **The shape**: the boxes and arrows, drawn once.
      3. **The decisions that matter**: two or three choices with real alternatives and costs.
      4. **Where it breaks**: the failure modes, most of them from earlier modules.

      These are sketches, not complete designs: each stops where the decisions that matter have been made.
    `,
    items: [
      /* ───────────── 1. URL shortener ───────────── */
      {
        lesson: 'hd-url', title: 'A URL shortener', mins: 11,
        remember: 'A URL shortener is a read-heavy key-value lookup. The design decisions are how to generate short codes without collisions across servers, 301 versus 302, and keeping click counting off the redirect path.',
        cue: '"design a URL shortener" → size it (writes, reads, storage), then go straight to code generation, the redirect status, caching and analytics',
        body: R`
          ## The ask

          - Create a short link for a long URL; optionally a custom alias and an expiry.
          - Redirect a short link to its URL, fast, for anyone.
          - Count clicks.

          | Number | Estimate |
          |---|---|
          | New links | 100 million a month: about 40 a second |
          | Redirects | about 100 per link: about 4,000 a second on average, several times that at peak |
          | Storage | 6 billion links over five years at about 500 bytes each: about 3 TB |
          | Code length | 62 characters (a-z, A-Z, 0-9): 6 characters give 56.8 billion codes, 7 give 3.5 trillion |

          ## The shape

          ~~~mermaid The redirect path stays short; everything else happens off it
          flowchart LR
            u[Browser] --> cdn[CDN / edge cache]
            cdn --> api[Redirect service]
            api --> cache[(Redis: code to URL)]
            api --> db[(Key-value store: code to URL)]
            api -.->|click event| q[[Kafka]]
            q -.-> stats[Analytics]
            c[Create link API] --> db
          ~~~

          ## Decision 1: generating codes

          | Approach | How | Trade-off |
          |---|---|---|
          | **Counter, base62-encoded** | each server reserves a block of ids (say 1,000) from a central sequence and encodes them | no collisions and short codes; sequential codes are guessable unless shuffled with a reversible permutation |
          | **Random 7 characters** | generate, insert, retry on a unique-key violation | simple and unguessable; collisions are rare (at 6 billion links, about 0.2% of new codes) and the unique constraint catches them |
          | **Hash of the URL, truncated** | first 7 characters of a hash | the same URL always gets the same code (which may not be wanted); truncation collisions still need handling |

          In every case the **unique constraint** on the code is what guarantees correctness, exactly as with idempotency keys.

          ## Decision 2: 301 or 302

          A 301 (moved permanently) is heuristically cacheable: browsers and proxies may remember it and never ask again. That saves load but loses those clicks from your analytics, and you can no longer change or disable the link for those clients. A 302 is not cached by default, so every click reaches you. Most shorteners that sell analytics use 302 (or 307).

          ## Decision 3: keep the redirect path short

          - **Cache hot links** at the edge and in Redis; the long tail goes to the key-value store. One viral link is a hot key, so the edge cache matters most (the Caching module).
          - **Count clicks asynchronously**: publish a click event and return the redirect; aggregate elsewhere. A synchronous counter update on every redirect turns your busiest path into a write path.

          ## Where it breaks

          - A viral link: a hot key, and a stampede when its cache entry expires.
          - Abuse: links to malware and phishing need scanning and rate limits on creation.
          - Expiry and deletion: cached redirects (and browser-cached 301s) outlive the link unless you plan for it.

          @quiz 0
        `,
        quiz: [
          { q: 'Why do shorteners that sell analytics usually redirect with 302 rather than 301?', options: ['302 is faster', '301 may be cached by browsers, so later clicks never reach the service', '301 is deprecated', '302 preserves the method'], answer: 1, why: 'A 301 is heuristically cacheable; a cached redirect is a click you never see.' },
        ],
        defend: [
          {
            q: 'Design a URL shortener.',
            weak: 'Hash the URL with MD5, take the first seven characters, store it in a database, and redirect with a 301.',
            whyWeak: 'It skips sizing, ignores truncation collisions, picks 301 without noticing it loses analytics and control, and never mentions caching.',
            follow: [
              { q: 'How many reads and writes, and how much storage?', a: 'For 100 million new links a month: about 40 writes and 4,000 redirects a second on average, peaks several times higher, about 3 TB over five years. Read-heavy, so the redirect path is the one to optimise.' },
              { q: 'How do several servers generate codes without colliding?', a: 'Either reserve blocks from a central counter and base62-encode them (shuffled if codes must not be guessable), or generate random codes and retry on a unique-key violation. The unique constraint is the real guarantee.' },
              { q: '301 or 302?', a: '302 if you need every click (analytics, changing or disabling links); 301 if you want clients to cache and stop asking, giving up both.' },
              { q: 'How do you count clicks without slowing redirects?', a: 'Publish a click event (to Kafka, say) and redirect immediately; aggregate counts downstream. Never a synchronous counter write on the redirect path.' },
              { q: 'One link goes viral. What happens?', a: 'It is a hot key on one shard and one cache entry. Serve it from the CDN and an in-process cache, and protect its cache entry from a stampede when it expires.' },
            ],
            strong: [
              'Size it: writes, reads, storage, code length.',
              'Code generation: counter blocks or random with retry; the unique constraint guarantees it.',
              '302 for analytics and control; 301 trades both for fewer requests.',
              'Edge and Redis caching for hot links; clicks counted asynchronously.',
              'Failure modes: viral hot keys, stampedes, abuse, stale cached redirects.',
            ],
            flags: ['No sizing', 'Truncated hash with no collision handling', 'Synchronous click counting', 'No caching story'],
          },
        ],
      },

      /* ───────────── 2. news feed ───────────── */
      {
        lesson: 'hd-feed', title: 'A news feed', mins: 11,
        remember: 'A feed is either assembled when a post is written (push) or when a feed is read (pull). Push makes reads cheap and big accounts expensive; pull does the opposite. Real systems push for most accounts and pull for the biggest.',
        cue: '"design a feed" or "design Twitter" → fan-out on write versus on read, and what happens when an account with millions of followers posts',
        body: R`
          ## The ask

          - Users follow other users and post.
          - A user's home feed shows recent posts from everyone they follow, newest (or best) first, quickly.
          - Reads far outnumber writes, and follower counts are wildly uneven.

          ## The shape

          ~~~mermaid
          flowchart LR
            p[Post service] --> posts[(Posts store)]
            p -->|new post event| fo[Fan-out workers]
            fo --> tl[(Timeline cache: per-user lists of post ids)]
            r[Feed service] --> tl
            r -->|big accounts only| posts
            r --> h[Hydrate: post bodies, authors, counts]
          ~~~

          ## Decision 1: push, pull, or both

          - **Push (fan-out on write).** When someone posts, write the post's id into each follower's timeline list. Reading a feed is one lookup. A post by an account with 50,000 followers is 50,000 writes, most of them into timelines nobody opens today.
          - **Pull (fan-out on read).** Store each post once. Reading a feed queries every followed account's recent posts and merges them: cheap writes, expensive reads, and reads are the common operation.
          - **Hybrid.** Push for ordinary accounts; for accounts above a follower threshold, skip the fan-out and merge their recent posts in at read time. Bursts are capped and reads stay cheap.

          @sim fanout

          ## Decision 2: what the timeline holds

          Store **post ids, capped** (say the latest few hundred per user) in a fast store such as Redis, not whole posts. Hydrate the bodies, author details and counts when the feed is read, from caches. That keeps the fan-out writes small and lets edits and deletions show up without rewriting timelines.

          ## Decision 3: paging

          Page with a **cursor** ("posts older than id X"), never with an offset: new posts arriving at the top shift every offset, so users see duplicates or miss items. The Postgres Lab's keyset pagination exercise is the same idea in SQL.

          ## Where it breaks

          - **A big account posts**: a fan-out burst that delays everyone's timelines, unless it is pulled instead.
          - **Inactive users**: pushing into timelines nobody reads is pure waste; skip them and build their feed on demand when they return.
          - **Deletes and blocks**: filter at read time; fan-out has already happened.
          - **The timeline cache is lost**: rebuild on demand from the posts store, with the stampede protections from the Caching module.

          @lab pg:pagination Pagination that does not fall over, keyset style, in the Postgres Lab

          @quiz 0
        `,
        quiz: [
          { q: 'An account with 30 million followers posts. With pure fan-out on write, what happens?', options: ['One write', '30 million timeline writes, delaying everyone\'s feeds behind them', 'The post is rejected', 'Followers pull it automatically'], answer: 1, why: 'Every follower\'s timeline gets the id. Hence the hybrid: pull the biggest accounts at read time.' },
        ],
        defend: [
          {
            q: 'Design the home feed for a social network.',
            weak: 'When a user opens the app, we query the posts table for everyone they follow, sorted by time, with a LIMIT.',
            whyWeak: 'That is pure pull with a large IN-list query on every feed load, the most frequent operation. It never considers precomputing, follower skew, or paging.',
            follow: [
              { q: 'Push or pull?', a: 'Push makes reads one lookup but makes big accounts expensive to post; pull makes posts cheap but every read merges dozens of accounts. Use push for most accounts and pull for accounts above a follower threshold.' },
              { q: 'What exactly do you store per user?', a: 'A capped list of post ids in a fast store, hydrated at read time. Small fan-out writes, and edits or deletes show up without rewriting timelines.' },
              { q: 'How do you page through it?', a: 'With a cursor: posts older than the last id seen. Offsets break as new posts arrive at the top.' },
              { q: 'A celebrity posts. What do followers see, and when?', a: 'In the hybrid, their post is merged in at read time, so it appears immediately and costs no fan-out burst.' },
              { q: 'Half your users have not opened the app in a month. Does that change anything?', a: 'Skip fan-out for inactive users and rebuild their timeline on demand when they return.' },
            ],
            strong: [
              'Fan-out on write versus on read, and the follower skew that breaks each.',
              'The hybrid: push for most, pull for the biggest accounts.',
              'Timelines hold capped post ids; bodies are hydrated on read.',
              'Cursor pagination, not offsets.',
              'Failure modes: celebrity bursts, inactive users, deletes, cache loss.',
            ],
            flags: ['One query over the posts table per feed load', 'Pure push with no celebrity story', 'Offset pagination', 'Storing whole posts in every timeline'],
          },
        ],
      },

      /* ───────────── 3. payments ───────────── */
      {
        lesson: 'hd-pay', title: 'A payment system', mins: 13,
        remember: 'A payment system is built so that nothing is charged twice and nothing is lost when every hop can time out: an idempotency key end to end, a state machine for each payment, an append-only double-entry ledger, and reconciliation against the provider.',
        cue: '"design a payment system" → walk one payment through the states, then say what happens when the call to the provider times out',
        body: R`
          Almost everything in this lab meets in one place here: timeouts with unknown outcomes, idempotency, outboxes, idempotent consumers and reconciliation.

          ## The ask

          - Charge a customer for an order through a payment service provider (PSP), refund later.
          - Never charge twice; never lose a payment that succeeded.
          - Keep books that always balance, and match the provider's records.

          ## The shape

          ~~~mermaid
          flowchart TB
            c[Checkout] -->|Idempotency-Key| api[Payment service]
            api -->|same key| psp[Payment provider]
            api --> db[(One database: payments, ledger, outbox)]
            psp -.->|webhooks| wh[Webhook receiver]
            wh --> db
            db --> rel[Outbox relay]
            rel --> k[[Events]]
            rec[Reconciliation job] --> db
            rec --> psp
          ~~~

          ## One payment, step by step

          1. Checkout sends the payment request with an **idempotency key** for this order's payment. A retry with the same key returns the stored result.
          2. The payment service records the payment as **CREATED**, with the key, in its database.
          3. It moves the payment to **AUTHORISING** and calls the provider, passing an idempotency key so the provider also deduplicates.
          4. The provider answers **authorised** or **declined**: the service records the new state, writes ledger entries, and inserts an outbox event, all in one transaction.
          5. **The call times out.** The payment stays AUTHORISING, which now means "unknown". It is never marked failed by guessing.
          6. The truth arrives one of two ways: the provider's **webhook** (Stripe retries failed webhook deliveries for up to three days, in no guaranteed order, so the receiver dedupes by event id), or a **recovery job** that asks the provider about every payment stuck in an unknown state.

          ~~~seq A timeout that is resolved, not guessed
          actors: Checkout, Payments, Provider, Recovery job
          Checkout -> Payments: pay order 81 (key k81)
          state Payments: CREATED
          Payments -> Provider: authorise (key k81)
          state Payments: AUTHORISING
          note: The provider charges the card, but its answer never arrives.
          Payments --> Checkout: 202 Accepted: pending
          Recovery job -> Provider: status of k81?
          Provider --> Recovery job: authorised
          Recovery job -> Payments: record AUTHORISED + ledger entries
          state Payments: AUTHORISED
          ~~~

          ## The ledger: double entry, append only

          Every movement of money is recorded as entries that **sum to zero**: debit the customer's account, credit the merchant's and the fees account. Entries are never updated or deleted; a refund or a correction is a new set of entries that reverses the old ones. Balances are derived from entries, so the books can always be re-added and checked, and an audit trail exists by construction.

          | Entry | Account | Amount |
          |---|---|---|
          | 1 | customer receivable | −50.00 |
          | 1 | merchant payable | +48.55 |
          | 1 | fees revenue | +1.45 |

          ## Reconciliation

          Once a day, compare your ledger with the provider's settlement report, line by line, by provider reference. Anything on only one side, or with a different amount, goes to an investigation queue. It catches what every other mechanism missed: a webhook that never came, a bug, a manual refund issued in the provider's dashboard.

          @sim timeout mode=deadline

          @lab pg:races Idempotent payment inserts on a real Postgres

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'The call to the provider times out. What state should the payment be in?', options: ['FAILED', 'SUCCEEDED', 'Still AUTHORISING ("unknown"), until a webhook or a status query resolves it', 'Deleted'], answer: 2, why: 'A timeout says nothing about the outcome. Guessing either way charges twice or loses money.' },
          { q: 'A customer is refunded. What happens in a double-entry ledger?', options: ['The original entries are deleted', 'The original entries are updated to zero', 'New entries are appended that reverse the originals', 'The balance column is edited'], answer: 2, why: 'Ledgers are append-only: corrections are new balanced entries, so history and audits stay intact.' },
        ],
        defend: [
          {
            q: 'Design a payment system. How do you guarantee nobody is charged twice and no payment is lost?',
            weak: 'We call the payment provider inside a database transaction and retry on failure. If it fails, we mark the payment failed.',
            whyWeak: 'A remote call cannot be part of a database transaction; retrying without a key double-charges; and "failed" after a timeout loses payments that actually succeeded.',
            follow: [
              { q: 'Walk one payment through its states.', a: 'CREATED when the request arrives with its idempotency key; AUTHORISING before calling the provider; then AUTHORISED or DECLINED from the provider\'s answer, a webhook or a status query; later CAPTURED and possibly REFUNDED. Each transition is recorded with its ledger entries and an outbox event in one transaction.' },
              { q: 'The provider call times out. What do you do?', a: 'Leave it AUTHORISING, meaning unknown. Never guess. Resolve it from the provider\'s webhook (deduped by event id) or a recovery job that queries the provider by the idempotency key.' },
              { q: 'How do you stop double charges on retries?', a: 'An idempotency key from the client, stored with the result in the same transaction, and passed on to the provider so it deduplicates too.' },
              { q: 'Why a double-entry ledger?', a: 'Every movement balances to zero, entries are append-only, and balances are derived. You can always re-add the books, corrections are reversing entries, and the audit trail is built in.' },
              { q: 'How do you know your records match the provider\'s?', a: 'Daily reconciliation against the provider\'s settlement report by reference, with mismatches sent to an investigation queue.' },
            ],
            strong: [
              'Idempotency key end to end: client, payment service, provider.',
              'A per-payment state machine; a timeout means unknown, resolved by webhook or status query.',
              'Ledger, state change and outbox event committed in one transaction.',
              'Append-only, double-entry ledger: balanced entries, reversals for corrections.',
              'Daily reconciliation with the provider\'s settlement data.',
            ],
            flags: ['A remote call inside a database transaction', 'Marking timeouts as failed', 'Retries without a key', 'Mutable balances with no ledger'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
