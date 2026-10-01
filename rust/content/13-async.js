(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'async', title: 'Async and Tokio', short: 'Async',
    blurb: 'Futures are lazy like a «Mono», «tokio::spawn» and where its failures go, the cardinal sin of blocking the runtime, and what happens to locks across «.await».',
    items: [
      {
        lesson: 'as-lazy', title: 'Futures are lazy, like a «Mono» before subscribe', mins: 7,
        remember: 'Calling an «async fn» only builds a future; nothing runs until something «.await»s it or spawns it, exactly like a «Mono» with no subscriber.',
        cue: 'An async call with no «.await» and no spawn → it never runs; rustc warns that futures do nothing unless awaited',
        body: R`
          You know this model already from Reactor. Rust's version reads top to bottom instead of as a chain of operators.

          :::vs The same laziness
          ~~~java
          Mono<Ack> send(Frame f) { return Mono.fromCallable(() -> write(f)); }

          send(frame);                  // builds a Mono: nothing is written
          send(frame).block();          // subscribes and waits
          send(frame).subscribe();      // fire and forget
          ~~~
          ~~~cpp
          // std::async is eager: the work starts at once, on a thread
          auto fut = std::async(std::launch::async, [&] { return write(frame); });
          Ack ack = fut.get();          // waits for it

          // C++20 coroutines can be lazy like Rust futures, but the
          // standard library ships no task type or runtime to drive them.
          ~~~
          ~~~rust
          async fn send(f: Frame) -> Ack { write(f).await }

          send(frame);                  // builds a future: nothing is written
          send(frame).await;            // runs it and waits (inside async code)
          tokio::spawn(send(frame));    // fire and forget, as its own task
          ~~~
          :::

          ~~~rust !run
          async fn send(id: u32) -> u32 {
              println!("sending {id}");
              id
          }

          #[tokio::main]
          async fn main() {
              let pending = send(1);
              send(2);
              println!("nothing sent yet");
              let acked = pending.await;
              println!("acked {acked}");
          }
          ~~~

          «send(2)» never ran, and the compiler warned about it (open **Compiler warnings**). «send(1)» ran only when it was awaited.

          @stop

          ## What the runtime is

          «#[tokio::main]» starts Tokio: a small pool of worker threads (one per CPU core by default) plus an event loop for sockets and timers. That is Reactor's schedulers and Netty's event loop in one.

          At each «.await», if the result is not ready yet (bytes have not arrived, the timer has not fired), the task gives its thread to other tasks. That is how thousands of connections share a few threads. The code **between** two «.await»s runs on one thread without pausing.

          ## Concurrency is explicit

          @predict 0

          Awaiting one thing after another is sequential, like «concatMap». «tokio::join!» runs futures at the same time and waits for all of them, like «Mono.zip». (The «start_paused» line swaps in a test clock that jumps forward, so the timings print exactly.)
        `,
        predict: [
          {
            q: 'Two 200 ms calls, awaited one after the other, then joined. What prints?',
            code: 'use std::time::Duration;\nuse tokio::time::{sleep, Instant};\n\nasync fn call(ms: u64) {\n    sleep(Duration::from_millis(ms)).await;\n}\n\n#[tokio::main(flavor = "current_thread", start_paused = true)]\nasync fn main() {\n    let t = Instant::now();\n    call(200).await;\n    call(200).await;\n    println!("one after the other: {} ms", t.elapsed().as_millis());\n\n    let t = Instant::now();\n    tokio::join!(call(200), call(200));\n    println!("together: {} ms", t.elapsed().as_millis());\n}',
            options: ['one after the other: 200 ms\ntogether: 200 ms', 'one after the other: 400 ms\ntogether: 200 ms', 'one after the other: 400 ms\ntogether: 400 ms'],
            answer: 1,
            why: 'Each «.await» waits for its future to finish before the next line starts, so the first pair takes 400 ms. «join!» polls both futures together on the same thread, so their waits overlap: 200 ms. No extra threads were needed.',
          },
        ],
      },
      {
        lesson: 'as-spawn', title: '«tokio::spawn»: tasks, and where their failures go', mins: 7, hunts: ['swallow', 'lost'],
        remember: '«tokio::spawn» runs a future as its own task and returns a «JoinHandle»; if nobody awaits that handle, the task\'s errors and panics disappear.',
        cue: '«tokio::spawn(...)» whose handle is dropped or never checked → who notices when this task fails or panics?',
        body: R`
          ~~~rust !run
          #[tokio::main]
          async fn main() {
              let reader = tokio::spawn(async {
                  let frames: Vec<u8> = Vec::new();
                  frames[0]
              });
              tokio::spawn(async {
                  Err::<(), String>("peer closed the connection".into())
              });
              tokio::time::sleep(std::time::Duration::from_millis(50)).await;
              println!("main still running");
              match reader.await {
                  Ok(v) => println!("reader returned {v}"),
                  Err(e) => println!("reader task failed: panicked = {}", e.is_panic()),
              }
          }
          ~~~

          Two tasks failed. The panic shows up only because main awaited «reader» (plus the panic text on stderr). The second task's «Err» vanished completely: nobody looked at its handle. This is Reactor's «subscribe()» with no error consumer.

          ## A dropped handle does not stop the task

          @predict 0

          Dropping a **handle** detaches the task: it carries on unsupervised. Dropping a **future** that was never spawned cancels it (the Channels module). «handle.abort()» is how you actually stop a spawned task.

          @stop

          ## Supervising tasks

          - Keep the handles. Await them, and log or react to «Err».
          - For many tasks, «JoinSet» collects them: «while let Some(res) = set.join_next().await { ... }» sees each one finish or fail.
          - When «main» returns, the runtime shuts down and **every unfinished task is dropped mid-work**. A "flush the buffer" task that is still running at that moment never completes.

          :::pitfall For every «tokio::spawn»
          1. Where does the handle go? Dropped means failures are invisible.
          2. What happens to this task at shutdown? Is there work in flight that would be lost?
          :::
        `,
        predict: [
          {
            q: 'The handle is dropped straight away. What prints?',
            code: '#[tokio::main(flavor = "current_thread", start_paused = true)]\nasync fn main() {\n    let h = tokio::spawn(async {\n        tokio::time::sleep(std::time::Duration::from_millis(10)).await;\n        println!("task finished");\n    });\n    drop(h);\n    tokio::time::sleep(std::time::Duration::from_millis(50)).await;\n    println!("main done");\n}',
            options: ['main done', 'task finished\nmain done', 'Compile error'],
            answer: 1,
            why: 'Dropping a «JoinHandle» detaches the task; it does not cancel it. The task finishes on its own, and nobody could have heard about it if it had failed.',
          },
        ],
      },
      {
        lesson: 'as-blocking', title: 'Never block the runtime', mins: 8, hunts: ['block'],
        remember: 'A Tokio worker thread runs many tasks by switching at each «.await»; blocking it (a sleep, file I/O, a long loop, a slow std lock) freezes every task waiting for that thread.',
        cue: '«std::thread::sleep», «std::fs», a blocking client or heavy CPU inside an «async fn» → «tokio::time::sleep», «tokio::fs», or «tokio::task::spawn_blocking»',
        body: R`
          In Reactor you would never call a blocking method on an event-loop thread; BlockHound exists to catch that. Rust has no BlockHound, and the compiler happily accepts blocking calls inside «async fn». It is the most common async bug.

          ~~~rust !run
          use std::time::{Duration, Instant};

          #[tokio::main(flavor = "current_thread")]
          async fn main() {
              let start = Instant::now();
              let heartbeat = tokio::spawn(async move {
                  for _ in 0..3 {
                      tokio::time::sleep(Duration::from_millis(100)).await;
                      println!("heartbeat at {} ms", start.elapsed().as_millis() / 100 * 100);
                  }
              });
              tokio::task::yield_now().await;
              std::thread::sleep(Duration::from_millis(500)); // blocks the only worker thread
              heartbeat.await.unwrap();
          }
          ~~~

          The heartbeat asked to wake at 100 ms and woke at about 500: the blocking sleep held the only thread, so no other task could run. On a multi-threaded runtime the damage is spread out and harder to see, but every blocked worker is one fewer for everything else.

          ~~~rust !run
          use std::time::{Duration, Instant};

          #[tokio::main(flavor = "current_thread")]
          async fn main() {
              let start = Instant::now();
              let heartbeat = tokio::spawn(async move {
                  for _ in 0..3 {
                      tokio::time::sleep(Duration::from_millis(100)).await;
                      println!("heartbeat at {} ms", start.elapsed().as_millis() / 100 * 100);
                  }
              });
              tokio::task::yield_now().await;
              tokio::time::sleep(Duration::from_millis(500)).await; // yields the thread while waiting
              heartbeat.await.unwrap();
          }
          ~~~

          @stop

          ## The replacements

          | Blocking | Async-friendly |
          |---|---|
          | «std::thread::sleep» | «tokio::time::sleep(..).await» |
          | «std::fs::read», «write» | «tokio::fs::read», «write» (or «spawn_blocking») |
          | «std::net::TcpStream» | «tokio::net::TcpStream» |
          | a std «Mutex» held briefly, no await inside | fine |
          | a CPU-heavy loop, a blocking library (a database driver, a disk flush) | «tokio::task::spawn_blocking(...)» |

          ~~~rust !run
          #[tokio::main]
          async fn main() {
              let digest = tokio::task::spawn_blocking(|| {
                  (0..5_000_000u64).fold(0u64, |acc, x| acc.wrapping_add(x * x))
              })
              .await
              .unwrap();
              println!("{digest}");
          }
          ~~~

          «spawn_blocking» moves the work to a separate pool of threads meant for blocking, and gives back a handle you can await.
        `,
      },
      {
        lesson: 'as-locks-await', title: 'Locks and «.await»', mins: 6, hunts: ['hang'],
        remember: 'A std «Mutex» guard must be dropped before the next «.await» (the compiler enforces this in spawned tasks); a tokio «Mutex» may be held across «.await», which compiles and can make everyone wait for the network.',
        cue: '«.lock().await» followed by more «.await»s while the guard lives → every other task wanting that lock now waits for the network too',
        body: R`
          ## std «Mutex»: the compiler has your back

          The Shared state module showed it: a std guard held across an «.await» in a spawned task does not compile. The fix is to finish with the lock before awaiting:

          ~~~rust !run
          use std::sync::{Arc, Mutex};

          #[tokio::main]
          async fn main() {
              let state = Arc::new(Mutex::new(0));
              let s = Arc::clone(&state);
              tokio::spawn(async move {
                  {
                      let mut guard = s.lock().unwrap();
                      *guard += 1;
                  } // guard dropped here, before the await
                  tokio::time::sleep(std::time::Duration::from_millis(1)).await;
              })
              .await
              .unwrap();
              println!("{}", state.lock().unwrap());
          }
          ~~~

          ## tokio «Mutex»: allowed, and dangerous

          «tokio::sync::Mutex» is an async lock: «lock().await» waits without blocking the thread, and the guard may be held across «.await». It exists for things like "one writer on this socket at a time". The danger is holding it while waiting on something slow:

          @predict 0

          @stop

          :::pitfall Holding an async lock across a slow await
          Look at what the guarded section awaits. A lock around "write a frame and wait for the ACK" makes every sender wait for the slowest peer. Better shapes: take what you need and release before the slow await, or give the connection its own task and send it work through a channel (the Channels module).
          :::
        `,
        predict: [
          {
            q: 'One task holds a tokio lock while a peer takes 30 s to answer. When does the second task get the lock?',
            code: 'use std::sync::Arc;\nuse std::time::Duration;\nuse tokio::sync::Mutex;\nuse tokio::time::{sleep, Instant};\n\n#[tokio::main(flavor = "current_thread", start_paused = true)]\nasync fn main() {\n    let conn = Arc::new(Mutex::new(0u32));\n    let start = Instant::now();\n    let c = Arc::clone(&conn);\n    let slow = tokio::spawn(async move {\n        let mut sent = c.lock().await;\n        sleep(Duration::from_secs(30)).await;\n        *sent += 1;\n    });\n    tokio::task::yield_now().await;\n    let c = Arc::clone(&conn);\n    let quick = tokio::spawn(async move {\n        let _sent = c.lock().await;\n        println!("quick task got the lock after {} s", start.elapsed().as_secs());\n    });\n    slow.await.unwrap();\n    quick.await.unwrap();\n}',
            options: ['quick task got the lock after 0 s', 'quick task got the lock after 30 s', 'Compile error', 'It hangs'],
            answer: 1,
            why: 'The slow task holds the guard across its 30-second await, and the quick task queues behind it. It compiles, because tokio\'s guard is allowed across «.await». Nothing crashed; everything just got as slow as the slowest peer.',
          },
        ],
      },
      {
        exercise: {
          id: 'as-fix-blocking', title: 'Make the status checks run at the same time', kind: 'fix', mins: 10, diff: 'medium', topics: ['async'],
          statement: R`
            «check_all» spawns one task per peer so the checks run concurrently. But five peers take a whole second instead of 200 ms. Press **Run**: the concurrency test fails.

            Find what freezes the runtime and fix it. Each check must still take about 200 ms: do not remove the wait, make it the right kind of wait.
          `,
          starter: R`
use std::time::Duration;

/// Pretends to ask a peer for its status. Takes about 200 ms.
pub async fn fetch_status(peer: &str) -> String {
    std::thread::sleep(Duration::from_millis(200));
    format!("{peer}: ok")
}

/// Checks every peer at the same time.
pub async fn check_all(peers: &[&str]) -> Vec<String> {
    let mut handles = Vec::new();
    for p in peers {
        let p = p.to_string();
        handles.push(tokio::spawn(async move { fetch_status(&p).await }));
    }
    let mut out = Vec::new();
    for h in handles {
        out.push(h.await.unwrap());
    }
    out
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'every status, in order', ex: true, async: true, code: 'assert_eq!(check_all(&["a", "b"]).await, vec!["a: ok", "b: ok"]);' },
            { name: 'five peers take about as long as one', ex: true, async: true, code: 'let t = std::time::Instant::now();\ncheck_all(&["a", "b", "c", "d", "e"]).await;\nassert!(t.elapsed() < Duration::from_millis(600), "took {:?}: the checks ran one after another", t.elapsed());' },
            { name: 'one check still takes about 200 ms', async: true, code: 'let t = std::time::Instant::now();\nfetch_status("x").await;\nassert!(t.elapsed() >= Duration::from_millis(190), "the wait was removed instead of fixed");' },
          ],
          hints: [
            'The tests run on a single-threaded runtime, like the heartbeat example. What does «std::thread::sleep» do to it?',
            'Swap in the async sleep. Remember it only waits when awaited.',
            '«tokio::time::sleep(Duration::from_millis(200)).await;»',
          ],
          solution: {
            rust: R`
use std::time::Duration;

/// Pretends to ask a peer for its status. Takes about 200 ms.
pub async fn fetch_status(peer: &str) -> String {
    tokio::time::sleep(Duration::from_millis(200)).await;
    format!("{peer}: ok")
}

/// Checks every peer at the same time.
pub async fn check_all(peers: &[&str]) -> Vec<String> {
    let mut handles = Vec::new();
    for p in peers {
        let p = p.to_string();
        handles.push(tokio::spawn(async move { fetch_status(&p).await }));
    }
    let mut out = Vec::new();
    for h in handles {
        out.push(h.await.unwrap());
    }
    out
}
`,
            why: R`
              - «std::thread::sleep» holds the worker thread for the whole 200 ms. On one thread, the five "concurrent" tasks therefore ran one after another.
              - «tokio::time::sleep(...).await» hands the thread back while waiting, so all five waits overlap.
              - A real blocking call (a synchronous HTTP client, a disk flush) cannot simply be swapped for an async one; wrap it in «tokio::task::spawn_blocking».
              - The «.unwrap()» on each handle is acceptable here: it re-raises a panic from a check task instead of hiding it.
            `,
            talk: 'std::thread::sleep blocked the only worker thread, so the spawned checks ran one after another. The async sleep yields the thread while it waits, so the checks overlap; truly blocking work would go in spawn_blocking.',
          },
          wrong: [
            { name: 'removes the wait', rust: R`
use std::time::Duration;
pub async fn fetch_status(peer: &str) -> String { let _ = Duration::from_millis(200); format!("{peer}: ok") }
pub async fn check_all(peers: &[&str]) -> Vec<String> {
    let mut out = Vec::new();
    for p in peers { out.push(fetch_status(p).await); }
    out
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'as-review-poller', title: 'Find the bugs: a peer status poller', kind: 'review', mins: 14, diff: 'medium', topics: ['async'],
          file: 'src/health.rs',
          statement: R`
            **The change:** A background task checks every peer by opening a TCP connection every 10 seconds and records whether it is up. «write_report» writes the status to a file for the ops dashboard.

            Context: this runs inside the service's Tokio runtime, next to the tasks that move messages. Some peers sit behind VPNs and silently drop packets when the tunnel is down.
          `,
          code: R`
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::sync::Mutex;

pub struct Status {
    pub up: HashMap<String, bool>,
}

+pub async fn poll_forever(peers: Vec<String>, status: Arc<Mutex<Status>>) {
+    loop {
+        for peer in &peers {
+            let up = TcpStream::connect(peer.as_str()).await.is_ok(); ⟦a⟧
+            status.lock().await.up.insert(peer.clone(), up); ⟦d1⟧
+        }
+        std::thread::sleep(Duration::from_secs(10)); ⟦b⟧
+    }
+}
+
+pub fn start(peers: Vec<String>, status: Arc<Mutex<Status>>) {
+    tokio::spawn(poll_forever(peers, status)); ⟦c⟧
+}
+
+pub async fn write_report(status: Arc<Mutex<Status>>, path: &str) -> std::io::Result<()> {
+    let s = status.lock().await;
+    let text: String = s.up.iter().map(|(p, up)| format!("{p} {up}\n")).collect();
+    std::fs::write(path, text) ⟦e⟧
+}
`,
          issues: [
            {
              id: 'a', tag: 'hang', title: 'A silent peer stalls every check behind it',
              why: 'When a VPN drops packets, «connect» gets no answer at all and waits for the operating system to give up, which can take minutes. The loop checks peers one at a time, so every other peer\'s status goes stale meanwhile.',
              fix: 'Bound it: «tokio::time::timeout(Duration::from_secs(3), TcpStream::connect(..)).await», and count a timeout as down. Checking peers concurrently («JoinSet») also stops one peer delaying the rest.',
            },
            {
              id: 'b', tag: 'block', title: 'A 10-second blocking sleep inside the runtime',
              why: '«std::thread::sleep» holds a Tokio worker thread for 10 seconds every round. Every message-moving task scheduled on that thread freezes with it.',
              fix: '«tokio::time::sleep(Duration::from_secs(10)).await», or better a «tokio::time::interval».',
              demoAsync: true,
              demo: 'let status = Arc::new(Mutex::new(Status { up: HashMap::new() }));\ntokio::spawn(poll_forever(vec![], Arc::clone(&status)));\nlet t = std::time::Instant::now();\ntokio::time::sleep(Duration::from_millis(10)).await;\nassert!(t.elapsed() < Duration::from_secs(1), "the poller froze the runtime for {:?}", t.elapsed());',
            },
            {
              id: 'c', tag: 'swallow', title: 'Nobody would know the poller died',
              why: 'The handle is thrown away. If the task panics or exits, the status map keeps showing the last results forever, so the dashboard says "up" for peers nobody is checking any more.',
              fix: 'Return the «JoinHandle» and supervise it (log and restart on exit), or record a "last checked" time per peer so staleness is visible.',
            },
            {
              id: 'e', tag: 'block', title: 'Blocking file write while holding the status lock',
              why: '«std::fs::write» blocks the worker thread on disk I/O, and it happens while the guard «s» is still alive, so the poller cannot record results until the disk answers.',
              fix: 'Build the text, drop the guard (end its scope), then «tokio::fs::write(path, text).await».',
            },
          ],
          decoys: [
            { id: 'd1', why: 'The tokio lock is taken, used for one insert and dropped at the end of the statement. Nothing is awaited while it is held.' },
          ],
          hints: [
            'Two ways to block the runtime, one way to wait forever, one silence.',
            'Look for anything from «std::» doing waiting or I/O inside an «async fn».',
            'What bounds how long «connect» can take? And what happens to the task\'s handle?',
          ],
          solution: {
            fixed: R`
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::{interval, timeout};

pub struct Status {
    pub up: HashMap<String, bool>,
}

pub async fn poll_forever(peers: Vec<String>, status: Arc<Mutex<Status>>) {
    let mut tick = interval(Duration::from_secs(10));
    loop {
        tick.tick().await;
        for peer in &peers {
            let up = matches!(timeout(Duration::from_secs(3), TcpStream::connect(peer.as_str())).await, Ok(Ok(_)));
            status.lock().await.up.insert(peer.clone(), up);
        }
    }
}

pub fn start(peers: Vec<String>, status: Arc<Mutex<Status>>) -> JoinHandle<()> {
    tokio::spawn(poll_forever(peers, status))
}

pub async fn write_report(status: Arc<Mutex<Status>>, path: &str) -> std::io::Result<()> {
    let text: String = {
        let s = status.lock().await;
        s.up.iter().map(|(p, up)| format!("{p} {up}\n")).collect()
    };
    tokio::fs::write(path, text).await
}
`,
            talk: 'connect had no timeout, so a silent VPN peer stalled every check. std::thread::sleep and std::fs::write blocked the runtime, the second one while holding the status lock. And the poller\'s handle was dropped, so a dead poller would leave stale "up" results on the dashboard.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
