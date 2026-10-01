(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'chan', title: 'Channels, «select!» and cancellation', short: 'Select',
    blurb: 'Bounded channels as backpressure, which channel fits which job, what «select!» silently drops, the branch that switches itself off, and shutting down without losing work.',
    items: [
      {
        lesson: 'ch-mpsc', title: 'Channels: bounded means backpressure', mins: 7, hunts: ['unbounded', 'hang', 'swallow'],
        remember: 'A bounded «mpsc::channel(n)» makes senders wait when it is full, which is backpressure; an «unbounded_channel» never waits, so a slow consumer means memory grows until the process dies.',
        cue: '«unbounded_channel()», or a bound in the millions → what happens when the consumer is slower than the producer?',
        body: R`
          A channel is a queue between tasks: Java's «BlockingQueue», Reactor's «Sinks». The capacity is the whole story:

          ~~~rust !run
          use tokio::sync::mpsc;
          use tokio::time::{sleep, Duration, Instant};

          #[tokio::main(flavor = "current_thread", start_paused = true)]
          async fn main() {
              let (tx, mut rx) = mpsc::channel::<u32>(2);
              let start = Instant::now();
              let consumer = tokio::spawn(async move {
                  while let Some(n) = rx.recv().await {
                      sleep(Duration::from_millis(100)).await; // a slow downstream
                      println!("delivered {n} at {} ms", start.elapsed().as_millis());
                  }
              });
              for n in 1..=5 {
                  tx.send(n).await.unwrap();
                  println!("queued {n} at {} ms", start.elapsed().as_millis());
              }
              drop(tx);
              consumer.await.unwrap();
          }
          ~~~

          Once two messages are waiting, «send(..).await» waits for room: the producer slows to the consumer's pace. That is backpressure. With «unbounded_channel()» every send returns at once, and a burst the consumer cannot keep up with sits in memory until the process runs out.

          @stop

          ## How a receive loop ends

          «while let Some(x) = rx.recv().await» ends when **every** sender has been dropped. One forgotten sender keeps the loop waiting forever:

          @predict 0

          ## When the receiver is gone

          «tx.send(x).await» returns «Err» when the receiving task has died. «let _ = tx.send(x).await» throws that away, and the producer carries on working for nobody.

          :::pitfall For every channel
          1. Bounded or not, and what happens when it is full?
          2. Which senders keep the receive loop alive, and are they dropped at shutdown?
          3. Is a failed «send» noticed?
          :::
        `,
        predict: [
          {
            q: 'A worker sends three numbers. Does the sum print?',
            code: 'use tokio::sync::mpsc;\n\n#[tokio::main]\nasync fn main() {\n    let (tx, mut rx) = mpsc::channel::<u32>(8);\n    let worker_tx = tx.clone();\n    tokio::spawn(async move {\n        for n in 1..=3 {\n            worker_tx.send(n).await.unwrap();\n        }\n    });\n    let mut total = 0;\n    while let Some(n) = rx.recv().await {\n        total += n;\n    }\n    println!("{total}");\n}',
            options: ['6', 'It hangs', 'It panics', '0'],
            answer: 1,
            why: 'The worker\'s sender is dropped when it finishes, but the original «tx» is still alive in main. «recv()» therefore never returns «None», and the loop waits forever. «drop(tx)» before the loop fixes it.',
          },
        ],
      },
      {
        lesson: 'ch-kinds', title: 'oneshot, watch, broadcast: one channel per job', mins: 6, hunts: ['lost'],
        remember: 'mpsc is a work queue, oneshot is a single reply, watch holds only the latest value (config, a stop signal), and broadcast gives every subscriber every message, unless it falls behind.',
        cue: '«broadcast» with a slow subscriber → it skips messages («RecvError::Lagged»); is losing them acceptable for this data?',
        body: R`
          | Channel | Shape | Typical use | Java or Reactor |
          |---|---|---|---|
          | «mpsc» | many senders, one receiver, a queue | work for a task | «BlockingQueue», «Sinks.many().unicast()» |
          | «oneshot» | one value, once | the reply to one request | «CompletableFuture» |
          | «watch» | only the latest value | config reload, a stop signal | a volatile field plus notify |
          | «broadcast» | every receiver gets every message, up to a capacity | fan-out events | «Sinks.many().multicast()» |

          ## watch as a stop signal

          ~~~rust !run
          use tokio::sync::watch;
          use tokio::time::{sleep, Duration};

          #[tokio::main(flavor = "current_thread", start_paused = true)]
          async fn main() {
              let (stop_tx, mut stop_rx) = watch::channel(false);
              let worker = tokio::spawn(async move {
                  let mut rounds = 0;
                  loop {
                      tokio::select! {
                          _ = sleep(Duration::from_millis(100)) => rounds += 1,
                          _ = stop_rx.changed() => break,
                      }
                  }
                  rounds
              });
              sleep(Duration::from_millis(350)).await;
              stop_tx.send(true).unwrap();
              println!("worker did {} rounds", worker.await.unwrap());
          }
          ~~~

          Network servers use exactly this shape to stop listeners and connection tasks. «select!» is the next lesson.

          @stop

          ## broadcast forgets slow subscribers' messages

          ~~~rust !run
          use tokio::sync::broadcast;

          #[tokio::main]
          async fn main() {
              let (tx, mut slow) = broadcast::channel::<u32>(2);
              for n in 1..=5 {
                  tx.send(n).unwrap();
              }
              drop(tx);
              loop {
                  match slow.recv().await {
                      Ok(n) => println!("got {n}"),
                      Err(broadcast::error::RecvError::Lagged(missed)) => println!("missed {missed} messages"),
                      Err(broadcast::error::RecvError::Closed) => break,
                  }
              }
          }
          ~~~

          The channel keeps only the last two messages. A subscriber that fell behind gets «Lagged» with a count, then carries on from what is left. Fine for "latest status" events; not fine for messages that must be delivered.
        `,
      },
      {
        lesson: 'ch-select', title: '«select!»: race futures, drop the losers', mins: 9, hunts: ['lost', 'hang'],
        remember: '«select!» waits on several futures, runs the arm of the first to finish, and drops the others mid-flight; anything those dropped futures had half done is lost.',
        cue: '«select!» in a loop → for each branch: if it loses the race, is anything lost? Can its pattern fail to match and switch the branch off?',
        body: R`
          «select!» is Reactor's «Mono.firstWithSignal»: the first future to finish wins and the others are cancelled.

          ~~~rust !run
          use tokio::sync::mpsc;
          use tokio::time::{sleep, Duration};

          #[tokio::main(flavor = "current_thread", start_paused = true)]
          async fn main() {
              let (tx, mut rx) = mpsc::channel::<&str>(4);
              tokio::spawn(async move {
                  sleep(Duration::from_secs(5)).await;
                  if tx.send("ADT^A01").await.is_err() {
                      println!("receiver gone");
                  }
              });
              tokio::select! {
                  Some(msg) = rx.recv() => println!("got {msg}"),
                  _ = sleep(Duration::from_secs(2)) => println!("nothing for 2 s, checking the connection"),
              }
          }
          ~~~

          ## Cancelled means dropped, mid-flight

          The losing future is dropped at whatever «.await» it had reached. If it had already done part of its job, that part is gone:

          @predict 0

          Some futures are **cancel-safe**: dropping them loses nothing. Tokio's docs list them; the ones you will meet:

          | Safe to race in «select!» | Not safe: partial work is lost |
          |---|---|
          | «rx.recv()», «watch.changed()», «listener.accept()» | «read_exact», «read_to_end», «read_to_string» |
          | «stream.read(..)», «read_buf(..)», «sleep», «interval.tick()» | «write_all» (some bytes may already be sent) |

          The fix is to keep partial state **outside** the raced future: read with «read_buf» into a buffer that lives across loop iterations, then cut frames out of the buffer (the Networking module).

          @stop

          ## The branch that switches itself off

          A branch can use a pattern: «Some(msg) = rx.recv()». If the future finishes with a value that **does not match**, the branch is disabled for the rest of that «select!», and «select!» keeps waiting on the others.

          @predict 1

          The fix is to take the result whole and «match» on it inside the arm:

          ~~~rust !run
          use tokio::sync::oneshot;

          async fn accept(attempt: u32) -> Result<u32, String> {
              if attempt == 0 { Err("too many open files".into()) } else { Ok(attempt) }
          }

          #[tokio::main]
          async fn main() {
              let (_stop_tx, mut stop_rx) = oneshot::channel::<()>();
              let mut attempt = 0;
              loop {
                  tokio::select! {
                      res = accept(attempt) => match res {
                          Ok(conn) => {
                              println!("accepted connection {conn}");
                              break;
                          }
                          Err(e) => println!("accept failed, still listening: {e}"),
                      },
                      _ = &mut stop_rx => {
                          println!("stopping");
                          break;
                      }
                  }
                  attempt += 1;
              }
          }
          ~~~

          :::pitfall «Ok(..) =» or «Some(..) =» in a «select!» branch
          Think through what happens when that future returns the other variant. «Some(x) = rx.recv()» is the normal idiom (the branch switches off once the channel closes, which is usually what you want). «Ok(x) = listener.accept()» is a trap: one accept error and the server stops accepting, silently, forever.
          :::
        `,
        predict: [
          {
            q: 'A frame arrives in two pieces, and a 100 ms tick wins the first race. What does the next read get?',
            code: 'use tokio::io::{duplex, AsyncReadExt, AsyncWriteExt};\nuse tokio::time::{sleep, Duration};\n\n#[tokio::main(flavor = "current_thread", start_paused = true)]\nasync fn main() {\n    let (mut peer, mut conn) = duplex(64);\n    tokio::spawn(async move {\n        peer.write_all(b"MSH").await.unwrap();\n        sleep(Duration::from_millis(200)).await;\n        peer.write_all(b"|1").await.unwrap();\n        peer.write_all(b"MSH|2").await.unwrap();\n    });\n\n    let mut frame = [0u8; 5];\n    tokio::select! {\n        _ = conn.read_exact(&mut frame) => println!("frame: {}", String::from_utf8_lossy(&frame)),\n        _ = sleep(Duration::from_millis(100)) => println!("tick: read_exact was dropped"),\n    }\n    conn.read_exact(&mut frame).await.unwrap();\n    println!("next read: {}", String::from_utf8_lossy(&frame));\n}',
            options: ['tick: read_exact was dropped\nnext read: MSH|1', 'tick: read_exact was dropped\nnext read: |1MSH', 'frame: MSH|1\nnext read: MSH|2'],
            answer: 1,
            why: 'The first «read_exact» had already taken «MSH» off the connection when the tick won. Dropping it threw those bytes away, so the stream is now out of step: the next read starts mid-frame. Nothing crashed, and every later frame is misread.',
          },
          {
            q: 'The first accept fails. What happens?',
            code: 'use tokio::sync::oneshot;\n\nasync fn accept(attempt: u32) -> Result<u32, String> {\n    if attempt == 0 { Err("too many open files".into()) } else { Ok(attempt) }\n}\n\n#[tokio::main]\nasync fn main() {\n    let (_stop_tx, mut stop_rx) = oneshot::channel::<()>();\n    let mut attempt = 0;\n    loop {\n        tokio::select! {\n            Ok(conn) = accept(attempt) => {\n                println!("accepted connection {conn}");\n                break;\n            }\n            _ = &mut stop_rx => {\n                println!("stopping");\n                break;\n            }\n        }\n        attempt += 1;\n    }\n}',
            options: ['accepted connection 1', 'stopping', 'It hangs', 'It panics'],
            answer: 2,
            why: '«accept» returned «Err», which does not match «Ok(conn)», so that branch switched off. «select!» then waits only for the stop signal, which never comes, and the loop never goes round again to retry. A server with this bug is up, bound, and silently accepting nothing, until someone restarts it.',
          },
        ],
      },
      {
        lesson: 'ch-shutdown', title: 'Timeouts and graceful shutdown', mins: 7, hunts: ['hang', 'lost'],
        remember: 'Every await on the network needs a bound («tokio::time::timeout»), and every long-running task needs a way to be told to stop and a chance to finish what is in flight.',
        cue: 'An «.await» on a socket, a lock or a reply with no timeout → what if the other side never answers?',
        body: R`
          ## Put a bound on it

          ~~~rust !run
          use tokio::time::{sleep, timeout, Duration};

          async fn wait_for_ack() -> &'static str {
              sleep(Duration::from_secs(600)).await; // a peer that never answers
              "AA"
          }

          #[tokio::main(flavor = "current_thread", start_paused = true)]
          async fn main() {
              match timeout(Duration::from_secs(45), wait_for_ack()).await {
                  Ok(ack) => println!("ack {ack}"),
                  Err(_) => println!("no ACK within 45 s: mark the message for retry"),
              }
          }
          ~~~

          «timeout» wraps any future and gives back «Err(Elapsed)» if it takes too long. The inner future is dropped at that point, so the cancel-safety question from the last lesson applies to it too.

          @stop

          ## Graceful shutdown

          The shape to look for: a stop signal every task listens to, each task finishing its in-flight work before it exits, and something that waits for all of them.

          ~~~rust !run
          use tokio::task::JoinSet;
          use tokio::time::{sleep, Duration};
          use tokio_util::sync::CancellationToken;

          #[tokio::main(flavor = "current_thread", start_paused = true)]
          async fn main() {
              let stop = CancellationToken::new();
              let mut tasks = JoinSet::new();
              for id in 0..3 {
                  let stop = stop.clone();
                  tasks.spawn(async move {
                      let mut done = 0;
                      loop {
                          tokio::select! {
                              _ = stop.cancelled() => break,
                              _ = sleep(Duration::from_millis(100)) => done += 1,
                          }
                      }
                      // flush anything still buffered here, before returning
                      format!("worker {id} stopped cleanly after {done} rounds")
                  });
              }
              sleep(Duration::from_millis(250)).await;
              stop.cancel();
              while let Some(res) = tasks.join_next().await {
                  println!("{}", res.unwrap());
              }
          }
          ~~~

          «CancellationToken» (from tokio-util) and a «watch» channel do the same job; you will see both.

          :::pitfall Shutdown questions
          1. Does every long-running task see the stop signal?
          2. What happens to work in flight: a half-sent frame, an unacknowledged message, a buffered log line?
          3. Does main wait for the tasks (with its own deadline), or return and drop them mid-work?
          :::
        `,
      },
      {
        exercise: {
          id: 'ch-fix-accept', title: 'Keep the accept loop alive after an error', kind: 'fix', mins: 12, diff: 'medium', topics: ['async'],
          statement: R`
            «accept_loop» accepts connections until it is told to stop, and returns how many it accepted. The tests give it a fake listener whose first «accept» fails, the way a real one does when the process runs out of file handles.

            Press **Run**: it reports 0 instead of 2. Fix the loop so an accept error is reported and the loop keeps accepting. Stopping must still work.
          `,
          starter: R`
use tokio::sync::watch;

/// Something that accepts connections. The tests pass in a fake.
pub trait Acceptor {
    async fn accept(&mut self) -> Result<u32, String>;
}

/// Accepts connections until told to stop. Returns how many were accepted.
pub async fn accept_loop<A: Acceptor>(mut listener: A, mut stop: watch::Receiver<bool>) -> u32 {
    let mut accepted = 0;
    loop {
        tokio::select! {
            Ok(_conn) = listener.accept() => accepted += 1,
            _ = stop.changed() => break,
        }
    }
    accepted
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'keeps accepting after an error', ex: true, async: 'paused', code: R`struct Script(Vec<Result<u32, String>>);
impl Acceptor for Script {
    async fn accept(&mut self) -> Result<u32, String> {
        if self.0.is_empty() { std::future::pending::<()>().await; }
        self.0.remove(0)
    }
}
let (tx, rx) = watch::channel(false);
let fake = Script(vec![Err("too many open files".into()), Ok(1), Ok(2)]);
let stopper = async move {
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    tx.send(true).unwrap();
};
let (accepted, _) = tokio::join!(accept_loop(fake, rx), stopper);
assert_eq!(accepted, 2, "the loop stopped accepting after the first error");` },
            { name: 'accepts until stopped', ex: true, async: 'paused', code: R`struct Script(Vec<Result<u32, String>>);
impl Acceptor for Script {
    async fn accept(&mut self) -> Result<u32, String> {
        if self.0.is_empty() { std::future::pending::<()>().await; }
        self.0.remove(0)
    }
}
let (tx, rx) = watch::channel(false);
let stopper = async move {
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    tx.send(true).unwrap();
};
let (accepted, _) = tokio::join!(accept_loop(Script(vec![Ok(1), Ok(2), Ok(3)]), rx), stopper);
assert_eq!(accepted, 3);` },
            { name: 'survives several errors in a row', async: 'paused', code: R`struct Script(Vec<Result<u32, String>>);
impl Acceptor for Script {
    async fn accept(&mut self) -> Result<u32, String> {
        if self.0.is_empty() { std::future::pending::<()>().await; }
        self.0.remove(0)
    }
}
let (tx, rx) = watch::channel(false);
let stopper = async move {
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    tx.send(true).unwrap();
};
let script = Script(vec![Err("a".into()), Err("b".into()), Ok(1), Err("c".into()), Ok(2)]);
let (accepted, _) = tokio::join!(accept_loop(script, rx), stopper);
assert_eq!(accepted, 2);` },
          ],
          hints: [
            'Which branch stopped firing after the first «Err»? Re-read the last part of the «select!» lesson.',
            'Bind the whole result: «res = listener.accept() => match res { ... }».',
            'In the «Err(e)» arm, log it (for example «eprintln!») and let the loop go round again. Real code would also pause briefly on «too many open files».',
          ],
          solution: {
            rust: R`
use tokio::sync::watch;

/// Something that accepts connections. The tests pass in a fake.
pub trait Acceptor {
    async fn accept(&mut self) -> Result<u32, String>;
}

/// Accepts connections until told to stop. Returns how many were accepted.
pub async fn accept_loop<A: Acceptor>(mut listener: A, mut stop: watch::Receiver<bool>) -> u32 {
    let mut accepted = 0;
    loop {
        tokio::select! {
            res = listener.accept() => match res {
                Ok(_conn) => accepted += 1,
                Err(e) => eprintln!("accept failed, still listening: {e}"),
            },
            _ = stop.changed() => break,
        }
    }
    accepted
}
`,
            why: R`
              - «Ok(_conn) = listener.accept()» is a pattern. When «accept» returned «Err», the pattern did not match, the branch switched off, and «select!» waited only for «stop». No error, no log line: the loop simply stopped accepting.
              - Binding the whole result and matching inside the arm handles both outcomes, and the loop goes round again.
              - In a real server, add a short sleep on errors like «too many open files», so the loop does not spin while the process is out of handles.
              - The fake «Acceptor» is the test seam from the Traits module: a trait the real listener and the fake both implement.
            `,
            talk: 'The select! branch used an Ok(..) pattern, so the first accept error switched it off and the loop waited only for stop. Binding the result and matching inside the arm logs the error and keeps accepting.',
          },
          wrong: [
            { name: 'stops on the first error', rust: R`
use tokio::sync::watch;
pub trait Acceptor { async fn accept(&mut self) -> Result<u32, String>; }
pub async fn accept_loop<A: Acceptor>(mut listener: A, mut stop: watch::Receiver<bool>) -> u32 {
    let mut accepted = 0;
    loop {
        tokio::select! {
            res = listener.accept() => match res { Ok(_) => accepted += 1, Err(_) => break },
            _ = stop.changed() => break,
        }
    }
    accepted
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'ch-review-fanout', title: 'Find the bugs: fanning frames out to workers', kind: 'review', mins: 16, diff: 'hard', topics: ['async'],
          file: 'src/fanout.rs',
          statement: R`
            **The change:** The inbound reader pushes frames into a queue; a fan-out task broadcasts them to one worker per destination. Adds «read_frame», which reads a length-prefixed frame and gives up after 30 s of silence.

            Context: every frame must reach every destination. Destinations are sometimes slow for minutes at a time. Senders are other systems on the network.
          `,
          code: R`
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::sync::{broadcast, mpsc};
use tokio::time::{sleep, Duration};

+pub fn start_workers(n: usize) -> (mpsc::UnboundedSender<Vec<u8>>, broadcast::Sender<Vec<u8>>) {
+    let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>(); ⟦a⟧
+    let (fan, _) = broadcast::channel::<Vec<u8>>(16);
+    let fan2 = fan.clone();
+    tokio::spawn(async move {
+        while let Some(frame) = rx.recv().await { ⟦d1⟧
+            let _ = fan2.send(frame); ⟦f⟧
+        }
+    });
+    for _ in 0..n {
+        let mut sub = fan.subscribe();
+        tokio::spawn(async move {
+            while let Ok(frame) = sub.recv().await { ⟦b⟧
+                deliver(&frame).await;
+            }
+        });
+    }
+    (tx, fan)
+}
+
+async fn deliver(frame: &[u8]) {
+    sleep(Duration::from_millis(frame.len() as u64)).await;
+}
+
+/// Reads one frame (a 4-byte length, then the body), or gives up after 30 s of silence.
+pub async fn read_frame<R: AsyncRead + Unpin>(conn: &mut R) -> Option<Vec<u8>> {
+    tokio::select! {
+        frame = async {
+            let len = conn.read_u32().await.ok()? as usize;
+            let mut body = vec![0u8; len]; ⟦e⟧
+            conn.read_exact(&mut body).await.ok()?;
+            Some(body)
+        } => frame,
+        _ = sleep(Duration::from_secs(30)) => None, ⟦c⟧
+    }
+}
`,
          issues: [
            {
              id: 'a', tag: 'unbounded', title: 'The inbound queue has no limit',
              why: 'When destinations slow down, the reader keeps accepting and every frame waits in an unbounded queue. Minutes of slow destinations at full inbound rate is a lot of memory, and nothing ever pushes back on the senders.',
              fix: 'A bounded «mpsc::channel(capacity)»: the reader then waits, which slows the senders through TCP backpressure.',
            },
            {
              id: 'b', tag: 'lost', title: 'A worker that falls behind quits, and its frames are gone',
              why: 'The broadcast channel keeps 16 frames. A worker more than 16 behind gets «Err(Lagged)» from «recv()», which does not match «Ok(frame)», so its «while let» loop ends: the worker exits for good, and every frame it missed is lost for that destination.',
              fix: 'Match on the result: handle «Lagged(n)» (at least log and alert; better, redesign so each destination has its own bounded queue and nothing can be skipped), and exit only on «Closed».',
              demoAsync: 'paused',
              demo: 'let (_tx, fan) = start_workers(1);\nfor _ in 0..40 {\n    fan.send(vec![0u8; 50]).unwrap();\n}\ntokio::time::sleep(Duration::from_millis(1)).await;\nassert_eq!(fan.receiver_count(), 1, "the worker quit after falling behind");',
            },
            {
              id: 'f', tag: 'swallow', title: 'Frames dropped without a word when no worker is left',
              why: '«broadcast::send» fails only when there are no subscribers, meaning every worker has died (see the lagging issue). «let _ =» discards the frame and the error, so the relay keeps accepting frames it silently throws away.',
              fix: 'Treat a failed send as fatal for the route: log it, stop accepting, and surface it to health checks.',
            },
            {
              id: 'c', tag: 'lost', title: 'The 30-second timer can cut a frame in half',
              why: 'The comment says "30 s of silence", but the timer covers the whole frame. A large frame on a slow link that takes longer than 30 s is dropped mid-read: the bytes already read are lost, and the connection is now in the middle of a frame, so every later frame is misread.',
              fix: 'Time out each read separately (idle time, not total time), and treat a timeout in the middle of a frame as a broken connection: close it rather than carry on.',
            },
            {
              id: 'e', tag: 'unbounded', title: 'The sender decides how much memory to allocate',
              why: 'The length comes straight off the wire. A garbage or hostile length such as 4,000,000,000 makes «vec![0u8; len]» try to allocate 4 GB, and the process dies.',
              fix: 'Check the length against a maximum frame size before allocating, and close the connection if it is exceeded.',
            },
          ],
          decoys: [
            { id: 'd1', why: 'Receiving from an mpsc queue in a «while let» is the normal shape: «recv()» returns «None» only when every sender is gone, which is the clean way for this task to end.' },
          ],
          hints: [
            'Five issues: two about memory, two about losing frames, one silence.',
            'For «broadcast»: what does «recv()» return when a subscriber falls more than 16 frames behind, and what does «while let Ok(..)» do with it?',
            'In «read_frame», what does the timer race against: silence, or the whole frame? And who chooses «len»?',
          ],
          solution: {
            fixed: R`
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::sync::mpsc;
use tokio::time::{sleep, timeout, Duration};

const MAX_FRAME: usize = 16 * 1024 * 1024;
const IDLE: Duration = Duration::from_secs(30);

/// One bounded queue per destination: a slow destination slows the reader down
/// instead of losing frames.
pub fn start_workers(n: usize, capacity: usize) -> Vec<mpsc::Sender<Vec<u8>>> {
    (0..n)
        .map(|_| {
            let (tx, mut rx) = mpsc::channel::<Vec<u8>>(capacity);
            tokio::spawn(async move {
                while let Some(frame) = rx.recv().await {
                    deliver(&frame).await;
                }
            });
            tx
        })
        .collect()
}

async fn deliver(frame: &[u8]) {
    sleep(Duration::from_millis(frame.len() as u64)).await;
}

/// Reads one frame (a 4-byte length, then the body). None means the connection
/// should be closed: silent too long, closed by the peer, or not speaking the protocol.
pub async fn read_frame<R: AsyncRead + Unpin>(conn: &mut R) -> Option<Vec<u8>> {
    let len = timeout(IDLE, conn.read_u32()).await.ok()?.ok()? as usize;
    if len > MAX_FRAME {
        return None;
    }
    let mut body = vec![0u8; len];
    let mut filled = 0;
    while filled < len {
        let n = timeout(IDLE, conn.read(&mut body[filled..])).await.ok()?.ok()?;
        if n == 0 {
            return None;
        }
        filled += n;
    }
    Some(body)
}
`,
            talk: 'The unbounded queue and the unchecked length both let memory grow without limit. A broadcast worker that lagged got Err(Lagged), which ended its while-let loop, so that destination silently stopped receiving. The fan-out then discarded frames with let _ once no worker was left. And the 30 s timer covered the whole frame, so a slow frame was cut in half and the stream desynchronised.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
