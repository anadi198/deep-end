(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'crates', title: 'Crates: Cargo, modules and macros', short: 'Crates',
    blurb: 'What a Cargo.toml diff really changes, how features switch code in and out, how to find your way around an unfamiliar crate, and the macros that hide a crash or behave differently in production.',
    items: [
      {
        lesson: 'cr-cargo', title: 'Cargo.toml: what a dependency change really does', mins: 7,
        remember: 'A version like «tokio = "1.38"» means any 1.x from 1.38 up, and «Cargo.lock» pins the exact one. Features only ever add code, and if any crate in the build turns a feature on, it is on for everyone.',
        cue: 'A change to «Cargo.toml» → which new crate, which features, is it a 0.x bump, and did «Cargo.lock» change with it?',
        body: R`
          «Cargo.toml» is the «pom.xml» of a Rust crate. Most of it reads the way you expect:

          ~~~toml Cargo.toml
          [package]
          name = "relay"
          version = "0.4.0"
          edition = "2024"

          [dependencies]
          tokio = { version = "1.38", features = ["rt-multi-thread", "net", "io-util", "time", "macros"] }
          serde = { version = "1", features = ["derive"] }
          tracing = "0.1"
          prometheus = { version = "0.13", optional = true }

          [features]
          default = []
          metrics = ["dep:prometheus"]

          [dev-dependencies]
          tokio = { version = "1.38", features = ["test-util"] }

          [build-dependencies]
          tonic-build = "0.12"
          ~~~

          | Cargo | Maven |
          |---|---|
          | «[dependencies]» | «<dependencies>» |
          | «[dev-dependencies]» | «<scope>test</scope>»: tests, examples and benchmarks only |
          | «[build-dependencies]» | a build plugin: used by «build.rs», which runs on the build machine before compiling (generating protobuf code, for example) |
          | «[features]» | no real equivalent: named switches that add dependencies and code |
          | «Cargo.lock» | no equivalent: the exact version of every crate, dependencies of dependencies included |
          | a workspace | a multi-module parent POM |

          ## A version is a range

          | Written | Means |
          |---|---|
          | «"1.38"» | 1.38.0 or newer, below 2.0.0 |
          | «"0.12"» | 0.12.0 or newer, below 0.13.0 |
          | «"~1.38"» | 1.38.x only |
          | «"=1.38.2"» | exactly 1.38.2 |

          :::java The habit to unlearn
          Maven's «<version>1.38</version>» means 1.38. Cargo's «"1.38"» means "1.38 or any later 1.x". What actually gets built is whatever «Cargo.lock» says, which is why an application commits its lock file.
          :::

          Before 1.0 the second number is the breaking one. tonic and prost are both 0.x, so moving from 0.12 to 0.13 is a breaking upgrade, however small the diff looks.

          @stop

          ## Features: switches that add code

          A feature is a named switch. Turning it on can pull in an optional dependency («"dep:prometheus"» above) and compile extra code, which opts in with «#[cfg(feature = "...")]»:

          ~~~rust !run
          #[cfg(feature = "metrics")]
          fn record(route: &str) {
              println!("counted a frame for {route}");
          }

          fn main() {
              println!("metrics on: {}", cfg!(feature = "metrics"));
              #[cfg(feature = "metrics")]
              record("lab-a");
          }
          ~~~

          The Playground builds with no features, so «record» and the call to it were removed before the compiler even type-checked them. The warning is the compiler checking feature names against «Cargo.toml»: the Playground's declares no «metrics» feature. In a real crate the same warning is how a misspelt feature name shows up.

          That removal is the catch:

          @predict 0

          Features are **shared across the whole build**. If any crate in the build asks for tokio's «net» feature, every crate gets it, and nothing can switch it off again for one crate. So a feature must only ever add code, never change what existing code does.

          ## What a missing feature looks like

          On the Playground, the «tracing» crate is built without its «attributes» feature. Here is what that does to code that needs it:

          ~~~rust !fail
          #[tracing::instrument]
          fn handle(route: &str) {
              println!("handled {route}");
          }

          fn main() {
              handle("lab-a");
          }
          ~~~

          "Configured out" and the feature's name are the tell: the fix is a line in «Cargo.toml», not in the code. In your own crates this usually comes from «default-features = false», which drops a crate's default features so you can list only the ones you need.

          :::pitfall What to check when Cargo.toml changes
          1. **A new dependency**: every crate is code you ship. Is it maintained, widely used, and needed in full?
          2. **Features**: «features = ["full"]» compiles all of tokio; a feature added to a shared crate is on for everyone.
          3. **Versions**: a 0.x bump (0.12 to 0.13) is a breaking upgrade.
          4. **Cargo.lock**: is it committed with the change, and is its diff about as big as the change?
          5. **build.rs and [build-dependencies]**: this code runs on the build machine at compile time.
          :::
        `,
        predict: [
          {
            q: 'The code calls «record» without a «#[cfg]» of its own. It builds on a machine where the metrics feature is on. What happens in a build without the feature?',
            code: R`#[cfg(feature = "metrics")]
fn record(route: &str) {
    println!("counted a frame for {route}");
}

fn main() {
    record("lab-a");
    println!("delivered");
}`,
            options: ['delivered', 'counted a frame for lab-a\ndelivered', 'Compile error', 'It panics'],
            answer: 2, error: 'E0425',
            why: 'Without the feature, «record» is removed before type-checking, so the call has nothing to call: «cannot find function». Code with features should be built both ways; CI usually builds once with «--all-features» and once without.',
          },
        ],
      },
      {
        lesson: 'cr-mods', title: 'Modules and visibility: finding your way around a crate', mins: 6,
        remember: 'Everything is private to its module unless marked «pub». «pub(crate)» means usable anywhere in this crate but invisible to other crates, and «pub use» re-exports an item under a shorter path. Start reading a crate at «lib.rs» or «main.rs».',
        cue: 'A new «pub» on something internal → should it be «pub(crate)»? Once it is «pub», other crates can start depending on it.',
        body: R`
          ## The module tree is the file tree

          ~~~text
          src/
            main.rs        mod config; mod net;     declares the modules
            config.rs      crate::config
            net/
              mod.rs       crate::net               (or src/net.rs)
              frame.rs     crate::net::frame
          ~~~

          «mod net;» in «main.rs» means "compile «src/net.rs» (or «src/net/mod.rs») as the module «net»". A file that no «mod» line mentions is not compiled at all, which surprises Java developers: there is no classpath scan.

          | Path | Means | Java |
          |---|---|---|
          | «crate::net::frame::parse» | from the root of this crate | a fully qualified name |
          | «super::parse» | from the parent module | none |
          | «self::parse» | from this module | none |
          | «use crate::net::frame::parse;» | bring it into scope | «import» |

          ## Visibility

          | Written | Who can use it | Nearest Java |
          |---|---|---|
          | nothing | this module and the modules inside it | package-private, with the module as the package |
          | «pub(super)» | the parent module too | none |
          | «pub(crate)» | anywhere in this crate, never another crate | a Java 9 module's non-exported package |
          | «pub» | everyone, other crates included | «public» |

          Fields are private by default too, even on a «pub struct»:

          ~~~rust !run
          mod net {
              pub mod frame {
                  pub struct Frame {
                      pub route: String,
                      body: Vec<u8>, // private: only code in frame can touch it
                  }

                  impl Frame {
                      pub fn new(route: &str, body: &[u8]) -> Frame {
                          Frame { route: route.to_string(), body: body.to_vec() }
                      }

                      pub fn size(&self) -> usize {
                          self.body.len()
                      }
                  }

                  pub(crate) fn checksum(f: &Frame) -> u32 {
                      f.body.iter().map(|b| *b as u32).sum()
                  }
              }

              pub use frame::Frame; // a re-export: crate::net::Frame works too
          }

          use net::Frame;

          fn main() {
              let f = Frame::new("lab-a", b"MSH|");
              println!("{} {} {}", f.route, f.size(), net::frame::checksum(&f));
          }
          ~~~

          A struct with a private field cannot be built from outside its module at all. That is how a type protects its invariants, the same job as private fields plus a constructor in Java:

          ~~~rust !fail
          mod frame {
              pub struct Frame {
                  pub route: String,
                  body: Vec<u8>,
              }

              impl Frame {
                  pub fn size(&self) -> usize {
                      self.body.len()
                  }
              }
          }

          fn main() {
              let f = frame::Frame { route: "lab-a".to_string(), body: vec![] };
              println!("{} {}", f.route, f.size());
          }
          ~~~

          @predict 0

          @stop

          ## Reading a crate you have never seen

          1. Open «lib.rs» or «main.rs». The «mod» lines are the table of contents.
          2. The «pub use» lines are the public API, often gathered in one place.
          3. Follow the type you care about with go-to-definition (rust-analyzer in VS Code or IntelliJ). Reading a crate top to bottom is not the job.

          :::pitfall For every new «pub»
          1. Does anything outside this crate need it? If not, «pub(crate)».
          2. A «pub» field lets any code set it, skipping the checks in «new». Is that intended?
          3. In a library, a «pub use» decides where users import from: moving it later breaks them.
          :::
        `,
        predict: [
          {
            q: '«main» wants the raw bytes. What happens?',
            code: R`mod frame {
    pub struct Frame {
        pub route: String,
        body: Vec<u8>,
    }

    pub fn parse(raw: &[u8]) -> Frame {
        Frame { route: "lab-a".to_string(), body: raw.to_vec() }
    }
}

fn main() {
    let f = frame::parse(b"MSH|");
    println!("{} {:?}", f.route, f.body);
}`,
            options: ['lab-a [77, 83, 72, 124]', 'lab-a MSH|', 'Compile error', 'It panics'],
            answer: 2, error: 'E0616',
            why: '«body» has no «pub», so only code inside «frame» can read it: «field body of struct Frame is private». The module would have to offer a method such as «pub fn body(&self) -> &[u8]».',
          },
        ],
      },
      {
        lesson: 'cr-macros', title: 'Macros: code that writes code', mins: 7, hunts: ['panic', 'logic', 'cost'],
        remember: 'A name ending in «!» is a macro, and «#[...]» above an item is an attribute: both write code you do not see. «debug_assert!» disappears in release builds, «todo!» and «unreachable!» are panics, and «dbg!» is a leftover print.',
        cue: '«debug_assert!» checking outside input, «unreachable!()» on a value from the wire, or a leftover «dbg!» → the release build behaves differently, it can crash, or it is noise',
        body: R`
          ## Three kinds

          | You see | Kind | Examples | What it does |
          |---|---|---|---|
          | «name!(...)» | function-like macro | «println!», «vec!», «serde_json::json!» | expands into code right there |
          | «#[derive(...)]» | derive macro | «Debug», «Clone», «Deserialize» | writes trait implementations for the type |
          | «#[...]» on a function or type | attribute macro | «#[tokio::main]», «#[tokio::test]», «#[instrument]» | rewrites the item |

          :::java In Java terms
          Derive macros are Lombok. Attribute macros are closer to an annotation processor that rewrites the method; Spring does similar things with proxies at run time, Rust does them at compile time.
          :::

          Nothing magic happens inside a macro: it writes ordinary Rust. «#[tokio::main]» on «async fn main» writes roughly this:

          ~~~rust !run
          fn main() {
              tokio::runtime::Builder::new_multi_thread()
                  .enable_all()
                  .build()
                  .expect("failed to build the runtime")
                  .block_on(async {
                      println!("inside the runtime");
                  });
          }
          ~~~

          To see the real expansion of any macro, run «cargo expand» (a cargo plugin), or use rust-analyzer's "Expand macro recursively" in the editor.

          @stop

          ## The macros worth stopping at

          | Macro | What it means |
          |---|---|
          | «todo!()», «unimplemented!()» | a panic if this line runs: unfinished code |
          | «unreachable!()» | a panic if the author was wrong. Fine for a true internal invariant, a crash if the value came from outside |
          | «assert!(...)» | a panic in every build when false |
          | «debug_assert!(...)» | checked in debug and test builds, **compiled out of release builds** |
          | «dbg!(x)» | prints the file, line and value to stderr and returns «x»: debugging left behind |
          | «println!», «eprintln!» | prints that bypass «tracing»: no level, no fields, no filtering |
          | «matches!(x, pattern)» | «true» if «x» fits the pattern: harmless |

          @predict 0

          ## «debug_assert!» is not validation

          ~~~rust !panic
          fn store(len: usize) {
              debug_assert!(len <= 1024, "frame too big: {len}");
              println!("stored {len} bytes");
          }

          fn main() {
              store(10);
              store(4096);
          }
          ~~~

          The Playground builds in debug mode, so the check fires. A release build, which is what production runs, prints both lines: the check is not there at all. Tests run in debug mode too, so they pass, and the gap only shows in production. Anything that checks outside input must be a real «if» that returns an error.

          ## Logging whole messages

          The Networking module covered «tracing»'s syntax. One addition: «?frame» logs the whole value with «Debug», and «#[instrument]» records every argument of the function the same way unless «skip(...)» names it. On a message body that is every byte of every message in the logs: slow, huge, and in healthcare it puts patient data where it does not belong. Log the route, the length and the control id, not the body.

          ## Reading a «macro_rules!» definition

          Crates often define small macros. To read one: «$name:expr» is an argument, and «$(...),*» repeats for each comma-separated item.

          ~~~rust !run
          macro_rules! route_ids {
              ($($name:expr),* $(,)?) => {
                  vec![$(String::from($name)),*]
              };
          }

          fn main() {
              let ids: Vec<String> = route_ids!["lab-a", "lab-b"];
              println!("{ids:?}");
          }
          ~~~

          Writing macros is a topic of its own; recognising these pieces is enough to read the small ones.
        `,
        predict: [
          {
            q: 'The peer sends three frame kinds. What happens?',
            code: R`fn kind(b: u8) -> &'static str {
    match b {
        b'A' => "ack",
        b'D' => "data",
        _ => unreachable!("peers only send A or D"),
    }
}

fn main() {
    let from_wire = [b'D', b'A', b'X'];
    for b in from_wire {
        println!("{}", kind(b));
    }
}`,
            options: ['data\nack', 'data\nack\nunknown', 'It panics', 'Compile error'],
            answer: 2,
            why: 'It prints «data» and «ack», then the byte «X» reaches «unreachable!», which is a panic with the message "internal error: entered unreachable code". A byte from another system is never unreachable: return an error instead.',
          },
        ],
      },
      {
        exercise: {
          id: 'cr-review-counters', title: 'Find the bugs: per-route frame counters', kind: 'review', mins: 12, diff: 'medium', topics: ['macros'],
          file: 'src/relay.rs',
          statement: R`
            **The change:** Adds per-route counters to «Relay::handle», logs every frame for debugging, and checks that frames carry a route.

            Context: «handle» runs for every inbound frame, thousands per second at peak. Frames come from other systems and carry patient data. Production runs a release build.
          `,
          code: R`
use std::collections::HashMap;
use tracing::info;

pub struct Relay {
    counts: HashMap<String, u64>,
}

+#[derive(Debug)]
+pub struct Frame {
+    pub route: String,
+    pub kind: u8,
+    pub body: Vec<u8>,
+}

impl Relay {
    pub fn new() -> Relay {
        Relay { counts: HashMap::new() }
    }

+    /// Handles one frame from a peer. Returns the reply to send back.
+    pub fn handle(&mut self, frame: Frame) -> Result<&'static str, String> {
+        debug_assert!(!frame.route.is_empty(), "frame without a route"); ⟦a⟧
+        info!(?frame, "frame received"); ⟦b⟧
+        let reply = match frame.kind {
+            b'D' => "AA",
+            b'Q' => "AQ",
+            _ => unreachable!("peers only send D or Q"), ⟦c⟧
+        };
+        *self.counts.entry(frame.route).or_insert(0) += 1; ⟦d1⟧
+        let total: u64 = dbg!(self.counts.values().sum()); ⟦e⟧
+        if total % 1000 == 0 {
+            info!(total, "frames handled");
+        }
+        Ok(reply)
+    }
}
`,
          issues: [
            {
              id: 'a', tag: 'logic', title: 'The route check only exists in debug builds',
              why: '«debug_assert!» is compiled out of release builds, which is what production runs. There, a frame without a route is accepted and counted under the empty string. Tests run in debug mode, so they never show it.',
              fix: 'A real check: «if frame.route.is_empty() { return Err(...) }».',
            },
            {
              id: 'b', tag: 'cost', title: 'Every frame is logged in full',
              why: '«?frame» formats the whole struct with «Debug», so every body byte is printed as a number, on every frame, at info level. At thousands of frames a second that is a lot of CPU and log volume, and it writes patient data into the logs.',
              fix: 'Log what identifies the frame: «info!(route = %frame.route, kind = frame.kind, bytes = frame.body.len(), "frame received")».',
            },
            {
              id: 'c', tag: 'panic', title: 'An unexpected kind byte crashes the relay',
              why: 'The kind byte comes from another system. The first frame with any other value reaches «unreachable!», which panics, and takes down whatever task was handling the connection.',
              fix: 'Return an error for unknown kinds (and log it): «other => return Err(format!("unknown frame kind {other}"))».',
              demo: 'let mut relay = Relay::new();\nlet got = relay.handle(Frame { route: "lab-a".into(), kind: b\'X\', body: vec![] });\nassert!(got.is_err(), "an unknown kind should be an error, not a crash");',
            },
            {
              id: 'e', tag: 'cost', title: 'Debugging left in, and a full sum on every frame',
              why: '«dbg!» prints the file, line and value to stderr for every frame, outside «tracing» and its filters. And «values().sum()» walks every route on every frame just to decide whether to log.',
              fix: 'Drop «dbg!», and keep a running «total» field that is incremented once per frame.',
            },
          ],
          decoys: [
            { id: 'd1', why: '«entry» needs the key by value. The frame is owned and not used after this line, so moving «frame.route» in costs nothing: no clone, no copy.' },
          ],
          hints: [
            'Four issues. Production runs a release build: which line behaves differently there?',
            'Which lines run for every frame, and what do they print?',
            'Where does «frame.kind» come from, and what does «unreachable!» do?',
          ],
          solution: {
            fixed: R`
use std::collections::HashMap;
use tracing::{info, warn};

pub struct Relay {
    counts: HashMap<String, u64>,
    total: u64,
}

#[derive(Debug)]
pub struct Frame {
    pub route: String,
    pub kind: u8,
    pub body: Vec<u8>,
}

impl Relay {
    pub fn new() -> Relay {
        Relay { counts: HashMap::new(), total: 0 }
    }

    /// Handles one frame from a peer. Returns the reply to send back.
    pub fn handle(&mut self, frame: Frame) -> Result<&'static str, String> {
        if frame.route.is_empty() {
            return Err("frame without a route".to_string());
        }
        info!(route = %frame.route, kind = frame.kind, bytes = frame.body.len(), "frame received");
        let reply = match frame.kind {
            b'D' => "AA",
            b'Q' => "AQ",
            other => {
                warn!(route = %frame.route, kind = other, "unknown frame kind");
                return Err(format!("unknown frame kind {other}"));
            }
        };
        *self.counts.entry(frame.route).or_insert(0) += 1;
        self.total += 1;
        if self.total % 1000 == 0 {
            info!(total = self.total, "frames handled");
        }
        Ok(reply)
    }
}
`,
            talk: 'The route check was a debug_assert, so the release build that production runs never checks it. The unreachable! arm panics on the first unexpected kind byte from a peer. And two lines run on every frame for nothing useful: ?frame logs every body byte (patient data, at info level), and dbg! prints a full sum of every route to stderr.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
