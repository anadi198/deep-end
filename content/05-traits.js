(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'traits', title: 'Enums and traits: sealed types and interfaces', short: 'Traits',
    blurb: 'Enums that carry data (and why a new variant should break the build), traits as interfaces, generics versus «dyn», and the «From», «Into» and «Display» conversions you meet everywhere.',
    items: [
      {
        lesson: 'tr-enums', title: 'Enums carry data: a sealed interface in one line', mins: 7, hunts: ['logic'],
        remember: 'A Rust enum is a closed set of variants that can each carry their own data, like a sealed interface with records, and «match» must handle every variant.',
        cue: 'A PR adds an enum variant → look at every «match» on that enum; a «_ =>» arm swallows the new variant with no compile error',
        body: R`
          :::vs The same closed set of outcomes
          ~~~java
          sealed interface Ack permits Accept, Error, Reject {}
          record Accept() implements Ack {}
          record Error(String text) implements Ack {}
          record Reject(int code) implements Ack {}
          ~~~
          ~~~rust
          enum Ack {
              Accept,
              Error(String),
              Reject { code: u16 },
          }
          ~~~
          :::

          A variant can carry nothing («Accept»), a tuple of values («Error(String)») or named fields («Reject { code }»). «match» takes the data back out:

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

          That compile error is the best thing about enums: adding a case forces every decision about it to be looked at again. Unless someone wrote a catch-all:

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

          ## «Option» and «Result» are just enums

          ~~~rust
          enum Option<T> { None, Some(T) }
          enum Result<T, E> { Ok(T), Err(E) }
          ~~~

          Everything from module 04 is ordinary enum matching. «matches!(x, Ack::Accept)» is a shorthand that returns «true» or «false».

          @quiz 0
        `,
        predict: [
          {
            q: 'A «Timeout» variant was added, and «describe» was not updated. What happens?',
            code: 'enum Ack {\n    Accept,\n    Error(String),\n    Timeout,\n}\n\nfn describe(a: &Ack) -> &str {\n    match a {\n        Ack::Accept => "AA",\n        Ack::Error(_) => "AE",\n    }\n}\n\nfn main() {\n    println!("{}", describe(&Ack::Timeout));\n}',
            options: ['AA', 'Compile error', 'It panics', 'AE'],
            answer: 1, error: 'E0004',
            why: 'rustc reports "non-exhaustive patterns" and names the missing one, «Ack::Timeout». Every match on «Ack» without a catch-all fails the same way, so the compiler hands you the full list of places to decide.',
          },
        ],
        quiz: [
          {
            q: 'A PR adds «Ack::Timeout». Which of these matches does the compiler NOT flag?',
            options: ['«match a { Ack::Accept => .., Ack::Error(_) => .. }»', '«match a { Ack::Accept => .., _ => .. }»', 'Both', 'Neither'],
            answer: 1,
            why: 'The «_» arm covers every variant, including future ones, so it keeps compiling. Whether a timeout should really land in that arm is exactly the question to ask in the review.',
          },
        ],
      },
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
          | «Send», «Sync» | safe to move or share between threads (module 07) | (nothing) |
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

          «T: Send + Sync + 'static» reads "T is thread-safe to move and share, and borrows nothing short-lived". «Box<dyn Error + Send + Sync>» is "any error that can cross threads". «Send» and «Sync» are module 07; «'static» was module 03.

          ## Traits as test seams

          This is the same trick as Java interfaces plus mocks. Code that reaches the network through a small trait («Accept», «Clock», «Transport») can be tested with a fake that fails on command. Connector code does this, and module 10 uses it.

          :::review Generic soup
          AI-written code often keeps adding type parameters and bounds until it compiles: «fn run<T, U, F>(..) where T: A + B + Clone + 'static, F: Fn(U) -> T + Send». If a function is only ever called with one type, a concrete type is far easier to read. Ask.
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

          Module 04's «#[from]» in thiserror writes an «impl From<io::Error> for FrameError». «?» calls that «From» on the way out. Here it is by hand:

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

          :::review Read the «From» when errors are converted
          A «From» impl decides, silently, which variant every error becomes whenever «?» is used. If it maps every I/O error to «Permanent», a timeout that deserved a retry is treated as a final failure. The PR at the end of this module has exactly that.
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
              - That silent «false» is the bug a reviewer has to catch: timeouts would never be retried.
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
          id: 'tr-review-route', title: 'PR: pluggable destinations for a route', kind: 'review', mins: 14, diff: 'medium', topics: ['traits'],
          file: 'src/route.rs',
          statement: R`
            **feat(route): pluggable destinations**

            > Introduces a «Destination» trait so a route can send each frame to several destinations (TCP, file, HTTP). Adds an «io::Error» conversion so destinations can use «?», and a «Display» for TCP destinations for the logs.

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
