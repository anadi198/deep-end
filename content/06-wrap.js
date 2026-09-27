(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'wrap', title: 'Wrap it: Decorator, Proxy, Adapter, Composite', short: 'Wrap it',
    blurb: 'Put an object inside another. Same interface to add or control behaviour, a friendlier one to fit, or a whole tree behind one.',
    intro: J`
      :::remember The move
      The wrapper **looks like** the thing it wraps (or like what you wish it looked like), so callers cannot tell the difference.
      :::

      | Pattern | Why you wrap | Cue |
      |---|---|---|
      | Decorator | to **add** behaviour; wrappers stack | optional extras that combine |
      | Proxy | to **control access** to the real object | "check before calling" |
      | Adapter | to **change the interface** to one you expect | "integrate a vendor API" |
      | Composite | to treat **a group like a single item** | "folders contain folders" |
    `,
    items: [
      /* ─────────────── Decorator ─────────────── */
      {
        lesson: 'decorator', title: 'Decorator: add behaviour by wrapping', mins: 5,
        remember: 'Decorator: wrap an object in another with the same interface to add behaviour. Wrappers stack in any combination.',
        cue: 'Optional extras that combine freely (add-ons, or logging + caching + retry around a service) → Decorator',
        body: J`
          ## The smell: a subclass for every combination

          «Espresso», «EspressoWithMilk», «EspressoWithMilkAndCaramel», «TeaWithMilk», ... Three add-ons already make eight subclasses per drink.

          ## The move

          ~~~java
          interface Beverage { long cost(); String describe(); }

          class Milk implements Beverage {
              private final Beverage inner;                  // the thing being wrapped
              Milk(Beverage inner) { this.inner = inner; }
              public long cost() { return inner.cost() + 30; }
              public String describe() { return inner.describe() + ", milk"; }
          }

          Beverage order = new Caramel(new Milk(new Espresso()));   // stack in any order
          ~~~

          ~~~seq cost() travels through the layers
          actors: Client, Caramel, Milk, Espresso
          Client -> Caramel: cost()
          Caramel -> Milk: cost()
          Milk -> Espresso: cost()
          Espresso --> Milk: 150
          Milk --> Caramel: 180
          Caramel --> Client: 220
          note: Each layer adds its part on the way back out.
          ~~~

          @stop

          ## You already use decorators

          - «new BufferedReader(new InputStreamReader(new FileInputStream(f)))»: each layer adds one thing.
          - «Collections.unmodifiableList(list)»: same interface, blocks writes.
          - Around services: «new RetryingClient(new TimingClient(realClient))». Each concern stays in its own small class.

          :::warn Order can matter
          If a layer multiplies (tax, percentage discounts), wrapping it inside or outside gives different totals. Say which order is correct, and build it in one place (a small factory or builder).
          :::

          :::interview Say it like this
          "Add-ons combine freely, so each one is a decorator around «Beverage». No subclass explosion, and a new add-on is one class."
          :::
        `,
      },
      {
        exercise: {
          id: 'coffee-decorators', title: 'Coffee add-ons that stack', kind: 'build', mins: 10, diff: 'easy', patterns: ['decorator'],
          statement: J`
            Prices are in paise.

            - Base drinks: «Espresso» costs 150 and describes itself as «"Espresso"»; «Tea» costs 100, «"Tea"».
            - Add-ons wrap any «Beverage»: «Milk» +30 (adds «", milk"»), «ExtraShot» +50 («", extra shot"»), «Caramel» +40 («", caramel"»). The same add-on can appear twice.
            - «WithTax(beverage, percent)» adds tax on **everything inside it**, rounded down, and appends «" (incl. <percent>% tax)"».

            So «new WithTax(new Milk(new Espresso()), 10)» costs 180 + 18 = 198 and describes itself as «"Espresso, milk (incl. 10% tax)"».
          `,
          given: J`
interface Beverage {
    long cost();
    String describe();
}
`,
          starter: J`
class Espresso implements Beverage {
    public long cost() { return 0; } // TODO
    public String describe() { return ""; } // TODO
}

class Tea implements Beverage {
    public long cost() { return 0; } // TODO
    public String describe() { return ""; } // TODO
}

class Milk implements Beverage {
    Milk(Beverage inner) { }
    public long cost() { return 0; } // TODO
    public String describe() { return ""; } // TODO
}

class ExtraShot implements Beverage {
    ExtraShot(Beverage inner) { }
    public long cost() { return 0; } // TODO
    public String describe() { return ""; } // TODO
}

class Caramel implements Beverage {
    Caramel(Beverage inner) { }
    public long cost() { return 0; } // TODO
    public String describe() { return ""; } // TODO
}

class WithTax implements Beverage {
    WithTax(Beverage inner, int percent) { }
    public long cost() { return 0; } // TODO
    public String describe() { return ""; } // TODO
}
`,
          tests: [
            { name: 'A plain espresso', ex: true, code: J`
              Beverage b = new Espresso();
              eq(150L, b.cost(), "cost");
              eq("Espresso", b.describe(), "describe");` },
            { name: 'Milk and caramel stack', ex: true, code: J`
              Beverage b = new Caramel(new Milk(new Espresso()));
              eq(220L, b.cost(), "cost");
              eq("Espresso, milk, caramel", b.describe(), "describe");` },
            { name: 'Tax wraps everything inside it', ex: true, code: J`
              Beverage b = new WithTax(new Milk(new Espresso()), 10);
              eq(198L, b.cost(), "cost");
              eq("Espresso, milk (incl. 10% tax)", b.describe(), "describe");` },
            { name: 'The same add-on twice', code: J`
              Beverage b = new Milk(new Milk(new Tea()));
              eq(160L, b.cost(), "cost");
              eq("Tea, milk, milk", b.describe(), "describe");` },
            { name: 'Every add-on works on tea too', code: J`
              Beverage b = new ExtraShot(new Caramel(new Tea()));
              eq(190L, b.cost(), "cost");
              eq("Tea, caramel, extra shot", b.describe(), "describe");` },
            { name: 'Tax rounds down', code: J`
              eq(107L, new WithTax(new Tea(), 7).cost(), "7% of 100 is exactly 7");
              say("15% of 130 is 19.5 paise: the tax rounds down to 19");
              eq(149L, new WithTax(new Milk(new Tea()), 15).cost(), "130 + 19");` },
            { name: 'Where the tax goes changes the price', code: J`
              long outside = new WithTax(new Milk(new Espresso()), 10).cost();
              long inside = new Milk(new WithTax(new Espresso(), 10)).cost();
              eq(198L, outside, "tax on espresso + milk");
              eq(195L, inside, "tax on espresso only, then milk");` },
          ],
          rubric: J`
            - Every add-on holds a «Beverage» and delegates to it; nothing checks concrete types.
            - Base drinks and add-ons share one interface, so wrappers stack in any order and any number.
            - Tax uses integer maths on the inner total.
          `,
          hints: [
            'Each add-on: a field «private final Beverage inner», «cost() = inner.cost() + price», «describe() = inner.describe() + ", milk"».',
            '«WithTax.cost()»: «long c = inner.cost(); return c + c * percent / 100;».',
          ],
          solution: {
            pattern: 'Decorator: every add-on is a «Beverage» wrapping a «Beverage».',
            java: J`
class Espresso implements Beverage {
    public long cost() { return 150; }
    public String describe() { return "Espresso"; }
}

class Tea implements Beverage {
    public long cost() { return 100; }
    public String describe() { return "Tea"; }
}

abstract class AddOn implements Beverage {
    protected final Beverage inner;
    private final long price;
    private final String label;

    AddOn(Beverage inner, long price, String label) {
        this.inner = Objects.requireNonNull(inner);
        this.price = price;
        this.label = label;
    }

    public long cost() { return inner.cost() + price; }
    public String describe() { return inner.describe() + ", " + label; }
}

class Milk extends AddOn {
    Milk(Beverage inner) { super(inner, 30, "milk"); }
}

class ExtraShot extends AddOn {
    ExtraShot(Beverage inner) { super(inner, 50, "extra shot"); }
}

class Caramel extends AddOn {
    Caramel(Beverage inner) { super(inner, 40, "caramel"); }
}

class WithTax implements Beverage {
    private final Beverage inner;
    private final int percent;

    WithTax(Beverage inner, int percent) {
        this.inner = Objects.requireNonNull(inner);
        this.percent = percent;
    }

    public long cost() {
        long c = inner.cost();
        return c + c * percent / 100;
    }

    public String describe() {
        return inner.describe() + " (incl. " + percent + "% tax)";
    }
}
`,
            why: J`
              The three simple add-ons only differ in price and label, so they share a small abstract base. That is fine here: the base holds no logic a subclass could break. «WithTax» is a different kind of decorator (it multiplies), so it implements «Beverage» directly.
            `,
            talk: 'Every add-on is a Beverage that wraps a Beverage and adds its price and label, so they stack in any combination without a subclass per combination. Tax is a decorator too, and where you wrap it decides what it taxes.',
          },
          wrong: [
            { name: 'tax on the add-on only', java: J`
class Espresso implements Beverage { public long cost() { return 150; } public String describe() { return "Espresso"; } }
class Tea implements Beverage { public long cost() { return 100; } public String describe() { return "Tea"; } }
class Milk implements Beverage { private final Beverage i; Milk(Beverage i) { this.i = i; } public long cost() { return i.cost() + 30; } public String describe() { return i.describe() + ", milk"; } }
class ExtraShot implements Beverage { private final Beverage i; ExtraShot(Beverage i) { this.i = i; } public long cost() { return i.cost() + 50; } public String describe() { return i.describe() + ", extra shot"; } }
class Caramel implements Beverage { private final Beverage i; Caramel(Beverage i) { this.i = i; } public long cost() { return i.cost() + 40; } public String describe() { return i.describe() + ", caramel"; } }
class WithTax implements Beverage { private final Beverage i; private final int p; WithTax(Beverage i, int p) { this.i = i; this.p = p; } public long cost() { return i.cost() + 150L * p / 100; } public String describe() { return i.describe() + " (incl. " + p + "% tax)"; } }
` },
          ],
        },
      },

      /* ─────────────── Proxy ─────────────── */
      {
        lesson: 'proxy', title: 'Proxy: control access to the real thing', mins: 5,
        remember: 'Proxy: a stand-in with the same interface that controls access to the real object: caching, lazy loading, permission checks, rate limits, remote calls.',
        cue: 'Check or do something before calling the real object, without the caller knowing → Proxy',
        body: J`
          ## Same shape as a decorator, different job

          A proxy implements the same interface as the real object and sits in front of it. The caller cannot tell. What it does before or instead of calling through is the point:

          | Kind | What it does |
          |---|---|
          | Caching | answers repeated calls from memory |
          | Virtual (lazy) | creates the expensive real object only on first use |
          | Protection | checks permissions, then calls through or refuses |
          | Remote | the real object lives on another machine (a gRPC stub) |
          | Rate limiting | refuses calls over a quota |

          ~~~seq A caching proxy
          actors: Client, CachingProxy, RealService
          Client -> CachingProxy: priceOf("A1")
          CachingProxy -> RealService: priceOf("A1")
          note: First time: a miss, so it asks the real service and remembers the answer.
          RealService --> CachingProxy: 499
          CachingProxy --> Client: 499
          Client -> CachingProxy: priceOf("A1")
          CachingProxy --> Client: 499
          note: Second time: answered from the cache. The real service never hears about it.
          ~~~

          @stop

          ## The Spring gotcha worth knowing cold

          «@Transactional», «@Cacheable» and «@Async» work because Spring hands other beans a **proxy** of your bean. If a method in the same class calls «this.save()», it calls the real object directly and **skips the proxy**, so the annotation silently does nothing. Interviewers love this one.

          ## Decorator vs Proxy

          Decorators **add** behaviour and are meant to stack. A proxy **controls access** to one real object, and often decides whether (or when) the real object is even created.

          :::interview Say it like this
          "I put a caching proxy in front of the pricing service: same interface, so callers don't change, and it only calls through on a miss or after the entry expires."
          :::
        `,
      },
      {
        exercise: {
          id: 'caching-proxy', title: 'A caching proxy with expiry', kind: 'build', mins: 12, diff: 'medium', patterns: ['proxy'],
          statement: J`
            Build «CachingPriceService», a proxy in front of a slow «PriceService».

            - It implements «PriceService», so callers cannot tell it apart from the real one.
            - The first call for a SKU asks the real service and remembers the price. Later calls within «ttlMillis» are answered from the cache.
            - An entry fetched at time «t» expires when «now - t >= ttlMillis»; the next call fetches again.
            - If the real service throws, the exception reaches the caller and **nothing is cached**, so the next call tries again.
            - «invalidate(sku)» forgets one SKU. «hits()» and «misses()» count cache answers and calls through to the real service.

            Time comes from the «Clock» you are given. Tests use a «FakeClock».
          `,
          given: L.kit.clock + J`
interface PriceService {
    long priceOf(String sku);
}
`,
          starter: J`
class CachingPriceService implements PriceService {
    CachingPriceService(PriceService real, Clock clock, long ttlMillis) {
    }

    public long priceOf(String sku) {
        return 0; // TODO
    }

    void invalidate(String sku) {
        // TODO
    }

    int hits() {
        return 0; // TODO
    }

    int misses() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'The second call is answered from the cache', ex: true, code: J`
              int[] calls = { 0 };
              PriceService real = sku -> { calls[0]++; return 499; };
              CachingPriceService c = new CachingPriceService(real, new FakeClock(0), 1000);
              eq(499L, c.priceOf("A1"), "first");
              eq(499L, c.priceOf("A1"), "second");
              eq(1, calls[0], "calls to the real service");
              eq(1, c.hits(), "hits");
              eq(1, c.misses(), "misses");` },
            { name: 'An entry expires after the TTL', ex: true, code: J`
              int[] calls = { 0 };
              PriceService real = sku -> ++calls[0] * 100L;
              FakeClock clock = new FakeClock(0);
              CachingPriceService c = new CachingPriceService(real, clock, 1000);
              eq(100L, c.priceOf("A1"), "first fetch");
              clock.advance(999);
              eq(100L, c.priceOf("A1"), "just before expiry");
              clock.advance(1);
              eq(200L, c.priceOf("A1"), "at exactly the TTL it refetches");` },
            { name: 'Different SKUs are cached separately', code: J`
              int[] calls = { 0 };
              PriceService real = sku -> { calls[0]++; return sku.length(); };
              CachingPriceService c = new CachingPriceService(real, new FakeClock(0), 1000);
              eq(2L, c.priceOf("A1"), "A1");
              eq(3L, c.priceOf("B22"), "B22");
              c.priceOf("A1"); c.priceOf("B22");
              eq(2, calls[0], "calls");` },
            { name: 'Failures are not cached', code: J`
              int[] calls = { 0 };
              PriceService real = sku -> { calls[0]++; if (calls[0] == 1) throw new IllegalStateException("down"); return 7; };
              CachingPriceService c = new CachingPriceService(real, new FakeClock(0), 1000);
              throwsA(IllegalStateException.class, () -> c.priceOf("A1"), "first call fails");
              eq(7L, c.priceOf("A1"), "second call retries");
              eq(7L, c.priceOf("A1"), "third call is cached");
              eq(2, calls[0], "calls");` },
            { name: 'invalidate() forces a refetch', code: J`
              int[] calls = { 0 };
              PriceService real = sku -> ++calls[0];
              CachingPriceService c = new CachingPriceService(real, new FakeClock(0), 1000);
              c.priceOf("A1");
              c.invalidate("A1");
              eq(2L, c.priceOf("A1"), "after invalidate");` },
            { name: 'It is a PriceService', code: J`
              PriceService p = new CachingPriceService(sku -> 5, new FakeClock(0), 10);
              eq(5L, p.priceOf("x"), "through the interface");` },
          ],
          lint: [
            { re: 'System\\.currentTimeMillis|System\\.nanoTime|Instant\\.now', note: 'Reads the system clock directly. Use the injected «Clock» so tests (and interviewers) can control time.' },
          ],
          rubric: J`
            - Same interface as the real service; callers do not change.
            - Time comes from an injected «Clock», never the system clock.
            - Each cache entry stores the value and when it was fetched; expiry is checked on read.
            - Failures propagate and are not cached.
          `,
          hints: [
            'Store «record Entry(long price, long fetchedAt)» in a «Map<String, Entry>».',
            'On read: if an entry exists and «clock.nowMillis() - e.fetchedAt() < ttlMillis», it is a hit. Otherwise call the real service first, and only then store the new entry: if it throws, you never reach the store.',
          ],
          solution: {
            pattern: 'A caching Proxy: same interface, remembers answers, and expires them by an injected clock.',
            java: J`
class CachingPriceService implements PriceService {
    private record Entry(long price, long fetchedAt) { }

    private final PriceService real;
    private final Clock clock;
    private final long ttlMillis;
    private final Map<String, Entry> cache = new HashMap<>();
    private int hits;
    private int misses;

    CachingPriceService(PriceService real, Clock clock, long ttlMillis) {
        this.real = real;
        this.clock = clock;
        this.ttlMillis = ttlMillis;
    }

    public long priceOf(String sku) {
        long now = clock.nowMillis();
        Entry e = cache.get(sku);
        if (e != null && now - e.fetchedAt() < ttlMillis) {
            hits++;
            return e.price();
        }
        misses++;
        long price = real.priceOf(sku);          // throws before anything is cached
        cache.put(sku, new Entry(price, now));
        return price;
    }

    void invalidate(String sku) {
        cache.remove(sku);
    }

    int hits() {
        return hits;
    }

    int misses() {
        return misses;
    }
}
`,
            followups: J`
              - **"The cache grows forever."** Bound it: an LRU («LinkedHashMap» with access order) or evict expired entries on a timer.
              - **"Two threads miss at once and both hit the slow service."** That is a *cache stampede*. «ConcurrentHashMap.computeIfAbsent» with a future per key makes the second caller wait for the first fetch.
            `,
            talk: 'CachingPriceService implements the same PriceService interface and sits in front of the real one. Entries remember when they were fetched, expire by an injected clock, and a failure is never cached, so the next call retries.',
          },
          wrong: [
            { name: 'expires one tick late', java: J`
class CachingPriceService implements PriceService {
    private final PriceService real; private final Clock clock; private final long ttl;
    private final Map<String, long[]> cache = new HashMap<>(); private int hits, misses;
    CachingPriceService(PriceService real, Clock clock, long ttl) { this.real = real; this.clock = clock; this.ttl = ttl; }
    public long priceOf(String sku) { long now = clock.nowMillis(); long[] e = cache.get(sku); if (e != null && now - e[1] <= ttl) { hits++; return e[0]; } misses++; long p = real.priceOf(sku); cache.put(sku, new long[] { p, now }); return p; }
    void invalidate(String sku) { cache.remove(sku); }
    int hits() { return hits; } int misses() { return misses; }
}
` },
          ],
        },
      },

      /* ─────────────── Adapter ─────────────── */
      {
        lesson: 'adapter', title: 'Adapter: make a foreign API fit', mins: 5,
        remember: 'Adapter: wrap a class with the wrong interface so it fits the one your code expects. Translate calls, units and errors in one place.',
        cue: 'Integrate a third-party or legacy API behind your own interface → Adapter',
        body: J`
          ## The situation

          Your code wants «PaymentGateway.charge(orderId, paise)» and an answer you understand. The vendor SDK offers «makeTxn(String ref, String amount, String currency)» with the amount in **rupees as a string** and an **HTTP-style status code** back.

          ## The move

          ~~~java
          class VendorPaymentAdapter implements PaymentGateway {     // your interface
              private final VendorSdk sdk;                            // their class
              public ChargeResult charge(String orderId, long paise) {
                  int status = sdk.makeTxn(orderId, rupees(paise), "INR");   // translate in
                  return switch (status) {                                   // translate out
                      case 200 -> ChargeResult.APPROVED;
                      case 402 -> ChargeResult.DECLINED;
                      default -> ...;
                  };
              }
          }
          ~~~

          @stop

          ## Why it matters more than it looks

          - **Vendor types stay out of your domain.** Only the adapter imports the SDK. Switching vendors means writing one new adapter. (Domain-driven design calls this an *anti-corruption layer*.)
          - **Units and errors get translated once.** Paise to rupee strings, status codes to your result type, vendor exceptions to yours.
          - **Tests get easy.** The rest of the code depends on «PaymentGateway», so tests use a fake gateway and never touch the SDK.

          In the JDK: «Arrays.asList(array)» adapts an array to «List»; «InputStreamReader» adapts bytes to characters.

          :::interview Say it like this
          "The vendor SDK sits behind an adapter that implements our «PaymentGateway». It converts paise to their rupee string and their status codes to our «ChargeResult», so no vendor type leaks into the domain."
          :::
        `,
      },
      {
        exercise: {
          id: 'payment-adapter', title: 'Adapt a vendor payment SDK', kind: 'build', mins: 10, diff: 'easy', patterns: ['adapter'],
          statement: J`
            Write «VendorPaymentAdapter», which implements your «PaymentGateway» using the vendor's «VendorSdk» (given; you cannot change it).

            - Amounts come in as **paise** («long»). The SDK wants **rupees with exactly two decimals**, as a string: 1205 paise is «"12.05"», 5 paise is «"0.05"», 100000 paise is «"1000.00"». Currency is always «"INR"».
            - A zero or negative amount: «IllegalArgumentException», **without calling the SDK**.
            - Map the SDK status: 200 → «APPROVED», 402 → «DECLINED», 429 or 503 → «RETRY_LATER». Any other status: «IllegalStateException» mentioning the status.
            - Pass the order id through as the SDK's «ref».
          `,
          given: J`
enum ChargeResult { APPROVED, DECLINED, RETRY_LATER }

/** Your side: what the rest of the code depends on. */
interface PaymentGateway {
    ChargeResult charge(String orderId, long paise);
}

/** The vendor's SDK (a fake, so tests can see what you sent). You cannot change it. */
class VendorSdk {
    String lastRef, lastAmount, lastCurrency;
    int calls;
    int nextStatus = 200;

    int makeTxn(String ref, String amount, String currency) {
        calls++;
        lastRef = ref;
        lastAmount = amount;
        lastCurrency = currency;
        return nextStatus;
    }
}
`,
          starter: J`
class VendorPaymentAdapter implements PaymentGateway {
    VendorPaymentAdapter(VendorSdk sdk) {
    }

    public ChargeResult charge(String orderId, long paise) {
        return null; // TODO
    }
}
`,
          tests: [
            { name: 'Converts paise to a rupee string', ex: true, code: J`
              VendorSdk sdk = new VendorSdk();
              eq(ChargeResult.APPROVED, new VendorPaymentAdapter(sdk).charge("ORD-1", 1205), "result");
              eq("12.05", sdk.lastAmount, "amount sent");
              eq("INR", sdk.lastCurrency, "currency");
              eq("ORD-1", sdk.lastRef, "ref");` },
            { name: 'Declines map to DECLINED', ex: true, code: J`
              VendorSdk sdk = new VendorSdk();
              sdk.nextStatus = 402;
              eq(ChargeResult.DECLINED, new VendorPaymentAdapter(sdk).charge("ORD-2", 500), "result");` },
            { name: 'Small and round amounts keep two decimals', code: J`
              VendorSdk sdk = new VendorSdk();
              PaymentGateway g = new VendorPaymentAdapter(sdk);
              g.charge("a", 5); eq("0.05", sdk.lastAmount, "5 paise");
              g.charge("b", 100000); eq("1000.00", sdk.lastAmount, "100000 paise");
              g.charge("c", 90); eq("0.90", sdk.lastAmount, "90 paise");` },
            { name: '429 and 503 mean retry later', code: J`
              VendorSdk sdk = new VendorSdk();
              PaymentGateway g = new VendorPaymentAdapter(sdk);
              sdk.nextStatus = 429; eq(ChargeResult.RETRY_LATER, g.charge("a", 100), "429");
              sdk.nextStatus = 503; eq(ChargeResult.RETRY_LATER, g.charge("a", 100), "503");` },
            { name: 'An unknown status is an error', code: J`
              VendorSdk sdk = new VendorSdk();
              sdk.nextStatus = 418;
              throwsA(IllegalStateException.class, () -> new VendorPaymentAdapter(sdk).charge("a", 100), "418");` },
            { name: 'Bad amounts never reach the vendor', code: J`
              VendorSdk sdk = new VendorSdk();
              PaymentGateway g = new VendorPaymentAdapter(sdk);
              throwsA(IllegalArgumentException.class, () -> g.charge("a", 0), "0 paise");
              throwsA(IllegalArgumentException.class, () -> g.charge("a", -5), "-5 paise");
              eq(0, sdk.calls, "SDK calls");` },
          ],
          lint: [
            { re: '\\bdouble\\b|\\bfloat\\b|/\\s*100\\.0', note: 'Floating point for money: 1205 / 100.0 prints fine, but other amounts will not always. Build the string from «paise / 100» and «paise % 100».' },
          ],
          rubric: J`
            - The adapter implements your interface and holds the vendor object; nothing else knows about «VendorSdk».
            - Money conversion uses integer maths (quotient and remainder), not floating point.
            - Status codes map in one place, and unknown ones fail loudly instead of being guessed.
            - Validation happens before calling out.
          `,
          hints: [
            '«String.format("%d.%02d", paise / 100, paise % 100)» gives exactly two decimals. (If the in-browser engine complains about «format», build it by hand: pad the remainder with a leading zero when it is below 10.)',
            'A «switch» expression on the status reads well: «case 200 -> APPROVED; case 402 -> DECLINED; case 429, 503 -> RETRY_LATER; default -> throw ...».',
          ],
          solution: {
            pattern: 'Adapter: implements your interface, translates units in and codes out, and keeps the vendor type contained.',
            java: J`
class VendorPaymentAdapter implements PaymentGateway {
    private final VendorSdk sdk;

    VendorPaymentAdapter(VendorSdk sdk) {
        this.sdk = sdk;
    }

    public ChargeResult charge(String orderId, long paise) {
        if (paise <= 0) throw new IllegalArgumentException("amount must be positive, got " + paise);
        int status = sdk.makeTxn(orderId, rupees(paise), "INR");
        return switch (status) {
            case 200 -> ChargeResult.APPROVED;
            case 402 -> ChargeResult.DECLINED;
            case 429, 503 -> ChargeResult.RETRY_LATER;
            default -> throw new IllegalStateException("unexpected vendor status " + status);
        };
    }

    static String rupees(long paise) {
        long r = paise / 100, p = paise % 100;
        return r + "." + (p < 10 ? "0" : "") + p;
    }
}
`,
            talk: 'VendorPaymentAdapter implements our PaymentGateway and is the only class that knows the vendor SDK. It converts paise to their two-decimal rupee string with integer maths and maps their status codes to our ChargeResult, failing loudly on anything unknown.',
          },
          wrong: [
            { name: 'floating-point rupees', java: J`
class VendorPaymentAdapter implements PaymentGateway {
    private final VendorSdk sdk;
    VendorPaymentAdapter(VendorSdk sdk) { this.sdk = sdk; }
    public ChargeResult charge(String id, long paise) {
        if (paise <= 0) throw new IllegalArgumentException();
        int s = sdk.makeTxn(id, String.valueOf(paise / 100.0), "INR");
        return switch (s) { case 200 -> ChargeResult.APPROVED; case 402 -> ChargeResult.DECLINED; case 429, 503 -> ChargeResult.RETRY_LATER; default -> throw new IllegalStateException(); };
    }
}
` },
          ],
        },
      },

      /* ─────────────── Composite ─────────────── */
      {
        lesson: 'composite', title: 'Composite: a tree that acts like one node', mins: 5,
        remember: 'Composite: give a single item and a group of items the same interface, so code can treat a whole tree like one node.',
        cue: 'A folder contains files and folders; a menu contains items and submenus; totals over a tree → Composite',
        body: J`
          ## The move

          ~~~java
          interface Node { long size(); }

          class FileNode implements Node {
              private final long bytes;
              public long size() { return bytes; }
          }

          class Folder implements Node {
              private final List<Node> children = new ArrayList<>();
              public long size() {
                  long total = 0;
                  for (Node c : children) total += c.size();   // file or folder: doesn't matter
                  return total;
              }
          }
          ~~~

          ~~~mermaid A folder holds Nodes, and is one.
          classDiagram
            class Node {
              <<interface>>
              +size() long
            }
            Node <|.. FileNode
            Node <|.. Folder
            Folder o-- "many" Node : children
          ~~~

          No «instanceof Folder» anywhere: recursion does the walking.

          @stop

          ## Composites hide in other patterns

          - A «MacroCommand» that runs a list of commands is a composite command.
          - A «CombinedRule» that applies a list of discount rules is a composite strategy.
          - An org chart where a department's cost is the sum of its people and sub-departments.

          :::warn Two things to guard
          - **Cycles.** Adding a folder into its own subfolder makes «size()» recurse forever. Check before you add.
          - **Where «add()» lives.** Put it only on «Folder» (safer: a file cannot have children) rather than on «Node» (more uniform, but «FileNode.add» must throw).
          :::

          :::interview Say it like this
          "Files and folders share a «Node» interface. A folder's size is the sum of its children's, so the whole tree answers the same questions as a single file, and adding a symlink type later is one more «Node»."
          :::
        `,
      },
      {
        exercise: {
          id: 'folder-tree', title: 'Folder sizes with a composite', kind: 'build', mins: 12, diff: 'medium', patterns: ['composite'],
          statement: J`
            Build a file tree where files and folders share the «Node» interface.

            - «FileNode(name, bytes)»: size is its bytes, file count 1. Negative bytes: «IllegalArgumentException».
            - «Folder(name)»: size is the sum of everything inside, at any depth; file count likewise. «add(child)» returns the folder so calls can chain.
            - «add» rejects a child whose name already exists in that folder, and rejects adding a folder into **itself or anything inside it** (both «IllegalArgumentException»).
            - «largestFile()» returns the biggest file anywhere inside (empty if there are none; no ties in the tests).
            - «paths()» lists every file's path from this folder, like «"root/src/Main.java"», depth-first in the order things were added.
          `,
          given: J`
interface Node {
    String name();
    long size();
    int fileCount();
}
`,
          starter: J`
class FileNode implements Node {
    FileNode(String name, long bytes) {
    }

    public String name() { return ""; } // TODO
    public long size() { return 0; } // TODO
    public int fileCount() { return 0; } // TODO
}

class Folder implements Node {
    Folder(String name) {
    }

    Folder add(Node child) {
        return this; // TODO
    }

    public String name() { return ""; } // TODO
    public long size() { return 0; } // TODO
    public int fileCount() { return 0; } // TODO

    Optional<FileNode> largestFile() {
        return Optional.empty(); // TODO
    }

    List<String> paths() {
        return List.of(); // TODO
    }
}
`,
          tests: [
            { name: 'A folder sums everything inside it', ex: true, code: J`
              Folder root = new Folder("root").add(new FileNode("a.txt", 10)).add(new Folder("src").add(new FileNode("Main.java", 30)));
              eq(40L, root.size(), "size");
              eq(2, root.fileCount(), "files");` },
            { name: 'paths() walks depth-first in insertion order', ex: true, code: J`
              Folder root = new Folder("root").add(new FileNode("a.txt", 1)).add(new Folder("src").add(new FileNode("Main.java", 1)).add(new FileNode("B.java", 1))).add(new FileNode("z.md", 1));
              eq(List.of("root/a.txt", "root/src/Main.java", "root/src/B.java", "root/z.md"), root.paths(), "paths");` },
            { name: 'An empty folder is empty', ex: true, code: J`
              Folder f = new Folder("empty");
              eq(0L, f.size(), "size");
              eq(0, f.fileCount(), "files");
              ok(f.largestFile().isEmpty(), "no largest file");` },
            { name: 'largestFile() looks at every depth', code: J`
              Folder root = new Folder("root").add(new FileNode("small", 5)).add(new Folder("deep").add(new Folder("deeper").add(new FileNode("big", 500))));
              eq("big", root.largestFile().get().name(), "largest");` },
            { name: 'Duplicate names in one folder are rejected', code: J`
              Folder f = new Folder("f").add(new FileNode("x", 1));
              throwsA(IllegalArgumentException.class, () -> f.add(new FileNode("x", 2)), "second x");` },
            { name: 'A folder cannot go inside itself', code: J`
              Folder f = new Folder("f");
              throwsA(IllegalArgumentException.class, () -> f.add(f), "f into f");` },
            { name: 'A folder cannot go inside its own descendant', code: J`
              Folder top = new Folder("top");
              Folder mid = new Folder("mid");
              Folder low = new Folder("low");
              top.add(mid); mid.add(low);
              throwsA(IllegalArgumentException.class, () -> low.add(top), "top into low");` },
            { name: 'Negative file sizes are rejected', code: J`throwsA(IllegalArgumentException.class, () -> new FileNode("bad", -1), "-1 bytes");` },
          ],
          lint: [
            { re: 'instanceof\\s+Folder[\\s\\S]*size|size[\\s\\S]*instanceof\\s+Folder', note: 'Sizing checks «instanceof Folder». With a composite, just call «child.size()» and let each node answer.' },
          ],
          rubric: J`
            - «size()» and «fileCount()» recurse through the shared interface with no type checks.
            - Cycle check walks the candidate's subtree before adding.
            - Child names are unique per folder (a map from name to node, or a check).
          `,
          hints: [
            'Keep «List<Node> children» for order and check duplicate names by scanning it (or keep a «Map» alongside).',
            'Cycle check: if the child is a «Folder», reject when «child == this» or the child\'s subtree contains «this». A small recursive «contains(Node n)» on «Folder» does it.',
            '«paths()»: for each child, a file contributes «name + "/" + file.name()»; a folder contributes each of its own «paths()» prefixed with «name + "/"».',
          ],
          solution: {
            pattern: 'Composite: «Folder» and «FileNode» share «Node»; totals recurse through the interface.',
            java: J`
class FileNode implements Node {
    private final String name;
    private final long bytes;

    FileNode(String name, long bytes) {
        if (bytes < 0) throw new IllegalArgumentException("negative size for " + name);
        this.name = name;
        this.bytes = bytes;
    }

    public String name() { return name; }
    public long size() { return bytes; }
    public int fileCount() { return 1; }
}

class Folder implements Node {
    private final String name;
    private final List<Node> children = new ArrayList<>();

    Folder(String name) {
        this.name = name;
    }

    Folder add(Node child) {
        for (Node c : children) if (c.name().equals(child.name())) throw new IllegalArgumentException(name + " already has " + child.name());
        if (child instanceof Folder f && (f == this || f.contains(this))) throw new IllegalArgumentException("that would make a cycle");
        children.add(child);
        return this;
    }

    private boolean contains(Node target) {
        for (Node c : children) {
            if (c == target) return true;
            if (c instanceof Folder f && f.contains(target)) return true;
        }
        return false;
    }

    public String name() { return name; }

    public long size() {
        long total = 0;
        for (Node c : children) total += c.size();
        return total;
    }

    public int fileCount() {
        int n = 0;
        for (Node c : children) n += c.fileCount();
        return n;
    }

    Optional<FileNode> largestFile() {
        FileNode best = null;
        for (Node c : children) {
            Optional<FileNode> candidate = c instanceof Folder f ? f.largestFile() : Optional.of((FileNode) c);
            if (candidate.isPresent() && (best == null || candidate.get().size() > best.size())) best = candidate.get();
        }
        return Optional.ofNullable(best);
    }

    List<String> paths() {
        List<String> out = new ArrayList<>();
        for (Node c : children) {
            if (c instanceof Folder f) for (String p : f.paths()) out.add(name + "/" + p);
            else out.add(name + "/" + c.name());
        }
        return out;
    }
}
`,
            why: J`
              «size()» and «fileCount()» never look at types. The traversals that return *files specifically* («largestFile», «paths») do need to tell files from folders; if more such operations pile up, that is the cue for Visitor (or a sealed «Node» with a pattern-matching «switch»).
            `,
            talk: 'Files and folders share a Node interface; a folder sums its children, so any subtree answers size and file count like a single file. add() rejects duplicate names and cycles by walking the candidate folder before inserting it.',
          },
          wrong: [
            { name: 'no cycle check for descendants', java: J`
class FileNode implements Node { private final String n; private final long b; FileNode(String n, long b) { if (b < 0) throw new IllegalArgumentException(); this.n = n; this.b = b; } public String name() { return n; } public long size() { return b; } public int fileCount() { return 1; } }
class Folder implements Node {
    private final String n; private final List<Node> kids = new ArrayList<>();
    Folder(String n) { this.n = n; }
    Folder add(Node c) { for (Node k : kids) if (k.name().equals(c.name())) throw new IllegalArgumentException(); if (c == this) throw new IllegalArgumentException(); kids.add(c); return this; }
    public String name() { return n; }
    public long size() { long t = 0; for (Node k : kids) t += k.size(); return t; }
    public int fileCount() { int t = 0; for (Node k : kids) t += k.fileCount(); return t; }
    Optional<FileNode> largestFile() { FileNode best = null; for (Node k : kids) { Optional<FileNode> c = k instanceof Folder f ? f.largestFile() : Optional.of((FileNode) k); if (c.isPresent() && (best == null || c.get().size() > best.size())) best = c.get(); } return Optional.ofNullable(best); }
    List<String> paths() { List<String> out = new ArrayList<>(); for (Node k : kids) { if (k instanceof Folder f) for (String p : f.paths()) out.add(n + "/" + p); else out.add(n + "/" + k.name()); } return out; }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
