(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'pass', title: 'Pass it on: Observer, Chain of Responsibility', short: 'Pass it on',
    blurb: 'Hand a message to others: to everyone who listens, or down a line until someone deals with it.',
    intro: J`
      :::remember The move
      The sender does not know who handles the message. It hands it **out** (to every listener) or **along** (to the next handler).
      :::

      | Pattern | Where the message goes | Typical cue |
      |---|---|---|
      | Observer | To **every** subscriber | "notify X when Y happens" |
      | Chain of Responsibility | Down a **line**, until someone handles or stops it | "try A, else B, else C" |
    `,
    items: [
      /* ─────────────── Observer ─────────────── */
      {
        lesson: 'observer', title: 'Observer: tell everyone who is listening', mins: 7,
        remember: 'Observer: the subject keeps a list of listeners and tells each one when something happens. It never knows who they are.',
        cue: 'Notify X when Y happens, and more listeners will be added later → Observer',
        body: J`
          ## The smell

          ~~~java
          void ship(Order o) {
              o.markShipped();
              email.sendShippedMail(o);       // every new reaction
              sms.sendShippedSms(o);          // is one more line here,
              analytics.track("shipped", o);  // and one more dependency
              loyalty.addPoints(o);           // of OrderService
          }
          ~~~

          ## The move

          ~~~java
          interface OrderListener { void onShipped(Order o); }

          class OrderService {
              private final List<OrderListener> listeners = new ArrayList<>();
              void subscribe(OrderListener l) { listeners.add(l); }
              void ship(Order o) {
                  o.markShipped();
                  for (OrderListener l : listeners) l.onShipped(o);   // who? doesn't matter
              }
          }
          ~~~

          ~~~seq One event, many listeners
          actors: OrderService, EmailListener, SmsListener, Analytics
          OrderService -> OrderService: markShipped()
          OrderService -> EmailListener: onShipped(o)
          OrderService -> SmsListener: onShipped(o)
          OrderService -> Analytics: onShipped(o)
          note: A new reaction is a new listener. OrderService never changes.
          ~~~

          @stop

          ## The four follow-ups interviewers ask

          1. **"One listener throws. What happens?"** Catch per listener, record or log it, and keep going. One broken listener must not stop the others.
          2. **"A listener unsubscribes while you are notifying."** Looping over the live list throws «ConcurrentModificationException». Loop over a **snapshot** («new ArrayList<>(listeners)»), or use «CopyOnWriteArrayList».
          3. **"A listener is slow."** Then every «ship()» is slow. Hand events to an executor or a queue so listeners run asynchronously.
          4. **"Memory leak?"** A listener that is never unsubscribed is never garbage collected. Return a handle from «subscribe()» that the caller can cancel.

          ## Observer vs publish/subscribe

          Observer: the subject holds its listeners directly. **Pub/sub** puts a broker in the middle (Kafka, RocketMQ, Spring's event bus), so publishers and subscribers do not even know each other exists. Same idea, one more level of decoupling.

          :::interview Say it like this
          "Shipping is an event with a growing list of reactions, so «OrderService» publishes and listeners subscribe. I notify from a snapshot so unsubscribing mid-loop is safe, and catch per listener so one failure doesn't block the rest."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Your «publish()» loops «for (Listener l : listeners)». A listener calls «unsubscribe(this)» inside its callback. What happens on a JVM?',
            options: ['Nothing, it works', 'A «ConcurrentModificationException» on the next loop step', 'A deadlock', 'The listener is called twice'],
            answer: 1,
            why: '«ArrayList»\'s iterator is fail-fast: removing during iteration trips it. Iterate over a copy, or use «CopyOnWriteArrayList», which iterates over a snapshot by design.',
          },
        ],
      },
      {
        exercise: {
          id: 'event-bus', title: 'An event bus that survives bad listeners', kind: 'build', mins: 12, diff: 'medium', patterns: ['observer'],
          statement: J`
            Build an «EventBus» with topics.

            - «subscribe(topic, subscriber)» returns a «Subscription»; «cancel()» on it stops delivery. Cancelling twice is harmless.
            - «publish(topic, payload)» delivers to the topic's subscribers **in the order they subscribed**, and returns how many received it **without throwing**.
            - A subscriber that throws does not stop the others. Record each failure as «"<topic>: <exception message>"»; «failures()» returns them in order.
            - Subscribers may cancel any subscription, including their own, **while being notified**. The publish in progress still delivers to everyone who was subscribed when it started; later publishes skip the cancelled ones.
            - Topics are independent. Publishing to a topic with no subscribers returns 0.
          `,
          given: J`
interface Subscriber {
    void onEvent(String topic, String payload);
}

interface Subscription {
    void cancel();
}
`,
          starter: J`
class EventBus {
    Subscription subscribe(String topic, Subscriber subscriber) {
        return () -> { }; // TODO
    }

    /** Returns how many subscribers received it without throwing. */
    int publish(String topic, String payload) {
        return 0; // TODO
    }

    List<String> failures() {
        return List.of(); // TODO
    }
}
`,
          tests: [
            { name: 'Subscribers get events in subscription order', ex: true, code: J`
              EventBus bus = new EventBus();
              StringBuilder log = new StringBuilder();
              bus.subscribe("orders", (t, p) -> log.append("A:" + p + " "));
              bus.subscribe("orders", (t, p) -> log.append("B:" + p + " "));
              eq(2, bus.publish("orders", "o1"), "deliveries");
              eq("A:o1 B:o1 ", log.toString(), "who got it, in order");` },
            { name: 'Other topics are not notified', ex: true, code: J`
              EventBus bus = new EventBus();
              StringBuilder log = new StringBuilder();
              bus.subscribe("orders", (t, p) -> log.append("orders "));
              bus.subscribe("payments", (t, p) -> log.append("payments "));
              bus.publish("payments", "x");
              eq("payments ", log.toString(), "log");` },
            { name: 'cancel() stops delivery', ex: true, code: J`
              EventBus bus = new EventBus();
              int[] n = { 0 };
              Subscription s = bus.subscribe("t", (t, p) -> n[0]++);
              bus.publish("t", "1");
              s.cancel();
              eq(0, bus.publish("t", "2"), "deliveries after cancel");
              eq(1, n[0], "calls");` },
            { name: 'A throwing subscriber does not stop the rest', code: J`
              EventBus bus = new EventBus();
              StringBuilder log = new StringBuilder();
              bus.subscribe("orders", (t, p) -> log.append("A "));
              bus.subscribe("orders", (t, p) -> { throw new IllegalStateException("boom"); });
              bus.subscribe("orders", (t, p) -> log.append("C "));
              eq(2, bus.publish("orders", "x"), "successful deliveries");
              eq("A C ", log.toString(), "log");
              eq(List.of("orders: boom"), bus.failures(), "failures");` },
            { name: 'Cancelling another subscriber mid-publish is safe', code: J`
              EventBus bus = new EventBus();
              StringBuilder log = new StringBuilder();
              Subscription[] b = new Subscription[1];
              bus.subscribe("t", (t, p) -> { log.append("A "); b[0].cancel(); });
              b[0] = bus.subscribe("t", (t, p) -> log.append("B "));
              bus.publish("t", "1");
              bus.publish("t", "2");
              eq("A B A ", log.toString(), "B still gets the first event, not the second");` },
            { name: 'A subscriber can cancel itself while notified', code: J`
              EventBus bus = new EventBus();
              Subscription[] me = new Subscription[1];
              int[] n = { 0 };
              me[0] = bus.subscribe("t", (t, p) -> { n[0]++; me[0].cancel(); });
              bus.publish("t", "1");
              bus.publish("t", "2");
              eq(1, n[0], "calls");` },
            { name: 'Cancelling twice is harmless', code: J`
              EventBus bus = new EventBus();
              Subscription s = bus.subscribe("t", (t, p) -> { });
              bus.subscribe("t", (t, p) -> { });
              s.cancel();
              s.cancel();
              eq(1, bus.publish("t", "x"), "the other subscriber still gets it");` },
            { name: 'No subscribers means zero deliveries', code: J`eq(0, new EventBus().publish("nobody", "x"), "deliveries");` },
            { name: 'The same subscriber twice gets two deliveries', code: J`
              EventBus bus = new EventBus();
              int[] n = { 0 };
              Subscriber s = (t, p) -> n[0]++;
              bus.subscribe("t", s);
              Subscription second = bus.subscribe("t", s);
              bus.publish("t", "x");
              second.cancel();
              bus.publish("t", "y");
              eq(3, n[0], "calls");` },
          ],
          lint: [
            { re: 'for\\s*\\(\\s*Subscriber\\s+\\w+\\s*:\\s*(subs|subscribers|list|listeners)\\b(?!\\s*\\.)', note: 'The publish loop iterates the live list. A subscriber that cancels mid-publish will trip «ConcurrentModificationException» on a JVM. Loop over a copy.' },
          ],
          rubric: J`
            - Delivery loops over a snapshot of the topic's subscribers.
            - Each delivery has its own try/catch; failures are recorded, not swallowed silently.
            - Each subscription is its own object, so cancelling one of two identical subscribers removes exactly one.
            - The bus has no knowledge of what subscribers do.
          `,
          hints: [
            'Keep a «Map<String, List<Subscriber>>». To make each subscription unique (even for the same subscriber twice), store a fresh wrapper: «Subscriber entry = (t, p) -> subscriber.onEvent(t, p);».',
            '«cancel()» can simply be «() -> list.remove(entry)»: removing twice just returns false.',
            'In «publish», loop over «new ArrayList<>(list)» and wrap each call in «try { ... } catch (RuntimeException e) { failures.add(topic + ": " + e.getMessage()); }».',
          ],
          solution: {
            pattern: 'Observer with topics, snapshot iteration and per-subscriber error isolation.',
            java: J`
class EventBus {
    private final Map<String, List<Subscriber>> subscribers = new HashMap<>();
    private final List<String> failures = new ArrayList<>();

    Subscription subscribe(String topic, Subscriber subscriber) {
        List<Subscriber> list = subscribers.computeIfAbsent(topic, t -> new ArrayList<>());
        Subscriber entry = (t, p) -> subscriber.onEvent(t, p);   // one object per subscription
        list.add(entry);
        return () -> list.remove(entry);
    }

    int publish(String topic, String payload) {
        List<Subscriber> list = subscribers.get(topic);
        if (list == null) return 0;
        int delivered = 0;
        for (Subscriber s : new ArrayList<>(list)) {
            try {
                s.onEvent(topic, payload);
                delivered++;
            } catch (RuntimeException e) {
                failures.add(topic + ": " + e.getMessage());
            }
        }
        return delivered;
    }

    List<String> failures() {
        return new ArrayList<>(failures);
    }
}
`,
            why: J`
              Each «subscribe» wraps the subscriber in a new lambda, so each subscription has its own identity and «cancel()» removes exactly that one. «publish» iterates a copy, so cancelling during delivery is safe and the in-flight publish still reaches everyone who was subscribed when it started.
            `,
            followups: J`
              - **"Deliver asynchronously."** Submit each delivery to an «ExecutorService». Now think about ordering: one single-threaded executor per subscriber keeps each subscriber's events in order.
              - **"Retry failed deliveries."** Keep failed events on a queue per subscriber and redeliver with backoff. That is where Observer turns into a message broker.
            `,
            talk: 'The bus keeps a list of subscriptions per topic. Publishing iterates a snapshot so subscribers can cancel mid-delivery, and each delivery is isolated in its own try/catch so one bad subscriber cannot block the rest.',
          },
          wrong: [
            { name: 'iterates the live list', java: J`
class EventBus {
    private final Map<String, List<Subscriber>> subs = new HashMap<>();
    private final List<String> failures = new ArrayList<>();
    Subscription subscribe(String topic, Subscriber s) { List<Subscriber> l = subs.computeIfAbsent(topic, t -> new ArrayList<>()); Subscriber e = (t, p) -> s.onEvent(t, p); l.add(e); return () -> l.remove(e); }
    int publish(String topic, String payload) {
        List<Subscriber> l = subs.get(topic); if (l == null) return 0; int n = 0;
        for (Subscriber s : l) { try { s.onEvent(topic, payload); n++; } catch (RuntimeException e) { failures.add(topic + ": " + e.getMessage()); } }
        return n;
    }
    List<String> failures() { return new ArrayList<>(failures); }
}
` },
            { name: 'one failure stops the rest', java: J`
class EventBus {
    private final Map<String, List<Subscriber>> subs = new HashMap<>();
    private final List<String> failures = new ArrayList<>();
    Subscription subscribe(String topic, Subscriber s) { List<Subscriber> l = subs.computeIfAbsent(topic, t -> new ArrayList<>()); Subscriber e = (t, p) -> s.onEvent(t, p); l.add(e); return () -> l.remove(e); }
    int publish(String topic, String payload) {
        List<Subscriber> l = subs.get(topic); if (l == null) return 0; int n = 0;
        try { for (Subscriber s : new ArrayList<>(l)) { s.onEvent(topic, payload); n++; } } catch (RuntimeException e) { failures.add(topic + ": " + e.getMessage()); }
        return n;
    }
    List<String> failures() { return new ArrayList<>(failures); }
}
` },
            { name: 'cancel removes by subscriber, not by subscription', java: J`
class EventBus {
    private final Map<String, List<Subscriber>> subs = new HashMap<>();
    private final List<String> failures = new ArrayList<>();
    Subscription subscribe(String topic, Subscriber s) { List<Subscriber> l = subs.computeIfAbsent(topic, t -> new ArrayList<>()); l.add(s); return () -> l.removeIf(x -> x == s); }
    int publish(String topic, String payload) {
        List<Subscriber> l = subs.get(topic); if (l == null) return 0; int n = 0;
        for (Subscriber s : new ArrayList<>(l)) { try { s.onEvent(topic, payload); n++; } catch (RuntimeException e) { failures.add(topic + ": " + e.getMessage()); } }
        return n;
    }
    List<String> failures() { return new ArrayList<>(failures); }
}
` },
          ],
        },
      },

      /* ─────────────── Chain of Responsibility ─────────────── */
      {
        lesson: 'chain', title: 'Chain of Responsibility: pass it down the line', mins: 6,
        remember: 'Chain of Responsibility: line up handlers; each one handles the request, passes it on, or stops it.',
        cue: 'Try A, else B, else C; a pipeline of checks where any step can reject; approval levels; paying out notes by denomination → Chain of Responsibility',
        body: J`
          ## The smell

          One method with a wall of checks, each a different concern:

          ~~~java
          Response handle(Request r) {
              if (!auth.valid(r.token())) return unauthorized();
              if (limiter.tooMany(r.user())) return tooManyRequests();
              if (r.body().length() > MAX) return tooLarge();
              if (!schema.valid(r.body())) return badRequest();
              return service.process(r);
          }
          ~~~

          Adding, removing or reordering a check means editing this method.

          ## The move

          ~~~java
          interface Handler {
              Response handle(Request r, Chain next);   // do your part, then next.proceed(r), or return early
          }
          ~~~

          Each check becomes a small class, and the order is just the order of a list. This is exactly how servlet filters and the Spring Security filter chain work.

          ## Two flavours

          - **First one wins.** Support tiers, approval limits: the first handler that *can* handle it does, and the rest never see it.
          - **Everyone takes a share.** An ATM paying 2700: the 2000-note handler takes what it can and passes the rest down.

          ~~~seq An ATM paying 2700
          actors: Atm, Notes2000, Notes500, Notes100
          Atm -> Notes2000: pay 2700
          Notes2000 -> Notes2000: take 1 note
          Notes2000 -> Notes500: pay the other 700
          Notes500 -> Notes500: take 1 note
          Notes500 -> Notes100: pay the other 200
          Notes100 -> Notes100: take 2 notes
          note: Each link only knows its own notes and the next link.
          ~~~

          @stop

          ## Chain vs Decorator

          Both wrap things in a line. A **decorator** always calls through and adds something. A **chain** handler may **stop** the request (reject it, or handle it and not pass it on).

          :::warn Plan first, then change
          If the chain changes state (takes notes, reserves stock), check that the *whole* request can succeed before anything changes. Otherwise a failure halfway leaves the first links changed and the rest not.
          :::

          :::interview Say it like this
          "Each validation is a handler in a chain, so adding a rate-limit check is a new class inserted into the list, and any handler can reject the request early."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Expense approval: under 5,000 a team lead approves, under 50,000 a manager, anything larger a director. Which flavour of chain?',
            options: ['Everyone takes a share', 'First one wins: the first approver whose limit covers the amount handles it', 'It is Observer', 'It is Strategy'],
            answer: 1,
            why: 'Each approver either handles the request (if within their limit) or passes it up. Only one handles it.',
          },
        ],
      },
      {
        exercise: {
          id: 'atm-chain', title: 'An ATM that pays out through a chain', kind: 'build', mins: 14, diff: 'medium', patterns: ['chain'],
          statement: J`
            An «Atm» holds 2000, 500 and 100 rupee notes. Pay each withdrawal with **as many large notes as possible**, largest first, the way a chain of note handlers would.

            - «new Atm(notes)» takes a map of denomination to count (a missing denomination means zero notes).
            - «withdraw(amount)» returns the notes paid, as denomination to count, **largest denomination first**, leaving out denominations it did not use.
            - An amount that is not a positive multiple of 100: «IllegalArgumentException».
            - If the machine cannot pay the exact amount: «IllegalStateException», and **no notes are taken**.
            - «notesLeft()» returns every denomination (2000, 500, 100) with its remaining count.

            Suggested design: one handler per denomination, each linked to the next smaller one. Plan the whole payout first, then take the notes.
          `,
          starter: J`
/** One link in the chain: one denomination, how many notes, and the next (smaller) link. */
class NoteHandler {
    NoteHandler(int denomination, int count, NoteHandler next) {
    }
}

class Atm {
    Atm(Map<Integer, Integer> notes) {
        // TODO: build the chain 2000 -> 500 -> 100
    }

    Map<Integer, Integer> withdraw(int amount) {
        return Map.of(); // TODO
    }

    Map<Integer, Integer> notesLeft() {
        return Map.of(); // TODO
    }
}
`,
          tests: [
            { name: '2700 is 2000 + 500 + 2 x 100', ex: true, code: J`
              Atm atm = new Atm(Map.of(2000, 5, 500, 5, 100, 5));
              Map<Integer, Integer> paid = atm.withdraw(2700);
              eq(Map.of(2000, 1, 500, 1, 100, 2), paid, "notes");
              eq(List.of(2000, 500, 100), new ArrayList<>(paid.keySet()), "largest first");` },
            { name: 'Smaller notes cover when big ones run out', ex: true, code: J`eq(Map.of(500, 4), new Atm(Map.of(2000, 0, 500, 5, 100, 10)).withdraw(2000), "notes");` },
            { name: 'Amounts must be positive multiples of 100', ex: true, code: J`
              Atm atm = new Atm(Map.of(100, 10));
              throwsA(IllegalArgumentException.class, () -> atm.withdraw(150), "150");
              throwsA(IllegalArgumentException.class, () -> atm.withdraw(0), "0");` },
            { name: 'Counts go down after a withdrawal', code: J`
              Atm atm = new Atm(Map.of(2000, 2, 500, 2, 100, 5));
              atm.withdraw(2600);
              eq(Map.of(2000, 1, 500, 1, 100, 4), atm.notesLeft(), "left");` },
            { name: 'Not enough cash: refused, nothing taken', code: J`
              Atm atm = new Atm(Map.of(2000, 1, 500, 1, 100, 1));
              throwsA(IllegalStateException.class, () -> atm.withdraw(5000), "5000");
              eq(Map.of(2000, 1, 500, 1, 100, 1), atm.notesLeft(), "unchanged");` },
            { name: 'Cannot make the exact amount: refused, nothing taken', code: J`
              Atm atm = new Atm(Map.of(2000, 1, 500, 2, 100, 0));
              throwsA(IllegalStateException.class, () -> atm.withdraw(2800), "2800 with no 100s");
              eq(Map.of(2000, 1, 500, 2, 100, 0), atm.notesLeft(), "unchanged");` },
            { name: 'Missing denominations count as zero', code: J`
              Atm atm = new Atm(Map.of(500, 3));
              eq(Map.of(500, 2), atm.withdraw(1000), "notes");
              eq(Map.of(2000, 0, 500, 1, 100, 0), atm.notesLeft(), "left");` },
            { name: 'Withdrawals drain the machine', code: J`
              Atm atm = new Atm(Map.of(2000, 1, 500, 1, 100, 2));
              atm.withdraw(2000);
              atm.withdraw(700);
              throwsA(IllegalStateException.class, () -> atm.withdraw(100), "empty machine");` },
          ],
          lint: [
            { re: 'if\\s*\\([^)]*==\\s*2000[\\s\\S]*if\\s*\\([^)]*==\\s*500', note: 'Branches per denomination: adding a 200-rupee note means editing this code. In a chain it is one more link.' },
          ],
          rubric: J`
            - One handler per denomination, linked largest to smallest; «Atm» only talks to the first link.
            - The payout is planned completely before any count changes, so a failure leaves the machine untouched.
            - Adding a denomination is one more link, not a new «if».
          `,
          hints: [
            'Each link: «use = Math.min(amount / denomination, count)», record it, and ask «next» for «amount - use * denomination». If there is a remainder and no next link, throw.',
            'Split it in two passes: «plan(amount, planMap)» only records, «take(planMap)» only subtracts. «withdraw» calls «plan» first, so a failure throws before «take» runs.',
            'A «LinkedHashMap» keeps insertion order, and the chain visits the largest denomination first.',
          ],
          solution: {
            pattern: 'Chain of Responsibility where every link takes a share: 2000 → 500 → 100, planned first, then applied.',
            java: J`
class NoteHandler {
    private final int denomination;
    private int count;
    private final NoteHandler next;

    NoteHandler(int denomination, int count, NoteHandler next) {
        this.denomination = denomination;
        this.count = count;
        this.next = next;
    }

    /** Records this link's share of the amount, then asks the next link for the rest. Changes nothing. */
    void plan(int amount, Map<Integer, Integer> plan) {
        int use = Math.min(amount / denomination, count);
        if (use > 0) plan.put(denomination, use);
        int rest = amount - use * denomination;
        if (rest == 0) return;
        if (next == null) throw new IllegalStateException("cannot pay the last " + rest);
        next.plan(rest, plan);
    }

    void take(Map<Integer, Integer> plan) {
        count -= plan.getOrDefault(denomination, 0);
        if (next != null) next.take(plan);
    }

    void report(Map<Integer, Integer> out) {
        out.put(denomination, count);
        if (next != null) next.report(out);
    }
}

class Atm {
    private final NoteHandler chain;

    Atm(Map<Integer, Integer> notes) {
        NoteHandler hundreds = new NoteHandler(100, notes.getOrDefault(100, 0), null);
        NoteHandler fiveHundreds = new NoteHandler(500, notes.getOrDefault(500, 0), hundreds);
        this.chain = new NoteHandler(2000, notes.getOrDefault(2000, 0), fiveHundreds);
    }

    Map<Integer, Integer> withdraw(int amount) {
        if (amount <= 0 || amount % 100 != 0) throw new IllegalArgumentException("amount must be a positive multiple of 100");
        Map<Integer, Integer> plan = new LinkedHashMap<>();
        chain.plan(amount, plan);
        chain.take(plan);
        return plan;
    }

    Map<Integer, Integer> notesLeft() {
        Map<Integer, Integer> out = new LinkedHashMap<>();
        chain.report(out);
        return out;
    }
}
`,
            why: J`
              Planning and taking are separate passes down the same chain. «plan» only reads counts and throws if the amount cannot be made, so by the time «take» runs, success is guaranteed and there is nothing to roll back.

              Greedy (largest notes first) always finds a payout here because each denomination divides the next larger one (100 | 500 | 2000). With 200 and 500 notes it would not: 600 with one 500 and three 200s needs the 200s.
            `,
            followups: J`
              - **"Add 200-rupee notes."** One more link, but greedy stops being enough (see above): the plan step would need to backtrack.
              - **"Two customers at once."** Planning and taking must happen under one lock, or two withdrawals can both plan against the same notes.
            `,
            talk: 'Each denomination is a handler that takes as many notes as it can and passes the remainder to the next smaller one. I plan the whole payout down the chain first, and only then take the notes, so a failure never leaves the machine half-updated.',
          },
          wrong: [
            { name: 'takes notes while planning', java: J`
class NoteHandler {
    private final int d; private int c; private final NoteHandler next;
    NoteHandler(int d, int c, NoteHandler next) { this.d = d; this.c = c; this.next = next; }
    void pay(int amount, Map<Integer, Integer> out) { int use = Math.min(amount / d, c); c -= use; if (use > 0) out.put(d, use); int rest = amount - use * d; if (rest == 0) return; if (next == null) throw new IllegalStateException(); next.pay(rest, out); }
    void report(Map<Integer, Integer> out) { out.put(d, c); if (next != null) next.report(out); }
}
class Atm {
    private final NoteHandler chain;
    Atm(Map<Integer, Integer> n) { chain = new NoteHandler(2000, n.getOrDefault(2000, 0), new NoteHandler(500, n.getOrDefault(500, 0), new NoteHandler(100, n.getOrDefault(100, 0), null))); }
    Map<Integer, Integer> withdraw(int a) { if (a <= 0 || a % 100 != 0) throw new IllegalArgumentException(); Map<Integer, Integer> out = new LinkedHashMap<>(); chain.pay(a, out); return out; }
    Map<Integer, Integer> notesLeft() { Map<Integer, Integer> out = new LinkedHashMap<>(); chain.report(out); return out; }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
