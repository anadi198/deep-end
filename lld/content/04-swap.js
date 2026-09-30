(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'swap', title: 'Swap it: Strategy, State, Command', short: 'Swap it',
    blurb: 'One interface, several implementations, pick one at runtime. The most used move in LLD.',
    intro: J`
      :::remember The move
      Put the part that varies behind **one interface**. Then the rest of the code never needs an «if» on which variant it is.
      :::

      Three patterns, one question: **who picks the implementation?**

      | Pattern | Who picks | Typical cue |
      |---|---|---|
      | Strategy | The caller | "the pricing rule can change" |
      | State | The object itself, as things happen | "a vending machine behaves differently when it has money" |
      | Command | Nobody picks: the *request* becomes an object you can store | "support undo" |
    `,
    items: [
      /* ─────────────── Strategy ─────────────── */
      {
        lesson: 'strategy', title: 'Strategy: swap the rule', mins: 7,
        remember: 'Strategy: put each interchangeable rule behind one interface, and let the caller pick which one.',
        cue: 'The rule might change, or there are several ways to do the same job → Strategy',
        body: J`
          ## The smell

          A method that branches on *which kind of rule* it is, and grows a branch every time the business invents a new one:

          ~~~java Checkout, before
          long total(List<Long> prices, String coupon) {
              long sum = 0;
              for (long p : prices) sum += p;
              if (coupon.equals("TENPERCENT")) return sum - sum / 10;
              else if (coupon.equals("FLAT200")) return Math.max(0, sum - 200);
              else if (coupon.equals("BOGO")) ...          // next sprint
              return sum;
          }
          ~~~

          Every new coupon edits «Checkout», and «Checkout» ends up knowing every promotion in the company.

          ## The move

          Pull the varying part out behind one interface. Each rule becomes a small class. «Checkout» only knows the interface.

          ~~~java after
          interface DiscountRule {
              long apply(long subtotalCents);
          }

          class PercentOff implements DiscountRule {
              private final int percent;
              PercentOff(int percent) { this.percent = percent; }
              public long apply(long subtotal) { return subtotal - subtotal * percent / 100; }
          }

          class Checkout {
              private final DiscountRule rule;
              Checkout(DiscountRule rule) { this.rule = rule; }   // the caller picks
              long total(List<Long> prices) {
                  long sum = 0;
                  for (long p : prices) sum += p;
                  return rule.apply(sum);
              }
          }
          ~~~

          ~~~mermaid Checkout depends on the interface only. New rules plug in on the right.
          classDiagram
            direction LR
            class Checkout {
              -DiscountRule rule
              +total(prices) long
            }
            class DiscountRule {
              <<interface>>
              +apply(subtotal) long
            }
            Checkout --> DiscountRule : uses
            DiscountRule <|.. NoDiscount
            DiscountRule <|.. PercentOff
            DiscountRule <|.. FlatOff
          ~~~

          ~~~seq One checkout, step by step
          actors: Client, Checkout, PercentOff
          Client -> Checkout: new Checkout(new PercentOff(10))
          note: The caller chooses the rule once, from outside.
          Client -> Checkout: total([1000, 500])
          Checkout -> Checkout: sum = 1500
          Checkout -> PercentOff: apply(1500)
          note: Checkout does not know or care which rule this is.
          PercentOff --> Checkout: 1350
          Checkout --> Client: 1350
          ~~~

          @stop

          ## In modern Java, a one-method strategy can be a lambda

          «DiscountRule» has one abstract method, so it is a *functional interface*: «new Checkout(subtotal -> subtotal / 2)» works. Use a lambda for throwaway rules; use a named class when the rule has config, validation or tests of its own.

          You have used this pattern for years: «Comparator» is a strategy for ordering, and «list.sort(byPrice)» is the caller picking it.

          :::warn When not to
          One rule, and nothing in the requirements hints at a second? Keep the plain code. Saying "I'd pull out a «DiscountRule» the moment a second promotion shows up" scores better than building the interface up front.
          :::

          :::interview Say it like this
          "The discount rule varies, so I put it behind a «DiscountRule» interface and inject it into «Checkout». A new promotion is a new class; «Checkout» never changes. That's open for extension, closed for modification."
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Payments can go through UPI, card or net banking, and the user picks at checkout. Which pattern, and who picks?',
            options: ['State, the payment object picks', 'Strategy, the caller picks based on the user\'s choice', 'Command, each payment is queued', 'Singleton, one payment processor'],
            answer: 1,
            why: 'Several ways to do the same job (pay), chosen from outside: that is Strategy. State would be right if the *payment itself* moved through stages like PENDING → PAID → REFUNDED and behaved differently in each.',
          },
        ],
      },
      {
        exercise: {
          id: 'strategy-discounts', title: 'Pluggable discount rules', kind: 'build', mins: 10, diff: 'easy', patterns: ['strategy'],
          statement: J`
            Build three discount rules and a «Checkout» that works with any of them.

            - «NoDiscount»: charges the subtotal.
            - «PercentOff(percent)»: the discount is «subtotal x percent / 100», **rounded down** to a whole cent; the total is the subtotal minus that. Reject a percent outside 0 to 100 with «IllegalArgumentException».
            - «FlatOff(cents)»: takes a fixed amount off, but the total **never goes below 0**.
            - «Checkout(rule)»: «total(prices)» sums the item prices and applies the rule. It must work with *any* «DiscountRule», including a lambda.

            Money is in cents, as «long». No «double» anywhere near money.
          `,
          given: J`
/** One pricing rule: takes the cart subtotal in cents, returns what to charge. */
interface DiscountRule {
    long apply(long subtotalCents);
}
`,
          starter: J`
class NoDiscount implements DiscountRule {
    public long apply(long subtotalCents) {
        return 0; // TODO
    }
}

class PercentOff implements DiscountRule {
    PercentOff(int percent) {
        // TODO: reject a percent outside 0..100
    }

    public long apply(long subtotalCents) {
        return 0; // TODO
    }
}

class FlatOff implements DiscountRule {
    FlatOff(long offCents) {
    }

    public long apply(long subtotalCents) {
        return 0; // TODO: never below zero
    }
}

class Checkout {
    Checkout(DiscountRule rule) {
    }

    long total(List<Long> itemPricesCents) {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'No discount: the total is the sum', ex: true, code: J`eq(1500L, new Checkout(new NoDiscount()).total(List.of(1000L, 500L)), "total");` },
            { name: '10% off 1500 is 1350', ex: true, code: J`eq(1350L, new Checkout(new PercentOff(10)).total(List.of(1000L, 500L)), "total");` },
            { name: 'Flat 200 off 1500 is 1300', ex: true, code: J`eq(1300L, new Checkout(new FlatOff(200)).total(List.of(1000L, 500L)), "total");` },
            { name: 'A flat discount never goes below zero', code: J`eq(0L, new Checkout(new FlatOff(2000)).total(List.of(1000L, 500L)), "total");` },
            { name: 'The percent discount rounds down', code: J`
              say("10% of 999 is 99.9 cents: the discount rounds down to 99, so the total is 900");
              eq(900L, new Checkout(new PercentOff(10)).total(List.of(999L)), "total");` },
            { name: '0% and 100% are allowed', code: J`
              eq(700L, new Checkout(new PercentOff(0)).total(List.of(700L)), "0% off");
              eq(0L, new Checkout(new PercentOff(100)).total(List.of(700L)), "100% off");` },
            { name: 'A percent outside 0..100 is rejected', code: J`
              throwsA(IllegalArgumentException.class, () -> new PercentOff(101), "PercentOff(101)");
              throwsA(IllegalArgumentException.class, () -> new PercentOff(-1), "PercentOff(-1)");` },
            { name: 'An empty cart costs nothing', code: J`eq(0L, new Checkout(new PercentOff(10)).total(List.of()), "total");` },
            { name: 'Any DiscountRule works, even a lambda', code: J`eq(200L, new Checkout(subtotal -> subtotal / 2).total(List.of(300L, 100L)), "half price");` },
          ],
          lint: [
            { re: 'instanceof\\s+(NoDiscount|PercentOff|FlatOff)', note: '«Checkout» checks which rule it has. The point of Strategy is that it never needs to.' },
            { re: '\\bdouble\\b|\\bfloat\\b', note: 'A «double» near money: 0.1 + 0.2 is not 0.3 in floating point. Keep cents in a «long».' },
          ],
          rubric: J`
            - «Checkout» depends only on «DiscountRule»: no «instanceof», no type codes.
            - Each rule is small and does one thing; validation happens in the constructor, so a bad rule can never exist.
            - Money stays in «long» cents; rounding is explicit.
            - Adding a fourth rule needs no change to «Checkout».
          `,
          hints: [
            '«NoDiscount» returns the subtotal unchanged. «Checkout» keeps the rule in a field and calls «rule.apply(sum)».',
            'Integer division already rounds down for positive numbers: «subtotal * percent / 100» is the discount.',
            '«FlatOff»: «Math.max(0, subtotal - off)». Throw from the «PercentOff» constructor: «if (percent < 0 || percent > 100) throw new IllegalArgumentException(...)».',
          ],
          solution: {
            pattern: 'Strategy. «Checkout» holds a «DiscountRule» and calls it; the caller picks which rule when it builds the «Checkout».',
            java: J`
class NoDiscount implements DiscountRule {
    public long apply(long subtotalCents) {
        return subtotalCents;
    }
}

class PercentOff implements DiscountRule {
    private final int percent;

    PercentOff(int percent) {
        if (percent < 0 || percent > 100) throw new IllegalArgumentException("percent must be 0..100, got " + percent);
        this.percent = percent;
    }

    public long apply(long subtotalCents) {
        long discount = subtotalCents * percent / 100;
        return subtotalCents - discount;
    }
}

class FlatOff implements DiscountRule {
    private final long offCents;

    FlatOff(long offCents) {
        if (offCents < 0) throw new IllegalArgumentException("offCents must not be negative");
        this.offCents = offCents;
    }

    public long apply(long subtotalCents) {
        return Math.max(0, subtotalCents - offCents);
    }
}

class Checkout {
    private final DiscountRule rule;

    Checkout(DiscountRule rule) {
        this.rule = Objects.requireNonNull(rule);
    }

    long total(List<Long> itemPricesCents) {
        long subtotal = 0;
        for (long price : itemPricesCents) subtotal += price;
        return rule.apply(subtotal);
    }
}
`,
            why: J`
              Each rule validates itself in its constructor, so an invalid rule cannot exist and «Checkout» never has to check. The discount is computed with integer maths, which rounds down for positive numbers, exactly as the statement asks.
            `,
            followups: J`
              - **"Stack two promotions."** Add a «CombinedRule(List<DiscountRule>)» that applies them in order. It is itself a «DiscountRule», so «Checkout» still does not change. (That one is Composite, from a later module.)
              - **"Pick the best rule for the customer."** A «BestOf» rule that tries each and returns the lowest total.
              - **"Rules come from config."** A small factory maps a config name like «PERCENT:10» to a rule object. «Checkout» stays untouched.
            `,
            talk: 'The discount varies, so it lives behind a DiscountRule interface that Checkout receives in its constructor. New promotions are new classes and Checkout never changes; stacking promotions is one more rule that wraps a list of rules.',
          },
          wrong: [
            { name: 'double maths', java: J`
class NoDiscount implements DiscountRule { public long apply(long s) { return s; } }
class PercentOff implements DiscountRule {
    private final int p;
    PercentOff(int p) { if (p < 0 || p > 100) throw new IllegalArgumentException(); this.p = p; }
    public long apply(long s) { return Math.round(s * (100 - p) / 100.0); }
}
class FlatOff implements DiscountRule { private final long o; FlatOff(long o) { this.o = o; } public long apply(long s) { return Math.max(0, s - o); } }
class Checkout { private final DiscountRule r; Checkout(DiscountRule r) { this.r = r; } long total(List<Long> ps) { long s = 0; for (long p : ps) s += p; return r.apply(s); } }
` },
            { name: 'flat discount goes negative', java: J`
class NoDiscount implements DiscountRule { public long apply(long s) { return s; } }
class PercentOff implements DiscountRule {
    private final int p;
    PercentOff(int p) { if (p < 0 || p > 100) throw new IllegalArgumentException(); this.p = p; }
    public long apply(long s) { return s - s * p / 100; }
}
class FlatOff implements DiscountRule { private final long o; FlatOff(long o) { this.o = o; } public long apply(long s) { return s - o; } }
class Checkout { private final DiscountRule r; Checkout(DiscountRule r) { this.r = r; } long total(List<Long> ps) { long s = 0; for (long p : ps) s += p; return r.apply(s); } }
` },
          ],
        },
      },
      {
        exercise: {
          id: 'shipping-refactor', title: 'Refactor a switch into strategies', kind: 'refactor', mins: 12, diff: 'medium', patterns: ['strategy'],
          statement: J`
            «ShippingCalculator» works, but it is a «switch» over the carrier name. Product now wants carriers added **without editing the calculator**: «with(name, rate)» returns a new calculator that also knows that carrier (or replaces it), and leaves the original untouched.

            You cannot add a «case» at runtime, so the «switch» has to go. Keep every existing price exactly the same:

            | Carrier | Price in cents |
            |---|---|
            | «POST» | 100, plus 20 for every started 100 g |
            | «COURIER» | 400 up to 1000 g, plus 150 for every started kilogram above that |
            | «FREIGHT» | 2500 at any weight |

            An unknown carrier throws «IllegalArgumentException».
          `,
          given: J`
/** What a carrier charges for a parcel. */
interface ShippingRate {
    long costCents(int grams);
}
`,
          starter: J`
class ShippingCalculator {
    static ShippingCalculator standard() {
        return new ShippingCalculator();
    }

    long quote(String carrier, int grams) {
        switch (carrier) {
            case "POST":
                return 100 + ceilDiv(grams, 100) * 20;
            case "COURIER":
                if (grams <= 1000) return 400;
                return 400 + ceilDiv(grams - 1000, 1000) * 150;
            case "FREIGHT":
                return 2500;
            default:
                throw new IllegalArgumentException("unknown carrier " + carrier);
        }
    }

    /** A new calculator that also knows this carrier (or replaces it). This one stays unchanged. */
    ShippingCalculator with(String carrier, ShippingRate rate) {
        throw new UnsupportedOperationException("TODO: you can't add a case to a switch at runtime");
    }

    static long ceilDiv(int a, int b) {
        return (a + b - 1) / b;
    }
}
`,
          tests: [
            { name: 'POST, 250 g costs 160', ex: true, code: J`eq(160L, ShippingCalculator.standard().quote("POST", 250), "POST 250 g");` },
            { name: 'COURIER, 800 g costs 400', ex: true, code: J`eq(400L, ShippingCalculator.standard().quote("COURIER", 800), "COURIER 800 g");` },
            { name: 'with() adds a carrier', ex: true, code: J`
              ShippingCalculator c = ShippingCalculator.standard().with("DRONE", g -> 999);
              eq(999L, c.quote("DRONE", 10), "DRONE");
              eq(160L, c.quote("POST", 250), "POST still works");` },
            { name: 'FREIGHT costs 2500 at any weight', code: J`eq(2500L, ShippingCalculator.standard().quote("FREIGHT", 50000), "FREIGHT");` },
            { name: 'COURIER above 1 kg charges per started kilogram', code: J`
              eq(550L, ShippingCalculator.standard().quote("COURIER", 1500), "1500 g");
              eq(700L, ShippingCalculator.standard().quote("COURIER", 2001), "2001 g");` },
            { name: 'POST at 0 g is the base price', code: J`eq(100L, ShippingCalculator.standard().quote("POST", 0), "POST 0 g");` },
            { name: 'An unknown carrier is rejected', code: J`throwsA(IllegalArgumentException.class, () -> ShippingCalculator.standard().quote("PIGEON", 10), "PIGEON");` },
            { name: 'with() leaves the original calculator unchanged', code: J`
              ShippingCalculator base = ShippingCalculator.standard();
              base.with("DRONE", g -> 1);
              throwsA(IllegalArgumentException.class, () -> base.quote("DRONE", 1), "the original must not know DRONE");` },
            { name: 'with() can replace an existing carrier', code: J`eq(1000L, ShippingCalculator.standard().with("FREIGHT", g -> 1000).quote("FREIGHT", 5), "new FREIGHT price");` },
          ],
          lint: [
            { re: 'switch\\s*\\(\\s*carrier', note: 'Still a «switch» on the carrier name: adding a carrier means editing this class.' },
          ],
          rubric: J`
            - The carrier name maps to a «ShippingRate» (a map of strategies), not to a «switch».
            - «with()» copies the map, so the calculator is effectively immutable and safe to share.
            - The pricing rules are unchanged, including the "every started 100 g" rounding.
            - Unknown carriers fail loudly.
          `,
          hints: [
            'Replace the switch with a «Map<String, ShippingRate>». Each case body becomes one rate.',
            '«with()» must not change «this»: copy the map, put the new carrier in the copy, and return a new calculator built from it.',
            'Rates can be lambdas: «grams -> 100 + ceilDiv(grams, 100) * 20».',
          ],
          solution: {
            pattern: 'Strategy, keyed by name. The calculator looks up the carrier\'s «ShippingRate» and calls it.',
            java: J`
class ShippingCalculator {
    private final Map<String, ShippingRate> rates;

    private ShippingCalculator(Map<String, ShippingRate> rates) {
        this.rates = rates;
    }

    static ShippingCalculator standard() {
        Map<String, ShippingRate> rates = new HashMap<>();
        rates.put("POST", grams -> 100 + ceilDiv(grams, 100) * 20);
        rates.put("COURIER", grams -> grams <= 1000 ? 400 : 400 + ceilDiv(grams - 1000, 1000) * 150);
        rates.put("FREIGHT", grams -> 2500);
        return new ShippingCalculator(rates);
    }

    long quote(String carrier, int grams) {
        ShippingRate rate = rates.get(carrier);
        if (rate == null) throw new IllegalArgumentException("unknown carrier " + carrier);
        return rate.costCents(grams);
    }

    ShippingCalculator with(String carrier, ShippingRate rate) {
        Map<String, ShippingRate> next = new HashMap<>(rates);
        next.put(carrier, rate);
        return new ShippingCalculator(next);
    }

    static long ceilDiv(int a, int b) {
        return (a + b - 1) / b;
    }
}
`,
            why: J`
              The «switch» becomes data: a map from carrier name to strategy. «with()» never touches «this»; it copies the map, so every calculator is effectively immutable and can be shared across threads without locks.

              In an interview, one class per carrier («PostRate», «CourierRate») reads better when the rules are long or need their own tests. Lambdas are fine for one-liners like these.
            `,
            followups: J`
              - **"Carriers come from a config file."** Parse each line into a «ShippingRate» and build the map. The calculator is unchanged.
              - **"Pick the cheapest carrier."** Iterate the map and take the minimum. Easy, because every rate has the same interface.
            `,
            talk: 'The switch became a map from carrier name to a ShippingRate strategy. Adding a carrier is data, not code, and with() copies the map so calculators are immutable and safe to share.',
          },
          wrong: [
            { name: 'with() mutates the original', java: J`
class ShippingCalculator {
    private final Map<String, ShippingRate> rates = new HashMap<>();
    static ShippingCalculator standard() {
        ShippingCalculator c = new ShippingCalculator();
        c.rates.put("POST", g -> 100 + ceilDiv(g, 100) * 20);
        c.rates.put("COURIER", g -> g <= 1000 ? 400 : 400 + ceilDiv(g - 1000, 1000) * 150);
        c.rates.put("FREIGHT", g -> 2500);
        return c;
    }
    long quote(String carrier, int grams) { ShippingRate r = rates.get(carrier); if (r == null) throw new IllegalArgumentException(); return r.costCents(grams); }
    ShippingCalculator with(String carrier, ShippingRate rate) { rates.put(carrier, rate); return this; }
    static long ceilDiv(int a, int b) { return (a + b - 1) / b; }
}
` },
          ],
        },
      },

      /* ─────────────── State ─────────────── */
      {
        lesson: 'state', title: 'State: let the object switch itself', mins: 8,
        remember: 'State: each state is a class that handles every action and returns the next state. No switch on the state anywhere.',
        cue: 'The same action means different things depending on where the object is in its lifecycle → State',
        body: J`
          ## The smell

          An enum field called «state», and a «switch (state)» inside **every** method:

          ~~~java VendingMachine, before
          void insert(int cents) {
              switch (state) {
                  case IDLE:      balance += cents; state = HAS_MONEY; break;
                  case HAS_MONEY: balance += cents; break;
                  case SOLD_OUT:  throw new IllegalStateException("sold out");
              }
          }
          int select(String item) {
              switch (state) { ... }      // again
          }
          ~~~

          Add a «MAINTENANCE» state and you edit every method, hoping you did not miss one.

          ## The move

          Turn each state into a class. Each class answers every action **for that state**, and returns the state to move to.

          ~~~java
          interface MachineState {
              MachineState insert(VendingMachine m, int cents);
              MachineState select(VendingMachine m, String item);
          }

          class Idle implements MachineState {
              public MachineState insert(VendingMachine m, int cents) { m.addMoney(cents); return new HasMoney(); }
              public MachineState select(VendingMachine m, String item) { throw new IllegalStateException("insert money first"); }
          }
          // HasMoney, SoldOut: same shape

          class VendingMachine {
              private MachineState state = new Idle();
              void insert(int cents) { state = state.insert(this, cents); }   // no switch
          }
          ~~~

          ~~~mermaid The state diagram is the design: one class per box, one method per arrow label.
          stateDiagram-v2
            [*] --> Idle
            Idle --> HasMoney : insert
            HasMoney --> HasMoney : insert
            HasMoney --> Idle : select, stock left / refund
            HasMoney --> SoldOut : select, last item
            SoldOut --> [*]
          ~~~

          ~~~seq Buying a cola
          actors: Customer, VendingMachine, Idle, HasMoney
          state VendingMachine: IDLE
          Customer -> VendingMachine: insert(200)
          VendingMachine -> Idle: insert(m, 200)
          Idle --> VendingMachine: new HasMoney()
          state VendingMachine: HAS_MONEY
          Customer -> VendingMachine: select("COLA")
          VendingMachine -> HasMoney: select(m, "COLA")
          note: HasMoney checks stock and money, dispenses, and decides what comes next.
          HasMoney --> VendingMachine: new Idle()
          state VendingMachine: IDLE
          ~~~

          @stop

          ## Strategy vs State

          Same code shape: an interface with several implementations. The difference is **who switches**:
          - **Strategy:** the *caller* sets it once («new Checkout(new PercentOff(10))»).
          - **State:** the *object* swaps its own state as events happen, from inside.

          ## The compact Java version: an enum with behaviour

          ~~~java
          enum Light {
              RED    { Light next() { return GREEN; } },
              GREEN  { Light next() { return YELLOW; } },
              YELLOW { Light next() { return RED; } };
              abstract Light next();
          }
          ~~~

          Great in an interview when states hold no data of their own. Use classes when a state carries data (say, «HasMoney» remembering a deadline).

          :::warn When not to
          Two states and two actions? An enum and one «if» is clearer. State pays off when states × actions starts to feel like a grid.
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'An order goes CREATED → PAID → SHIPPED → DELIVERED, and "cancel" is free when CREATED, refunds when PAID, and is refused once SHIPPED. Best fit?',
            options: ['Strategy: inject a CancelPolicy', 'State: each order status is a class that handles cancel its own way', 'Observer: notify on cancel', 'Builder: build the order step by step'],
            answer: 1,
            why: 'The same action (cancel) means different things depending on where the order is in its lifecycle, and the order moves itself between statuses. That is the State cue.',
          },
        ],
      },
      {
        exercise: {
          id: 'state-vending', title: 'A vending machine with real states', kind: 'build', mins: 15, diff: 'medium', patterns: ['state'],
          statement: J`
            Build a «VendingMachine» with three states: «IDLE», «HAS_MONEY» and «SOLD_OUT».

            - It starts «IDLE», or «SOLD_OUT» if every item has zero stock.
            - «insert(cents)»: a positive amount goes into the balance, and the machine is «HAS_MONEY». Zero or less: «IllegalArgumentException». When «SOLD_OUT»: «IllegalStateException» (the money is not taken).
            - «select(item)»:
              - an item the machine does not sell: «IllegalArgumentException», always.
              - in «IDLE»: «IllegalStateException» ("insert money first").
              - in «HAS_MONEY»: if that item is out of stock, or the balance is short, throw «IllegalStateException» **and keep the money**. Otherwise dispense one, return the change («balance - price»), and go to «IDLE», or «SOLD_OUT» if that was the last item of all.
            - «refund()»: returns the whole balance (0 if none) and goes to «IDLE» (a sold-out machine stays «SOLD_OUT»).
            - «state()» returns the state name; «balance()» the money inside.

            Try it without a single «switch» or «if» on the state.
          `,
          starter: J`
class VendingMachine {
    VendingMachine(Map<String, Integer> pricesCents, Map<String, Integer> stock) {
        // TODO
    }

    void insert(int cents) {
        // TODO
    }

    /** Returns the change. */
    int select(String item) {
        return 0; // TODO
    }

    /** Returns everything inserted so far. */
    int refund() {
        return 0; // TODO
    }

    String state() {
        return "IDLE"; // TODO: "IDLE", "HAS_MONEY" or "SOLD_OUT"
    }

    int balance() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'Starts IDLE when there is stock', ex: true, code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150, "CHIPS", 100), Map.of("COLA", 2, "CHIPS", 2));
              eq("IDLE", m.state(), "state");` },
            { name: 'Pay, buy, get change', ex: true, code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150, "CHIPS", 100), Map.of("COLA", 2, "CHIPS", 2));
              m.insert(200);
              eq("HAS_MONEY", m.state(), "after insert");
              eq(50, m.select("COLA"), "change");
              eq("IDLE", m.state(), "after the sale");
              eq(0, m.balance(), "balance");` },
            { name: 'Buying before paying is refused', ex: true, code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150), Map.of("COLA", 2));
              throwsA(IllegalStateException.class, () -> m.select("COLA"), "select in IDLE");` },
            { name: 'Coins add up', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150), Map.of("COLA", 2));
              m.insert(100); m.insert(100);
              eq(200, m.balance(), "balance");
              eq(50, m.select("COLA"), "change");` },
            { name: 'Not enough money: refused, money kept', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150), Map.of("COLA", 2));
              m.insert(100);
              throwsA(IllegalStateException.class, () -> m.select("COLA"), "select with 100 of 150");
              eq(100, m.balance(), "balance kept");
              eq("HAS_MONEY", m.state(), "state");` },
            { name: 'Refund returns everything', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150), Map.of("COLA", 2));
              m.insert(120);
              eq(120, m.refund(), "refund");
              eq("IDLE", m.state(), "state");
              eq(0, m.refund(), "second refund");` },
            { name: 'Selling the last item makes it SOLD_OUT', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150, "CHIPS", 100), Map.of("COLA", 1, "CHIPS", 0));
              m.insert(200);
              eq(50, m.select("COLA"), "change");
              eq("SOLD_OUT", m.state(), "state");
              throwsA(IllegalStateException.class, () -> m.insert(100), "insert when sold out");
              eq(0, m.balance(), "no money taken");` },
            { name: 'An empty machine starts SOLD_OUT', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150), Map.of("COLA", 0));
              eq("SOLD_OUT", m.state(), "state");` },
            { name: 'A sold-out item is refused, others still sell', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150, "CHIPS", 100), Map.of("COLA", 0, "CHIPS", 2));
              m.insert(200);
              throwsA(IllegalStateException.class, () -> m.select("COLA"), "sold-out COLA");
              eq(200, m.balance(), "money kept");
              eq(100, m.select("CHIPS"), "change for CHIPS");` },
            { name: 'Unknown items and bad amounts are IllegalArgumentException', code: J`
              VendingMachine m = new VendingMachine(Map.of("COLA", 150), Map.of("COLA", 2));
              throwsA(IllegalArgumentException.class, () -> m.insert(0), "insert(0)");
              m.insert(200);
              throwsA(IllegalArgumentException.class, () -> m.select("GUM"), "unknown item");` },
          ],
          lint: [
            { re: 'switch\\s*\\(\\s*(this\\.)?state\\b|\\bstate\\s*==|\\.equals\\(\\s*"(IDLE|HAS_MONEY|SOLD_OUT)"', note: 'The machine branches on its state. With the State pattern, the current state object decides, and the machine just delegates.' },
          ],
          rubric: J`
            - One class (or enum constant) per state; each handles every action for that state.
            - The machine delegates: «state = state.insert(this, cents)», with no «switch» on the state.
            - Rules that apply in every state (unknown item, non-positive amount) are checked once, in the machine, not copied into every state.
            - Failed actions leave the machine exactly as it was (money kept, state unchanged).
          `,
          hints: [
            'Write «interface MachineState { MachineState insert(VendingMachine m, int cents); MachineState select(VendingMachine m, String item); MachineState refund(VendingMachine m); String name(); }» and three classes.',
            'Give the machine small helpers the states can call: «addMoney», «stockOf», «priceOf», «dispense», «allSoldOut». States decide; the machine holds the data.',
            '«select» needs to return change, but state methods return the next state. Let «dispense» store the change in a field, and have the machine\'s «select» read it after the state call.',
          ],
          solution: {
            pattern: 'State. Each state class answers every action for its state and returns the next state; the machine only delegates.',
            java: J`
interface MachineState {
    MachineState insert(VendingMachine m, int cents);
    MachineState select(VendingMachine m, String item);
    MachineState refund(VendingMachine m);
    String name();
}

class Idle implements MachineState {
    public MachineState insert(VendingMachine m, int cents) {
        m.addMoney(cents);
        return new HasMoney();
    }

    public MachineState select(VendingMachine m, String item) {
        throw new IllegalStateException("insert money first");
    }

    public MachineState refund(VendingMachine m) {
        return this;
    }

    public String name() {
        return "IDLE";
    }
}

class HasMoney implements MachineState {
    public MachineState insert(VendingMachine m, int cents) {
        m.addMoney(cents);
        return this;
    }

    public MachineState select(VendingMachine m, String item) {
        if (m.stockOf(item) == 0) throw new IllegalStateException(item + " is sold out");
        if (m.balance() < m.priceOf(item)) throw new IllegalStateException("not enough money for " + item);
        m.dispense(item);
        return m.allSoldOut() ? new SoldOut() : new Idle();
    }

    public MachineState refund(VendingMachine m) {
        return new Idle();
    }

    public String name() {
        return "HAS_MONEY";
    }
}

class SoldOut implements MachineState {
    public MachineState insert(VendingMachine m, int cents) {
        throw new IllegalStateException("sold out");
    }

    public MachineState select(VendingMachine m, String item) {
        throw new IllegalStateException("sold out");
    }

    public MachineState refund(VendingMachine m) {
        return this;
    }

    public String name() {
        return "SOLD_OUT";
    }
}

class VendingMachine {
    private final Map<String, Integer> prices;
    private final Map<String, Integer> stock;
    private MachineState state;
    private int balance;
    private int change;

    VendingMachine(Map<String, Integer> pricesCents, Map<String, Integer> stock) {
        this.prices = new HashMap<>(pricesCents);
        this.stock = new HashMap<>(stock);
        this.state = allSoldOut() ? new SoldOut() : new Idle();
    }

    void insert(int cents) {
        if (cents <= 0) throw new IllegalArgumentException("insert a positive amount");
        state = state.insert(this, cents);
    }

    int select(String item) {
        if (!prices.containsKey(item)) throw new IllegalArgumentException("no such item: " + item);
        state = state.select(this, item);
        int c = change;
        change = 0;
        return c;
    }

    int refund() {
        int back = balance;
        balance = 0;
        state = state.refund(this);
        return back;
    }

    String state() {
        return state.name();
    }

    int balance() {
        return balance;
    }

    void addMoney(int cents) {
        balance += cents;
    }

    int stockOf(String item) {
        return stock.getOrDefault(item, 0);
    }

    int priceOf(String item) {
        return prices.get(item);
    }

    void dispense(String item) {
        stock.put(item, stock.get(item) - 1);
        change = balance - prices.get(item);
        balance = 0;
    }

    boolean allSoldOut() {
        for (int n : stock.values()) if (n > 0) return false;
        return true;
    }
}
`,
            why: J`
              The machine keeps the data (prices, stock, balance) and asks the current state what each action means. Rules that hold in every state (an unknown item, a non-positive coin) are checked once, in the machine, before delegating. A failed action throws before anything changes, so the machine is never left half-updated.
            `,
            followups: J`
              - **"Add a MAINTENANCE state"** where only an operator can restock. One new class, plus one transition; nothing else changes.
              - **"Return change as coins."** That is Chain of Responsibility: 10s, then 5s, then 1s, each handler takes what it can.
            `,
            talk: 'Each machine state is a class that handles insert, select and refund for that state and returns the next state. The machine holds the data and delegates, so adding a state is one new class instead of a new case in every method.',
          },
          wrong: [
            { name: 'refund in HAS_MONEY forgets to go IDLE', java: J`
class VendingMachine {
    private final Map<String, Integer> prices, stock;
    private String state; private int balance;
    VendingMachine(Map<String, Integer> p, Map<String, Integer> s) { prices = new HashMap<>(p); stock = new HashMap<>(s); state = soldOut() ? "SOLD_OUT" : "IDLE"; }
    boolean soldOut() { for (int n : stock.values()) if (n > 0) return false; return true; }
    void insert(int c) { if (c <= 0) throw new IllegalArgumentException(); if (state.equals("SOLD_OUT")) throw new IllegalStateException(); balance += c; state = "HAS_MONEY"; }
    int select(String i) {
        if (!prices.containsKey(i)) throw new IllegalArgumentException();
        if (!state.equals("HAS_MONEY")) throw new IllegalStateException();
        if (stock.get(i) == 0 || balance < prices.get(i)) throw new IllegalStateException();
        stock.put(i, stock.get(i) - 1); int ch = balance - prices.get(i); balance = 0; state = soldOut() ? "SOLD_OUT" : "IDLE"; return ch;
    }
    int refund() { int b = balance; balance = 0; return b; }
    String state() { return state; }
    int balance() { return balance; }
}
` },
          ],
        },
      },

      /* ─────────────── Command ─────────────── */
      {
        lesson: 'command', title: 'Command: make the action an object', mins: 6,
        remember: 'Command: turn each action into an object with execute() and undo(); a stack of done commands gives you undo for free.',
        cue: 'Undo and redo, a job queue, retries, or "log every action" → Command',
        body: J`
          ## The idea in one line

          Instead of *calling* «doc.append("hi")», you *create* «new Append("hi")» and hand it to someone who runs it. Now the action is a value: you can keep it, queue it, retry it, or reverse it.

          ~~~java
          interface EditCommand {
              void execute(StringBuilder doc);
              void undo(StringBuilder doc);
          }

          class Append implements EditCommand {
              private final String text;
              Append(String text) { this.text = text; }
              public void execute(StringBuilder doc) { doc.append(text); }
              public void undo(StringBuilder doc) { doc.setLength(doc.length() - text.length()); }
          }
          ~~~

          ## Undo is two stacks

          ~~~seq Type, undo, redo
          actors: User, Editor, DoneStack, UndoneStack
          User -> Editor: run(Append("ab"))
          Editor -> DoneStack: push
          User -> Editor: undo()
          Editor -> DoneStack: pop
          note: The command reverses itself: undo(doc).
          Editor -> UndoneStack: push
          User -> Editor: redo()
          Editor -> UndoneStack: pop
          Editor -> DoneStack: push
          note: A brand-new command clears UndoneStack: redo after a fresh edit makes no sense.
          ~~~

          @stop

          :::key The rule people forget
          A command that deletes something must **remember what it deleted** when it runs, or it has nothing to put back on undo.
          :::

          ## Where you already use it

          Every «Runnable» you submit to an executor is a command: an action packed into an object and run later, somewhere else. Job queues, retry-with-backoff and audit logs are all this pattern.

          ## Strategy vs Command

          Both are "an interface with one method". A **strategy** is *how* to do something (a rule you plug in). A **command** is *a thing to do* (a request you can store). If you would put it on a queue or an undo stack, it is a command.

          @quiz 0
        `,
        quiz: [
          {
            q: 'A food app must retry failed "notify restaurant" calls later, in order. What is the key move?',
            options: ['Make «NotifyRestaurant» a command object and put it on a retry queue', 'Make the notifier a Singleton', 'Use State for the notifier', 'Add a Decorator that logs failures'],
            answer: 0,
            why: 'Retrying later needs the request to exist as a value you can store and replay. That is Command. (A retrying Decorator could also work for immediate retries, but "later, in order" needs a queue of commands.)',
          },
        ],
      },
      {
        exercise: {
          id: 'command-editor', title: 'Undo and redo for a text editor', kind: 'build', mins: 12, diff: 'medium', patterns: ['command'],
          statement: J`
            Build an «Editor» where every change is a command that can undo itself.

            - «Append(text)» adds text at the end.
            - «DeleteLast(n)» removes the last «n» characters (or all of them, if there are fewer). On undo it puts back **exactly** what it removed.
            - «Editor.run(command)» executes it and remembers it.
            - «undo()» reverses the most recent command; «redo()» re-applies the most recently undone one. Both return «false» when there is nothing to do.
            - Running a **new** command clears the redo history.
          `,
          given: J`
/** An action on the document that knows how to reverse itself. */
interface EditCommand {
    void execute(StringBuilder doc);
    void undo(StringBuilder doc);
}
`,
          starter: J`
class Append implements EditCommand {
    Append(String text) {
    }

    public void execute(StringBuilder doc) {
    }

    public void undo(StringBuilder doc) {
    }
}

class DeleteLast implements EditCommand {
    DeleteLast(int count) {
    }

    public void execute(StringBuilder doc) {
    }

    public void undo(StringBuilder doc) {
    }
}

class Editor {
    private final StringBuilder doc = new StringBuilder();

    String text() {
        return doc.toString();
    }

    void run(EditCommand command) {
        // TODO
    }

    boolean undo() {
        return false; // TODO
    }

    boolean redo() {
        return false; // TODO
    }
}
`,
          tests: [
            { name: 'Appends build the text', ex: true, code: J`
              Editor e = new Editor();
              e.run(new Append("ab")); e.run(new Append("cd"));
              eq("abcd", e.text(), "text");` },
            { name: 'Undo reverses the last command', ex: true, code: J`
              Editor e = new Editor();
              e.run(new Append("ab")); e.run(new Append("cd"));
              ok(e.undo(), "undo returns true");
              eq("ab", e.text(), "text");` },
            { name: 'Redo puts it back', ex: true, code: J`
              Editor e = new Editor();
              e.run(new Append("ab")); e.run(new Append("cd"));
              e.undo();
              ok(e.redo(), "redo returns true");
              eq("abcd", e.text(), "text");` },
            { name: 'Nothing to undo or redo returns false', code: J`
              Editor e = new Editor();
              no(e.undo(), "undo on an empty editor");
              no(e.redo(), "redo on an empty editor");` },
            { name: 'DeleteLast remembers what it removed', code: J`
              Editor e = new Editor();
              e.run(new Append("hello")); e.run(new DeleteLast(2));
              eq("hel", e.text(), "after delete");
              e.undo();
              eq("hello", e.text(), "after undo");` },
            { name: 'Deleting more than there is', code: J`
              Editor e = new Editor();
              e.run(new Append("hi")); e.run(new DeleteLast(5));
              eq("", e.text(), "after delete");
              e.undo();
              eq("hi", e.text(), "after undo");` },
            { name: 'A new command clears redo', code: J`
              Editor e = new Editor();
              e.run(new Append("a")); e.run(new Append("b"));
              e.undo();
              e.run(new Append("c"));
              no(e.redo(), "redo after a new command");
              eq("ac", e.text(), "text");` },
            { name: 'Undo everything, then redo everything', code: J`
              Editor e = new Editor();
              e.run(new Append("x")); e.run(new DeleteLast(1)); e.run(new Append("yz"));
              ok(e.undo() && e.undo() && e.undo(), "three undos");
              no(e.undo(), "fourth undo");
              eq("", e.text(), "all undone");
              ok(e.redo() && e.redo() && e.redo(), "three redos");
              eq("yz", e.text(), "all redone");` },
          ],
          lint: [
            { re: 'instanceof\\s+(Append|DeleteLast)', note: 'The editor checks command types. Each command should know how to undo itself, so the editor never has to.' },
          ],
          rubric: J`
            - Each command knows how to execute and undo itself; the editor never checks command types.
            - «DeleteLast» captures the removed text at execute time.
            - Two stacks (done, undone), and a new command clears the undone stack.
          `,
          hints: [
            'Use two «Deque<EditCommand>»: «done» and «undone». «push» and «pop» give you stack behaviour.',
            '«DeleteLast.execute» should save «doc.substring(doc.length() - n)» in a field before shortening the document.',
          ],
          solution: {
            pattern: 'Command, with two stacks for undo and redo.',
            java: J`
class Append implements EditCommand {
    private final String text;

    Append(String text) {
        this.text = text;
    }

    public void execute(StringBuilder doc) {
        doc.append(text);
    }

    public void undo(StringBuilder doc) {
        doc.setLength(doc.length() - text.length());
    }
}

class DeleteLast implements EditCommand {
    private final int count;
    private String removed = "";

    DeleteLast(int count) {
        this.count = count;
    }

    public void execute(StringBuilder doc) {
        int n = Math.min(count, doc.length());
        removed = doc.substring(doc.length() - n);
        doc.setLength(doc.length() - n);
    }

    public void undo(StringBuilder doc) {
        doc.append(removed);
    }
}

class Editor {
    private final StringBuilder doc = new StringBuilder();
    private final Deque<EditCommand> done = new ArrayDeque<>();
    private final Deque<EditCommand> undone = new ArrayDeque<>();

    String text() {
        return doc.toString();
    }

    void run(EditCommand command) {
        command.execute(doc);
        done.push(command);
        undone.clear();
    }

    boolean undo() {
        if (done.isEmpty()) return false;
        EditCommand c = done.pop();
        c.undo(doc);
        undone.push(c);
        return true;
    }

    boolean redo() {
        if (undone.isEmpty()) return false;
        EditCommand c = undone.pop();
        c.execute(doc);
        done.push(c);
        return true;
    }
}
`,
            followups: J`
              - **"Limit history to 100 steps."** Drop from the bottom of «done» when it grows past 100.
              - **"Group edits into one undo step"** (typing a word). A «MacroCommand» holding a list of commands: execute runs them in order, undo reverses them in reverse order. That is Composite again.
            `,
            talk: 'Every edit is a command object that can execute and undo itself. The editor keeps a done stack and an undone stack; undo pops one and reverses it, and any new command clears redo.',
          },
          wrong: [
            { name: 'redo not cleared', java: J`
class Append implements EditCommand { private final String t; Append(String t) { this.t = t; } public void execute(StringBuilder d) { d.append(t); } public void undo(StringBuilder d) { d.setLength(d.length() - t.length()); } }
class DeleteLast implements EditCommand { private final int c; private String r = ""; DeleteLast(int c) { this.c = c; } public void execute(StringBuilder d) { int n = Math.min(c, d.length()); r = d.substring(d.length() - n); d.setLength(d.length() - n); } public void undo(StringBuilder d) { d.append(r); } }
class Editor {
    private final StringBuilder doc = new StringBuilder();
    private final Deque<EditCommand> done = new ArrayDeque<>(), undone = new ArrayDeque<>();
    String text() { return doc.toString(); }
    void run(EditCommand c) { c.execute(doc); done.push(c); }
    boolean undo() { if (done.isEmpty()) return false; EditCommand c = done.pop(); c.undo(doc); undone.push(c); return true; }
    boolean redo() { if (undone.isEmpty()) return false; EditCommand c = undone.pop(); c.execute(doc); done.push(c); return true; }
}
` },
            { name: 'delete forgets what it removed', java: J`
class Append implements EditCommand { private final String t; Append(String t) { this.t = t; } public void execute(StringBuilder d) { d.append(t); } public void undo(StringBuilder d) { d.setLength(d.length() - t.length()); } }
class DeleteLast implements EditCommand { private final int c; DeleteLast(int c) { this.c = c; } public void execute(StringBuilder d) { d.setLength(Math.max(0, d.length() - c)); } public void undo(StringBuilder d) { } }
class Editor {
    private final StringBuilder doc = new StringBuilder();
    private final Deque<EditCommand> done = new ArrayDeque<>(), undone = new ArrayDeque<>();
    String text() { return doc.toString(); }
    void run(EditCommand c) { c.execute(doc); done.push(c); undone.clear(); }
    boolean undo() { if (done.isEmpty()) return false; EditCommand c = done.pop(); c.undo(doc); undone.push(c); return true; }
    boolean redo() { if (undone.isEmpty()) return false; EditCommand c = undone.pop(); c.execute(doc); done.push(c); return true; }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
