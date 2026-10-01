(function (root) {
  const RL = root.RL, R = RL.R;
  RL.module({
    id: 'net', title: 'Networking: accept loops, framing and dead peers', short: 'Net',
    blurb: 'A TCP server you can trust, why one read is not one message (MLLP framing with a buffer), peers that vanish without closing, and reading «tracing» logs. Ends with a relay that has six bugs to find.',
    items: [
      {
        lesson: 'net-listener', title: 'An accept loop you can trust', mins: 8, hunts: ['hang', 'unbounded'],
        remember: 'A TCP server is a loop: accept, spawn a task per connection, repeat. The loop must survive accept errors, and something must cap how many connections run at once.',
        cue: 'An accept loop → what happens on an accept error, and what limits how many connection tasks can exist?',
        body: R`
          This runs for real: a server and a client on localhost, in one program.

          ~~~rust !run
          use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
          use tokio::net::{TcpListener, TcpStream};

          #[tokio::main]
          async fn main() -> std::io::Result<()> {
              let listener = TcpListener::bind("127.0.0.1:0").await?;
              let addr = listener.local_addr()?;

              tokio::spawn(async move {
                  loop {
                      match listener.accept().await {
                          Ok((stream, _peer)) => {
                              tokio::spawn(async move {
                                  let (read, mut write) = stream.into_split();
                                  let mut lines = BufReader::new(read).lines();
                                  while let Ok(Some(line)) = lines.next_line().await {
                                      if write.write_all(format!("ACK {line}\n").as_bytes()).await.is_err() {
                                          break;
                                      }
                                  }
                              });
                          }
                          Err(e) => eprintln!("accept failed, still listening: {e}"),
                      }
                  }
              });

              let mut client = TcpStream::connect(addr).await?;
              client.write_all(b"MSH|1\nMSH|2\n").await?;
              client.shutdown().await?;
              let mut reply = String::new();
              client.read_to_string(&mut reply).await?;
              print!("{reply}");
              Ok(())
          }
          ~~~

          Line by line:

          - «bind» then «accept» in a loop. «accept» gives back the new stream and the peer's address.
          - One «tokio::spawn» per connection, so a slow client does not hold up the others.
          - «into_split()» turns the stream into an owned read half and write half, so a reader and a writer can live in different tasks.
          - The «Err» arm logs and keeps looping. The Channels module showed what happens when an accept loop cannot see its errors.

          @stop

          ## Capping connections

          Nothing above limits how many connection tasks exist. A reconnect storm, or a peer that opens connections and never closes them, grows that number without limit. A semaphore is the usual cap:

          ~~~rust
          let slots = Arc::new(Semaphore::new(200));
          loop {
              let permit = Arc::clone(&slots).acquire_owned().await?;   // waits when 200 are open
              let (stream, _) = listener.accept().await?;
              tokio::spawn(async move {
                  handle(stream).await;
                  drop(permit);                                         // frees the slot
              });
          }
          ~~~

          :::pitfall For every accept loop
          1. Does an accept error keep the loop alive, with a short pause for «too many open files»?
          2. What caps the number of connections?
          3. Does each connection task handle its own errors, and time out when the peer goes quiet (lesson 3)?
          :::
        `,
      },
      {
        lesson: 'net-framing', title: 'Framing a byte stream (MLLP)', mins: 8, hunts: ['panic', 'unbounded', 'lost'],
        remember: 'TCP delivers a stream of bytes, not messages: a frame can arrive in pieces or several at once, so read into a buffer that outlives each read and cut frames out of it.',
        cue: 'One «read()» treated as one message → TCP keeps no message boundaries; look for a buffer and a frame parser',
        body: R`
          ## One read is not one message

          @predict 0

          A sender's two writes can arrive in one read, and one write can arrive split across two. So a server needs a buffer that lives across reads, plus a function that cuts complete frames off its front. For MLLP a frame is «0x0B», the message, then «0x1C 0x0D».

          ~~~rust !run
          use bytes::{Buf, BytesMut};

          const START: u8 = 0x0b;
          const END: &[u8] = &[0x1c, 0x0d];
          const MAX: usize = 1024 * 1024;

          /// Cuts one complete MLLP frame off the front of buf, if there is one.
          fn next_frame(buf: &mut BytesMut) -> Result<Option<BytesMut>, String> {
              let Some(start) = buf.iter().position(|b| *b == START) else {
                  buf.clear(); // no start byte anywhere: nothing here is usable
                  return Ok(None);
              };
              buf.advance(start); // drop junk before the start byte
              let Some(end) = buf.windows(2).position(|w| w == END) else {
                  if buf.len() > MAX {
                      return Err(format!("no end marker in {} bytes", buf.len()));
                  }
                  return Ok(None); // wait for more bytes
              };
              let mut frame = buf.split_to(end + 2); // take the frame, keep the rest
              frame.advance(1);
              frame.truncate(frame.len() - 2);
              Ok(Some(frame))
          }

          fn main() {
              let mut buf = BytesMut::new();
              for chunk in [&b"junk\x0bMSH|1"[..], &b"\x1c\r\x0bMSH|2\x1c\r\x0bMSH"[..]] {
                  buf.extend_from_slice(chunk);
                  while let Ok(Some(frame)) = next_frame(&mut buf) {
                      println!("frame: {}", String::from_utf8_lossy(&frame));
                  }
                  println!("left in the buffer: {} bytes", buf.len());
              }
          }
          ~~~

          The three things every frame parser must get right, and every one of them was a bug in the Errors module's find-the-bugs exercise:

          1. **Half a frame** returns «Ok(None)» and waits; it never panics.
          2. **Junk** before a start byte is skipped, so the buffer cannot fill with garbage.
          3. **Size is capped**, so a peer that never sends an end marker cannot use unlimited memory.

          @stop

          ## In real code

          - «stream.read_buf(&mut buf).await» appends whatever arrived to the «BytesMut». It is cancel-safe: if a «select!» drops it, nothing is lost, because the bytes live in «buf», outside the future.
          - «tokio_util::codec» packages this pattern: «impl Decoder for MllpCodec { fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Frame>, Error> }», and «Framed::new(stream, MllpCodec)» turns a socket into a stream of frames. A «Decoder» is the function above with a fixed signature. Check the same three things.
        `,
        predict: [
          {
            q: 'The client writes two MLLP frames. How many bytes does the server\'s first read return?',
            code: 'use tokio::io::{AsyncReadExt, AsyncWriteExt};\nuse tokio::net::{TcpListener, TcpStream};\n\n#[tokio::main]\nasync fn main() {\n    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();\n    let mut client = TcpStream::connect(l.local_addr().unwrap()).await.unwrap();\n    let (mut server, _) = l.accept().await.unwrap();\n    client.write_all(b"\\x0bMSH|1\\x1c\\r").await.unwrap();\n    client.write_all(b"\\x0bMSH|2\\x1c\\r").await.unwrap();\n    let mut buf = [0u8; 1024];\n    let n = server.read(&mut buf).await.unwrap();\n    println!("{n}");\n}',
            options: ['8', '16', 'It hangs'],
            answer: 1,
            why: 'Both writes were already sitting in the receive buffer, so one «read» returned both frames, 16 bytes. Code that treats each read as one message would have processed the second frame as part of the first. The opposite also happens: one frame split across two reads.',
          },
        ],
      },
      {
        lesson: 'net-timeouts', title: 'Dead peers: timeouts, keepalive, reconnects', mins: 7, hunts: ['hang'],
        remember: 'A peer that vanishes without closing the connection looks exactly like a quiet peer; only a read timeout or TCP keepalive tells them apart.',
        cue: 'A connection task whose only exit is the peer closing the socket → what if the peer, or a VPN between you, just disappears?',
        body: R`
          ## The half-open connection

          If a peer loses power, or a firewall or VPN in the middle forgets the connection, no close ever arrives. «read()» waits forever, holding a task, a buffer and a connection slot.

          ~~~rust !run
          use tokio::io::{duplex, AsyncReadExt, AsyncWriteExt};
          use tokio::time::{timeout, Duration};

          #[tokio::main(flavor = "current_thread", start_paused = true)]
          async fn main() {
              let (mut peer, mut conn) = duplex(64);
              peer.write_all(b"MSH|1").await.unwrap();
              // the peer now goes silent but never closes: a half-open connection
              let mut buf = [0u8; 64];
              loop {
                  match timeout(Duration::from_secs(120), conn.read(&mut buf)).await {
                      Ok(Ok(0)) => { println!("peer closed"); break; }
                      Ok(Ok(n)) => println!("read {n} bytes"),
                      Ok(Err(e)) => { println!("read error: {e}"); break; }
                      Err(_) => { println!("silent for 120 s: closing and freeing the slot"); break; }
                  }
              }
              drop(peer);
          }
          ~~~

          Two ways to notice a dead peer:

          - **An application timeout** like the one above: simple, and it also catches peers that are alive but stuck.
          - **TCP keepalive**: the operating system probes an idle connection and reports it dead when the probes go unanswered. Set with the «socket2» crate: «SockRef::from(&stream).set_tcp_keepalive(..)». Detection time is roughly idle time plus interval times retries, so work the numbers out for your own settings.

          @stop

          ## Reconnecting with capped backoff

          The side that dials out should reconnect by itself, waiting a little longer after each failure, up to a cap:

          ~~~rust !run
          use std::time::Duration;

          fn backoff(attempt: u32) -> Duration {
              let secs = 2u64.saturating_pow(attempt).min(60);
              Duration::from_secs(secs)
          }

          fn main() {
              let waits: Vec<u64> = (0..8).map(|a| backoff(a).as_secs()).collect();
              println!("{waits:?}");
          }
          ~~~

          Real code adds a little random jitter so a hundred clients do not all retry in the same second.

          :::pitfall Listener or dialer?
          A **listener** (the side that accepts) cannot reconnect anything: it can only notice silence and free the slot, and it depends on the peer dialling back. A **dialer** (the side that connects out) should retry with capped backoff, including when the very first connection attempt fails. Know which side your code is, and make it behave like that side.
          :::
        `,
      },
      {
        lesson: 'net-tracing', title: 'Reading «tracing» logs and spans', mins: 5,
        remember: '«tracing» logs are structured: «info!(bytes = n, "frame received")» records fields, and a span stamps its context (a connection id, a peer) onto every line inside it.',
        cue: '«%x» in a tracing macro → Display formatting; «?x» → Debug; «#[instrument]» on a function → every line inside carries its arguments',
        body: R`
          ~~~rust !run
          use tracing::{info, info_span, warn};

          fn main() {
              tracing_subscriber::fmt().without_time().with_ansi(false).with_target(false).init();
              let peer = "10.1.2.3:51000";
              let span = info_span!("conn", id = 7, %peer);
              let _entered = span.enter();
              info!(bytes = 128, "frame received");
              warn!(elapsed_ms = 45_000, "no ACK from destination");
          }
          ~~~

          | You see | Means |
          |---|---|
          | «info!(bytes = n, "...")» | a log line with a named field |
          | «%peer», «peer = %addr» | record it with «Display» (its «{}» form) |
          | «?frame», «err = ?e» | record it with «Debug» (its «{:?}» form) |
          | «info_span!("conn", id = 7)» | a context; every line logged inside it carries «conn{id=7}» |
          | «#[instrument]» on a function | a span per call, with the arguments as fields |
          | «RUST_LOG=info,my_crate=debug» | the level filter, set at startup |

          :::pitfall Two tracing slips
          - «span.enter()» inside an «async fn», with the guard held across an «.await»: the span leaks into other tasks' log lines. Async code should use «#[instrument]» or «.instrument(span)» instead.
          - Log levels: an «error!» that fires on every expected disconnect drowns the real errors (and any alerts built on them). Pick the level on purpose.
          :::
        `,
      },
      {
        exercise: {
          id: 'net-build-acker', title: 'Acknowledge every MLLP frame', kind: 'build', mins: 15, diff: 'medium', topics: ['networking'],
          statement: R`
            Write «serve_connection»: read MLLP frames from the stream and answer each one with an MLLP-framed ACK.

            - The ACK for a frame is «0x0B», then «MSA|AA|» followed by the message's control id, then «0x1C 0x0D». The control id is MSH-10: in the first segment, split on «|», it is the item at index 9.
            - Frames can arrive split across reads, or several in one read. «next_frame» (given, from the framing lesson) does the cutting.
            - When the peer closes the connection, return how many frames were acknowledged.

            The tests talk to it over «tokio::io::duplex», an in-memory connection, so nothing touches the network.
          `,
          starter: R`
use bytes::{Buf, BytesMut};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

const START: u8 = 0x0b;
const END: &[u8] = &[0x1c, 0x0d];
const MAX: usize = 1024 * 1024;

/// Given: cuts one complete MLLP frame off the front of buf, if there is one.
pub fn next_frame(buf: &mut BytesMut) -> Result<Option<BytesMut>, String> {
    let Some(start) = buf.iter().position(|b| *b == START) else {
        buf.clear();
        return Ok(None);
    };
    buf.advance(start);
    let Some(end) = buf.windows(2).position(|w| w == END) else {
        if buf.len() > MAX {
            return Err(format!("no end marker in {} bytes", buf.len()));
        }
        return Ok(None);
    };
    let mut frame = buf.split_to(end + 2);
    frame.advance(1);
    frame.truncate(frame.len() - 2);
    Ok(Some(frame))
}

/// Answers every MLLP frame with "MSA|AA|<control id>", framed.
/// Returns how many frames were acknowledged when the peer closes.
pub async fn serve_connection<S: AsyncRead + AsyncWrite + Unpin>(mut stream: S) -> std::io::Result<usize> {
    todo!()
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'acks one frame', ex: true, async: true, code: R`let (mut client, server) = tokio::io::duplex(1024);
let task = tokio::spawn(serve_connection(server));
client.write_all(b"\x0bMSH|^~\\&|A|B|||1||ADT^A01|42|P|2.5\r\x1c\r").await.unwrap();
let want = b"\x0bMSA|AA|42\x1c\r";
let mut got = vec![0u8; want.len()];
client.read_exact(&mut got).await.unwrap();
assert_eq!(got, want.to_vec());
drop(client);
assert_eq!(task.await.unwrap().unwrap(), 1);` },
            { name: 'a frame split across two writes', ex: true, async: true, code: R`let (mut client, server) = tokio::io::duplex(1024);
let task = tokio::spawn(serve_connection(server));
client.write_all(b"\x0bMSH|^~\\&|A|B|||1||ORU^R01|").await.unwrap();
tokio::task::yield_now().await;
client.write_all(b"77|P|2.5\r\x1c\r").await.unwrap();
let want = b"\x0bMSA|AA|77\x1c\r";
let mut got = vec![0u8; want.len()];
client.read_exact(&mut got).await.unwrap();
assert_eq!(got, want.to_vec());
drop(client);
assert_eq!(task.await.unwrap().unwrap(), 1);` },
            { name: 'two frames in one write', async: true, code: R`let (mut client, server) = tokio::io::duplex(1024);
let task = tokio::spawn(serve_connection(server));
client.write_all(b"\x0bMSH|^~\\&|A|B|||1||ADT^A01|1|P|2.5\r\x1c\r\x0bMSH|^~\\&|A|B|||1||ADT^A08|2|P|2.5\r\x1c\r").await.unwrap();
let want = b"\x0bMSA|AA|1\x1c\r\x0bMSA|AA|2\x1c\r";
let mut got = vec![0u8; want.len()];
client.read_exact(&mut got).await.unwrap();
assert_eq!(got, want.to_vec());
drop(client);
assert_eq!(task.await.unwrap().unwrap(), 2);` },
            { name: 'a peer that sends nothing', async: true, code: R`let (client, server) = tokio::io::duplex(1024);
drop(client);
assert_eq!(serve_connection(server).await.unwrap(), 0);` },
          ],
          hints: [
            'Keep one «BytesMut» for the whole connection. Loop: cut out every complete frame and ACK it, then «read_buf» more bytes.',
            '«stream.read_buf(&mut buf).await?» returns 0 when the peer has closed: that is when you return the count.',
            'Control id: «String::from_utf8_lossy(&frame)», then «.split(\'\\r\').next()», then «.split(\'|\').nth(9)». Write the ACK with «stream.write_all(format!("\\x0bMSA|AA|{id}\\x1c\\r").as_bytes()).await?».',
          ],
          solution: {
            rust: R`
use bytes::{Buf, BytesMut};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

const START: u8 = 0x0b;
const END: &[u8] = &[0x1c, 0x0d];
const MAX: usize = 1024 * 1024;

/// Given: cuts one complete MLLP frame off the front of buf, if there is one.
pub fn next_frame(buf: &mut BytesMut) -> Result<Option<BytesMut>, String> {
    let Some(start) = buf.iter().position(|b| *b == START) else {
        buf.clear();
        return Ok(None);
    };
    buf.advance(start);
    let Some(end) = buf.windows(2).position(|w| w == END) else {
        if buf.len() > MAX {
            return Err(format!("no end marker in {} bytes", buf.len()));
        }
        return Ok(None);
    };
    let mut frame = buf.split_to(end + 2);
    frame.advance(1);
    frame.truncate(frame.len() - 2);
    Ok(Some(frame))
}

/// MSH-10, the message control id.
fn control_id(frame: &[u8]) -> String {
    let text = String::from_utf8_lossy(frame);
    let msh = text.split('\r').next().unwrap_or("");
    msh.split('|').nth(9).unwrap_or("").to_string()
}

/// Answers every MLLP frame with "MSA|AA|<control id>", framed.
/// Returns how many frames were acknowledged when the peer closes.
pub async fn serve_connection<S: AsyncRead + AsyncWrite + Unpin>(mut stream: S) -> std::io::Result<usize> {
    let mut buf = BytesMut::with_capacity(4096);
    let mut acked = 0;
    loop {
        while let Some(frame) = next_frame(&mut buf).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))? {
            let ack = format!("\x0bMSA|AA|{}\x1c\r", control_id(&frame));
            stream.write_all(ack.as_bytes()).await?;
            acked += 1;
        }
        if stream.read_buf(&mut buf).await? == 0 {
            return Ok(acked);
        }
    }
}
`,
            why: R`
              - One «BytesMut» lives for the whole connection, so half a frame from one read is still there when the rest arrives.
              - The inner «while let» drains every complete frame before reading again, which handles several frames in one read.
              - «read_buf» appends to the buffer and returns 0 at end of stream. It is cancel-safe, so this loop could sit inside a «select!» with a stop signal or an idle timeout without losing bytes.
              - A frame-size error becomes an «io::Error» of kind «InvalidData», so the caller closes the connection.
              - A real acknowledgement also carries its own MSH segment. This exercise keeps only the MSA part, to stay about framing.
            `,
            talk: 'One buffer per connection: read_buf appends, next_frame cuts out every complete frame, and each gets an ACK with its MSH-10 control id. Split frames and several frames per read both work, because nothing assumes one read is one message.',
          },
          wrong: [
            { name: 'treats one read as one frame', rust: R`
use bytes::BytesMut;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
pub fn next_frame(_buf: &mut BytesMut) -> Result<Option<BytesMut>, String> { Ok(None) }
pub async fn serve_connection<S: AsyncRead + AsyncWrite + Unpin>(mut stream: S) -> std::io::Result<usize> {
    let mut acked = 0;
    let mut b = [0u8; 1024];
    loop {
        let n = stream.read(&mut b).await?;
        if n == 0 { return Ok(acked); }
        let text = String::from_utf8_lossy(&b[1..n.saturating_sub(2)]).to_string();
        let id = text.split('\r').next().unwrap_or("").split('|').nth(9).unwrap_or("").to_string();
        stream.write_all(format!("\x0bMSA|AA|{id}\x1c\r").as_bytes()).await?;
        acked += 1;
    }
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'net-review-relay', title: 'Find the bugs: an MLLP relay', kind: 'review', mins: 20, diff: 'hard', topics: ['networking'],
          file: 'src/relay.rs',
          statement: R`
            **The change:** A small relay: accepts connections from senders, ACKs each message, and forwards it to a single downstream connection. Stops when the stop signal fires. Tested locally with the test sender: 1,000 messages relayed.

            Context: senders are hospital systems over VPNs; an ACK tells a sender it may delete its copy of the message; the downstream is sometimes slow or restarting. Everything from the Async, Channels and Networking modules applies.
          `,
          code: R`
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{watch, Mutex};

+pub async fn run(listener: TcpListener, downstream: Arc<Mutex<TcpStream>>, mut stop: watch::Receiver<bool>) {
+    loop {
+        tokio::select! {
+            Ok((conn, _peer)) = listener.accept() => { ⟦a⟧
+                let downstream = Arc::clone(&downstream); ⟦d1⟧
+                tokio::spawn(handle(conn, downstream)); ⟦b⟧
+            }
+            _ = stop.changed() => break,
+        }
+    }
+}
+
+async fn handle(mut conn: TcpStream, downstream: Arc<Mutex<TcpStream>>) {
+    let mut buf = vec![0u8; 64 * 1024];
+    loop {
+        let n = match conn.read(&mut buf).await { ⟦c⟧
+            Ok(0) | Err(_) => return,
+            Ok(n) => n,
+        };
+        let message = &buf[..n]; ⟦g⟧
+        conn.write_all(b"\x0bMSA|AA\x1c\r").await.ok(); ⟦e⟧
+        let mut out = downstream.lock().await; ⟦d2⟧
+        out.write_all(message).await.ok(); ⟦f⟧
+    }
+}
`,
          issues: [
            {
              id: 'a', tag: 'hang', title: 'One accept error and the relay stops accepting, silently',
              why: 'The «Ok(..)» pattern switches this branch off the first time «accept» fails (for example «too many open files»). «select!» then waits only for the stop signal. The relay stays up and bound, and accepts nothing until someone restarts it (the Channels module).',
              fix: '«res = listener.accept() => match res { Ok(..) => .., Err(e) => { log; short sleep } }».',
            },
            {
              id: 'b', tag: 'unbounded', title: 'Unlimited connection tasks, and nobody watching them',
              why: 'Every connection gets a task, with no cap and no kept handle. A reconnect storm or a sender leaking connections grows the task count and memory without limit, and a panicking handler vanishes without a trace.',
              fix: 'A semaphore permit per connection (the Networking module, lesson 1) and a «JoinSet», or at least logging when a handler ends with an error.',
            },
            {
              id: 'c', tag: 'hang', title: 'A vanished sender holds its slot forever',
              why: 'Senders sit behind VPNs. When one disappears without closing, «read» waits forever, holding the task and its 64 KB buffer. Over weeks these pile up.',
              fix: 'Wrap reads in «timeout» (an idle limit), and/or enable TCP keepalive on accepted sockets.',
            },
            {
              id: 'g', tag: 'logic', title: 'One read is treated as one message',
              why: 'TCP has no message boundaries. Two messages in one read get one ACK and are forwarded as one blob; a message split across reads is forwarded in pieces and ACKed twice. The test sender sends one message per write with gaps, which hides it.',
              fix: 'Keep a buffer per connection and cut MLLP frames out of it (the framing lesson), then ACK and forward per frame.',
              demoAsync: true,
              demo: 'let relay = TcpListener::bind("127.0.0.1:0").await.unwrap();\nlet relay_addr = relay.local_addr().unwrap();\nlet sink = TcpListener::bind("127.0.0.1:0").await.unwrap();\nlet downstream = Arc::new(Mutex::new(TcpStream::connect(sink.local_addr().unwrap()).await.unwrap()));\nlet (_stop_tx, stop_rx) = watch::channel(false);\ntokio::spawn(run(relay, downstream, stop_rx));\nlet mut client = TcpStream::connect(relay_addr).await.unwrap();\nclient.write_all(b"\\x0bMSH|1\\x1c\\r\\x0bMSH|2\\x1c\\r").await.unwrap();\nlet mut acks = vec![0u8; 18];\nlet got = tokio::time::timeout(std::time::Duration::from_secs(2), client.read_exact(&mut acks)).await;\nassert!(got.is_ok(), "two messages arrived in one read, and only one ACK came back");',
            },
            {
              id: 'e', tag: 'lost', title: 'The ACK goes out before the message is safe',
              why: 'An ACK tells the sender it may delete its copy. Here it is sent before the message is forwarded (and the forward may fail, see the next issue). If the downstream write fails or the relay crashes in between, the sender has deleted the message and the relay never delivered it: silent loss.',
              fix: 'ACK only after the message is safely forwarded (or durably stored). On failure, send a negative ACK so the sender retries.',
            },
            {
              id: 'f', tag: 'swallow', title: 'Downstream failures are ignored',
              why: '«.ok()» discards the write error. A restarting downstream fails every write, and the relay keeps ACKing and "forwarding" into a dead socket with no log line and no reconnect.',
              fix: 'Handle the error: log it, reconnect the downstream with capped backoff, and do not ACK what was not forwarded.',
            },
          ],
          decoys: [
            { id: 'd1', why: 'Cloning the «Arc» before the spawn gives the task its own handle to the shared downstream. That is the standard shape.' },
            { id: 'd2', why: 'A tokio «Mutex» around the one downstream socket is right: it stops two connections interleaving their bytes, and it is meant to be held across the write\'s «.await». Its danger is only a write with no timeout, which is the same fix as the other hang issues.' },
          ],
          hints: [
            'Six issues. One is an old friend from the Channels module\'s «select!» lesson.',
            'Think about the sender\'s side: what does an ACK promise, and when does this code send it?',
            'Then TCP itself: message boundaries, and peers that vanish without closing.',
          ],
          solution: {
            fixed: R`
use std::sync::Arc;
use std::time::Duration;
use bytes::{Buf, BytesMut};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{watch, Mutex, Semaphore};
use tokio::time::{sleep, timeout};

const IDLE: Duration = Duration::from_secs(300);
const WRITE: Duration = Duration::from_secs(30);

pub async fn run(listener: TcpListener, downstream: Arc<Mutex<TcpStream>>, mut stop: watch::Receiver<bool>) {
    let slots = Arc::new(Semaphore::new(200));
    loop {
        tokio::select! {
            res = listener.accept() => match res {
                Ok((conn, peer)) => {
                    let Ok(permit) = Arc::clone(&slots).try_acquire_owned() else {
                        eprintln!("connection limit reached, refusing {peer}");
                        continue;
                    };
                    let downstream = Arc::clone(&downstream);
                    tokio::spawn(async move {
                        if let Err(e) = handle(conn, downstream).await {
                            eprintln!("connection from {peer} ended: {e}");
                        }
                        drop(permit);
                    });
                }
                Err(e) => {
                    eprintln!("accept failed, still listening: {e}");
                    sleep(Duration::from_millis(100)).await;
                }
            },
            _ = stop.changed() => break,
        }
    }
}

fn next_frame(buf: &mut BytesMut) -> Option<BytesMut> {
    let start = buf.iter().position(|b| *b == 0x0b)?;
    buf.advance(start);
    let end = buf.windows(2).position(|w| w == [0x1c, 0x0d])?;
    Some(buf.split_to(end + 2))
}

async fn handle(mut conn: TcpStream, downstream: Arc<Mutex<TcpStream>>) -> std::io::Result<()> {
    let mut buf = BytesMut::with_capacity(64 * 1024);
    loop {
        while let Some(frame) = next_frame(&mut buf) {
            let forwarded = {
                let mut out = downstream.lock().await;
                matches!(timeout(WRITE, out.write_all(&frame)).await, Ok(Ok(())))
            };
            let reply: &[u8] = if forwarded { b"\x0bMSA|AA\x1c\r" } else { b"\x0bMSA|AE\x1c\r" };
            conn.write_all(reply).await?;
        }
        match timeout(IDLE, conn.read_buf(&mut buf)).await {
            Ok(Ok(0)) => return Ok(()),
            Ok(Ok(_)) => {}
            Ok(Err(e)) => return Err(e),
            Err(_) => return Err(std::io::Error::new(std::io::ErrorKind::TimedOut, "sender silent too long")),
        }
    }
}
`,
            talk: 'The Ok(..) pattern in select! stops accepting after one accept error. Connection tasks are unlimited and unwatched, and reads have no timeout, so vanished senders pile up. One read was treated as one message. And the ACK went out before a forward whose errors were thrown away, so a failing downstream silently loses messages the senders have already deleted.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
