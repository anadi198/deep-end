(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'rest', title: 'The other 11, and the smells to avoid', short: 'The rest',
    blurb: 'Name-level knowledge of the remaining patterns, the six design smells interviewers watch for, and modern Java\'s answer to Visitor.',
    items: [
      {
        lesson: 'the-rest', title: 'The other 11 patterns, one line each', mins: 8,
        remember: 'For the other 11 patterns, know the name, the one-line intent and the cue. Naming one correctly and saying why you would not use it is enough.',
        cue: 'An interviewer names a pattern you do not use daily → give its intent and cue, then say what you would use instead',
        body: J`
          ## Recognise, don't memorise

          | Pattern | Move | One line | You'd see it when... |
          |---|---|---|---|
          | Template Method | swap | a base class fixes the steps; subclasses fill some in | same recipe, different details. *Usually better as Strategy.* |
          | Abstract Factory | build | a factory for a *family* of matching objects | dark-theme button + dark-theme checkbox must match |
          | Prototype | build | make new objects by copying a configured one | building from scratch is expensive |
          | Flyweight | build | share the unchanging part of many small objects | millions of glyphs, chess piece types, map tiles |
          | Memento | build | snapshot state without exposing internals | undo by restoring, checkpoints |
          | Facade | wrap | one simple entry point in front of a subsystem | callers need 5 services in the right order |
          | Bridge | wrap | split "what" from "how" so both vary | Shape x Renderer would be 9 subclasses |
          | Interpreter | wrap | grammar rules as classes; evaluate the tree | a tiny rules or query language |
          | Iterator | pass | walk a collection without exposing its storage | Java builds it in: «Iterable» |
          | Mediator | pass | objects talk through one coordinator | a chat room, air-traffic control, a form's widgets |
          | Visitor | pass | add operations over a fixed class hierarchy | many operations over a syntax tree |

          @stop

          ## The three worth a closer look

          **Template Method vs Strategy.** Template Method varies steps by *subclassing*; Strategy varies them by *passing in an object*. Strategy wins in almost every interview answer: you can swap it at runtime, test it alone, and avoid inheritance.

          **Facade.** You write facades all the time without the name: an «OrderService.checkout()» that calls inventory, pricing, payment and shipping in order *is* a facade. Say the word when you draw it.

          **Visitor, and why modern Java rarely needs it.** Visitor's double dispatch was the workaround for not being able to «switch» on types safely. Java 21's **sealed interfaces + records + pattern-matching «switch»** do the same job, and the compiler checks you handled every case:

          ~~~java
          sealed interface Expr permits Num, Add { }
          record Num(int value) implements Expr { }
          record Add(Expr left, Expr right) implements Expr { }

          static int eval(Expr e) {
              return switch (e) {
                  case Num n -> n.value();
                  case Add(Expr l, Expr r) -> eval(l) + eval(r);   // record pattern
              };                                                    // no default: the compiler knows it's complete
          }
          ~~~

          Add a new record to «permits» and every «switch» that forgot it stops compiling. That is Visitor's main benefit, for free. The next exercise uses it.
        `,
      },
      {
        exercise: {
          id: 'expr-sealed', title: 'An expression tree with sealed types', kind: 'build', mins: 12, diff: 'medium', patterns: ['visitor', 'interpreter', 'composite'],
          statement: J`
            The expression types are given as a sealed interface with records. Write three operations in «Exprs», each as a pattern-matching «switch»:

            - «eval(e)»: the integer value. «Neg» negates.
            - «show(e)»: «Num» is its number; «Add» is «"(a + b)"»; «Mul» is «"(a * b)"»; «Neg» is «"-"» followed by its inner text. So «new Neg(new Add(new Num(1), new Num(2)))» shows as «"-(1 + 2)"».
            - «simplify(e)»: simplify the children first, then apply: «x + 0» and «0 + x» become «x»; «x * 1» and «1 * x» become «x»; «x * 0» and «0 * x» become «Num(0)»; «Neg(Neg(x))» becomes «x»; «Neg(Num(n))» becomes «Num(-n)». Nothing else changes (no general constant folding).
          `,
          given: J`
sealed interface Expr permits Num, Add, Mul, Neg { }
record Num(int value) implements Expr { }
record Add(Expr left, Expr right) implements Expr { }
record Mul(Expr left, Expr right) implements Expr { }
record Neg(Expr inner) implements Expr { }
`,
          starter: J`
final class Exprs {
    static int eval(Expr e) {
        return 0; // TODO: a switch over e
    }

    static String show(Expr e) {
        return ""; // TODO
    }

    static Expr simplify(Expr e) {
        return e; // TODO
    }
}
`,
          tests: [
            { name: 'eval a nested tree', ex: true, code: J`eq(-7, Exprs.eval(new Add(new Num(2), new Neg(new Mul(new Num(3), new Num(3))))), "2 + -(3 * 3)");` },
            { name: 'show adds brackets', ex: true, code: J`eq("-(1 + (2 * 3))", Exprs.show(new Neg(new Add(new Num(1), new Mul(new Num(2), new Num(3))))), "show");` },
            { name: 'x + 0 simplifies to x', ex: true, code: J`eq(new Num(5), Exprs.simplify(new Add(new Num(5), new Num(0))), "5 + 0");` },
            { name: 'Children are simplified first', code: J`eq(new Num(2), Exprs.simplify(new Mul(new Add(new Num(2), new Num(0)), new Num(1))), "(2 + 0) * 1");` },
            { name: 'Multiplying by zero', code: J`
              eq(new Num(0), Exprs.simplify(new Mul(new Add(new Num(4), new Num(5)), new Num(0))), "x * 0");
              eq(new Num(0), Exprs.simplify(new Mul(new Num(0), new Num(9))), "0 * x");` },
            { name: 'Double negation cancels', code: J`
              Expr sum = new Add(new Num(1), new Num(2));
              eq(sum, Exprs.simplify(new Neg(new Neg(sum))), "--(1 + 2)");` },
            { name: 'A negated number becomes a number', code: J`eq(new Num(-4), Exprs.simplify(new Neg(new Num(4))), "-4");` },
            { name: 'No general constant folding', code: J`
              Expr e = new Add(new Num(2), new Num(3));
              eq(e, Exprs.simplify(e), "2 + 3 stays as it is");` },
            { name: 'show for single numbers and negation', code: J`
              eq("7", Exprs.show(new Num(7)), "a number");
              eq("-7", Exprs.show(new Neg(new Num(7))), "negated number");` },
          ],
          lint: [
            { re: 'instanceof\\s+(Num|Add|Mul|Neg)', note: 'An «instanceof» chain works, but a «switch» over the sealed type is checked for completeness by the compiler.' },
            { re: 'default\\s*->', note: 'A «default» branch turns off the compiler\'s completeness check: add a new «Expr» type and this «switch» will silently fall into «default».' },
          ],
          rubric: J`
            - Each operation is one «switch» over the sealed type, with record patterns and no «default».
            - «simplify» recurses into children before matching the rules.
            - No mutation: new records are built.
          `,
          hints: [
            '«return switch (e) { case Num n -> n.value(); case Add(Expr l, Expr r) -> eval(l) + eval(r); ... };»',
            'For «simplify»: first rebuild with simplified children, e.g. «Expr l = simplify(a.left()), r = simplify(a.right());», then check the rules on «l» and «r». Checking «l.equals(new Num(0))» works because records have value equality.',
          ],
          solution: {
            pattern: 'Visitor, the modern way: a sealed hierarchy of records and exhaustive pattern-matching switches. It is also a Composite (trees of Expr) and an Interpreter (eval).',
            java: J`
final class Exprs {
    private static final Num ZERO = new Num(0), ONE = new Num(1);

    static int eval(Expr e) {
        return switch (e) {
            case Num n -> n.value();
            case Add(Expr l, Expr r) -> eval(l) + eval(r);
            case Mul(Expr l, Expr r) -> eval(l) * eval(r);
            case Neg(Expr inner) -> -eval(inner);
        };
    }

    static String show(Expr e) {
        return switch (e) {
            case Num n -> String.valueOf(n.value());
            case Add(Expr l, Expr r) -> "(" + show(l) + " + " + show(r) + ")";
            case Mul(Expr l, Expr r) -> "(" + show(l) + " * " + show(r) + ")";
            case Neg(Expr inner) -> "-" + show(inner);
        };
    }

    static Expr simplify(Expr e) {
        return switch (e) {
            case Num n -> n;
            case Add(Expr a, Expr b) -> {
                Expr l = simplify(a), r = simplify(b);
                if (r.equals(ZERO)) yield l;
                if (l.equals(ZERO)) yield r;
                yield new Add(l, r);
            }
            case Mul(Expr a, Expr b) -> {
                Expr l = simplify(a), r = simplify(b);
                if (l.equals(ZERO) || r.equals(ZERO)) yield ZERO;
                if (r.equals(ONE)) yield l;
                if (l.equals(ONE)) yield r;
                yield new Mul(l, r);
            }
            case Neg(Expr a) -> {
                Expr inner = simplify(a);
                if (inner instanceof Neg(Expr x)) yield x;
                if (inner instanceof Num(int v)) yield new Num(-v);
                yield new Neg(inner);
            }
        };
    }
}
`,
            talk: 'The expression types are a sealed interface of records, so every operation is an exhaustive pattern-matching switch: the compiler checks every case, which is what Visitor used to buy us. simplify rebuilds bottom-up and applies the identity rules with record equality.',
          },
          wrong: [
            { name: 'simplifies only the top level', java: J`
final class Exprs {
    static int eval(Expr e) { return switch (e) { case Num n -> n.value(); case Add(Expr l, Expr r) -> eval(l) + eval(r); case Mul(Expr l, Expr r) -> eval(l) * eval(r); case Neg(Expr i) -> -eval(i); }; }
    static String show(Expr e) { return switch (e) { case Num n -> String.valueOf(n.value()); case Add(Expr l, Expr r) -> "(" + show(l) + " + " + show(r) + ")"; case Mul(Expr l, Expr r) -> "(" + show(l) + " * " + show(r) + ")"; case Neg(Expr i) -> "-" + show(i); }; }
    static Expr simplify(Expr e) {
        Num z = new Num(0), o = new Num(1);
        return switch (e) {
            case Num n -> n;
            case Add(Expr l, Expr r) -> r.equals(z) ? l : l.equals(z) ? r : e;
            case Mul(Expr l, Expr r) -> l.equals(z) || r.equals(z) ? z : r.equals(o) ? l : l.equals(o) ? r : e;
            case Neg(Expr i) -> i instanceof Neg(Expr x) ? x : i instanceof Num(int v) ? new Num(-v) : e;
        };
    }
}
` },
          ],
        },
      },
      {
        lesson: 'smells', title: 'Six smells interviewers watch for', mins: 6,
        remember: 'Most weak designs are one of six smells: god class, anemic model, singleton abuse, pattern stuffing, primitive obsession, boolean flag parameters.',
        cue: 'A class you cannot describe without "and", or a method with a boolean parameter → split it',
        body: J`
          ## 1. God class

          «ParkingLotManager» with 30 methods: allocation, pricing, payments, reports. **Fix:** split by reason to change (SRP).

          ## 2. Anemic domain model

          Classes that are only getters and setters, with every rule in a «...Service». «order.setStatus(SHIPPED)» from anywhere, with nothing checking whether that is allowed. **Fix:** put behaviour with its data: «order.ship()» checks and changes its own state.

          ## 3. Singleton abuse

          Every service is «X.getInstance()», so nothing can be tested or replaced. **Fix:** create once, inject everywhere.

          @stop

          ## 4. Pattern stuffing

          A factory for one class, an abstract base for one subclass, an observer with one listener that will never get a second. **Fix:** add the pattern when the second variant arrives, and *say* that you would.

          ## 5. Primitive obsession

          «String phone», «long amount», «int status» everywhere. Nothing stops a price in dollars being added to one in rupees, or status 7 existing. **Fix:** small value objects and enums («Money», «PhoneNumber», «OrderStatus»).

          ## 6. Boolean flag parameters

          «book(seat, true, false)». What do they mean? And each flag doubles the paths through the method. **Fix:** two methods («hold» vs «bookNow»), an enum, or a small options object.

          :::interview Turn smells into points
          Spotting a smell in your *own* first draft and fixing it out loud ("this is turning into a god class, let me pull pricing out") scores better than a draft that was clean from the start. It shows judgement.
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: '«refund(orderId, true)» where the boolean means "also restock the items". Best fix?',
            options: ['Rename the variable', 'Two clear operations, or an enum like «RefundMode.WITH_RESTOCK»', 'A Singleton RefundManager', 'A comment at every call site'],
            answer: 1,
            why: 'The call site should read on its own. A named method or an enum says what happens; a bare «true» does not.',
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
