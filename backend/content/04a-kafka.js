(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'kafka', title: 'Kafka in depth', short: 'Kafka deep',
    blurb: 'How Kafka loses an acknowledged write, what makes a producer or consumer fast, why the broker is fast and what slows it, and how to tune by finding the bottleneck first. Facts checked against Apache Kafka 4.3.',
    intro: R`
      The Messaging module covered the model: partitions, offsets, consumer groups, rebalances, poison messages. This one goes underneath, in the order a record travels: the producer, the broker's replicas, the consumer. Each lesson ends with **Spot the gaps**: a real-looking config or snippet with problems in it, to train the eye you need in code review.
    `,
    items: [
      /* ───────────── 1. durability ───────────── */
      {
        lesson: 'kf-durability', title: 'How Kafka loses an acknowledged write', mins: 13,
        remember: 'An acknowledged write survives a broker failure only if it was already on another in-sync replica. acks=all with min.insync.replicas=2 on replication factor 3 guarantees that; every weaker setting has a window where one failure erases acknowledged data.',
        cue: '"we use acks=all, so we cannot lose data" → ask for min.insync.replicas, the replication factor, unclean election, and where the replicas physically are',
        body: R`
          ## The path of one write

          1. The producer sends a batch to the partition's **leader** broker.
          2. The leader appends it to its log. That means the operating system's page cache: Kafka does not fsync each write.
          3. **Followers** fetch from the leader, like consumers, and append to their own logs.
          4. The leader tracks the **in-sync replicas (ISR)**: itself plus every follower that has caught up recently. A follower that has not caught up for «replica.lag.time.max.ms» (30 s by default) is removed from the ISR.
          5. The **high-water mark** is the offset every in-sync replica has. Consumers read only up to it, so they never see a record that a leader change could take back.
          6. The leader answers the producer when «acks» is satisfied.

          ~~~mermaid How one write is replicated
          sequenceDiagram
            participant P as Producer
            participant L as Leader
            participant F1 as Follower 1
            participant F2 as Follower 2
            P->>L: produce batch
            L->>L: append (page cache)
            Note over L,P: acks=1 answers here
            F1->>L: fetch
            F2->>L: fetch
            L-->>F1: batch
            L-->>F2: batch
            Note over L: every ISR member has it, high-water mark moves
            L-->>P: acks=all answers here
          ~~~

          | «acks» | The producer hears back when | Lost if the leader dies right after |
          |---|---|---|
          | 0 | never: it does not wait | anything, and the producer cannot tell |
          | 1 | the leader has appended | records the followers had not fetched yet |
          | all (the default) | every replica **in the ISR** has it | nothing, as long as an in-sync replica survives |

          ## acks=all is only as strong as the ISR

          "All" means all *in-sync* replicas, and the ISR can shrink to the leader alone (slow disks, a network problem, a long GC pause). Then acks=all is acks=1.

          «min.insync.replicas» sets the floor. It defaults to **1**, so out of the box a shrunken ISR still accepts writes that live on one machine. With «min.insync.replicas=2», a write with acks=all is refused when fewer than two replicas are in sync: the producer gets «NotEnoughReplicasException», which is retriable. You trade availability for durability, explicitly.

          :::key The standard setting
          Replication factor 3, «min.insync.replicas=2», producer «acks=all». One broker can fail with no acknowledged write lost and writes still flowing. Two failures stop writes instead of losing data.
          :::

          ## Unclean leader election

          If every in-sync replica is gone, Kafka must choose: wait for one to come back (the partition is offline), or promote an out-of-sync follower and lose whatever it never received. «unclean.leader.election.enable» decides, and it defaults to **false**: wait.

          Kafka 4.1 enables **Eligible Leader Replicas** (KIP-966) by default on new clusters. The controller keeps track of replicas that left the ISR but are known to hold everything up to the high-water mark, so more failure sequences end in a clean election instead of that choice.

          @sim acks

          Try **Both followers drop out** with min.insync.replicas 1 and 2, then switch unclean election on.

          ## Kafka does not fsync each write

          The design relies on replication, not on the disk: by default a write sits in the page cache and the operating system flushes it later («log.flush.interval.messages» and «log.flush.interval.ms» are effectively off). A committed record is safe as long as one in-sync replica survives.

          The failure this does not cover is a **correlated** one: all replicas lose power together. Put replicas in different racks or zones: set «broker.rack» (unset by default) so Kafka spreads each partition's replicas across racks.

          ## The producer can lose data too

          - «send()» is asynchronous. If nobody checks the returned future or the callback's exception, a send that fails after «delivery.timeout.ms» (2 minutes) is dropped without a trace.
          - Producers retry by default and have idempotence on («enable.idempotence=true»), so a retry cannot duplicate a record or reorder a partition. Turning idempotence off brings both back.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A topic has replication factor 3 and the defaults. Both followers fall behind and leave the ISR. A producer with acks=all keeps writing. What protects those writes?', options: ['acks=all: they are on all replicas', 'Nothing: with min.insync.replicas=1 they live only on the leader', 'Unclean leader election', 'The page cache'], answer: 1, why: 'acks=all waits for the ISR, which is now the leader alone. min.insync.replicas=2 would have refused the writes instead.' },
          { q: 'You set min.insync.replicas=2 with replication factor 3. How many brokers can fail before writes with acks=all stop?', options: ['None', 'One fails and writes continue; a second stops them', 'Two', 'Three'], answer: 1, why: 'With one down, two replicas are still in sync. With two down, only one is left, below the floor, so writes are refused rather than risked.' },
        ],
        defend: [
          {
            q: 'How do you make sure Kafka never loses a message your service acknowledged to its caller?',
            weak: 'We set acks=all on the producer, so every message is written to all replicas before it is acknowledged.',
            whyWeak: 'acks=all waits for the in-sync replicas, not all replicas. With the default min.insync.replicas=1 the ISR can shrink to the leader, and then acks=all is acks=1.',
            follow: [
              { q: 'What exactly does acks=all wait for?', a: 'Every replica currently in the ISR. If the ISR has shrunk to the leader alone, that is one copy.' },
              { q: 'What setting closes that gap, and what does it cost?', a: 'min.insync.replicas=2 with replication factor 3. When fewer than two replicas are in sync, writes fail with NotEnoughReplicas: you lose availability on a double failure instead of losing data.' },
              { q: 'Does Kafka fsync before acknowledging?', a: 'No. Durability comes from replicas holding the data in their page caches. A power cut to all replicas at once can lose recent writes, so replicas go in different racks or zones (broker.rack).' },
              { q: 'What is unclean leader election, and how do you set it?', a: 'Promoting an out-of-sync replica when no in-sync one is left. It keeps the partition available and loses whatever that replica never got. Leave it off (the default) for data you cannot lose.' },
              { q: 'Where else can the message get lost before it reaches Kafka?', a: 'In the producer: send() is asynchronous, and if the callback or future is ignored, a send that fails after delivery.timeout.ms disappears silently. Your service must not acknowledge its caller until the send has succeeded.' },
            ],
            strong: [
              'acks=all means all in-sync replicas; the ISR can shrink.',
              'Replication factor 3, min.insync.replicas=2, acks=all: survives one failure without loss.',
              'Unclean election off for data you cannot lose; ELR (4.1+) reduces the cases where it matters.',
              'No fsync per write: spread replicas across racks or zones against correlated failures.',
              'Check send results before acknowledging upstream.',
            ],
            flags: ['Believes acks=all means every replica', 'Does not know min.insync.replicas or its default', 'Thinks Kafka fsyncs every message', 'Acknowledges upstream before the send completes'],
          },
        ],
        gaps: [
          {
            title: 'An orders topic that "cannot lose data"',
            intro: 'A team created this topic and producer for payment orders, which must never be lost or applied twice. Find what undermines that.',
            lang: 'properties',
            code: R`
              # topic: orders (created by a provisioning script)
              replication.factor=2 ⟦rf⟧
              min.insync.replicas=1 ⟦isr⟧
              unclean.leader.election.enable=true ⟦unclean⟧
              retention.ms=604800000 ⟦ok1⟧

              # producer
              acks=1 ⟦acks⟧
              enable.idempotence=false ⟦idem⟧
              max.in.flight.requests.per.connection=5 ⟦inflight⟧
              retries=2147483647 ⟦ok2⟧
              linger.ms=5 ⟦ok3⟧
            `,
            issues: [
              { id: 'rf', kind: 'loss', title: 'Replication factor 2 cannot keep two copies through a failure', why: 'With two replicas, one broker failure leaves a single copy. If you then require two in-sync replicas, any one failure stops writes; if you do not, writes run on one copy.', fix: '«replication.factor=3».' },
              { id: 'isr', kind: 'loss', title: 'min.insync.replicas=1 lets writes live on the leader alone', why: 'When the ISR shrinks to the leader, every acknowledged write is one broker failure away from gone.', fix: '«min.insync.replicas=2», with replication factor 3.' },
              { id: 'unclean', kind: 'loss', title: 'Unclean election throws away acknowledged writes', why: 'When no in-sync replica is left, a stale follower becomes leader and everything it never received is lost.', fix: 'Leave «unclean.leader.election.enable=false» (the default) for this data.' },
              { id: 'acks', kind: 'loss', title: 'acks=1 acknowledges before any follower has the record', why: 'The leader answers after its own append. If it dies before the followers fetch, those acknowledged records are gone, and min.insync.replicas does not apply to acks=1.', fix: '«acks=all» (the default since Kafka 3.0).' },
              { id: 'idem', kind: 'dupe', title: 'Idempotence off: retries can write a record twice', why: 'If a response is lost and the producer retries, the broker cannot tell the retry from a new record. Idempotence gives each batch a producer id and sequence number so the broker drops the repeat.', fix: 'Remove the line: «enable.idempotence=true» is the default.' },
              { id: 'inflight', kind: 'order', title: 'Five requests in flight without idempotence can reorder', why: 'If batch 1 fails and batch 2 succeeds, the retried batch 1 lands after batch 2. With idempotence on, the broker keeps order for up to 5 in flight.', fix: 'Turn idempotence back on, which keeps order with up to 5 in flight.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Seven days of retention is the default and fine; retention is about how long consumers can replay, not about durability.' },
              { id: 'ok2', why: 'Retrying "forever" is the default. The total time is bounded by «delivery.timeout.ms» (2 minutes), after which the send fails.' },
              { id: 'ok3', why: '5 ms is the default since Kafka 4.0 and costs no durability.' },
            ],
          },
        ],
      },

      /* ───────────── 2. producer throughput ───────────── */
      {
        lesson: 'kf-producer', title: 'Producer throughput: batching, compression and the send path', mins: 12,
        remember: 'A producer is fast when each request carries a lot: full batches, compressed. linger.ms and batch.size decide how full; a synchronous send per record, a producer per request, or blocking work in callbacks throw that away.',
        cue: 'a producer that cannot go faster than a few thousand records a second → look for send().get() per record, a new producer per call, linger.ms=0 or a tiny batch.size',
        body: R`
          ## What send() does

          1. The record is serialised, and the partitioner picks a partition: the hash of the key, or for records without a key, a "sticky" partition that changes every «batch.size» bytes.
          2. The record is appended to that partition's open **batch** in the producer's buffer («buffer.memory», 32 MB).
          3. «send()» returns a future at once. Nothing has been sent yet.
          4. A background **sender thread** collects batches that are full or have waited «linger.ms», and sends one request per broker carrying the ready batch of each of that broker's partitions.
          5. Up to «max.in.flight.requests.per.connection» (5) requests can be outstanding per broker.
          6. When a response arrives, the sender thread completes the futures and runs the callbacks.

          If the buffer is full because the brokers cannot keep up, «send()» **blocks** for up to «max.block.ms» (60 s), then throws.

          ## The three knobs

          | Setting | Default | What it does |
          |---|---|---|
          | «linger.ms» | 5 (0 before Kafka 4.0) | how long a batch may wait for more records |
          | «batch.size» | 16 KB | the most bytes in one partition's batch |
          | «compression.type» | none | lz4, zstd, snappy or gzip, applied to whole batches |

          Compression works on whole batches, so fuller batches compress better. The broker stores and replicates the batch compressed, and consumers decompress it: you save network, disk and replication bytes for some producer and consumer CPU.

          @sim batching

          It opens at 200,000 records a second with 16 KB batches, which cannot carry that load here. Switch to 64 KB, then compare linger 0 with 5 ms: fewer requests, lower latency. Then try 400,000 with and without zstd, and 1,000 with linger 100.

          :::note Why the default changed to 5 ms
          linger 0 still batches under load, because records pile up while earlier requests are in flight. But the batches are small and early, so the brokers handle many more requests for the same data. KIP-1030 changed the default to 5 ms because the extra wait is usually paid back by less loaded brokers.
          :::

          ## What quietly kills throughput

          - **A synchronous send per record**: «send(record).get()» waits for a round trip before the next record, so one record per request. Keep sends asynchronous and check the result in the callback.
          - **A producer per request**: a «KafkaProducer» is thread-safe and holds connections, metadata and buffers. Create one per application and share it.
          - **Blocking in a callback**: callbacks run on the sender thread. A database call there stalls every send of that producer.
          - **A tiny «batch.size»** for a busy partition, or records spread over so many partitions that no batch fills.
          - **Records larger than «max.request.size»** (1 MB), which fail outright.

          @gaps 0

          @quiz 0
        `,
        quiz: [
          { q: 'Which change most improves throughput of a producer that calls «send(record).get()» for each record?', options: ['A larger batch.size', 'Sending asynchronously and checking results in a callback', 'More partitions', 'acks=1'], answer: 1, why: 'With .get() after every send there is only ever one record in flight, so batches never form. Asynchronous sends let records batch.' },
        ],
        defend: [
          {
            q: 'Our producer tops out at about 3,000 messages a second and the brokers are idle. Where do you look?',
            weak: 'Kafka is slow with acks=all, so I would switch to acks=1 and add more partitions.',
            whyWeak: 'Idle brokers say the producer is not sending enough per request. acks=1 trades durability for a little latency and more partitions spread records thinner.',
            follow: [
              { q: 'What is the first thing you check in the code?', a: 'Whether it calls send().get() per record (one round trip per message), and whether it creates a producer per request. Both cap throughput regardless of settings.' },
              { q: 'Which metrics confirm small batches?', a: 'batch-size-avg and records-per-request-avg on the producer: a handful of records per request means batching is not happening.' },
              { q: 'What do linger.ms and batch.size trade?', a: 'A little latency per record for fuller batches: fewer requests, better compression, less broker load. Under load the wait is often paid back by a less busy broker.' },
              { q: 'When does compression help, and what does it cost?', a: 'When the network, disks or replication are the limit: zstd or lz4 on JSON often shrinks batches several times. It costs producer and consumer CPU, and needs batches with enough records to compress well.' },
              { q: 'What happens if the brokers really cannot keep up?', a: 'The producer buffer fills, send() blocks for max.block.ms and then throws. bufferpool-wait-ratio shows it starting.' },
            ],
            strong: [
              'Idle brokers point at the producer: small requests, not slow Kafka.',
              'No send().get() per record; one shared producer per application.',
              'linger.ms, batch.size and compression decide how much each request carries.',
              'Confirm with batch-size-avg, records-per-request-avg and record-queue-time-avg.',
              'No blocking work in callbacks: they run on the sender thread.',
            ],
            flags: ['Reaches for acks=1 first', 'Adds partitions to fix a producer bottleneck', 'Creates a producer per message', 'Thinks linger.ms always adds latency'],
          },
        ],
        gaps: [
          {
            title: 'A publisher that cannot keep up',
            intro: 'This service publishes order events. It manages about 2,000 a second and the brokers are nearly idle. Find what holds it back, and what else is wrong.',
            lang: 'java',
            code: R`
              Properties props = new Properties();
              props.put("bootstrap.servers", "kafka-1:9092,kafka-2:9092"); ⟦ok1⟧
              props.put("linger.ms", "0"); ⟦linger⟧
              props.put("batch.size", "1024"); ⟦batch⟧
              props.put("key.serializer", StringSerializer.class.getName());
              props.put("value.serializer", StringSerializer.class.getName());

              public void publish(List<Order> orders) throws Exception {
                  for (Order o : orders) {
                      try (Producer<String, String> producer = new KafkaProducer<>(props)) { ⟦newp⟧
                          var rec = new ProducerRecord<>("orders", o.id(), toJson(o)); ⟦ok2⟧
                          producer.send(rec, (meta, ex) -> {
                              if (ex != null) log.debug("send failed: {}", ex.getMessage()); ⟦swallow⟧
                              else auditRepo.save(o.id(), meta.offset()); ⟦blockcb⟧
                          }).get(); ⟦sync⟧
                      }
                  }
              }
            `,
            issues: [
              { id: 'newp', kind: 'slow', title: 'A new producer for every record', why: 'Each KafkaProducer opens connections, fetches metadata and allocates a 32 MB buffer, then closes. That dominates the cost of sending one record.', fix: 'One producer for the application, created once and shared (it is thread-safe).' },
              { id: 'sync', kind: 'slow', title: '.get() makes every send a full round trip', why: 'The loop waits for each record to be acknowledged before sending the next, so every request carries one record.', fix: 'Send without .get(), handle the result in the callback, and call flush() at the end if the batch must be complete before returning.' },
              { id: 'swallow', kind: 'loss', title: 'A failed send is logged at debug and dropped', why: 'After delivery.timeout.ms the send fails; this logs it where nobody looks and the order event is gone.', fix: 'Fail the operation or hand the record to a retry path, and log at error with the order id.' },
              { id: 'blockcb', kind: 'slow', title: 'A database write inside the callback', why: 'Callbacks run on the producer\'s single sender thread. A blocking call there delays every other send and response of this producer.', fix: 'Hand the work to another executor, or record offsets in bulk.' },
              { id: 'batch', kind: 'slow', title: 'batch.size of 1 KB holds about one record', why: 'A batch can never hold more than 1 KB, so requests stay tiny whatever linger.ms is.', fix: 'Keep the default 16 KB or raise it (64 KB or more for busy partitions).' },
              { id: 'linger', kind: 'slow', title: 'linger.ms=0 overrides the 5 ms default', why: 'Under load it sends small, early batches: more requests and worse compression for the same data.', fix: 'Remove it (5 ms is the default since 4.0) or set a few ms.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Bootstrap servers are only used to discover the cluster; two is fine.' },
              { id: 'ok2', why: 'Keying by order id keeps each order\'s events in one partition, in order. That is what you want.' },
            ],
          },
        ],
      },

      /* ───────────── 3. consumer throughput ───────────── */
      {
        lesson: 'kf-consumer', title: 'Consumer throughput, lag and the hot key', mins: 13,
        remember: 'A consumer is usually as fast as its slowest side effect: one database call per record caps it at a few hundred records a second. Batch the side effect or parallelise by key; and remember that one hot key is processed one record at a time, wherever it lands.',
        cue: 'lag that adding consumers does not fix → check whether one partition holds most of the lag (a hot key) and how many database calls each record costs',
        body: R`
          ## The poll loop

          1. «poll()» returns up to «max.poll.records» (500) records from the consumer's partitions.
          2. Fetches are shaped by «fetch.min.bytes» (1), «fetch.max.wait.ms» (500) and «max.partition.fetch.bytes» (1 MB).
          3. Your code processes the records, usually on the same thread.
          4. The next «poll()» must come within «max.poll.interval.ms» (5 minutes), or the consumer is removed from the group (the Messaging module).
          5. Offsets are committed, automatically every 5 s by default or by your code.

          So the ceiling of one consumer is *records per poll ÷ time per poll*, and time per poll is almost always the side effect: the database writes, the HTTP calls.

          ## Parallelism and partitions

          Within a group each partition has one reader, so consumers beyond the partition count sit idle. Choose the partition count for the throughput you need: if one consumer can do 2,000 records a second and you need 20,000 with headroom, that is at least 10 partitions, more for growth. Adding partitions later changes which partition each key hashes to, so per-key order is broken across the change.

          @sim lag

          Run it with 3 consumers in each mode, then switch the keys to **One key is 30%** and add consumers.

          ## Three ways to go faster

          - **Batch the side effect.** One multi-row upsert per poll instead of one round trip per record. This is usually the biggest win, and it handles hot keys too.
          - **Parallelise by key inside the consumer.** Records with different keys run side by side on worker threads; records with the same key stay in order on one worker. The Confluent Parallel Consumer does this. Commit only an offset whose record, and every record before it in the partition, is done.
          - **Fix the hot key.** A single key processed one at a time cannot go faster than one call per record, on any number of consumers. Split it (a sub-key, if strict order per key is not really needed), or aggregate its records before the expensive step.

          ## Measure lag in time, not records

          - On the client: «records-lag-max», the largest lag in records of any partition of this consumer.
          - From outside: «kafka-consumer-groups.sh --describe --group …» shows CURRENT-OFFSET, LOG-END-OFFSET and LAG per partition.
          - 10,000 records of lag is nothing at 50,000 a second and an hour at 3 a second. Alert on **time behind**: lag divided by the arrival rate, or now minus the timestamp of the last record processed.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Lag is growing on one partition only. You double the consumers. What happens?', options: ['Lag halves', 'Nothing much: one partition is still read by one consumer', 'Lag disappears', 'The partition splits'], answer: 1, why: 'A partition has one reader in a group. Lag concentrated on one partition is a hot key or a slow record, not a lack of consumers.' },
          { q: 'Each record costs one 5 ms database call, processed one at a time. What is the ceiling of one consumer?', options: ['About 200 records a second', 'About 5,000', '500, the max.poll.records', 'No ceiling'], answer: 0, why: '1,000 ms ÷ 5 ms = 200 a second, whatever the poll size. Batching the writes or parallelising raises it.' },
        ],
        defend: [
          {
            q: 'Consumer lag keeps growing. Walk me through how you would fix it.',
            weak: 'I would add more consumer instances until lag goes down, and increase max.poll.records so each poll gets more.',
            whyWeak: 'More consumers do nothing past the partition count or for a hot partition, and bigger polls do not help if each record costs a round trip. It never asks where the time goes.',
            follow: [
              { q: 'What do you look at first?', a: 'Lag per partition (kafka-consumer-groups --describe): spread evenly means the group is too slow overall; concentrated on one partition means a hot key or a stuck record.' },
              { q: 'The lag is even and processing does one DB call per record. Now what?', a: 'Batch the writes per poll (one multi-row upsert), or process records of different keys in parallel inside the consumer, committing only completed contiguous offsets.' },
              { q: 'The lag is on one partition, from one very busy key. Now what?', a: 'More consumers cannot help: that key is processed one at a time to keep its order. Batch its side effect, aggregate, or split the key if strict order is not required.' },
              { q: 'How do you alert on lag?', a: 'On time behind, not record count: lag divided by arrival rate, or the age of the last processed record. Record counts mean different things at different rates.' },
              { q: 'You want more partitions. What does that cost?', a: 'Keys move to different partitions, so per-key order breaks across the change; more files, replication work and rebalance time per broker.' },
            ],
            strong: [
              'Find where lag is: per partition, even or concentrated.',
              'Throughput is usually the side effect: batch it or parallelise by key.',
              'A hot key is processed serially; consumers cannot split it.',
              'Commit only contiguous completed offsets with parallel processing.',
              'Alert on time behind.',
            ],
            flags: ['Adds consumers past the partition count', 'Parallelises with no thought for per-key order', 'Commits offsets before processing finishes', 'Alerts on record counts only'],
          },
        ],
        gaps: [
          {
            title: 'A consumer made "fast" with a thread pool',
            intro: 'Someone sped up this consumer by handing records to a thread pool. It is fast now. Find what it broke.',
            lang: 'java',
            code: R`
              props.put("group.id", "inventory-updater");
              props.put("enable.auto.commit", "true"); ⟦auto⟧
              props.put("max.poll.records", "500"); ⟦ok1⟧
              ExecutorService pool = Executors.newFixedThreadPool(32); ⟦queue⟧

              consumer.subscribe(List.of("stock-changes"));
              while (running) {
                  var records = consumer.poll(Duration.ofMillis(100)); ⟦ok2⟧
                  for (var r : records) {
                      pool.submit(() -> stock.apply(r.key(), r.value())); ⟦unordered⟧
                  }
              }
            `,
            issues: [
              { id: 'auto', kind: 'loss', title: 'Auto-commit commits records that have not been processed', why: 'The next poll commits everything returned so far, including records still waiting in the pool. A crash loses them: their offsets are already committed.', fix: 'Commit manually, only up to the highest offset whose record and all records before it are done.' },
              { id: 'unordered', kind: 'order', title: 'Two changes for the same item can run at the same time', why: 'Records for one key go to any of 32 threads, so "set stock to 5" can finish after "set stock to 4" even though it came first.', fix: 'Route each key to one worker (a keyed executor), or use a library that does (the Confluent Parallel Consumer in key order mode).' },
              { id: 'queue', kind: 'stall', title: 'An unbounded queue behind the pool', why: 'newFixedThreadPool queues without limit, so the loop polls as fast as Kafka can deliver and the backlog grows in memory until the process runs out of heap.', fix: 'Bound the work in flight: pause() the partitions when too many records are pending and resume() as they drain.' },
            ],
            decoys: [
              { id: 'ok1', why: '500 is the default and fine; the pool, not the poll size, is the problem.' },
              { id: 'ok2', why: 'A short poll timeout is fine; poll returns as soon as records are available.' },
            ],
          },
        ],
      },

      /* ───────────── 4. why it is fast ───────────── */
      {
        lesson: 'kf-fast', title: 'Why Kafka is fast, and what quietly slows it', mins: 10,
        remember: 'Kafka is fast because it appends sequentially, serves recent data from the page cache, copies it to the network without touching it, and keeps batches intact end to end. Anything that breaks one of those (cold reads, TLS, recompression, tiny batches, a slow follower) costs throughput.',
        cue: 'broker CPU or disk reads jump while traffic is flat → look for a consumer replaying old data, a recompressing topic codec, TLS added, or a slow follower under acks=all',
        body: R`
          ## Four reasons

          1. **Sequential appends.** Each partition is a series of segment files (1 GB each by default), only ever appended to.
          2. **The page cache.** The broker writes to the operating system's cache and lets it flush. Consumers near the end of the log read what was just written, from memory: the Kafka docs note that caught-up consumers cause no disk reads at all.
          3. **Zero-copy.** For a fetch, the broker asks the kernel to send file data straight from the page cache to the socket («sendfile»), without copying it through the application.
          4. **Batches end to end.** The producer's compressed batch is stored and sent to consumers as it is; the broker does not unpack it.

          ## What slows it

          | Cause | What breaks | What to do |
          |---|---|---|
          | A consumer replaying old data | reads come from disk and push out the pages tail readers need | throttle the replay, or move old data to tiered storage (production-ready since Kafka 3.9) |
          | TLS on the listener | zero-copy: «sendfile is not used when SSL is enabled», since encryption happens in user space | budget broker CPU for TLS; it is usually still required |
          | A topic «compression.type» that differs from the producer's | the stored codec is the topic's, so the broker has to recompress | keep the default «producer», which keeps the producer's codec |
          | Tiny batches | per-request cost dominates | the producer lesson |
          | A slow follower with acks=all | produce waits for it until it leaves the ISR after «replica.lag.time.max.ms» (30 s) | find the slow disk; watch «UnderReplicatedPartitions» |
          | Many partitions per broker | open files, replication fetch work and recovery time per partition | size partitions for throughput, not "just in case" |

          Kafka 4.0 removed the old message formats and down-conversion for clients older than 2.1, which used to cost broker CPU when old consumers fetched new data.

          ## Compacted topics

          With «cleanup.policy=compact», Kafka keeps at least the latest record for each key instead of deleting by age: a table of current values, replayable from the start. A record with a null value is a **tombstone**: it deletes the key, and is itself removed after «delete.retention.ms» (1 day). A consumer that falls further behind than that can miss the delete and keep a stale value.

          @gaps 0

          @quiz 0
        `,
        quiz: [
          { q: 'Since a nightly job started re-reading a week of data, daytime consumers got slower too. Why?', options: ['The job holds locks', 'Its reads come from disk and evict the page cache the live consumers were reading from', 'It rebalances the group', 'It changes the high-water mark'], answer: 1, why: 'Tail reads are served from memory. Reading old segments pulls them into the cache and pushes out recent data, so everyone hits the disk.' },
        ],
        defend: [
          {
            q: 'Why is Kafka so fast, and when is it not?',
            weak: 'Kafka keeps everything in memory and uses partitions to scale horizontally.',
            whyWeak: 'Kafka writes everything to disk; it relies on the page cache, sequential I/O and zero-copy. And it says nothing about what slows it down.',
            follow: [
              { q: 'Where do reads usually come from?', a: 'The page cache: consumers near the end of the log read data that was just written, without touching the disk.' },
              { q: 'What is zero-copy, and when do you lose it?', a: 'The broker uses sendfile to move file data from the page cache to the socket inside the kernel. With TLS it cannot, because encryption happens in user space.' },
              { q: 'A consumer starts replaying a month of data. What happens to everyone else?', a: 'Its reads hit the disk and evict recent data from the cache, so live consumers start reading from disk too. Throttle it, or use tiered storage for old data.' },
              { q: 'Why does a slow follower slow producers?', a: 'With acks=all, the leader waits for every in-sync replica. A slow follower delays every produce until it falls out of the ISR after replica.lag.time.max.ms.' },
            ],
            strong: [
              'Sequential appends, page cache reads, zero-copy, batches kept intact.',
              'Cold reads evict the cache for everyone.',
              'TLS disables zero-copy; recompression and tiny batches cost CPU and requests.',
              'A slow follower slows acks=all produces until it leaves the ISR.',
            ],
            flags: ['Says Kafka is in-memory', 'Does not know about the page cache', 'Blames partition count for everything'],
          },
        ],
        gaps: [
          {
            title: 'A broker "tuned for safety"',
            intro: 'After a scare, someone changed these broker and topic settings. Produce latency tripled and broker CPU went up. Find out why.',
            lang: 'properties',
            code: R`
              # broker
              listeners=SSL://0.0.0.0:9093 ⟦ok1⟧
              log.flush.interval.messages=1 ⟦fsync⟧
              replica.lag.time.max.ms=600000 ⟦lagmax⟧

              # topic: clicks (producers send zstd)
              compression.type=gzip ⟦recompress⟧
              cleanup.policy=delete ⟦ok2⟧
            `,
            issues: [
              { id: 'fsync', kind: 'slow', title: 'An fsync after every message', why: 'Forcing a flush per message turns cheap page-cache appends into a disk sync each, and buys little: Kafka\'s durability comes from replicas, not fsync.', fix: 'Remove it; rely on replication with min.insync.replicas=2 and replicas in different racks.' },
              { id: 'lagmax', kind: 'stall', title: 'A slow follower stays in sync for 10 minutes', why: 'With acks=all every produce waits for every in-sync replica. A sick follower now stalls writes for up to 10 minutes before it is dropped.', fix: 'Keep the default 30 s.' },
              { id: 'recompress', kind: 'slow', title: 'The topic codec differs from the producers\'', why: 'The topic\'s compression.type is the stored codec, so every zstd batch has to be recompressed as gzip on the broker: CPU on every write.', fix: '«compression.type=producer» (the default), or match the producers.' },
            ],
            decoys: [
              { id: 'ok1', why: 'TLS costs zero-copy and some CPU, but encryption in transit is usually required. It is a cost to budget for, not a mistake.' },
              { id: 'ok2', why: 'Deleting by age is the default and right for a click stream.' },
            ],
          },
        ],
      },

      /* ───────────── 5. tuning ───────────── */
      {
        lesson: 'kf-tune', title: 'Tuning Kafka: find the bottleneck before turning knobs', mins: 12,
        remember: 'Decide what you are optimising (throughput, latency or durability), measure where the time goes with the client and broker metrics, then change the one setting that addresses it. Knob-turning without that is how durability gets traded away by accident.',
        cue: '"we raised the thread counts and it did not help" → split the request time into queue, local, remote and send, and look at the producer\'s batch metrics',
        body: R`
          ## Pick the goal

          | Goal | Lean towards | Gives up |
          |---|---|---|
          | Throughput | bigger «batch.size», a few ms of «linger.ms», lz4 or zstd, batched side effects | a few ms of latency |
          | Latency | small linger, fewer hops, consumers caught up (page cache) | some efficiency |
          | Durability | «acks=all», RF 3, «min.insync.replicas=2», racks | availability on double failures, a little latency |

          ## Measure first

          Load-test with the tools that ship with Kafka: «kafka-producer-perf-test.sh» (records, record size, target throughput, any producer settings) and «kafka-consumer-perf-test.sh». Then read the metrics.

          **Producer**

          | Metric | High or low means |
          |---|---|
          | «record-queue-time-avg» | records wait long in the buffer: linger, or the brokers are slow to answer |
          | «batch-size-avg», «records-per-request-avg» | low: batching is not happening |
          | «request-latency-avg» | the broker side is slow: go to the broker metrics |
          | «bufferpool-wait-ratio» | above zero: the buffer is full and send() is blocking |
          | «record-retry-rate», «record-error-rate» | retries and failures; errors are lost data unless handled |
          | «produce-throttle-time-avg» | a quota is slowing you down |

          **Broker: where a produce request spends its time** («RequestMetrics», «TotalTimeMs» split into four)

          | Part | Waiting for | If it dominates |
          |---|---|---|
          | «RequestQueueTimeMs» | a request handler thread | handlers are busy: «RequestHandlerAvgIdlePercent» low |
          | «LocalTimeMs» | the leader's own append | the leader's disk or CPU |
          | «RemoteTimeMs» | followers, for acks=all | a slow follower: «UnderReplicatedPartitions» |
          | «ResponseSendTimeMs» | the network | network threads («NetworkProcessorAvgIdlePercent») or bandwidth |

          Keep «UnderReplicatedPartitions» and «UnderMinIsrPartitionCount» at zero, and alert when they are not.

          **Consumer**: «records-lag-max», «records-consumed-rate», «fetch-latency-avg», «fetch-size-avg», plus your own timing of the processing step, which is usually the real answer.

          ## Symptom to setting

          | You see | Likely | Change |
          |---|---|---|
          | Small batches, brokers busy with requests | linger 0, tiny batch.size, sync sends | batching settings; async sends |
          | Remote time dominates produce latency | a slow follower | fix that broker; do not drop to acks=1 |
          | Queue time dominates | handler threads saturated | more brokers or fewer, bigger requests before more threads |
          | Lag on one partition | hot key | the consumer lesson |
          | Lag everywhere, consumers busy | per-record side effects | batch them |
          | Broker disk reads with caught-up consumers | a replaying consumer | throttle it, tiered storage |

          @gaps 0

          @quiz 0
        `,
        quiz: [
          { q: 'Produce p99 went from 8 ms to 400 ms. RequestMetrics shows RemoteTimeMs is 380 ms of it. What do you look at?', options: ['Request handler threads', 'The followers: one is slow to replicate', 'The producer\'s linger.ms', 'Consumer lag'], answer: 1, why: 'Remote time is the leader waiting for in-sync followers (acks=all). Look for a slow broker disk and under-replicated partitions.' },
        ],
        defend: [
          {
            q: 'Kafka produce latency doubled after traffic grew. How do you approach it?',
            weak: 'I would increase num.io.threads and num.network.threads, and set acks=1 to reduce latency.',
            whyWeak: 'It changes knobs before knowing where the time goes, and acks=1 quietly trades away durability.',
            follow: [
              { q: 'What do you measure first?', a: 'The broker\'s produce request time split into queue, local, remote and send time, and the producer\'s batch-size-avg, records-per-request-avg and record-queue-time-avg.' },
              { q: 'Remote time dominates. What does that mean?', a: 'The leader is waiting for followers to replicate: a slow follower, often a disk. UnderReplicatedPartitions will show it.' },
              { q: 'Queue time dominates. What then?', a: 'Requests wait for a handler thread: the broker is saturated with requests. First make requests bigger (batching), then add brokers; more threads only help if CPU is spare.' },
              { q: 'Why not just set acks=1?', a: 'It hides the slow follower and turns every leader failure into lost acknowledged writes. Fix the cause instead.' },
            ],
            strong: [
              'State the goal: throughput, latency or durability.',
              'Measure with perf-test tools and metrics before changing anything.',
              'Split request time into queue, local, remote and send.',
              'Change the setting that addresses the dominant part; never trade durability by accident.',
            ],
            flags: ['Changes several knobs at once', 'Uses acks=1 as a performance fix', 'Does not know where request time goes'],
          },
        ],
        gaps: [
          {
            title: 'A tuning plan',
            intro: 'Produce p99 jumped from 8 ms to 400 ms after traffic doubled. An engineer wrote this plan. Which steps are wrong, and which are right?',
            lang: 'text',
            code: R`
              1. Raise num.io.threads and num.network.threads on every broker, and see. ⟦blind⟧
              2. Set acks=1 on the producers to take replication out of the path. ⟦acks1⟧
              3. Add 20 partitions to the topic to spread the load. ⟦parts⟧
              4. Check RequestMetrics for Produce: which part of TotalTimeMs grew? ⟦ok1⟧
              5. Check UnderReplicatedPartitions and each follower's disk latency. ⟦ok2⟧
              6. Run kafka-producer-perf-test.sh before and after any change. ⟦ok3⟧
            `,
            issues: [
              { id: 'blind', kind: 'ops', title: 'Turning knobs before finding the bottleneck', why: 'More threads help only if requests are waiting for threads and CPU is spare. Without the metrics this is a guess, and it changes two things at once.', fix: 'Measure first (steps 4 and 5), then change one thing.' },
              { id: 'acks1', kind: 'loss', title: 'acks=1 as a latency fix', why: 'It hides a slow follower by no longer waiting for it, and every leader failure now loses acknowledged writes.', fix: 'Find and fix the slow follower; keep acks=all.' },
              { id: 'parts', kind: 'order', title: 'Adding partitions to a keyed topic', why: 'Keys hash to new partitions, so events for one key can be processed out of order across the change, and it does nothing for a slow follower.', fix: 'Only add partitions for a throughput need, planned around key ordering.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Right first step: it says whether the time is queueing, the leader, the followers or the network.' },
              { id: 'ok2', why: 'Right: remote time growing usually means a slow follower.' },
              { id: 'ok3', why: 'Right: a repeatable load test is how you know a change helped.' },
            ],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
