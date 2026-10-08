/* One-page cheat sheets. Each: { id, title, kind, blurb, lede, body } */
(function (root) {
  const BL = root.BL, R = BL.R;
  BL.cheats.push(
    {
      id: 'symptoms', title: 'Symptom → mechanism → first move', kind: 'Diagnosis',
      blurb: 'The production symptoms this lab covers, what usually causes each, and the first thing to check.',
      lede: 'Read across: what you see, the mechanism that usually produces it, and where to look first.',
      body: R`
        | You see | Usually | Look first at |
        |---|---|---|
        | Users report errors, but the charge went through | the caller timed out while the server finished | request ids across hops; 499s and 504s at the edge |
        | Customers charged twice | a retry without an idempotency key | whether the key is stored in the effect's transaction |
        | Average latency fine, users complain | a slow tail, a bad segment, or fan-out | p99 per endpoint from merged histograms; traces of slow requests |
        | One slow dependency, every endpoint failing | a shared pool filled with calls to it | pool usage, timeouts on that client, Little's law |
        | A short blip, then a long outage | retry amplification plus dead work in queues | attempts per request, queue time vs service time |
        | Database spikes every N minutes | a hot key's TTL expiring | the miss rate on that key; single-flight or stale-while-revalidate |
        | Database spikes after every deploy | many keys cached with one TTL, or a cold cache | TTL jitter, cache warming |
        | Redis down, then the database down | the database was sized for misses only | load shedding in front of the database, cache client timeout |
        | Redis writes fail with OOM | «maxmemory» reached under «noeviction» | the eviction policy |
        | Lag climbs during every deploy | eager rebalances on every restart | static membership, cooperative or KIP-848 protocol |
        | Repeated rebalances, «CommitFailedException» | batches slower than «max.poll.interval.ms» | records per poll, per-record timeouts |
        | One partition's lag grows forever | a poison record retried in place | error classification, the dead-letter path |
        | The DLQ fills with healthy records | an outage treated as bad data | pause and retry on transient errors |
        | «deadlock detected» (40P01) | two code paths locking the same rows in different orders | the deadlock log detail; one global lock order |
        | A sequential scan despite an index | predicate shape, low selectivity, or bad statistics | EXPLAIN (ANALYZE, BUFFERS): estimated vs actual rows |
        | Outage during a "fast" migration | an ALTER waiting for its lock, with every query queued behind it | long transactions in «pg_stat_activity»; lock_timeout |
        | Stale reads right after a write | R + W ≤ RF, or reads from a lagging replica | consistency levels; read-your-writes routing |
        | Two services disagree | a dual write, or a consumer applying events blindly | outbox or CDC; version checks; reconciliation |
        | Adding a cache node empties the cache | hash mod N placement | consistent hashing with virtual nodes |
      `,
    },
    {
      id: 'defaults', title: 'Defaults worth knowing', kind: 'Reference',
      blurb: 'Defaults that decide how an incident goes, checked against the official documentation.',
      lede: 'Every one of these has surprised someone in production. Check your versions; these were current in October 2026.',
      body: R`
        ## Timeouts

        | Setting | Default |
        |---|---|
        | gRPC call deadline | none: waits forever unless set |
        | Java «HttpClient» request timeout | none, unless «timeout(...)» is set on the request |
        | Envoy route timeout | 15 s |
        | Lettuce (Java Redis client) timeout | 60 s |

        ## Resilience4j circuit breaker

        | Setting | Default |
        |---|---|
        | failure rate threshold | 50% |
        | sliding window | last 100 calls |
        | minimum calls before it can open | 100 |
        | wait in the open state | 60 s |
        | trial calls when half-open | 10 |
        | slow call threshold | 60 s |

        ## Redis

        | Setting | Default |
        |---|---|
        | «maxmemory» | 0: no limit on 64-bit systems |
        | «maxmemory-policy» | «noeviction»: writes fail when full |
        | «maxmemory-samples» | 5 |
        | Cluster hash slots | 16,384 |
        | replication | asynchronous: a failover can lose acknowledged writes |

        ## Kafka (4.3)

        | Setting | Default |
        |---|---|
        | «group.protocol» | «classic» («consumer» enables KIP-848) |
        | «partition.assignment.strategy» | «[RangeAssignor, CooperativeStickyAssignor]»: range is used |
        | «session.timeout.ms» | 45 s |
        | «max.poll.interval.ms» | 5 min |
        | «max.poll.records» | 500 |
        | «enable.auto.commit» / interval | true / 5 s |
        | producer «enable.idempotence» / «acks» | true / all |

        ## PostgreSQL (18)

        | Setting or rule | Default or fact |
        |---|---|
        | «deadlock_timeout» | 1 s |
        | «lock_timeout» | 0: wait forever |
        | «log_lock_waits» | off (the PostgreSQL 19 beta turns it on) |
        | most «ALTER TABLE» forms | ACCESS EXCLUSIVE |
        | «VALIDATE CONSTRAINT», «CREATE INDEX CONCURRENTLY» | SHARE UPDATE EXCLUSIVE |
        | «ADD FOREIGN KEY» | SHARE ROW EXCLUSIVE on both tables |
        | «random_page_cost» / «seq_page_cost» | 4.0 / 1.0 |

        ## Kafka brokers

        | Setting | Default |
        |---|---|
        | «min.insync.replicas» | 1 |
        | «unclean.leader.election.enable» | false |

        ## Cassandra and MongoDB

        | Thing | Default or fact |
        |---|---|
        | QUORUM | floor(RF / 2) + 1 |
        | «max_hint_window» | 3 hours |
        | «num_tokens» (shipped config) | 16 |
        | MongoDB document size | 16 MiB, 100 levels of nesting |

        ## Frameworks

        | Thing | Default |
        |---|---|
        | Spring Kafka «DefaultErrorHandler» | 10 attempts, then the record is only logged |
        | Spring Kafka «@RetryableTopic» | 3 attempts, then «-dlt» |
        | Stripe idempotency keys | kept at least 24 hours; the first response is replayed, even a 500 |
      `,
    },
    {
      id: 'sketch', title: 'A design sketch in four steps', kind: 'Interview',
      blurb: 'The order for any "design X" prompt, and the arithmetic for sizing it.',
      lede: 'Ask, size, shape, decide, break. Spend most of the time on the decisions and the failures.',
      body: R`
        ## The four steps

        1. **The ask.** Two or three things it must do; who uses it; what "fast" and "correct" mean here.
        2. **Size it.** Writes per second, reads per second, storage over a few years, the hottest item.
        3. **The shape.** Boxes and arrows, drawn once. Keep the hot path short.
        4. **The decisions that matter.** Two or three, each with its alternative and its cost. Then **where it breaks**: timeouts, retries, hot keys, stampedes, a lost cache, a duplicate event, a migration.

        ## Sizing arithmetic

        | To get | Use |
        |---|---|
        | per second from per day | divide by 86,400 (about 10^5) |
        | 1 million a day | about 12 a second |
        | 100 million a day | about 1,160 a second |
        | 100 million a month | about 40 a second |
        | peak | assume several times the average |
        | in flight | rate × latency (Little's law) |
        | codes of length n over 62 characters | 62^n: 6 gives 56.8 billion, 7 gives 3.5 trillion |
        | storage | items × bytes each × retention |

        ## Decisions that come up in almost every sketch

        | Decision | The usual alternatives |
        |---|---|
        | Where the data lives | one relational database, a key-value store, a log |
        | When work happens | on the request path, or asynchronously from an event |
        | Precompute or compute on read | fan-out on write versus on read |
        | How much staleness is acceptable | per operation: linearisable, read-your-writes, eventual |
        | What happens on a timeout | idempotency keys, unknown states, reconciliation |
      `,
    },
    {
      id: 'ladder', title: 'The follow-up ladder', kind: 'Interview',
      blurb: 'The five follow-ups behind almost every backend question, and how a strong answer is ordered.',
      lede: 'Say the mechanism, the failure and the trade-off before they are asked for. Then expect these.',
      body: R`
        ## The answer, in order

        1. **Mechanism**: numbered steps, real actors (client, gateway, service thread, database, broker).
        2. **Failure**: when it breaks and what the user or downstream sees.
        3. **Trade-off**: what you would change, and what it costs.

        ## The follow-ups

        | They ask | They are testing | Have ready |
        |---|---|---|
        | "What actually happens when…?" | depth | the step-by-step mechanism, with numbers |
        | "And if that fails?" | failure reasoning | the four timeout outcomes; what users see |
        | "Why not the other option?" | trade-offs | the alternative and its cost |
        | "How would you know?" | observability | the metric, log or trace |
        | "What did you do?" | ownership | your decision, separate from the team's |

        ## Phrases that lose the room

        - "It is fast and it scales." (Name the property you needed.)
        - "We increased the timeout." (Why was it slow, and who was waiting?)
        - "We retry three times." (Which errors, at which layer, with what budget?)
        - "Kafka gives us exactly once." (Not into your database.)
        - "We fall back to the database." (Was it sized for that?)
      `,
    },
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);
