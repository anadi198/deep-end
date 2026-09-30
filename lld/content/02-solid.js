(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'solid', title: 'SOLID, as interviewers actually use it', short: 'SOLID',
    blurb: 'Five principles, three lessons, and the one question behind all of them: when this changes, how much else has to change?',
    intro: J`
      :::remember The one question
      SOLID is five ways of asking **"when this requirement changes, how many classes do I have to touch?"** The right answer is one.
      :::
    `,
    items: [
      {
        lesson: 'srp-isp', title: 'S and I: small pieces, one reason to change', mins: 6,
        remember: 'A class should have one reason to change, and an interface should be small enough that nobody has to implement methods they do not need.',
        cue: 'A class named Manager, Util or Helper, or an implementation that throws UnsupportedOperationException → split it (SRP / ISP)',
        body: J`
          ## Single Responsibility: one reason to change

          ~~~java
          class InvoiceService {
              Invoice create(Order o) { ... }        // pricing and tax rules      ← finance changes these
              String render(Invoice i) { ... }       // the layout                 ← design changes this
              void email(Invoice i) { ... }          // SMTP details               ← infra changes this
              void save(Invoice i) { ... }           // SQL                        ← the DBA changes this
          }
          ~~~

          Four different people have reasons to edit this class, and each edit risks the other three. Split by *reason to change*:

          ~~~mermaid A thin service coordinates; each piece has one job.
          classDiagram
            direction LR
            InvoiceService --> InvoiceCalculator
            InvoiceService --> InvoiceRenderer
            InvoiceService --> InvoiceMailer
            InvoiceService --> InvoiceRepository
          ~~~

          **The test:** describe the class in one sentence without the word "and".

          @stop

          ## Interface Segregation: no method you do not need

          ~~~java
          interface Machine { void print(Doc d); void scan(Doc d); void fax(Doc d); }
          class BasicPrinter implements Machine {
              public void fax(Doc d) { throw new UnsupportedOperationException(); }   // the smell
          }
          ~~~

          Split into «Printer», «Scanner», «Fax». A class implements what it can do, and clients depend only on what they call.

          :::interview Say it like this
          "I split this by reason to change: calculation, rendering, delivery and storage. The service just coordinates them, so a new tax rule touches one class."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Which description signals an SRP problem?',
            options: ['"Calculates the fare for a ride"', '"Validates the booking and sends the confirmation email and updates loyalty points"', '"Stores parking tickets by id"', '"Chooses the nearest free spot"'],
            answer: 1,
            why: 'Three "and"s, three reasons to change: validation rules, email content and loyalty rules would all edit the same class.',
          },
        ],
      },
      {
        lesson: 'ocp-lsp', title: 'O and L: extend without breaking', mins: 6,
        remember: 'Add behaviour by adding classes, not editing working ones (Open/Closed), and make every subclass keep all of its parent\'s promises (Liskov).',
        cue: 'A subclass throws for something its parent supports, or callers check which subclass they have → a Liskov violation; fix the hierarchy',
        body: J`
          ## Open/Closed: you have already done it

          Every pattern so far is a way to be *open for extension, closed for modification*:
          - a new discount rule is a new «DiscountRule» (Strategy),
          - a new channel is one «register» call (Factory),
          - a new add-on is a new decorator.

          The old, tested code does not change.

          ## Liskov: subclasses keep their parent's promises

          If code works with a «Parent», it must keep working when handed any subclass, **without checking which one it has**.

          ~~~java
          class Rectangle { void setWidth(int w); void setHeight(int h); int area(); }
          class Square extends Rectangle { ... }   // setWidth also changes height

          void stretch(Rectangle r) {
              r.setWidth(5); r.setHeight(4);
              assert r.area() == 20;   // fails for a Square: it is 16
          }
          ~~~

          Geometry says a square *is a* rectangle, but this «Rectangle» promises that width and height change independently, and «Square» breaks that promise.

          @stop

          ## Three smells of a Liskov violation

          - A subclass method that **throws** where the parent works («Penguin.fly()»).
          - Callers doing «if (bird instanceof Penguin)».
          - A subclass that **demands more** (stricter input) or **promises less** (weaker output) than its parent.

          **The fix** is almost always to model the real capability: «Bird» and a separate «Flyer» interface; «Shape» with «area()» and no setters, with «Rectangle» and «Square» as unrelated immutable shapes.

          :::note The JDK's honest exception
          «Collections.unmodifiableList(list).add(x)» throws. The JDK documents «add» as an *optional operation* to make that legal. It is a known compromise, and a good thing to mention if an interviewer asks about Liskov in the real world.
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'A «ReadOnlyAccount extends Account» overrides «withdraw()» to throw. What is the better model?',
            options: ['Keep it, and catch the exception everywhere', 'Separate the capability: «Account» for reading balance, and a «Withdrawable» interface only for accounts that allow it', 'Make «withdraw» return false silently', 'Use a Singleton'],
            answer: 1,
            why: 'Callers of «Account» would have to know which subclass they hold. Splitting the capability means only accounts that can withdraw claim to.',
          },
        ],
      },
      {
        lesson: 'dip', title: 'D: depend on interfaces, inject the details', mins: 6,
        remember: 'Business logic depends on interfaces it owns. The details (database, clock, network) get plugged in through the constructor.',
        cue: 'Logic calls System.currentTimeMillis(), new SomeRepository() or a static client inside a method → inject it instead (Dependency Inversion)',
        body: J`
          ## The hidden dependencies

          ~~~java
          class SessionStore {
              boolean isExpired(Session s) {
                  return System.currentTimeMillis() - s.lastSeen() > 30 * 60_000;   // hidden: the real clock
              }
              void save(Session s) {
                  new RedisClient("prod-redis:6379").set(s.id(), s);             // hidden: prod Redis
              }
          }
          ~~~

          Testing expiry means waiting 30 real minutes, and every test talks to production Redis.

          ## Invert it

          ~~~java
          class SessionStore {
              private final Clock clock;
              private final SessionRepository repo;
              SessionStore(Clock clock, SessionRepository repo) { ... }   // details come in from outside
          }
          ~~~

          - The **high-level** code (sessions, expiry) owns the «Clock» and «SessionRepository» interfaces.
          - The **low-level** details (system clock, Redis) implement them.
          - Tests pass a «FakeClock» and an in-memory repository. Interviewers love seeing a fake clock: it shows you have tested time-based code for real.

          @stop

          ## Dependency Inversion is not "use Spring"

          Spring *does* the injection. The principle is about **who owns the interface**: your domain defines «PaymentGateway», and the Stripe or Razorpay adapter implements it. That is also called *ports and adapters* (hexagonal architecture).

          :::interview Say it like this
          "Anything that touches time, I/O or the network is injected behind an interface: a «Clock», a repository, a gateway. The core logic is plain Java, and tests run it with fakes."
          :::
        `,
      },
      {
        exercise: {
          id: 'session-expiry', title: 'Sessions that expire by an injected clock', kind: 'build', mins: 10, diff: 'easy', patterns: [],
          statement: J`
            Build «SessionStore(clock, idleTimeoutMillis)». It must never read the system clock.

            - «login(user)» creates a session and returns a token: «"t1"», «"t2"» and so on.
            - «userFor(token)» returns the user if the session is still alive, and **counts as activity** (the idle timer restarts). A session is dead once «now - lastActivity >= idleTimeoutMillis»; a dead session is removed and «userFor» returns empty. Unknown tokens: empty.
            - «logout(token)» ends a session (unknown tokens are ignored).
            - «activeCount()» counts sessions that are alive right now.
          `,
          given: L.kit.clock,
          starter: J`
class SessionStore {
    SessionStore(Clock clock, long idleTimeoutMillis) {
    }

    String login(String user) {
        return ""; // TODO
    }

    Optional<String> userFor(String token) {
        return Optional.empty(); // TODO
    }

    void logout(String token) {
        // TODO
    }

    int activeCount() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'A fresh session works', ex: true, code: J`
              SessionStore s = new SessionStore(new FakeClock(0), 1000);
              String t = s.login("asha");
              eq("t1", t, "token");
              eq(Optional.of("asha"), s.userFor(t), "user");` },
            { name: 'It expires after the idle timeout', ex: true, code: J`
              FakeClock clock = new FakeClock(0);
              SessionStore s = new SessionStore(clock, 1000);
              String t = s.login("asha");
              clock.advance(1000);
              eq(Optional.empty(), s.userFor(t), "at exactly the timeout");` },
            { name: 'Activity keeps it alive', ex: true, code: J`
              FakeClock clock = new FakeClock(0);
              SessionStore s = new SessionStore(clock, 1000);
              String t = s.login("asha");
              clock.advance(900); s.userFor(t);
              clock.advance(900);
              eq(Optional.of("asha"), s.userFor(t), "900 ms after the last activity");` },
            { name: 'Unknown tokens and logout', code: J`
              SessionStore s = new SessionStore(new FakeClock(0), 1000);
              eq(Optional.empty(), s.userFor("nope"), "unknown");
              String t = s.login("ravi");
              s.logout(t);
              s.logout("never-existed");
              eq(Optional.empty(), s.userFor(t), "after logout");` },
            { name: 'activeCount ignores dead sessions', code: J`
              FakeClock clock = new FakeClock(0);
              SessionStore s = new SessionStore(clock, 1000);
              String a = s.login("a");
              clock.advance(600);
              s.login("b");
              clock.advance(600);
              eq(1, s.activeCount(), "a is dead, b is alive");` },
            { name: 'Tokens keep counting up', code: J`
              SessionStore s = new SessionStore(new FakeClock(0), 1000);
              s.login("a"); s.login("b");
              eq("t3", s.login("c"), "third token");` },
          ],
          lint: [
            { re: 'System\\.currentTimeMillis|System\\.nanoTime|Instant\\.now|LocalDateTime\\.now', note: 'Reads the system clock. Take time from the injected «Clock»: that is the whole point.' },
          ],
          rubric: J`
            - Time only comes from the injected «Clock».
            - Expiry is one rule in one place («now - lastActivity >= timeout»).
            - Dead sessions are cleaned up (on access, and in «activeCount»).
          `,
          hints: [
            'Keep «Map<String, Session>» where a small record or class holds the user and «lastActivity».',
            'One helper «alive(Session s, long now)» used by both «userFor» and «activeCount» keeps the rule in one place.',
          ],
          solution: {
            pattern: 'Dependency Inversion: time is an injected interface, so expiry is testable in microseconds.',
            java: J`
class SessionStore {
    private static final class Session {
        final String user;
        long lastActivity;
        Session(String user, long now) { this.user = user; this.lastActivity = now; }
    }

    private final Clock clock;
    private final long idleTimeoutMillis;
    private final Map<String, Session> sessions = new HashMap<>();
    private int nextId = 1;

    SessionStore(Clock clock, long idleTimeoutMillis) {
        this.clock = clock;
        this.idleTimeoutMillis = idleTimeoutMillis;
    }

    String login(String user) {
        String token = "t" + nextId++;
        sessions.put(token, new Session(user, clock.nowMillis()));
        return token;
    }

    Optional<String> userFor(String token) {
        Session s = sessions.get(token);
        if (s == null) return Optional.empty();
        long now = clock.nowMillis();
        if (!alive(s, now)) {
            sessions.remove(token);
            return Optional.empty();
        }
        s.lastActivity = now;
        return Optional.of(s.user);
    }

    void logout(String token) {
        sessions.remove(token);
    }

    int activeCount() {
        long now = clock.nowMillis();
        sessions.values().removeIf(s -> !alive(s, now));
        return sessions.size();
    }

    private boolean alive(Session s, long now) {
        return now - s.lastActivity < idleTimeoutMillis;
    }
}
`,
            talk: 'SessionStore takes a Clock in its constructor and never reads system time, so tests drive expiry with a FakeClock. The expiry rule lives in one alive() helper used by both lookup and counting, and dead sessions are removed when noticed.',
          },
          wrong: [
            { name: 'lookup does not count as activity', java: J`
class SessionStore {
    private final Clock c; private final long t; private final Map<String, long[]> seen = new HashMap<>(); private final Map<String, String> users = new HashMap<>(); private int n = 1;
    SessionStore(Clock c, long t) { this.c = c; this.t = t; }
    String login(String u) { String k = "t" + n++; users.put(k, u); seen.put(k, new long[] { c.nowMillis() }); return k; }
    Optional<String> userFor(String k) { if (!users.containsKey(k)) return Optional.empty(); if (c.nowMillis() - seen.get(k)[0] >= t) { users.remove(k); return Optional.empty(); } return Optional.of(users.get(k)); }
    void logout(String k) { users.remove(k); }
    int activeCount() { long now = c.nowMillis(); int a = 0; for (String k : users.keySet()) if (now - seen.get(k)[0] < t) a++; return a; }
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'invoice-split', title: 'Split an invoice god class', kind: 'design', mins: 12, diff: 'medium', patterns: [],
          statement: J`
            The «InvoiceService» in the editor works, but it calculates, formats, "emails" and stores invoices all in one class. Redesign it so that each of these can change without touching the others:

            - finance changes the tax rule (18% today, maybe per-category tomorrow),
            - the text layout changes, or becomes a PDF,
            - email becomes WhatsApp,
            - storage moves from a map to a database.

            Keep a small «InvoiceService» that coordinates. Write the interfaces and classes (bodies can be short). There are no tests: press **Check** to compile, then **Review with Claude**, or open the model answer.
          `,
          starter: J`
class InvoiceService {
    private final Map<String, String> stored = new HashMap<>();
    private final List<String> outbox = new ArrayList<>();

    String bill(String customer, Map<String, Long> itemsPaise) {
        long subtotal = 0;
        for (long p : itemsPaise.values()) subtotal += p;
        long tax = subtotal * 18 / 100;
        long total = subtotal + tax;

        StringBuilder text = new StringBuilder("Invoice for " + customer + "\n");
        for (Map.Entry<String, Long> e : itemsPaise.entrySet()) text.append(e.getKey()).append(": ").append(e.getValue()).append("\n");
        text.append("Tax: ").append(tax).append("\nTotal: ").append(total);

        outbox.add("To " + customer + ": " + text);
        String id = "INV-" + (stored.size() + 1);
        stored.put(id, text.toString());
        return id;
    }
}
`,
          rubric: J`
            - Separate pieces for **calculation** (with the tax rule injectable, e.g. a «TaxPolicy»), **rendering**, **delivery** and **storage**, each behind an interface.
            - An «Invoice» value object (lines, subtotal, tax, total) passed between them, instead of re-deriving numbers from text.
            - «InvoiceService» only coordinates: calculate, render, store, deliver. It depends on interfaces through its constructor.
            - No over-engineering: no factories or abstract bases that serve no stated change.
          `,
          solution: {
            pattern: 'Single Responsibility plus Dependency Inversion: one interface per reason to change, a thin coordinator, and a value object passed between them.',
            java: J`
record Line(String item, long paise) { }

record Invoice(String customer, List<Line> lines, long subtotal, long tax, long total) { }

interface TaxPolicy {
    long taxOn(long subtotal);
}

class FlatGst implements TaxPolicy {
    private final int percent;
    FlatGst(int percent) { this.percent = percent; }
    public long taxOn(long subtotal) { return subtotal * percent / 100; }
}

class InvoiceCalculator {
    private final TaxPolicy tax;
    InvoiceCalculator(TaxPolicy tax) { this.tax = tax; }

    Invoice calculate(String customer, Map<String, Long> itemsPaise) {
        List<Line> lines = new ArrayList<>();
        long subtotal = 0;
        for (Map.Entry<String, Long> e : itemsPaise.entrySet()) {
            lines.add(new Line(e.getKey(), e.getValue()));
            subtotal += e.getValue();
        }
        long t = tax.taxOn(subtotal);
        return new Invoice(customer, lines, subtotal, t, subtotal + t);
    }
}

interface InvoiceRenderer {
    String render(Invoice invoice);
}

class TextRenderer implements InvoiceRenderer {
    public String render(Invoice inv) {
        StringBuilder text = new StringBuilder("Invoice for " + inv.customer() + "\n");
        for (Line l : inv.lines()) text.append(l.item()).append(": ").append(l.paise()).append("\n");
        return text.append("Tax: ").append(inv.tax()).append("\nTotal: ").append(inv.total()).toString();
    }
}

interface InvoiceDelivery {
    void deliver(String customer, String rendered);
}

interface InvoiceRepository {
    String save(Invoice invoice, String rendered);
}

class InvoiceService {
    private final InvoiceCalculator calculator;
    private final InvoiceRenderer renderer;
    private final InvoiceRepository repository;
    private final InvoiceDelivery delivery;

    InvoiceService(InvoiceCalculator calculator, InvoiceRenderer renderer, InvoiceRepository repository, InvoiceDelivery delivery) {
        this.calculator = calculator;
        this.renderer = renderer;
        this.repository = repository;
        this.delivery = delivery;
    }

    String bill(String customer, Map<String, Long> itemsPaise) {
        Invoice invoice = calculator.calculate(customer, itemsPaise);
        String rendered = renderer.render(invoice);
        String id = repository.save(invoice, rendered);
        delivery.deliver(customer, rendered);
        return id;
    }
}
`,
            why: J`
              Each interface matches one of the four changes in the task, which is exactly how far to go. The «Invoice» record carries the numbers, so the renderer formats and never recalculates. A per-category tax rule is a new «TaxPolicy»; WhatsApp is a new «InvoiceDelivery»; neither touches the others.
            `,
            talk: 'I split the god class by reason to change: calculation with an injectable tax policy, rendering, delivery and storage, each behind an interface. An Invoice value object flows between them, and InvoiceService just coordinates the four steps.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
