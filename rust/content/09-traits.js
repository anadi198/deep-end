(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'traits', title: 'Traits and generics', short: 'Traits',
    blurb: 'Traits as interfaces, the formal syntax of traits, bounds and generics, generics versus «dyn», the standard traits and what each promises, and the «From», «Into» and «Display» conversions.',
    items: [
      {
        lesson: 'tr-traits', title: 'Traits are interfaces', mins: 7,
        remember: 'A trait is an interface: «impl Trait for Type» means "Type implements Trait", and you can implement your own trait even for types you did not write.',
        cue: '«impl X for Y» → read it as "Y implements X"; open the trait definition to see what it promises',
        body: R`
          :::vs An interface and its implementation
          ~~~java
          interface Sink {
              void send(byte[] frame) throws IOException;
              default String name() { return "sink"; }
          }

          class FileSink implements Sink {
              public void send(byte[] frame) { /* write */ }
          }
          ~~~
          ~~~cpp !check
          struct Sink {
              virtual void send(std::span<const std::uint8_t> frame) = 0;
              virtual std::string name() const { return "sink"; }
              virtual ~Sink() = default;
          };

          struct FileSink : Sink {
              void send(std::span<const std::uint8_t>) override {}
          };
          ~~~
          ~~~rust
          trait Sink {
              fn send(&mut self, frame: &[u8]) -> std::io::Result<()>;
              fn name(&self) -> &str { "sink" }
          }

          struct FileSink;

          impl Sink for FileSink {
              fn send(&mut self, frame: &[u8]) -> std::io::Result<()> { Ok(()) }
          }
          ~~~
          :::

          - «impl Sink for FileSink» is «class FileSink implements Sink».
          - A trait method with a body is a default method, as in Java.
          - The implementation lives in its own «impl ... for ...» block, apart from the struct and its other methods. One type can have many of these blocks, one per trait.
          - In C++ terms, a trait plays two roles. Used with «dyn», it is an abstract base class with virtual functions, minus the inheritance: no base-class fields, and a struct "inherits" nothing. Used as a generic bound, it is a C++20 concept, checked when the generic function is defined rather than when a template is instantiated. The next lessons show both.

          ## Implementing your trait for someone else's type

          ~~~rust !run
          trait Describe {
              fn describe(&self) -> String;
          }

          struct Frame {
              kind: String,
          }

          impl Describe for Frame {
              fn describe(&self) -> String {
                  format!("frame {}", self.kind)
              }
          }

          impl Describe for u16 {
              fn describe(&self) -> String {
                  format!("port {self}")
              }
          }

          fn main() {
              let f = Frame { kind: "ADT^A01".into() };
              println!("{}", f.describe());
              println!("{}", 2575u16.describe());
          }
          ~~~

          Java cannot add an interface to «Integer». Rust can, with one limit: either the trait or the type must be yours. Implementing someone else's trait for someone else's type is refused:

          ~~~rust !fail
          use std::fmt;

          impl fmt::Display for Vec<u8> {
              fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
                  write!(f, "{} bytes", self.len())
              }
          }

          fn main() {}
          ~~~

          @stop

          ## The traits you will see on nearly every type

          | Trait | Gives you | Java version |
          |---|---|---|
          | «Debug» | printing with «{:?}» | a developer «toString()» |
          | «Display» | printing with «{}» | a user-facing «toString()» |
          | «Clone», «Copy» | «.clone()»; copying on assignment | «clone()» |
          | «PartialEq», «Eq» | «==» | «equals()» |
          | «Hash» | use as a «HashMap» key | «hashCode()» |
          | «PartialOrd», «Ord» | «<», sorting | «Comparable» |
          | «Default» | «T::default()» | a no-argument constructor |
          | «From», «Into» | conversions (last lesson in this module) | static factory methods |
          | «Send», «Sync» | safe to move or share between threads (the Shared state module) | (nothing) |
          | «Drop» | cleanup at the end of scope | «AutoCloseable» |

          @predict 0
        `,
        predict: [
          {
            q: 'A struct used as a HashMap key. What happens?',
            code: 'use std::collections::HashMap;\n\n#[derive(Debug, PartialEq)]\nstruct Peer {\n    host: String,\n    port: u16,\n}\n\nfn main() {\n    let mut seen = HashMap::new();\n    seen.insert(Peer { host: "lab".into(), port: 2575 }, 1);\n    println!("{}", seen.len());\n}',
            options: ['1', 'Compile error', 'It panics'],
            answer: 1, error: 'E0277',
            why: 'A HashMap key needs «Eq» and «Hash», and «Peer» only derives «PartialEq». rustc reports two E0277 errors (the trait bound «Peer: Eq» is not satisfied, then the same for «Hash») and suggests the derives. «#[derive(PartialEq, Eq, Hash)]» fixes it. Java would compile and silently use identity hashing.',
          },
        ],
      },
      {
        lesson: 'tr-syntax', title: 'Traits and bounds, formally', mins: 8,
        remember: 'A trait declares methods (required, or provided with a default body), associated types and associated constants. A bound «T: Trait» limits a generic to implementing types, «where» holds longer bounds, and «impl Trait for Type» is allowed only when the trait or the type belongs to your crate.',
        cue: 'Two traits give a type the same method name → «Trait::method(&x)» or «<Type as Trait>::method(&x)» says which one',
        body: R`
          ~~~text Syntax
          trait NAME[<GENERICS>] [: SUPERTRAIT + ...] {
              type ASSOCIATED_TYPE [: BOUNDS];
              const ASSOCIATED_CONST: TYPE [= EXPRESSION];
              fn METHOD(&self, ...) -> TYPE;              required
              fn METHOD(&self, ...) -> TYPE BLOCK         provided: a default body
          }

          impl[<GENERICS>] TRAIT for TYPE [where BOUNDS] { ... }
          fn NAME<T: BOUND + BOUND, U>(x: T, y: U) [-> TYPE] where U: BOUND BLOCK
          ~~~

          The rules:

          1. An «impl» must define every required method, associated type and constant without a default; it may override the defaults.
          2. «trait Sink: Debug» makes «Debug» a **supertrait**: every «Sink» type must also implement «Debug», and «Sink»'s methods may use it.
          3. An **associated type** («type Item;» in «Iterator») is fixed once per implementing type. A **generic trait** («From<T>») can be implemented many times for one type, once per «T».
          4. A **bound** is «T: A + B + 'static»; the same can be written in a «where» clause. «impl Trait» as a parameter type is an anonymous generic; as a return type it is one concrete type the caller cannot name.
          5. Impls can be generic: «impl<T: Display> Describe for Wrapper<T>», or even **blanket**: «impl<T: Display> ToString for T» is how every «Display» type gets «to_string()».
          6. **Coherence (the orphan rule)**: «impl TRAIT for TYPE» compiles only if the trait or the type is defined in the current crate. So there is at most one implementation of a trait for a type in any program.
          7. A trait's methods can be called only when the trait is **in scope** («use path::Trait;»).
          8. «dyn Trait» needs a **dyn-compatible** trait: roughly, no method may return «Self» or take generic type parameters (unless marked «where Self: Sized»).

          ~~~rust !run
          use std::fmt::{self, Debug, Display};

          trait Destination: Debug {
              type Receipt: Display;
              const MAX_FRAME: usize = 1024;

              fn send(&mut self, frame: &[u8]) -> Self::Receipt;

              fn name(&self) -> String {
                  format!("{self:?}")
              }
          }

          #[derive(Debug)]
          struct Console;

          struct Seq(u64);

          impl Display for Seq {
              fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
                  write!(f, "#{}", self.0)
              }
          }

          impl Destination for Console {
              type Receipt = Seq;
              const MAX_FRAME: usize = 16;

              fn send(&mut self, frame: &[u8]) -> Seq {
                  Seq(frame.len() as u64)
              }
          }

          fn deliver<D>(dest: &mut D, frames: &[&[u8]]) -> Vec<String>
          where
              D: Destination,
          {
              frames.iter().filter(|f| f.len() <= D::MAX_FRAME).map(|f| dest.send(f).to_string()).collect()
          }

          fn main() {
              let mut c = Console;
              let frames: [&[u8]; 2] = [b"MSH|a", &[0u8; 64]];
              println!("{:?}", deliver(&mut c, &frames));
              println!("{} {}", c.name(), <Console as Destination>::MAX_FRAME);
          }
          ~~~

          @stop

          ## A trait must be in scope

          ~~~rust !fail
          mod ports {
              pub trait Describe {
                  fn describe(&self) -> String;
              }

              impl Describe for u16 {
                  fn describe(&self) -> String {
                      format!("port {self}")
                  }
              }
          }

          fn main() {
              println!("{}", 5100u16.describe());
          }
          ~~~

          The compiler finds the trait and suggests the «use» line. This is why crates often offer a «prelude» module to glob-import.

          @predict 0
        `,
        predict: [
          {
            q: 'Two traits give «X» a method with the same name. What happens?',
            code: R`trait Audit {
    fn id(&self) -> &str {
        "audit"
    }
}

trait Route {
    fn id(&self) -> &str {
        "route"
    }
}

struct X;
impl Audit for X {}
impl Route for X {}

fn main() {
    println!("{}", X.id());
}`,
            options: ['audit', 'route', 'Compile error'],
            answer: 2, error: 'E0034',
            why: '"multiple applicable items in scope": the call is ambiguous, and Rust does not pick one. «Audit::id(&X)» or «<X as Route>::id(&X)» names the trait explicitly.',
          },
        ],
      },
      {
        lesson: 'tr-generics', title: 'Generics and «dyn»: two ways to accept any implementer', mins: 8,
        remember: '«impl Trait» and «<T: Trait>» are generics, resolved at compile time; «dyn Trait» behind «Box», «&» or «Arc» is a Java-style interface reference, resolved at run time.',
        cue: '«Box<dyn Trait>» or «Arc<dyn Trait>» → a runtime interface reference, like a Java field typed as an interface; «impl Trait» or «T: Trait» → one compiled copy per concrete type',
        body: R`
          ## Three spellings of the same generic

          ~~~rust
          fn send_all(sink: &mut impl Sink, frames: &[Vec<u8>])           // impl Trait
          fn send_all<S: Sink>(sink: &mut S, frames: &[Vec<u8>])           // a type parameter with a bound
          fn send_all<S>(sink: &mut S, frames: &[Vec<u8>]) where S: Sink   // the bound moved to a where clause
          ~~~

          All three mean "any type that implements «Sink»". The compiler generates a separate copy of the function for each concrete type it is called with, so there is no run-time dispatch.

          :::cpp In C++ terms
          This is a template, and the copies are template instantiations: the same monomorphisation, the same code size trade-off. The bound «S: Sink» is a C++20 concept. The difference is when the checking happens: a Rust generic body may only use what its bounds promise, so it is checked once, at its definition; a C++ template body is checked at each instantiation, which is where those long template error messages come from.
          :::

          ~~~cpp !check The same bound as a C++20 concept
          template <typename T>
          concept Sink = requires(T t, std::span<const std::uint8_t> frame) { t.send(frame); };

          template <Sink S>
          void send_all(S& sink, const std::vector<std::vector<std::uint8_t>>& frames) {
              for (const auto& f : frames) sink.send(f);
          }
          ~~~

          And «dyn Sink» below is a pointer to an abstract base class: a pointer to the data plus a pointer to a table of functions (a vtable), resolved at run time.

          ## And the run-time one

          ~~~rust
          fn send_all(sink: &mut dyn Sink, frames: &[Vec<u8>])            // any Sink, picked at run time
          ~~~

          | You see | Resolved | Feels like | Typical use |
          |---|---|---|---|
          | «impl Sink», «<S: Sink>» | at compile time | Java generics | helpers and functions |
          | «&dyn Sink», «Box<dyn Sink>», «Arc<dyn Sink>» | at run time, through a pointer | a Java field or list typed as an interface | lists of different implementations, plugins |

          A list that mixes implementations needs «dyn»:

          ~~~rust !run
          trait Sink {
              fn send(&mut self, frame: &str);
          }

          struct Console;
          struct Counter {
              n: usize,
          }

          impl Sink for Console {
              fn send(&mut self, frame: &str) {
                  println!("console: {frame}");
              }
          }

          impl Sink for Counter {
              fn send(&mut self, _frame: &str) {
                  self.n += 1;
              }
          }

          fn main() {
              let mut sinks: Vec<Box<dyn Sink>> = vec![Box::new(Console), Box::new(Counter { n: 0 })];
              for frame in ["A01", "A08"] {
                  for s in sinks.iter_mut() {
                      s.send(frame);
                  }
              }
              println!("{} sinks", sinks.len());
          }
          ~~~

          @stop

          ## Bounds stack with «+»

          «T: Send + Sync + 'static» reads "T is thread-safe to move and share, and borrows nothing short-lived". «Box<dyn Error + Send + Sync>» is "any error that can cross threads". «Send» and «Sync» are covered in the Shared state module, and «'static» in the Borrowing module.

          ## Traits as test seams

          This is the same trick as Java interfaces plus mocks. Code that reaches the network through a small trait («Accept», «Clock», «Transport») can be tested with a fake that fails on command. Server code does this all the time, and the Networking module uses it.

          :::pitfall Generic soup
          It is tempting to keep adding type parameters and bounds until code compiles: «fn run<T, U, F>(..) where T: A + B + Clone + 'static, F: Fn(U) -> T + Send». If a function is only ever called with one type, a concrete type is far easier to read.
          :::

          @quiz 0
        `,
        quiz: [
          {
            q: 'Which signature lets a function take a list that mixes two different «Sink» implementations?',
            options: ['«fn run(sinks: Vec<impl Sink>)»', '«fn run<S: Sink>(sinks: Vec<S>)»', '«fn run(sinks: Vec<Box<dyn Sink>>)»', 'All three'],
            answer: 2,
            why: 'A generic picks one concrete type per call, so a «Vec<S>» holds only one kind. A list of different implementations needs trait objects: «Box<dyn Sink>».',
          },
        ],
      },
      {
        lesson: 'tr-std', title: 'The standard traits and what they promise', mins: 7, hunts: ['logic'],
        remember: 'The derivable traits are «Debug», «Clone», «Copy», «PartialEq», «Eq», «PartialOrd», «Ord», «Hash» and «Default», and each carries a promise: «Eq» means every value equals itself, «Hash» must agree with «Eq», «Ord» is a total order. Operators are traits too: «a + b» calls «Add::add(a, b)».',
        cue: 'A hand-written «impl PartialEq» or «impl Hash» → they must agree: equal values must hash equally, or «HashMap» lookups quietly miss',
        body: R`
          | Trait | Derive? | Promise or requirement | Needed by |
          |---|---|---|---|
          | «Debug» | yes | a developer-facing format | «{:?}», «assert_eq!», «unwrap» messages |
          | «Display» | no | a user-facing format; gives «to_string()» | «{}» |
          | «Clone» | yes | an explicit copy, which may allocate | «.clone()» |
          | «Copy» | yes | an implicit bit-for-bit copy; needs «Clone», all fields «Copy», no «Drop» | assignment copies instead of moving |
          | «PartialEq» | yes | «==» and «!=» | |
          | «Eq» | yes | also reflexive: «a == a» always (floats are not) | «HashMap» keys |
          | «PartialOrd» | yes | «<», «>»; «partial_cmp» returns «Option<Ordering>» | |
          | «Ord» | yes | a total order; needs «Eq» and «PartialOrd» | «sort()», «BTreeMap», «max()» |
          | «Hash» | yes | «a == b» implies equal hashes | «HashMap», «HashSet» keys |
          | «Default» | yes | a default value | «..Default::default()», «unwrap_or_default()» |
          | «Drop» | no | runs at the end of the owner's scope | |
          | «Deref», «DerefMut» | no | «*x», and auto-deref in method calls | «Box», «String», «Vec», «Rc», «Arc» |
          | «AsRef<T>», «Borrow<T>» | no | a cheap reference conversion | «HashMap<String, _>» looked up by «&str» |
          | «Send», «Sync» | automatic | safe to move, or to share, between threads | «thread::spawn», «tokio::spawn» |

          Derived comparisons are **lexicographic in declaration order**: fields top to bottom for a struct, and for an enum, earlier variants are smaller.

          :::cpp In C++ terms
          «#[derive(PartialEq)]» is C++20's «bool operator==(const T&) const = default;», and «#[derive(PartialOrd, Ord)]» is «auto operator<=>(const T&) const = default;»: the same member-by-member comparison in declaration order. «Clone» is a copy constructor you have to call by name, «Copy» marks a type as trivially copyable, «Drop» is the destructor, and «Default» is a default constructor.
          :::

          ## Operators are traits

          | Expression | Calls |
          |---|---|
          | «a + b», «a - b», «a * b», «-a» | «Add::add(a, b)», «Sub», «Mul», «Neg» |
          | «a += b» | «AddAssign::add_assign(&mut a, b)» |
          | «a[i]» | «*Index::index(&a, i)», or «IndexMut» |
          | «a == b», «a < b» | «PartialEq::eq(&a, &b)», «PartialOrd::lt(&a, &b)» |
          | «*a» | «*Deref::deref(&a)» |
          | «f(x)» on a closure | «Fn::call», «FnMut», «FnOnce» |

          This is C++ operator overloading with names: «impl Add for Bytes» is «Bytes operator+(Bytes, Bytes)», and «Deref» is «operator*» and «operator->». Rust lets you overload only the operators that have a trait, so there is no overloading of «&&», «||», «=» or «,».

          ~~~rust !run
          use std::ops::Add;

          #[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
          struct Version {
              major: u16,
              minor: u16,
          }

          #[derive(Debug, Clone, Copy, PartialEq, Default)]
          struct Bytes(u64);

          impl Add for Bytes {
              type Output = Bytes;

              fn add(self, other: Bytes) -> Bytes {
                  Bytes(self.0 + other.0)
              }
          }

          fn main() {
              let mut vs = vec![
                  Version { major: 1, minor: 10 },
                  Version { major: 1, minor: 2 },
                  Version { major: 0, minor: 99 },
              ];
              vs.sort();
              println!("{vs:?}");
              println!("{:?} {:?}", vs.iter().max(), Version::default());
              println!("{:?}", Bytes(512) + Bytes(1024));
          }
          ~~~

          @predict 0
        `,
        predict: [
          {
            q: 'A derived ordering on an enum. What does this print?',
            code: R`#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Level {
    Error,
    Warn,
    Info,
}

fn main() {
    println!("{}", Level::Error < Level::Info);
}`,
            options: ['true', 'false', 'Compile error'],
            answer: 0,
            why: 'A derived «PartialOrd» on an enum orders variants by declaration: «Error» comes first, so it is the smallest. Reordering the variants changes every comparison, which is worth remembering before sorting log levels or priorities this way.',
          },
        ],
      },
      {
        lesson: 'tr-conversions', title: '«From», «Into» and «Display»: the everyday conversions', mins: 6,
        remember: '«From» and «Into» are Rust\'s standard conversions, and «?» uses «From» to convert errors; «Display» is «toString()» for people, «Debug» is for developers.',
        cue: '«.into()» with no type in sight → the destination decides the conversion; look at the parameter or variable it flows into',
        body: R`
          ~~~rust !run
          use std::fmt;

          struct Port(u16);

          impl From<u16> for Port {
              fn from(n: u16) -> Port {
                  Port(n)
              }
          }

          impl fmt::Display for Port {
              fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
                  write!(f, "port {}", self.0)
              }
          }

          fn open(p: Port) {
              println!("opening {p}");
          }

          fn main() {
              open(Port::from(2575));
              open(6661.into());
              let text: String = "ADT".into();
              println!("{text}");
          }
          ~~~

          - «impl From<u16> for Port» gives «Port::from(2575)» and, for free, «2575.into()» wherever a «Port» is expected.
          - «"ADT".into()» becomes a «String» only because the variable says «String». The same call elsewhere could become something else.
          - «impl Display» is what «{}» and «.to_string()» use.

          @predict 0

          @stop

          ## How «?» converts errors

          The Errors module's «#[from]» in thiserror writes an «impl From<io::Error> for FrameError». «?» calls that «From» on the way out. Here it is by hand:

          ~~~rust !run
          use std::num::ParseIntError;

          #[derive(Debug)]
          enum ConfigError {
              BadNumber(ParseIntError),
          }

          impl From<ParseIntError> for ConfigError {
              fn from(e: ParseIntError) -> ConfigError {
                  ConfigError::BadNumber(e)
              }
          }

          fn port(raw: &str) -> Result<u16, ConfigError> {
              Ok(raw.trim().parse::<u16>()?)
          }

          fn main() {
              println!("{:?}", port("2575"));
              println!("{:?}", port("x"));
          }
          ~~~

          :::pitfall Read the «From» when errors are converted
          A «From» impl decides, silently, which variant every error becomes whenever «?» is used. If it maps every I/O error to «Permanent», a timeout that deserved a retry is treated as a final failure. The find-the-bugs exercise at the end of this module has exactly that.
          :::
        `,
        predict: [
          {
            q: 'Converting a u16 into a u8 with «into()». What happens?',
            code: 'fn main() {\n    let n: u8 = 300u16.into();\n    println!("{n}");\n}',
            options: ['44', 'Compile error', 'It panics'],
            answer: 1, error: 'E0277',
            why: '«From» only exists for conversions that cannot lose information. A «u16» does not always fit in a «u8», so there is no «From», and «into()» does not compile. «u8::try_from(300u16)» is the checked version. Compare with «as», which never refuses.',
          },
        ],
      },
      {
        exercise: {
          id: 'tr-fix-variant', title: 'Add a timeout outcome (and find every decision)', kind: 'fix', mins: 10, diff: 'easy', topics: ['traits'],
          statement: R`
            Sometimes the peer never answers. Add an «Outcome::TimedOut» variant and handle it:

            - its audit line is «TIMEOUT»;
            - a timed-out message **must be retried** (the peer never saw it, or never answered);
            - a nacked message is **not** retried (the peer rejected it on purpose).

            The tests already use «Outcome::TimedOut», so the starter does not compile until the variant exists. Watch which functions the compiler points at, and which it does not.
          `,
          starter: R`
#[derive(Debug, PartialEq)]
pub enum Outcome {
    Acked,
    Nacked(String),
}

/// The line written to the audit log.
pub fn audit_line(o: &Outcome) -> String {
    match o {
        Outcome::Acked => "ACK".to_string(),
        Outcome::Nacked(why) => format!("NACK {why}"),
    }
}

/// Whether the message should be sent again.
pub fn should_retry(o: &Outcome) -> bool {
    match o {
        Outcome::Acked => false,
        _ => false,
    }
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'audit lines', ex: true, code: 'assert_eq!(audit_line(&Outcome::Acked), "ACK");\nassert_eq!(audit_line(&Outcome::Nacked("AE".into())), "NACK AE");\nassert_eq!(audit_line(&Outcome::TimedOut), "TIMEOUT");' },
            { name: 'acked and nacked are not retried', ex: true, code: 'assert!(!should_retry(&Outcome::Acked));\nassert!(!should_retry(&Outcome::Nacked("AR".into())));' },
            { name: 'a timeout is retried', code: 'assert!(should_retry(&Outcome::TimedOut), "a timeout must be retried");' },
          ],
          lint: [
            { re: '_\\s*=>', when: 'present', note: 'A «_ =>» arm will swallow the next variant too. Listing the variants means the compiler flags this match next time.' },
          ],
          hints: [
            'Add «TimedOut,» to the enum. The compiler then points at «audit_line». Does it point at «should_retry»?',
            '«should_retry» has «_ => false», so it compiles and quietly says a timeout is never retried.',
            'Replace the catch-all with explicit arms: «Outcome::TimedOut => true» and «Outcome::Acked | Outcome::Nacked(_) => false».',
          ],
          solution: {
            rust: R`
#[derive(Debug, PartialEq)]
pub enum Outcome {
    Acked,
    Nacked(String),
    TimedOut,
}

/// The line written to the audit log.
pub fn audit_line(o: &Outcome) -> String {
    match o {
        Outcome::Acked => "ACK".to_string(),
        Outcome::Nacked(why) => format!("NACK {why}"),
        Outcome::TimedOut => "TIMEOUT".to_string(),
    }
}

/// Whether the message should be sent again.
pub fn should_retry(o: &Outcome) -> bool {
    match o {
        Outcome::TimedOut => true,
        Outcome::Acked | Outcome::Nacked(_) => false,
    }
}
`,
            why: R`
              - The compiler flagged «audit_line», because it listed every variant. It could not flag «should_retry»: the «_» arm already covered the new variant, and answered «false».
              - That silent «false» is the real bug: timeouts would never be retried.
              - Listing variants explicitly («Acked | Nacked(_) => false») turns the next new variant into a compile error instead of a quiet decision.
            `,
            talk: 'The compiler flagged the match that listed every variant, but not the one ending in _ => false, which silently decided timeouts are never retried. Explicit arms make the next new variant a compile error instead of a bug.',
          },
          wrong: [
            { name: 'fixes only what the compiler flagged', rust: R`
#[derive(Debug, PartialEq)]
pub enum Outcome { Acked, Nacked(String), TimedOut }
pub fn audit_line(o: &Outcome) -> String {
    match o { Outcome::Acked => "ACK".to_string(), Outcome::Nacked(why) => format!("NACK {why}"), Outcome::TimedOut => "TIMEOUT".to_string() }
}
pub fn should_retry(o: &Outcome) -> bool {
    match o { Outcome::Acked => false, _ => false }
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'tr-review-route', title: 'Find the bugs: pluggable destinations', kind: 'review', mins: 14, diff: 'medium', topics: ['traits'],
          file: 'src/route.rs',
          statement: R`
            **The change:** Introduces a «Destination» trait so a route can send each frame to several destinations (TCP, file, HTTP). Adds an «io::Error» conversion so destinations can use «?», and a «Display» for TCP destinations for the logs.

            Context: frames are up to a few MB; a route usually has two or three destinations; the retry worker re-sends anything that failed with «SendError::Retryable».
          `,
          code: R`
use std::fmt;
use std::io;

#[derive(Debug, Clone, Copy, PartialEq)] ⟦d1⟧
pub enum Reply {
    Ack,
    Nack,
    Busy,
}

#[derive(Debug, PartialEq)]
pub enum SendError {
    Retryable(String),
    Permanent(String),
}

+impl From<io::Error> for SendError {
+    fn from(e: io::Error) -> SendError {
+        SendError::Permanent(e.to_string()) ⟦a⟧
+    }
+}
+
+pub trait Destination {
+    fn name(&self) -> String;
+    fn send(&mut self, frame: Vec<u8>) -> Result<Reply, SendError>; ⟦b⟧
+}
+
+pub struct Route {
+    pub destinations: Vec<Box<dyn Destination + Send>>, ⟦d2⟧
+}
+
+impl Route {
+    /// Sends to every destination. Returns how many accepted the frame.
+    pub fn deliver(&mut self, frame: &[u8]) -> usize {
+        let mut delivered = 0;
+        for d in self.destinations.iter_mut() {
+            match d.send(frame.to_vec()) { ⟦b⟧
+                Ok(Reply::Ack) => delivered += 1,
+                Ok(Reply::Busy) => {}
+                _ => delivered += 1, ⟦c⟧
+            }
+        }
+        delivered
+    }
+}
+
+pub struct Tcp {
+    pub host: String,
+    pub port: u16,
+}
+
+impl fmt::Display for Tcp {
+    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
+        let ip: std::net::IpAddr = self.host.parse().unwrap(); ⟦e⟧
+        write!(f, "tcp://{ip}:{}", self.port)
+    }
+}
`,
          issues: [
            {
              id: 'a', tag: 'logic', title: 'Every I/O error becomes permanent, so nothing is ever retried',
              why: 'Timeouts, refused connections and resets are the errors that deserve a retry. This «From» turns all of them into «Permanent», and because «?» calls it silently, every destination inherits the mistake: a network blip becomes a message nobody will ever re-send.',
              fix: 'Match on «e.kind()»: «TimedOut», «ConnectionRefused», «ConnectionReset», «ConnectionAborted», «Interrupted» and «WouldBlock» become «Retryable»; the rest «Permanent».',
              demo: 'let e: SendError = io::Error::new(io::ErrorKind::TimedOut, "no reply").into();\nassert!(matches!(e, SendError::Retryable(_)), "a timeout should be retryable");',
            },
            {
              id: 'b', tag: 'cost', title: 'The trait forces a full copy of the frame per destination',
              why: '«send» takes «Vec<u8>» by value, so the route has to «to_vec()» the frame for every destination: a multi-MB allocation and copy, two or three times per message, just so each destination can read it.',
              fix: 'Make the trait borrow: «fn send(&mut self, frame: &[u8])». The route then passes «frame» straight through.',
            },
            {
              id: 'c', tag: 'logic', title: 'NACKs and errors are counted as delivered',
              why: 'The catch-all arm matches «Ok(Reply::Nack)» and every «Err(...)», and adds one to «delivered». A route whose destinations all rejected the frame reports it as delivered.',
              fix: 'List the cases: «Ok(Reply::Ack) => delivered += 1», «Ok(Reply::Busy) | Ok(Reply::Nack) => {}», «Err(e) =>» log it and hand it to the retry worker if it is «Retryable».',
              demo: 'struct Nacker;\nimpl Destination for Nacker {\n    fn name(&self) -> String { "nacker".into() }\n    fn send(&mut self, _frame: Vec<u8>) -> Result<Reply, SendError> { Ok(Reply::Nack) }\n}\nlet mut r = Route { destinations: vec![Box::new(Nacker)] };\nassert_eq!(r.deliver(b"MSH"), 0, "a NACK is not a delivery");',
            },
            {
              id: 'e', tag: 'panic', title: 'Logging a destination with a host name crashes',
              why: '«Display» assumes «host» is an IP address. The first destination configured as «lab.local» panics the moment it is formatted for a log line. Formatting a value must never crash.',
              fix: 'Write the host as it is: «write!(f, "tcp://{}:{}", self.host, self.port)».',
              demo: 'let t = Tcp { host: "lab.local".into(), port: 2575 };\nassert_eq!(t.to_string(), "tcp://lab.local:2575");',
            },
          ],
          decoys: [
            { id: 'd1', why: '«Copy» on a small enum with no data is normal: it is as cheap to copy as a number.' },
            { id: 'd2', why: 'A list of different destination types needs trait objects, and «+ Send» lets the route move to another thread. This is the standard shape for a plugin list.' },
          ],
          hints: [
            'Four issues: two wrong results, one needless cost, one crash.',
            'Read the «From» impl as the rule every «?» will follow. Which errors should be retried?',
            'In «deliver», which replies land in the «_» arm?',
          ],
          solution: {
            fixed: R`
use std::fmt;
use std::io;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Reply {
    Ack,
    Nack,
    Busy,
}

#[derive(Debug, PartialEq)]
pub enum SendError {
    Retryable(String),
    Permanent(String),
}

impl From<io::Error> for SendError {
    fn from(e: io::Error) -> SendError {
        use io::ErrorKind::*;
        match e.kind() {
            TimedOut | ConnectionRefused | ConnectionReset | ConnectionAborted | Interrupted | WouldBlock => SendError::Retryable(e.to_string()),
            _ => SendError::Permanent(e.to_string()),
        }
    }
}

pub trait Destination {
    fn name(&self) -> String;
    fn send(&mut self, frame: &[u8]) -> Result<Reply, SendError>;
}

pub struct Route {
    pub destinations: Vec<Box<dyn Destination + Send>>,
}

impl Route {
    /// Sends to every destination. Returns how many accepted the frame.
    pub fn deliver(&mut self, frame: &[u8]) -> usize {
        let mut delivered = 0;
        for d in self.destinations.iter_mut() {
            match d.send(frame) {
                Ok(Reply::Ack) => delivered += 1,
                Ok(Reply::Busy) | Ok(Reply::Nack) => {}
                Err(_) => {}
            }
        }
        delivered
    }
}

pub struct Tcp {
    pub host: String,
    pub port: u16,
}

impl fmt::Display for Tcp {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "tcp://{}:{}", self.host, self.port)
    }
}
`,
            talk: 'The From impl made every I/O error permanent, so timeouts were never retried. The Vec<u8> in the trait forced a copy of the frame per destination. The catch-all counted NACKs and errors as delivered. And Display unwrapped an IP parse, so a host name crashed the logger.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
