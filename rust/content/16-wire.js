(function (root) {
  const RL = root.RL, R = RL.R;

  /* The Playground has no prost or tonic. These stand-ins have their names and signatures, compile on the
   * Playground, and sit in "# " lines (compiled, not shown) at the end of the snippets that need them. */
  const PROTO_TYPES = R`#[derive(Clone, PartialEq, Debug, Default)]
pub struct Header {
    pub route_id: String,
    pub sent_at_ms: i64,
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct Frame {
    pub header: Option<Header>,
    pub kind: i32,
    pub body: Vec<u8>,
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct Ack {
    pub route_id: String,
    pub accepted: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
#[repr(i32)]
pub enum Kind {
    #[default]
    Unspecified = 0,
    Data = 1,
    Ack = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UnknownEnumValue(pub i32);

impl TryFrom<i32> for Kind {
    type Error = UnknownEnumValue;
    fn try_from(value: i32) -> Result<Kind, UnknownEnumValue> {
        match value {
            0 => Ok(Kind::Unspecified),
            1 => Ok(Kind::Data),
            2 => Ok(Kind::Ack),
            other => Err(UnknownEnumValue(other)),
        }
    }
}`;
  const GETTER = R`impl Frame {
    /// Returns the enum value of kind, or the default if the field holds an unknown value.
    pub fn kind(&self) -> Kind {
        Kind::try_from(self.kind).unwrap_or(Kind::default())
    }
}`;
  const TONIC = R`pub mod tonic {
    pub use async_trait::async_trait;

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub enum Code { Ok, Cancelled, Unknown, InvalidArgument, DeadlineExceeded, NotFound, AlreadyExists, PermissionDenied, ResourceExhausted, FailedPrecondition, Aborted, OutOfRange, Unimplemented, Internal, Unavailable, DataLoss, Unauthenticated }

    #[derive(Debug, Clone)]
    pub struct Status { code: Code, message: String }
    impl Status {
        pub fn new(code: Code, message: impl Into<String>) -> Status { Status { code, message: message.into() } }
        pub fn invalid_argument(message: impl Into<String>) -> Status { Status::new(Code::InvalidArgument, message) }
        pub fn not_found(message: impl Into<String>) -> Status { Status::new(Code::NotFound, message) }
        pub fn internal(message: impl Into<String>) -> Status { Status::new(Code::Internal, message) }
        pub fn unavailable(message: impl Into<String>) -> Status { Status::new(Code::Unavailable, message) }
        pub fn deadline_exceeded(message: impl Into<String>) -> Status { Status::new(Code::DeadlineExceeded, message) }
        pub fn code(&self) -> Code { self.code }
        pub fn message(&self) -> &str { &self.message }
    }

    #[derive(Debug)]
    pub struct Request<T> { message: T }
    impl<T> Request<T> {
        pub fn new(message: T) -> Request<T> { Request { message } }
        pub fn get_ref(&self) -> &T { &self.message }
        pub fn into_inner(self) -> T { self.message }
    }

    #[derive(Debug)]
    pub struct Response<T> { message: T }
    impl<T> Response<T> {
        pub fn new(message: T) -> Response<T> { Response { message } }
        pub fn get_ref(&self) -> &T { &self.message }
        pub fn into_inner(self) -> T { self.message }
    }
}`;
  const indent = (src, pad) => src.split('\n').map((l) => (l ? pad + l : l)).join('\n');
  const PROTO_MOD = 'pub mod proto {\n' + indent(PROTO_TYPES + '\n\n' + GETTER, '    ') + '\n\n' + indent(R`pub mod relay_server {
    use super::{Ack, Frame, Header};
    use crate::tonic::{Request, Response, Status};

    #[crate::tonic::async_trait]
    pub trait Relay: Send + Sync + 'static {
        async fn send(&self, request: Request<Frame>) -> Result<Response<Ack>, Status>;

        type SubscribeStream: tokio_stream::Stream<Item = Result<Ack, Status>> + Send + 'static;

        async fn subscribe(&self, request: Request<Header>) -> Result<Response<Self::SubscribeStream>, Status>;
    }
}`, '    ') + '\n}';
  // "# " before every line: compiled, not shown. pad matches the indentation of the lesson body.
  const hide = (src, pad = '') => src.split('\n').map((l) => pad + '# ' + l).join('\n');
  const BODY = '          ';

  RL.module({
    id: 'wire', title: 'Wire formats, generated code and tests', short: 'Wire',
    blurb: 'serde and the attributes that make it quiet, the shapes prost generates from a .proto file, what a tonic service promises its callers, and how to tell whether a test proves anything.',
    items: [
      {
        lesson: 'wi-serde', title: 'serde: what the derive decides for you', mins: 8, hunts: ['logic', 'swallow', 'panic'],
        remember: '«#[derive(Deserialize)]» fails loudly on a missing field or a wrong type. The quiet parts are elsewhere: unknown fields are ignored, «#[serde(default)]» fills in what is missing, and «untagged» enums take the first variant that fits.',
        cue: '«#[serde(default)]» on a field that matters, «unwrap_or_default()» after parsing, or «#[serde(untagged)]» → would a missing, misspelt or broken value go unnoticed?',
        body: R`
          serde is Jackson for Rust. «#[derive(Deserialize)]» writes the parsing code for the struct; «serde_json» (or «toml», or «serde_yaml») supplies the format.

          ~~~rust !run
          use serde::Deserialize;

          #[derive(Debug, Deserialize)]
          struct RouteConfig {
              destination: String,
              retries: u8,
              tls: Option<bool>,
          }

          fn main() {
              let good = r#"{"destination": "tcp://192.0.2.10:5100", "retries": 3, "colour": "blue"}"#;
              println!("{:?}", serde_json::from_str::<RouteConfig>(good));

              let bad = [
                  r#"{"retries": 3}"#,
                  r#"{"destination": "x", "retries": "three"}"#,
                  r#"{"destination": "x", "retries": 300}"#,
              ];
              for json in bad {
                  match serde_json::from_str::<RouteConfig>(json) {
                      Ok(c) => println!("{c:?}"),
                      Err(e) => println!("error: {e}"),
                  }
              }
          }
          ~~~

          Four things in that output:

          1. A missing «Option» field («tls») is simply «None».
          2. A missing required field is an error that names the field.
          3. A wrong type is an error, with the line and column.
          4. «"colour"» is not in the struct, and nobody complained.

          @predict 0

          :::java Jackson, side by side
          | Situation | serde | Plain Jackson | Spring Boot's ObjectMapper |
          |---|---|---|---|
          | unknown field | ignored | error | ignored |
          | missing field | error, unless «Option» or a default | «null» or 0 | «null» or 0 |
          | wrong type | error | error | error |

          serde is strict where Jackson is lenient (missing fields) and lenient where plain Jackson is strict (unknown fields). For a config file that means a misspelt key is silently ignored.
          :::

          @stop

          ## The attributes that change the rules

          | Attribute | Effect | The question to ask |
          |---|---|---|
          | «#[serde(rename_all = "camelCase")]» | JSON names in camelCase | does it match the other side? |
          | «#[serde(rename = "type")]» | one field's JSON name | |
          | «#[serde(default)]» on a field | missing means «Default»: 0, «""», «false», «None» | is 0 really a sensible value, or a missing setting? |
          | «#[serde(default)]» on the struct | **every** missing field gets its default | hides a missing required field |
          | «#[serde(default = "default_retries")]» | missing means "call this function" | |
          | «#[serde(deny_unknown_fields)]» | an unknown field is an error | for config: catches typos |
          | «#[serde(skip_serializing_if = "Option::is_none")]» | leaves «None» out of the output | |
          | «#[serde(flatten)]» | inlines another struct's fields | |
          | «#[serde(tag = "type")]» on an enum | «{"type": "Data", ...}» picks the variant | |
          | «#[serde(untagged)]» on an enum | tries each variant in order; the first that fits wins | does an earlier, looser variant swallow the rest? |

          @predict 1

          :::pitfall serde checklist
          1. What happens to a missing field, a misspelt field, and a value of the wrong type? Each should be a decision, not an accident.
          2. «serde_json::from_slice(&body).unwrap()» on data from outside is a crash; «.unwrap_or_default()» turns a broken message into an empty one without a word.
          3. «untagged»: list the strictest variant first.
          :::
        `,
        predict: [
          {
            q: 'The Types module showed «300 as u8» quietly becoming 44. What does serde do with it?',
            code: R`use serde::Deserialize;

#[derive(Deserialize)]
struct Limits {
    max_retries: u8,
}

fn main() {
    match serde_json::from_str::<Limits>(r#"{"max_retries": 300}"#) {
        Ok(l) => println!("{}", l.max_retries),
        Err(_) => println!("rejected"),
    }
}`,
            options: ['300', '44', 'rejected', 'It panics'],
            answer: 2,
            why: 'serde checks the range: "invalid value: integer 300, expected u8". Unlike «as», it never truncates.',
          },
          {
            q: 'The sender meant a delivery report. What does the relay see?',
            code: R`use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum Event {
    Heartbeat { route: String },
    Delivered { route: String, control_id: String },
}

fn main() {
    let json = r#"{"route": "lab-a", "control_id": "MSG0001"}"#;
    let e: Event = serde_json::from_str(json).unwrap();
    println!("{e:?}");
}`,
            options: ['Heartbeat { route: "lab-a" }', 'Delivered { route: "lab-a", control_id: "MSG0001" }', 'It panics', 'Compile error'],
            answer: 0,
            why: '«untagged» tries «Heartbeat» first. It needs only «route», which is there, and the extra «control_id» is ignored like any unknown field, so every delivery report becomes a heartbeat. Listing «Delivered» first fixes it; a «tag» field would be sturdier.',
          },
        ],
      },
      {
        lesson: 'wi-proto', title: 'Generated protobuf code: the shapes prost writes', mins: 8, hunts: ['panic', 'logic'],
        remember: 'In prost\'s generated structs a nested message is an «Option», a missing number or string is 0 or «""», and an enum field is a raw «i32» whose getter quietly returns the default variant for any value it does not know.',
        cue: '«.unwrap()» on a message field, or the enum getter on data from another system → what happens when a newer or broken sender sends something else?',
        body: R`
          A «.proto» file describes messages; «build.rs» runs prost (through tonic-build) at compile time, and the generated Rust is pulled in with «tonic::include_proto!("relay.v1")». You never edit it, but you read it every time you touch the code around it.

          ~~~proto relay.proto
          syntax = "proto3";
          package relay.v1;

          message Header {
            string route_id = 1;
            int64 sent_at_ms = 2;
          }

          enum Kind {
            KIND_UNSPECIFIED = 0;
            KIND_DATA = 1;
            KIND_ACK = 2;
          }

          message Frame {
            Header header = 1;
            Kind kind = 2;
            bytes body = 3;
          }

          message Ack {
            string route_id = 1;
            bool accepted = 2;
          }

          service Relay {
            rpc Send(Frame) returns (Ack);
            rpc Subscribe(Header) returns (stream Ack);
          }
          ~~~

          ~~~rust What prost generates (abridged)
          #[derive(Clone, PartialEq, ::prost::Message)]
          pub struct Frame {
              #[prost(message, optional, tag = "1")]
              pub header: ::core::option::Option<Header>,
              #[prost(enumeration = "Kind", tag = "2")]
              pub kind: i32,
              #[prost(bytes = "vec", tag = "3")]
              pub body: ::prost::alloc::vec::Vec<u8>,
          }

          #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, ::prost::Enumeration)]
          #[repr(i32)]
          pub enum Kind {
              Unspecified = 0,
              Data = 1,
              Ack = 2,
          }
          ~~~

          ## What each proto type becomes

          | In the .proto | In Rust | When the sender left it out |
          |---|---|---|
          | «string» | «String» | «""» |
          | «int64», «uint32», «bool» | «i64», «u32», «bool» | 0, «false» |
          | «bytes» | «Vec<u8>» | empty |
          | a message field | «Option<Header>» | «None» |
          | an enum field | «i32» | 0, the first value |
          | «optional uint32» | «Option<u32>» | «None» |
          | «repeated Header» | «Vec<Header>» | empty |
          | «map<string, string>» | «HashMap<String, String>» | empty |
          | «oneof body { ... }» | «Option<frame::Body>», an enum | «None» |

          The table's last column is the trap: a plain «int64» that was never sent reads as 0, so «sent_at_ms == 0» cannot tell "not sent" from "sent as zero". Fields that need that difference are declared «optional».

          @stop

          ## Enums arrive as numbers

          The field is an «i32» because a newer sender may use values this build has never heard of. prost adds a getter with the field's name, and it looks like this:

          ~~~rust !run
          impl Frame {
              /// Returns the enum value of kind, or the default if the field holds an unknown value.
              pub fn kind(&self) -> Kind {
                  Kind::try_from(self.kind).unwrap_or(Kind::default())
              }
          }

          fn main() {
              // a newer sender added KIND_NACK = 3
              let frame = Frame { header: None, kind: 3, body: vec![] };
              println!("raw field: {}", frame.kind);
              println!("getter:    {:?}", frame.kind());
              println!("try_from:  {:?}", Kind::try_from(frame.kind));
          }
          ${hide(PROTO_TYPES, BODY)}
          ~~~

          The getter turned an unknown 3 into «Unspecified» without a word. If the code then treats «Unspecified» like data, every new kind of message is handled as data. «Kind::try_from(frame.kind)» keeps the difference.

          :::java protobuf-java, side by side
          | | protobuf-java | prost |
          |---|---|---|
          | is the header there? | «hasHeader()» | «header.is_some()» |
          | header not sent | «getHeader()» returns an empty default instance | «header» is «None» |
          | unknown enum value | «getKind()» returns «UNRECOGNIZED» | the getter returns the **default** variant; «try_from» returns «Err» |
          :::

          @predict 0

          ## Convert once, at the edge

          The generated types are the wire, not your model. The sturdy pattern is one «TryFrom» from the generated type into your own type, at the boundary: it rejects a missing header or an unknown kind once, and the rest of the code never sees an «Option» header or a raw «i32». The build exercise below is exactly that.
        `,
        predict: [
          {
            q: 'Another system sent a frame without a header. What happens?',
            code: R`fn main() {
    // from another system, which left the header out
    let frame = Frame { header: None, kind: 1, body: b"MSH|".to_vec() };
    let route = frame.header.unwrap().route_id;
    println!("delivering to {route}");
}
${hide(PROTO_TYPES)}`,
            options: ['delivering to ', 'delivering to unknown', 'It panics', 'Compile error'],
            answer: 2,
            why: 'A message field is an «Option», and the sender left it out, so «unwrap» panics. A handler should answer with an error: «frame.header.ok_or_else(|| Status::invalid_argument("frame has no header"))?».',
          },
        ],
      },
      {
        lesson: 'wi-tonic', title: 'tonic: what a gRPC service promises', mins: 8, hunts: ['hang', 'swallow', 'logic'],
        remember: 'A tonic handler takes a «Request<T>» and returns «Result<Response<U>, Status>». The «Status» code is the contract with the caller\'s retry logic, a server stream is a channel the handler feeds, and a client call waits as long as the server takes unless a timeout is set.',
        cue: 'A tonic client call without a timeout, a «Status» built from an internal error, or a stream fed with «let _ = tx.send(..)» → what bounds the wait, what does the caller learn, and who stops the producer when the client leaves?',
        body: R`
          :::note About the snippets here
          The Playground has no tonic, so these snippets use small stand-ins for «Request», «Response», «Status» and the generated code, with tonic's names and signatures. They are hidden below each snippet; **Copy** includes them.
          :::

          ## A service is a trait tonic generates

          ~~~rust What tonic generates for the Relay service in relay.proto (abridged; details vary between tonic versions)
          #[async_trait]
          pub trait Relay: std::marker::Send + std::marker::Sync + 'static {
              async fn send(
                  &self,
                  request: tonic::Request<super::Frame>,
              ) -> std::result::Result<tonic::Response<super::Ack>, tonic::Status>;

              type SubscribeStream: tokio_stream::Stream<Item = std::result::Result<super::Ack, tonic::Status>>
                  + std::marker::Send
                  + 'static;

              async fn subscribe(
                  &self,
                  request: tonic::Request<super::Header>,
              ) -> std::result::Result<tonic::Response<Self::SubscribeStream>, tonic::Status>;
          }
          ~~~

          Your code implements it:

          ~~~rust !run
          use proto::relay_server::Relay;
          use proto::{Ack, Frame, Header, Kind};
          use tonic::{Request, Response, Status};

          struct RelayService;

          #[tonic::async_trait]
          impl Relay for RelayService {
              async fn send(&self, request: Request<Frame>) -> Result<Response<Ack>, Status> {
                  let frame = request.into_inner();
                  let header = frame.header.ok_or_else(|| Status::invalid_argument("frame has no header"))?;
                  let kind = Kind::try_from(frame.kind)
                      .map_err(|_| Status::invalid_argument(format!("unknown frame kind {}", frame.kind)))?;
                  println!("{kind:?} frame for {}", header.route_id);
                  Ok(Response::new(Ack { route_id: header.route_id, accepted: true }))
              }

              type SubscribeStream = tokio_stream::wrappers::ReceiverStream<Result<Ack, Status>>;

              async fn subscribe(&self, _request: Request<Header>) -> Result<Response<Self::SubscribeStream>, Status> {
                  Err(Status::unavailable("not in this example"))
              }
          }

          #[tokio::main]
          async fn main() {
              let header = Header { route_id: "lab-a".to_string(), sent_at_ms: 0 };
              let good = Frame { header: Some(header), kind: 1, body: b"MSH|".to_vec() };
              let ack = RelayService.send(Request::new(good)).await.map(|r| r.into_inner());
              println!("{ack:?}");

              let bad = Frame { header: None, kind: 1, body: vec![] };
              if let Err(status) = RelayService.send(Request::new(bad)).await {
                  println!("{:?}: {}", status.code(), status.message());
              }
          }
          ${hide(TONIC + '\n\n' + PROTO_MOD, BODY)}
          ~~~

          «into_inner()» unwraps the message from the request (the request also carries metadata, the gRPC headers). «?» works because every failure has been turned into a «Status» first.

          @stop

          ## The status code is the contract

          The caller's retry logic reads the code, not the message:

          | Status | Tells the caller | grpc-java |
          |---|---|---|
          | «invalid_argument» | your request is wrong: do not retry it | «Status.INVALID_ARGUMENT» |
          | «not_found» | the thing you named does not exist | «NOT_FOUND» |
          | «unavailable» | a passing problem: retry with backoff | «UNAVAILABLE» |
          | «deadline_exceeded» | it took too long; the work may still have happened | «DEADLINE_EXCEEDED» |
          | «internal» | a bug on this side | «INTERNAL» |

          Two slips to look for:

          - A destination that is down reported as «internal»: the caller treats it as a bug and does not retry, when «unavailable» would have been retried.
          - «Status::internal(e.to_string())» or «format!("{e:?}")» sends the internal error text (hosts, SQL, file paths) to another system. Log the detail on this side; send a message the caller can act on.

          ## A server stream is a channel

          tonic sends whatever the handler's stream yields. The usual shape is a spawned task feeding a channel, and «ReceiverStream» turning the receiving end into the stream. When the client goes away, tonic drops the stream, and the task's next «send» fails:

          ~~~rust !run
          use tokio::sync::mpsc;
          use tokio_stream::{wrappers::ReceiverStream, StreamExt};

          #[tokio::main(flavor = "current_thread")]
          async fn main() {
              let (tx, rx) = mpsc::channel::<u32>(4);
              let producer = tokio::spawn(async move {
                  for n in 1.. {
                      if tx.send(n).await.is_err() {
                          println!("the client went away: the producer stops");
                          return;
                      }
                  }
              });

              // what tonic streams to the client; this client reads two acks and hangs up
              let mut stream = ReceiverStream::new(rx);
              for _ in 0..2 {
                  println!("client got {:?}", stream.next().await);
              }
              drop(stream);
              producer.await.unwrap();
          }
          ~~~

          With «let _ = tx.send(n).await» instead, the failure is thrown away and the loop runs for nobody, forever: one leaked task per client that ever subscribed.

          ## A client call waits as long as the server takes

          ~~~rust Timeouts on the client side (display only)
          let channel = Endpoint::from_static("http://relay.internal:50051")
              .connect_timeout(Duration::from_secs(5))
              .timeout(Duration::from_secs(10)) // every call on this channel
              .connect()
              .await?;
          let mut client = RelayClient::new(channel);

          let mut request = Request::new(frame);
          request.set_timeout(Duration::from_secs(2)); // this call only; the server sees it as grpc-timeout
          let ack = client.send(request).await?;
          ~~~

          Without either timeout, a call to a stuck server waits until the server answers, and on a connection that silently died, until the operating system gives up on it, which can take many minutes. On the server side, the same question applies to everything the handler awaits: a destination, a database, a lock.

          :::pitfall gRPC checklist
          1. Every client call: what bounds the wait?
          2. Every «Status»: is the code right for the caller's retries, and is the message free of internal details?
          3. Every generated message it reads: «Option» fields handled, enums through «try_from».
          4. Every server stream: a bounded channel, and a producer that stops when «send» fails.
          :::
        `,
      },
      {
        lesson: 'wi-tests', title: 'Tests: what a test actually proves', mins: 7, hunts: ['logic'],
        remember: 'Unit tests sit next to the code in «#[cfg(test)] mod tests» and can reach private items. A test proves only what it asserts: read the asserts first, because a test with no assert, or one that only checks a mock was called, passes on broken code.',
        cue: 'Any test → cover the asserts with your hand and ask: would this still pass if the function returned the wrong answer?',
        body: R`
          ## Where tests live

          ~~~rust A test module (display only)
          pub fn checksum(body: &[u8]) -> u32 {
              body.iter().map(|b| *b as u32).sum()
          }

          #[cfg(test)] // compiled only for cargo test
          mod tests {
              use super::*; // everything in the parent module, private items too

              #[test]
              fn sums_every_byte() {
                  assert_eq!(checksum(b"MSH|"), 356);
              }

              #[tokio::test(start_paused = true)] // async; time jumps ahead whenever every task is waiting
              async fn gives_up_after_the_idle_timeout() {
                  // ...
              }

              #[test]
              #[should_panic(expected = "empty route")]
              fn rejects_an_empty_route() {
                  // ...
              }

              #[test]
              #[ignore = "needs a real Postgres"]
              fn talks_to_postgres() {
                  // ...
              }
          }
          ~~~

          | Where | Sees | Runs with |
          |---|---|---|
          | «#[cfg(test)] mod tests» in the same file | everything, private items too | «cargo test» |
          | files in «tests/» | only the «pub» API, like another crate | «cargo test» |
          | code examples in «///» comments | the «pub» API | «cargo test» (doc tests) |
          | «#[ignore]» | | skipped unless «cargo test -- --ignored» |

          ## Fakes and mocks

          This lab's tests use hand-written fakes: a trait that the real destination and the fake both implement (the Traits module). Many crates use mockall instead, which writes the fake for you. Here is how it reads:

          ~~~rust mockall, as it usually looks (display only)
          #[automock]
          trait Downstream {
              fn deliver(&self, route: &str, body: &[u8]) -> Result<(), String>;
          }

          let mut mock = MockDownstream::new();
          mock.expect_deliver()
              .withf(|route, body| route == "lab-a" && body.starts_with(b"MSH"))
              .times(1)
              .returning(|_, _| Ok(()));
          ~~~

          | Line | Means |
          |---|---|
          | «expect_deliver()» | «deliver» will be called |
          | «.withf(...)» | ...with arguments that pass this check. Without it, any arguments do |
          | «.times(1)» | exactly once, checked when the mock is dropped. Without it, any number of times, including zero |
          | «.returning(...)» | what the mock answers |

          A call that no expectation matches panics the test. A missing «withf» or «times» quietly checks less.

          @stop

          ## Tests that prove nothing

          ~~~rust A test that looks fine (display only)
          #[tokio::test]
          async fn retries_on_failure() {
              let mut mock = MockDownstream::new();
              mock.expect_deliver().returning(|_, _| Err("down".into()));
              let relay = Relay::new(mock);
              let _ = relay.forward("lab-a", b"MSH|").await;
          }
          ~~~

          It is named after retries, but nothing checks how many times «deliver» ran, and the result is thrown away. Delete the retry loop entirely and this test still passes. It proves only that «forward» does not panic.

          :::pitfall Test checklist
          1. Cover the asserts: what would have to break for this test to fail?
          2. «let _ =» on the result under test, or no assert at all.
          3. A mock with no «withf» and no «times» checks nothing about the call.
          4. Real sleeps make slow, flaky tests. «start_paused» plus tokio's «sleep» makes them instant and exact.
          5. An «#[ignore]»: why, and who runs it?
          :::

          @quiz 0
          @quiz 1
        `,
        quiz: [
          {
            q: 'A mockall expectation has «.times(1)» but no «.withf(...)». What does it check?',
            options: ['That «deliver» is called once, with the right arguments', 'That «deliver» is called exactly once, with any arguments', 'Nothing until «returning» is added', 'That «deliver» is never called'],
            answer: 1,
            why: '«times» counts the calls; «withf» is what checks the arguments. Without it, a call with the wrong route or an empty body still satisfies the test.',
          },
          {
            q: 'A test waits for a retry with «std::thread::sleep(Duration::from_secs(2))». What is the better shape?',
            options: ['A longer sleep, to be safe', '«#[tokio::test(start_paused = true)]» with tokio\'s «sleep», so time jumps ahead and the test is instant and exact', 'Mark it «#[ignore]»', 'Run it in release mode'],
            answer: 1,
            why: 'A real sleep makes the test slow, and flaky on a busy CI machine. With paused time, tokio moves the clock forward whenever every task is waiting, so a two-second backoff takes no real time and always happens in the same order.',
          },
        ],
      },
      {
        exercise: {
          id: 'wi-fix-config', title: 'Make the route config fail loudly', kind: 'fix', mins: 10, diff: 'easy', topics: ['serde'],
          statement: R`
            «load» parses a route's JSON config. The rules:

            - «destination» is required: a config without it is an error.
            - «retries» defaults to 3 and «timeout_ms» to 5000 when they are left out.
            - A field the struct does not know (a typo like «"retires"») is an error, not silently ignored.
            - Broken JSON is an error, not an empty config.

            Press **Run**: the starter accepts almost anything. Fix it with serde attributes and proper error handling.
          `,
          starter: R`
use serde::Deserialize;

#[derive(Debug, Deserialize, Default, PartialEq)]
#[serde(default)]
pub struct RouteConfig {
    pub destination: String,
    pub retries: u32,
    pub timeout_ms: u64,
}

/// Parses a route's JSON config.
pub fn load(json: &str) -> Result<RouteConfig, String> {
    Ok(serde_json::from_str(json).unwrap_or_default())
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'a full config parses', ex: true, code: R`let c = load(r#"{"destination": "tcp://192.0.2.10:5100", "retries": 5, "timeout_ms": 2000}"#).unwrap();
assert_eq!(c, RouteConfig { destination: "tcp://192.0.2.10:5100".to_string(), retries: 5, timeout_ms: 2000 });` },
            { name: 'a missing destination is an error', ex: true, code: R`assert!(load(r#"{"retries": 5}"#).is_err(), "a config without a destination was accepted");` },
            { name: 'retries and timeout have defaults', ex: true, code: R`let c = load(r#"{"destination": "tcp://192.0.2.10:5100"}"#).unwrap();
assert_eq!((c.retries, c.timeout_ms), (3, 5000));` },
            { name: 'a misspelt field is an error', code: R`assert!(load(r#"{"destination": "tcp://192.0.2.10:5100", "retires": 5}"#).is_err(), "the typo retires was silently ignored");` },
            { name: 'broken JSON is an error', code: R`assert!(load("{").is_err());` },
            { name: 'a negative retry count is an error', code: R`assert!(load(r#"{"destination": "x", "retries": -1}"#).is_err());` },
          ],
          hints: [
            'Which attribute makes every missing field quietly take its default? Required fields must not have one.',
            'A default other than 0 needs «#[serde(default = "some_function")]» on that field, and a plain function returning the value.',
            'Typos: «#[serde(deny_unknown_fields)]» on the struct. Errors: «map_err» instead of «unwrap_or_default».',
          ],
          solution: {
            rust: R`
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RouteConfig {
    pub destination: String,
    #[serde(default = "default_retries")]
    pub retries: u32,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

fn default_retries() -> u32 {
    3
}

fn default_timeout_ms() -> u64 {
    5000
}

/// Parses a route's JSON config.
pub fn load(json: &str) -> Result<RouteConfig, String> {
    serde_json::from_str(json).map_err(|e| format!("bad route config: {e}"))
}
`,
            why: R`
              - «#[serde(default)]» on the struct gave **every** field a default, «destination» included, so a config without a destination became one with an empty destination.
              - Per-field «default = "..."» keeps «destination» required and gives the other two their real defaults, not 0.
              - «deny_unknown_fields» turns a typo into an error. Without it serde ignores unknown keys, and «retires: 5» would leave retries at 3 with nobody noticing.
              - «unwrap_or_default()» turned every parse error into an empty config. «map_err» keeps serde's message, which names the field and the position.
            `,
            talk: 'The struct-level serde(default) made even destination optional, and unwrap_or_default turned any parse error into an empty config. I made destination required, gave retries and timeout their real defaults with per-field default functions, denied unknown fields so typos fail, and returned serde\'s error instead of swallowing it.',
          },
          wrong: [
            { name: 'keeps the struct-level default', rust: R`
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq)]
#[serde(default, deny_unknown_fields)]
pub struct RouteConfig {
    pub destination: String,
    pub retries: u32,
    pub timeout_ms: u64,
}

impl Default for RouteConfig {
    fn default() -> Self {
        RouteConfig { destination: String::new(), retries: 3, timeout_ms: 5000 }
    }
}

pub fn load(json: &str) -> Result<RouteConfig, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}
` },
            { name: 'still ignores unknown fields', rust: R`
use serde::Deserialize;

#[derive(Debug, Deserialize, PartialEq)]
pub struct RouteConfig {
    pub destination: String,
    #[serde(default = "default_retries")]
    pub retries: u32,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
}

fn default_retries() -> u32 { 3 }
fn default_timeout_ms() -> u64 { 5000 }

pub fn load(json: &str) -> Result<RouteConfig, String> {
    serde_json::from_str(json).map_err(|e| e.to_string())
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'wi-build-proto', title: 'Check a generated frame once, at the edge', kind: 'build', mins: 12, diff: 'medium', topics: ['protobuf'],
          statement: R`
            Implement «TryFrom<proto::Frame> for Frame»: turn the generated wire type into a «Frame» the rest of the relay can trust.

            - No header: «BadFrame::MissingHeader».
            - An empty «route_id»: «BadFrame::EmptyRoute».
            - The kind must be «Data» or «Ack». «Unspecified» and any value this build does not know: «BadFrame::UnknownKind(raw value)».
            - The proto frame is yours (it is passed by value), so move its fields rather than copying them.

            The «proto» module at the top is what prost generates for «relay.proto», minus the «#[prost(...)]» attribute lines (the Playground has no prost). Read it; do not change it.
          `,
          starter: R`
pub mod proto {
    // Generated by prost from relay.proto. Attribute lines left out.
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Header {
        pub route_id: String,
        pub sent_at_ms: i64,
    }

    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Frame {
        pub header: Option<Header>,
        pub kind: i32,
        pub body: Vec<u8>,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
    #[repr(i32)]
    pub enum Kind {
        #[default]
        Unspecified = 0,
        Data = 1,
        Ack = 2,
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UnknownEnumValue(pub i32);

    impl TryFrom<i32> for Kind {
        type Error = UnknownEnumValue;
        fn try_from(value: i32) -> Result<Kind, UnknownEnumValue> {
            match value {
                0 => Ok(Kind::Unspecified),
                1 => Ok(Kind::Data),
                2 => Ok(Kind::Ack),
                other => Err(UnknownEnumValue(other)),
            }
        }
    }

    impl Frame {
        /// Returns the enum value of kind, or the default if the field holds an unknown value.
        pub fn kind(&self) -> Kind {
            Kind::try_from(self.kind).unwrap_or(Kind::default())
        }
    }
}

/// A frame the rest of the relay can trust.
#[derive(Debug, PartialEq)]
pub struct Frame {
    pub route_id: String,
    pub kind: FrameKind,
    pub body: Vec<u8>,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum FrameKind {
    Data,
    Ack,
}

#[derive(Debug, PartialEq)]
pub enum BadFrame {
    MissingHeader,
    EmptyRoute,
    UnknownKind(i32),
}

impl TryFrom<proto::Frame> for Frame {
    type Error = BadFrame;

    fn try_from(f: proto::Frame) -> Result<Frame, BadFrame> {
        todo!()
    }
}
`,
          starterFails: 'tests',
          tests: [
            { name: 'a data frame converts', ex: true, code: R`let wire = proto::Frame { header: Some(proto::Header { route_id: "lab-a".into(), sent_at_ms: 1 }), kind: 1, body: b"MSH|".to_vec() };
assert_eq!(Frame::try_from(wire), Ok(Frame { route_id: "lab-a".into(), kind: FrameKind::Data, body: b"MSH|".to_vec() }));` },
            { name: 'no header', ex: true, code: R`let wire = proto::Frame { header: None, kind: 1, body: vec![] };
assert_eq!(Frame::try_from(wire), Err(BadFrame::MissingHeader));` },
            { name: 'a kind this build does not know', ex: true, code: R`let wire = proto::Frame { header: Some(proto::Header { route_id: "lab-a".into(), sent_at_ms: 1 }), kind: 7, body: vec![] };
assert_eq!(Frame::try_from(wire), Err(BadFrame::UnknownKind(7)));` },
            { name: 'an unspecified kind', code: R`let wire = proto::Frame { header: Some(proto::Header { route_id: "lab-a".into(), sent_at_ms: 1 }), kind: 0, body: vec![] };
assert_eq!(Frame::try_from(wire), Err(BadFrame::UnknownKind(0)));` },
            { name: 'an empty route', code: R`let wire = proto::Frame { header: Some(proto::Header { route_id: String::new(), sent_at_ms: 1 }), kind: 1, body: vec![] };
assert_eq!(Frame::try_from(wire), Err(BadFrame::EmptyRoute));` },
            { name: 'an ack with no body', code: R`let wire = proto::Frame { header: Some(proto::Header { route_id: "lab-b".into(), sent_at_ms: 1 }), kind: 2, body: vec![] };
assert_eq!(Frame::try_from(wire), Ok(Frame { route_id: "lab-b".into(), kind: FrameKind::Ack, body: vec![] }));` },
          ],
          lint: [
            { re: '\\.kind\\(\\)', when: 'present', note: 'The generated «kind()» getter turns an unknown value into «Unspecified», so the raw number is gone. «proto::Kind::try_from(f.kind)» keeps it.' },
            { re: '\\.clone\\(\\)|\\.to_vec\\(\\)|\\.to_string\\(\\)', when: 'present', note: 'The proto frame is owned: moving «header.route_id» and «f.body» out of it is free, where a copy costs as much as the body.' },
          ],
          hints: [
            '«f.header» is an «Option»: «.ok_or(BadFrame::MissingHeader)?» turns «None» into your error.',
            'Match on «proto::Kind::try_from(f.kind)»: «Ok(Kind::Data)», «Ok(Kind::Ack)», and everything else is unknown.',
            'Keep «f.kind» (the raw «i32») for the error value.',
          ],
          solution: {
            rust: R`
pub mod proto {
    // Generated by prost from relay.proto. Attribute lines left out.
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Header {
        pub route_id: String,
        pub sent_at_ms: i64,
    }

    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Frame {
        pub header: Option<Header>,
        pub kind: i32,
        pub body: Vec<u8>,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
    #[repr(i32)]
    pub enum Kind {
        #[default]
        Unspecified = 0,
        Data = 1,
        Ack = 2,
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UnknownEnumValue(pub i32);

    impl TryFrom<i32> for Kind {
        type Error = UnknownEnumValue;
        fn try_from(value: i32) -> Result<Kind, UnknownEnumValue> {
            match value {
                0 => Ok(Kind::Unspecified),
                1 => Ok(Kind::Data),
                2 => Ok(Kind::Ack),
                other => Err(UnknownEnumValue(other)),
            }
        }
    }

    impl Frame {
        /// Returns the enum value of kind, or the default if the field holds an unknown value.
        pub fn kind(&self) -> Kind {
            Kind::try_from(self.kind).unwrap_or(Kind::default())
        }
    }
}

/// A frame the rest of the relay can trust.
#[derive(Debug, PartialEq)]
pub struct Frame {
    pub route_id: String,
    pub kind: FrameKind,
    pub body: Vec<u8>,
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum FrameKind {
    Data,
    Ack,
}

#[derive(Debug, PartialEq)]
pub enum BadFrame {
    MissingHeader,
    EmptyRoute,
    UnknownKind(i32),
}

impl TryFrom<proto::Frame> for Frame {
    type Error = BadFrame;

    fn try_from(f: proto::Frame) -> Result<Frame, BadFrame> {
        let header = f.header.ok_or(BadFrame::MissingHeader)?;
        if header.route_id.is_empty() {
            return Err(BadFrame::EmptyRoute);
        }
        let kind = match proto::Kind::try_from(f.kind) {
            Ok(proto::Kind::Data) => FrameKind::Data,
            Ok(proto::Kind::Ack) => FrameKind::Ack,
            Ok(proto::Kind::Unspecified) | Err(_) => return Err(BadFrame::UnknownKind(f.kind)),
        };
        Ok(Frame { route_id: header.route_id, kind, body: f.body })
    }
}
`,
            why: R`
              - «ok_or(...)?» turns a missing header into your own error in one line, and moves the «Header» out of the «Option».
              - «proto::Kind::try_from» keeps "unknown" separate from «Unspecified». The generated «kind()» getter would have folded 7 into «Unspecified», losing the value you want in the error.
              - «Unspecified» is rejected too: in proto3 it is what an unset field reads as, so it means the sender did not say.
              - «header.route_id» and «f.body» are moved, not cloned: the frame was passed by value, so the conversion copies nothing.
            `,
            talk: 'The generated frame is checked once at the boundary: a missing header, an empty route, or a kind that is unspecified or unknown to this build each become a specific error, and the rest of the relay only ever sees a Frame with a real route and kind. I used Kind::try_from instead of the generated getter because the getter maps unknown values to Unspecified.',
          },
          wrong: [
            { name: 'unwraps the header', rust: R`
pub mod proto {
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Header { pub route_id: String, pub sent_at_ms: i64 }
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Frame { pub header: Option<Header>, pub kind: i32, pub body: Vec<u8> }
    #[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
    #[repr(i32)]
    pub enum Kind { #[default] Unspecified = 0, Data = 1, Ack = 2 }
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UnknownEnumValue(pub i32);
    impl TryFrom<i32> for Kind {
        type Error = UnknownEnumValue;
        fn try_from(value: i32) -> Result<Kind, UnknownEnumValue> {
            match value { 0 => Ok(Kind::Unspecified), 1 => Ok(Kind::Data), 2 => Ok(Kind::Ack), other => Err(UnknownEnumValue(other)) }
        }
    }
}
#[derive(Debug, PartialEq)]
pub struct Frame { pub route_id: String, pub kind: FrameKind, pub body: Vec<u8> }
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum FrameKind { Data, Ack }
#[derive(Debug, PartialEq)]
pub enum BadFrame { MissingHeader, EmptyRoute, UnknownKind(i32) }
impl TryFrom<proto::Frame> for Frame {
    type Error = BadFrame;
    fn try_from(f: proto::Frame) -> Result<Frame, BadFrame> {
        let header = f.header.unwrap();
        if header.route_id.is_empty() { return Err(BadFrame::EmptyRoute); }
        let kind = match proto::Kind::try_from(f.kind) {
            Ok(proto::Kind::Data) => FrameKind::Data,
            Ok(proto::Kind::Ack) => FrameKind::Ack,
            _ => return Err(BadFrame::UnknownKind(f.kind)),
        };
        Ok(Frame { route_id: header.route_id, kind, body: f.body })
    }
}
` },
            { name: 'unknown kinds become data', rust: R`
pub mod proto {
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Header { pub route_id: String, pub sent_at_ms: i64 }
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Frame { pub header: Option<Header>, pub kind: i32, pub body: Vec<u8> }
    #[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
    #[repr(i32)]
    pub enum Kind { #[default] Unspecified = 0, Data = 1, Ack = 2 }
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UnknownEnumValue(pub i32);
    impl TryFrom<i32> for Kind {
        type Error = UnknownEnumValue;
        fn try_from(value: i32) -> Result<Kind, UnknownEnumValue> {
            match value { 0 => Ok(Kind::Unspecified), 1 => Ok(Kind::Data), 2 => Ok(Kind::Ack), other => Err(UnknownEnumValue(other)) }
        }
    }
    impl Frame {
        pub fn kind(&self) -> Kind { Kind::try_from(self.kind).unwrap_or(Kind::default()) }
    }
}
#[derive(Debug, PartialEq)]
pub struct Frame { pub route_id: String, pub kind: FrameKind, pub body: Vec<u8> }
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum FrameKind { Data, Ack }
#[derive(Debug, PartialEq)]
pub enum BadFrame { MissingHeader, EmptyRoute, UnknownKind(i32) }
impl TryFrom<proto::Frame> for Frame {
    type Error = BadFrame;
    fn try_from(f: proto::Frame) -> Result<Frame, BadFrame> {
        let kind = match f.kind() {
            proto::Kind::Ack => FrameKind::Ack,
            _ => FrameKind::Data,
        };
        let header = f.header.ok_or(BadFrame::MissingHeader)?;
        if header.route_id.is_empty() { return Err(BadFrame::EmptyRoute); }
        Ok(Frame { route_id: header.route_id, kind, body: f.body })
    }
}
` },
            { name: 'forgets the empty route', rust: R`
pub mod proto {
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Header { pub route_id: String, pub sent_at_ms: i64 }
    #[derive(Clone, PartialEq, Debug, Default)]
    pub struct Frame { pub header: Option<Header>, pub kind: i32, pub body: Vec<u8> }
    #[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
    #[repr(i32)]
    pub enum Kind { #[default] Unspecified = 0, Data = 1, Ack = 2 }
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UnknownEnumValue(pub i32);
    impl TryFrom<i32> for Kind {
        type Error = UnknownEnumValue;
        fn try_from(value: i32) -> Result<Kind, UnknownEnumValue> {
            match value { 0 => Ok(Kind::Unspecified), 1 => Ok(Kind::Data), 2 => Ok(Kind::Ack), other => Err(UnknownEnumValue(other)) }
        }
    }
}
#[derive(Debug, PartialEq)]
pub struct Frame { pub route_id: String, pub kind: FrameKind, pub body: Vec<u8> }
#[derive(Debug, PartialEq, Clone, Copy)]
pub enum FrameKind { Data, Ack }
#[derive(Debug, PartialEq)]
pub enum BadFrame { MissingHeader, EmptyRoute, UnknownKind(i32) }
impl TryFrom<proto::Frame> for Frame {
    type Error = BadFrame;
    fn try_from(f: proto::Frame) -> Result<Frame, BadFrame> {
        let header = f.header.ok_or(BadFrame::MissingHeader)?;
        let kind = match proto::Kind::try_from(f.kind) {
            Ok(proto::Kind::Data) => FrameKind::Data,
            Ok(proto::Kind::Ack) => FrameKind::Ack,
            _ => return Err(BadFrame::UnknownKind(f.kind)),
        };
        Ok(Frame { route_id: header.route_id, kind, body: f.body })
    }
}
` },
          ],
        },
      },
      {
        exercise: {
          id: 'wi-review-grpc', title: 'Find the bugs: a gRPC service', kind: 'review', mins: 18, diff: 'hard', topics: ['grpc'],
          file: 'src/relay_service.rs',
          statement: R`
            **The change:** Implements «Send» (deliver one frame to its route's destination and ack it) and «Subscribe» (a heartbeat ack every second, so the engine knows the relay is alive).

            Context: the engine, a Java service, calls «Send» for every frame and retries calls that fail with «UNAVAILABLE». Frames reach the engine from other systems, and a newer engine version may send kinds this relay does not know yet. A destination can stall for minutes. The generated «proto» code and tonic itself are not shown (on the Playground they are stand-ins with the same names).
          `,
          code: R`
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};

use crate::proto::relay_server::Relay;
use crate::proto::{Ack, Frame, Header, Kind};

/// Delivers a frame to its route's destination. TCP in production; the tests pass in fakes.
#[async_trait::async_trait]
pub trait Downstream: Send + Sync + 'static {
    async fn deliver(&self, route_id: &str, body: &[u8]) -> Result<(), String>;
}

+pub struct RelayService<D> {
+    downstream: D,
+}
+
+#[tonic::async_trait]
+impl<D: Downstream> Relay for RelayService<D> {
+    async fn send(&self, request: Request<Frame>) -> Result<Response<Ack>, Status> {
+        let frame = request.into_inner(); ⟦d1⟧
+        let is_ack = frame.kind() == Kind::Ack; ⟦b⟧
+        let route_id = frame.header.unwrap().route_id; ⟦a⟧
+        if is_ack {
+            return Ok(Response::new(Ack { route_id, accepted: true }));
+        }
+        self.downstream
+            .deliver(&route_id, &frame.body)
+            .await ⟦c⟧
+            .map_err(|e| Status::internal(format!("delivery failed: {e:?}")))?; ⟦e⟧
+        Ok(Response::new(Ack { route_id, accepted: true }))
+    }
+
+    type SubscribeStream = ReceiverStream<Result<Ack, Status>>;
+
+    async fn subscribe(&self, request: Request<Header>) -> Result<Response<Self::SubscribeStream>, Status> {
+        let route_id = request.into_inner().route_id;
+        let (tx, rx) = mpsc::channel(16);
+        tokio::spawn(async move {
+            let mut ticker = tokio::time::interval(Duration::from_secs(1));
+            loop {
+                ticker.tick().await;
+                let _ = tx.send(Ok(Ack { route_id: route_id.clone(), accepted: true })).await; ⟦g⟧
+            }
+        });
+        Ok(Response::new(ReceiverStream::new(rx))) ⟦d2⟧
+    }
+}
${hide(TONIC + '\n\n' + PROTO_MOD)}
`,
          issues: [
            {
              id: 'a', tag: 'panic', title: 'A frame without a header crashes the handler',
              why: 'A message field is an «Option». A frame without a header, from a broken sender, reaches «unwrap» and panics inside the handler. That call ends with a transport error instead of the «INVALID_ARGUMENT» the engine could act on, and every broken frame puts a panic in the logs.',
              fix: '«frame.header.ok_or_else(|| Status::invalid_argument("frame has no header"))?.route_id».',
              demoAsync: true,
              demo: 'struct Fake;\n#[async_trait::async_trait]\nimpl Downstream for Fake {\n    async fn deliver(&self, _route: &str, _body: &[u8]) -> Result<(), String> { Ok(()) }\n}\nlet svc = RelayService { downstream: Fake };\nlet got = svc.send(Request::new(Frame { header: None, kind: 1, body: vec![] })).await;\nassert_eq!(got.unwrap_err().code(), tonic::Code::InvalidArgument);',
            },
            {
              id: 'b', tag: 'logic', title: 'Unknown kinds are delivered as data',
              why: 'The generated «kind()» getter turns any value this build does not know into «Unspecified». Everything that is not «Ack» then falls through to delivery, so when a newer engine sends a new kind (a NACK, say), the relay delivers it downstream as if it were data.',
              fix: 'Match on «Kind::try_from(frame.kind)»: «Ok(Kind::Ack)» acks, «Ok(Kind::Data)» delivers, and «Unspecified» or an unknown value returns «Status::invalid_argument».',
              demoAsync: true,
              demo: 'use std::sync::atomic::{AtomicUsize, Ordering};\nuse std::sync::Arc;\nstruct Count(Arc<AtomicUsize>);\n#[async_trait::async_trait]\nimpl Downstream for Count {\n    async fn deliver(&self, _route: &str, _body: &[u8]) -> Result<(), String> { self.0.fetch_add(1, Ordering::SeqCst); Ok(()) }\n}\nlet delivered = Arc::new(AtomicUsize::new(0));\nlet svc = RelayService { downstream: Count(delivered.clone()) };\nlet frame = Frame { header: Some(Header { route_id: "lab-a".into(), sent_at_ms: 0 }), kind: 3, body: b"MSH|".to_vec() };\nlet _ = svc.send(Request::new(frame)).await;\nassert_eq!(delivered.load(Ordering::SeqCst), 0, "a frame of unknown kind 3 was delivered as data");',
            },
            {
              id: 'c', tag: 'hang', title: 'A stalled destination holds the call for as long as it stalls',
              why: 'Nothing bounds the wait on «deliver». A destination that stalls for minutes holds every «Send» call for minutes; the engine\'s calls pile up behind it, and the engine never gets the «UNAVAILABLE» it would retry on.',
              fix: 'Wrap it: «tokio::time::timeout(DELIVERY_TIMEOUT, self.downstream.deliver(..))», and answer «Status::unavailable» when it expires.',
              demoAsync: 'paused',
              demo: 'struct Stalled;\n#[async_trait::async_trait]\nimpl Downstream for Stalled {\n    async fn deliver(&self, _route: &str, _body: &[u8]) -> Result<(), String> { std::future::pending::<Result<(), String>>().await }\n}\nlet svc = RelayService { downstream: Stalled };\nlet frame = Frame { header: Some(Header { route_id: "lab-a".into(), sent_at_ms: 0 }), kind: 1, body: vec![] };\nlet got = tokio::time::timeout(Duration::from_secs(600), svc.send(Request::new(frame))).await;\nassert!(got.is_ok(), "send was still waiting on the destination after 10 minutes");',
            },
            {
              id: 'e', tag: 'logic', title: 'A destination that is down is reported as a bug, with its internals',
              why: '«INTERNAL» tells the engine "a bug on this side", so it does not retry, when a destination that is down is exactly the case «UNAVAILABLE» and the engine\'s retries exist for. And «{e:?}» sends the internal error text (host, port, OS error) to another system.',
              fix: 'Log the detail here, and return «Status::unavailable("destination unavailable, retry later")».',
              demoAsync: true,
              demo: 'struct Down;\n#[async_trait::async_trait]\nimpl Downstream for Down {\n    async fn deliver(&self, _route: &str, _body: &[u8]) -> Result<(), String> { Err("connect 192.0.2.10:5100: connection refused (os error 111)".into()) }\n}\nlet svc = RelayService { downstream: Down };\nlet frame = Frame { header: Some(Header { route_id: "lab-a".into(), sent_at_ms: 0 }), kind: 1, body: vec![] };\nlet status = svc.send(Request::new(frame)).await.unwrap_err();\nassert_eq!(status.code(), tonic::Code::Unavailable, "a destination that is down should be retried");\nassert!(!status.message().contains("192.0.2.10"), "internal details sent to the caller");',
            },
            {
              id: 'g', tag: 'swallow', title: 'The heartbeat task never learns that the engine left',
              why: 'When the engine drops the stream, «send» returns «Err». «let _ =» throws that away, so the loop keeps ticking for nobody, forever. Every «Subscribe» call ever made leaves one task running, and they add up until the process restarts.',
              fix: '«if tx.send(..).await.is_err() { break; }»: the failed send is the signal that the subscriber is gone.',
            },
          ],
          decoys: [
            { id: 'd1', why: '«into_inner()» takes the message out of the request (dropping the metadata). That is the normal first line of a handler.' },
            { id: 'd2', why: 'Returning a «ReceiverStream» over a bounded channel is the standard way to implement a server stream, and the channel here is bounded.' },
          ],
          hints: [
            'Five issues. Two are about the generated types, which lesson "Generated protobuf code" covered.',
            'The engine retries only on «UNAVAILABLE». Which failure here should be retried, and what does it get instead?',
            'In «subscribe»: what happens to the spawned task after the engine disconnects?',
          ],
          solution: {
            fixed: R`
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};
use tracing::warn;

use crate::proto::relay_server::Relay;
use crate::proto::{Ack, Frame, Header, Kind};

const DELIVERY_TIMEOUT: Duration = Duration::from_secs(10);

/// Delivers a frame to its route's destination. TCP in production; the tests pass in fakes.
#[async_trait::async_trait]
pub trait Downstream: Send + Sync + 'static {
    async fn deliver(&self, route_id: &str, body: &[u8]) -> Result<(), String>;
}

pub struct RelayService<D> {
    downstream: D,
}

#[tonic::async_trait]
impl<D: Downstream> Relay for RelayService<D> {
    async fn send(&self, request: Request<Frame>) -> Result<Response<Ack>, Status> {
        let frame = request.into_inner();
        let route_id = frame
            .header
            .ok_or_else(|| Status::invalid_argument("frame has no header"))?
            .route_id;
        match Kind::try_from(frame.kind) {
            Ok(Kind::Ack) => return Ok(Response::new(Ack { route_id, accepted: true })),
            Ok(Kind::Data) => {}
            Ok(Kind::Unspecified) | Err(_) => {
                return Err(Status::invalid_argument(format!("unknown frame kind {}", frame.kind)));
            }
        }
        match tokio::time::timeout(DELIVERY_TIMEOUT, self.downstream.deliver(&route_id, &frame.body)).await {
            Ok(Ok(())) => Ok(Response::new(Ack { route_id, accepted: true })),
            Ok(Err(e)) => {
                warn!(route = %route_id, error = %e, "delivery failed");
                Err(Status::unavailable("destination unavailable, retry later"))
            }
            Err(_) => {
                warn!(route = %route_id, "delivery timed out");
                Err(Status::unavailable("destination did not answer in time, retry later"))
            }
        }
    }

    type SubscribeStream = ReceiverStream<Result<Ack, Status>>;

    async fn subscribe(&self, request: Request<Header>) -> Result<Response<Self::SubscribeStream>, Status> {
        let route_id = request.into_inner().route_id;
        let (tx, rx) = mpsc::channel(16);
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_secs(1));
            loop {
                ticker.tick().await;
                let ack = Ack { route_id: route_id.clone(), accepted: true };
                if tx.send(Ok(ack)).await.is_err() {
                    break; // the subscriber is gone
                }
            }
        });
        Ok(Response::new(ReceiverStream::new(rx)))
    }
}
${hide(TONIC + '\n\n' + PROTO_MOD)}
`,
            talk: 'Two issues come from the generated types: header.unwrap() panics on a frame without a header, and the kind() getter folds unknown kinds into Unspecified, so a new kind from a newer engine is delivered as data. The delivery has no timeout, so a stalled destination holds every call. Its failure comes back as INTERNAL with the raw error text, so the engine does not retry and learns our hosts. And the heartbeat task ignores the failed send, so it runs forever after every subscriber leaves.',
          },
        },
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
