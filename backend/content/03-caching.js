(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'caching', title: 'Caching, and what happens when the cache fails', short: 'Caching',
    blurb: 'Cache-aside end to end with Redis, the stampede when a hot key expires, and the outage when the cache itself goes away.',
    items: [
      /* ───────────── 1. cache-aside with Redis ───────────── */
      {
        lesson: 'ca-aside', title: 'Redis as a production cache', mins: 12,
        remember: 'In cache-aside, the application reads the cache, falls back to the database, and fills the cache; on writes it updates the database, then deletes the key. The TTL is your bound on how stale it can get.',
        cue: '"we cache it in Redis" → ask about the write path, the TTL, maxmemory and its policy, and what happens on a miss storm',
        body: R`
          ## Cache-aside, step by step

          **Read path**

          1. The application asks Redis for «product:42».
          2. **Hit**: return it.
          3. **Miss**: read the row from the database, write it to Redis with a TTL, return it.

          **Write path**

          1. Update the row in the database.
          2. Delete «product:42» from Redis. The next read refills it.

          ~~~java Cache-aside, the read path
          Product find(long id) {
              String key = "product:" + id;
              Product hit = cache.get(key);
              if (hit != null) return hit;
              Product fresh = repository.findById(id);              // the miss goes to the database
              cache.set(key, fresh, Duration.ofMinutes(10));        // the TTL bounds staleness
              return fresh;
          }
          ~~~

          ### Why delete, not update, on writes

          Two writers updating the same row can set the cache in the opposite order from the one in which they committed, leaving the older value cached indefinitely. A delete has no order to get wrong: the next reader fetches whatever is current.

          ### The race that remains

          1. A reader misses and reads the row: version 1.
          2. A writer commits version 2 and deletes the key.
          3. The reader, slow to finish, writes version 1 into the cache.

          The cache now holds stale data until the TTL expires. That is why every key needs a TTL even if you invalidate on writes. Stronger fixes, in order of effort: delete again a moment after the write; store a version with each value and only accept a set if it is newer; or drive invalidation from the database's change log (CDC), which sees writes in commit order. Facebook's memcache paper (NSDI 2013) solved the same race with *leases*.

          ## Memory: maxmemory and the eviction policy

          Out of the box, Redis has **no memory limit** on 64-bit systems («maxmemory 0») and its eviction policy is **«noeviction»**. When a limit is reached under «noeviction», reads still work but every write fails with «OOM command not allowed when used memory > 'maxmemory'». For a cache that is the wrong default: set a «maxmemory» and an eviction policy.

          | Policy | Evicts | Use when |
          |---|---|---|
          | «allkeys-lru» | the least recently used key | the usual choice for a cache |
          | «allkeys-lfu» | the least frequently used key | a stable set of popular keys |
          | «allkeys-lrm» | the least recently modified key | read-heavy keys you want to keep; added in Redis 8.6 |
          | «volatile-*» | only keys with a TTL | mixing cache keys and keys that must stay; behaves like «noeviction» if no key has a TTL |
          | «noeviction» | nothing; writes fail | Redis used as a store, not a cache |

          LRU and LFU are approximations: Redis samples a few keys («maxmemory-samples», default 5) and evicts the best candidate, rather than tracking a full order ([eviction docs](https://redis.io/docs/latest/develop/reference/eviction/)). Expired keys are removed lazily when touched and by a periodic sampler, so expired data can sit in memory for a while.

          ## Single-threaded: big keys and hot keys

          Redis executes commands one at a time (I/O threads, reworked in Redis 8, only handle network reads and writes). So:

          - **A big value or an O(N) command blocks everyone.** Reading a 50 MB value or running «KEYS *» stalls every other client on that instance. Use «SCAN», keep values small, split large collections.
          - **A hot key lives on one shard.** Redis Cluster places each key in one of 16,384 hash slots, so one very popular key loads one node however many you add. Fixes: an in-process cache in front for that key, or several copies under different keys read at random.

          ## Negative caching

          A lookup for something that does not exist misses every time and goes to the database every time. Cache the "not found" too, with a short TTL. Without it, a client (or an attacker) asking for random ids walks straight past the cache.

          :::warn Redis is not a source of truth by default
          Replication is asynchronous. After a failover, writes that were acknowledged can be lost, and the Redis docs say so for both Sentinel and Cluster. For a cache that is fine. For a lock, a balance or a rate limit it decides the design: see Kleppmann's [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) on why a lock needs fencing tokens.
          :::

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A Redis instance has «maxmemory» set and the default eviction policy. It fills up. What happens?', options: ['Old keys are evicted, least recently used first', 'Writes fail with an OOM error; reads still work', 'Redis restarts', 'Keys with a TTL are evicted first'], answer: 1, why: 'The default policy is «noeviction». A cache needs «allkeys-lru» or similar set explicitly.' },
          { q: 'Why does cache-aside delete the key on write instead of setting the new value?', options: ['Deleting is faster', 'Two concurrent writers can set values in the wrong order and leave the older one cached; a delete has no order to get wrong', 'Redis cannot overwrite keys', 'To save memory'], answer: 1, why: 'Concurrent sets race on order. Deleting lets the next reader fetch the current row.' },
        ],
        defend: [
          {
            q: 'Walk me through how you use Redis as a cache, end to end.',
            weak: 'We put frequently read data in Redis with a TTL, so the database gets fewer reads.',
            whyWeak: 'It describes the read path only. Nothing on writes, staleness, memory limits, eviction or failure, which is where the follow-ups go.',
            follow: [
              { q: 'What happens on a write?', a: 'Update the database, then delete the key; the next read refills it. Deleting rather than setting avoids concurrent writers caching values in the wrong order.' },
              { q: 'Can a reader still put stale data in the cache?', a: 'Yes: a slow reader that read the old row can write it after the writer\'s delete. The TTL bounds it; versioned sets, a delayed second delete, or CDC-driven invalidation close it further.' },
              { q: 'What happens when Redis runs out of memory?', a: 'With the default «noeviction» policy, writes fail with an OOM error while reads still work. Set «maxmemory» and «allkeys-lru» (or LFU) for a cache, and watch evictions and the hit rate.' },
              { q: 'One key gets 50,000 reads a second. What breaks?', a: 'It lives in one hash slot on one shard, and Redis runs commands on one thread, so that node saturates. Put an in-process cache in front of it, or keep several copies under different keys.' },
              { q: 'Why not keep sessions or locks in the same Redis?', a: 'Async replication can lose acknowledged writes on failover. A cache tolerates that; a lock needs fencing tokens, and sessions need a decision about what loss means.' },
            ],
            strong: [
              'Read path: get, miss, load from the database, set with a TTL.',
              'Write path: update the database, then delete the key; the TTL bounds the remaining race.',
              'Memory: set maxmemory and an eviction policy; the default is noeviction.',
              'Single-threaded execution: avoid big keys and O(N) commands; hot keys load one shard.',
              'Negative caching, and a clear view that Redis is not the source of truth.',
            ],
            flags: ['Only describes reads', 'Updates the cache on writes without thinking about ordering', 'No TTL "because we invalidate"', 'Does not know what happens when memory fills'],
          },
        ],
      },

      /* ───────────── 2. stampede ───────────── */
      {
        lesson: 'ca-stampede', title: 'A hot key expires and the database is stampeded', mins: 11,
        remember: 'When a popular key expires, every request that misses before the first rebuild finishes goes to the database. Make one request rebuild while the rest wait or, better, keep serving the old value.',
        cue: 'database spikes every N minutes, or right after a deploy → look for a hot key\'s TTL or many keys cached with the same TTL',
        body: R`
          ## The mechanism

          1. A key read 2,000 times a second expires.
          2. The first request misses and starts rebuilding it: a 300 ms query.
          3. For those 300 ms, every other request also misses and starts its own rebuild: about 600 identical queries.
          4. The database slows under the extra load, so each query takes longer, so the window widens and lets in more.

          @sim stampede scenario=hot

          Press **Compare every option**: from 600 queries and multi-second waits down to one query and no waits.

          ## The fixes

          **Single-flight in each instance.** Concurrent misses for the same key inside one process share one rebuild; the others wait for its result. Go's «singleflight», Caffeine's loading cache and Spring's «@Cacheable(sync = true)» do this (Spring's scope depends on the cache provider). It bounds queries to one per instance, so 10 instances still send 10, and everyone still waits.

          **A distributed lock.** The first request takes a short lock in Redis («SET lock:product:42 <token> NX PX 5000»), rebuilds, and releases it; the others wait and re-read. One query, but everyone still waits, and the lock needs an expiry in case its holder dies.

          **Stale-while-revalidate.** Store the value with two times: a *soft* expiry when it should be refreshed and a *hard* expiry when it is unusable. Between them, serve the old value immediately and let one request refresh it in the background. Nobody waits; for a short window some users see slightly old data. HTTP caches have the same idea as the «stale-while-revalidate» directive (RFC 5861), and Caffeine's «refreshAfterWrite» serves the old value while it reloads.

          **Probabilistic early refresh.** Each request, before expiry, rebuilds early with a probability that rises as expiry approaches: refresh if *now* − δ·β·ln(rand) ≥ *expiry*, where δ is how long a rebuild takes and β is usually 1. One request ends up refreshing shortly before expiry, so nobody misses at all. This is the XFetch algorithm from Vattani, Chierichetti and Lowenstein, [Optimal Probabilistic Cache Stampede Prevention](https://www.vldb.org/pvldb/vol8/p886-vattani.pdf) (VLDB 2015).

          ## Many keys, one moment

          The same stampede happens without a hot key when many keys expire together: a warm-up job fills 20,000 keys at once with a 60 s TTL, or a deploy flushes the cache.

          @sim stampede scenario=mass

          The fix is **TTL jitter**: give each key a TTL with a small random spread (say ±10%) so expiries are spread out. After a cache flush or a cold start, also warm the hottest keys before taking traffic, or ramp traffic up slowly.

          @quiz 0
        `,
        quiz: [
          { q: 'Which fix lets no request wait and sends one query?', options: ['Single-flight per instance', 'A distributed lock with waiters', 'Stale-while-revalidate', 'A longer TTL'], answer: 2, why: 'Requests get the old value immediately while one background refresh runs. A lock also sends one query, but everyone waits for it.' },
        ],
        defend: [
          {
            q: 'A hot key expires and your database falls over. Walk me through it, and fix it.',
            weak: 'Too many requests hit the database at once. We would increase the TTL or add read replicas.',
            whyWeak: 'A longer TTL only makes the stampede rarer, and replicas add capacity for a burst that should not exist. It does not explain the feedback loop or stop it.',
            follow: [
              { q: 'Why does it get worse than "one query per request in the window"?', a: 'The extra queries slow the database, which lengthens the rebuild, which widens the window, which lets more requests miss: a feedback loop.' },
              { q: 'You run single-flight in each of 50 instances. Is that enough?', a: 'It caps queries at 50 per expiry, which may be fine. Everyone still waits for the rebuild, though. For one query and no waiting, use stale-while-revalidate or early refresh.' },
              { q: 'The instance holding the rebuild lock dies. What happens?', a: 'The lock\'s expiry («PX») frees it, and the next request rebuilds. Waiters need a timeout and a fallback, ideally serving the stale value.' },
              { q: 'When is serving stale data not acceptable?', a: 'When a read must reflect a recent write: a balance, stock about to hit zero, a permission change. Those reads go to the source, or invalidate on write and use a short hard expiry.' },
              { q: 'The database spikes right after every deploy. Same problem?', a: 'Yes: many keys cached at once with the same TTL, or a cold cache. Add TTL jitter and warm the hottest keys, or ramp traffic up gradually.' },
            ],
            strong: [
              'The window of misses lasts as long as the rebuild, and grows as the database slows.',
              'Single-flight caps queries per instance; a lock caps them globally; both make requests wait.',
              'Stale-while-revalidate or probabilistic early refresh: one rebuild, no waiting.',
              'Mass expiry is the same stampede: TTL jitter and cache warming.',
              'Know which reads cannot accept stale data.',
            ],
            flags: ['A longer TTL as the fix', 'More replicas for a self-made burst', 'A lock with no expiry', 'Ignores the feedback loop'],
          },
        ],
      },

      /* ───────────── 3. Redis down ───────────── */
      {
        lesson: 'ca-down', title: 'Redis goes down', mins: 10,
        remember: 'The database was sized for the cache\'s misses, not for all your traffic. When the cache goes, protect the database first: fail fast on the cache, shed what the database cannot take, and keep a small cache in process.',
        cue: 'a cache outage, or "fall back to the database" → compare the hit rate with the database\'s headroom, and check the cache client\'s timeout',
        body: R`
          ## The arithmetic

          10,000 requests a second with a 95% hit rate means the database serves 500 a second. It was sized for that, with headroom to maybe 2,000. When Redis goes away, the database is offered 10,000: five times its capacity.

          Past capacity, a database does not serve its capacity and reject the rest. Queries compete for CPU, locks and connections, each gets a thinner slice, and most time out: **useful throughput falls below capacity**. Falling back to the database "for safety" takes the database down too.

          @sim cachedown

          ## The second problem: the cache client's timeout

          While Redis is unreachable, every request first waits for the cache client to give up. Java's Lettuce client defaults to a **60 second** timeout ([Lettuce production usage](https://redis.io/docs/latest/develop/clients/lettuce/produsage/)). Even 1 s per request, by Little's law, multiplies the threads tied up waiting.

          - Set a cache timeout in **milliseconds**: a cache that answers slowly is no longer saving time.
          - Put a **circuit breaker** on the cache client so that, once Redis is down, requests skip it instantly.

          In the simulator, the breaker removes the waiting but not the overload: the database is still offered five times its capacity.

          ## What actually protects you

          1. **Shed load in front of the database.** A concurrency limit or a bounded pool for database calls, rejecting the excess quickly with a degraded answer. The database keeps serving at full speed instead of collapsing.
          2. **A small in-process cache** (an L1) in front of Redis for the hottest keys. It survives the outage and absorbs most of the traffic, because popularity is skewed.
          3. **Degrade by feature.** Turn off what is expensive and optional; keep login and checkout working.
          4. **Plan the return.** Redis comes back *empty*, the hit rate starts near zero, and the database is overloaded a second time. Warm the hottest keys first, or let traffic back gradually.

          ## High availability: fewer outages, not zero

          Replicas with Sentinel or Redis Cluster fail over automatically, usually in seconds. Replication is asynchronous, so a failover can lose recent writes: harmless for cached copies, important if Redis holds anything that exists nowhere else. A failover still causes a burst of errors while clients find the new primary, and a whole-cluster outage still happens.

          :::aside When Redis is the source of truth
          Sessions, rate limits, queues and locks kept only in Redis are not cache. Losing them is data loss or a correctness bug, so the answer changes: persistence (AOF), replicas, and an explicit decision about what happens to that data in a failover.
          :::

          @quiz 0
        `,
        quiz: [
          { q: 'Redis is down. Your service now fails fast on the cache thanks to a breaker. Is the database safe?', options: ['Yes: the breaker protects it', 'No: every request now goes to the database, which is offered several times its capacity', 'Yes, if the timeout is short', 'Only if the hit rate was below 50%'], answer: 1, why: 'The breaker stops requests waiting on Redis. It does nothing about the load that moves to the database; shedding and an L1 cache do.' },
        ],
        defend: [
          {
            q: 'Redis goes down at peak traffic. What happens to your system, and what would you have built beforehand?',
            weak: 'We fall back to the database, so it keeps working, just slower. Redis has replicas, so it would fail over anyway.',
            whyWeak: '"Just slower" ignores that the database was sized for misses; at five times its capacity it collapses. Replicas reduce outages, but they do not remove them.',
            follow: [
              { q: 'Do the arithmetic: what does the database see?', a: 'Everything that used to hit: at 10,000 req/s and 95% hits, it goes from 500 to 10,000 queries a second against capacity for maybe 2,000. Past capacity, its useful throughput drops, so nearly everything fails.' },
              { q: 'What is the cache client doing while Redis is down?', a: 'Waiting for its timeout on every request, which can be tens of seconds by default. That ties up threads for nothing. Use a millisecond timeout and a breaker on the cache client.' },
              { q: 'How do you keep serving some users?', a: 'Limit concurrency to the database and shed the rest quickly with a degraded answer, keep an in-process cache for the hottest keys, and switch off expensive optional features.' },
              { q: 'Redis comes back. Are you done?', a: 'No: it is empty, so the hit rate starts near zero and the database is overloaded again. Warm the hottest keys first, or let traffic back gradually.' },
              { q: 'What if sessions or rate limits live in that Redis too?', a: 'Then it is a data store, not a cache: losing it logs users out or disables limits. Separate the instances, persist it with AOF and replicas, and decide what a failover may lose.' },
            ],
            strong: [
              'The database is sized for misses; full fallback offers it many times its capacity, and it collapses.',
              'Cache timeouts in milliseconds and a breaker on the cache client.',
              'Shed load in front of the database; an in-process L1 cache for hot keys; degrade by feature.',
              'The recovery is a second stampede: warm the cache or ramp traffic up.',
              'HA reduces outages; async replication can lose writes, which matters if Redis holds anything that exists nowhere else.',
            ],
            flags: ['"Fall back to the database" with no capacity check', 'Default client timeouts', 'Assumes replicas make outages impossible', 'Forgets the empty cache on recovery'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
