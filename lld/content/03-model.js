(function (root) {
  const L = root.LLD, J = L.J;
  L.module({
    id: 'model', title: 'From requirements to classes', short: 'Modeling',
    blurb: 'Turn a vague prompt into classes and relationships, and draw only the three diagrams worth drawing.',
    items: [
      {
        lesson: 'nouns-verbs', title: 'Nouns, verbs, and who owns whom', mins: 7,
        remember: 'Nouns become classes, verbs become methods. Then ask of each pair: does one own the other, or just use it?',
        cue: 'A fresh LLD prompt → list the nouns (classes) and verbs (methods) before drawing anything',
        body: J`
          ## Worked example: a library

          > *Members borrow copies of books. A member can hold at most 3 loans. Loans are due in 14 days; late returns cost ₹10 a day. If every copy is out, a member can reserve the book.*

          **Nouns → candidate classes:** Member, Book, Copy, Loan, Fine, Reservation, Library.
          **Verbs → methods:** borrow, return, reserve, calculate fine.

          Then cut and merge:
          - **Book vs Copy.** The book is the title (ISBN, author); a copy is one physical item on a shelf. You borrow copies, you reserve books. Mixing them up is the most common modeling mistake in this question.
          - **Fine** is just a number computed from a loan: a method, not a class, until it needs its own lifecycle (paid, waived).
          - **Library** coordinates: it is the service holding the use cases.

          @stop

          ## The five relationships (and their UML arrows)

          | Relationship | Meaning | Example | Mermaid |
          |---|---|---|---|
          | Association | knows about, long-lived | «Loan» → «Member» | «A --> B» |
          | Aggregation | has, but parts live on their own | «Library» ◇ «Member» | «A o-- B» |
          | Composition | owns; parts die with the whole | «Book» ◆ «Copy» | «A *-- B» |
          | Inheritance | is-a | «EBook» extends «Book» | «A <|-- B» |
          | Dependency | uses briefly (a parameter) | «FinePolicy» uses «Clock» | «A ..> B» |

          ~~~mermaid The library, drawn with those arrows
          classDiagram
            direction LR
            class Library {
              +borrow(member, isbn) Loan
              +returnCopy(copyId) long
              +reserve(member, isbn)
            }
            class Book {
              +isbn
              +title
            }
            class Copy {
              +id
              +available
            }
            class Loan {
              +dueAt
              +fineOn(returnedAt) long
            }
            Library o-- Member
            Library o-- Book
            Book *-- Copy
            Loan --> Copy
            Loan --> Member
            Book o-- Reservation
          ~~~

          ## In the interview

          Draw it rough and fast. Nobody grades arrowheads; they grade whether **Book vs Copy** and **who holds the rules** are right. Say out loud *why* each relationship is what it is.

          @quiz 0
        `,
        quiz: [
          {
            q: 'In a movie-booking system, a "Show" is one screening of a movie at a time on a screen. Which pair is composition (parts die with the whole)?',
            options: ['Movie and Show', 'Show and its ShowSeats (seat availability for that screening)', 'Theatre and Movie', 'User and Booking'],
            answer: 1,
            why: 'Seat availability only exists for one show; delete the show and its seat states mean nothing. A movie outlives any one show, so Movie-Show is association.',
          },
        ],
      },
      {
        lesson: 'three-diagrams', title: 'The three diagrams worth drawing', mins: 5,
        remember: 'Class diagram for the structure, sequence diagram for one important flow, state diagram for anything with a lifecycle. Skip the rest.',
        cue: 'The interviewer asks "walk me through it" → sketch a sequence diagram of that one flow',
        body: J`
          ## 1. Class diagram: the structure

          The boxes-and-arrows view from the last lesson. Draw it first, keep it to the 5 to 8 classes that matter.

          ## 2. Sequence diagram: one flow, in order

          Pick the most important use case and show who calls whom:

          ~~~mermaid Borrowing a book
          sequenceDiagram
            actor M as Member
            participant L as Library
            participant B as Book
            participant C as Copy
            M->>L: borrow(isbn)
            L->>L: member has fewer than 3 loans?
            L->>B: an available copy?
            B-->>L: copy 17
            L->>C: markBorrowed()
            L-->>M: Loan(due in 14 days)
          ~~~

          It exposes gaps fast: *where* is the 3-loan limit checked? What if two members grab copy 17 at once?

          @stop

          ## 3. State diagram: anything with a lifecycle

          ~~~mermaid A copy's lifecycle
          stateDiagram-v2
            [*] --> Available
            Available --> OnLoan : borrow
            OnLoan --> Available : return, no reservation
            OnLoan --> OnHold : return, someone reserved
            OnHold --> OnLoan : reserver borrows
            OnHold --> Available : hold expires
          ~~~

          If a state diagram has more than three states, the State pattern is probably worth it.

          :::interview What to skip
          Use-case diagrams, activity diagrams, component and deployment diagrams: they rarely earn their time in an LLD round.
          :::
        `,
      },
      {
        exercise: {
          id: 'library-design', title: 'Design the library core', kind: 'design', mins: 15, diff: 'medium', patterns: [],
          statement: J`
            Design the core of a library system. Write the classes, interfaces and key method signatures (short bodies are fine), then press **Check** to compile.

            Requirements:
            1. The library has **books** (ISBN, title) and several physical **copies** of each.
            2. A **member** can borrow an available copy of a book; at most **3 active loans** per member.
            3. A loan is due **14 days** after borrowing. Returning late costs **₹10 per started day**.
            4. If no copy is available, the member can **reserve** the book. When a copy comes back, it is held for the first person in line.
            5. Time must be testable.

            Follow-ups an interviewer will ask: *different fine rules for premium members*; *two members borrowing the last copy at the same moment*.
          `,
          given: L.kit.clock,
          starter: J`
// Sketch your design here: the entities, where each rule lives, and the Library's use cases.
class Library {
}
`,
          rubric: J`
            - **Book and Copy are separate**: you borrow copies, you reserve books.
            - The 3-loan limit and the due date live in one obvious place (the library service or a policy object), not scattered.
            - The fine is a policy behind an interface (a «FinePolicy» strategy), so premium members get a different one.
            - Time comes from an injected «Clock».
            - Reservations are a FIFO queue per book; a returned copy goes to the head of the queue.
            - The race on the last copy is acknowledged: allocation is atomic (synchronized, or a compare-and-set on the copy's state).
          `,
          solution: {
            pattern: 'Plain modeling, with a Strategy for fines and an injected Clock.',
            java: J`
record Book(String isbn, String title) { }

class Copy {
    enum Status { AVAILABLE, ON_LOAN, ON_HOLD }
    final String id;
    final Book book;
    Status status = Status.AVAILABLE;
    String heldFor;                          // member id, when ON_HOLD

    Copy(String id, Book book) { this.id = id; this.book = book; }
}

record Member(String id, boolean premium) { }

class Loan {
    final Member member;
    final Copy copy;
    final long borrowedAt, dueAt;

    Loan(Member member, Copy copy, long borrowedAt, long dueAt) {
        this.member = member; this.copy = copy; this.borrowedAt = borrowedAt; this.dueAt = dueAt;
    }
}

interface FinePolicy {
    long fineFor(Loan loan, long returnedAt);
}

class PerDayFine implements FinePolicy {
    static final long DAY = 24L * 60 * 60 * 1000;
    private final long perDay;
    PerDayFine(long perDay) { this.perDay = perDay; }

    public long fineFor(Loan loan, long returnedAt) {
        long late = returnedAt - loan.dueAt;
        if (late <= 0) return 0;
        return ((late + DAY - 1) / DAY) * perDay;       // every started day
    }
}

class Library {
    static final int MAX_LOANS = 3;
    static final long LOAN_DAYS = 14;

    private final Clock clock;
    private final FinePolicy standardFines, premiumFines;
    private final Map<String, List<Copy>> copiesByIsbn = new HashMap<>();
    private final Map<String, List<Loan>> loansByMember = new HashMap<>();
    private final Map<String, Loan> loanByCopy = new HashMap<>();
    private final Map<String, Deque<Member>> reservations = new HashMap<>();

    Library(Clock clock, FinePolicy standardFines, FinePolicy premiumFines) {
        this.clock = clock; this.standardFines = standardFines; this.premiumFines = premiumFines;
    }

    /** Atomic, so two members cannot take the last copy at once. */
    synchronized Loan borrow(Member m, String isbn) {
        List<Loan> active = loansByMember.computeIfAbsent(m.id(), k -> new ArrayList<>());
        if (active.size() >= MAX_LOANS) throw new IllegalStateException("loan limit reached");
        Copy copy = null;
        for (Copy c : copiesByIsbn.getOrDefault(isbn, List.of()))
            if (c.status == Copy.Status.AVAILABLE || (c.status == Copy.Status.ON_HOLD && m.id().equals(c.heldFor))) { copy = c; break; }
        if (copy == null) throw new IllegalStateException("no copy available: reserve instead");
        long now = clock.nowMillis();
        Loan loan = new Loan(m, copy, now, now + LOAN_DAYS * PerDayFine.DAY);
        copy.status = Copy.Status.ON_LOAN;
        copy.heldFor = null;
        active.add(loan);
        loanByCopy.put(copy.id, loan);
        return loan;
    }

    synchronized long returnCopy(String copyId) {
        Loan loan = loanByCopy.remove(copyId);
        if (loan == null) throw new IllegalArgumentException("not on loan: " + copyId);
        loansByMember.get(loan.member.id()).remove(loan);
        Deque<Member> queue = reservations.getOrDefault(loan.copy.book.isbn(), new ArrayDeque<>());
        if (queue.isEmpty()) loan.copy.status = Copy.Status.AVAILABLE;
        else { loan.copy.status = Copy.Status.ON_HOLD; loan.copy.heldFor = queue.poll().id(); }
        FinePolicy fines = loan.member.premium() ? premiumFines : standardFines;
        return fines.fineFor(loan, clock.nowMillis());
    }

    synchronized void reserve(Member m, String isbn) {
        reservations.computeIfAbsent(isbn, k -> new ArrayDeque<>()).add(m);
    }
}
`,
            why: J`
              «Book» is the title and «Copy» the physical item, with a small lifecycle (available, on loan, on hold). The rules sit in «Library», the one place that coordinates; the fine is a «FinePolicy» strategy so premium members plug in another; time comes from «Clock». The whole service is «synchronized», which is the honest simple answer for one library; mention per-book locking if they push on scale.
            `,
            followups: J`
              - **"Hold expires after 2 days."** Store «heldUntil» on the copy and check it in «borrow».
              - **"Scale to many branches."** Lock per book (or per copy with compare-and-set on status) instead of the whole library.
            `,
            talk: 'Books and copies are separate: you borrow a copy and reserve a book. Library is the service that enforces the 3-loan limit and the due date, fines are a FinePolicy strategy chosen per member type, reservations are a FIFO queue per book, and borrowing is atomic so the last copy cannot be taken twice.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
