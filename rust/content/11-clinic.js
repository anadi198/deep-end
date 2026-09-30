(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'clinic', title: 'The review clinic', short: 'Clinic',
    blurb: 'A ten-minute method for reviewing a Rust PR, then six longer AI-written PRs that mix everything from modules 00 to 10. One is mostly fine: knowing when not to comment is half the skill.',
    items: [
      {
        lesson: 'cl-method', title: 'Reviewing a Rust PR in ten minutes', mins: 8,
        remember: 'Read the description for the promise, the signatures for ownership and errors, then hunt the cue words; every comment names the mechanism, when it bites, and the fix.',
        cue: 'A long Rust PR lands → description first, signatures second, then search the diff for the cue words (unwrap, let _, spawn, select!, lock, std::, as, clone, unbounded)',
        body: R`
          ## The method

          1. **The description: what does this PR promise?** "Every message is delivered once." "Retries until the peer is back." Note the invariant, and the context (who sends, what can fail, how big things get). Most planted issues in this lab break a promise the description made.
          2. **The signatures: who owns what, and what can fail?** Parameters taken by value move ownership (a copy may be hiding at the call site). Return types without «Result» cannot report failure. «&mut self» means state changes.
          3. **Search for the cue words.** Use the find box on the diff:

          | Search for | Hunt |
          |---|---|
          | «unwrap», «expect», «[», «as u» | Can crash, Wrong result |
          | «let _», «.ok()», «unwrap_or» | Error swallowed, Wrong result |
          | «std::thread::sleep», «std::fs», «std::net» | Blocks the runtime |
          | «.await» next to network, «lock()», «connect» | Can wait forever |
          | «select!», «spawn», «exit», «ack» | Work lost, Error swallowed |
          | «unbounded», «Vec::new» in a loop, «vec![0u8; len]» | Grows without limit |
          | «clone», «to_vec», «to_string» | Needless cost |

          4. **Walk the unhappy path.** For each external thing (peer, disk, config), ask: what if it is slow, silent, full, malformed or gone?
          5. **Ask for the test that would have caught it.** Every demo in this lab is that test. "Add a test with a frame split across two reads" is a better comment than "handle partial frames".

          @stop

          ## Writing the comment

          Three parts, one comment per finding:

          - **What happens**: the mechanism, in the order things happen.
          - **When it bites**: the concrete situation, and what the user or the peer sees.
          - **The fix**: the smallest change, or the test to add.

          > **Accept loop stops after one error.** The «Ok((conn, _)) = listener.accept()» pattern switches this «select!» branch off when «accept» returns «Err» (for example «EMFILE»), and the loop then waits only for the stop signal. Senders can still connect at the TCP level but never get an ACK, until the process is restarted. Fix: bind the result and «match» on it; log the error and keep looping, with a short sleep. A test with a fake listener that fails once would catch it.

          ## What not to comment on

          Knowing a pattern is fine saves everyone's time. These kept turning up as decoys:

          - «Arc::clone» before a spawn; «lock().unwrap()»; «Relaxed» on a counter.
          - «expect("why it cannot fail")» on something that truly cannot fail.
          - Cloning a short id or name once per request.
          - Style that clippy already reports: let the tool say it.
        `,
      },
      {
        exercise: {
          id: 'cl-retry-worker', title: 'Clinic 1: a retry worker for failed deliveries', kind: 'review', mins: 18, diff: 'hard', topics: ['clinic'],
          file: 'src/retry.rs',
          statement: R`
            **feat(delivery): background retry worker**

            > Adds a worker that re-sends failed deliveries from the on-disk store with exponential backoff, and marks them delivered on success. Tested with a fake store and a fake sender.

            Context: downstream systems must not receive duplicates. The store's disk has filled up before. Records survive crashes, including a crash in the middle of writing a record. A peer can be down for a day.
          `,
          code: R`
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct Pending {
    pub id: u64,
    pub attempts: u32,
    pub body: Vec<u8>,
}

/// Where failed deliveries wait. The real one is on disk.
pub trait Store: Send + Sync + 'static {
    fn due(&self) -> Vec<Vec<u8>>;
    fn mark_delivered(&self, id: u64) -> std::io::Result<()>;
    fn save(&self, p: &Pending) -> std::io::Result<()>;
}

/// Sends one message downstream.
pub trait Sender: Send + Sync + 'static {
    fn send(&self, body: &[u8]) -> impl std::future::Future<Output = Result<(), String>> + Send;
}

+/// Record layout: 8-byte id, 1-byte attempt count, then the body.
+pub fn decode(raw: &[u8]) -> Pending {
+    let id = u64::from_be_bytes(raw[0..8].try_into().unwrap()); ⟦a⟧
+    Pending { id, attempts: raw[8] as u32, body: raw[9..].to_vec() }
+}
+
+pub fn start<S: Sender>(store: Arc<dyn Store>, sender: Arc<S>) -> tokio::task::JoinHandle<()> {
+    tokio::spawn(async move {
+        loop {
+            for raw in store.due() {
+                let p = decode(&raw);
+                let delay = Duration::from_secs(2u64.pow(p.attempts)); ⟦c⟧
+                tokio::time::sleep(delay).await; ⟦c⟧
+                match sender.send(&p.body).await {
+                    Ok(()) => {
+                        let _ = store.mark_delivered(p.id); ⟦e⟧
+                    }
+                    Err(e) => {
+                        eprintln!("delivery {} failed: {e}", p.id); ⟦d1⟧
+                        let next = Pending { attempts: p.attempts + 1, ..p }; ⟦d2⟧
+                        store.save(&next).unwrap(); ⟦f⟧
+                    }
+                }
+            }
+            std::thread::sleep(Duration::from_secs(5)); ⟦g⟧
+        }
+    })
+}
`,
          issues: [
            {
              id: 'a', tag: 'panic', title: 'A truncated record crashes the worker',
              why: 'Records survive crashes, including crashes mid-write, so a short record is expected. «raw[0..8]» panics on anything under 8 bytes («raw[8]» on under 9), the worker task dies, and nothing is retried again until a restart.',
              fix: 'Return «Option<Pending>» (or a «Result»): check the length, use «raw.get(0..8)?», log and quarantine records that do not decode.',
              demo: 'decode(&[0u8; 3]);',
            },
            {
              id: 'c', tag: 'hang', title: 'Backoff with no cap, one message at a time',
              why: '«2^attempts» seconds has no ceiling: after 20 attempts that is 12 days, and «2u64.pow(64)» overflows (a panic in debug builds). Worse, the sleep happens inside the loop over all due messages, so one message with many attempts delays every message behind it.',
              fix: 'Cap the delay («.min(300)»), store a "next attempt at" time per record instead of sleeping inline, and only pick up records that are due.',
            },
            {
              id: 'e', tag: 'swallow', title: 'A failed "mark delivered" means a duplicate',
              why: 'If «mark_delivered» fails (the disk is full, for example), the record stays due and is sent again next round. Downstream must not get duplicates, and «let _ =» hides the very error that causes them.',
              fix: 'Handle the error: log it, stop sending new messages until the store is writable, and make sure the next attempt knows this message may already be delivered.',
            },
            {
              id: 'f', tag: 'panic', title: 'A full disk kills the worker',
              why: '«save(..).unwrap()» panics when the store cannot write, which is exactly when the store needs attention. The task dies, and every remaining retry stops with it.',
              fix: 'Log the error and keep the worker alive (back off, retry the save later), and surface it to health checks.',
            },
            {
              id: 'g', tag: 'block', title: 'A blocking sleep inside the runtime',
              why: '«std::thread::sleep» holds a Tokio worker thread for 5 seconds every round, stalling every other task scheduled on it.',
              fix: '«tokio::time::sleep(Duration::from_secs(5)).await», or a «tokio::time::interval».',
            },
          ],
          decoys: [
            { id: 'd1', why: 'Logging the id and the error on a failed attempt is exactly right: it says which message and why.' },
            { id: 'd2', why: 'Struct update syntax («..p») moves the body into the new value. Nothing is copied, and «p» is not used again.' },
          ],
          hints: [
            'Five issues: two crashes, one silence, one stall, one wait-forever.',
            'Read the context line about crashes mid-write, then read «decode».',
            'What happens to the other due messages while one of them is sleeping? And after 64 attempts?',
          ],
          solution: {
            talk: 'decode indexes a record that can be truncated, and save().unwrap() dies on a full disk: both kill the worker. The backoff has no cap and sleeps inline, so one message delays all the others. A failed mark_delivered is ignored, which causes duplicates. And std::thread::sleep blocks the runtime.',
          },
        },
      },
      {
        exercise: {
          id: 'cl-archive-cleanup', title: 'Clinic 2: nightly archive cleanup', kind: 'review', mins: 14, diff: 'medium', topics: ['clinic'],
          file: 'src/cleanup.rs',
          statement: R`
            **feat(archive): nightly cleanup of delivered messages**

            > Deletes stored message bodies that are no longer pending and are older than the retention period. Runs once a night.

            Context: retention is configured per tenant, usually 30 to 180 days. The pending index is a separate file, which can be missing for a while after a restore from backup. Deleted bodies cannot be recovered.
          `,
          code: R`
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// Ids of messages still waiting for delivery.
pub trait Pending {
    fn ids(&self) -> std::io::Result<HashSet<String>>;
}

+/// Deletes body files that are not pending and are older than the retention period.
+pub fn cleanup(dir: &Path, pending: &dyn Pending, retention_days: u32) -> std::io::Result<usize> {
+    let live = pending.ids().unwrap_or_default(); ⟦a⟧
+    let retention = Duration::from_millis((retention_days * 86_400_000) as u64); ⟦b⟧
+    let mut removed = 0;
+    for entry in fs::read_dir(dir)? {
+        let path = entry?.path();
+        let id = path.file_stem().unwrap().to_string_lossy().to_string(); ⟦d1⟧
+        if live.contains(&id) {
+            continue;
+        }
+        let age = SystemTime::now().duration_since(fs::metadata(&path)?.modified()?).unwrap_or_default(); ⟦d2⟧
+        if age > retention {
+            fs::remove_file(&path).ok(); ⟦e⟧
+            removed += 1; ⟦e⟧
+        }
+    }
+    Ok(removed)
+}
`,
          issues: [
            {
              id: 'a', tag: 'lost', title: 'A missing index deletes everything, including pending messages',
              why: 'This deletes by exclusion: anything not in «live» goes. When the index cannot be read (after a restore, say), «unwrap_or_default()» turns the error into an empty set, every body counts as "not pending", and every old enough file is deleted, including messages still waiting for delivery. They cannot be recovered.',
              fix: 'Propagate the error with «?»: if you cannot prove a message is safe to delete, delete nothing. Deleting by exclusion always needs a trustworthy list.',
              demo: 'let dir = std::env::temp_dir().join(format!("clinic-cleanup-{}", std::process::id()));\nfs::create_dir_all(&dir).unwrap();\nlet body = dir.join("msg-1.hl7");\nfs::write(&body, b"MSH").unwrap();\nstd::thread::sleep(Duration::from_millis(20));\nstruct Missing;\nimpl Pending for Missing {\n    fn ids(&self) -> std::io::Result<HashSet<String>> { Err(std::io::Error::new(std::io::ErrorKind::NotFound, "index missing")) }\n}\nlet _ = cleanup(&dir, &Missing, 0);\nassert!(body.exists(), "the index could not be read, and a pending message body was deleted");',
            },
            {
              id: 'b', tag: 'logic', title: 'Retention over 49 days overflows',
              why: '«retention_days * 86_400_000» is computed in «u32», whose maximum is about 4.29 billion: 50 days or more overflows. Tests (debug) panic; production (release) wraps silently, so a 90-day retention becomes about 40 days and messages are deleted 50 days early.',
              fix: 'Do the arithmetic in «u64» first: «Duration::from_secs(u64::from(retention_days) * 86_400)».',
              demo: 'let dir = std::env::temp_dir().join(format!("clinic-ttl-{}", std::process::id()));\nfs::create_dir_all(&dir).unwrap();\nstruct NonePending;\nimpl Pending for NonePending {\n    fn ids(&self) -> std::io::Result<HashSet<String>> { Ok(HashSet::new()) }\n}\ncleanup(&dir, &NonePending, 90).unwrap();',
            },
            {
              id: 'e', tag: 'swallow', title: 'Failed deletions are ignored and still counted',
              why: '«.ok()» discards the error, and «removed» goes up anyway. When deletion fails (permissions, a read-only mount), the job reports a healthy count while the disk keeps filling.',
              fix: 'Only count what was actually removed; log failures and report them.',
            },
          ],
          decoys: [
            { id: 'd1', why: 'Entries from «read_dir» always have a file name, so «file_stem()» cannot be «None» here. «expect» with a reason would read better, but this cannot panic.' },
            { id: 'd2', why: 'If a file\'s modified time is in the future (clock skew), «duration_since» fails and the default age of zero keeps the file. Failing towards keeping data is the right default here.' },
          ],
          hints: [
            'Three issues. The worst one loses data that cannot be recovered.',
            'What does «live» contain when the index file is missing?',
            'Work out «90 * 86_400_000» and compare it with «u32::MAX».',
          ],
          solution: {
            fixed: R`
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::time::{Duration, SystemTime};

/// Ids of messages still waiting for delivery.
pub trait Pending {
    fn ids(&self) -> std::io::Result<HashSet<String>>;
}

/// Deletes body files that are not pending and are older than the retention period.
pub fn cleanup(dir: &Path, pending: &dyn Pending, retention_days: u32) -> std::io::Result<usize> {
    let live = pending.ids()?;
    let retention = Duration::from_secs(u64::from(retention_days) * 86_400);
    let mut removed = 0;
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        let Some(stem) = path.file_stem() else { continue };
        if live.contains(stem.to_string_lossy().as_ref()) {
            continue;
        }
        let age = SystemTime::now().duration_since(fs::metadata(&path)?.modified()?).unwrap_or_default();
        if age > retention {
            match fs::remove_file(&path) {
                Ok(()) => removed += 1,
                Err(e) => eprintln!("could not delete {}: {e}", path.display()),
            }
        }
    }
    Ok(removed)
}
`,
            talk: 'The index error became an empty set, so a missing index deleted pending messages: delete by exclusion only with a list you can trust. The retention math overflowed u32 past 49 days, silently shortening retention in release. And failed deletions were ignored but still counted.',
          },
        },
      },
      {
        exercise: {
          id: 'cl-shutdown', title: 'Clinic 3: graceful shutdown', kind: 'review', mins: 14, diff: 'medium', topics: ['clinic'],
          file: 'src/shutdown.rs',
          statement: R`
            **feat(main): graceful shutdown on SIGTERM**

            > On SIGTERM, cancel the token, give tasks a moment to stop, and exit. The journal task records every received message.

            Context: every message acknowledged to a sender must be in the journal, because that is how messages are replayed after a restart. Kubernetes sends SIGTERM on every deploy.
          `,
          code: R`
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncWrite, AsyncWriteExt, BufWriter};
use tokio::sync::{mpsc, Mutex};
use tokio_util::sync::CancellationToken;

pub struct Journal<W: AsyncWrite + Unpin> {
    out: BufWriter<W>,
}

impl<W: AsyncWrite + Unpin> Journal<W> {
    pub fn new(w: W) -> Self {
        Journal { out: BufWriter::new(w) }
    }
    pub async fn record(&mut self, line: &str) -> std::io::Result<()> {
        self.out.write_all(line.as_bytes()).await?;
        self.out.write_all(b"\n").await
    }
    pub async fn flush(&mut self) -> std::io::Result<()> {
        self.out.flush().await
    }
}

+/// Journals every received message until stop fires.
+pub async fn run<W: AsyncWrite + Unpin>(mut rx: mpsc::Receiver<String>, journal: Arc<Mutex<Journal<W>>>, stop: CancellationToken) {
+    loop {
+        tokio::select! {
+            Some(msg) = rx.recv() => { ⟦d1⟧
+                journal.lock().await.record(&msg).await.unwrap(); ⟦a⟧
+            }
+            _ = stop.cancelled() => break, ⟦b⟧
+        }
+    }
+}
+
+pub async fn shutdown(tasks: Vec<tokio::task::JoinHandle<()>>, stop: CancellationToken) {
+    stop.cancel();
+    tokio::time::sleep(Duration::from_millis(100)).await; ⟦c⟧
+    drop(tasks); ⟦c⟧
+    std::process::exit(0); ⟦e⟧
+}
`,
          issues: [
            {
              id: 'a', tag: 'panic', title: 'One failed journal write kills journaling',
              why: 'When the disk is full, «record(..).unwrap()» panics the task, and every message after that is acknowledged to senders but never journaled.',
              fix: 'Handle the error: stop acknowledging new messages (or fail health checks) until the journal can write again.',
            },
            {
              id: 'b', tag: 'lost', title: 'Stopping throws away what was received but not yet written',
              why: 'On cancel the loop breaks at once. Messages already in the channel are dropped, and lines sitting in the «BufWriter» are never flushed (a tokio «BufWriter» does not flush when dropped). Those messages were acknowledged, and are now in no journal.',
              fix: 'On stop: «rx.close()», drain what is left with «while let Some(msg) = rx.recv().await», then «flush()» the journal before returning.',
              demoAsync: true,
              demo: 'let (tx, rx) = mpsc::channel(8);\nfor m in ["A01", "A08", "A03"] {\n    tx.send(m.to_string()).await.unwrap();\n}\nlet journal = Arc::new(Mutex::new(Journal::new(Vec::new())));\nlet stop = CancellationToken::new();\nstop.cancel();\nrun(rx, Arc::clone(&journal), stop).await;\nlet written = journal.lock().await.out.get_ref().clone();\nassert_eq!(String::from_utf8(written).unwrap().lines().count(), 3, "messages received before shutdown never reached the journal");',
            },
            {
              id: 'c', tag: 'lost', title: 'A fixed 100 ms instead of waiting for the tasks',
              why: 'Tasks get 100 ms, whatever they are doing, and dropping a «JoinHandle» neither waits for the task nor stops it. A task that needs longer to drain and flush is simply cut off.',
              fix: 'Await the handles (a «JoinSet»), with an overall deadline from «tokio::time::timeout», and log any task that did not finish.',
            },
            {
              id: 'e', tag: 'lost', title: '«process::exit» skips every cleanup',
              why: '«std::process::exit» ends the process immediately: no destructors run, and no buffered writer anywhere gets a chance to flush. Returning from «main» after the tasks finish is what lets cleanup happen.',
              fix: 'Return from «shutdown», let «main» return normally, and let Kubernetes see the process exit.',
            },
          ],
          decoys: [
            { id: 'd1', why: '«Some(msg) = rx.recv()» is the normal idiom: «recv» is cancel-safe, and the branch switching off when the channel closes is what you want.' },
          ],
          hints: [
            'One crash, three ways to lose acknowledged messages.',
            'Follow a message that arrives 1 ms before SIGTERM: where is it when the process exits?',
            'Does dropping a «JoinHandle» wait for the task?',
          ],
          solution: {
            talk: 'The unwrap on a journal write kills journaling on a full disk. On stop, run breaks without draining the channel or flushing the BufWriter, so acknowledged messages never reach the journal. shutdown sleeps 100 ms instead of awaiting the tasks, then process::exit skips all cleanup.',
          },
        },
      },
      {
        exercise: {
          id: 'cl-http-dest', title: 'Clinic 4: an HTTP destination with retries', kind: 'review', mins: 14, diff: 'medium', topics: ['clinic'],
          file: 'src/http_dest.rs',
          statement: R`
            **feat(dest): HTTP destination with retries**

            > Posts each message to the configured URL and retries on failure, up to «max_attempts». «parse_attempts» reads the setting from the destination config.

            Context: the receiving API answers 400 with a reason in the body when a message is invalid (for example "PID-3 missing"). Operators fix the message and resubmit, so they need that reason. The API sometimes stops responding without closing connections.
          `,
          code: R`
use std::time::Duration;

pub struct Response {
    pub status: u16,
    pub body: String,
}

/// The HTTP client. Real code wraps reqwest; tests use a fake.
pub trait Transport {
    fn post(&self, url: &str, body: &[u8]) -> impl std::future::Future<Output = std::io::Result<Response>>;
}

pub struct HttpDest<T: Transport> {
    pub url: String,
    pub transport: T,
    pub max_attempts: u32,
}

+#[derive(Debug, PartialEq)]
+pub enum Outcome {
+    Delivered,
+    Rejected(String),
+    GaveUp,
+}
+
+impl<T: Transport> HttpDest<T> {
+    pub async fn deliver(&self, body: &[u8]) -> Outcome {
+        let mut attempt = 0;
+        loop {
+            attempt += 1;
+            match self.transport.post(&self.url, body).await { ⟦a⟧
+                Ok(r) if r.status < 300 => return Outcome::Delivered,
+                Ok(r) => eprintln!("attempt {attempt}: HTTP {}", r.status), ⟦b,c⟧
+                Err(e) => eprintln!("attempt {attempt} failed: {e}"),
+            }
+            if attempt >= self.max_attempts {
+                return Outcome::GaveUp;
+            }
+            tokio::time::sleep(Duration::from_millis(500)).await; ⟦d1⟧
+        }
+    }
+}
+
+pub fn parse_attempts(raw: &str) -> u32 {
+    raw.trim().parse().unwrap_or(0) ⟦e⟧
+}
`,
          issues: [
            {
              id: 'a', tag: 'hang', title: 'No timeout on the request',
              why: 'The API sometimes stops responding without closing the connection. With no timeout, «post» waits forever, this message never finishes, and nothing behind it moves.',
              fix: 'Wrap it: «tokio::time::timeout(Duration::from_secs(30), self.transport.post(..))», and treat a timeout as a retryable failure (or set a timeout on the reqwest client).',
            },
            {
              id: 'b', tag: 'logic', title: 'A 400 is retried, and the outcome is never «Rejected»',
              why: 'Every non-2xx status is treated the same: retried until «max_attempts», then reported as «GaveUp». A 400 means the message itself is wrong; retrying cannot help. «Outcome::Rejected» exists but is never returned.',
              fix: 'Split by status: 4xx (except 408 and 429) returns «Rejected(reason)» at once; 5xx, 408 and 429 are retried.',
              demoAsync: 'paused',
              demo: 'struct Always400;\nimpl Transport for Always400 {\n    async fn post(&self, _url: &str, _body: &[u8]) -> std::io::Result<Response> {\n        Ok(Response { status: 400, body: "PID-3 missing".into() })\n    }\n}\nlet d = HttpDest { url: "http://api".into(), transport: Always400, max_attempts: 3 };\nassert_eq!(d.deliver(b"MSH").await, Outcome::Rejected("PID-3 missing".into()), "a 400 is a rejection with a reason, not something to retry");',
            },
            {
              id: 'c', tag: 'swallow', title: 'The reason in the error body is thrown away',
              why: 'Only the status number is logged. The API explains exactly what is wrong in the body ("PID-3 missing"), and operators need it to fix the message. It is dropped on the floor.',
              fix: 'Keep «r.body» (trimmed to a sane length) in the log line and in «Rejected(..)».',
            },
            {
              id: 'e', tag: 'logic', title: 'A typo in the config silently disables retries',
              why: '«"3 "» works, but «"three"» or «"3x"» becomes 0 without a word, and with 0 the loop gives up after the first attempt. Nobody finds out until messages start failing on the first blip.',
              fix: 'Return «Result<u32, _>» and refuse to load a config with an invalid value, naming the field.',
            },
          ],
          decoys: [
            { id: 'd1', why: 'A short fixed pause between a handful of attempts is fine. Exponential backoff with a cap matters for long-running retry loops, not for three tries.' },
          ],
          hints: [
            'Four issues: one wait-forever, one silence, two wrong results.',
            'What does the description say a 400 means, and what does the code do with it?',
            'What does «parse_attempts("three")» return, and what does the loop do with that?',
          ],
          solution: {
            talk: 'post has no timeout, so a silent API hangs delivery. Every non-2xx is retried, including 400s that can never succeed, and Rejected is never returned. The error body with the reason is dropped. And parse_attempts turns a typo into zero retries without a word.',
          },
        },
      },
      {
        exercise: {
          id: 'cl-dialer', title: 'Clinic 5: reconnecting a TCP destination', kind: 'review', mins: 12, diff: 'medium', topics: ['clinic'],
          file: 'src/dialer.rs',
          statement: R`
            **fix(dest): reconnect the TCP destination after a network blip**

            > If a write fails, reconnect and carry on. «connect_with_retry» keeps trying until the destination is back.

            Context: the destination sits behind a VPN. During VPN outages, packets to it are dropped silently (no refusal, no reset). Outages last from seconds to hours. Every frame must be delivered.
          `,
          code: R`
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio::time::sleep;

+pub async fn connect_with_retry(addr: &str) -> TcpStream {
+    let mut attempt: u32 = 0;
+    loop {
+        match TcpStream::connect(addr).await { ⟦a⟧
+            Ok(s) => return s,
+            Err(e) => {
+                attempt += 1;
+                eprintln!("connect to {addr} failed ({e}), attempt {attempt}");
+                sleep(Duration::from_secs(1)).await; ⟦b⟧
+            }
+        }
+    }
+}
+
+pub async fn run(addr: String, mut rx: mpsc::Receiver<Vec<u8>>) {
+    let mut conn = connect_with_retry(&addr).await;
+    while let Some(frame) = rx.recv().await {
+        if conn.write_all(&frame).await.is_err() {
+            conn = connect_with_retry(&addr).await; ⟦c⟧
+        }
+    }
+}
+
+pub fn start(addr: String) -> (mpsc::Sender<Vec<u8>>, JoinHandle<()>) {
+    let (tx, rx) = mpsc::channel(1024); ⟦d1⟧
+    (tx, tokio::spawn(run(addr, rx))) ⟦d2⟧
+}
`,
          issues: [
            {
              id: 'a', tag: 'hang', title: 'A connect into a silent VPN can take minutes per attempt',
              why: 'When packets are dropped silently, «connect» gets no answer and waits for the operating system to give up, which can take a couple of minutes. The "retry every second" design actually retries every few minutes, and a blip that is already over is noticed late.',
              fix: '«tokio::time::timeout(Duration::from_secs(5), TcpStream::connect(addr))», counting a timeout as a failed attempt.',
            },
            {
              id: 'b', tag: 'cost', title: 'Retries every second forever: no backoff',
              why: 'During an hours-long outage this logs and dials 3,600 times an hour, and when the peer comes back every client hits it at once.',
              fix: 'Capped exponential backoff with jitter (module 10): 1, 2, 4, ... up to about 60 seconds.',
            },
            {
              id: 'c', tag: 'lost', title: 'The frame that failed is never re-sent',
              why: 'After a failed write the code reconnects and moves on to the next frame. The frame whose write failed (possibly half-written) is dropped: every frame must be delivered, and this one silently is not.',
              fix: 'Loop until this frame is written: reconnect, then retry the same frame. Because part of it may have reached the peer, the protocol needs ACKs to know what actually arrived.',
            },
          ],
          decoys: [
            { id: 'd1', why: 'A bounded channel: when the destination is down and the queue fills, senders wait. That is the backpressure you want.' },
            { id: 'd2', why: 'The «JoinHandle» is returned to the caller, so the task can be supervised. Nothing is silently detached.' },
          ],
          hints: [
            'Three issues: one wait-forever, one cost, one lost frame.',
            'What does «connect» do when nobody answers at all, and how long does that take?',
            'Follow the frame whose «write_all» failed. Is it ever written again?',
          ],
          solution: {
            talk: 'connect has no timeout, so into a silent VPN each attempt takes minutes. Retrying every second forever, with no backoff, floods logs and the peer. And after a failed write the frame is dropped: the loop reconnects and moves on to the next one.',
          },
        },
      },
      {
        exercise: {
          id: 'cl-mostly-fine', title: 'Clinic 6: a refactor that is mostly fine', kind: 'review', mins: 10, diff: 'medium', topics: ['clinic'],
          file: 'src/hl7.rs',
          statement: R`
            **refactor(hl7): one module for the field helpers**

            > The field helpers were copied in three places. Moves them into one module. No behaviour change intended.

            Context: callers ask for field 0 to get a segment's name, for example when routing on segment type. Most PRs are mostly fine; the skill here is flagging only what matters.
          `,
          code: R`
+/// Field n of a segment, numbered the HL7 way: in MSH, field 1 is the separator itself.
+pub fn field<'a>(segment: &'a str, n: usize) -> Option<&'a str> { ⟦d1⟧
+    if segment.starts_with("MSH") {
+        if n == 1 {
+            return Some("|");
+        }
+        segment.split('|').nth(n - 1) ⟦a⟧
+    } else {
+        segment.split('|').nth(n)
+    }
+}
+
+pub fn segments(msg: &str) -> impl Iterator<Item = &str> {
+    msg.split('\r').filter(|s| !s.is_empty()) ⟦d2⟧
+}
+
+pub fn control_id(msg: &str) -> Option<&str> {
+    segments(msg).next().and_then(|msh| field(msh, 10))
+}
+
+pub fn patient_id(msg: &str) -> Option<String> {
+    let pid = segments(msg).find(|s| s.starts_with("PID|"))?;
+    Some(field(pid, 3)?.split('^').next()?.to_string()) ⟦d3⟧
+}
`,
          issues: [
            {
              id: 'a', tag: 'panic', title: 'Field 0 of an MSH segment panics',
              why: 'For MSH the code computes «n - 1». With «n = 0» (which callers use to get the segment name) that is «0usize - 1»: a panic in debug builds, and a wrap to an enormous index in release, so the name comes back as «None». For every other segment, field 0 works. The old copies must have handled it, since callers rely on it.',
              fix: 'Handle 0 first: «if n == 0 { return segment.split(\'|\').next(); }», or use «n.checked_sub(1)?».',
              demo: 'assert_eq!(field("MSH|^~&|LAB", 0), Some("MSH"));',
            },
          ],
          decoys: [
            { id: 'd1', why: 'The explicit lifetime says the result borrows from «segment», which is accurate. The compiler would infer the same, so it is noise at worst, and not worth a comment.' },
            { id: 'd2', why: 'Filtering out empty segments handles the trailing «\\r» that every message ends with. Correct, and cheap.' },
            { id: 'd3', why: 'One small «String» allocation for a patient id per call. Returning «Option<&str>» would avoid it, but that is a style preference, not a problem.' },
          ],
          hints: [
            'There is exactly one planted issue. Everything else is fine.',
            'The context mentions field 0 for a reason. Try «field(msh, 0)» by hand.',
          ],
          solution: {
            talk: 'Only one real issue: field(msh, 0) computes 0 - 1 on a usize, which panics in debug and returns None in release, and callers use field 0 for the segment name. The lifetime, the empty-segment filter and the small to_string are all fine.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
