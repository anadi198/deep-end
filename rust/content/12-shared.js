(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'shared', title: 'Shared state: «Arc», «Mutex», «Send» and «Sync»', short: 'Shared',
    blurb: 'How threads share data in Rust: counted ownership with «Arc», a lock that owns its data, atomics for counters, the deadlock the compiler cannot see, and the thread-safety check it can.',
    items: [
      {
        lesson: 'sh-arc', title: '«Arc»: shared ownership, counted', mins: 6,
        remember: '«Arc<T>» lets several owners share one value; cloning an «Arc» only bumps a counter, and the value is freed when the last owner drops it.',
        cue: '«Arc::clone(&x)» right before a spawn → normal: each thread or task gets its own handle to the same data',
        body: R`
          The Ownership module's rule was one owner per value. «Arc» ("atomically reference counted") is the sanctioned exception: many owners, one value, freed when the count reaches zero. It is the closest thing Rust has to an ordinary Java reference.

          ~~~rust !run
          use std::sync::Arc;

          fn main() {
              let config = Arc::new(vec![String::from("lab.local"), String::from("2575")]);
              let a = Arc::clone(&config);
              let b = Arc::clone(&config);
              println!("owners: {}", Arc::strong_count(&config));
              drop(a);
              drop(b);
              println!("owners: {}", Arc::strong_count(&config));
              println!("same data: {}", config[0]);
          }
          ~~~

          @predict 0

          ## Shared means read-only

          An «Arc» hands out shared access, and the Borrowing module said shared means read-only. To change shared data, something inside has to allow it safely: a lock or an atomic.

          ~~~rust !fail
          use std::sync::Arc;

          fn main() {
              let queue = Arc::new(vec![1, 2]);
              queue.push(3);
          }
          ~~~

          So in real code you see «Arc<Mutex<T>>», «Arc<RwLock<T>>» or «Arc<AtomicU64>». «Rc» is the single-thread version of «Arc»: cheaper, and the compiler refuses to let it cross threads (last lesson of this module).
        `,
        predict: [
          {
            q: 'Is the clone a copy?',
            code: 'use std::sync::Arc;\n\nfn main() {\n    let a = Arc::new(String::from("ADT"));\n    let b = a.clone();\n    println!("{}", Arc::ptr_eq(&a, &b));\n}',
            options: ['true', 'false', 'Compile error'],
            answer: 0,
            why: '«ptr_eq» asks whether both handles point at the same value. Cloning an «Arc» copies the handle, not the string: one more owner, same data.',
          },
        ],
      },
      {
        lesson: 'sh-mutex', title: '«Mutex»: the lock owns the data', mins: 8, hunts: ['hang', 'cost'],
        remember: 'A Rust «Mutex<T>» wraps the data it protects, so nobody can touch the data without holding the lock, and the lock is released when the guard drops.',
        cue: '«Arc<Mutex<T>>» → a synchronized shared object; find where each guard\'s scope ends and what slow work happens inside it',
        body: R`
          :::vs The same counter
          ~~~java
          class Counter {
              private final Object lock = new Object();
              private long n;   // nothing stops code touching n without the lock
              void inc() { synchronized (lock) { n++; } }
          }
          ~~~
          ~~~rust
          struct Counter {
              n: Mutex<u64>,   // n is only reachable through the lock
          }
          impl Counter {
              fn inc(&self) { *self.n.lock().unwrap() += 1; }
          }
          ~~~
          :::

          In Java the lock and the data are separate, and discipline keeps them together. In Rust the data lives **inside** the «Mutex». «lock()» returns a guard, «*guard» is the data, and dropping the guard unlocks.

          ~~~rust !run
          use std::sync::{Arc, Mutex};
          use std::thread;

          fn main() {
              let acked = Arc::new(Mutex::new(0u64));
              let mut workers = Vec::new();
              for _ in 0..4 {
                  let acked = Arc::clone(&acked);
                  workers.push(thread::spawn(move || {
                      for _ in 0..1000 {
                          *acked.lock().unwrap() += 1;
                      }
                  }));
              }
              for w in workers {
                  w.join().unwrap();
              }
              println!("{}", acked.lock().unwrap());
          }
          ~~~

          - «.lock().unwrap()» only fails if another thread panicked while holding the lock (the lock is "poisoned"). It is the accepted idiom.
          - «RwLock» allows many readers or one writer: the Borrowing module's rule, checked at run time, across threads.
          - For one number, an atomic needs no lock: «AtomicU64::fetch_add(1, Ordering::Relaxed)». «Relaxed» is right for counters; for anything else, ask what ordering the author needs and why.

          @stop

          ## The bug the compiler cannot see: two locks, opposite order

          @predict 0

          Rust stops data races, not deadlocks. Two threads each hold one lock and wait forever for the other's. The barrier makes it happen every time here; in production it happens once a week, under load.

          :::pitfall Two questions for every lock
          1. **What runs while it is held?** Disk, network or a big loop inside the guard's scope makes every other thread wait.
          2. **Is there a second lock?** If two locks can be held together, they must always be taken in the same order everywhere.
          :::
        `,
        predict: [
          {
            q: 'Two threads, two locks, opposite order. What happens?',
            code: 'use std::sync::{Arc, Barrier, Mutex};\nuse std::thread;\n\nfn main() {\n    let a = Arc::new(Mutex::new(0));\n    let b = Arc::new(Mutex::new(0));\n    let barrier = Arc::new(Barrier::new(2));\n    let (a2, b2, bar2) = (Arc::clone(&a), Arc::clone(&b), Arc::clone(&barrier));\n    let t = thread::spawn(move || {\n        let _ga = a2.lock().unwrap();\n        bar2.wait();\n        let _gb = b2.lock().unwrap();\n    });\n    let _gb = b.lock().unwrap();\n    barrier.wait();\n    let _ga = a.lock().unwrap();\n    t.join().unwrap();\n    println!("done");\n}',
            options: ['done', 'It panics', 'It hangs', 'Compile error'],
            answer: 2,
            why: 'The thread holds «a» and waits for «b»; main holds «b» and waits for «a». Neither lets go, so it never finishes, and the Playground stops it after 10 seconds. It compiles fine: a deadlock is not a data race.',
          },
        ],
      },
      {
        lesson: 'sh-send-sync', title: '«Send» and «Sync»: the thread-safety check', mins: 6,
        remember: '«Send» means a value may move to another thread; «Sync» means it may be shared between threads. The compiler checks both, which is why data races do not compile.',
        cue: 'E0277 "cannot be sent between threads safely" → something inside is not thread-safe: an «Rc», a «RefCell», or a std «MutexGuard» held across «.await»',
        body: R`
          ~~~rust !fail
          use std::rc::Rc;
          use std::thread;

          fn main() {
              let shared = Rc::new(5);
              let s2 = Rc::clone(&shared);
              thread::spawn(move || println!("{s2}")).join().unwrap();
          }
          ~~~

          «Rc» counts its owners with a plain integer, so two threads cloning it at once could corrupt the count. It is not «Send», and «spawn» requires «Send». Nobody writes «Send» by hand: the compiler works it out from what a type contains.

          | Type | «Send» | «Sync» | Why |
          |---|---|---|---|
          | «Arc<T>» (when T is both) | yes | yes | atomic counter |
          | «Rc<T>» | no | no | plain counter |
          | «RefCell<T>» | yes | no | its borrow flag is not thread-safe |
          | «Mutex<T>» | yes | yes | that is its job |
          | std «MutexGuard» | no | yes | must be unlocked on the thread that locked it |

          @stop

          ## The async version of this error

          Tokio moves tasks between threads, so everything a spawned task holds across an «.await» must be «Send». A std «MutexGuard» is not:

          ~~~rust !fail
          use std::sync::{Arc, Mutex};

          #[tokio::main]
          async fn main() {
              let state = Arc::new(Mutex::new(0));
              let s = Arc::clone(&state);
              tokio::spawn(async move {
                  let mut guard = s.lock().unwrap();
                  *guard += 1;
                  tokio::time::sleep(std::time::Duration::from_millis(1)).await;
              })
              .await
              .unwrap();
          }
          ~~~

          The error ("future cannot be sent between threads safely") points at the «.await» and the guard held across it. This is the compiler catching a lock held across an await for you. The Async module covers the case it cannot catch.

          @quiz 0
        `,
        quiz: [
          {
            q: 'rustc says «Rc<Config>» cannot be sent between threads safely. What is the usual fix?',
            options: ['Wrap the spawn in «unsafe»', 'Use «Arc» instead of «Rc» (with a «Mutex» inside if it must change)', 'Clone the «Rc» before the spawn', 'Add «move» to the closure'],
            answer: 1,
            why: '«Arc» is the thread-safe «Rc». Cloning an «Rc» still gives an «Rc», and «move» was probably already there: the problem is the type, not the capture.',
          },
        ],
      },
      {
        exercise: {
          id: 'sh-fix-counter', title: 'Share a counter between worker threads', kind: 'fix', mins: 8, diff: 'easy', topics: ['shared'],
          statement: R`
            «count_acks» starts some worker threads, and each records acks in a shared total. It does not compile: press **Run** and read which type cannot cross threads.

            Make it compile and count correctly. Either «Arc<Mutex<u64>>» or «Arc<AtomicU64>» works; the solution shows both.
          `,
          starter: R`
use std::cell::RefCell;
use std::rc::Rc;
use std::thread;

/// Runs workers threads that each record per_worker acks. Returns the total.
pub fn count_acks(workers: usize, per_worker: u64) -> u64 {
    let total = Rc::new(RefCell::new(0u64));
    let mut handles = Vec::new();
    for _ in 0..workers {
        let total = Rc::clone(&total);
        handles.push(thread::spawn(move || {
            for _ in 0..per_worker {
                *total.borrow_mut() += 1;
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    let n = *total.borrow();
    n
}
`,
          starterFails: 'compile',
          tests: [
            { name: 'four workers', ex: true, code: 'assert_eq!(count_acks(4, 1000), 4000);' },
            { name: 'no workers', ex: true, code: 'assert_eq!(count_acks(0, 5), 0);' },
            { name: 'many workers, many acks', code: 'assert_eq!(count_acks(8, 2500), 20000);' },
          ],
          hints: [
            'The errors say «Rc» and «RefCell» cannot be sent or shared between threads.',
            '«Rc» becomes «Arc». «RefCell» becomes «Mutex» (then «*total.lock().unwrap() += 1»), or use «AtomicU64» with «fetch_add».',
            'At the end, read the total through the same lock or atomic: «*total.lock().unwrap()» or «total.load(Ordering::Relaxed)».',
          ],
          solution: {
            rust: R`
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;

/// Runs workers threads that each record per_worker acks. Returns the total.
pub fn count_acks(workers: usize, per_worker: u64) -> u64 {
    let total = Arc::new(AtomicU64::new(0));
    let mut handles = Vec::new();
    for _ in 0..workers {
        let total = Arc::clone(&total);
        handles.push(thread::spawn(move || {
            for _ in 0..per_worker {
                total.fetch_add(1, Ordering::Relaxed);
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    total.load(Ordering::Relaxed)
}
`,
            why: R`
              - «Rc» to «Arc»: a counter that is safe to update from several threads.
              - «RefCell» to «AtomicU64»: one number needs no lock. «Relaxed» is enough because «join()» already waits for every thread before the total is read.
              - The «Mutex» version works too: «Arc::new(Mutex::new(0u64))», «*total.lock().unwrap() += 1», and «*total.lock().unwrap()» at the end. Use it when the shared thing is more than one number.
            `,
            talk: 'Rc and RefCell are single-thread types, so the compiler refused to send them to worker threads. Arc plus an AtomicU64 (or a Mutex) is the thread-safe version of the same idea.',
          },
          wrong: [
            { name: 'copies the number out of the lock', rust: R`
use std::sync::{Arc, Mutex};
use std::thread;
pub fn count_acks(workers: usize, per_worker: u64) -> u64 {
    let total = Arc::new(Mutex::new(0u64));
    let mut handles = Vec::new();
    for _ in 0..workers {
        let total = Arc::clone(&total);
        handles.push(thread::spawn(move || {
            let mut local = *total.lock().unwrap();
            for _ in 0..per_worker { local += 1; }
        }));
    }
    for h in handles { h.join().unwrap(); }
    let n = *total.lock().unwrap();
    n
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'sh-review-metrics', title: 'Find the bugs: per-peer counters and a reporter', kind: 'review', mins: 12, diff: 'medium', topics: ['shared'],
          file: 'src/metrics.rs',
          statement: R`
            **The change:** Counts messages per peer, records the last error, and pushes a snapshot to the monitoring collector every 15 seconds over TCP.

            Context: «record» is called by every connection thread for every message. «status» is called by the health endpoint. The collector sits across a VPN and is sometimes slow or unreachable.
          `,
          code: R`
use std::collections::HashMap;
use std::io::Write;
use std::net::TcpStream;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub struct Metrics {
    pub received: AtomicU64,
    pub per_peer: Mutex<HashMap<String, u64>>,
    pub last_error: Mutex<Option<String>>,
}

impl Metrics {
+    pub fn record(&self, peer: &str) {
+        self.received.fetch_add(1, Ordering::Relaxed); ⟦d1⟧
+        let mut map = self.per_peer.lock().unwrap(); ⟦d2⟧
+        *map.entry(peer.to_string()).or_insert(0) += 1;
+    }
+
+    /// Sends a snapshot to the monitoring collector.
+    pub fn push_snapshot(&self, collector: &mut TcpStream) -> std::io::Result<()> {
+        let map = self.per_peer.lock().unwrap();
+        for (peer, n) in map.iter() {
+            writeln!(collector, "{peer} {n}")?; ⟦a⟧
+        }
+        Ok(())
+    }
+
+    pub fn record_error(&self, peer: &str, err: &str) {
+        let mut last = self.last_error.lock().unwrap();
+        let map = self.per_peer.lock().unwrap(); ⟦b⟧
+        *last = Some(format!("{peer} ({} msgs): {err}", map.get(peer).unwrap_or(&0)));
+    }
+
+    pub fn status(&self) -> String {
+        let map = self.per_peer.lock().unwrap();
+        let last = self.last_error.lock().unwrap(); ⟦b⟧
+        format!("{} peers, last error: {:?}", map.len(), *last)
+    }
}

+pub fn start_reporter(m: Arc<Metrics>, mut collector: TcpStream) {
+    thread::spawn(move || loop {
+        let _ = m.push_snapshot(&mut collector); ⟦c⟧
+        thread::sleep(Duration::from_secs(15));
+    });
+}
`,
          issues: [
            {
              id: 'a', tag: 'hang', title: 'Network writes while holding the lock every message needs',
              why: '«push_snapshot» writes to a TCP socket while holding «per_peer». When the collector across the VPN is slow or dead, the write can block for minutes, and every connection thread calling «record» waits behind it. Message handling stops because of monitoring.',
              fix: 'Copy the snapshot under the lock and release it before writing: «let snapshot = self.per_peer.lock().unwrap().clone();», then write from «snapshot». A write timeout on the socket helps as well.',
            },
            {
              id: 'b', tag: 'hang', title: 'Two locks taken in opposite orders: a deadlock',
              why: '«record_error» locks «last_error» then «per_peer»; «status» locks «per_peer» then «last_error». When an error is recorded while the health endpoint is being read, each thread holds one lock and waits forever for the other. The health endpoint hangs, and so does every thread that needs either lock.',
              fix: 'Take the locks in one order everywhere, or avoid holding both: read what you need from one lock, release it, then take the other.',
            },
            {
              id: 'c', tag: 'swallow', title: 'The reporter fails silently, forever',
              why: 'If the collector connection drops, every «push_snapshot» fails and «let _ =» discards the error. The dashboards flatline and nothing says why. The spawned thread\'s handle is also dropped, so a panic there would vanish too.',
              fix: 'Log the error, and reconnect on failure. Keep the «JoinHandle» (or report liveness) so a dead reporter is visible.',
            },
          ],
          decoys: [
            { id: 'd1', why: '«Relaxed» is the right ordering for a statistics counter: nothing else depends on the order in which increments become visible.' },
            { id: 'd2', why: 'Holding the lock only for a map update is short and fine. «lock().unwrap()» is the accepted idiom.' },
          ],
          hints: [
            'Two ways to hang and one silence.',
            'For each lock: what happens while it is held? Is anything slow in there?',
            'List the order in which each method takes the two mutexes.',
          ],
          solution: {
            fixed: R`
use std::collections::HashMap;
use std::io::Write;
use std::net::TcpStream;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub struct Metrics {
    pub received: AtomicU64,
    pub per_peer: Mutex<HashMap<String, u64>>,
    pub last_error: Mutex<Option<String>>,
}

impl Metrics {
    pub fn record(&self, peer: &str) {
        self.received.fetch_add(1, Ordering::Relaxed);
        let mut map = self.per_peer.lock().unwrap();
        *map.entry(peer.to_string()).or_insert(0) += 1;
    }

    /// Sends a snapshot to the monitoring collector.
    pub fn push_snapshot(&self, collector: &mut TcpStream) -> std::io::Result<()> {
        let snapshot = self.per_peer.lock().unwrap().clone();
        for (peer, n) in snapshot.iter() {
            writeln!(collector, "{peer} {n}")?;
        }
        Ok(())
    }

    pub fn record_error(&self, peer: &str, err: &str) {
        let n = *self.per_peer.lock().unwrap().get(peer).unwrap_or(&0);
        *self.last_error.lock().unwrap() = Some(format!("{peer} ({n} msgs): {err}"));
    }

    pub fn status(&self) -> String {
        let peers = self.per_peer.lock().unwrap().len();
        let last = self.last_error.lock().unwrap().clone();
        format!("{peers} peers, last error: {last:?}")
    }
}

pub fn start_reporter(m: Arc<Metrics>, mut collector: TcpStream) -> thread::JoinHandle<()> {
    thread::spawn(move || loop {
        if let Err(e) = m.push_snapshot(&mut collector) {
            eprintln!("metrics push failed: {e}");
        }
        thread::sleep(Duration::from_secs(15));
    })
}
`,
            talk: 'push_snapshot held the per-peer lock during a network write, so a slow collector stalled every message. record_error and status took the two locks in opposite orders, which deadlocks. And the reporter threw away every push error.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
