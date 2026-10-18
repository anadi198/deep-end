(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'rocketmq', title: 'RocketMQ, compared with Kafka', short: 'RocketMQ',
    blurb: 'How RocketMQ stores every topic in one log, what it builds in that Kafka leaves to you (retries, dead letters, delays, transactional messages, filters), and when to pick which. Facts checked against RocketMQ 5.5 and its 5.x Java client.',
    intro: R`
      RocketMQ came out of Alibaba for order and payment flows, and it shows: the features Kafka leaves to frameworks (retry with back-off, dead-letter queues, delayed delivery, tying a send to a database transaction) are built into the broker. This module assumes the Kafka modules: it explains RocketMQ by contrast.
    `,
    items: [
      /* ───────────── 1. the model ───────────── */
      {
        lesson: 'rmq-model', title: 'RocketMQ: one log for every topic', mins: 12,
        remember: 'A RocketMQ broker appends every message of every topic to one CommitLog, and keeps a small index (a ConsumeQueue) per queue pointing into it. Writes stay sequential however many topics you have; reads pay with random access into the shared log.',
        cue: '"we have thousands of topics" or "we need per-message retries and delays" → RocketMQ\'s design fits; "we need to replay last month" → check its retention, which is days by default',
        body: R`
          ## The parts

          | Part | Role |
          |---|---|
          | **NameServer** | a small routing registry. Brokers register with every NameServer; clients ask any of them where a topic's queues live. NameServers do not talk to each other. |
          | **Broker** | stores and serves messages. A broker group is a master plus replicas. |
          | **Proxy** (5.x) | a stateless front end that speaks gRPC to 5.x clients and the internal protocol to brokers. It runs inside the broker process ("local" mode) or as a separate tier ("cluster" mode). |
          | **Topic → MessageQueue** | a topic is split into queues, the unit of storage and order, like Kafka's partitions. |

          ## How a message is stored

          1. Every message for every topic on the broker is appended to the **CommitLog**: 1 GB files, written sequentially.
          2. A dispatcher adds a 20-byte entry to that queue's **ConsumeQueue**: the message's position in the CommitLog (8 bytes), its size (4) and the hash of its tag (8).
          3. An **IndexFile** lets you look messages up by key or time.
          4. A consumer reads its queue's ConsumeQueue entries in order, then fetches each message body from the CommitLog.

          ~~~mermaid One log, many queues
          flowchart LR
            P1[Producer: orders] --> CL[(CommitLog: every topic, appended in arrival order)]
            P2[Producer: payments] --> CL
            CL -. 20-byte entries .-> Q1[ConsumeQueue orders-0]
            CL -. 20-byte entries .-> Q2[ConsumeQueue orders-1]
            CL -. 20-byte entries .-> Q3[ConsumeQueue payments-0]
            Q1 --> C1[Consumer group A]
            Q3 --> C2[Consumer group B]
          ~~~

          Compare Kafka: each partition is its own set of segment files. With a few partitions per disk that is sequential I/O; with thousands, the disk sees many interleaved append streams. RocketMQ's single log keeps writes sequential regardless. Its own design notes name the price: reading a message body is a **random read** into the CommitLog, cheap while the data is in the page cache and expensive when a consumer is far behind.

          ## Durability settings

          | Setting | Default | Meaning |
          |---|---|---|
          | «flushDiskType» | ASYNC_FLUSH | acknowledge once in the page cache; flush in the background. SYNC_FLUSH waits for the disk. |
          | «brokerRole» | ASYNC_MASTER | acknowledge without waiting for replicas. SYNC_MASTER waits for a replica. |
          | «fileReservedTime» | 72 hours | messages older than this are deleted, **consumed or not** |

          Like Kafka's defaults, these favour speed: an ASYNC_MASTER that dies loses what its replicas had not copied. The 5.x **controller mode** elects a new master automatically from the **SyncStateSet**, the replicas that are caught up (the counterpart of Kafka's ISR), and «inSyncReplicas» / «minInSyncReplicas» (both 1 by default) set how many must have a write. The older DLedger mode is deprecated in favour of controller mode.

          ## Consumption

          - **Offsets live on the broker**, per consumer group.
          - In 5.x, push and simple consumers use **message-level load balancing**: messages of one queue are handed out to any consumer in the group, so a group can have more consumers than queues and they all work. Kafka (classic groups) and RocketMQ 4.x use queue-level balancing: one consumer per queue.
          - **Clustering** mode (the default) gives each message to one consumer of the group; **broadcasting** gives every message to every consumer of the group. Two services that both need every message use two groups.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A topic has 8 queues. A 5.x push consumer group has 20 consumers. How many do work?', options: ['8: one per queue', 'All 20: message-level load balancing hands out messages, not queues', '4', 'None until you add queues'], answer: 1, why: 'Message-level load balancing is the default (and only) policy for 5.x push and simple consumers.' },
          { q: 'A consumer group was down for four days. With the defaults, what happened to its messages?', options: ['They wait for it', 'Those older than 72 hours were deleted anyway', 'They moved to the DLQ', 'The producer was blocked'], answer: 1, why: 'fileReservedTime is 72 hours, and expired files are deleted whether or not they were consumed.' },
        ],
        defend: [
          {
            q: 'How does RocketMQ store messages, and why does it matter compared with Kafka?',
            weak: 'RocketMQ is like Kafka but from Alibaba; it stores messages in topics and queues on disk.',
            whyWeak: 'It names the nouns and misses the one design difference that explains RocketMQ\'s strengths and costs: one shared log per broker.',
            follow: [
              { q: 'What is the CommitLog?', a: 'One sequential log per broker holding every message of every topic, in 1 GB files.' },
              { q: 'Then how does a consumer read one queue?', a: 'Through the ConsumeQueue: 20-byte entries per queue with the CommitLog offset, size and tag hash. It reads the entries in order and fetches each body from the CommitLog.' },
              { q: 'What does the shared log buy, and what does it cost?', a: 'Writes stay sequential however many topics there are. Reads become random reads into the shared log: fine from the page cache, expensive for consumers far behind.' },
              { q: 'What are the durability defaults?', a: 'ASYNC_FLUSH and ASYNC_MASTER: acknowledged from the page cache, without waiting for a replica. SYNC_MASTER (or controller mode with inSyncReplicas above 1) waits for a replica.' },
              { q: 'How long are messages kept?', a: 'fileReservedTime, 72 hours by default, whether or not they were consumed. Not a replay store for last month.' },
            ],
            strong: [
              'One CommitLog per broker, ConsumeQueue indexes per queue.',
              'Sequential writes regardless of topic count; random reads into the log.',
              'Async flush and async replication by default; SYNC_MASTER or controller mode for safety.',
              'Offsets on the broker; message-level load balancing in 5.x.',
              'Retention is days, consumed or not.',
            ],
            flags: ['Thinks RocketMQ is a Kafka fork', 'Assumes acknowledged means replicated by default', 'Plans month-long replays on default retention'],
          },
        ],
        gaps: [
          {
            title: 'A broker for payment events',
            intro: 'This broker configuration is for payment events that must not be lost. Consumers subscribe with SQL92 filters on a «region» property.',
            lang: 'properties',
            code: R`
              brokerClusterName=payments
              brokerName=broker-a
              brokerId=0 ⟦ok1⟧
              brokerRole=ASYNC_MASTER ⟦async⟧
              flushDiskType=ASYNC_FLUSH ⟦ok2⟧
              fileReservedTime=12 ⟦retention⟧
              deleteWhen=04 ⟦ok3⟧
              enablePropertyFilter=false ⟦sql⟧
            `,
            issues: [
              { id: 'async', kind: 'loss', title: 'The master acknowledges before any replica has the message', why: 'With ASYNC_MASTER a payment event can be acknowledged and then lost with the master.', fix: '«brokerRole=SYNC_MASTER», or controller mode with «inSyncReplicas=2».' },
              { id: 'retention', kind: 'loss', title: '12 hours of retention, consumed or not', why: 'Files older than fileReservedTime are deleted whether or not every group has read them. A consumer that is down overnight loses messages.', fix: 'Keep the default 72 hours or more, and alert on consumer lag well before it.' },
              { id: 'sql', kind: 'ops', title: 'SQL92 filtering is switched off on the broker', why: 'Property (SQL92) filters need «enablePropertyFilter=true» on the broker; it is false by default, so the consumers\' region subscriptions will not work as written.', fix: '«enablePropertyFilter=true».' },
            ],
            decoys: [
              { id: 'ok1', why: 'brokerId 0 marks the master in a classic master and replica group. Correct.' },
              { id: 'ok2', why: 'With synchronous replication to another machine, async flush is the usual choice: SYNC_FLUSH waits for the disk on every write and costs far more latency than it adds safety.' },
              { id: 'ok3', why: 'Expired files are deleted at 4 am by default; fine.' },
            ],
          },
        ],
      },

      /* ───────────── 2. built in ───────────── */
      {
        lesson: 'rmq-builtin', title: 'What RocketMQ builds in that Kafka leaves to you', mins: 14,
        remember: 'RocketMQ retries a failed message with growing back-off (16 times over almost five hours), then parks it in a per-group dead-letter topic; it delivers messages at a future time; and it can tie a send to your local database transaction with half messages and check-backs. In Kafka you build each of these yourself.',
        cue: 'a design that needs per-message retry with back-off, delayed delivery, or "send only if my transaction commits" → RocketMQ has these in the broker; in Kafka reach for retry topics, a scheduler table, or the outbox',
        body: R`
          ## Retries and dead letters

          A 5.x push consumer's listener returns «SUCCESS» or «FAILURE» (or throws). A failed message is redelivered later, without blocking the messages behind it (for normal, unordered messages):

          | Retry | 1 | 2 | 3 | 4 to 12 | 13 | 14 | 15 | 16 |
          |---|---|---|---|---|---|---|---|---|
          | waits | 10 s | 30 s | 1 min | 2 to 10 min | 20 min | 30 min | 1 h | 2 h |

          After 16 retries (the default, set per consumer group) the message goes to the group's dead-letter topic, «%DLQ%<group>». The schedule adds up to almost **five hours**, so a downstream outage of an hour or two is ridden out with nothing dead-lettered. Compare the Kafka poison-message lesson, where Spring's default is 10 attempts with no delay.

          Retries are per consumer group (the message goes back to that group only) and exist only in clustering mode, not broadcasting.

          ## Ordered (FIFO) messages

          Messages with the same **message group** go to the same queue and are consumed in order; different groups are independent. The cost is the Kafka cost: a failing message is retried in place, and **everything behind it in its group waits** until it succeeds or exhausts its retries.

          ## Delayed delivery

          In 5.x a message on a DELAY topic carries a delivery timestamp and is invisible until then, to millisecond precision (4.x had 18 fixed levels from 1 s to 2 h). The maximum delay is limited: the docs say 24 hours, and the broker setting «timerMaxDelaySec» is 3 days in current source. A "remind me in a week" feature belongs in a database table with a due date, not in a delay message.

          ## Transactional messages

          The problem is the dual write from the Distributed state module: update your database *and* publish an event, without one happening alone.

          ~~~seq Half message, local transaction, check-back
          actors: Producer, Broker, Database
          Producer -> Broker: send half message
          state Broker: stored, invisible to consumers
          Broker --> Producer: ok
          Producer -> Database: BEGIN; INSERT payment; COMMIT
          Producer -> Broker: commit
          state Broker: message becomes visible
          note: If the commit is lost (the producer crashed), the broker asks.
          Broker -> Producer: check-back: did transaction X commit?
          Producer -> Database: look up payment X
          Producer --> Broker: COMMIT, ROLLBACK or UNKNOWN
          ~~~

          The check-back is what makes it safe, and only if your checker really looks at the database. Answer UNKNOWN for a transaction still in progress. The broker checks back after a few seconds and repeats (up to 15 times in the broker's defaults) before rolling back.

          Kafka's transactions solve a different problem: writing to several Kafka partitions atomically, read with «read_committed». To tie Kafka to a database, use the outbox pattern.

          ## Filtering on the broker

          - **Tags**: one tag per message; a consumer subscribes to «TagA||TagB» or «*». The broker filters on the tag hash stored in the ConsumeQueue, so non-matching messages are never sent; the client re-checks the tag string.
          - **SQL92** on message properties («region = 'eu' AND amount > 100»), if the broker has «enablePropertyFilter=true».

          In Kafka the consumer receives everything on the topic and filters itself, or you split topics.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A downstream API is down for 90 minutes. Unordered messages fail with the RocketMQ defaults. How many reach the DLQ?', options: ['All of them', 'None: 16 retries span almost five hours', 'Those after the 10th attempt', 'Half'], answer: 1, why: 'The back-off grows from 10 s to 2 h over 16 retries. A 90-minute outage is ridden out.' },
          { q: 'Your transaction checker always returns COMMIT. When does it bite?', options: ['Never', 'When a local transaction rolled back but its rollback message was lost: the half message is committed anyway', 'Only with FIFO messages', 'When the broker restarts'], answer: 1, why: 'The check-back exists to find out what really happened. An unconditional COMMIT publishes events for transactions that never committed.' },
        ],
        defend: [
          {
            q: 'You need to save an order and publish an "order created" event, never one without the other. How with RocketMQ, and how with Kafka?',
            weak: 'Save the order, then publish the event in a try block, and if publishing fails we retry it.',
            whyWeak: 'If the process dies between the commit and the publish, the event is never sent; retrying in-process cannot cover a crash.',
            follow: [
              { q: 'What does RocketMQ offer?', a: 'Transactional messages: send a half message (invisible), run the local transaction, then commit or roll back the message. If that last step is lost, the broker checks back and the producer answers from the database.' },
              { q: 'What must the checker do?', a: 'Look up the transaction\'s real outcome in the database: COMMIT if the order exists, ROLLBACK if it does not, UNKNOWN if still running. Never a fixed answer.' },
              { q: 'Why not Kafka transactions?', a: 'They make writes across Kafka partitions atomic. They do not include your database, so they do not solve this dual write.' },
              { q: 'Then how with Kafka?', a: 'The outbox: insert the event into an outbox table in the same database transaction as the order, and relay it to Kafka (a poller or CDC such as Debezium). Consumers must be idempotent, because the relay can publish twice.' },
            ],
            strong: [
              'Name the dual-write problem and the crash window.',
              'RocketMQ: half message, local transaction, commit, check-back.',
              'The checker answers from the database, UNKNOWN while in progress.',
              'Kafka: the outbox pattern; Kafka transactions are Kafka-to-Kafka.',
              'Idempotent consumers either way.',
            ],
            flags: ['Publishes after commit and calls it safe', 'A checker that always commits', 'Thinks Kafka transactions include the database'],
          },
        ],
        gaps: [
          {
            title: 'Payments, reminders and a fast listener',
            intro: 'Parts of a payment service on the RocketMQ 5.x Java client. Payment events must match the database, per-account order matters, and reminders go out a week after a missed payment.',
            lang: 'java',
            code: R`
              Producer producer = provider.newProducerBuilder()
                  .setClientConfiguration(config)
                  .setTopics("payments")
                  .setTransactionChecker(view -> TransactionResolution.COMMIT) ⟦checker⟧
                  .build();

              Message event = provider.newMessageBuilder()
                  .setTopic("payments")
                  .setTag("captured") ⟦ok1⟧
                  .setMessageGroup(UUID.randomUUID().toString()) ⟦group⟧
                  .setBody(json(payment))
                  .build();

              Message reminder = provider.newMessageBuilder()
                  .setTopic("reminders")
                  .setDeliveryTimestamp(System.currentTimeMillis() + Duration.ofDays(7).toMillis()) ⟦delay⟧
                  .setBody(json(account))
                  .build();

              PushConsumer consumer = provider.newPushConsumerBuilder()
                  .setClientConfiguration(config)
                  .setConsumerGroup("ledger")
                  .setSubscriptionExpressions(Map.of("payments", new FilterExpression("captured", FilterExpressionType.TAG))) ⟦ok2⟧
                  .setMessageListener(view -> {
                      executor.submit(() -> ledger.apply(view)); ⟦async⟧
                      return ConsumeResult.SUCCESS;
                  })
                  .build();
            `,
            issues: [
              { id: 'checker', kind: 'wrong', title: 'A transaction checker that always says COMMIT', why: 'The broker only asks when the producer\'s own commit or rollback was lost. Answering COMMIT without looking publishes events for payments that rolled back.', fix: 'Look the payment up by the message key: COMMIT if it exists, ROLLBACK if not, UNKNOWN if the transaction may still be running.' },
              { id: 'group', kind: 'order', title: 'A new message group for every message', why: 'Order is kept only within a message group. A random group per message means no two events share a group, so per-account order is gone.', fix: '«setMessageGroup(accountId)».' },
              { id: 'delay', kind: 'wrong', title: 'A seven-day delay message', why: 'Delay messages are capped (24 hours per the docs; 3 days in the current broker setting), so this reminder cannot be held for a week as written.', fix: 'Store reminders with a due date in a table and have a scheduler publish them when due.' },
              { id: 'async', kind: 'loss', title: 'The listener reports success before the work is done', why: 'SUCCESS tells the broker the message is consumed. If the process dies while the task waits in the executor, the message is never retried.', fix: 'Do the work in the listener and return its real result (the client already runs listeners on a pool, 20 threads by default).' },
            ],
            decoys: [
              { id: 'ok1', why: 'One tag per message for its kind is exactly how tags are meant to be used.' },
              { id: 'ok2', why: 'Subscribing by tag lets the broker filter on the tag hash; the ledger only receives captured payments.' },
            ],
          },
        ],
      },

      /* ───────────── 3. side by side ───────────── */
      {
        lesson: 'rmq-vs', title: 'RocketMQ or Kafka, and making RocketMQ fast', mins: 12,
        remember: 'Pick Kafka for a long-retained, replayable log with a large ecosystem (stream processing, connectors, compaction). Pick RocketMQ for business messaging with many topics and per-message semantics: retries, dead letters, delays, transactional sends, broker-side filters. Neither is "faster" in general.',
        cue: '"RocketMQ is faster than Kafka" or the reverse → ask for which workload: topic count, message size, consumers behind or caught up, and which guarantees were switched on',
        body: R`
          ## Side by side

          | | Kafka | RocketMQ |
          |---|---|---|
          | Storage | files per partition | one CommitLog per broker plus per-queue indexes |
          | Many topics | each partition adds files and replication work | writes stay sequential |
          | Unit of order | partition (by key) | queue; FIFO by message group |
          | Load balancing | a partition per consumer (share groups since 4.2) | per message in 5.x: more consumers than queues all work |
          | Failed messages | your code or framework: retry topics, DLT | built in: 16 back-off retries, «%DLQ%<group>» |
          | Delayed delivery | not built in | built in, up to a limit |
          | Transactions | atomic writes across Kafka partitions | half message plus check-back with your database |
          | Filtering | the consumer filters | tags and SQL92 on the broker |
          | Retention and replay | days to forever, compaction, tiered storage | 72 hours by default; offsets can be reset |
          | Ecosystem | Connect, Streams, a large tooling world | smaller; RocketMQ Connect and Streams exist |
          | Durability knobs | «acks», «min.insync.replicas» | «brokerRole», «flushDiskType», controller «inSyncReplicas» |

          ## The "many topics" argument

          The mechanism is real: Kafka keeps files per partition, so thousands of partitions on one broker turn sequential appends into many interleaved streams, while RocketMQ appends everything to one log. The most quoted numbers are a **vendor benchmark** (Alibaba, 2017): going from 64 to 256 topics, Kafka's throughput fell 98% and RocketMQ's 16%. Treat that as a direction, not a fact about your setup: it is old, run by an interested party, and predates Kafka's later changes. RocketMQ pays elsewhere, with random reads into the shared log when consumers are behind.

          ## Making RocketMQ fast

          - **Know what "broker busy" means.** The broker fails sends fast rather than queue them: «[PCBUSY_CLEAN_QUEUE]» when a write held the CommitLog lock longer than «osPageCacheBusyTimeOutMills» (1 s), usually a slow disk or page cache pressure; «[TIMEOUT_CLEAN_QUEUE]» when a send waited more than «waitTimeMillsInSendQueue» (200 ms) for a thread. Both come back to the producer as SYSTEM_BUSY. Look at disk latency and broker load before raising the timeouts.
          - **Durability costs latency.** SYNC_MASTER adds a replica round trip to every send; SYNC_FLUSH adds a disk sync (expect to wait up to «syncFlushTimeout», 5 s, when the disk is slow). Choose per cluster, deliberately.
          - **Consumers.** A 5.x push consumer runs the listener on «consumptionThreadCount» threads (20 by default) and caches messages locally; slow side effects are the bottleneck, as in Kafka. With message-level balancing you can add consumers past the queue count.
          - **Topics and tags.** Use tags for kinds within one business topic (the broker filters cheaply on the hash); SQL92 filters cost broker CPU per message.
          - **Keep consumers close to the tail.** Like Kafka, reading recent messages comes from the page cache; a group far behind turns into random disk reads into the CommitLog.

          @gaps 0

          @quiz 0
        `,
        quiz: [
          { q: 'Producers get SYSTEM_BUSY with «[PCBUSY_CLEAN_QUEUE]». What do you look at first?', options: ['Consumer lag', 'The broker\'s disk latency and page cache pressure', 'The NameServer', 'Message tags'], answer: 1, why: 'It means a write held the CommitLog lock longer than osPageCacheBusyTimeOutMills (1 s), so the broker sheds sends: usually a slow disk or memory pressure.' },
        ],
        defend: [
          {
            q: 'Should we use Kafka or RocketMQ for our new order platform?',
            weak: 'RocketMQ, because Alibaba benchmarks show it is much faster than Kafka with many topics.',
            whyWeak: 'One old vendor benchmark is not a reason. It ignores what the platform needs: replay, ecosystem, per-message retries, delays, transactional sends.',
            follow: [
              { q: 'What would make Kafka the better choice?', a: 'Long retention and replay (rebuild a service from history), compacted topics as tables, stream processing (Kafka Streams, Flink) and connectors, and a team that knows it.' },
              { q: 'What would make RocketMQ the better choice?', a: 'Many topics, per-message retries with back-off and dead letters out of the box, delayed delivery, transactional sends tied to the database, broker-side filtering.' },
              { q: 'How would you check the performance claim yourself?', a: 'Load-test the real shape: message size, topic and partition count, consumers caught up and behind, with the durability settings you would actually run (acks=all with min.insync=2, or SYNC_MASTER).' },
              { q: 'What do you have to configure in either for no data loss?', a: 'Kafka: RF 3, min.insync.replicas=2, acks=all. RocketMQ: SYNC_MASTER or controller mode with inSyncReplicas 2. Both default to faster, weaker settings.' },
            ],
            strong: [
              'Decide by needed properties, not by a benchmark.',
              'Kafka: replay, retention, compaction, ecosystem.',
              'RocketMQ: business messaging features in the broker; many topics.',
              'Benchmark your own workload with real durability settings.',
              'Both need explicit settings for no-loss.',
            ],
            flags: ['Quotes a vendor benchmark as settled', 'Ignores retention and replay needs', 'Assumes defaults are durable'],
          },
        ],
        gaps: [
          {
            title: 'A plan to move from Kafka to RocketMQ',
            intro: 'A team wrote this migration plan. Which steps carry a Kafka assumption that does not hold in RocketMQ, and which are right?',
            lang: 'text',
            code: R`
              1. Map each Kafka partition key to a RocketMQ message group, so per-key order is kept. ⟦ok1⟧
              2. Run 40 consumers on a topic with 8 queues; 5.x message-level balancing uses them all. ⟦ok2⟧
              3. When a bug is fixed, replay the last month from RocketMQ, as we do from Kafka. ⟦replay⟧
              4. Leave brokerRole at its default; acks=all safety comes with it. ⟦async⟧
              5. Billing and analytics share the consumer group "events", so both receive every message. ⟦group⟧
              6. Move the 7-day payment reminders to delay messages. ⟦delay⟧
              7. Delete our hand-written retry topics; use the built-in retries and %DLQ%. ⟦ok3⟧
            `,
            issues: [
              { id: 'replay', kind: 'loss', title: 'A month of replay on 72-hour retention', why: 'fileReservedTime is 72 hours by default and expired messages are deleted, consumed or not. Last month is gone.', fix: 'Keep a replayable archive elsewhere (or keep that topic in Kafka), or raise retention with the disk to match.' },
              { id: 'async', kind: 'loss', title: 'The default brokerRole is ASYNC_MASTER', why: 'Messages are acknowledged before a replica has them, so a master failure can lose acknowledged messages: nothing like acks=all with min.insync.replicas=2.', fix: 'SYNC_MASTER, or controller mode with inSyncReplicas 2.' },
              { id: 'group', kind: 'loss', title: 'One group for two services splits the messages between them', why: 'In clustering mode each message goes to one consumer of the group, so billing sees some messages and analytics the rest.', fix: 'One consumer group per service.' },
              { id: 'delay', kind: 'wrong', title: 'Seven days is beyond the delay limit', why: 'Delay messages are limited to about a day per the docs (3 days in the current broker setting).', fix: 'A table of due reminders and a scheduler.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Right: a message group is RocketMQ\'s unit of order, like a Kafka key.' },
              { id: 'ok2', why: 'Right for 5.x push and simple consumers, which balance per message.' },
              { id: 'ok3', why: 'Reasonable: built-in retries with back-off and per-group dead letters replace that code. Check the 16-retry schedule suits the downstream.' },
            ],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
