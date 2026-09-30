(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'read', title: 'Reading Rust as a Java developer', short: 'Read',
    blurb: 'The shape of a Rust file, the symbols decoded, the number types (and the «as» trap), and why «if» and «match» return values.',
    items: [
      {
        lesson: 'read-shape', title: 'The shape of a Rust file', mins: 7,
        remember: 'Types go after names, the last line without a semicolon is the return value, and methods live in a separate «impl» block.',
        cue: 'A function body ends in a bare expression with no semicolon → that value is what it returns',
        body: R`
          ## A Java class and its Rust twin

          :::vs The same small class in both languages
          ~~~java Frame.java
          public class Frame {
              private final String kind;
              private int retries;

              public Frame(String kind) {
                  this.kind = kind;
                  this.retries = 0;
              }

              public String kind() { return kind; }
              public void retry() { retries++; }
          }
          ~~~
          ~~~rust frame.rs
          pub struct Frame {
              kind: String,
              retries: u32,
          }

          impl Frame {
              pub fn new(kind: String) -> Frame {
                  Frame { kind, retries: 0 }
              }

              pub fn kind(&self) -> &str { &self.kind }
              pub fn retry(&mut self) { self.retries += 1; }
          }
          ~~~
          :::

          Read the Rust side line by line:

          - «struct» holds the **data only**. Methods go in «impl Frame { ... }», and a type can have several impl blocks.
          - There are **no constructors**. «new» is just a naming habit: an ordinary function that returns a «Frame». «Frame { kind, retries: 0 }» builds the value directly, like a record.
          - Everything is **private unless marked «pub»**. Private means private to the module (roughly, the file), not to the type.
          - «retries: u32»: the type comes **after** the name. «-> Frame» is the return type.
          - «&self» means the method only reads the object. «&mut self» means it changes it. A function with no «self» at all is like a static method, called as «Frame::new(...)».
          - «::» reaches into a type or module. «.» calls a method on a value.

          @stop

          ## The return value is the last expression

          ~~~rust !run
          fn double(x: i32) -> i32 {
              x * 2
          }

          fn main() {
              println!("{}", double(21));
          }
          ~~~

          «x * 2» has **no semicolon**, so it is the function's value. «return» exists, but idiomatic code uses it only to leave early. Put a semicolon on that last line and it becomes a statement that produces nothing.

          @predict 0

          This rule is everywhere: function bodies, «if», «match», blocks. When a function looks like it forgot to return, look at its last line.

          @quiz 0
        `,
        predict: [
          {
            q: 'One character changed. What happens now?',
            code: 'fn double(x: i32) -> i32 {\n    x * 2;\n}\n\nfn main() {\n    println!("{}", double(21));\n}',
            options: ['42', 'Compile error', '0'],
            answer: 1, error: 'E0308',
            why: 'The semicolon turns «x * 2» into a statement, so the body produces «()» (Rust\'s «void») instead of an «i32». rustc reports "mismatched types" and points at the semicolon to remove.',
          },
        ],
        quiz: [
          {
            q: 'What does «pub fn kind(&self) -> &str» tell you, without reading the body?',
            options: ['A static method that returns a new «String»', 'It only reads the object, and returns a borrowed view of text inside it', 'It takes the object over, so the caller cannot use it afterwards', 'It returns a copy of the text'],
            answer: 1,
            why: '«&self» means read-only access to the object. «&str» is a borrowed view of text, not a new string: no copy is made. Module 03 covers borrowing properly.',
          },
        ],
      },
      {
        lesson: 'read-symbols', title: 'The symbols, decoded', mins: 7,
        remember: 'Most Rust punctuation is ownership paperwork: «&» borrows, «mut» allows change, «?» passes an error up, «!» marks a macro.',
        cue: 'A symbol stops you mid-line → «&» borrow, «*» follow the reference, «?» return the error early, «!» macro, «\'a» a lifetime label',
        body: R`
          ## The decoder

          Skim it once. You do not need it memorised: the later modules teach each row, and the cheat sheet keeps it one click away.

          | You see | Read it as | Closest Java idea | Module |
          |---|---|---|---|
          | «&x» | a read-only borrow of x | passing a reference you promise not to change | Borrowing |
          | «&mut x» | the one writable borrow of x | a reference only you may use right now | Borrowing |
          | «*r» | the value that r points at | (Java does this for you) | Borrowing |
          | «let mut x» | x may change | a non-final local | here |
          | «f()?» | if f failed, return its error right now | a checked exception propagating | Errors |
          | «println!(..)», «vec![..]» | a macro: code that writes code | Lombok, at compile time | here |
          | «#[derive(Debug, Clone)]» | generate these for me | «@ToString», «@EqualsAndHashCode» | here |
          | «&'a str» | a borrow labelled with a lifetime | (nothing) | Borrowing |
          | «'static» | owns everything, or lives as long as the program | a static constant | Borrowing |
          | «::» | a path into a module or type | «.» on a package or static member | here |
          | «\|x\| x + 1» | a closure | «x -> x + 1» | later |
          | «=>» | one arm of a «match» | «->» in a switch expression | here |
          | «_» | "I do not care about this value" | an unnamed variable | here |
          | «0..n», «0..=n» | a range: up to n, or up to and including n | a for loop's bounds | here |
          | «Option<T>», «Result<T, E>» | maybe a value; a value or an error | «Optional<T>»; a return value that carries its exception | Errors |
          | «Arc<T>» | a value shared by counting its owners | a shared object | later |

          @stop

          ## Test yourself

          ?? «let mut count = 0;»
          A variable that is allowed to change. Without «mut», assigning to it again is a compile error.

          ?? «let n = parse(line)?;»
          If «parse» returned an error, the whole function returns that error right here. Otherwise «n» is the value.

          ?? «fn send(&mut self, frame: &[u8])»
          A method that changes the object, and reads (without taking over) a slice of bytes.

          ?? «vec![1, 2, 3]»
          A macro that builds a «Vec» (Rust's «ArrayList») holding 1, 2, 3.

          ## Derive: the Lombok of Rust

          «#[derive(...)]» asks the compiler to write standard trait implementations for a type. «Debug» enables printing with «{:?}», «Clone» adds «.clone()», «PartialEq» adds «==».

          ~~~rust !run
          #[derive(Debug, Clone, PartialEq)]
          struct Ack {
              id: u32,
              ok: bool,
          }

          fn main() {
              let a = Ack { id: 7, ok: true };
              let b = a.clone();
              println!("{a:?}");
              println!("same? {}", a == b);
          }
          ~~~

          @predict 0

          :::review Reading derive lines in a PR
          - «Debug» on a type that holds a password or token will print it into logs. Worth a comment.
          - «Clone» on a type holding a big buffer makes «.clone()» look cheap when it is not.
          - «Copy» (lesson 02) on a type means assignments copy it silently. Fine for small plain values.
          :::
        `,
        predict: [
          {
            q: 'Same program, but the derive line is gone. What happens?',
            code: 'struct Ack {\n    id: u32,\n}\n\nfn main() {\n    let a = Ack { id: 7 };\n    println!("{a:?}");\n}',
            options: ['Ack { id: 7 }', 'Compile error', 'It prints a memory address, like Java\'s Object.toString()'],
            answer: 1, error: 'E0277',
            why: 'Nothing is printable by default. «{:?}» needs the «Debug» trait, and rustc says «Ack» does not implement it, then suggests adding «#[derive(Debug)]».',
          },
        ],
      },
      {
        lesson: 'read-types', title: 'Numbers, strings, collections (and the «as» trap)', mins: 7,
        remember: 'Rust numbers say their size (u8, u32, usize), and «as» between them silently cuts off the high bits.',
        cue: '«len as u8» or «as u16» on a length or an id → can it ever be bigger? If so it wraps silently; use «try_from»',
        body: R`
          ## Java types, translated

          | Java | Rust | Notes |
          |---|---|---|
          | «byte» | «u8» (and «i8») | Rust has unsigned types. Bytes on the wire are «u8». |
          | «short», «int», «long» | «i16», «i32», «i64» | signed |
          | (none) | «u16», «u32», «u64» | unsigned. A port is a «u16». |
          | «int» for sizes and indexes | «usize» | the type of every length and index |
          | «double» | «f64» | |
          | «boolean», «char» | «bool», «char» | a «char» is a whole Unicode character, 4 bytes |
          | «String» | «String» (owned) and «&str» (a borrowed view) | two types: module 02 explains why |
          | «byte[]» | «Vec<u8>» (owned) and «&[u8]» (a view) | «&[u8]» is all over network code |
          | «ArrayList<T>» | «Vec<T>» | |
          | «HashMap<K, V>» | «HashMap<K, V>» | from «std::collections» |
          | «Optional<T>» | «Option<T>» | module 04 |
          | a pair | «(A, B)», a tuple | «let (a, b) = pair;» |

          «let» infers types, so most variables never say theirs. When a type matters (a port, a length), the code usually states it once and inference carries it from there.

          @stop

          ## The «as» trap

          «as» converts between number types. It **never fails and never warns**: when the value does not fit, it keeps the low bits.

          ~~~rust !run
          fn main() {
              let len: usize = 300;
              let byte = len as u8;
              println!("{byte}");
          }
          ~~~

          300 does not fit in a byte (the maximum is 255), so you get 300 minus 256. In a length prefix or a counter that is silent data corruption. The checked form returns a «Result» you have to handle:

          ~~~rust !run
          fn main() {
              let len: usize = 300;
              match u8::try_from(len) {
                  Ok(b) => println!("fits: {b}"),
                  Err(e) => println!("does not fit: {e}"),
              }
          }
          ~~~

          ## Overflow: tests crash, production lies

          @predict 0

          :::warn Debug and release behave differently
          Tests and the Playground build in **debug**, where overflow panics. Production builds in **release**, where the same addition wraps around silently. So the test that would have caught it crashes, and the shipped binary quietly produces a wrong number. Sum lengths in «usize» or «u64», or use «checked_add» when a wrong number would matter.
          :::

          @quiz 0
        `,
        predict: [
          {
            q: 'Two small numbers, summed as bytes. What happens?',
            code: 'fn main() {\n    let sizes: Vec<u8> = vec![200, 100];\n    let total: u8 = sizes.iter().sum();\n    println!("{total}");\n}',
            options: ['300', '44', 'It panics', 'Compile error'],
            answer: 2,
            why: '200 plus 100 does not fit in a «u8». In a debug build (tests, the Playground) arithmetic overflow panics with "attempt to add with overflow". A release build would print 44 instead, with no warning.',
          },
        ],
        quiz: [
          {
            q: 'A PR adds «let frame_len = body.len() as u16;». What do you ask?',
            options: ['Nothing: «as» checks the range', 'Can a body ever be over 65,535 bytes? If so this silently wraps; use «u16::try_from» and handle the error', 'Use «as u32» instead because it is faster', 'Nothing: the compiler rejects conversions that can overflow'],
            answer: 1,
            why: '«as» truncates without a word. If the protocol allows bigger bodies, the length on the wire will be wrong and the peer will misread the stream. «try_from» makes the too-big case an error you can see.',
          },
        ],
      },
      {
        lesson: 'read-flow', title: '«if», «match» and loops return values', mins: 6,
        remember: '«if» and «match» produce values, and a «match» must cover every case or it does not compile.',
        cue: 'A «match» with a «_ =>» arm → it silently catches every case added later; check that is intended',
        body: R`
          ## «if» is Java's ternary

          ~~~rust
          let label = if ok { "AA" } else { "AE" };
          ~~~

          Both branches must produce the same type, and there is no «? :» operator: this is it.

          ## «match» is a switch expression that must be complete

          :::vs Same decision, both languages
          ~~~java
          String label = switch (code) {
              case "AA" -> "accepted";
              case "AE" -> "error";
              default -> "unknown";
          };
          ~~~
          ~~~rust
          let label = match code {
              "AA" => "accepted",
              "AE" => "error",
              _ => "unknown",
          };
          ~~~
          :::

          - «_» is the default arm. Leave it out and the compiler insists every possible value is covered.
          - An arm can match a range «200..=299», several values «"AR" | "CR"», or pull a value out: «Some(n) =>».
          - A guard adds a condition: «s if s >= 500 =>».

          ~~~rust !run
          fn class(status: u16) -> &'static str {
              match status {
                  200..=299 => "ok",
                  429 => "slow down",
                  s if s >= 500 => "server error",
                  _ => "client error",
              }
          }

          fn main() {
              for s in [204, 429, 503, 404] {
                  println!("{s} {}", class(s));
              }
          }
          ~~~

          :::review Why «_ =>» deserves a look
          On an enum (module 05), a match with no «_» arm fails to compile when someone adds a variant, which forces every match to be revisited. A «_ =>» arm quietly swallows the new variant instead. Sometimes that is right; ask whether it is.
          :::

          @stop

          ## Loops

          - «for x in items» walks anything iterable, like Java's for-each. «for i in 0..n» counts 0 to n minus 1; «0..=n» includes n.
          - «while cond { }» is the same as Java.
          - «loop { }» runs until a «break», and «break value» hands a value out of the loop.
          - A label looks like a lifetime: «'outer: loop { ... break 'outer; }». It is only a name for the loop.

          @predict 0
        `,
        predict: [
          {
            q: 'What does this print?',
            code: 'fn main() {\n    let mut attempts = 0;\n    let n = loop {\n        attempts += 1;\n        if attempts == 3 {\n            break attempts * 10;\n        }\n    };\n    println!("{n}");\n}',
            options: ['3', '30', 'Compile error'],
            answer: 1,
            why: '«loop» is an expression. «break attempts * 10» leaves the loop and makes 30 the loop\'s value, which lands in «n».',
          },
        ],
      },
      {
        exercise: {
          id: 'read-counter', title: 'Translate a Java class', kind: 'build', mins: 10, diff: 'easy', topics: ['syntax'],
          statement: R`
            Here is a small Java class. Write the Rust version: a struct «RetryCounter» with the same behaviour.

            ~~~java RetryCounter.java
            public class RetryCounter {
                private final int max;
                private int used;

                public RetryCounter(int max) { this.max = max; }

                public boolean tryAgain() {
                    if (used >= max) return false;
                    used++;
                    return true;
                }

                public int remaining() { return max - used; }
            }
            ~~~

            Use «u32» for the numbers. «try_again» changes the counter, so it takes «&mut self»; «remaining» only reads.
          `,
          starter: R`
pub struct RetryCounter {
    // your fields here
}

impl RetryCounter {
    pub fn new(max: u32) -> RetryCounter {
        todo!()
    }

    pub fn try_again(&mut self) -> bool {
        todo!()
    }

    pub fn remaining(&self) -> u32 {
        todo!()
    }
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'starts with every retry left', ex: true, code: 'let c = RetryCounter::new(3);\nassert_eq!(c.remaining(), 3);' },
            { name: 'each try uses one', ex: true, code: 'let mut c = RetryCounter::new(2);\nassert!(c.try_again());\nassert_eq!(c.remaining(), 1);' },
            { name: 'stops at the limit', code: 'let mut c = RetryCounter::new(2);\nassert!(c.try_again());\nassert!(c.try_again());\nassert!(!c.try_again(), "a third try must be refused");\nassert_eq!(c.remaining(), 0);' },
            { name: 'a limit of zero never retries', code: 'let mut c = RetryCounter::new(0);\nassert!(!c.try_again());\nassert_eq!(c.remaining(), 0);' },
          ],
          hints: [
            'Two fields: the limit, and how many tries you have used.',
            'Build it in «new» with «RetryCounter { max, used: 0 }».',
            'In «try_again»: «if self.used >= self.max { return false; }», then «self.used += 1;», then a bare «true» as the last line.',
          ],
          solution: {
            rust: R`
pub struct RetryCounter {
    max: u32,
    used: u32,
}

impl RetryCounter {
    pub fn new(max: u32) -> RetryCounter {
        RetryCounter { max, used: 0 }
    }

    pub fn try_again(&mut self) -> bool {
        if self.used >= self.max {
            return false;
        }
        self.used += 1;
        true
    }

    pub fn remaining(&self) -> u32 {
        self.max - self.used
    }
}
`,
            why: R`
              - Fields live in the «struct»; behaviour lives in «impl».
              - «&mut self» on «try_again» is the Rust way of saying "this method mutates". The caller must hold the counter as «let mut c».
              - «return false;» leaves early, and the bare «true» on the last line is the normal return.
              - «remaining» cannot underflow here because «used» never passes «max». If it could, «self.max - self.used» would panic in debug and wrap in release: the same trap as the last lesson.
            `,
            talk: 'The struct holds the fields and the impl block holds the methods. try_again takes &mut self because it changes the count; remaining takes &self because it only reads. The last bare expression is the return value.',
          },
          wrong: [
            { name: 'counts past the limit', rust: 'pub struct RetryCounter { max: u32, used: u32 }\nimpl RetryCounter {\n    pub fn new(max: u32) -> RetryCounter { RetryCounter { max, used: 0 } }\n    pub fn try_again(&mut self) -> bool { self.used += 1; self.used <= self.max }\n    pub fn remaining(&self) -> u32 { self.max - self.used }\n}' },
            { name: 'off by one', rust: 'pub struct RetryCounter { max: u32, used: u32 }\nimpl RetryCounter {\n    pub fn new(max: u32) -> RetryCounter { RetryCounter { max, used: 0 } }\n    pub fn try_again(&mut self) -> bool { if self.used > self.max { return false; } self.used += 1; true }\n    pub fn remaining(&self) -> u32 { self.max.saturating_sub(self.used) }\n}' },
          ],
        },
      },
      {
        exercise: {
          id: 'read-fix-returns', title: 'Make it compile: three reading mistakes', kind: 'fix', mins: 8, diff: 'easy', topics: ['syntax'],
          statement: R`
            Three short functions, three classic mistakes a Java developer makes in Rust. Press **Run** to see the compiler's messages, then fix each one with the smallest change.

            Reading rustc's errors is half the skill. Each message points at a line, says what it expected, and usually says how to fix it.
          `,
          starter: R`
pub fn checksum(bytes: &[u8]) -> u32 {
    let mut sum = 0;
    for b in bytes {
        sum += *b as u32;
    }
    sum;
}

pub fn label(ok: bool) -> &'static str {
    if ok { "AA"; } else { "AE"; }
}

pub fn count_segments(msg: &str) -> usize {
    let count = 0;
    for line in msg.split('\r') {
        if !line.is_empty() {
            count += 1;
        }
    }
    count
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'checksum adds the bytes', ex: true, code: 'assert_eq!(checksum(b"AB"), 131);\nassert_eq!(checksum(b""), 0);' },
            { name: 'label picks AA or AE', ex: true, code: 'assert_eq!(label(true), "AA");\nassert_eq!(label(false), "AE");' },
            { name: 'count_segments skips the empty tail', ex: true, code: 'assert_eq!(count_segments("MSH|a\\rPID|b\\r"), 2);\nassert_eq!(count_segments(""), 0);' },
          ],
          hints: [
            'Two of the errors are "mismatched types": a semicolon turned a value into a statement.',
            'The third is "cannot assign twice to immutable variable". Which «let» needs a «mut»?',
          ],
          solution: {
            rust: R`
pub fn checksum(bytes: &[u8]) -> u32 {
    let mut sum = 0;
    for b in bytes {
        sum += *b as u32;
    }
    sum
}

pub fn label(ok: bool) -> &'static str {
    if ok { "AA" } else { "AE" }
}

pub fn count_segments(msg: &str) -> usize {
    let mut count = 0;
    for line in msg.split('\r') {
        if !line.is_empty() {
            count += 1;
        }
    }
    count
}
`,
            why: R`
              - «sum;» → «sum»: the last expression is the return value, and a semicolon throws it away.
              - «{ "AA"; }» → «{ "AA" }»: same rule inside each «if» branch. The «if» is the function's last expression, so its branches are the return value.
              - «let count» → «let mut count»: variables are read-only unless declared «mut».
              - «*b as u32» is safe here: widening a «u8» into a «u32» can never lose bits. «as» only bites when narrowing.
            `,
            talk: 'Two semicolons turned return values into statements, and one variable was missing mut. The compiler named all three; reading its message top to bottom was enough.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
