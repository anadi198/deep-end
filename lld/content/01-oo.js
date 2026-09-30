(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'oo', title: 'OO tools that designs are built from', short: 'OO tools',
    blurb: 'Composition over inheritance, and small immutable value objects. The two habits that make every pattern easier.',
    items: [
      {
        lesson: 'composition', title: 'Composition over inheritance', mins: 6,
        remember: 'Inherit only for a true "is-a" that keeps the parent\'s promises. Otherwise hold the other object in a field and delegate to it.',
        cue: 'You are about to extend a class just to reuse some of its code → hold it in a field instead (composition)',
        body: J`
          ## The classic trap

          You want a set that counts how many elements were ever added. Extending «HashSet» looks obvious:

          ~~~java
          class CountingSet<E> extends HashSet<E> {
              int added;
              @Override public boolean add(E e) { added++; return super.add(e); }
              @Override public boolean addAll(Collection<? extends E> c) { added += c.size(); return super.addAll(c); }
          }
          ~~~

          «addAll(List.of("a", "b", "c"))» leaves «added» at **6**, not 3. «HashSet.addAll» happens to call «add» for each element, so every element is counted twice. Your class depends on an *implementation detail* of its parent, and the next JDK release could change it. This is the **fragile base class** problem.

          ## The fix: wrap, don't extend

          ~~~java
          class CountingSet<E> {
              private final Set<E> inner;             // any Set: HashSet, TreeSet, ...
              private int added;
              CountingSet(Set<E> inner) { this.inner = inner; }
              boolean add(E e) { added++; return inner.add(e); }
              boolean addAll(Collection<? extends E> c) { added += c.size(); return inner.addAll(c); }
          }
          ~~~

          Now «inner.addAll» calling «inner.add» internally never reaches your counter. And it works with *any* «Set», which the subclass never could. (If it also implemented «Set» and forwarded every method, that would be a Decorator.)

          @stop

          ## When inheritance *is* right

          - The subclass truly **is a** kind of the parent, and keeps every promise the parent makes (see Liskov in the SOLID module).
          - You control both classes, so the parent cannot change under you.
          - A small abstract base shares code between sibling classes you own (the «AddOn» base in the coffee exercise).

          ## Interface or abstract class?

          | Use | When |
          |---|---|
          | Interface | describing a *capability* («Comparable», «DiscountRule»); a class can have many |
          | Abstract class | sharing *state or code* between closely related classes you own |

          In LLD answers, default to interfaces for every "this can vary" point, and reach for an abstract base only to remove duplication.

          @quiz 0
        `,
        quiz: [
          {
            q: '«Stack extends Vector» is in the JDK. What is the design problem?',
            options: ['Nothing, it is fine', 'A Stack exposes every Vector method, so callers can insert into the middle and break the stack', 'Vector is slow', 'Stacks should extend LinkedList'],
            answer: 1,
            why: 'Inheriting exposes the whole parent interface. A stack should offer push, pop and peek only. Composition (a stack that *holds* a list) exposes exactly what you choose. That is why «ArrayDeque» is the recommended stack today.',
          },
        ],
      },
      {
        exercise: {
          id: 'counting-set', title: 'A counting set by composition', kind: 'build', mins: 10, diff: 'easy', patterns: [],
          statement: J`
            Build «CountingSet<E>», which wraps **any** «Set<E>» and counts attempted additions.

            - «add(e)» and «addAll(collection)» forward to the inner set and return what it returns.
            - «addCount()» is the number of elements anyone *tried* to add (duplicates count; each element exactly once, however the inner set implements «addAll»).
            - «contains» and «size» forward to the inner set.
            - Elements already in the inner set when you wrap it do not count.

            Do not extend any collection class.
          `,
          starter: J`
class CountingSet<E> {
    CountingSet(Set<E> inner) {
    }

    boolean add(E e) {
        return false; // TODO
    }

    boolean addAll(Collection<? extends E> items) {
        return false; // TODO
    }

    boolean contains(Object o) {
        return false; // TODO
    }

    int size() {
        return 0; // TODO
    }

    int addCount() {
        return 0; // TODO
    }
}
`,
          tests: [
            { name: 'addAll counts each element once', ex: true, code: J`
              CountingSet<String> s = new CountingSet<>(new HashSet<>());
              s.addAll(List.of("a", "b", "c"));
              eq(3, s.addCount(), "addCount");
              eq(3, s.size(), "size");` },
            { name: 'Duplicates count as attempts', ex: true, code: J`
              CountingSet<String> s = new CountingSet<>(new HashSet<>());
              ok(s.add("x"), "first add returns true");
              no(s.add("x"), "second add returns false");
              eq(2, s.addCount(), "addCount");
              eq(1, s.size(), "size");` },
            { name: 'Works over any Set', code: J`
              TreeSet<Integer> inner = new TreeSet<>();
              CountingSet<Integer> s = new CountingSet<>(inner);
              s.addAll(List.of(3, 1, 2));
              eq(List.of(1, 2, 3), new ArrayList<>(inner), "the inner TreeSet keeps its order");
              ok(s.contains(2), "contains");` },
            { name: 'Existing elements do not count', code: J`
              CountingSet<String> s = new CountingSet<>(new HashSet<>(Set.of("old")));
              eq(0, s.addCount(), "addCount");
              eq(1, s.size(), "size");
              s.add("new");
              eq(1, s.addCount(), "addCount after one add");` },
            { name: 'addAll returns whether the set changed', code: J`
              CountingSet<String> s = new CountingSet<>(new HashSet<>());
              ok(s.addAll(List.of("a")), "first addAll changes the set");
              no(s.addAll(List.of("a")), "same element again does not");
              eq(2, s.addCount(), "addCount");` },
          ],
          lint: [
            { re: 'extends\\s+(Hash|Tree|LinkedHash|Abstract)?Set\\b|extends\\s+AbstractCollection', note: 'Extends a collection class: the fragile base class trap this exercise is about.' },
          ],
          rubric: J`
            - Holds the inner set in a field and delegates; no inheritance from collection classes.
            - Counting does not depend on how the inner set implements «addAll».
          `,
          hints: ['Keep «private final Set<E> inner» and an «int» counter. «addAll»: add «items.size()» to the counter, then «return inner.addAll(items)».'],
          solution: {
            pattern: 'Composition: the counter wraps a Set instead of extending one.',
            java: J`
class CountingSet<E> {
    private final Set<E> inner;
    private int added;

    CountingSet(Set<E> inner) {
        this.inner = inner;
    }

    boolean add(E e) {
        added++;
        return inner.add(e);
    }

    boolean addAll(Collection<? extends E> items) {
        added += items.size();
        return inner.addAll(items);
    }

    boolean contains(Object o) {
        return inner.contains(o);
    }

    int size() {
        return inner.size();
    }

    int addCount() {
        return added;
    }
}
`,
            talk: 'CountingSet holds any Set and forwards to it, counting attempts itself. Because it never inherits, it cannot be broken by how the inner set implements addAll, and it works over HashSet, TreeSet or anything else.',
          },
          wrong: [
            { name: 'extends HashSet', java: J`
class CountingSet<E> extends HashSet<E> {
    private int added;
    CountingSet(Set<E> inner) { super(inner); added = 0; }
    public boolean add(E e) { added++; return super.add(e); }
    public boolean addAll(Collection<? extends E> c) { added += c.size(); return super.addAll(c); }
    int addCount() { return added; }
}
` },
          ],
        },
      },
      {
        lesson: 'value-objects', title: 'Value objects: small, immutable, comparable', mins: 6,
        remember: 'Model values (money, a seat number, a date range) as small immutable objects with equals and hashCode. A record gives you all three.',
        cue: 'Two things with the same data should be interchangeable (money, coordinates, a time slot) → an immutable value object, usually a record',
        body: J`
          ## Entity or value?

          - An **entity** has an identity that survives change: order #1042 is the same order after it ships.
          - A **value** *is* its data: ₹500 is ₹500. Two of them are interchangeable, and it never changes (you make a new one).

          Most LLD answers need a few values, and most candidates model them as loose primitives: a «long amount» here, a «String currency» there. That is **primitive obsession**, and it is where bugs like adding rupees to dollars come from.

          ## A record is a value object in one line

          ~~~java
          record Money(long minor, String currency) {
              Money {                                            // compact constructor: validate once
                  if (!currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("bad currency " + currency);
              }
              Money plus(Money other) {
                  if (!currency.equals(other.currency)) throw new IllegalArgumentException("currency mismatch");
                  return new Money(minor + other.minor, currency);   // a new value; this one never changes
              }
          }
          ~~~

          You get «equals», «hashCode» and «toString» for free, all fields are final, and an invalid «Money» cannot exist.

          @stop

          ## Why immutability pays off in LLD

          - **Safe to share** between threads with no locks.
          - **Safe as a map key.** Mutate a key after putting it in a «HashMap» and the entry is lost: its hash no longer matches its bucket.
          - **No defensive copies.** Hand it to anyone; nobody can change it under you.

          :::key The money-splitting trick
          Splitting ₹10.00 three ways is 3.34 + 3.33 + 3.33, not three times 3.33 (a paisa disappears) or 3.3333 (not money). Divide, then hand the remainder out one unit at a time. Splitwise-style questions test exactly this.
          :::

          ## Enums and sealed types are values too

          - An «enum» with behaviour (like the traffic light in the State lesson) is a closed set of values.
          - A «sealed interface» with records («Card», «Upi», «Wallet») is a closed set of *shapes*, and a pattern-matching «switch» over it must handle every case, checked by the compiler.

          @quiz 0
        `,
        quiz: [
          {
            q: 'You use a mutable «Seat(row, number)» as a «HashMap» key, then change its row. What happens to «map.get(seat)»?',
            options: ['It returns the value as before', 'It most likely returns null: the key now hashes to a different bucket', 'It throws ConcurrentModificationException', 'The map rehashes automatically'],
            answer: 1,
            why: 'The entry is still stored under the old hash. Looking it up with the new hash searches the wrong bucket. Immutable keys (records) make this impossible.',
          },
        ],
      },
      {
        exercise: {
          id: 'money-value', title: 'A Money value object', kind: 'build', mins: 10, diff: 'easy', patterns: [],
          statement: J`
            Finish the «Money» record: an amount in minor units (paise, cents) and a currency code.

            - The currency must be exactly three upper-case letters, and the amount must not be negative: otherwise «IllegalArgumentException» when constructing.
            - «plus(other)» and «minus(other)» require the same currency («IllegalArgumentException» otherwise). «minus» must not go below zero («IllegalArgumentException»).
            - «times(n)» multiplies by a non-negative whole number.
            - «split(parts)» divides into «parts» amounts that **add back up exactly**. The remainder goes one unit at a time to the first parts: 1000 into 3 is 334, 333, 333.
            - Two «Money» values with the same amount and currency are equal, and work as map keys.
          `,
          starter: J`
record Money(long minor, String currency) {
    Money {
        // TODO: validate
    }

    Money plus(Money other) {
        return this; // TODO
    }

    Money minus(Money other) {
        return this; // TODO
    }

    Money times(int n) {
        return this; // TODO
    }

    List<Money> split(int parts) {
        return List.of(); // TODO
    }
}
`,
          tests: [
            { name: 'Equal amounts are equal values', ex: true, code: J`
              eq(new Money(500, "INR"), new Money(500, "INR"), "equals");
              Map<Money, String> m = new HashMap<>();
              m.put(new Money(500, "INR"), "five hundred");
              eq("five hundred", m.get(new Money(500, "INR")), "as a map key");` },
            { name: 'plus and minus', ex: true, code: J`
              Money a = new Money(1000, "INR"), b = new Money(250, "INR");
              eq(new Money(1250, "INR"), a.plus(b), "plus");
              eq(new Money(750, "INR"), a.minus(b), "minus");
              eq(new Money(1000, "INR"), a, "a is unchanged");` },
            { name: 'split never loses a unit', ex: true, code: J`eq(List.of(new Money(334, "INR"), new Money(333, "INR"), new Money(333, "INR")), new Money(1000, "INR").split(3), "1000 in 3");` },
            { name: 'Different currencies do not mix', code: J`throwsA(IllegalArgumentException.class, () -> new Money(1, "INR").plus(new Money(1, "USD")), "INR + USD");` },
            { name: 'Invalid values cannot be built', code: J`
              throwsA(IllegalArgumentException.class, () -> new Money(1, "inr"), "lower-case currency");
              throwsA(IllegalArgumentException.class, () -> new Money(1, "RUPEE"), "five letters");
              throwsA(IllegalArgumentException.class, () -> new Money(-1, "INR"), "negative amount");` },
            { name: 'minus cannot go below zero', code: J`throwsA(IllegalArgumentException.class, () -> new Money(100, "INR").minus(new Money(101, "INR")), "100 - 101");` },
            { name: 'times multiplies', code: J`eq(new Money(1500, "USD"), new Money(500, "USD").times(3), "500 x 3");` },
            { name: 'split sums back to the total', code: J`
              Money total = new Money(1001, "INR");
              List<Money> parts = total.split(4);
              eq(4, parts.size(), "parts");
              Money sum = new Money(0, "INR");
              for (Money p : parts) sum = sum.plus(p);
              eq(total, sum, "sum of parts");
              eq(new Money(251, "INR"), parts.get(0), "first part");
              eq(new Money(250, "INR"), parts.get(3), "last part");` },
          ],
          lint: [
            { re: '\\bdouble\\b|\\bfloat\\b', note: 'Floating point near money. Minor units in a «long» never round.' },
          ],
          rubric: J`
            - Validation lives in the compact constructor, so an invalid «Money» cannot exist.
            - Every operation returns a new «Money»; nothing mutates.
            - «split» distributes the remainder so the parts always sum to the total.
          `,
          hints: [
            'In the compact constructor: «if (minor < 0 || currency == null || !currency.matches("[A-Z]{3}")) throw new IllegalArgumentException(...)».',
            '«split»: «long base = minor / parts, extra = minor % parts;» then part «i» gets «base + (i < extra ? 1 : 0)».',
          ],
          solution: {
            pattern: 'An immutable value object as a Java record, validated in its compact constructor.',
            java: J`
record Money(long minor, String currency) {
    Money {
        if (minor < 0) throw new IllegalArgumentException("amount cannot be negative");
        if (currency == null || !currency.matches("[A-Z]{3}")) throw new IllegalArgumentException("currency must be three capital letters, got " + currency);
    }

    Money plus(Money other) {
        sameCurrency(other);
        return new Money(minor + other.minor, currency);
    }

    Money minus(Money other) {
        sameCurrency(other);
        if (other.minor > minor) throw new IllegalArgumentException("result would be negative");
        return new Money(minor - other.minor, currency);
    }

    Money times(int n) {
        if (n < 0) throw new IllegalArgumentException("n must not be negative");
        return new Money(minor * n, currency);
    }

    List<Money> split(int parts) {
        if (parts <= 0) throw new IllegalArgumentException("parts must be positive");
        long base = minor / parts, extra = minor % parts;
        List<Money> out = new ArrayList<>();
        for (int i = 0; i < parts; i++) out.add(new Money(base + (i < extra ? 1 : 0), currency));
        return out;
    }

    private void sameCurrency(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException(currency + " vs " + other.currency);
    }
}
`,
            talk: 'Money is a record, so equality and hashing come free and it is immutable. The compact constructor rejects bad currencies and negative amounts, operations return new values, and split hands out the remainder one unit at a time so nothing is lost.',
          },
          wrong: [
            { name: 'split drops the remainder', java: J`
record Money(long minor, String currency) {
    Money { if (minor < 0 || currency == null || !currency.matches("[A-Z]{3}")) throw new IllegalArgumentException(); }
    Money plus(Money o) { if (!currency.equals(o.currency)) throw new IllegalArgumentException(); return new Money(minor + o.minor, currency); }
    Money minus(Money o) { if (!currency.equals(o.currency) || o.minor > minor) throw new IllegalArgumentException(); return new Money(minor - o.minor, currency); }
    Money times(int n) { return new Money(minor * n, currency); }
    List<Money> split(int parts) { List<Money> out = new ArrayList<>(); for (int i = 0; i < parts; i++) out.add(new Money(minor / parts, currency)); return out; }
}
` },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
