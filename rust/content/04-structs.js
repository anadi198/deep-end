(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'structs', title: 'Structs, enums and impl', short: 'Structs',
    blurb: 'The three struct forms, construction and update syntax, impl blocks with associated functions, methods and constants, the receiver types, how a method call finds its method, and enums whose variants carry data.',
    items: [
      {
        lesson: 'st-structs', title: 'Structs: named, tuple and unit', mins: 7,
        remember: 'A struct has named fields («struct A { x: T }»), positional fields («struct A(T);») or none («struct A;»). It holds data only, is built with a literal that sets every field, and has no inheritance.',
        cue: '«struct Port(u16)» → a newtype: a distinct type wrapping one value, so a port and a count can never be mixed up',
        body: R`
          ~~~text Syntax
          struct NAME { FIELD: TYPE, ... }         named fields
          struct NAME(TYPE, ...);                   a tuple struct: positional fields, read as .0, .1
          struct NAME;                              a unit struct: no fields, no size

          NAME { FIELD: EXPRESSION, ... }           a struct literal: every field must be set
          NAME { FIELD, ... }                       shorthand, when a variable has the field's name
          NAME { FIELD: EXPRESSION, ..BASE }        update syntax: the remaining fields come from BASE
          ~~~

          The rules:

          1. Every field must be given a value; there are no default field values. «#[derive(Default)]» plus «..Default::default()» fills the rest.
          2. Update syntax **moves** the remaining fields out of the base value. Fields that are «Copy» are copied, so the base stays usable if every moved field was «Copy» or was set explicitly.
          3. Fields are private to the defining module unless marked «pub» (the Crates module).
          4. There is no inheritance. Behaviour is shared through traits (the Traits module) and data through composition.

          ~~~rust !run
          #[derive(Debug, Default)]
          struct Config {
              host: String,
              port: u16,
              retries: u32,
              tls: bool,
          }

          #[derive(Debug, Clone, Copy, PartialEq)]
          struct Port(u16);

          #[derive(Debug)]
          struct Heartbeat;

          fn main() {
              let host = String::from("lab-a");
              let base = Config { host, port: 5100, ..Default::default() };
              let with_tls = Config { tls: true, host: "lab-b".to_string(), ..base };
              println!("{base:?}");
              println!("{with_tls:?}");

              let p = Port(5100);
              println!("{} {:?} {}", p.0, Heartbeat, p == Port(5100));
          }
          ~~~

          «base» is still usable after «..base» because the only field that is not «Copy», «host», was set explicitly in «with_tls».

          ## Derive

          «#[derive(...)]» asks the compiler to write standard trait implementations: «Debug» for «{:?}», «Clone» for «.clone()», «Copy» for implicit copies, «PartialEq» for «==», «Default» for «Default::default()». The Traits module lists them all with what each promises.

          @predict 0
        `,
        predict: [
          {
            q: 'One field is left out of the literal. What happens?',
            code: R`struct Config {
    host: String,
    port: u16,
    retries: u32,
}

fn main() {
    let c = Config { host: "lab-a".to_string(), port: 5100 };
    println!("{}", c.port);
}`,
            options: ['5100', 'Compile error', 'It panics'],
            answer: 1, error: 'E0063',
            why: '"missing field retries in initializer of Config". There are no implicit defaults; every field must be set, or taken from a base value with «..».',
          },
        ],
      },
      {
        lesson: 'st-impl', title: '«impl»: associated functions, methods and receivers', mins: 7,
        remember: 'Methods live in «impl» blocks. A function whose first parameter is «self», «&self» or «&mut self» is a method, called with dot syntax; one without is an associated function, called as «Type::name(..)». «Self» names the type being implemented.',
        cue: 'A method\'s receiver → «&self» reads the value, «&mut self» changes it, «self» consumes it',
        body: R`
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
          ~~~cpp !check frame.cpp
          class Frame {
              std::string kind_;
              unsigned retries_ = 0;

          public:
              explicit Frame(std::string kind) : kind_(std::move(kind)) {}

              const std::string& kind() const { return kind_; }
              void retry() { ++retries_; }
          };
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

          ~~~text Syntax
          impl TYPE {
              const NAME: TYPE = EXPRESSION;               an associated constant: TYPE::NAME
              fn NAME(PARAMS) -> TYPE BLOCK                an associated function: TYPE::NAME(..)
              fn NAME(RECEIVER, PARAMS) -> TYPE BLOCK      a method: value.NAME(..)
          }
          ~~~

          | Receiver | Short for | The method... |
          |---|---|---|
          | «&self» | «self: &Self» | reads the value |
          | «&mut self» | «self: &mut Self» | changes it; the caller needs a mutable place |
          | «self» | «self: Self» | takes ownership; the caller cannot use the value afterwards |
          | «mut self» | «mut self: Self» | takes ownership and may change its own copy |

          :::cpp In C++ terms
          | Rust | C++ |
          |---|---|
          | «fn kind(&self)» | «kind() const»: a member function that cannot change the object |
          | «fn retry(&mut self)» | «retry()»: a non-const member function |
          | «fn into_name(self)» | no direct equivalent; nearest is taking the object by value or as «Frame&&» |
          | «fn new(..) -> Self» | a static member function; Rust has no constructors |
          | «const LIMIT: u64» | «static constexpr std::uint64_t LIMIT» |

          There is no hidden «this»: the receiver is an ordinary parameter named «self», so a method is a function whose first argument you can see.
          :::

          - There are no constructors: «new» is a naming convention for an associated function that returns «Self». Others are «with_capacity», «from_parts», and the «Default» trait.
          - A type can have any number of «impl» blocks.
          - «value.method()» is sugar for «Type::method(&value)»; both forms compile.

          ~~~rust !run
          #[derive(Debug)]
          struct Counter {
              name: String,
              count: u64,
          }

          impl Counter {
              const LIMIT: u64 = 3;

              fn new(name: &str) -> Self {
                  Self { name: name.to_string(), count: 0 }
              }

              fn bump(&mut self) -> bool {
                  self.count += 1;
                  self.count <= Self::LIMIT
              }

              fn total(&self) -> u64 {
                  self.count
              }

              fn into_name(self) -> String {
                  self.name
              }
          }

          fn main() {
              let mut c = Counter::new("lab-a");
              for _ in 0..4 {
                  print!("{} ", c.bump());
              }
              println!();
              println!("{} {}", c.total(), Counter::total(&c));

              let boxed = Box::new(Counter::new("lab-b"));
              println!("{}", boxed.total());

              let name = c.into_name();
              println!("{name}");
          }
          ~~~

          @stop

          ## How «value.method()» finds the method

          For «v.m()», the compiler tries the receiver types «T», «&T», «&mut T» for the type of «v»; if none has «m», it dereferences «v» (through «&», «Box», «Rc», «String» to «str», «Vec» to a slice, ...) and tries again. This **auto-referencing and auto-dereferencing** is why «boxed.total()» works on a «Box<Counter>», and why you rarely write «&» or «*» in a method call. It happens only for the receiver, not for other arguments.

          @predict 0
        `,
        predict: [
          {
            q: '«bump» takes «&mut self», and the binding is not «mut». What happens?',
            code: R`struct Counter {
    count: u64,
}

impl Counter {
    fn bump(&mut self) {
        self.count += 1;
    }
}

fn main() {
    let c = Counter { count: 0 };
    c.bump();
    println!("{}", c.count);
}`,
            options: ['1', '0', 'Compile error'],
            answer: 2, error: 'E0596',
            why: 'A «&mut self» method needs a mutable borrow of «c», and an immutable binding cannot lend one: "cannot borrow c as mutable, as it is not declared as mutable". «let mut c» fixes it.',
          },
        ],
      },
      {
        lesson: 'tr-enums', title: 'Enums: variants that carry data', mins: 8, hunts: ['logic'],
        remember: 'An enum is a closed set of variants, and each variant can carry its own data, like a sealed interface with records. A value is always exactly one variant, and a «match» must handle every variant.',
        cue: 'A new enum variant → look at every «match» on that enum; a «_ =>» arm swallows the new variant with no compile error',
        body: R`
          ~~~text Syntax
          enum NAME {
              VARIANT,                         a unit variant
              VARIANT(TYPE, ...),              a tuple variant
              VARIANT { FIELD: TYPE, ... },    a struct variant
              VARIANT = INTEGER,               an explicit discriminant (only when no variant has fields)
          }
          ~~~

          - Variants are namespaced: «Ack::Accept». «use Ack::*;» brings them into scope.
          - A value is exactly one variant. Its size is the largest variant plus a tag.
          - Enums can be generic («enum Option<T>») and have «impl» blocks like structs.
          - A field-less enum can be cast to an integer with «as», and «#[repr(u8)]» fixes its representation.

          :::vs The same closed set of outcomes
          ~~~java
          sealed interface Ack permits Accept, Error, Reject {}
          record Accept() implements Ack {}
          record Error(String text) implements Ack {}
          record Reject(int code) implements Ack {}
          ~~~
          ~~~cpp !check
          struct Accept {};
          struct Error { std::string text; };
          struct Reject { std::uint16_t code; };

          using Ack = std::variant<Accept, Error, Reject>;
          ~~~
          ~~~rust
          enum Ack {
              Accept,
              Error(String),
              Reject { code: u16 },
          }
          ~~~
          :::

          :::cpp In C++ terms
          A plain C++ «enum» or «enum class» is only Rust's field-less enum. Variants that carry data are «std::variant» (C++17), taken apart with «std::visit» or «std::get_if». A «switch» over an «enum class» that misses a case is a warning («-Wswitch»), and it still compiles; a Rust «match» that misses a variant does not compile.
          :::

          «match» takes the data back out:

          ~~~rust !run
          enum Ack {
              Accept,
              Error(String),
              Reject { code: u16 },
          }

          fn describe(a: &Ack) -> String {
              match a {
                  Ack::Accept => "AA".to_string(),
                  Ack::Error(text) => format!("AE: {text}"),
                  Ack::Reject { code } => format!("AR {code}"),
              }
          }

          fn main() {
              for a in [Ack::Accept, Ack::Error("bad PID".into()), Ack::Reject { code: 207 }] {
                  println!("{}", describe(&a));
              }
          }
          ~~~

          @stop

          ## A new variant breaks the build, on purpose

          @predict 0

          That compile error is the point of enums: adding a case forces every decision about it to be revisited. Unless someone wrote a catch-all:

          ~~~rust !run
          enum Ack {
              Accept,
              Error(String),
              Timeout,
          }

          fn describe(a: &Ack) -> &str {
              match a {
                  Ack::Accept => "AA",
                  _ => "AE",
              }
          }

          fn main() {
              let _ = Ack::Error(String::new());
              println!("{}", describe(&Ack::Timeout));
          }
          ~~~

          It compiles, and a timeout is now reported as an application error. Maybe that is right. The point is that nobody decided.

          ## «Option» and «Result» are ordinary enums

          ~~~rust
          enum Option<T> { None, Some(T) }
          enum Result<T, E> { Ok(T), Err(E) }
          ~~~

          The standard library defines them exactly like this, and brings their variants into scope everywhere, which is why «Some(x)» needs no «Option::» prefix. The Errors module is built on them.

          @quiz 0
        `,
        predict: [
          {
            q: 'A «Timeout» variant was added, and «describe» was not updated. What happens?',
            code: 'enum Ack {\n    Accept,\n    Error(String),\n    Timeout,\n}\n\nfn describe(a: &Ack) -> &str {\n    match a {\n        Ack::Accept => "AA",\n        Ack::Error(_) => "AE",\n    }\n}\n\nfn main() {\n    println!("{}", describe(&Ack::Timeout));\n}',
            options: ['AA', 'Compile error', 'It panics', 'AE'],
            answer: 1, error: 'E0004',
            why: 'rustc reports "non-exhaustive patterns" and names the missing one, «Ack::Timeout». Every match on «Ack» without a catch-all fails the same way, so the compiler hands you the full list of places to update.',
          },
        ],
        quiz: [
          {
            q: 'A new variant «Ack::Timeout» is added. Which of these matches does the compiler NOT flag?',
            options: ['«match a { Ack::Accept => .., Ack::Error(_) => .. }»', '«match a { Ack::Accept => .., _ => .. }»', 'Both', 'Neither'],
            answer: 1,
            why: 'The «_» arm covers every variant, including future ones, so it keeps compiling. Whether a timeout should really land in that arm is exactly the question to ask.',
          },
        ],
      },
      {
        exercise: {
          id: 'read-counter', title: 'Translate a Java class', kind: 'build', mins: 10, diff: 'easy', topics: ['structs'],
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
            'Two fields: the limit, and how many tries have been used.',
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
              - «&mut self» on «try_again» says the method changes the counter, so the caller must hold it as «let mut c».
              - «return false;» leaves early, and the bare «true» on the last line is the normal return.
              - «remaining» cannot underflow because «used» never passes «max». If it could, «self.max - self.used» would panic in debug and wrap in release (the Types module).
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
          id: 'st-build-tally', title: 'Tally delivery outcomes', kind: 'build', mins: 12, diff: 'medium', topics: ['structs'],
          statement: R`
            «Outcome» is given. Write «Tally», which records outcomes one at a time and answers three questions:

            - «delivered()»: how many were delivered.
            - «rejected_with(code)»: how many were rejected with that code.
            - «slowest_timeout_ms()»: the longest timeout recorded, or «None» if nothing timed out.

            Choose the fields yourself. «record» takes «&mut self»; the three questions take «&self».
          `,
          starter: R`
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Outcome {
    Delivered,
    Rejected(u16),
    TimedOut { after_ms: u64 },
}

pub struct Tally {
    // your fields here
}

impl Tally {
    pub fn new() -> Tally {
        todo!()
    }

    pub fn record(&mut self, outcome: Outcome) {
        todo!()
    }

    pub fn delivered(&self) -> u32 {
        todo!()
    }

    pub fn rejected_with(&self, code: u16) -> u32 {
        todo!()
    }

    pub fn slowest_timeout_ms(&self) -> Option<u64> {
        todo!()
    }
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'a new tally is empty', ex: true, code: 'let t = Tally::new();\nassert_eq!(t.delivered(), 0);\nassert_eq!(t.rejected_with(207), 0);\nassert_eq!(t.slowest_timeout_ms(), None);' },
            { name: 'counts deliveries and rejections', ex: true, code: 'let mut t = Tally::new();\nfor o in [Outcome::Delivered, Outcome::Rejected(207), Outcome::Delivered, Outcome::Rejected(207), Outcome::Rejected(500)] {\n    t.record(o);\n}\nassert_eq!(t.delivered(), 2);\nassert_eq!(t.rejected_with(207), 2);\nassert_eq!(t.rejected_with(500), 1);\nassert_eq!(t.rejected_with(404), 0);' },
            { name: 'keeps the slowest timeout', code: 'let mut t = Tally::new();\nt.record(Outcome::TimedOut { after_ms: 500 });\nt.record(Outcome::TimedOut { after_ms: 200 });\nt.record(Outcome::Delivered);\nassert_eq!(t.slowest_timeout_ms(), Some(500));' },
          ],
          hints: [
            'Three fields are enough: a delivered count, the rejection codes seen (a «Vec<u16>»), and the slowest timeout so far (an «Option<u64>»).',
            '«record» is one «match» on the outcome, with one arm per variant. «Outcome::TimedOut { after_ms }» binds the field.',
            '«Option<u64>» can be compared: «None» is less than any «Some», so «self.slowest.max(Some(after_ms))» keeps the larger.',
          ],
          solution: {
            rust: R`
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Outcome {
    Delivered,
    Rejected(u16),
    TimedOut { after_ms: u64 },
}

pub struct Tally {
    delivered: u32,
    rejections: Vec<u16>,
    slowest: Option<u64>,
}

impl Tally {
    pub fn new() -> Tally {
        Tally { delivered: 0, rejections: Vec::new(), slowest: None }
    }

    pub fn record(&mut self, outcome: Outcome) {
        match outcome {
            Outcome::Delivered => self.delivered += 1,
            Outcome::Rejected(code) => self.rejections.push(code),
            Outcome::TimedOut { after_ms } => self.slowest = self.slowest.max(Some(after_ms)),
        }
    }

    pub fn delivered(&self) -> u32 {
        self.delivered
    }

    pub fn rejected_with(&self, code: u16) -> u32 {
        let mut n = 0;
        for &c in &self.rejections {
            if c == code {
                n += 1;
            }
        }
        n
    }

    pub fn slowest_timeout_ms(&self) -> Option<u64> {
        self.slowest
    }
}
`,
            why: R`
              - One «match» in «record», one arm per variant, and each arm pulls out the variant's data. Adding a fourth variant would make this «match» fail to compile, which is what you want.
              - A field and a method may share a name («delivered»): «self.delivered» is the field, «t.delivered()» the method.
              - «Option» implements «Ord» with «None» below every «Some», so «max» keeps the larger timeout and handles the first one too.
              - A «HashMap<u16, u32>» would count rejections without scanning; the Collections and text module covers it.
            `,
            talk: 'The tally keeps a delivered count, the rejection codes, and the slowest timeout as an Option. record is a single exhaustive match on the outcome, and the questions only read the fields.',
          },
          wrong: [
            { name: 'keeps the last timeout, not the slowest', rust: '#[derive(Debug, Clone, Copy, PartialEq)]\npub enum Outcome { Delivered, Rejected(u16), TimedOut { after_ms: u64 } }\npub struct Tally { delivered: u32, rejections: Vec<u16>, slowest: Option<u64> }\nimpl Tally {\n    pub fn new() -> Tally { Tally { delivered: 0, rejections: Vec::new(), slowest: None } }\n    pub fn record(&mut self, outcome: Outcome) {\n        match outcome {\n            Outcome::Delivered => self.delivered += 1,\n            Outcome::Rejected(code) => self.rejections.push(code),\n            Outcome::TimedOut { after_ms } => self.slowest = Some(after_ms),\n        }\n    }\n    pub fn delivered(&self) -> u32 { self.delivered }\n    pub fn rejected_with(&self, code: u16) -> u32 { self.rejections.iter().filter(|&&c| c == code).count() as u32 }\n    pub fn slowest_timeout_ms(&self) -> Option<u64> { self.slowest }\n}' },
          ],
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
