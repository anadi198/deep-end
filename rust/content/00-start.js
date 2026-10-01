(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'start', title: 'Start here', short: 'Start',
    blurb: 'How the course is laid out, how a lesson works, the notation used for syntax, and what the Rust compiler guarantees before a program ever runs.',
    items: [
      {
        lesson: 'start-how', title: 'How this course works', mins: 4,
        remember: 'Foundations first: the grammar and the type system, then ownership and borrowing, then everything built on them. Each lesson opens with the one thing to remember, and the daily review brings it back.',
        body: R`
          ## The route

          | Part | Modules | What it covers |
          |---|---|---|
          | Foundations | Syntax, Types, Control flow and patterns, Structs and enums | the grammar and the type system, stated precisely |
          | The core | Ownership, Borrowing, Collections and text, Errors, Traits, Iterators and closures, Crates | what makes Rust different from Java |
          | Applied | Shared state, Async, Channels, Networking, Wire formats | concurrency and I/O with Tokio, serde, protobuf and gRPC |
          | Practice | Find the bugs | longer programs that mix everything |

          Each module builds on the ones before it. Java comparisons appear where they add information, not as a substitute for the Rust rule.

          ## How a lesson works

          - It opens with **Remember this**: the one sentence worth keeping.
          - **Syntax boxes** give the grammar of a construct in the notation below, followed by the rules that apply to it.
          - Every snippet with an output was compiled and run by the real compiler (Rust 1.98, edition 2024, on the official Rust Playground). **Edit & run** lets you change it and run it again.
          - **Predict** boxes ask what a snippet does before showing you. Guessing wrong is where the rule sticks.
          - Exercises come in three kinds: **Fix** (make it compile or pass its tests), **Build** (write it; tests grade it) and **Find the bugs** (click the lines that are wrong and name the kind of bug).
          - Finished lessons feed **Today**, a 5-minute daily review of remember lines, cue cards and predicts, spaced out over days and weeks.

          ## Notation in syntax boxes

          | Written | Means |
          |---|---|
          | «UPPERCASE» | a placeholder: «NAME», «TYPE», «EXPRESSION», «PATTERN», «BLOCK» |
          | «[ ... ]» | optional |
          | «...» | the previous part may repeat |
          | «a \| b» | either |

          Everything else in a syntax box is literal Rust.

          ~~~text
          let [mut] NAME [: TYPE] [= EXPRESSION];
          ~~~

          reads: the keyword «let», optionally «mut», a name, optionally a colon and a type, optionally «=» and an expression, then a semicolon.

          ## Running code

          Code runs on the Rust Playground (play.rust-lang.org), so **Run** needs the internet. Reading does not: recorded outputs are part of the page.

          When your head is full, **◎** in the top bar switches to focus mode, and **Continue** on the home page always goes to exactly where you stopped.
        `,
      },
      {
        lesson: 'start-mindset', title: 'What the compiler guarantees, and what it does not', mins: 5,
        remember: 'A program that compiles has no use-after-free, no double free, no data races and no null. It can still panic, ignore an error, deadlock, leak, or compute the wrong answer.',
        cue: 'The code compiles → memory and thread safety are settled; what is left is panics, ignored errors, stalls, unbounded growth and plain logic',
        body: R`
          ## Why Rust code looks so busy

          In Java the garbage collector decides when memory is freed, and any thread can touch any object; safety comes from discipline («synchronized», immutable objects). In Rust the **compiler** tracks who owns each value and who is looking at it. Code that could read freed memory, free something twice, or let two threads write the same data without a lock **does not compile**.

          That is why Rust code is full of «&», «mut», «.clone()» and «Arc»: they are the information the compiler checks. The Ownership and Borrowing modules teach the rules behind them.

          | Guaranteed once it compiles | Not guaranteed |
          |---|---|
          | no use of freed memory, no double free | no panics: «.unwrap()» on «None», «v[i]» out of range, overflow in debug builds |
          | no data races between threads | no deadlocks, no tasks waiting forever |
          | every «match» handles every case | every error is handled, not discarded |
          | types line up, and there is no null | memory does not grow without limit |
          | | the logic is right, and the work is not wasted |

          This course stays in safe Rust. «unsafe», raw pointers and hand-written futures are out of scope.

          @stop

          ## Eight kinds of bug the compiler does not catch

          The right-hand column above falls into eight kinds of bug, in three groups. The find-the-bugs exercises later in the course label every bug with one of them.

          @hunts

          @quiz 0
        `,
        quiz: [
          {
            q: 'A program compiles cleanly. Which of these can it still contain?',
            options: ['A reference to memory that was already freed', 'Two threads writing the same «Vec» without a lock', 'An «.unwrap()» on a network read that crashes on a malformed frame', 'A «match» on an enum that forgets a variant'],
            answer: 2,
            why: 'The other three are exactly what the compiler rejects. A panic on bad input is legal Rust: it compiles, and it crashes at run time.',
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
