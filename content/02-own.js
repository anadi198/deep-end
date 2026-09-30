(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'own', title: 'Ownership: one owner per value', short: 'Own',
    blurb: 'Why «let t = s;» can make «s» unusable, what «.clone()» really costs, when cleanup happens, and «String» versus «&str».',
    items: [
      {
        lesson: 'own-one-owner', title: 'One owner per value, and moves', mins: 7,
        remember: 'Every value has exactly one owner. Assigning it or passing it to a function moves it, and the old name can no longer be used.',
        cue: 'E0382 "borrow of moved value" → something took ownership earlier: lend it with «&» instead, or «.clone()» only if you truly need two copies',
        body: R`
          ## Java: many references to one object

          In Java, «String t = s;» copies a reference. Both names point at the same object, and the garbage collector frees it when nobody refers to it any more.

          ## Rust: one owner, and assignment hands it over

          ~~~rust !fail
          fn main() {
              let s = String::from("ADT^A01");
              let t = s;
              println!("{s}");
          }
          ~~~

          «let t = s;» **moves** the string: the text on the heap now belongs to «t», and «s» is dead. Nothing was copied. The reason is cleanup: when a variable's scope ends, its value is freed. If «s» and «t» both owned the text, it would be freed twice. So the compiler makes the old name unusable instead.

          ~~~seq What happens to the string
          actors: s, t, heap text
          s -> heap text: owns "ADT^A01"
          note: let s = String::from("ADT^A01");
          state s: moved out
          note: let t = s; the text is not copied, the ownership is handed over
          t -> heap text: owns it now
          note: println!("{s}") would be E0382: s no longer owns anything
          state t: dropped
          note: at the end of main, t frees the text, exactly once
          ~~~

          @stop

          ## Passing to a function moves too

          ~~~rust !fail
          fn store(msg: String) {
              println!("stored {msg}");
          }

          fn main() {
              let msg = String::from("ADT^A01");
              store(msg);
              println!("still have {msg}");
          }
          ~~~

          A parameter of type «String» takes ownership. After the call the caller has nothing. This is the biggest habit to unlearn from Java, where you pass an object and keep using it.

          :::java Reading signatures, the Java way
          «fn store(msg: String)» is like handing over the object and promising never to touch it again. «fn store(msg: &str)» is the Java you know: the function looks at it, you keep it. Module 03 is about that «&».
          :::

          ## Returning hands it back

          ~~~rust !run
          fn stamp(mut msg: String) -> String {
              msg.push_str("|stamped");
              msg
          }

          fn main() {
              let msg = String::from("ADT^A01");
              let msg = stamp(msg);
              println!("{msg}");
          }
          ~~~

          The second «let msg» is **shadowing**: a new variable with the same name. It is common and deliberate in Rust, not a bug.

          @predict 0

          @quiz 0
        `,
        predict: [
          {
            q: 'Two moves in a row. What happens?',
            code: 'fn main() {\n    let a = vec![1, 2, 3];\n    let b = a;\n    let c = b;\n    println!("{}", c.len());\n}',
            options: ['3', 'Compile error', 'It panics'],
            answer: 0,
            why: 'Moving twice is fine: «a» moves into «b», then «b» into «c». Only using a moved-from name is an error, and nothing here touches «a» or «b» afterwards.',
          },
        ],
        quiz: [
          {
            q: 'A PR adds «fn send(frame: Vec<u8>)». What does the caller give up?',
            options: ['Nothing: a Vec is passed by reference, like in Java', 'The Vec itself: after the call the caller cannot use it', 'A copy is made automatically', 'Only the first element'],
            answer: 1,
            why: 'A parameter without «&» takes ownership. If the caller still needs the buffer, the signature should borrow it («frame: &[u8]»), or the caller has to clone.',
          },
        ],
      },
      {
        lesson: 'own-copy-clone', title: 'Copy, Clone, and what «.clone()» costs', mins: 6, hunts: ['cost'],
        remember: 'Small plain values (numbers, bool, char) are copied on assignment; everything else moves unless you call «.clone()», and a clone costs as much as the data.',
        cue: '«.clone()» in a PR → what is being cloned? A number or an «Arc»: free. A «String», «Vec» or a struct of them: a full copy of the data',
        body: R`
          ## Some types copy instead of moving

          ~~~rust !run
          fn main() {
              let port: u16 = 2575;
              let backup = port;
              println!("{port} {backup}");
          }
          ~~~

          Integers, floats, «bool», «char», and tuples or arrays of them are «Copy»: assignment duplicates the bits and both names stay valid. A «String» or «Vec» owns heap memory, so it cannot be «Copy»: copying just the pointer would create two owners.

          ~~~rust !fail
          #[derive(Clone, Copy)]
          struct Frame {
              body: String,
          }

          fn main() {}
          ~~~

          ## «.clone()» is an explicit deep copy

          ~~~rust !run
          fn main() {
              let body = vec![0u8; 4096];
              let copy = body.clone();
              println!("{} {}", body.len(), copy.len());
          }
          ~~~

          Two 4096-byte buffers now exist. «clone» is Java's «new ArrayList<>(list)» or «Arrays.copyOf»: it allocates and copies everything.

          @predict 0

          @stop

          ## Why AI-written code clones so much

          When code does not compile because something moved, the fastest fix is «.clone()». It always compiles. Whether it is fine depends entirely on what is being cloned:

          | Clone of | Cost | In review |
          |---|---|---|
          | a number, «bool», «char» | nothing | fine |
          | an «Arc<T>» | one atomic counter increment | fine: this is how you share (module 07) |
          | a short «String» (an id, a name), once per request | a small allocation | usually fine |
          | a message body or a «Vec<u8>» buffer, per message | allocate and copy every byte, every time | comment on it |
          | a whole map or config, on every call | the same, bigger | comment on it |

          The question to ask is always: **is the clone needed, or would a borrow do?** If the code only reads the data, it should take «&» and the clone disappears.
        `,
        predict: [
          {
            q: 'The struct derives «Copy». What happens?',
            code: '#[derive(Debug, Clone, Copy)]\nstruct Ack {\n    id: u32,\n    ok: bool,\n}\n\nfn main() {\n    let a = Ack { id: 7, ok: true };\n    let b = a;\n    println!("{} {}", a.id, b.ok);\n}',
            options: ['7 true', 'Compile error', 'It panics'],
            answer: 0,
            why: 'With «Copy» derived, assignment copies the struct, so «a» is still usable. Take «Copy» out of the derive list and the same code fails with E0382. «Copy» is only allowed when every field is «Copy».',
          },
        ],
      },
      {
        lesson: 'own-drop', title: 'Drop: cleanup happens where the owner ends', mins: 7, hunts: ['hang'],
        remember: 'When an owner goes out of scope its value is dropped right there: memory freed, files closed, locks released. No garbage collector, no finalizers.',
        cue: 'A lock guard, file or socket in a long function → it is released only at the closing brace of its scope, or at «drop(x)»',
        body: R`
          ## Every value is a try-with-resources

          In Java you close resources yourself or with try-with-resources, and memory waits for the garbage collector. In Rust, every value is cleaned up the moment its owner's scope ends. A type can hook into that by implementing «Drop», which is «AutoCloseable.close()» called for you.

          ~~~rust !run
          struct Conn(&'static str);

          impl Drop for Conn {
              fn drop(&mut self) {
                  println!("closing {}", self.0);
              }
          }

          fn main() {
              let _a = Conn("epic");
              let _b = Conn("lab");
              println!("working");
          }
          ~~~

          Values are dropped at the closing brace, in reverse order of creation.

          @predict 0

          @stop

          ## Why this matters for locks

          A «Mutex» hands out a **guard**. The lock is held exactly as long as the guard lives.

          ~~~rust !run
          use std::sync::Mutex;

          fn main() {
              let queue = Mutex::new(vec![1, 2, 3]);
              {
                  let mut guard = queue.lock().unwrap();
                  guard.push(4);
              } // the guard is dropped here, and the lock with it
              println!("{}", queue.lock().unwrap().len());
          }
          ~~~

          A guard created at the top of a long function holds the lock for the whole function. «drop(guard)» ends it early.

          The underscore trap from above applies to guards too: «let _ = m.lock()» takes the lock and releases it on the same line. For the standard library's «Mutex» this is such a common bug that the compiler refuses it outright:

          ~~~rust !fail
          use std::sync::Mutex;

          fn main() {
              let m = Mutex::new(0);
              let _ = m.lock().unwrap();
              println!("still free? {}", m.try_lock().is_ok());
          }
          ~~~

          Tokio's async «Mutex» (the one connector code uses) gets no such check. It compiles, and the lock is already free on the next line:

          ~~~rust !run
          use tokio::sync::Mutex;

          #[tokio::main]
          async fn main() {
              let m = Mutex::new(0);
              let _ = m.lock().await;
              println!("still free? {}", m.try_lock().is_ok());
          }
          ~~~

          So «let _ = something.lock()» in a PR is a bug the compiler only sometimes catches for you.

          :::review The lock-scope question
          When you see «.lock()» in a PR, find where the guard's scope ends. Everything in between runs under the lock. Slow work in that window (disk, network, a big loop) makes every other thread wait. In async code it is worse, which module 08 covers.
          :::
        `,
        predict: [
          {
            q: 'Only the variable name changed: «_a» became «_». What prints?',
            code: 'struct Conn(&\'static str);\n\nimpl Drop for Conn {\n    fn drop(&mut self) {\n        println!("closing {}", self.0);\n    }\n}\n\nfn main() {\n    let _ = Conn("epic");\n    println!("working");\n}',
            options: ['working\nclosing epic', 'closing epic\nworking', 'Compile error'],
            answer: 1,
            why: '«let _ =» does not bind the value to anything, so it is dropped on the spot, before "working" prints. «let _conn =» (with a name after the underscore) keeps it alive to the end of the scope. In a PR, «let _ = something.lock()» almost never does what the author meant.',
          },
        ],
      },
      {
        lesson: 'own-strings', title: '«String» vs «&str», «Vec<u8>» vs «&[u8]»', mins: 7, hunts: ['cost', 'panic'],
        remember: '«String» and «Vec<T>» own their data; «&str» and «&[T]» are borrowed views into someone else\'s. A function that only reads should take the view.',
        cue: 'A function takes «String», «Vec<u8>» or «&String» but only reads it → it should take «&str» or «&[u8]»',
        body: R`
          ## Two types for one idea

          | Owns the data (can grow, frees it) | Borrowed view (read-only, points into an owner) |
          |---|---|
          | «String» | «&str» |
          | «Vec<u8>» | «&[u8]» |
          | «Vec<T>» | «&[T]» |
          | «PathBuf» | «&Path» |

          A string literal like «"MSH"» is a «&'static str»: a view into text baked into the program.

          ## Functions should take the view

          ~~~rust !run
          fn segment_name(line: &str) -> &str {
              &line[..3]
          }

          fn main() {
              let owned = String::from("PID|1||12345");
              println!("{}", segment_name(&owned));
              println!("{}", segment_name("MSH|^~"));
          }
          ~~~

          A «&str» parameter accepts a borrowed «String» and a literal alike. A «String» parameter would force every caller to hand theirs over, or clone it. Clippy flags the in-between «&String»:

          ~~~rust !clippy what clippy says about a &String parameter
          fn body_len(body: &String) -> usize {
              body.len()
          }

          fn main() {
              let b = String::from("OBX|1");
              println!("{}", body_len(&b));
          }
          ~~~

          @stop

          ## Slicing text counts bytes, and can panic

          «&line[..3]» slices by **bytes**, not characters. That is fine for plain ASCII HL7. On text with accented characters, a slice that cuts through a character panics.

          @predict 0

          ## Converting between them

          | From | To | How | Cost |
          |---|---|---|---|
          | «&str» | «String» | «s.to_string()», «String::from(s)», «s.to_owned()» | allocates and copies |
          | «String» | «&str» | «&s», «s.as_str()» | free |
          | «&str» | «&[u8]» | «s.as_bytes()» | free |
          | «&[u8]» | «&str» | «std::str::from_utf8(b)» | checks the bytes, returns a «Result» |
          | «Vec<u8>» | «String» | «String::from_utf8(v)» | checks the bytes, returns a «Result» |

          The last two return a «Result» because bytes are not always valid UTF-8. A legacy sender using Windows-1252 is exactly that case. It is an error you can handle, unless someone calls «.unwrap()» on it (module 04).
        `,
        predict: [
          {
            q: 'A name from a PID segment, sliced to four bytes. What happens?',
            code: 'fn main() {\n    let name = String::from("José");\n    println!("{}", &name[..4]);\n}',
            options: ['José', 'Jos', 'It panics', 'Compile error'],
            answer: 2,
            why: '«é» takes two bytes in UTF-8, so byte 4 lands in the middle of it. Slicing at a byte that is not a character boundary panics. Names, addresses and free text from other systems are where this bites. «name.get(..4)» returns «None» instead of panicking.',
          },
        ],
      },
      {
        exercise: {
          id: 'own-fix-moved', title: 'Stop giving the message away', kind: 'fix', mins: 8, diff: 'easy', topics: ['ownership'],
          statement: R`
            «summary» calls two helpers, and each helper takes the message by value (as «String»). The first call moves the message away, so the second cannot use it. Press **Run** to see the compiler say so.

            Change the three signatures so the functions only **borrow** the message. The tests call them with «&str» values and with a borrowed «String». Do not use «.clone()».
          `,
          starter: R`
pub fn segment_count(msg: String) -> usize {
    msg.split('\r').filter(|s| !s.is_empty()).count()
}

pub fn message_type(msg: String) -> String {
    let msh = msg.split('\r').next().unwrap_or("");
    msh.split('|').nth(8).unwrap_or("").to_string()
}

pub fn summary(msg: String) -> String {
    let n = segment_count(msg);
    let kind = message_type(msg);
    format!("{kind}: {n} segments")
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'summary of an ADT message', ex: true, code: R`let m = "MSH|^~\\&|LAB|H|||20260930||ADT^A01|1|P|2.5\rPID|1||42\r";
assert_eq!(summary(m), "ADT^A01: 2 segments");` },
            { name: 'the caller keeps its message', ex: true, code: R`let m = String::from("MSH|^~\\&|A|B|||1||ORU^R01|9|P|2.5\rOBX|1\rOBX|2\r");
assert_eq!(summary(&m), "ORU^R01: 3 segments");
assert!(m.starts_with("MSH"), "the caller still owns m");` },
            { name: 'segment_count can be called twice', code: R`let m = "A\rB\rC";
assert_eq!(segment_count(m), 3);
assert_eq!(segment_count(m), 3);` },
            { name: 'an empty message has no type', code: 'assert_eq!(message_type(""), "");' },
          ],
          lint: [
            { re: '\\.clone\\(\\)', when: 'present', note: 'This compiles, but «.clone()» copies the whole message to get around a move. A borrow («&str») does the same job for free.' },
          ],
          hints: [
            'Each function only reads the message. Which parameter type reads without taking ownership?',
            '«&str». The caller passes «&m»: a «&String» turns into a «&str» automatically.',
            '«message_type» can even return «&str»: a view into the message, so no new «String» is needed.',
          ],
          solution: {
            rust: R`
pub fn segment_count(msg: &str) -> usize {
    msg.split('\r').filter(|s| !s.is_empty()).count()
}

pub fn message_type(msg: &str) -> &str {
    let msh = msg.split('\r').next().unwrap_or("");
    msh.split('|').nth(8).unwrap_or("")
}

pub fn summary(msg: &str) -> String {
    let n = segment_count(msg);
    let kind = message_type(msg);
    format!("{kind}: {n} segments")
}
`,
            why: R`
              - All three functions only read, so all three take «&str». Borrowing ends when each call returns, so «summary» can lend the same message twice.
              - «message_type» returns «&str» too: a slice of the caller's message. The compiler ties the result's lifetime to «msg» automatically (one input reference, so the output borrows from it).
              - «summary» still returns a «String», because «format!» builds new text that has to be owned by someone.
              - The «.clone()» route compiles, and for one small message nobody would notice. In a loop over thousands of messages it copies every byte of every message twice.
            `,
            talk: 'The functions only read the message, so they take &str instead of String. The caller keeps ownership and nothing is copied; cloning would also compile, but copies every byte.',
          },
          wrong: [
            { name: 'keeps String and clones', rust: R`
pub fn segment_count(msg: String) -> usize {
    msg.split('\r').filter(|s| !s.is_empty()).count()
}
pub fn message_type(msg: String) -> String {
    let msh = msg.split('\r').next().unwrap_or("");
    msh.split('|').nth(8).unwrap_or("").to_string()
}
pub fn summary(msg: String) -> String {
    let n = segment_count(msg.clone());
    let kind = message_type(msg);
    format!("{kind}: {n} segments")
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'own-review-archive', title: 'PR: store message batches in the archive', kind: 'review', mins: 10, diff: 'easy', topics: ['ownership'],
          file: 'src/archive.rs',
          statement: R`
            **feat(archive): store batches and report body sizes**

            > Adds «store_all», which archives a batch of messages and skips any body over the configured limit, and «size_of» for the metrics endpoint. Unit tested with a three-message batch.

            Context you would know at work: bodies can be up to 4 MB, batches hold up to 500 messages, and the metrics endpoint is scraped every 15 seconds.

            Lines starting with **+** are what the PR adds. Review those.
          `,
          code: R`
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct Message {
    pub id: u64,
    pub body: Vec<u8>,
}

pub struct ArchiveConfig {
    pub max_body: usize,
}

pub struct Archive {
    by_id: Mutex<HashMap<u64, Vec<u8>>>,
    config: Arc<ArchiveConfig>,
}

impl Archive {
    pub fn new(config: Arc<ArchiveConfig>) -> Archive {
        Archive { by_id: Mutex::new(HashMap::new()), config }
    }

+    pub fn store_all(&self, batch: &[Message]) -> usize {
+        let config = Arc::clone(&self.config); ⟦d1⟧
+        let mut stored = 0;
+        for msg in batch {
+            let body = msg.body.clone(); ⟦a⟧
+            if body.len() > config.max_body {
+                continue;
+            }
+            let mut map = self.by_id.lock().unwrap(); ⟦d2⟧
+            map.insert(msg.id, body);
+            stored += 1;
+        }
+        stored
+    }
+
+    pub fn size_of(&self, id: u64) -> usize {
+        let map = self.by_id.lock().unwrap();
+        let copy = map.clone(); ⟦b⟧
+        copy.get(&id).map(|b| b.len()).unwrap_or(0) ⟦c⟧
+    }
}
`,
          issues: [
            {
              id: 'a', tag: 'cost', title: 'Every body is copied before the size check',
              why: 'The clone happens first, so a 4 MB body that is about to be skipped still gets allocated and copied. The copy is only needed for bodies that are actually stored.',
              fix: 'Check «msg.body.len()» first, then clone only what goes into the map. Better still, take the batch by value («batch: Vec<Message>») and move each body in with no copy at all.',
            },
            {
              id: 'b', tag: 'cost', title: 'Clones the whole archive to read one length',
              why: '«map.clone()» copies every stored body (up to 500 times 4 MB) just to look up one entry, and it does it while holding the lock, every 15 seconds.',
              fix: 'Read through the guard: «map.get(&id).map(|b| b.len())». No copy needed.',
            },
            {
              id: 'c', tag: 'logic', title: 'An unknown id reports size 0',
              why: '«.unwrap_or(0)» makes "no such message" look exactly like "an empty body". The metrics endpoint will report a real zero for ids that do not exist.',
              fix: 'Return «Option<usize>» and let the caller decide what a missing id means.',
            },
          ],
          decoys: [
            { id: 'd1', why: '«Arc::clone» only bumps a reference count: no config data is copied. (The code could also just use «self.config» directly, but this costs almost nothing.)' },
            { id: 'd2', why: '«lock().unwrap()» is the accepted idiom. It only panics if another thread already panicked while holding this lock (the lock is "poisoned"), and then there is little better to do.' },
          ],
          hints: [
            'Two of the issues are the same hunt: something is copied that does not need to be.',
            'Look at what «.clone()» is called on, and how big that thing can get given the context in the description.',
            'The third is a plain logic bug: what does «size_of» return for an id that was never stored?',
          ],
          solution: {
            fixed: R`
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct Message {
    pub id: u64,
    pub body: Vec<u8>,
}

pub struct ArchiveConfig {
    pub max_body: usize,
}

pub struct Archive {
    by_id: Mutex<HashMap<u64, Vec<u8>>>,
    config: Arc<ArchiveConfig>,
}

impl Archive {
    pub fn new(config: Arc<ArchiveConfig>) -> Archive {
        Archive { by_id: Mutex::new(HashMap::new()), config }
    }

    pub fn store_all(&self, batch: Vec<Message>) -> usize {
        let mut stored = 0;
        for msg in batch {
            if msg.body.len() > self.config.max_body {
                continue;
            }
            self.by_id.lock().unwrap().insert(msg.id, msg.body);
            stored += 1;
        }
        stored
    }

    pub fn size_of(&self, id: u64) -> Option<usize> {
        let map = self.by_id.lock().unwrap();
        map.get(&id).map(|b| b.len())
    }
}
`,
            talk: 'Two needless copies: every body was cloned before the size check, and size_of cloned the whole map to read one length, under the lock. And size_of reported 0 for an unknown id instead of returning an Option.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
