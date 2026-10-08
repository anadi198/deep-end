(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'requests', title: 'Requests, timeouts and duplicates', short: 'Requests',
    blurb: 'What a timeout really means, why retries need idempotency, how a payment gets charged twice, and what an average latency hides.',
    items: [
      /* ───────────── 1. timeouts ───────────── */
      {
        lesson: 'rq-timeout', title: 'A request timed out. What did the server actually do?', mins: 10,
        remember: 'A timeout is the caller giving up, not the server stopping. Unless it is told the deadline, the server keeps going: the work may finish, and the caller cannot tell.',
        cue: 'a 504, a timeout in a log, or "the client retried" → ask which of the four server outcomes happened, and what a retry would repeat',
        body: R`
          ## The path of one request

          A payment request crosses several hops, and each has its own idea of how long to wait:

          1. **The client** sends the request and starts its own timer.
          2. **The load balancer or gateway** forwards it, with its own timer. Envoy, for example, defaults to 15 s per route.
          3. **The service** queues the request until a worker thread is free, then runs the handler.
          4. **The handler** calls the database and maybe a payment provider, and commits.
          5. **The response** travels back through every hop.

          A timeout can fire at any hop. When it fires, that hop stops *waiting*. Nothing tells the hops further in to stop *working*:

          - A servlet thread keeps running after the client disconnects; it finds out only if it tries to write the response.
          - A SQL statement keeps running in the database after the application stops waiting for it, unless the database's own «statement_timeout» stops it.
          - gRPC sets **no deadline by default**, so a client that does not set one can wait forever. Java's «HttpClient» behaves the same when a request has no «timeout(...)».

          ~~~seq A timeout while the server keeps working
          actors: Client, Gateway, Service, Database
          Client -> Gateway: POST /payments
          Gateway -> Service: forward
          Service -> Database: BEGIN; INSERT charge
          state Database: slow: lock wait
          note: The client's timer runs out first.
          Client -> Client: timeout after 1 s
          note: The client shows an error. Nobody told the service.
          Database --> Service: insert done
          Service -> Database: COMMIT
          state Database: card charged
          Service --> Gateway: 200 OK
          Gateway --> Client: (connection already closed)
          ~~~

          ## Four outcomes behind one timeout

          | What the server did | What a blind retry does |
          |---|---|
          | Never received the request | the right thing |
          | Failed before changing anything | the right thing |
          | Finished; the answer was lost on the way back | repeats the work |
          | Is still working | runs alongside it |

          The caller cannot tell these apart. So the system has to be built so that it does not need to: either the retry is harmless (idempotency, the next lesson), or the caller can ask what happened (a status lookup by request id).

          @sim timeout mode=none

          Run it with **No retries** first. Nobody is charged twice, yet some users see an error *and* get charged: the server finished after the client gave up. Then try **Retry on timeout, no key**, and press **Compare every option**.

          ## Deadlines: tell the server when to stop

          A **deadline** is the moment after which nobody needs the answer. Passing it down lets every hop stop early:

          - Budgets shrink inward: the client allows 3 s, the gateway 2.5 s, the service 2 s for its own calls, the database statement 1.5 s. An inner timeout longer than an outer one does work nobody will receive.
          - gRPC sends the remaining time with each call (as a timeout, not a clock time, so clock skew does not matter), and Java and Go propagate it from an incoming call to outgoing ones by default.
          - Over HTTP you do the same by hand: a header with the remaining budget, checked before each expensive step.

          Cancellation is cooperative: the server checks the deadline before starting a step. Once an external side effect has happened (the card is charged), the server should finish recording it rather than abandon it halfway.

          :::key Choosing the timeout value
          Start from the dependency's latency distribution, not its average. Decide what share of calls you can afford to time out by mistake (say 0.1%) and use the matching percentile (p99.9), plus some padding. That is the method in the AWS Builders' Library article [Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/).
          :::

          ## Finding out what happened to one request

          - **A request id** generated at the edge and logged at every hop: gateway, service, database comments, the payment provider's reference.
          - **Status codes at the edge.** nginx logs 499 when the client closed the connection before the server answered; a gateway logs 504 when it gave up on the upstream. Those requests may still have succeeded.
          - **The effect itself**: look up the charge by idempotency key or business id.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'The client timed out after 1 s; the database commit happened at 1.6 s. What does the user see, and what happened to the card?', options: ['An error; the card was not charged', 'An error; the card was charged', 'Success; the card was charged', 'Nothing is decided until the client retries'], answer: 1, why: 'The client showed an error at 1 s. The server, never told to stop, committed at 1.6 s. This is the "charged but shown an error" row in the simulator.' },
          { q: 'Client 2 s, gateway 5 s, service-to-database 10 s. What is wrong?', options: ['Nothing: outer timeouts should be shortest', 'The inner timeouts are longer than the outer ones, so inner hops keep working after everyone outside has given up', 'The gateway timeout should be 0', 'The database timeout should equal the client timeout'], answer: 1, why: 'Budgets should shrink inward. Here the database may work for 8 s on a request whose client left at 2 s.' },
        ],
        defend: [
          {
            q: 'A request to your payment API timed out. What did your server actually do?',
            weak: 'It failed, so the client got a 504 and retried. We increased the timeout to stop it happening.',
            whyWeak: 'It treats a timeout as a failure. The server may have finished the charge, and the retry may charge again. A longer timeout only moves the problem and holds threads longer.',
            follow: [
              { q: 'The client retried. What stops a second charge?', a: 'An idempotency key: the client sends the same key on every retry, the server stores the key with the result of the first attempt in the same transaction as the charge, and a retry gets the stored result instead of a new charge. Without it, nothing does.' },
              { q: 'How would you find out what happened to that one request?', a: 'Follow its request id through the gateway, service and database logs; look for a 499 or 504 at the edge; then look up the effect directly, by idempotency key or order id, including at the payment provider.' },
              { q: 'Why not just make the timeout longer?', a: 'Every second of timeout is a second of a thread and a connection held. By Little\'s law, in-flight requests = rate × latency, so long timeouts exhaust pools during an incident. Users also give up on their own. Set it from the dependency\'s p99.9 plus padding.' },
              { q: 'The server is still working after the client left. Should it stop?', a: 'Yes, before any side effect: pass the deadline down and check it before each step. After an external side effect it should finish and record it, so a later retry or lookup sees the truth.' },
            ],
            strong: [
              'A timeout means the caller stopped waiting; the server may have done nothing, finished, or still be working.',
              'The server keeps working unless the deadline is passed down and checked.',
              'Retries are made safe with an idempotency key whose result is stored atomically with the effect.',
              'Timeout budgets shrink inward, and values come from a high percentile of the dependency, not its average.',
              'There is a way to find the truth for one request: request ids at every hop, and a lookup by key.',
            ],
            flags: ['Treats a timeout as a failure', 'Retries a non-idempotent call without a key', '"Increase the timeout" as the fix', 'No way to find out what happened to one request'],
          },
        ],
      },

      /* ───────────── 2. idempotency ───────────── */
      {
        lesson: 'rq-idem', title: 'Retries need idempotency: the payment that arrives twice', mins: 12,
        remember: 'Retrying is safe only if doing it twice has the same effect as doing it once. Everything else needs the server to recognise the repeat: a key, recorded in the same transaction as the effect.',
        cue: 'a POST that charges, sends or creates, or a consumer with a side effect → where is the key or event id stored, and is it in the same transaction as the effect?',
        body: R`
          An operation is **idempotent** when applying it twice leaves the system in the same state as applying it once. HTTP defines GET, PUT and DELETE as idempotent and POST as not. In code the difference is usually visible:

          | Idempotent | Not idempotent |
          |---|---|
          | «UPDATE orders SET status = 'PAID' WHERE id = 7» | «UPDATE accounts SET balance = balance - 500 WHERE id = 7» |
          | «INSERT … ON CONFLICT (id) DO NOTHING» | «INSERT INTO charges (amount) VALUES (500)» |
          | "set the shipping address to X" | "send the receipt email" |

          Most interesting operations are on the right. They are made safe by recognising repeats.

          ## Idempotency keys: the request side

          1. **The client** creates a key for the *logical operation* (one checkout, one payment) before the first attempt, usually a random UUID. Every retry of that operation sends the same key; a different operation never reuses it.
          2. **The server** looks the key up.
             - **Not seen:** record the key as *in progress*, with a fingerprint of the request, then do the work.
             - **Completed:** return the stored response. Stripe stores the status code and body of the first attempt, even a 500, and replays it.
             - **In progress:** answer 409 Conflict; the client tries again later with the same key.
             - **Same key, different payload:** reject it; it is a client bug. The IETF draft for an «Idempotency-Key» header uses 422 here.
          3. **The response** is stored with the key, and the key is kept long enough to cover any retry: Stripe lets keys go after at least 24 hours.

          The step that makes it work: the key and the effect commit **in the same database transaction**. If they are separate, a crash between them either loses the key (and the retry charges again) or keeps a key with no charge.

          ~~~sql One transaction: the key and the effect commit together, or neither does
          BEGIN;
          INSERT INTO idempotency_keys (key, request_hash, status)
          VALUES ('3f6c…', 'a91e…', 'in_progress');   -- a unique key: a concurrent duplicate fails here
          INSERT INTO charges (order_id, amount_cents) VALUES (7, 500);
          UPDATE idempotency_keys SET status = 'done', response = '{"charge": 981}' WHERE key = '3f6c…';
          COMMIT;
          ~~~

          Two copies of the same request arriving at the same moment both pass a "does this key exist?" check. Only the **unique constraint** settles it: one insert wins, the other gets an error and answers 409.

          @sim timeout mode=key

          With keys there are no double charges. Some users still see an error while being charged: their retry arrived while the first attempt was still running and got 409. The fix is on the client: treat 409 as "still working", wait and retry with the same key until it gets the stored result.

          :::warn When the effect is not in your database
          If the side effect is a call to a payment provider, it cannot share your transaction. Pass your key to the provider (payment APIs accept one), record the payment as a state machine (created, sent, confirmed or failed), and run a job that asks the provider about anything stuck in "sent". Unknown outcomes are resolved by asking, never by guessing.
          :::

          ## The consumer side: "a payment event arrives twice"

          Message brokers deliver **at least once**. Duplicates are normal, not an incident:

          - The consumer processed a message and crashed before committing its offset; the new owner reads it again.
          - The consumer was kicked out of its group mid-batch (the Messaging module's rebalance lesson shows this).
          - The producer timed out and retried a send that had actually succeeded.

          So the consumer must be **idempotent**. The usual shape is a processed-events table with the event id as its primary key, written in the same transaction as the effect:

          ~~~sql
          BEGIN;
          INSERT INTO processed_events (event_id) VALUES ('evt_81f2') ON CONFLICT DO NOTHING;
          -- the application checks the row count: 0 means a duplicate, so it commits and stops here
          UPDATE accounts SET balance_cents = balance_cents - 500 WHERE id = 42;
          COMMIT;
          ~~~

          "Exactly once" in practice means **at-least-once delivery plus idempotent processing**. Kafka's exactly-once feature (idempotent producers and transactions) covers reading from Kafka and writing back to Kafka. It does not cover your database or the email you sent.

          @lab pg:races Practise it on a real Postgres: race conditions, lost updates and an idempotent payment insert

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A consumer checks «SELECT 1 FROM payments WHERE event_id = ?» and inserts when nothing is found. Two copies of the event arrive together on two consumers. What happens?', options: ['One is skipped by the check', 'Both pass the check and both insert, unless a unique constraint stops the second', 'The broker prevents it', 'Postgres serialises the two selects'], answer: 1, why: 'Check-then-act races: both reads see nothing. Only a unique constraint (or a lock) makes the second insert fail.' },
          { q: 'Which pairing is "exactly once" in practice?', options: ['Exactly-once delivery from the broker', 'At-most-once delivery and a retry loop', 'At-least-once delivery and idempotent processing', 'Auto-commit every 5 s'], answer: 2, why: 'Delivery can repeat; processing absorbs the repeats. Broker features cannot reach into your database.' },
        ],
        defend: [
          {
            q: 'A payment event is delivered to your consumer twice. Walk me through what happens, and how you make it safe.',
            weak: 'We enabled Kafka\'s exactly-once semantics, and the consumer checks whether the payment exists before inserting it.',
            whyWeak: 'Kafka\'s exactly-once covers Kafka-to-Kafka processing, not a database write or a provider call. And check-then-insert races when two copies arrive together.',
            follow: [
              { q: 'Why does the event arrive twice in the first place?', a: 'At-least-once delivery: the consumer processed it but crashed or was kicked out before committing the offset, or the producer retried a send that had succeeded. It is normal behaviour, not a bug.' },
              { q: 'Two copies arrive at the same moment on two consumers. Does your check still work?', a: 'No: both reads find nothing. Make the database decide with a unique constraint on the event id, and treat a conflict as "already done".' },
              { q: 'Where do you record the processed event id, and why there?', a: 'In the same transaction as the effect. Separately, a crash between the two either repeats the effect or records an effect that never happened.' },
              { q: 'The effect is a call to a payment provider, not your database. Now what?', a: 'Send the provider an idempotency key derived from the event, record the call as a state machine, and reconcile anything left in an unknown state by asking the provider.' },
              { q: 'How long do you keep processed ids?', a: 'At least as long as a duplicate can arrive: the topic\'s retention or your longest replay window. Partition the table by time so old ids drop off cheaply.' },
            ],
            strong: [
              'Duplicates are expected with at-least-once delivery; the consumer has to absorb them.',
              'Dedupe by event id with a unique constraint, never a read-then-write check.',
              'The dedupe record commits in the same transaction as the effect.',
              'External side effects get a provider idempotency key and a reconciliation path.',
              '"Exactly once" means at-least-once delivery plus idempotent processing.',
            ],
            flags: ['Claims the broker delivers exactly once end to end', 'Check-then-insert without a constraint', 'Dedupe store outside the effect\'s transaction', 'No answer for side effects outside the database'],
          },
        ],
      },

      /* ───────────── 3. latency ───────────── */
      {
        lesson: 'rq-latency', title: 'The average is 120 ms, but users are complaining', mins: 10,
        remember: 'An average describes no real user. Look at percentiles per endpoint, merged from histograms, and remember that a page is as slow as its slowest call.',
        cue: 'a latency average on a dashboard → ask for p99 per endpoint, where the clock starts, and how many calls a page waits on',
        body: R`
          Latency is rarely a bell curve. Most requests take the fast path; a few hit a slow one: a cache miss, a garbage-collection pause, a lock wait, a retry, a cold connection. The average lands between the two groups and describes neither.

          @sim latency

          With the defaults, the average is about 120 ms and the median about 80 ms, yet 1 page load in 100 takes over 1.5 s. Now raise **Backend calls per page**.

          ## Fan-out: rare becomes common

          A page that calls several services in parallel is as slow as its slowest call. If one call in 100 is slow, a page that makes N calls is slow with probability 1 − 0.99^N:

          | Calls per page | Pages with at least one slow call |
          |---|---|
          | 1 | 1% |
          | 10 | 10% |
          | 30 | 26% |
          | 100 | 63% |

          The last row is the example in Dean and Barroso's [The Tail at Scale](https://research.google/pubs/the-tail-at-scale/) (2013). A session is the same effect over time: 20 page loads at a 2% slow rate means a third of visits include one.

          ## What the average hides: the checklist

          1. **The tail.** Report p50, p95, p99 and p99.9, not the mean.
          2. **Segments.** One endpoint, one tenant, one region or one mobile network can be terrible while the global number looks fine. Break percentiles down by route first.
          3. **How percentiles were combined.** You cannot average p99s across 40 hosts; the result is not a percentile of anything (the simulator's note shows the gap). Merge histograms, then take the quantile.
          4. **Where the clock starts.** A server-side timer starts when the handler runs. Time spent in the load balancer, the accept queue or a thread-pool queue is invisible to it, and that is exactly where an overloaded service hides its latency.
          5. **What was left out.** Timeouts and errors are often excluded from latency, so the worst requests vanish from the chart.
          6. **The load test.** A load generator that waits for each response before sending the next stops sending during a stall, so the stall's victims are never measured. Gil Tene calls this *coordinated omission*; tools such as wrk2 avoid it by timing from when each request should have been sent.

          ~~~text Prometheus: the p99 per route, from histogram buckets merged across every instance
          histogram_quantile(0.99, sum by (le, uri) (rate(http_server_requests_seconds_bucket[5m])))
          ~~~

          ## From symptom to cause

          - Pull **traces of the slow requests** (exemplars link a histogram bucket to a trace) and see which span is long.
          - Split **queue time from service time**: connection-pool wait, thread-pool queue, lock wait.
          - Line the spikes up against **GC logs, deploys, cache evictions and one dependency's latency**.

          Fixes follow the cause: remove the slow path (warm caches and connections, tune GC), bound it (timeouts), or route around it. For idempotent reads, **hedged requests** send a second copy after the expected p95 latency and take whichever answers first; The Tail at Scale reports a large cut in tail latency for a few percent more requests.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Host A reports p99 = 200 ms, host B p99 = 1,800 ms, with equal traffic. What is the p99 of the combined traffic?', options: ['1,000 ms', 'Somewhere it cannot be computed from these two numbers alone', '200 ms', '1,800 ms'], answer: 1, why: 'Percentiles do not average. You need the underlying distributions: merge the histograms, then take the 99th percentile.' },
          { q: 'Each backend call is slow 1% of the time. A page fans out to 50 calls in parallel. Roughly what share of pages are slow?', options: ['1%', '5%', 'About 40%', '50%'], answer: 2, why: '1 − 0.99^50 is about 0.39. A page is as slow as its slowest call.' },
        ],
        defend: [
          {
            q: 'Average latency is 120 ms, but users are complaining. What is hidden?',
            weak: '120 ms is good, so it is probably the users\' network. We could add caching to bring the average down further.',
            whyWeak: 'It trusts a number that describes no real user, blames the client without evidence, and proposes a fix before finding the slow path.',
            follow: [
              { q: 'Which numbers would you look at instead?', a: 'p50, p95, p99 and p99.9 per endpoint, and per tenant or region if traffic is mixed, computed from histograms merged across hosts. Plus the share of requests over the threshold users notice.' },
              { q: 'How do you combine percentiles from 40 hosts?', a: 'You do not average them. Sum the histogram buckets across hosts, then compute the quantile.' },
              { q: 'One endpoint\'s p99 is 1.8 s. How do you find the cause?', a: 'Pull traces for requests in the slow bucket, see which span grows, separate queue time (pool and thread waits) from service time, and correlate with GC, deploys, cache evictions and dependency latency.' },
              { q: 'The page calls 30 services. Why does that matter?', a: 'The page waits for the slowest. With a 1% slow rate per call, about a quarter of pages hit at least one: fan-out turns a tail into the typical experience.' },
              { q: 'Your load test shows p99 = 200 ms. Why might it be wrong?', a: 'Coordinated omission: a closed-loop generator stops sending while the server stalls, so the stall\'s victims are never measured. Use constant-rate load and time from the intended send time.' },
            ],
            strong: [
              'Averages hide bimodal latency; use percentiles, per endpoint and segment.',
              'Percentiles combine through histograms, never by averaging.',
              'Fan-out and sessions turn a rare slow call into a common slow experience.',
              'Know where the clock starts: queueing before the handler is invisible to server timers.',
              'Find the slow path with traces before choosing a fix.',
            ],
            flags: ['Accepts the average', 'Averages percentiles across hosts', 'Only measures inside the handler', 'Proposes caching before finding the cause'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
