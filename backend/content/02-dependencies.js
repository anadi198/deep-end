(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'deps', title: 'When a dependency is slow or failing', short: 'Dependencies',
    blurb: 'Why slow is worse than down, how retries turn a blip into an outage, and what circuit breakers, bulkheads and load shedding actually buy you.',
    items: [
      /* ───────────── 1. slow is worse than down ───────────── */
      {
        lesson: 'dp-slow', title: 'Slow is worse than down', mins: 9,
        remember: 'A dead dependency fails fast; a slow one holds your threads and connections until you run out. Bound every call with a timeout, and give each dependency its own limited pool.',
        cue: 'one slow downstream and every endpoint is timing out → think Little\'s law: in-flight = rate × latency, and look for a shared pool',
        body: R`
          ## Little's law

          For any stable system, the average number of requests in flight equals the arrival rate times the average time each spends inside:

          > in-flight = rate × latency

          A service handles 500 requests a second, and each makes one call to a pricing service that normally answers in 40 ms. In flight: 500 × 0.04 = **20** calls, comfortably inside a pool of 200 threads.

          The pricing service slows to 2 s without failing. In flight: 500 × 2 = **1,000** calls. The pool holds 200, so:

          1. All 200 threads sit waiting on pricing.
          2. New requests queue for a thread, *including requests that never call pricing*: health checks, logins, the order history page.
          3. The load balancer's health check times out, and the instance is marked unhealthy.
          4. Traffic shifts to the remaining instances, which fill up the same way.

          One slow dependency has taken down the whole service. If pricing had been *down*, connections would have been refused in milliseconds and the threads would have been free again. That is why slow is worse than down.

          ~~~mermaid One slow dependency holds every thread; requests that never call it wait anyway
          flowchart LR
            a[Requests that call pricing] --> pool
            b[Login requests] -.->|wait for a free thread| pool
            c[Health checks] -.->|wait for a free thread| pool
            subgraph svc[Checkout service]
              pool[(One shared pool: 200 threads, all busy)]
            end
            pool -->|each thread waits 2 s| pricing[Pricing service, slow]
          ~~~

          ## The defences

          - **A timeout on every call**: connect timeout and request timeout, set from the dependency's p99.9 plus padding. A call with no timeout can hold a thread forever.
          - **Bulkheads**: a separate, bounded pool (threads, or connections, or a semaphore) per dependency. When pricing is slow, only the pricing pool fills; login keeps its own threads.
          - **Fail fast when the bulkhead is full**: reject immediately with a clear error instead of queueing. A queue in front of a slow dependency is only a longer wait.
          - **Concurrency limits** on what you accept, so overload becomes fast rejections rather than everything slowing down.

          :::pitfall "Going reactive fixes this"
          Non-blocking clients do not tie up a thread per call, but in-flight calls still pile up: memory, open connections, pending callbacks. Little's law still holds. You still need timeouts and a cap on concurrent calls per dependency.
          :::

          Sizing a bulkhead uses the same law: the normal in-flight count at peak (rate × p99 latency) with headroom, not "as big as possible". A bulkhead sized for the worst case protects nothing.

          @quiz 0
        `,
        quiz: [
          { q: '300 requests a second each call a dependency whose latency rises from 50 ms to 3 s. How many calls are in flight at the slow latency?', options: ['15', '150', '300', '900'], answer: 3, why: 'Little\'s law: 300/s × 3 s = 900 in flight. At 50 ms it was 15.' },
        ],
        defend: [
          {
            q: 'One downstream service became slow, and your whole service went down, including endpoints that never call it. Why?',
            weak: 'The downstream was overloaded and it cascaded to us. We should ask that team to scale up.',
            whyWeak: '"It cascaded" names the effect, not the mechanism. The failure was in our service: a shared pool and calls with no bound.',
            follow: [
              { q: 'Show me the mechanism with numbers.', a: 'Little\'s law: in-flight = rate × latency. At 500/s and 2 s that is 1,000 calls against a 200-thread pool, so the pool fills and every request queues behind the slow calls, whatever endpoint it is for.' },
              { q: 'What is a bulkhead, and how would you size it?', a: 'A separate, bounded pool per dependency, so one dependency can only exhaust its own. Size it from peak rate × p99 latency with some headroom, and reject when it is full.' },
              { q: 'Would switching to a non-blocking client fix it?', a: 'It removes the thread per call, but the calls still pile up in memory and connections. You still need timeouts and a concurrency cap per dependency.' },
              { q: 'How do you choose the timeout?', a: 'From the dependency\'s latency distribution: the percentile that matches the false-timeout rate you accept (p99.9 for 0.1%), plus padding, and within the caller\'s remaining deadline.' },
            ],
            strong: [
              'Little\'s law: a slower dependency means proportionally more calls in flight.',
              'A shared pool lets one slow dependency starve unrelated endpoints and health checks.',
              'Timeouts on every call, set from a high percentile.',
              'Bulkheads per dependency, sized from peak in-flight, rejecting when full.',
            ],
            flags: ['Blames the downstream team only', 'No timeouts, or "infinite is safer"', 'Bigger pools as the fix', 'Thinks async removes the need for limits'],
          },
        ],
      },

      /* ───────────── 2. retries ───────────── */
      {
        lesson: 'dp-retry', title: 'Retries, backoff and the retry storm', mins: 11,
        remember: 'Every retry is extra load, sent exactly when the dependency is weakest. Retry only transient failures of safe calls, at one layer, with backoff, jitter and a budget.',
        cue: 'a short blip followed by a long outage → look at retry amplification and at queues full of requests nobody is waiting for',
        body: R`
          A retry is the right response to a brief, random failure: a dropped packet, a restarting instance. It is the wrong response to overload, because it adds load to the thing that is already overloaded.

          ## How a five-second blip becomes an outage

          1. The dependency slows down for a few seconds.
          2. Callers time out and retry, so it receives up to 4× the requests (one try plus three retries).
          3. It queues them all. Many are for callers that already gave up, but it cannot tell, so it works on them anyway.
          4. The original cause clears. The queue is now longer than the timeout: everything served is already abandoned, every caller times out, and every timeout retries.
          5. The system stays down with no remaining cause. This is a **metastable failure** ([Bronson et al., HotOS 2021](https://doi.org/10.1145/3458336.3465286)): stable in the bad state, until something removes the extra load.

          @sim retry strategy=naive

          The slowdown lasts five seconds; with immediate retries the service never recovers. Press **Compare every option** and read the "Back to normal" column.

          ## Layers multiply

          Retries at every layer multiply. Five layers that each try three times turn one failing database call into 3^5 = **243** calls. The usual rule: retry at one layer only, normally the one closest to the failure, and let the others fail fast.

          ## The rules for a safe retry

          - **Only safe calls.** Idempotent operations, or ones carrying an idempotency key.
          - **Only transient failures.** Timeouts, connection resets, 503, 429. Never 400, 404, 409 or 422: the same request will fail the same way.
          - **Exponential backoff with full jitter.** Wait a random time between 0 and min(cap, base × 2^attempt). Without jitter, every client that failed together retries together. See [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/).
          - **A retry budget.** Allow retries up to a fraction of normal traffic (say 10%) using a token bucket: each request adds a little credit, each retry spends one. gRPC's «retryThrottling» works this way: retries stop when the bucket drops below half. Backoff alone spreads a storm out; a budget caps it.
          - **Respect «Retry-After»** on 429 and 503.
          - **Stay inside the deadline.** The total time across attempts is bounded by the caller's deadline.

          ## On the receiving side

          - **Drop work whose caller has left.** If the deadline travels with the request, the server skips anything already expired instead of serving the dead.
          - **Bound the queue.** A request queued longer than the caller's timeout is wasted work; a short queue and a fast rejection are better.

          In the simulator, the budget caps the load but recovery still waits for the queue to drain. Dropping expired work is what makes recovery immediate.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Which response should a client retry?', options: ['400 Bad Request', '409 Conflict on a duplicate order', '503 Service Unavailable with Retry-After: 2', '422 Unprocessable Content'], answer: 2, why: '503 is transient by definition, and Retry-After says when. The others fail the same way on every attempt.' },
          { q: 'What does exponential backoff alone not do?', options: ['Spread retries over time', 'Reduce how often each client retries', 'Cap the total extra load during a long outage', 'Avoid retrying instantly'], answer: 2, why: 'Every client still makes all its attempts, just later. A retry budget is what bounds the extra load.' },
        ],
        defend: [
          {
            q: 'A dependency had a five-second blip, but your system stayed down for twenty minutes. What happened?',
            weak: 'The dependency must have been down longer than we thought. We increased the retry count so requests get through.',
            whyWeak: 'More retries is more load at the worst moment. It misses the feedback loop that keeps a system down after the cause is gone.',
            follow: [
              { q: 'Walk me through the feedback loop.', a: 'Timeouts trigger retries, so the dependency gets several times its normal load. It queues all of it, including requests whose callers have gone. Once the queue holds more than a timeout\'s worth of work, everything served is already abandoned, every caller times out and retries again. It is stable in the failed state: a metastable failure.' },
              { q: 'How would you stop it right now, mid-incident?', a: 'Remove the extra load: turn retries off with a flag, shed traffic at the edge, and clear the dead queue (often by restarting or scaling out the dependency). Then let traffic back gradually.' },
              { q: 'What would you change so it cannot happen again?', a: 'Retry at one layer only, with backoff, jitter and a retry budget; pass deadlines so the dependency drops expired work; bound its queues; and consider a circuit breaker on the caller.' },
              { q: 'How would you see it coming?', a: 'Track attempts per logical request and the retry rate, queue time versus service time on the dependency, and the share of work completed after the caller\'s deadline.' },
            ],
            strong: [
              'Retries amplify load at the moment of weakness, and they multiply across layers.',
              'Queues fill with work for callers who have gone, which keeps the system down: a metastable failure.',
              'Backoff and jitter spread retries out; a budget caps them; deadlines let servers drop dead work.',
              'Retry only transient failures of idempotent calls, at one layer.',
              'Mid-incident, recover by removing load, not adding capacity alone.',
            ],
            flags: ['More retries as the fix', 'Retries at every layer', 'Retrying 4xx errors', 'No idea how to drain the dead work'],
          },
        ],
      },

      /* ───────────── 3. breakers and shedding ───────────── */
      {
        lesson: 'dp-breaker', title: 'Circuit breakers, fallbacks and load shedding', mins: 10,
        remember: 'A circuit breaker turns a slow failure into a fast one and gives the dependency room to recover. It is only as good as what you return while it is open.',
        cue: '"we added a circuit breaker" → ask what the caller gets while it is open, and who is told when it opens',
        body: R`
          ## The three states

          1. **Closed**: calls go through. The breaker records outcomes over a sliding window.
          2. When the failure rate (or the rate of slow calls) reaches a threshold, it moves to **open**: calls fail immediately without touching the dependency.
          3. After a wait, it moves to **half-open** and lets a few trial calls through. If they succeed it closes; if not, it opens again.

          Resilience4j's defaults show the usual scale: a window of the last 100 calls, opening at a 50% failure rate once at least 100 calls have been seen, staying open 60 s, then 10 trial calls ([CircuitBreaker docs](https://resilience4j.readme.io/docs/circuitbreaker)). Netflix's Hystrix, which made the pattern popular, has been in maintenance mode since 2018.

          @sim retry strategy=breaker

          Compare **… plus the dependency drops expired work** with **… plus a circuit breaker**. The breaker fails some requests that might have succeeded, but callers spend far less time waiting on timeouts, and the dependency gets quiet time to recover.

          ## What to return while it is open

          The breaker decides *when* to stop calling. You decide *what to answer instead*, per call:

          | Call | A sensible answer while open |
          |---|---|
          | Product recommendations | hide the widget |
          | Exchange rates | the last cached value, marked stale |
          | Sending a welcome email | queue it for later |
          | Authorising a payment | fail clearly with 503 and Retry-After; never a default |

          ## The costs

          - **Per instance.** Each instance's breaker learns on its own, so 50 instances each send their own probe traffic and open at slightly different times.
          - **Flapping.** Thresholds that are too sensitive open on noise; minimum-call counts and windows exist to stop that.
          - **Hidden failure.** Callers get a fast error and the dependency's dashboards go quiet. Alert on breaker state changes.
          - **Modal behaviour.** The open state is a code path that rarely runs and is hard to test. The AWS Builders' Library notes it can lengthen recovery, and prefers limiting retries with a token bucket where that is enough.

          ## Load shedding: protecting yourself

          A breaker protects a dependency from you. **Load shedding** protects you from your callers: when you are at capacity, reject the excess quickly (429 or 503 with Retry-After) instead of accepting it and getting slow for everyone.

          - Reject early, before the request has cost anything.
          - Prefer rejecting to queueing: a request that waits past its caller's timeout is wasted work.
          - Shed by priority: health checks and paying customers last, batch jobs and prefetches first.

          @quiz 0
        `,
        quiz: [
          { q: 'A breaker is half-open. What happens next?', options: ['All traffic flows, and it closes if the error rate is below threshold', 'A few trial calls go through; success closes it, failure re-opens it', 'It waits for an operator', 'It routes traffic to a fallback service'], answer: 1, why: 'Half-open admits a limited number of trial calls and decides from their outcome.' },
        ],
        defend: [
          {
            q: 'What does a circuit breaker actually do, and when would you not use one?',
            weak: 'It stops cascading failures by cutting off a failing service. You should put one on every remote call.',
            whyWeak: 'It describes the slogan, not the state machine, says nothing about what callers receive while it is open, and "every call" ignores the costs.',
            follow: [
              { q: 'Walk me through its states and what moves it between them.', a: 'Closed records outcomes in a sliding window; at a failure-rate or slow-call threshold (after a minimum number of calls) it opens and fails fast; after a wait it goes half-open, admits a few trial calls, and closes or re-opens on their result.' },
              { q: 'What does the caller get while it is open?', a: 'Whatever that call can tolerate: a cached or stale value, a hidden feature, a queued write, or a clear 503 with Retry-After. For something like a payment authorisation, a clear failure; never an invented default.' },
              { q: 'When would you not add one?', a: 'When retries are already limited by a budget and a breaker would only add a rarely tested mode; on calls with no useful fallback and no load problem; or when per-instance breakers would just flap under noisy traffic.' },
              { q: 'How is it different from load shedding?', a: 'A breaker protects a dependency from you by not calling it. Load shedding protects you from your callers by rejecting excess work quickly when you are at capacity.' },
            ],
            strong: [
              'Closed, open and half-open, driven by failure rate over a window with a minimum call count.',
              'It turns slow failures into fast ones and gives the dependency room to recover.',
              'The fallback is chosen per call; some calls must fail clearly.',
              'Costs: per-instance learning, flapping, hidden failures, a hard-to-test mode.',
              'Load shedding is the server-side counterpart: reject early, by priority.',
            ],
            flags: ['A breaker on everything, with no fallback plan', 'A fallback that invents data for a critical call', 'No alerting on breaker state', 'Confuses it with retries'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
