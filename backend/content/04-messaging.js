(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'messaging', title: 'Kafka and asynchronous processing', short: 'Messaging',
    blurb: 'Kafka as a log, why you would pick it over RabbitMQ (or not), what a rebalance costs, and what to do with a message that keeps failing.',
    items: [
      /* ───────────── 1. the log, and Kafka vs RabbitMQ ───────────── */
      {
        lesson: 'mq-kafka', title: 'Kafka in one page, and "why not RabbitMQ?"', mins: 11,
        remember: 'Kafka is a replicated log that consumers read at their own position; RabbitMQ is a broker that hands each message to a consumer and forgets it once acknowledged. Pick by what you need: replay and per-key order, or per-message routing and work distribution.',
        cue: '"we used Kafka because it is fast and scales" → name the property you needed: replay, per-key ordering, many independent readers, or retention',
        body: R`
          ## The model

          1. A **topic** is split into **partitions**. Each partition is an append-only log, replicated across brokers.
          2. A producer writes a record with a **key**; the key's hash picks the partition, so all records with one key land in one partition, in order.
          3. Each record gets an **offset**: its position in the partition.
          4. A **consumer group** reads a topic. Each partition is read by exactly one member of the group, so a group can never usefully have more members than partitions.
          5. A consumer **commits** the offset it has processed up to. After a restart or a rebalance, reading resumes from the last commit.
          6. Records stay for the topic's **retention** (time or size), whether or not anyone has read them. Another group can read the same records independently, or a group can rewind and re-read.

          Ordering is guaranteed **within a partition only**. "Order for one customer" therefore means "key by customer id".

          ## Delivery guarantees come from when you commit

          | Commit | If the consumer crashes mid-batch | Name |
          |---|---|---|
          | before processing | the uncommitted records are skipped | at most once |
          | after processing | the processed-but-uncommitted records are read again | at least once |
          | in a Kafka transaction with the output | nothing duplicates *within Kafka* | exactly once (Kafka to Kafka only) |

          Current producers default to «enable.idempotence=true» and «acks=all» (the defaults changed with KIP-679), so a producer retry does not duplicate a record in the log. A consumer that writes to a database is still at least once: make it idempotent (the Requests module).

          ## Why Kafka, and when RabbitMQ

          | You need | Kafka | RabbitMQ |
          |---|---|---|
          | Replay: re-read last week after fixing a bug | yes: retention, rewind offsets | classic and quorum queues delete on ack; RabbitMQ Streams add a replayable log |
          | Many independent readers of the same events | yes: each group has its own position | a queue per reader, or streams |
          | Order per key at high throughput | yes, per partition | per queue, weakened by redelivery and multiple consumers |
          | Flexible routing per message | topics and keys only | exchanges: direct, topic, fanout, headers |
          | Work queue: any free worker takes the next job | parallelism capped by partitions; head-of-line blocking | natural fit: competing consumers, per-message ack |
          | Per-message retry, TTL and dead-lettering | built by you, or by a framework | built in: dead-letter exchanges, TTLs |

          Kafka 4.0 (March 2025) removed ZooKeeper entirely. Kafka 4.2 made **share groups** production-ready ("Kafka Queues"): consumers of a share group take records one at a time with per-record acknowledgement, which gives Kafka queue-like work distribution without partition-count limits.

          So "it is fast and it scales" is not a reason; both are fast enough for most systems. The reasons are replay, independent readers and per-key order (Kafka), or per-message routing, retries and work distribution (RabbitMQ).

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A topic has 6 partitions. You run 10 consumers in one group. What do the extra 4 do?', options: ['Share the load evenly', 'Nothing: each partition is read by one member, so 4 sit idle', 'Read the same partitions in parallel', 'Become replicas'], answer: 1, why: 'Within a group, a partition has one reader. Parallelism is capped by the partition count (share groups lift this).' },
          { q: 'You need all events for one order processed in sequence. What do you do?', options: ['Use one partition for the whole topic', 'Key each record by order id', 'Set «max.poll.records» to 1', 'Add more consumers'], answer: 1, why: 'Records with the same key go to the same partition, and order is kept within a partition.' },
        ],
        defend: [
          {
            q: 'Why did you use Kafka for that, and not RabbitMQ?',
            weak: 'Kafka is fast and it scales well. It is the industry standard for event streaming.',
            whyWeak: 'Both are fast and both scale for most workloads. It names no property of the problem that one has and the other lacks.',
            follow: [
              { q: 'What property of your problem needed a log?', a: 'Name it: replaying events after a bug fix, several services reading the same events at their own pace, or strict order per key at high throughput. If none of those apply, a queue may have been simpler.' },
              { q: 'How do you keep order for one customer?', a: 'Key records by customer id, so they share a partition, and process each partition sequentially. Retries that move a record elsewhere break that order (see the poison-message lesson).' },
              { q: 'What would have made RabbitMQ the better call?', a: 'A work queue where any free worker takes the next job, routing by message attributes, per-message TTL and dead-lettering out of the box, and no need to replay.' },
              { q: 'Your consumers cannot keep up and you are already at one consumer per partition. Now what?', a: 'Add partitions (which changes key placement for new records), make processing faster or asynchronous per partition while keeping per-key order, or, on Kafka 4.2 or later, consider share groups if per-key order does not matter.' },
            ],
            strong: [
              'Kafka: partitioned, replicated log; consumers keep their own position; retention allows replay.',
              'Order is per partition, so you key by the entity whose order matters.',
              'Delivery semantics follow from when offsets are committed; databases need idempotent consumers.',
              'RabbitMQ: per-message delivery, routing, competing consumers and dead-lettering built in.',
              'The choice is justified by a property you needed, not by speed.',
            ],
            flags: ['"Fast and scalable" as the only reason', 'Expects global ordering across partitions', 'Thinks more consumers than partitions adds throughput', 'Claims exactly once end to end'],
          },
        ],
      },

      /* ───────────── 2. rebalancing ───────────── */
      {
        lesson: 'mq-rebalance', title: 'Consumer groups and rebalancing', mins: 12,
        remember: 'A rebalance moves partitions between consumers, and moved partitions stop while it happens. Classic eager rebalancing stops all of them; cooperative and the new consumer protocol stop only what moves.',
        cue: 'lag spikes during deploys, or a consumer that keeps getting kicked out → check max.poll.interval.ms, the assignor and static membership',
        body: R`
          ## What triggers a rebalance

          - A consumer **joins** (scale-out, or one restarting).
          - A consumer **leaves** cleanly (shutdown) or **dies** (missed heartbeats for «session.timeout.ms», 45 s by default).
          - A consumer **stops calling poll()** for longer than «max.poll.interval.ms» (5 minutes by default): the client decides it is stuck and leaves the group.
          - The partition count or the subscription changes.

          ## Three protocols

          **Classic, eager.** Every member revokes *all* its partitions, the group agrees on a new assignment, and every member starts again. Nothing is consumed during that pause. In current Java clients the default «partition.assignment.strategy» is «[RangeAssignor, CooperativeStickyAssignor]», and the range assignor (eager) is the one used.

          **Classic, cooperative sticky** (KIP-429). Members keep their partitions through the first round; only partitions that must move are revoked, then assigned in a second round. Removing «RangeAssignor» from the list switches a group over with one rolling bounce.

          **The new consumer protocol** (KIP-848, production-ready since Kafka 4.0). The broker computes the target assignment (its «uniform» assignor by default), and each consumer gives up or takes on only its own changes. There is no group-wide barrier. Clients opt in with «group.protocol=consumer»; as of Kafka 4.3 the default is still «classic».

          @sim rebalance

          Try **A fourth consumer joins** with each protocol, then **Rolling restart** with and without static membership.

          ## Static membership

          Set «group.instance.id» to a stable name per instance (a pod name, for example). A static member does not leave the group on shutdown; if it comes back within «session.timeout.ms», it gets the same partitions and nothing is reshuffled. Rolling deploys stop causing rebalances. The trade: if it does not come back, its partitions wait for the session timeout, and a static member that exceeds «max.poll.interval.ms» also keeps its partitions until then.

          ## The slow consumer that gets kicked out

          1. A consumer polls up to «max.poll.records» (500 by default) and processes them in the same thread.
          2. One batch is slow: a slow downstream, a huge message.
          3. «max.poll.interval.ms» passes without a poll(), so the consumer leaves the group and its partitions move.
          4. It finishes the batch and tries to commit. The commit is rejected («CommitFailedException»): it no longer owns those partitions.
          5. The new owner starts from the last committed offset and processes the batch again.
          6. The old consumer rejoins, which triggers another rebalance.

          Fixes: process less per poll (lower «max.poll.records»), bound the time each record can take (timeouts on downstream calls), or move slow work off the polling thread and use «pause()» and «resume()» so the consumer keeps polling while it works.

          ## Commits around a rebalance

          With auto-commit («enable.auto.commit=true», every 5 s by default), a crash repeats whatever was processed since the last commit. With manual commits, commit in «onPartitionsRevoked» before giving partitions up, as the «ConsumerRebalanceListener» documentation recommends. Either way the consumer must be idempotent, because the crash case cannot be removed.

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Consumers are rebalancing every few minutes during normal traffic. Logs show «CommitFailedException». The likeliest cause?', options: ['The broker is overloaded', 'Processing a batch takes longer than «max.poll.interval.ms», so the consumer is removed from the group', 'Too many partitions', 'Auto-commit is on'], answer: 1, why: 'A consumer that does not poll in time is treated as stuck and leaves; its later commit is rejected because it no longer owns the partitions.' },
          { q: 'What does static membership («group.instance.id») buy you?', options: ['Exactly-once processing', 'Restarts within the session timeout do not trigger a rebalance', 'More consumers than partitions', 'Faster crash detection'], answer: 1, why: 'A static member does not leave on shutdown, so a quick restart gets its partitions back without reshuffling. Crash detection actually waits for the session timeout.' },
        ],
        defend: [
          {
            q: 'Your consumers keep rebalancing and lag climbs. What is going on, and how do you fix it?',
            weak: 'Kafka rebalances are just slow. We increased «session.timeout.ms» so consumers are not removed.',
            whyWeak: 'The session timeout covers dead processes (missed heartbeats). A consumer that is alive but slow is removed by «max.poll.interval.ms», so this change probably does nothing.',
            follow: [
              { q: 'What exactly removes a live consumer from the group?', a: 'Going longer than «max.poll.interval.ms» between poll() calls because a batch takes too long. The client leaves the group, its partitions move, and its later commit fails.' },
              { q: 'Why does lag climb during each rebalance?', a: 'Moved partitions are not consumed while they move. With the classic eager protocol that is every partition in the group for the whole rebalance.' },
              { q: 'What duplicates does this cause?', a: 'The batch the kicked consumer was processing: its commit is rejected and the new owner starts from the last committed offset. Hence idempotent consumers.' },
              { q: 'How do you stop deploys from causing rebalances?', a: 'Static membership with a stable «group.instance.id» per instance, so a restart within the session timeout keeps its assignment. And cooperative rebalancing or the new consumer protocol so that a real change moves only a few partitions.' },
              { q: 'How do you fix the slow processing itself?', a: 'Smaller batches, timeouts on downstream calls, or processing off the polling thread with pause() and resume() and careful offset commits. If one partition is consistently hot, look at the key distribution.' },
            ],
            strong: [
              'Triggers: joins, leaves, missed heartbeats (session timeout), and poll gaps (max.poll.interval.ms).',
              'Eager rebalances stop every partition; cooperative and KIP-848 stop only what moves.',
              'A kicked consumer\'s commit fails, and its batch is processed twice.',
              'Static membership prevents rebalances on restarts within the session timeout.',
              'Fix the slow batch: fewer records per poll, bounded per-record time, or pause and resume.',
            ],
            flags: ['Raises session.timeout.ms for a slow-processing problem', 'Does not know rebalances stop consumption', 'Assumes no duplicates', 'Never heard of static membership or cooperative rebalancing'],
          },
        ],
      },

      /* ───────────── 3. poison messages ───────────── */
      {
        lesson: 'mq-poison', title: 'A message keeps failing. What happens to it?', mins: 11,
        remember: 'First decide whether the failure is permanent (bad data, a bug) or transient (a downstream outage). Permanent failures go to a dead-letter topic at once; transient ones are worth waiting out. Treating them the same is what floods DLQs and blocks partitions.',
        cue: 'a stuck partition, a growing DLQ, or "we just log and skip" → ask how failures are classified, and what happens to ordering and replay',
        body: R`
          A consumer reads a partition in order, and the committed offset is a single number. So when one record cannot be processed, the consumer has three choices, each with a cost: stop there, skip it, or move it somewhere else.

          | Choice | What it costs |
          |---|---|
          | Retry the same record until it works | blocks everything behind it in the partition, forever if it can never succeed |
          | Log it and move on | silent data loss |
          | Retry a few times in place, then dead-letter it | a stall per bad record; during an outage, healthy records end up in the DLQ |
          | Send it to a retry topic | the partition keeps moving, but that record is processed after later records with the same key |

          @sim poison strategy=forever

          Press **Compare every option**, with and without the outage.

          ## Classify the failure first

          - **Permanent**: the record can never succeed as it is. It fails to deserialise, violates a schema, refers to something that will never exist, or hits a bug. Retrying wastes time and blocks the partition. Send it to a **dead-letter topic** immediately.
          - **Transient**: a downstream is down or slow, or a lock timed out. The record is fine and would succeed later; so would every record behind it, which is failing for the same reason. Pause and retry with backoff, keeping order: skipping ahead only produces more failures.

          That is the last option in the simulator: nothing lost, order kept, and only the two genuinely bad records in the DLQ.

          ## Retry topics and ordering

          Non-blocking retries move a failed record to a retry topic with a delay (then perhaps a second, longer one), and finally to a DLQ. The main partition never stops. The cost is ordering: an update for customer 42 may be applied before the earlier one that is waiting in the retry topic. If order per key matters, park the *key*: once a record for a key is in retry, send that key's later records after it until it clears.

          ## What goes in the dead-letter topic

          - The original record, unchanged: key, value and headers.
          - Why it failed: the exception class and message.
          - Where it came from: topic, partition, offset, timestamp.
          - How many attempts were made.

          A DLQ is only useful with an **alert on its growth** and a **replay tool** that sends records back after the fix. Replay means reprocessing, so the consumer must be idempotent.

          ## What frameworks do by default

          - **Spring for Apache Kafka**: «DefaultErrorHandler» retries a failed record 9 more times with no delay (10 attempts), then hands it to a recoverer that by default **only logs it**. Add a «DeadLetterPublishingRecoverer» to publish it to «<topic>-dlt». «@RetryableTopic» gives non-blocking retry topics (3 attempts by default) ending in a «-dlt» topic.
          - **Kafka Connect** sink connectors can route failed records to «errors.deadletterqueue.topic.name», but only with «errors.tolerance=all».
          - **Kafka Streams** gained dead-letter support for its exception handlers in Kafka 4.2.
          - **RabbitMQ** has dead-letter exchanges built in: a rejected or expired message is routed to another exchange.

          @quiz 0
        `,
        quiz: [
          { q: 'Spring Kafka with a «DefaultErrorHandler» and no recoverer configured. A record fails every time. What happens?', options: ['It is retried forever', 'After 10 attempts it is logged and skipped', 'It goes to a «-dlt» topic', 'The consumer stops'], answer: 1, why: 'The default back-off is 9 retries with no delay; the default recoverer only logs. Without a DeadLetterPublishingRecoverer the record is effectively dropped.' },
        ],
        defend: [
          {
            q: 'A message keeps failing in your consumer. What happens to it, and to everything behind it?',
            weak: 'We retry it three times and then put it on a dead-letter queue, so it does not block anything.',
            whyWeak: 'It treats all failures the same. During a downstream outage every record exhausts its retries and the DLQ fills with healthy data, and in-place retries do block the partition while they run.',
            follow: [
              { q: 'Why does one bad record affect others at all?', a: 'A partition is consumed in order and the commit is one offset. Until the consumer gets past the record, everything behind it waits, including unrelated keys.' },
              { q: 'The downstream database is down for 15 minutes. What does your design do?', a: 'With retry-then-DLQ, every record fails its retries and lands in the DLQ: healthy data that now needs replaying. Better: recognise a transient failure, pause the partition, and retry with backoff until the downstream is back.' },
              { q: 'You use retry topics. What did you give up?', a: 'Per-key ordering: a record waiting in a retry topic is processed after later records with the same key. If that matters, park the key until its retry clears.' },
              { q: 'What do you put in the DLQ record, and then what?', a: 'The original key, value and headers plus the error, source topic, partition, offset and attempt count. Alert on growth, fix the cause, and replay through an idempotent consumer.' },
              { q: 'What does your framework do if you configure nothing?', a: 'Spring Kafka\'s DefaultErrorHandler tries 10 times and then only logs: silent loss unless a dead-letter recoverer is configured.' },
            ],
            strong: [
              'In-order consumption means one failing record blocks its partition.',
              'Classify: permanent failures go straight to a DLQ; transient ones pause and retry in order.',
              'Retry topics keep partitions moving but break per-key order.',
              'DLQ records carry the original and the context; alert on growth and replay idempotently.',
              'Know the framework\'s defaults: some silently drop.',
            ],
            flags: ['"Log and skip" for business data', 'The same retry policy for every error', 'DLQ with no alert and no replay path', 'Unaware that retry topics reorder'],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
