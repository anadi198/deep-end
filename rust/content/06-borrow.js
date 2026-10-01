(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'borrow', title: 'Borrowing: lending without giving away', short: 'Borrow',
    blurb: 'The read-write lock the compiler checks, why reordering lines fixes borrow errors, how to read «\'a», what «&self» and «&mut self» promise, and the "fixes" that only move a borrow error somewhere worse.',
    items: [
      {
        lesson: 'borrow-rwlock', title: 'Borrowing is a read-write lock the compiler checks', mins: 7,
        remember: 'Many readers or one writer, never both at once: «&T» is a shared read borrow, «&mut T» is the single exclusive write borrow.',
        cue: 'E0502 or E0499 "cannot borrow ... because it is also borrowed" → two borrows overlap; finish with one before starting the other',
        body: R`
          ## Lending without giving away

          «&x» lends x for reading. «&mut x» lends it for writing. The owner gets it back when the borrow ends, and nothing is copied. The Ownership module said a function that only reads should take «&str»: this is why that works.

          :::vs The same rule in two worlds
          ~~~java
          ReadWriteLock rw = new ReentrantReadWriteLock();
          rw.readLock().lock();   // many threads may hold this
          rw.writeLock().lock();  // only one, and no readers
          ~~~
          ~~~cpp
          const auto& r1 = data;  // any number of references
          const auto& r2 = data;
          auto& w = data;         // and a mutable one at the same time:
          w.push_back(4);         // allowed, unchecked, r1 and r2 see it
          ~~~
          ~~~rust
          let r1 = &data;       // any number of shared borrows
          let r2 = &data;
          let w = &mut data;    // only one, and no shared borrow still in use
          ~~~
          :::

          The difference: Java checks at run time, and only if you remembered to take the lock. Rust checks at compile time, for every variable, at zero run-time cost.

          ## The classic: keeping a reference while changing the Vec

          ~~~rust !fail
          fn main() {
              let mut queue = vec![String::from("A01"), String::from("A08")];
              let first = &queue[0];
              queue.push(String::from("A03"));
              println!("{first}");
          }
          ~~~

          Why the compiler refuses: «push» may need a bigger buffer, which moves every element to new memory. «first» would then point at freed memory. Java's version of this bug is a «ConcurrentModificationException» at run time, if you are lucky. Here it is a compile error.

          C++ has exactly this bug, and calls it **iterator invalidation**. It compiles without a warning. Run under AddressSanitizer, the program is caught reading freed memory:

          ~~~cpp !asan The same code in C++
          int main() {
              std::vector<int> queue = {1, 8};
              const int& first = queue[0];
              queue.push_back(3);
              std::cout << first << '\n';
          }
          ~~~

          Without the sanitizer it may print 1, print garbage, or crash, depending on the allocator: undefined behaviour. The borrow rule is the compile-time version of "do not hold a reference into a «vector» across «push_back»", a rule C++ programmers keep in their heads.

          @stop

          ## Two writers

          ~~~rust !fail
          fn main() {
              let mut count = 0;
              let a = &mut count;
              let b = &mut count;
              *a += 1;
              *b += 1;
          }
          ~~~

          «*a» means "the value that «a» points at". Two «&mut» borrows alive at once is E0499: the single-writer rule.

          @quiz 0
        `,
        quiz: [
          {
            q: 'Which of these does the borrow checker allow?',
            options: ['Two «&mut» borrows of the same «Vec», both used', 'A «&» borrow of an element, then «push» on the Vec, then using the element', 'Any number of «&» borrows used at the same time', 'A «&mut» borrow while a «&» borrow is still used afterwards'],
            answer: 2,
            why: 'Shared borrows never conflict with each other. Every other option mixes a writer with another borrow that is still in use.',
          },
        ],
      },
      {
        lesson: 'borrow-scopes', title: 'A borrow lasts until its last use', mins: 5,
        remember: 'A borrow ends at its last use, not at the closing brace, so reordering lines often fixes a borrow error.',
        cue: 'A borrow error between two lines → can the read finish before the write starts? Move the last use up, or copy the small value out first',
        body: R`
          @predict 0

          The compiler tracks where each borrow is **last used**. Once a reference is finished with, the value is free to be changed again, even though the variable is still in scope.

          ## Four fixes, in the order to try them

          1. **Reorder**: finish reading before you write.
          2. **Copy out a small value**: a length or an id is «Copy», so it does not borrow anything.
          3. **Clone something small**: fine for a short id; not for a message body.
          4. **Index again later**: read «queue[0]» after the change instead of holding a reference across it.

          ~~~rust !run
          fn main() {
              let mut queue = vec![String::from("A01"), String::from("A08")];
              let first_len = queue[0].len();
              queue.push(String::from("A03"));
              println!("{first_len} {}", queue.len());
          }
          ~~~

          «first_len» is a «usize», a plain copied number, so nothing is borrowed across the «push».

          :::pitfall When a borrow error gets "fixed"
          Check which of the four was used. Reorders and copies of small values are real fixes. A clone of something big, or one of the escape hatches in the last lesson of this module, only moves the problem.
          :::
        `,
        predict: [
          {
            q: 'The same queue, but the reference is used before the push. What happens?',
            code: 'fn main() {\n    let mut queue = vec![String::from("A01"), String::from("A08")];\n    let first = &queue[0];\n    println!("{first}");\n    queue.push(String::from("A03"));\n    println!("{}", queue.len());\n}',
            options: ['A01\n3', 'Compile error'],
            answer: 0,
            why: '«first» is last used in the first «println!», before the «push». The shared borrow is over by then, so the write is allowed.',
          },
        ],
      },
      {
        lesson: 'borrow-lifetimes', title: 'Lifetimes («\'a»)', mins: 8,
        remember: 'A lifetime like «\'a» is a label, not a duration you choose: it says a reference cannot outlive the thing it points into.',
        cue: '«T: \'static» on «spawn» or a thread → the value must own all its data (borrow nothing short-lived), not "live forever"',
        body: R`
          ## Most lifetimes are invisible

          «fn segment_name(line: &str) -> &str» has a lifetime you do not see: the compiler reads it as "the result points into «line»". That rule (one reference in, so the reference out borrows from it) covers most functions.

          ## When you do see them

          ~~~rust !run
          fn longer<'a>(a: &'a str, b: &'a str) -> &'a str {
              if a.len() >= b.len() { a } else { b }
          }

          fn main() {
              let x = String::from("ADT^A01");
              let y = String::from("ORU");
              println!("{}", longer(&x, &y));
          }
          ~~~

          With two references in, the compiler cannot guess which one the result points into, so the signature says it:

          - «<'a>» declares a label, like a generic type parameter.
          - «&'a str» is "a borrowed «str» that lives at least as long as «'a»". The result can live no longer than either input.
          - On a struct, «struct Parser<'a> { buf: &'a [u8] }» means: a «Parser» borrows a buffer and cannot outlive it.

          @predict 0

          @stop

          ## The error you will meet: returning a reference to a local

          ~~~rust !fail
          fn header(raw: &str) -> &str {
              let upper = raw.to_uppercase();
              &upper[..3]
          }

          fn main() {
              println!("{}", header("msh|x"));
          }
          ~~~

          «upper» is dropped when «header» returns, so a reference into it would dangle. The fix is to return an owned «String».

          C++ accepts the equivalent with «std::string_view», and the view outlives the string it points into:

          ~~~cpp !asan The same function in C++
          std::string_view header(std::string_view raw) {
              std::string upper(raw);
              for (char& c : upper) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
              return std::string_view(upper).substr(0, 3);
          }

          int main() {
              std::string_view h = header("msh|a long enough line to live on the heap");
              std::cout << h << '\n';
          }
          ~~~

          A lifetime in Rust is the compiler tracking, for every reference, which owner it points into and how long that owner lives. C++ has the same references and no such tracking, so this class of bug turns up at run time, if a sanitizer or a crash finds it.

          ## «'static», threads and «spawn»

          «'static» means "borrows nothing short-lived". A string literal is «'static». So is an owned «String»: it borrows nothing, even though it will be freed one day.

          «std::thread::spawn» and «tokio::spawn» demand «'static», because the new thread or task may outlive the function that started it:

          ~~~rust !fail
          use std::thread;

          fn main() {
              let batch = vec![1, 2, 3];
              let handle = thread::spawn(|| {
                  println!("{}", batch.len());
              });
              handle.join().unwrap();
          }
          ~~~

          ~~~rust !run
          use std::thread;

          fn main() {
              let batch = vec![1, 2, 3];
              let handle = thread::spawn(move || {
                  println!("{}", batch.len());
              });
              handle.join().unwrap();
          }
          ~~~

          «move» makes the closure take ownership of «batch», so the thread owns what it uses. That is why «move» closures and «Arc» clones appear right before nearly every spawn in server code.

          :::pitfall Lifetimes in practice
          - A few «'a» on a parser or an iterator: normal.
          - Lifetimes spreading across many structs to make something compile: ask whether the data should just be owned. Owned data plus an occasional clone is usually easier to maintain.
          - «Box::leak» to get a «'static» reference: leaks memory on purpose. See the last lesson in this module.
          :::
        `,
        predict: [
          {
            q: 'No «\'a» anywhere. What happens?',
            code: 'fn first_word(s: &str) -> &str {\n    s.split(\' \').next().unwrap_or("")\n}\n\nfn main() {\n    let w;\n    {\n        let line = String::from("ACK AA");\n        w = first_word(&line);\n    }\n    println!("{w}");\n}',
            options: ['ACK', 'Compile error', 'It panics'],
            answer: 1, error: 'E0597',
            why: '«w» points into «line», and «line» is dropped at the inner closing brace. Printing «w» afterwards would read freed memory, so rustc says «line» "does not live long enough". The hidden lifetime did its job with no «\'a» written.',
          },
        ],
      },
      {
        lesson: 'borrow-self', title: '«&self», «&mut self», «self»: what a method can do', mins: 6,
        remember: 'The receiver says it all: «&self» reads, «&mut self» changes, and «self» consumes the object so the caller cannot use it again.',
        cue: 'A method name starts with «as_», «to_» or «into_» → «as_» is a free view, «to_» makes a copy, «into_» consumes the original',
        body: R`
          | Receiver | Meaning | Java-ish |
          |---|---|---|
          | «&self» | read-only access | a getter, or any method that does not mutate |
          | «&mut self» | may change the object | a setter; the caller needs «let mut obj» |
          | «self» | takes the object | a builder's «build()»; the old variable is gone afterwards |

          @predict 0

          ## Consuming methods

          ~~~rust !fail
          fn main() {
              let raw = String::from("ADT");
              let bytes = raw.into_bytes();
              println!("{} {}", bytes.len(), raw);
          }
          ~~~

          «into_bytes» takes «self», so «raw» is moved into it. In exchange it can hand back the same buffer as bytes without copying anything.

          @stop

          ## The naming convention

          Rust's API guidelines give method names a cost signal. Every standard library type follows it, and so does most well-written code:

          | Prefix | Cost | Examples |
          |---|---|---|
          | «as_» | a free view that borrows | «s.as_str()», «s.as_bytes()», «opt.as_ref()» |
          | «to_» | allocates or copies | «s.to_string()», «s.to_uppercase()», «slice.to_vec()» |
          | «into_» | consumes self, usually cheap | «s.into_bytes()», «v.into_iter()», «x.into()» |

          In a hot loop, a «to_» call is worth a second look. An «as_» call never is.
        `,
        predict: [
          {
            q: 'What happens?',
            code: 'struct Counter {\n    n: u32,\n}\n\nimpl Counter {\n    fn bump(&mut self) {\n        self.n += 1;\n    }\n}\n\nfn main() {\n    let c = Counter { n: 0 };\n    c.bump();\n    println!("{}", c.n);\n}',
            options: ['1', 'Compile error', '0'],
            answer: 1, error: 'E0596',
            why: '«bump» takes «&mut self», and you can only borrow mutably from a variable declared «mut». rustc suggests «let mut c».',
          },
        ],
      },
      {
        lesson: 'borrow-rules', title: 'The borrowing rules and lifetime elision, precisely', mins: 7,
        remember: 'At any point a value has either one «&mut» borrow or any number of «&» borrows, never both, and no reference may outlive its referent. When a signature leaves lifetimes out, three elision rules fill them in; if they cannot, the signature must name them.',
        cue: 'A function returns a reference and takes two reference parameters (and no «self») → elision cannot choose; an explicit «\'a» must say which input the result borrows from',
        body: R`
          ## The rules

          1. **Aliasing or mutation, never both.** While a «&mut T» to a value is alive, no other reference to it may be used; while any «&T» is alive, it cannot be mutated through anything else.
          2. **No dangling.** A reference's lifetime lies within the lifetime of the value it points to.
          3. **A borrow lasts until its last use**, not until the end of the block (non-lexical lifetimes).
          4. **A borrowed value cannot be moved.** While any reference to it is alive, the owner cannot give it away or drop it.
          5. **Reborrowing.** Passing a «&mut T» to a function lends it for the duration of the call (an implicit «&mut *r»), after which the original is usable again.

          ## The three elision rules

          In a function signature, lifetimes that are left out are filled in like this:

          1. Every elided lifetime in the **parameters** becomes a separate lifetime parameter.
          2. If there is exactly **one** input lifetime, elided or not, it is given to every elided output lifetime.
          3. If there are several input lifetimes but one of them is «&self» or «&mut self», the lifetime of «self» is given to every elided output lifetime.

          If an output lifetime is still unassigned after that, the signature is an error and must be written out.

          | Written | What the compiler reads |
          |---|---|
          | «fn first(s: &str) -> &str» | «fn first<'a>(s: &'a str) -> &'a str» (rule 2) |
          | «fn name(&self, key: &str) -> &str» | «fn name<'a, 'b>(&'a self, key: &'b str) -> &'a str» (rule 3) |
          | «fn longer(a: &str, b: &str) -> &str» | no rule applies: an error |

          ~~~rust !fail
          fn longer(a: &str, b: &str) -> &str {
              if a.len() >= b.len() { a } else { b }
          }

          fn main() {
              println!("{}", longer("ADT", "ORU^R01"));
          }
          ~~~

          The compiler suggests «<'a>» on both inputs and the output, which is the «longer» from the Lifetimes lesson.

          @stop

          ## Rule 3 has a consequence

          @predict 0

          ## Lifetimes on types

          A struct that holds a reference must declare a lifetime parameter, and so must its «impl»:

          ~~~rust !run
          struct Fields<'a> {
              line: &'a str,
          }

          impl<'a> Fields<'a> {
              fn nth(&self, n: usize) -> Option<&'a str> {
                  self.line.split('|').nth(n)
              }
          }

          fn main() {
              let line = String::from("MSH|^~\\&|LAB");
              let f = Fields { line: &line };
              println!("{:?} {:?}", f.nth(2), f.nth(9));
          }
          ~~~

          «Option<&'a str>» says the result borrows from the original line, not from the «Fields» value, so it may outlive «f» as long as «line» is still alive.
        `,
        predict: [
          {
            q: 'The method returns the other argument, not something inside «self». What happens?',
            code: R`struct Store {
    name: String,
}

impl Store {
    fn pick(&self, other: &str) -> &str {
        if self.name.is_empty() { other } else { &self.name }
    }
}

fn main() {
    let s = Store { name: String::new() };
    println!("{}", s.pick("fallback"));
}`,
            options: ['fallback', 'Compile error', 'It prints an empty line'],
            answer: 1,
            why: 'By rule 3 the result borrows from «self», but one branch returns «other», which has an unrelated lifetime: "lifetime may not live long enough". The signature has to say that both inputs and the output share one lifetime: «fn pick<\'a>(&\'a self, other: &\'a str) -> &\'a str».',
          },
        ],
      },
      {
        lesson: 'borrow-ai-fixes', title: 'Escape hatches: fixes that move the problem', mins: 7, hunts: ['panic', 'cost', 'unbounded'],
        remember: 'When code fought the borrow checker, check how it won: reordering or borrowing is a real fix; big clones, «RefCell» and leaked memory move the problem somewhere worse.',
        cue: '«RefCell», «Rc<RefCell<..>>», «Box::leak» or a pile of «.clone()» added to make code compile → which borrow error did it fix, and would a reorder or a borrow do?',
        body: R`
          ## The escape hatches, best to worst

          | The fix | What it really does | Verdict |
          |---|---|---|
          | Reorder lines, borrow instead of own, return an owned value | fixes the design | good |
          | «.clone()» of something small, or of an «Arc» | a cheap copy | fine |
          | «.clone()» of big data in a loop | pays for every byte, every time | avoid |
          | «RefCell», «Rc<RefCell<T>>» | moves the borrow check to run time: a conflict becomes a panic | only with a real reason |
          | «Box::leak», «std::mem::forget», «unsafe» | leaks memory, or switches the checks off | avoid; «unsafe» is beyond this course |

          ## «RefCell»: the same rules, checked while running

          ~~~rust !panic
          use std::cell::RefCell;

          fn main() {
              let queue = RefCell::new(vec![1, 2, 3]);
              let reading = queue.borrow();
              queue.borrow_mut().push(4);
              println!("{}", reading.len());
          }
          ~~~

          Exactly the conflict from the first lesson of this module, but the compiler has been told to stand aside, so it becomes a panic on the day that code path runs. «RefCell» has real uses (a cache behind a «&self» method, graph structures). Reached for only to "fix borrow checker errors", it is a smell.

          @stop

          ## «Box::leak»: «'static» by never freeing

          ~~~rust !run
          fn label(id: u64) -> &'static str {
              Box::leak(format!("retry {id}").into_boxed_str())
          }

          fn main() {
              for id in 0..3 {
                  println!("{}", label(id));
              }
          }
          ~~~

          It works, and every call leaks its string forever. In a service that calls it once per message, memory only ever grows. Returning a «String» is the fix.

          @quiz 0

          @exercises borrow-review-retry
        `,
        quiz: [
          {
            q: 'A change "fixes the borrow checker errors" by wrapping a struct\'s «Vec» in «Rc<RefCell<...>>». What is the catch?',
            options: ['Nothing: «RefCell» is the standard fix', 'Which borrow conflict it was solving, because «RefCell» turns that conflict into a run-time panic', 'Whether «Arc<Mutex>» would be faster', 'Whether it could use «unsafe» instead'],
            answer: 1,
            why: 'The conflict did not go away; it moved from compile time to run time. Often a reorder, a borrow, or taking ownership fixes the real problem.',
          },
        ],
      },
      {
        exercise: {
          id: 'borrow-fix-outbox', title: 'Make the outbox compile, with no clones', kind: 'fix', mins: 10, diff: 'medium', topics: ['borrowing'],
          statement: R`
            «send_next» should move the oldest pending message to «sent» and return a report line. It does not compile: press **Run** and read which borrows overlap.

            Fix it without cloning anything. The tests check the report text and that «sent» and «pending» end up right.
          `,
          starter: R`
pub struct Outbox {
    pending: Vec<String>,
    sent: Vec<String>,
}

impl Outbox {
    pub fn new() -> Outbox {
        Outbox { pending: Vec::new(), sent: Vec::new() }
    }

    pub fn queue(&mut self, msg: &str) {
        self.pending.push(msg.to_string());
    }

    /// Moves the oldest pending message to sent and returns a report line.
    pub fn send_next(&mut self) -> Option<String> {
        let next = self.pending.first()?;
        self.sent.push(next.clone());
        self.pending.remove(0);
        Some(format!("sent {next}, {} left", self.pending.len()))
    }
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'sends in order', ex: true, code: 'let mut o = Outbox::new();\no.queue("A01");\no.queue("A08");\nassert_eq!(o.send_next().as_deref(), Some("sent A01, 1 left"));\nassert_eq!(o.send_next().as_deref(), Some("sent A08, 0 left"));' },
            { name: 'an empty outbox sends nothing', ex: true, code: 'let mut o = Outbox::new();\nassert_eq!(o.send_next(), None);' },
            { name: 'sent keeps the history', code: 'let mut o = Outbox::new();\no.queue("A01");\no.send_next();\nassert_eq!(o.sent, vec!["A01".to_string()]);\nassert!(o.pending.is_empty());' },
          ],
          lint: [
            { re: '\\.clone\\(\\)|\\.to_string\\(\\)[^;]*sent|to_owned', when: 'present', note: 'This works, but copies the message. «remove(0)» already hands you the «String» itself.' },
          ],
          hints: [
            'The error says «next» borrows «self.pending» while «remove(0)» wants to change it.',
            '«remove(0)» returns the removed «String». Take ownership of it instead of borrowing it.',
            'Return «None» early if «pending» is empty, then «let next = self.pending.remove(0);», build the report line, and push «next» into «sent» last.',
          ],
          solution: {
            rust: R`
pub struct Outbox {
    pending: Vec<String>,
    sent: Vec<String>,
}

impl Outbox {
    pub fn new() -> Outbox {
        Outbox { pending: Vec::new(), sent: Vec::new() }
    }

    pub fn queue(&mut self, msg: &str) {
        self.pending.push(msg.to_string());
    }

    /// Moves the oldest pending message to sent and returns a report line.
    pub fn send_next(&mut self) -> Option<String> {
        if self.pending.is_empty() {
            return None;
        }
        let next = self.pending.remove(0);
        let line = format!("sent {next}, {} left", self.pending.len());
        self.sent.push(next);
        Some(line)
    }
}
`,
            why: R`
              - «first()» returned a reference into «pending», and that reference was still needed for the report after «remove(0)» changed «pending». That is the read-write conflict.
              - «remove(0)» returns the «String» it took out. Owning it means nothing is borrowed from «pending» any more, and the clone disappears too.
              - Build the report line before pushing «next» into «sent», because the push moves «next».
              - Aside: «remove(0)» shifts every remaining element. For a real queue, «VecDeque» with «pop_front()» avoids that. Not the point here.
            `,
            talk: 'next borrowed the pending Vec while remove(0) changed it. remove(0) returns the String itself, so taking ownership of it ends the borrow and also removes the need to clone.',
          },
          wrong: [
            { name: 'forgets to remove', rust: R`
pub struct Outbox { pending: Vec<String>, sent: Vec<String> }
impl Outbox {
    pub fn new() -> Outbox { Outbox { pending: Vec::new(), sent: Vec::new() } }
    pub fn queue(&mut self, msg: &str) { self.pending.push(msg.to_string()); }
    pub fn send_next(&mut self) -> Option<String> {
        let next = self.pending.first()?.clone();
        self.sent.push(next.clone());
        Some(format!("sent {next}, {} left", self.pending.len()))
    }
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'borrow-review-retry', title: 'Find the bugs: a retry queue that compiles now', kind: 'review', mins: 12, diff: 'medium', topics: ['borrowing'],
          file: 'src/retry.rs',
          statement: R`
            **The change:** The retry queue would not compile after adding «tick» and «label». Wrapped the items in «Rc<RefCell<...>>» and adjusted the signatures. Compiles now, and the existing tests pass.

            Context: the queue lives on one thread; «tick» runs every second; «label» is called once per retry, which is thousands of times an hour.
          `,
          code: R`
use std::cell::RefCell;
use std::rc::Rc;

pub struct Retry {
    pub id: u64,
    pub attempts: u32,
    pub body: Vec<u8>,
}

pub struct RetryQueue {
+    items: Rc<RefCell<Vec<Retry>>>,
}

impl RetryQueue {
    pub fn new() -> RetryQueue {
+        RetryQueue { items: Rc::new(RefCell::new(Vec::new())) }
    }

    pub fn push(&self, r: Retry) {
+        self.items.borrow_mut().push(r);
    }

+    /// Drops every item that has used up its attempts. Returns how many are left.
+    pub fn tick(&self, max: u32) -> usize {
+        let items = self.items.borrow(); ⟦a⟧
+        for r in items.iter() {
+            if r.attempts >= max {
+                self.items.borrow_mut().retain(|x| x.id != r.id); ⟦a⟧
+            }
+        }
+        items.len()
+    }
+
+    pub fn label(&self, id: u64) -> &'static str {
+        let items = self.items.borrow(); ⟦d1⟧
+        let found = items.iter().find(|r| r.id == id).map(|r| r.body.clone()); ⟦b⟧
+        let text = match found {
+            Some(body) => format!("retry {id}: {} bytes", body.len()),
+            None => format!("retry {id}: gone"),
+        };
+        Box::leak(text.into_boxed_str()) ⟦c⟧
+    }
}
`,
          issues: [
            {
              id: 'a', tag: 'panic', title: '«tick» panics as soon as an item runs out of attempts',
              why: '«items» holds a shared «borrow()» for the whole loop, and inside it «borrow_mut()» asks for a write borrow of the same «RefCell». That is the read-write conflict the compiler used to reject; with «RefCell» it becomes a run-time panic ("already borrowed"). The tests pass only because no test item reaches «max».',
              fix: 'Drop the «RefCell» and write «tick(&mut self, max: u32)» with «self.items.retain(|r| r.attempts < max); self.items.len()». One mutable borrow, no conflict.',
              demo: 'let q = RetryQueue::new();\nq.push(Retry { id: 1, attempts: 3, body: vec![] });\nassert_eq!(q.tick(3), 0);',
            },
            {
              id: 'b', tag: 'cost', title: 'Clones a whole body to read its length',
              why: 'Bodies can be large, and «label» runs thousands of times an hour. The clone copies every byte just so «.len()» can be called on the copy.',
              fix: '«.map(|r| r.body.len())»: read the length through the borrow.',
            },
            {
              id: 'c', tag: 'unbounded', title: 'Every label leaks its string forever',
              why: '«Box::leak» gives a «&\'static str» by never freeing the memory. One leak per retry, thousands an hour, for as long as the process runs.',
              fix: 'Return «String». The caller owns it and it is freed when they are done.',
            },
          ],
          decoys: [
            { id: 'd1', why: 'A shared «borrow()» for the duration of a read-only lookup is fine: nothing tries to write while it lives. (The whole «RefCell» is still unnecessary here, but this line is not a bug.)' },
          ],
          hints: [
            'One issue crashes, one wastes work, one grows without limit.',
            'For the crash: in «tick», which borrows of «self.items» are alive at the same time?',
            'For the growth: what happens to the memory «Box::leak» hands out?',
          ],
          solution: {
            fixed: R`
pub struct Retry {
    pub id: u64,
    pub attempts: u32,
    pub body: Vec<u8>,
}

pub struct RetryQueue {
    items: Vec<Retry>,
}

impl RetryQueue {
    pub fn new() -> RetryQueue {
        RetryQueue { items: Vec::new() }
    }

    pub fn push(&mut self, r: Retry) {
        self.items.push(r);
    }

    /// Drops every item that has used up its attempts. Returns how many are left.
    pub fn tick(&mut self, max: u32) -> usize {
        self.items.retain(|r| r.attempts < max);
        self.items.len()
    }

    pub fn label(&self, id: u64) -> String {
        match self.items.iter().find(|r| r.id == id) {
            Some(r) => format!("retry {id}: {} bytes", r.body.len()),
            None => format!("retry {id}: gone"),
        }
    }
}
`,
            talk: 'The RefCell turned a compile error into a panic: tick holds a borrow while asking for borrow_mut. label cloned a body to read its length, and leaked a string on every call. Plain &mut self methods and returning String fix all three.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
