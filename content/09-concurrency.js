(function (root) {
  const L = root.LLD, J = L.J;

  // Shared test helper: run tasks on daemon threads that all start together, wait with a timeout.
  const RACE = J`
    static boolean runTogether(List<Runnable> tasks, long timeoutMillis) throws InterruptedException {
        CountDownLatch go = new CountDownLatch(1);
        List<Thread> threads = new ArrayList<>();
        for (Runnable t : tasks) {
            Thread th = new Thread(() -> { try { go.await(); t.run(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } });
            th.setDaemon(true);
            threads.add(th);
            th.start();
        }
        go.countDown();
        long deadline = System.currentTimeMillis() + timeoutMillis;
        for (Thread th : threads) { th.join(Math.max(1, deadline - System.currentTimeMillis())); if (th.isAlive()) return false; }
        return true;
    }
`;

  L.module({
    id: 'concurrency', title: 'Concurrency inside a design', short: 'Concurrency',
    blurb: 'The thread-safety questions every LLD round ends with: races, locks, deadlocks and queues. Exercises run on your JDK.',
    intro: J`
      :::remember The one question to ask of every design
      **"What if two threads do this at the same moment?"** Book the last seat, take the last item, park in the last spot. If the answer is "both succeed", there is a race.
      :::

      :::warn These exercises need your JDK
      The in-browser engine has no threads. Start the runner (<code>node runner/server.mjs</code>) and pick **Your JDK** in the code panel. The lessons work anywhere.
      :::
    `,
    items: [
      {
        lesson: 'races', title: 'Check-then-act: the race in every design', mins: 7,
        remember: 'Any "check, then act" on shared state is a race unless the check and the act happen as one atomic step.',
        cue: 'Two users can act on the same thing at the same moment (last seat, last item, one spot) → make the check-and-act one atomic step',
        body: J`
          ## The bug, in slow motion

          ~~~java
          boolean book(int seat, String user) {
              if (holders.get(seat) == null) {    // check
                  holders.put(seat, user);        // act
                  return true;
              }
              return false;
          }
          ~~~

          ~~~seq Two people, one seat
          actors: Asha's thread, holders map, Ravi's thread
          Asha's thread -> holders map: get(7)
          holders map --> Asha's thread: null (free)
          Ravi's thread -> holders map: get(7)
          holders map --> Ravi's thread: null (still free!)
          note: Ravi checked before Asha wrote. Both saw a free seat.
          Asha's thread -> holders map: put(7, Asha)
          Ravi's thread -> holders map: put(7, Ravi)
          note: Both were told "booked". Ravi silently overwrote Asha.
          ~~~

          The same shape hides in «count++» (read, add, write) and "if stock > 0 then stock--".

          @stop

          ## Three ways to make it atomic

          | Tool | Use it for | Example |
          |---|---|---|
          | An atomic operation | one key or one number | «holders.putIfAbsent(seat, user) == null», «counter.incrementAndGet()» |
          | «ConcurrentHashMap.compute» | read-modify-write of one entry | «stock.compute(sku, (k, n) -> n > 0 ? n - 1 : n)» |
          | A lock («synchronized») | several things that must change together | move a seat from "held" to "booked" *and* charge the hold |

          Prefer the smallest tool that covers the whole invariant. «putIfAbsent» is one atomic step inside «ConcurrentHashMap»: no lock in your code at all.

          :::key Visibility, in one sentence
          Without «synchronized», «volatile» or an atomic/concurrent class, one thread may never *see* another thread's write. Every tool in the table above also handles visibility.
          :::

          :::interview Say it like this
          "Booking is a check-then-act, so it has to be atomic: I use «putIfAbsent» on a «ConcurrentHashMap», so exactly one caller wins the seat without a global lock."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Is «if (!map.containsKey(k)) map.put(k, v);» safe on a «ConcurrentHashMap»?',
            options: ['Yes: ConcurrentHashMap is thread-safe', 'No: each call is atomic, but the pair is not. Use putIfAbsent', 'Only with volatile', 'Only for Integer keys'],
            answer: 1,
            why: 'A thread-safe map makes each *single* call atomic. Two calls in a row can still interleave with another thread. The combined operation («putIfAbsent», «computeIfAbsent») is what you need.',
          },
        ],
      },
      {
        exercise: {
          id: 'seat-booking', title: 'Book a seat, exactly once', kind: 'build', mins: 10, diff: 'medium', patterns: [], jdk: true,
          statement: J`
            Make «SeatBooking» safe when many threads book at once.

            - Seats are numbered 1 to «seats». A seat outside that range: «IllegalArgumentException».
            - «book(seat, user)» returns «true» if this call booked the seat, «false» if it was already taken. When 32 threads race for one seat, **exactly one** must get «true», and the holder must be that one.
            - «holder(seat)» returns who holds it (empty if free). «bookedCount()» counts booked seats.
          `,
          starter: J`
class SeatBooking {
    SeatBooking(int seats) {
    }

    boolean book(int seat, String user) {
        return false; // TODO
    }

    Optional<String> holder(int seat) {
        return Optional.empty(); // TODO
    }

    int bookedCount() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'Book a seat and look it up', ex: true, code: J`
              SeatBooking b = new SeatBooking(10);
              ok(b.book(7, "asha"), "first booking");
              eq(Optional.of("asha"), b.holder(7), "holder");
              eq(Optional.empty(), b.holder(8), "free seat");` },
            { name: 'A taken seat stays taken', ex: true, code: J`
              SeatBooking b = new SeatBooking(10);
              b.book(7, "asha");
              no(b.book(7, "ravi"), "second booking");
              eq(Optional.of("asha"), b.holder(7), "holder");` },
            { name: 'Seat numbers are checked', ex: true, code: J`
              SeatBooking b = new SeatBooking(10);
              throwsA(IllegalArgumentException.class, () -> b.book(0, "x"), "seat 0");
              throwsA(IllegalArgumentException.class, () -> b.book(11, "x"), "seat 11");` },
            { name: '32 threads race for one seat, 200 times: exactly one wins each time', code: J`
              for (int round = 0; round < 200; round++) {
                  SeatBooking b = new SeatBooking(10);
                  AtomicInteger wins = new AtomicInteger();
                  String[] winner = new String[1];
                  List<Runnable> tasks = new ArrayList<>();
                  for (int t = 0; t < 32; t++) {
                      String user = "u" + t;
                      tasks.add(() -> { if (b.book(7, user)) { wins.incrementAndGet(); winner[0] = user; } });
                  }
                  ok(runTogether(tasks, 5000), "threads finished");
                  eq(1, wins.get(), "winners in round " + round);
                  eq(Optional.of(winner[0]), b.holder(7), "the holder is the winner, round " + round);
              }` },
            { name: '100 threads book 100 different seats', code: J`
              SeatBooking b = new SeatBooking(100);
              List<Runnable> tasks = new ArrayList<>();
              for (int s = 1; s <= 100; s++) { int seat = s; tasks.add(() -> b.book(seat, "u" + seat)); }
              ok(runTogether(tasks, 5000), "threads finished");
              eq(100, b.bookedCount(), "booked");
              eq(Optional.of("u42"), b.holder(42), "seat 42");` },
          ],
          helpers: RACE,
          lint: [
            { re: '\\.get\\([^)]*\\)\\s*==\\s*null[\\s\\S]{0,120}\\.put\\(|containsKey\\([^)]*\\)[\\s\\S]{0,120}\\.put\\(', note: 'A check followed by a separate put: another thread can slip in between. Use one atomic call such as «putIfAbsent».' },
          ],
          rubric: J`
            - Booking is one atomic step («putIfAbsent» on a «ConcurrentHashMap», or a lock around check and act).
            - No global lock where a per-key atomic operation is enough.
            - Validation happens before touching shared state.
          `,
          hints: ['«ConcurrentHashMap<Integer, String>» and «return holders.putIfAbsent(seat, user) == null;». It returns the previous value, which is «null» only for the thread that won.'],
          solution: {
            pattern: 'An atomic check-and-act: putIfAbsent on a ConcurrentHashMap.',
            java: J`
class SeatBooking {
    private final int seats;
    private final ConcurrentHashMap<Integer, String> holders = new ConcurrentHashMap<>();

    SeatBooking(int seats) {
        this.seats = seats;
    }

    boolean book(int seat, String user) {
        if (seat < 1 || seat > seats) throw new IllegalArgumentException("no seat " + seat);
        return holders.putIfAbsent(seat, user) == null;
    }

    Optional<String> holder(int seat) {
        return Optional.ofNullable(holders.get(seat));
    }

    int bookedCount() {
        return holders.size();
    }
}
`,
            followups: J`
              - **"Book several seats, all or nothing."** One key is no longer enough: lock the show (or the seats in a fixed order), check all, then book all.
              - **"Hold seats for 10 minutes before payment."** The value becomes a hold with an expiry, and an expired hold can be taken over with «compute».
            `,
            talk: 'Booking a seat is a check-then-act, so I make it one atomic step with putIfAbsent on a ConcurrentHashMap: the return value is null only for the single thread that won, with no global lock.',
          },
          wrong: [
            { name: 'check, then put', java: J`
class SeatBooking {
    private final int n; private final Map<Integer, String> h = new ConcurrentHashMap<>();
    SeatBooking(int n) { this.n = n; }
    boolean book(int seat, String user) {
        if (seat < 1 || seat > n) throw new IllegalArgumentException();
        if (h.get(seat) == null) { Thread.yield(); h.put(seat, user); return true; }
        return false;
    }
    Optional<String> holder(int seat) { return Optional.ofNullable(h.get(seat)); }
    int bookedCount() { return h.size(); }
}
` },
          ],
        },
      },
      {
        lesson: 'locks', title: 'Locks: how big, how long, and in what order', mins: 7,
        remember: 'Lock as little as possible for as short as possible, and when you need two locks, always take them in one global order.',
        cue: 'One operation needs two locks (a transfer between two accounts) → take them in a fixed order, such as by id, to avoid deadlock',
        body: J`
          ## Granularity

          | Choice | Pros | Cons |
          |---|---|---|
          | One lock for everything | simple, obviously correct | every thread waits for every other |
          | A lock per entity (account, seat, spot) | unrelated work runs in parallel | operations on two entities need two locks |
          | Lock striping (N locks, pick by hash) | bounded number of locks | more complex; what «ConcurrentHashMap» does inside |

          Start with one lock and say why it is enough; move to per-entity locks when the interviewer asks about scale.

          ## Deadlock: two locks, opposite order

          ~~~seq Two transfers, opposite directions
          actors: Thread 1, Account A, Account B, Thread 2
          Thread 1 -> Account A: lock A (for A → B)
          Thread 2 -> Account B: lock B (for B → A)
          Thread 1 -> Account B: lock B ... waits
          Thread 2 -> Account A: lock A ... waits
          note: Each holds what the other needs. Neither will ever continue.
          ~~~

          **The fix:** a global order. Always lock the account with the smaller id first, whichever direction the money moves. Then the cycle cannot form.

          @stop

          ## Other tools worth naming

          - «ReentrantLock.tryLock(timeout)»: give up instead of waiting forever. Useful when you cannot impose an order.
          - «ReadWriteLock»: many readers at once, writers alone. For read-heavy data like a config or a price list.
          - **Keep the critical section short.** Never call a network service or do I/O while holding a lock.

          :::interview Say it like this
          "Each account has its own lock so unrelated transfers run in parallel. A transfer takes both locks in account-id order, which rules out deadlock, and checks the balance while holding them."
          :::
        `,
      },
      {
        exercise: {
          id: 'bank-transfer', title: 'Transfers without deadlock', kind: 'build', mins: 14, diff: 'hard', patterns: [], jdk: true,
          statement: J`
            Make «Bank» safe for concurrent transfers, **without** one lock for the whole bank.

            - Accounts are numbered from 0; each starts with «initialEach».
            - «transfer(from, to, amount)»: moves the money and returns «true», or returns «false» (changing nothing) if «from» has too little. Bad account numbers, «from == to», or an amount of zero or less: «IllegalArgumentException».
            - Under load, money is never created or lost, balances never go negative, and **no deadlock**, even with transfers in both directions at once.
            - «balance(id)» and «total()» report balances (tests call «total()» only when threads have finished).
          `,
          starter: J`
class Bank {
    Bank(int accounts, long initialEach) {
    }

    boolean transfer(int from, int to, long amount) {
        return false; // TODO
    }

    long balance(int id) {
        return 0; // TODO
    }

    long total() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'A transfer moves money', ex: true, code: J`
              Bank b = new Bank(2, 100);
              ok(b.transfer(0, 1, 30), "transfer");
              eq(70L, b.balance(0), "from");
              eq(130L, b.balance(1), "to");` },
            { name: 'Too little money: refused, nothing changes', ex: true, code: J`
              Bank b = new Bank(2, 100);
              no(b.transfer(0, 1, 101), "transfer");
              eq(100L, b.balance(0), "from");
              eq(100L, b.balance(1), "to");` },
            { name: 'Bad transfers are rejected', ex: true, code: J`
              Bank b = new Bank(2, 100);
              throwsA(IllegalArgumentException.class, () -> b.transfer(0, 0, 1), "to itself");
              throwsA(IllegalArgumentException.class, () -> b.transfer(0, 5, 1), "no account 5");
              throwsA(IllegalArgumentException.class, () -> b.transfer(0, 1, 0), "zero");` },
            { name: 'Opposite transfers at once do not deadlock', code: J`
              Bank b = new Bank(2, 1_000_000);
              List<Runnable> tasks = new ArrayList<>();
              for (int t = 0; t < 8; t++) {
                  boolean forward = t % 2 == 0;
                  tasks.add(() -> { for (int i = 0; i < 20_000; i++) { if (forward) b.transfer(0, 1, 1); else b.transfer(1, 0, 1); } });
              }
              ok(runTogether(tasks, 15_000), "all transfers finished within 15 s (a deadlock would hang here)");
              eq(2_000_000L, b.total(), "total");` },
            { name: 'Money is conserved under load', code: J`
              Bank b = new Bank(5, 1000);
              List<Runnable> tasks = new ArrayList<>();
              for (int t = 0; t < 8; t++) {
                  int seed = t;
                  tasks.add(() -> { Random r = new Random(seed); for (int i = 0; i < 5000; i++) { int f = r.nextInt(5), to = (f + 1 + r.nextInt(4)) % 5; b.transfer(f, to, 1 + r.nextInt(50)); } });
              }
              ok(runTogether(tasks, 15_000), "finished");
              eq(5000L, b.total(), "total");
              for (int i = 0; i < 5; i++) ok(b.balance(i) >= 0, "account " + i + " is not negative");` },
          ],
          helpers: RACE,
          lint: [
            { re: 'synchronized\\s*\\(\\s*(accounts?\\[\\s*from|from\\w*)\\s*\\)\\s*\\{\\s*synchronized\\s*\\(\\s*(accounts?\\[\\s*to|to\\w*)', note: 'Locks «from» then «to». Two opposite transfers take the same two locks in opposite orders: a deadlock. Order the locks by account id.' },
            { re: 'synchronized\\s+boolean\\s+transfer', note: 'A synchronized «transfer» is one lock for the whole bank: correct, but every transfer waits for every other. The exercise asks for per-account locks.' },
          ],
          rubric: J`
            - One lock per account; a transfer takes both locks in a fixed order (by id).
            - The balance check and both updates happen while holding both locks.
            - Validation happens before any locking.
          `,
          hints: [
            'Give each account its own lock object (or make the account object the lock).',
            '«Object first = from < to ? lock[from] : lock[to], second = ...;» then «synchronized (first) { synchronized (second) { ... } }».',
          ],
          solution: {
            pattern: 'Per-entity locks with a global lock order.',
            java: J`
class Bank {
    private final long[] balances;
    private final Object[] locks;

    Bank(int accounts, long initialEach) {
        balances = new long[accounts];
        locks = new Object[accounts];
        for (int i = 0; i < accounts; i++) {
            balances[i] = initialEach;
            locks[i] = new Object();
        }
    }

    boolean transfer(int from, int to, long amount) {
        if (from < 0 || to < 0 || from >= balances.length || to >= balances.length) throw new IllegalArgumentException("no such account");
        if (from == to) throw new IllegalArgumentException("cannot transfer to the same account");
        if (amount <= 0) throw new IllegalArgumentException("amount must be positive");
        Object first = locks[Math.min(from, to)], second = locks[Math.max(from, to)];
        synchronized (first) {
            synchronized (second) {
                if (balances[from] < amount) return false;
                balances[from] -= amount;
                balances[to] += amount;
                return true;
            }
        }
    }

    long balance(int id) {
        synchronized (locks[id]) {
            return balances[id];
        }
    }

    long total() {
        long sum = 0;
        for (int i = 0; i < balances.length; i++) sum += balance(i);
        return sum;
    }
}
`,
            why: J`
              Locking the lower id first means every thread acquires any pair of locks in the same order, so a cycle of waiting threads cannot form. Reads take the account's lock too, so they see the latest write (visibility), not just a consistent value.
            `,
            followups: J`
              - **"A consistent total while transfers run."** Lock all accounts in id order (expensive), or keep an append-only ledger and sum it.
              - **"Transfers across two banks."** Locks no longer help across machines: that becomes a saga with compensation, or two-phase commit.
            `,
            talk: 'Each account has its own lock, so unrelated transfers run in parallel. A transfer locks both accounts in id order, which makes deadlock impossible, and checks and updates both balances while holding them.',
          },
          wrong: [
            { name: 'locks from, then to', java: J`
class Bank {
    private final long[] bal; private final Object[] lk;
    Bank(int n, long each) { bal = new long[n]; lk = new Object[n]; for (int i = 0; i < n; i++) { bal[i] = each; lk[i] = new Object(); } }
    boolean transfer(int from, int to, long amount) {
        if (from < 0 || to < 0 || from >= bal.length || to >= bal.length || from == to || amount <= 0) throw new IllegalArgumentException();
        synchronized (lk[from]) { Thread.yield(); synchronized (lk[to]) { if (bal[from] < amount) return false; bal[from] -= amount; bal[to] += amount; return true; } }
    }
    long balance(int id) { synchronized (lk[id]) { return bal[id]; } }
    long total() { long s = 0; for (int i = 0; i < bal.length; i++) s += balance(i); return s; }
}
` },
          ],
        },
      },
      {
        lesson: 'queues', title: 'Queues between threads', mins: 6,
        remember: 'Hand work between threads through a bounded BlockingQueue: it gives you thread safety and backpressure in one class.',
        cue: 'Work arrives faster than it is processed, or producers and consumers are different threads → a bounded BlockingQueue',
        body: J`
          ## Producer, queue, consumer

          ~~~seq A bounded queue in action
          actors: Producer, Queue (capacity 2), Consumer
          Producer -> Queue (capacity 2): put(job1)
          Producer -> Queue (capacity 2): put(job2)
          Producer -> Queue (capacity 2): put(job3) ... blocks: full
          note: The producer waits instead of piling up memory. That is backpressure.
          Consumer -> Queue (capacity 2): take()
          Queue (capacity 2) --> Consumer: job1
          note: A slot frees up, so the producer's put(job3) completes.
          ~~~

          «ArrayBlockingQueue» and «LinkedBlockingQueue» do all of this; an «ExecutorService» is a thread pool reading from such a queue. Always give the queue a **bound**: an unbounded queue turns a slow consumer into an out-of-memory error.

          @stop

          ## Inside a blocking queue

          One lock and two conditions:

          ~~~java
          lock.lock();
          try {
              while (items.size() == capacity) notFull.await();   // while, not if
              items.addLast(item);
              notEmpty.signal();
          } finally {
              lock.unlock();
          }
          ~~~

          **Why «while»:** a thread can wake up without the condition being true (a *spurious wakeup*), or another thread can take the slot first. Always re-check after waking.

          ## Retries mean duplicates

          A consumer that crashes after doing the work but before acknowledging it will get the same job again. So consumers must be **idempotent**: keep the ids of processed jobs, or make the operation naturally repeatable ("set status to PAID", not "add ₹500").

          :::interview Say it like this
          "Orders go onto a bounded blocking queue that a small worker pool drains, so a spike slows producers down instead of exhausting memory. Workers are idempotent on order id because a retry can redeliver."
          :::
        `,
      },
      {
        exercise: {
          id: 'bounded-buffer', title: 'Build a bounded blocking buffer', kind: 'build', mins: 14, diff: 'hard', patterns: [], jdk: true,
          statement: J`
            Build «BoundedBuffer<T>» without using any class from «java.util.concurrent» that already blocks (no «BlockingQueue»). Use «ReentrantLock» with «Condition»s, or «synchronized» with «wait»/«notifyAll».

            - «new BoundedBuffer<>(capacity)»: capacity must be at least 1 («IllegalArgumentException»).
            - «put(item)» adds at the end; **blocks while the buffer is full**.
            - «take()» removes from the front; **blocks while it is empty**.
            - First in, first out. «size()» returns how many items are inside.
            - With several producers and consumers, every item is taken exactly once.
          `,
          starter: J`
class BoundedBuffer<T> {
    BoundedBuffer(int capacity) {
    }

    void put(T item) throws InterruptedException {
        // TODO
    }

    T take() throws InterruptedException {
        return null; // TODO
    }

    int size() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'First in, first out', ex: true, code: J`
              BoundedBuffer<String> b = new BoundedBuffer<>(3);
              b.put("a"); b.put("b");
              eq(2, b.size(), "size");
              eq("a", b.take(), "first");
              eq("b", b.take(), "second");` },
            { name: 'Capacity must be at least 1', ex: true, code: J`throwsA(IllegalArgumentException.class, () -> new BoundedBuffer<String>(0), "capacity 0");` },
            { name: 'put() waits while the buffer is full', code: J`
              BoundedBuffer<String> b = new BoundedBuffer<>(1);
              b.put("a");
              Thread producer = new Thread(() -> { try { b.put("b"); } catch (InterruptedException e) { } });
              producer.setDaemon(true);
              producer.start();
              Thread.sleep(150);
              ok(producer.isAlive(), "the second put is still waiting");
              eq("a", b.take(), "take frees a slot");
              producer.join(2000);
              no(producer.isAlive(), "the waiting put completed");
              eq("b", b.take(), "then b");` },
            { name: 'take() waits while the buffer is empty', code: J`
              BoundedBuffer<String> b = new BoundedBuffer<>(2);
              String[] got = new String[1];
              Thread consumer = new Thread(() -> { try { got[0] = b.take(); } catch (InterruptedException e) { } });
              consumer.setDaemon(true);
              consumer.start();
              Thread.sleep(150);
              ok(consumer.isAlive(), "take is waiting");
              b.put("x");
              consumer.join(2000);
              no(consumer.isAlive(), "take completed");
              eq("x", got[0], "value");` },
            { name: '4 producers, 4 consumers, 20000 items, each taken once', code: J`
              BoundedBuffer<Integer> b = new BoundedBuffer<>(8);
              int perProducer = 5000;
              ConcurrentHashMap<Integer, Integer> seen = new ConcurrentHashMap<>();
              List<Runnable> tasks = new ArrayList<>();
              for (int p = 0; p < 4; p++) { int base = p * perProducer; tasks.add(() -> { try { for (int i = 0; i < perProducer; i++) b.put(base + i); } catch (InterruptedException e) { } }); }
              for (int c = 0; c < 4; c++) tasks.add(() -> { try { for (int i = 0; i < perProducer; i++) seen.merge(b.take(), 1, Integer::sum); } catch (InterruptedException e) { } });
              ok(runTogether(tasks, 20_000), "finished within 20 s");
              eq(20000, seen.size(), "distinct items taken");
              ok(seen.values().stream().allMatch(n -> n == 1), "no item taken twice");` },
          ],
          helpers: RACE,
          lint: [
            { re: 'BlockingQueue|SynchronousQueue|Exchanger', note: 'Uses a ready-made blocking class; the exercise is to build the blocking yourself.' },
            { re: 'if\\s*\\([^)]*(isEmpty|size\\(\\)\\s*==)[^)]*\\)\\s*(\\{\\s*)?\\w*\\.?(await|wait)\\(', note: '«if» before «await»/«wait»: after waking up, re-check the condition in a «while» loop (spurious wakeups, or another thread got there first).' },
          ],
          rubric: J`
            - One lock guards the deque; «put» and «take» wait in «while» loops on «notFull» / «notEmpty».
            - Signals (or notifyAll) wake the other side after every change.
            - The lock is always released in «finally».
          `,
          hints: [
            '«private final ReentrantLock lock = new ReentrantLock(); private final Condition notFull = lock.newCondition(), notEmpty = lock.newCondition();» with an «ArrayDeque<T>» inside.',
            'put: lock; «while (items.size() == capacity) notFull.await();» add; «notEmpty.signal();» unlock in «finally». take is the mirror image.',
          ],
          solution: {
            pattern: 'A monitor: one lock, two conditions, and while-loops around every wait.',
            java: J`
class BoundedBuffer<T> {
    private final int capacity;
    private final ArrayDeque<T> items = new ArrayDeque<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    BoundedBuffer(int capacity) {
        if (capacity < 1) throw new IllegalArgumentException("capacity must be at least 1");
        this.capacity = capacity;
    }

    void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (items.size() == capacity) notFull.await();
            items.addLast(item);
            notEmpty.signal();
        } finally {
            lock.unlock();
        }
    }

    T take() throws InterruptedException {
        lock.lock();
        try {
            while (items.isEmpty()) notEmpty.await();
            T item = items.removeFirst();
            notFull.signal();
            return item;
        } finally {
            lock.unlock();
        }
    }

    int size() {
        lock.lock();
        try {
            return items.size();
        } finally {
            lock.unlock();
        }
    }
}
`,
            talk: 'One lock guards a deque, with two conditions: put waits in a while loop while it is full and signals notEmpty, take waits while it is empty and signals notFull. The while loops handle spurious wakeups, and the lock is always released in finally.',
          },
          wrong: [
            { name: 'throws instead of waiting', java: J`
class BoundedBuffer<T> {
    private final int cap; private final ArrayDeque<T> q = new ArrayDeque<>();
    BoundedBuffer(int cap) { if (cap < 1) throw new IllegalArgumentException(); this.cap = cap; }
    synchronized void put(T item) throws InterruptedException { if (q.size() == cap) throw new IllegalStateException("full"); q.addLast(item); }
    synchronized T take() throws InterruptedException { if (q.isEmpty()) throw new IllegalStateException("empty"); return q.removeFirst(); }
    synchronized int size() { return q.size(); }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
