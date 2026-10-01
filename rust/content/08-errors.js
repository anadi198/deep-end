(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'errors', title: 'Errors without exceptions: Option, Result, ?', short: 'Errors',
    blurb: 'How Rust replaces null and exceptions, how to read a function full of «?», what thiserror and anyhow are, and the ways Rust code crashes on bad input.',
    items: [
      {
        lesson: 'err-option', title: '«Option»: a null the compiler makes you handle', mins: 7, hunts: ['panic', 'logic'],
        remember: '«Option<T>» is either «Some(value)» or «None», and you cannot touch the value without saying what happens on «None».',
        cue: '«.unwrap()» on an «Option» → is «None» really impossible here? If it came from a lookup, a parse or input, it is not',
        body: R`
          :::vs The same lookup
          ~~~java
          Integer port = ports.get("lab");      // may be null
          int p = port;                          // NullPointerException if absent
          int q = Optional.ofNullable(ports.get("lab")).orElse(2575);
          ~~~
          ~~~rust
          let port = ports.get("lab");          // Option<&u16>
          let p = *port.unwrap();               // panics if absent
          let q = ports.get("lab").copied().unwrap_or(2575);
          ~~~
          :::

          There is no null in Rust. Anything that might be missing is an «Option», and the type system will not let you use the value inside until you have said what happens when it is absent.

          ## The ways to open an Option

          ~~~rust !run
          use std::collections::HashMap;

          fn main() {
              let mut ports = HashMap::new();
              ports.insert("lab", 2575u16);

              // 1. match: handle both cases
              match ports.get("lab") {
                  Some(p) => println!("lab on {p}"),
                  None => println!("no lab port"),
              }

              // 2. if let: only the Some case matters
              if let Some(p) = ports.get("pharmacy") {
                  println!("pharmacy on {p}");
              }

              // 3. let-else: leave early on None
              let Some(p) = ports.get("lab") else {
                  println!("missing");
                  return;
              };
              println!("still {p}");

              // 4. a default
              let adt = ports.get("adt").copied().unwrap_or(2575);
              println!("adt on {adt}");
          }
          ~~~

          @stop

          ## Which ones are fine

          | You see | Meaning | Verdict |
          |---|---|---|
          | «match», «if let», «let ... else» | None is handled | fine |
          | «.unwrap_or(x)», «.unwrap_or_default()» | None becomes a default | fine if that default is right; check it cannot hide a real problem |
          | «.map(...)», «.and_then(...)» | transform the value if there is one | fine |
          | «?» | in a function returning «Option»: return None early | fine |
          | «.unwrap()», «.expect("...")» | panic on None | only when None is truly impossible, with an «expect» message that says why |

          @predict 0
        `,
        predict: [
          {
            q: 'No acks yet. What happens?',
            code: 'fn main() {\n    let acks: Vec<u32> = Vec::new();\n    let last = acks.last().unwrap();\n    println!("{last}");\n}',
            options: ['0', 'It panics', 'Compile error'],
            answer: 1,
            why: '«last()» on an empty Vec is «None», and «unwrap()» on «None» panics with "called `Option::unwrap()` on a `None` value". Rust never invents a default like 0.',
          },
        ],
      },
      {
        lesson: 'err-result', title: '«Result»: exceptions as return values', mins: 7, hunts: ['swallow'],
        remember: 'A function that can fail returns «Result<T, E>»: «Ok(value)» or «Err(error)». Nothing is thrown, so every failure shows in the signature.',
        cue: '«let _ = f()», «f().ok()» or «if let Ok(..)» with no else → the error is thrown away; who finds out when this fails?',
        body: R`
          :::vs The same parse
          ~~~java
          int parsePort(String s) throws NumberFormatException {
              return Integer.parseInt(s.trim());
          }
          ~~~
          ~~~rust
          fn parse_port(s: &str) -> Result<u16, std::num::ParseIntError> {
              s.trim().parse::<u16>()
          }
          ~~~
          :::

          The error type is part of the signature, like «throws». But it is an ordinary value: the caller gets it back and decides what to do.

          ~~~rust !run
          fn parse_port(s: &str) -> Result<u16, std::num::ParseIntError> {
              s.trim().parse::<u16>()
          }

          fn main() {
              for input in ["2575", " 6661 ", "70000", "lab"] {
                  match parse_port(input) {
                      Ok(p) => println!("{input:?} -> port {p}"),
                      Err(e) => println!("{input:?} -> error: {e}"),
                  }
              }
          }
          ~~~

          ## The compiler warns when you ignore one

          «Result» is marked «#[must_use]». Call something that can fail and ignore the answer, and you get a warning (open **Compiler warnings** under the output):

          ~~~rust !run
          use std::fs;

          fn main() {
              fs::write("/no/such/dir/out.txt", "ack");
              println!("carried on as if it worked");
          }
          ~~~

          @stop

          ## How errors get swallowed

          | You see | What happens to the error |
          |---|---|
          | «let _ = f();» | discarded, and the warning silenced on purpose |
          | «f().ok();» | turned into an «Option», then dropped |
          | «if let Ok(v) = f() { ... }» with no else | the error case silently does nothing |
          | «.unwrap_or_default()» | the error becomes 0, "", or an empty Vec |
          | «.unwrap()» | not swallowed: it crashes instead (last lesson of this module) |

          Sometimes discarding is right: a best-effort metric, closing a socket that is already dead. The question is always the same: **when this fails, who finds out?** At the very least, a log line.

          @predict 0
        `,
        predict: [
          {
            q: 'A config value that is not a number. What prints?',
            code: 'fn main() {\n    let n: i32 = "12a".parse().unwrap_or_default();\n    println!("{}", n + 1);\n}',
            options: ['13', '1', 'It panics', 'Compile error'],
            answer: 1,
            why: 'The parse fails, «unwrap_or_default()» turns the error into 0, and the program carries on with a made-up number. No crash, no log line: a swallowed error that produces a wrong result.',
          },
        ],
      },
      {
        lesson: 'err-question', title: 'The «?» operator: an early return on error', mins: 6,
        remember: '«?» after a call means: if it failed, return that error from this function right now; otherwise take the value and carry on.',
        cue: 'A function full of «?» → read only the happy path, top to bottom; each «?» is an exit that hands the error to the caller',
        body: R`
          :::vs The same propagation
          ~~~java
          Config load(Path p) throws IOException {
              String text = Files.readString(p);   // an exception goes up
              return Config.parse(text);           // so does this one
          }
          ~~~
          ~~~rust
          fn load(p: &Path) -> Result<Config, Error> {
              let text = fs::read_to_string(p)?;   // Err returns early
              let cfg = Config::parse(&text)?;     // Err returns early
              Ok(cfg)
          }
          ~~~
          :::

          «?» is shorthand for this match:

          ~~~rust
          let text = match fs::read_to_string(p) {
              Ok(t) => t,
              Err(e) => return Err(e.into()),
          };
          ~~~

          Note the «e.into()»: precisely, «?» calls «From::from(e)», so it converts the error into the function's own error type whenever a «From» implementation exists, and fails to compile when none does. That is how one function can use «?» on I/O errors and parse errors alike. On an «Option», «?» returns «None» instead.

          ~~~rust !run
          fn parse_endpoint(s: &str) -> Result<(String, u16), String> {
              let (host, port) = s.split_once(':').ok_or("expected host:port")?;
              let port: u16 = port.parse().map_err(|e| format!("bad port {port:?}: {e}"))?;
              Ok((host.to_string(), port))
          }

          fn main() {
              for s in ["lab.local:2575", "lab.local", "lab.local:x"] {
                  println!("{s} -> {:?}", parse_endpoint(s));
              }
          }
          ~~~

          - «ok_or(...)» turns an «Option» into a «Result», so «?» can use it.
          - «map_err(...)» rewrites the error, here into a message that says which value was bad.

          @stop

          ## «?» needs somewhere to send the error

          @predict 0
        `,
        predict: [
          {
            q: '«?» inside main. What happens?',
            code: 'fn main() {\n    let n: u16 = "2575".parse()?;\n    println!("{n}");\n}',
            options: ['2575', 'Compile error', 'It panics'],
            answer: 1, error: 'E0277',
            why: '«main» returns «()» here, so there is nowhere to send an error. rustc says «?» can only be used in a function that returns «Result» or «Option». Real programs write «fn main() -> Result<(), Box<dyn Error>>» or use «anyhow::Result».',
          },
        ],
      },
      {
        lesson: 'err-types', title: 'Error types: thiserror, anyhow, «Box<dyn Error>»', mins: 7, hunts: ['swallow'],
        remember: 'Libraries define an error enum (usually with thiserror); applications carry any error plus context (usually with anyhow). Both work with «?».',
        cue: 'An error passed straight up with «?» and no context → which file, peer or value was it? Add «.context(...)», or use a more specific variant',
        body: R`
          ## Three shapes you will see

          | You see | What it is | Java version |
          |---|---|---|
          | «enum FrameError { TooLarge(usize), Io(io::Error) }» with «#[derive(Error)]» | a closed set of failures this module can produce | a small exception hierarchy |
          | «anyhow::Result<T>» and «.context("reading config")» | any error, with a chain of context messages | catching «Exception» and wrapping it with a message |
          | «Box<dyn std::error::Error + Send + Sync>» | any error, standard library only | the same, without the helpers |

          ## thiserror: a readable error enum

          ~~~rust !run
          use thiserror::Error;

          #[derive(Debug, Error)]
          pub enum FrameError {
              #[error("frame too large: {0} bytes (max {1})")]
              TooLarge(usize, usize),
              #[error("missing end marker")]
              Unterminated,
              #[error("i/o while reading the frame")]
              Io(#[from] std::io::Error),
          }

          fn check(len: usize) -> Result<(), FrameError> {
              if len > 1024 {
                  return Err(FrameError::TooLarge(len, 1024));
              }
              Ok(())
          }

          fn main() {
              println!("{}", check(4096).unwrap_err());
              println!("{}", FrameError::Unterminated);
          }
          ~~~

          - «#[error("...")]» writes the message, like overriding «getMessage()».
          - «#[from]» lets «?» turn an «io::Error» into «FrameError::Io» automatically.

          @stop

          ## anyhow: context on the way up

          ~~~rust !run
          use anyhow::{Context, Result};

          fn read_port(raw: &str) -> Result<u16> {
              let port: u16 = raw.trim().parse().context("port must be a number")?;
              Ok(port)
          }

          fn start(raw: &str) -> Result<()> {
              let port = read_port(raw).with_context(|| format!("starting listener from config value {raw:?}"))?;
              println!("listening on {port}");
              Ok(())
          }

          fn main() {
              if let Err(e) = start("26x") {
                  println!("{e:#}");
              }
          }
          ~~~

          «{:#}» prints the whole chain on one line: what the program was doing, then why it failed.

          :::pitfall Common mistakes
          - A library returning «anyhow::Error»: callers cannot tell kinds of failure apart. A thiserror enum usually fits better there.
          - «?» straight up from deep code with no context: the log says "invalid digit found in string" and nobody knows which value.
          - An enum whose «Other(String)» variant is used everywhere: it has stopped carrying information.
          :::
        `,
      },
      {
        lesson: 'err-combinators', title: 'Combinators and the «Error» trait', mins: 6, hunts: ['swallow'],
        remember: '«Option» and «Result» carry methods that replace most «match»es: «map» and «map_err» change what is inside, «and_then» chains another step that can fail, «ok_or» and «ok» convert between the two, and the «unwrap_or» family supplies a fallback.',
        cue: 'A «match» whose arms only rewrap («Ok(v) => Ok(f(v)), Err(e) => Err(e)») → «.map(f)»',
        body: R`
          ## «Option<T>»

          | Method | Result | Note |
          |---|---|---|
          | «map(f)» | «Option<U>» | applies «f» to the value, if any |
          | «and_then(f)» | «Option<U>» | «f» itself returns an «Option» |
          | «filter(p)» | «Option<T>» | «None» unless the value passes «p» |
          | «or(x)», «or_else(f)» | «Option<T>» | a fallback «Option» |
          | «unwrap_or(v)», «unwrap_or_else(f)», «unwrap_or_default()» | «T» | a fallback value |
          | «map_or(default, f)» | «U» | map, or the default |
          | «ok_or(e)», «ok_or_else(f)» | «Result<T, E>» | «None» becomes «Err» |
          | «as_ref()», «as_deref()» | «Option<&T>», «Option<&str>» | look inside without moving |
          | «take()», «replace(v)» | «Option<T>» | on «&mut Option»; leaves «None» or «v» behind |
          | «is_some()», «is_none()», «is_some_and(p)» | «bool» | |

          ## «Result<T, E>»

          | Method | Result | Note |
          |---|---|---|
          | «map(f)», «map_err(f)» | «Result<U, E>», «Result<T, F>» | change the value, or the error |
          | «and_then(f)», «or_else(f)» | «Result<U, E>» | chain another fallible step |
          | «unwrap_or(v)», «unwrap_or_else(f)», «unwrap_or_default()» | «T» | the error is discarded |
          | «ok()», «err()» | «Option<T>», «Option<E>» | «ok()» discards the error |
          | «is_ok()», «is_err()», «is_ok_and(p)» | «bool» | |
          | «transpose()» | swaps «Option<Result<..>>» and «Result<Option<..>>» | |

          ~~~rust !run
          fn port(s: &str) -> Result<u16, std::num::ParseIntError> {
              s.trim().parse::<u16>()
          }

          fn main() {
              println!("{:?}", port(" 5100 ").map(|p| p + 1));
              println!("{:?}", port("x").map_err(|e| e.to_string()));
              println!("{:?}", port("5100").ok().filter(|&p| p > 1024));
              println!("{:?}", "lab-a".split_once(':').ok_or("no port"));
              println!("{}", port("x").unwrap_or_else(|_| 0));

              let name: Option<String> = Some("lab-a".to_string());
              println!("{:?} {}", name.as_deref(), name.as_ref().map_or(0, |n| n.len()));

              let parsed: Option<Result<u16, _>> = Some("7").map(|s| s.parse::<u16>());
              println!("{:?}", parsed.transpose());
          }
          ~~~

          Every method that turns an error into «None», a default or a fallback throws the error away. That is right when the requirement says "use the default"; it is a swallowed error when the input was supposed to be valid.

          @predict 0

          @stop

          ## The «Error» trait

          ~~~rust
          pub trait Error: Debug + Display {
              fn source(&self) -> Option<&(dyn Error + 'static)> { None }
          }
          ~~~

          An error type implements «Display» (the message for people), «Debug», and optionally «source» (the underlying cause, which forms a chain). «Box<dyn Error>» holds any of them, and every error type converts into it through «From», so «?» works on all of them at once:

          ~~~rust !run
          use std::error::Error;

          fn main() -> Result<(), Box<dyn Error>> {
              let port: u16 = "5100".parse()?;
              let host = std::str::from_utf8(b"lab-a")?;
              println!("{host}:{port}");
              Ok(())
          }
          ~~~

          «main» may return «Result<(), E>» for any «E: Debug». When it returns «Err», the program prints the error and exits with a failure code.
        `,
        predict: [
          {
            q: 'One port has a letter O where a zero should be. What does this print?',
            code: R`fn main() {
    let ports = ["5100", "51O1", "5102"];
    let parsed: Vec<u16> = ports.iter().filter_map(|p| p.parse().ok()).collect();
    println!("{parsed:?}");
}`,
            options: ['[5100, 5102]', '[5100, 0, 5102]', 'It panics', 'Compile error'],
            answer: 0,
            why: '«ok()» turns the parse error into «None», and «filter_map» drops every «None». The typo vanishes without a trace. «collect::<Result<Vec<u16>, _>>()» would fail on it instead (the Iterators module).',
          },
        ],
      },
      {
        lesson: 'err-panic', title: 'Panics: how Rust code crashes', mins: 7, hunts: ['panic'],
        remember: '«.unwrap()» on anything that came from outside (network, disk, config, another system) is a crash waiting for the first bad input.',
        cue: '«.unwrap()», «.expect()», «v[i]», «&s[a..b]» or «/» on outside data → what happens on bad input? Return an error instead',
        body: R`
          ## The ways Rust code panics

          | Cause | Example | Message |
          |---|---|---|
          | «unwrap»/«expect» on None or Err | «map.get(k).unwrap()» | called «Option::unwrap()» on a «None» value |
          | indexing past the end | «buf[10]» on a short buffer | index out of bounds |
          | slicing through a character | «&name[..4]» | byte index 4 is not a char boundary |
          | arithmetic overflow (debug builds) | «a + b» on «u8» | attempt to add with overflow |
          | division by zero | «total / count» | attempt to divide by zero |
          | on purpose | «panic!», «unreachable!», «todo!» | whatever the macro says |

          @predict 0

          @stop

          ## What a panic actually does

          - In a plain program: it prints the message and the process exits with code 101.
          - In a thread or an async task: **only that thread or task dies**. The rest of the program keeps running. The panic surfaces only through the handle, which is easy to ignore.

          ~~~rust !run
          use std::thread;

          fn main() {
              let worker = thread::spawn(|| {
                  let frames: Vec<&str> = Vec::new();
                  println!("first frame: {}", frames[0]);
              });
              let result = worker.join();
              println!("worker crashed: {}", result.is_err());
              println!("main keeps going");
          }
          ~~~

          A service whose reader task panicked can look perfectly healthy while doing nothing. The Async module comes back to this.

          ## When «unwrap» and «expect» are fine

          - Things that truly cannot fail, with «expect» saying why: «Regex::new("^MSH").expect("constant pattern is valid")».
          - Tests: «unwrap» everywhere is normal.
          - Startup, where crashing early with a clear message is the intended behaviour.

          Never on data from a socket, a file, another system's reply, or a person.

          @quiz 0
        `,
        predict: [
          {
            q: 'Field 5 of a short segment. What happens?',
            code: 'fn field(line: &str, n: usize) -> &str {\n    line.split(\'|\').collect::<Vec<_>>()[n]\n}\n\nfn main() {\n    println!("{}", field("PID|1", 5));\n}',
            options: ['An empty line', 'It panics', 'Compile error'],
            answer: 1,
            why: 'The segment has two fields, so index 5 is out of bounds, and indexing a «Vec» past its end panics. «.get(n)» returns an «Option» instead; «.nth(n)» on the split iterator avoids building the Vec at all.',
          },
        ],
        quiz: [
          {
            q: 'Which «unwrap» is a crash waiting to happen?',
            options: ['«Regex::new("^MSH").unwrap()» at startup', '«u32::from_be_bytes(header[..4].try_into().unwrap())» right after checking «header.len() >= 4»', '«String::from_utf8(frame).unwrap()» on bytes received from a TCP peer', '«assert_eq!(parse("2575").unwrap(), 2575)» in a test'],
            answer: 2,
            why: 'The peer decides which bytes arrive. One sender using Windows-1252 (an accented name in a PID segment) and that task panics. «String::from_utf8_lossy», decoding with the declared charset, or returning an error all keep the connection alive.',
          },
        ],
      },
      {
        exercise: {
          id: 'err-fix-port', title: 'Config values must never crash the service', kind: 'fix', mins: 10, diff: 'easy', topics: ['errors'],
          statement: R`
            These two functions read values that people type into a config file. The signatures already return «Result», but the bodies «unwrap» and index, so a typo crashes the service at startup with an unhelpful message.

            Make every bad input an «Err» that says what was wrong, and keep the good inputs working. Surrounding spaces are allowed.
          `,
          starter: R`
/// Reads a port number from a config value like " 2575 ".
pub fn parse_port(raw: &str) -> Result<u16, String> {
    let n: u16 = raw.parse().unwrap();
    Ok(n)
}

/// Reads "host:port".
pub fn parse_endpoint(raw: &str) -> Result<(String, u16), String> {
    let parts: Vec<&str> = raw.split(':').collect();
    let host = parts[0].to_string();
    let port = parse_port(parts[1])?;
    Ok((host, port))
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'a clean port', ex: true, code: 'assert_eq!(parse_port("2575"), Ok(2575));' },
            { name: 'spaces are fine', ex: true, code: 'assert_eq!(parse_port(" 6661 "), Ok(6661));' },
            { name: 'bad input is an error, not a crash', ex: true, code: 'assert!(parse_port("lab").is_err());\nassert!(parse_port("70000").is_err());\nassert!(parse_port("").is_err());' },
            { name: 'the error quotes the bad value', code: 'let e = parse_port("lab").unwrap_err();\nassert!(e.contains("lab"), "the error should say which value was bad, got: {e}");' },
            { name: 'an endpoint', code: 'assert_eq!(parse_endpoint("lab.local:2575"), Ok(("lab.local".to_string(), 2575)));' },
            { name: 'an endpoint without a port is an error', code: 'assert!(parse_endpoint("lab.local").is_err());' },
          ],
          hints: [
            '«raw.trim()» first, then parse.',
            '«parse» already returns a «Result». «map_err(|e| format!(...))» turns its error into your «String»; include the value with «{s:?}».',
            'For the endpoint, «split_once(\':\')» returns an «Option». «.ok_or_else(|| format!(...))?» turns «None» into your error and returns it.',
          ],
          solution: {
            rust: R`
/// Reads a port number from a config value like " 2575 ".
pub fn parse_port(raw: &str) -> Result<u16, String> {
    let s = raw.trim();
    s.parse::<u16>().map_err(|e| format!("bad port {s:?}: {e}"))
}

/// Reads "host:port".
pub fn parse_endpoint(raw: &str) -> Result<(String, u16), String> {
    let (host, port) = raw
        .split_once(':')
        .ok_or_else(|| format!("expected host:port, got {raw:?}"))?;
    Ok((host.to_string(), parse_port(port)?))
}
`,
            why: R`
              - «trim()» handles the spaces; «parse::<u16>()» already rejects letters, empty strings and values over 65535.
              - «map_err» keeps the parse error's own text ("invalid digit found in string") and adds the value, so the log line says exactly what to fix.
              - «parts[1]» panicked when there was no colon. «split_once» returns «None» instead, and «ok_or_else(...)?» turns that into an error.
              - «ok_or_else» with a closure only builds the message when it is needed; «ok_or(format!(...))» would build it every time.
            `,
            talk: 'Every unwrap and index on config input became an error the caller can see: trim, parse with map_err so the message quotes the bad value, and split_once with ok_or_else instead of indexing.',
          },
          wrong: [
            { name: 'defaults to zero', rust: 'pub fn parse_port(raw: &str) -> Result<u16, String> { Ok(raw.trim().parse().unwrap_or(0)) }\npub fn parse_endpoint(raw: &str) -> Result<(String, u16), String> { let (h, p) = raw.split_once(\':\').ok_or("no port")?; Ok((h.to_string(), parse_port(p)?)) }' },
            { name: 'forgets to trim', rust: 'pub fn parse_port(raw: &str) -> Result<u16, String> { raw.parse::<u16>().map_err(|e| format!("bad port {raw:?}: {e}")) }\npub fn parse_endpoint(raw: &str) -> Result<(String, u16), String> { let (h, p) = raw.split_once(\':\').ok_or("no port")?; Ok((h.to_string(), parse_port(p)?)) }' },
          ],
        },
      },
      {
        exercise: {
          id: 'err-review-frames', title: 'Find the bugs: an MLLP frame parser', kind: 'review', mins: 15, diff: 'medium', topics: ['errors'],
          file: 'src/mllp.rs',
          statement: R`
            **The change:** Pulls complete MLLP frames (start byte 0x0B, body, then 0x1C 0x0D) off the front of the connection's read buffer, and writes an audit line per frame. Tested with the test sender: 50 messages, all parsed.

            Context: the TCP source appends whatever bytes arrive to «buf» and calls «next_frame» in a loop. Senders include old systems that use Windows-1252, and TCP delivers bytes in arbitrary chunks. The audit log is required for compliance.
          `,
          code: R`
use std::io::Write;

pub const START: u8 = 0x0b;
pub const END: [u8; 2] = [0x1c, 0x0d];

pub struct Frame {
    pub text: String,
}

+/// Takes one complete frame off the front of buf, if there is one.
+pub fn next_frame(buf: &mut Vec<u8>) -> Option<Frame> {
+    if buf.first() != Some(&START) { ⟦e⟧
+        return None; ⟦e⟧
+    }
+    let end = buf.windows(2).position(|w| w == END).unwrap(); ⟦a⟧
+    let body = buf[1..end].to_vec(); ⟦d2⟧
+    buf.drain(..end + 2);
+    let text = String::from_utf8(body).unwrap(); ⟦b⟧
+    Some(Frame { text })
+}
+
+pub fn audit(log: &mut impl Write, frame: &Frame) {
+    let _ = writeln!(log, "received {} bytes", frame.text.len()); ⟦c⟧
+}
+
+pub fn control_id(frame: &Frame) -> Option<&str> {
+    let msh = frame.text.split('\r').next().expect("split always yields one item"); ⟦d1⟧
+    msh.split('|').nth(9)
+}
`,
          issues: [
            {
              id: 'a', tag: 'panic', title: 'A frame split across two reads crashes the connection',
              why: 'TCP delivers bytes in chunks. When the start of a frame has arrived but its end has not, «position» returns «None», and «.unwrap()» panics instead of waiting for more bytes. The test sender writes each frame in one go, which is why the tests never hit it.',
              fix: 'Replace «.unwrap()» with «?»: «None» then means "no complete frame yet", which is exactly what the function\'s «Option» return type is for.',
              demo: 'let mut buf = vec![0x0b, b\'M\', b\'S\', b\'H\'];\nassert!(next_frame(&mut buf).is_none(), "half a frame should wait for more bytes");',
            },
            {
              id: 'b', tag: 'panic', title: 'One non-UTF-8 byte crashes the connection',
              why: 'A sender using Windows-1252 writes «é» as the single byte 0xE9, which is not valid UTF-8. «String::from_utf8(...).unwrap()» panics on it, and the connection task dies.',
              fix: 'Decode with the charset the message declares (MSH-18), or use «String::from_utf8_lossy» and log that bytes were replaced, or return an error the caller can NACK.',
              demo: 'let mut buf = vec![0x0b, b\'J\', b\'o\', b\'s\', 0xe9, 0x1c, 0x0d];\nassert!(next_frame(&mut buf).is_some(), "a Windows-1252 byte should not kill the connection");',
            },
            {
              id: 'c', tag: 'swallow', title: 'A failed audit write is silently ignored',
              why: 'The description says the audit log is required. «let _ =» throws away the write error, so a full disk or a closed log file means frames stop being audited and nobody is told.',
              fix: 'Return «std::io::Result<()>» from «audit» and let the caller decide: log an error, raise an alert, or stop accepting frames.',
            },
            {
              id: 'e', tag: 'unbounded', title: 'Junk before a start byte is never cleared',
              why: 'If the buffer does not begin with 0x0B (a sender glitch, a half frame left over from a reconnect), the function returns «None» without removing anything. The source keeps appending, «next_frame» keeps returning «None», and the buffer grows forever while no message gets through.',
              fix: 'Discard everything before the next 0x0B, and cap the buffer size so a peer that never sends a start byte cannot use unlimited memory.',
              demo: 'let mut buf = vec![b\'x\', 0x0b, b\'A\', 0x1c, 0x0d];\nassert!(next_frame(&mut buf).is_some(), "junk before the start byte should be skipped");',
            },
          ],
          decoys: [
            { id: 'd1', why: '«split» always yields at least one item, even for an empty string, so this «expect» cannot fire, and its message says why. This is how «expect» should be used.' },
            { id: 'd2', why: 'The slice is always in range: the first byte is the start marker, so the end marker is found at position 1 or later, and «1..end» fits inside the buffer.' },
          ],
          hints: [
            'There are four issues: two crashes, one silence and one that grows without limit.',
            'Think about how TCP delivers bytes, and what old senders put in them. The description says "tested with the test sender" for a reason.',
            'What happens to the buffer when it does not start with 0x0B?',
          ],
          solution: {
            fixed: R`
use std::io::Write;

pub const START: u8 = 0x0b;
pub const END: [u8; 2] = [0x1c, 0x0d];

pub struct Frame {
    pub text: String,
}

/// Takes one complete frame off the front of buf, if there is one.
pub fn next_frame(buf: &mut Vec<u8>) -> Option<Frame> {
    match buf.iter().position(|b| *b == START) {
        Some(0) => {}
        Some(n) => {
            buf.drain(..n);
        }
        None => {
            buf.clear();
            return None;
        }
    }
    let end = buf.windows(2).position(|w| w == END)?;
    let body = buf[1..end].to_vec();
    buf.drain(..end + 2);
    let text = String::from_utf8_lossy(&body).into_owned();
    Some(Frame { text })
}

pub fn audit(log: &mut impl Write, frame: &Frame) -> std::io::Result<()> {
    writeln!(log, "received {} bytes", frame.text.len())
}

pub fn control_id(frame: &Frame) -> Option<&str> {
    let msh = frame.text.split('\r').next().expect("split always yields one item");
    msh.split('|').nth(9)
}
`,
            talk: 'Four issues: a frame split across two TCP reads panics on unwrap, a Windows-1252 byte panics in from_utf8, the audit write error is thrown away, and junk before a start byte is never cleared, so the buffer grows forever. The expect on split and the slice are fine.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
