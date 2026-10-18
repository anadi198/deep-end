(function (root) {
  const BL = root.BL, R = BL.R;
  BL.module({
    id: 'grpc', title: 'gRPC between services', short: 'gRPC',
    blurb: 'What a gRPC call is on the wire, the schema changes that silently break clients, deadlines and retries, why long-lived connections defeat load balancers, performance, and running gRPC through NAT, including flipping it with a reverse tunnel. Facts checked against grpc-java 1.85.',
    intro: R`
      gRPC is a remote procedure call framework: you describe a service in a «.proto» file, generate client and server code, and call methods across the network. Underneath it is HTTP/2 and Protocol Buffers, and most production surprises come from those two layers, from defaults that are not what you would guess, and from the network in between.
    `,
    items: [
      /* ───────────── 1. the wire ───────────── */
      {
        lesson: 'grpc-wire', title: 'A gRPC call on the wire, and schema changes that break clients', mins: 13,
        remember: 'A gRPC call is one HTTP/2 stream: headers, length-prefixed protobuf messages, and trailers carrying the status. Protobuf identifies fields by number, not name, so a reused field number or an incompatible type change silently corrupts data between old and new code.',
        cue: 'a .proto change in review → check for reused or retyped field numbers, removed fields without «reserved», and an enum whose zero value means something real',
        body: R`
          ## One call

          1. The client has one long-lived **HTTP/2 connection** to a server. Each call is a **stream** on it, so many calls share the connection at once.
          2. The call opens with **headers**: the path «/package.Service/Method», «content-type: application/grpc», and «grpc-timeout» if the call has a deadline.
          3. Each message is sent in DATA frames as a 1-byte compressed flag, a 4-byte length, and the protobuf bytes.
          4. The server answers with headers, its messages, then **trailers**: «grpc-status» and «grpc-message». The status is in the trailers, which is why proxies that drop HTTP/2 trailers break gRPC.

          | Call type | Client sends | Server sends | Typical use |
          |---|---|---|---|
          | Unary | one message | one message | a normal request |
          | Server streaming | one | many | a large result, a feed |
          | Client streaming | many | one | an upload |
          | Bidirectional | many | many | a long-lived session, commands and events |

          ## Status codes worth knowing

          | Code | Means | Retry? |
          |---|---|---|
          | UNAVAILABLE (14) | the server could not be reached or is shutting down | usually, with back-off, if the call is idempotent |
          | DEADLINE_EXCEEDED (4) | the deadline passed; the server may have done the work | only if idempotent |
          | CANCELLED (1) | the caller gave up | no |
          | RESOURCE_EXHAUSTED (8) | a limit: quota, or a message over the size limit | not blindly |
          | INVALID_ARGUMENT (3), NOT_FOUND (5), FAILED_PRECONDITION (9) | the request is wrong | no |
          | INTERNAL (13), UNKNOWN (2) | a bug or an unexpected error | no |

          ## How protobuf encodes a message

          Each field is written as a **tag** and a value. The tag is «(field number << 3) | wire type», so the field's **number** identifies it, never its name. Field numbers 1 to 15 take one byte. Integers are varints (small numbers take fewer bytes); strings, bytes and nested messages are length-prefixed. A reader that meets a field number it does not know skips it using the wire type, and proto3 keeps such unknown fields when it re-serialises.

          ## Changes that are safe, and changes that are not

          | Change | Safe? |
          |---|---|
          | Add a field with a new number | yes: old readers skip it, new readers see the default when it is missing |
          | Rename a field | yes on the wire (names are not sent), but breaks JSON and code |
          | Delete a field | only if you «reserved» its number and name, so nobody reuses them |
          | Reuse a field number for something else | **no**: old code reads the new data as the old field |
          | int32 to int64 (or uint32, uint64, bool) | yes, the same varint (values may be truncated by old readers) |
          | int64 to sint64 | **no**: sint uses zigzag encoding, so values are read as different numbers |
          | Add an enum value | yes, but old readers see an unknown number |

          In proto3 the first enum value must be **0**, and 0 is also what a reader sees when the field is unset. Make it «X_UNSPECIFIED = 0», never a real state.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Field 4 used to be «bool refunded». Someone deleted it and added «string currency = 4». What happens with old clients?', options: ['Nothing: names differ', 'Old code reads the currency bytes as field 4 and misinterprets them', 'The server rejects old clients', 'Protobuf detects the conflict'], answer: 1, why: 'Fields are identified by number only. Reserve deleted numbers so they are never reused.' },
          { q: 'Where is a gRPC call\'s status sent?', options: ['In the HTTP status line', 'In HTTP/2 trailers: grpc-status and grpc-message', 'In the first message', 'In a separate stream'], answer: 1, why: 'Trailers come after the response messages. A proxy that strips trailers breaks every call.' },
        ],
        defend: [
          {
            q: 'How do you evolve a gRPC API without breaking existing clients?',
            weak: 'We version the API as v1 and v2, and we never rename fields so old clients keep working.',
            whyWeak: 'Renaming is actually safe on the wire; what breaks clients is reusing or retyping field numbers, which this does not mention.',
            follow: [
              { q: 'What identifies a field on the wire?', a: 'Its number, combined with the wire type into the tag. Names are not sent in the binary format.' },
              { q: 'How do you remove a field safely?', a: 'Delete it and add «reserved» for its number and name, so a later change cannot reuse them.' },
              { q: 'Which type changes are safe?', a: 'Among int32, uint32, int64, uint64 and bool (same varint encoding). Not int64 to sint64 (zigzag), and not a number reused for a different type.' },
              { q: 'What about enums?', a: 'The first value must be 0 and is what an unset field reads as, so it should be UNSPECIFIED. New values are safe, but old readers must handle unknown numbers.' },
              { q: 'How do you catch breaking changes before they ship?', a: 'A breaking-change check in CI on the .proto files (for example buf breaking), plus contract tests between old clients and the new server.' },
            ],
            strong: [
              'Fields are identified by number; names do not travel.',
              'Add new fields, reserve removed ones, never reuse a number.',
              'Know the wire-compatible type changes.',
              'Enum zero is UNSPECIFIED.',
              'Automate the check in CI.',
            ],
            flags: ['Thinks renaming breaks the wire format', 'Reuses field numbers', 'A real state as enum value 0'],
          },
        ],
        gaps: [
          {
            title: 'A payment message, version 2',
            intro: 'This is the new version of a message that old clients still read and write. Comments show what changed. Which changes break old clients?',
            lang: 'proto',
            code: R`
              syntax = "proto3";

              message Payment {
                string id = 1; ⟦ok1⟧
                int64 amount_cents = 2;   // was: int32 amount_cents = 2 ⟦ok2⟧
                // removed: string customer_email = 3; ⟦reserve⟧
                string currency = 4;      // was: bool refunded = 4 ⟦reuse⟧
                sint64 balance_cents = 5; // was: int64 balance_cents = 5 ⟦sint⟧
                Status status = 6;
                string note = 7;          // new ⟦ok3⟧
              }

              enum Status {
                CAPTURED = 0; ⟦enum0⟧
                REFUNDED = 1;
              }
            `,
            issues: [
              { id: 'reuse', kind: 'wrong', title: 'Field 4 reused with a different type', why: 'Old clients still send and read field 4 as the refunded flag. The two sides now interpret the same bytes differently.', fix: 'Give currency a new number (8) and «reserved 4; reserved "refunded";».' },
              { id: 'sint', kind: 'wrong', title: 'int64 changed to sint64', why: 'sint64 uses zigzag encoding, so the same varint bytes mean different numbers: a balance of 5 written by old code reads as -3 in new code.', fix: 'Keep int64, or add a new field and migrate.' },
              { id: 'reserve', kind: 'wrong', title: 'A removed field without «reserved»', why: 'Nothing stops the next change from reusing number 3 or the name, which recreates the field-4 problem.', fix: '«reserved 3; reserved "customer_email";».' },
              { id: 'enum0', kind: 'wrong', title: 'A real status as enum value 0', why: 'An unset status reads as 0, so a payment whose status was never set looks CAPTURED.', fix: '«STATUS_UNSPECIFIED = 0;» then the real values.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Unchanged and fine.' },
              { id: 'ok2', why: 'int32 to int64 is wire-compatible: both are varints. Old readers truncate values that do not fit in 32 bits, so check the range, but nothing is misread.' },
              { id: 'ok3', why: 'A new field with a new number is the safe way to add data.' },
            ],
          },
        ],
      },

      /* ───────────── 2. deadlines and retries ───────────── */
      {
        lesson: 'grpc-deadlines', title: 'Deadlines, cancellation and retries', mins: 12,
        remember: 'gRPC sets no deadline unless you do, and a call without one can wait forever. In Java the deadline travels with the Context into every call made while handling a request, and gRPC retries only what it knows the server never saw, unless you configure a retry policy: then only idempotent methods, only on UNAVAILABLE, with back-off.',
        cue: 'a stub used without withDeadlineAfter, work handed to a new thread, or a retry policy listing DEADLINE_EXCEEDED → ask what happens to a hung call, a lost deadline, and a duplicated side effect',
        body: R`
          ## Deadlines

          gRPC sets **no deadline by default**. Give every call one: «stub.withDeadlineAfter(300, MILLISECONDS)». The Requests module explains why a deadline is not the server stopping: the server may still finish the work.

          The deadline is sent as «grpc-timeout»: the time *remaining*, not a clock time, so clock skew does not matter. On the server, grpc-java puts it in the request's **Context**, and any call made from that Context uses the earlier of its own deadline and the Context's. So a deadline set at the edge shrinks as it passes through each service, and nobody downstream keeps working long after the user gave up.

          Two ways to lose it:
          - Doing the downstream call on **another thread** (an executor, «CompletableFuture.supplyAsync») without carrying the Context: that call has no deadline. Wrap the task with «Context.current().wrap(...)».
          - Ignoring **cancellation**: when the client cancels or its deadline passes, the server's Context is cancelled. Check «Context.current().isCancelled()» before expensive steps.

          ## Retries

          - grpc-java has retries switched on, but **no default retry policy**. Without one, it only makes **transparent retries**: when it knows the request never reached the server application, which is safe even for non-idempotent calls.
          - A **retry policy** comes from the service config: «maxAttempts» (capped at 5), «initialBackoff», «maxBackoff», «backoffMultiplier», «retryableStatusCodes». A **hedging policy** sends extra copies after a delay instead of waiting for a failure: lower tail latency, more load, and only for idempotent calls.
          - **Retry throttling** («maxTokens», «tokenRatio») stops retries when too many calls fail, so retries cannot multiply an outage (the Dependencies module's retry storm).

          ~~~java
          Map<String, Object> policy = Map.of(
              "maxAttempts", 3.0,
              "initialBackoff", "0.1s", "maxBackoff", "1s", "backoffMultiplier", 2.0,
              "retryableStatusCodes", List.of("UNAVAILABLE"));
          Map<String, Object> config = Map.of(
              "methodConfig", List.of(Map.of(
                  "name", List.of(Map.of("service", "inventory.Inventory", "method", "GetStock")),
                  "retryPolicy", policy)),
              "retryThrottling", Map.of("maxTokens", 10.0, "tokenRatio", 0.1));
          ManagedChannel channel = ManagedChannelBuilder.forTarget("dns:///inventory:9090")
              .defaultServiceConfig(config)
              .build();
          ~~~

          Retry UNAVAILABLE for idempotent methods. DEADLINE_EXCEEDED means the server may have done the work, so retrying a payment on it can charge twice.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'A gRPC client with no service config gets UNAVAILABLE after the request reached the server\'s handler. Does grpc-java retry it?', options: ['Yes, 5 times', 'No: without a retry policy it only retries transparently, when the application never saw the request', 'Yes, once', 'Only for streaming calls'], answer: 1, why: 'Retries are enabled but there is no default policy. Transparent retries cover requests the server application never received.' },
          { q: 'A server handler calls another service from an executor thread. What deadline does that call have?', options: ['The incoming call\'s deadline', 'None, unless the Context was carried to the thread', '30 s', 'The server\'s keepalive'], answer: 1, why: 'The deadline lives in the Context. Wrap the task with Context.current().wrap() to carry it.' },
        ],
        defend: [
          {
            q: 'How do you make gRPC calls between your services resilient?',
            weak: 'We set a 30 second timeout on every call and turn on retries with 5 attempts for all methods.',
            whyWeak: 'A flat 30 s ignores how deep the call chain is, and retrying every method 5 times duplicates non-idempotent work and multiplies load during an outage.',
            follow: [
              { q: 'How should deadlines work across a chain of services?', a: 'Set one at the edge from the user\'s budget; grpc-java propagates the remaining time through the Context, so each hop gets less. Do not reset it to a fresh 30 s per hop.' },
              { q: 'Which failures do you retry?', a: 'UNAVAILABLE, for idempotent methods, with exponential back-off and jitter. Not DEADLINE_EXCEEDED on a non-idempotent call: the server may have done it.' },
              { q: 'What stops retries from making an outage worse?', a: 'Retry throttling in the service config (maxTokens, tokenRatio), retries at one layer only, and a cap on attempts.' },
              { q: 'What is hedging, and when is it right?', a: 'Sending a second copy after a short delay and taking the first answer. It cuts tail latency for idempotent reads, at the cost of extra load.' },
              { q: 'How does the server avoid wasted work?', a: 'Check Context cancellation before expensive steps, and carry the Context to other threads so downstream calls inherit the deadline.' },
            ],
            strong: [
              'Every call has a deadline; it propagates and shrinks through the Context.',
              'Retry only idempotent methods, only on UNAVAILABLE, with back-off.',
              'Throttle retries; one retrying layer.',
              'Respect cancellation; carry the Context across threads.',
            ],
            flags: ['No deadline, or a fresh one per hop', 'Retries every status code', 'Retries non-idempotent calls on DEADLINE_EXCEEDED'],
          },
        ],
        gaps: [
          {
            title: 'A checkout handler and its clients',
            intro: 'A gRPC checkout service charges a card and then reserves stock. Find what can hang, duplicate, or waste work.',
            lang: 'java',
            code: R`
              Map<String, Object> retry = Map.of(
                  "maxAttempts", 5.0, "initialBackoff", "0.2s", "maxBackoff", "2s", "backoffMultiplier", 2.0,
                  "retryableStatusCodes", List.of("UNAVAILABLE", "DEADLINE_EXCEEDED", "INTERNAL")); ⟦codes⟧
              // applied to every method of payments.Payments, including Charge

              PaymentsGrpc.PaymentsBlockingStub payments = PaymentsGrpc.newBlockingStub(paymentsChannel); ⟦nodeadline⟧

              public void checkout(CheckoutRequest req, StreamObserver<CheckoutReply> out) {
                  var receipt = payments.charge(toCharge(req)); ⟦nodeadline⟧
                  CompletableFuture.runAsync(() -> inventory.reserve(toReserve(req)), executor); ⟦ctx⟧
                  out.onNext(reply(receipt));
                  out.onCompleted(); ⟦ok1⟧
              }
            `,
            issues: [
              { id: 'codes', kind: 'dupe', title: 'Retrying Charge on DEADLINE_EXCEEDED and INTERNAL', why: 'Both can happen after the payment service charged the card. Retrying a non-idempotent Charge then charges again.', fix: 'Retry only UNAVAILABLE, only for idempotent methods; make Charge idempotent with a request key if it must be retried.' },
              { id: 'nodeadline', kind: 'stall', title: 'The payments stub has no deadline', why: 'gRPC sets none by default. If the payment service hangs, every checkout thread waits forever and the server runs out of threads.', fix: 'Call with «payments.withDeadlineAfter(...)» per call, inside the checkout\'s own budget.' },
              { id: 'ctx', kind: 'stall', title: 'The reserve call runs on another thread without the Context', why: 'The Context carries the deadline and cancellation. On the executor thread the inventory call has no deadline and keeps going after the client has gone.', fix: '«executor.execute(Context.current().wrap(() -> ...))», or do the call in the handler.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Completing the response after onNext is how a unary handler finishes. Fine.' },
            ],
          },
        ],
      },

      /* ───────────── 3. load balancing ───────────── */
      {
        lesson: 'grpc-lb', title: 'Load balancing long-lived connections', mins: 12,
        remember: 'gRPC sends every call over one long-lived HTTP/2 connection, so anything that balances connections (a TCP load balancer, a single virtual IP, the default pick_first policy) balances nothing. Balance per call: client-side round_robin over every backend address, with connections recycled so new backends are found, or an L7 proxy.',
        cue: 'one backend hot while others idle, or new pods getting no traffic after a scale-out → check how the client resolves the service, its load-balancing policy, and whether connections are ever recycled',
        body: R`
          ## Why ordinary load balancing fails

          A TCP (L4) load balancer picks a backend when a connection opens. With HTTP/1.1, clients open many short connections, so that spreads the load. A gRPC client opens **one** connection and multiplexes every call on it for hours, so all its calls go to whichever backend it got first. Backends added later get nothing until clients reconnect.

          ## The client's options

          - **pick_first**, the **default** policy: connect to the first address that works and send everything there. No balancing.
          - **round_robin**: connect to every resolved address and rotate calls across them. In grpc-java: «.defaultLoadBalancingPolicy("round_robin")», or a «loadBalancingConfig» in the service config.
          - round_robin needs **every backend's address**. In Kubernetes a normal (ClusterIP) Service resolves to one virtual IP, so the client sees one address; a **headless** Service («clusterIP: None») resolves to the pod IPs.
          - The client resolves the name again mostly when connections break (grpc-java caches DNS answers for 30 s by default). In a steady state nothing breaks, so new pods are not discovered.

          ## Making it work

          - **Recycle connections on the server**: «maxConnectionAge» (off by default) closes each connection after a time, with «maxConnectionAgeGrace» for calls in flight. Clients reconnect, resolve again, and find new backends.
          - **Or an L7 proxy** (Envoy, a service mesh sidecar) that balances each call and watches backends itself, at the cost of an extra hop.
          - **Or xDS**: the client gets backends and policy from a control plane (proxyless service mesh).

          @sim grpclb

          Try each strategy and watch the share of calls on the new backends after 60 s.

          @gaps 0

          @quiz 0
        `,
        quiz: [
          { q: 'You scale a gRPC service from 4 pods to 8 behind a cloud TCP load balancer. Ten minutes later the new pods have almost no traffic. Why?', options: ['They are still warming up', 'Clients keep their existing long-lived connections, each pinned to an old pod', 'The load balancer is misconfigured', 'gRPC prefers older pods'], answer: 1, why: 'An L4 balancer chooses per connection, and gRPC clients keep one connection open for hours.' },
        ],
        defend: [
          {
            q: 'After a scale-out, the new gRPC pods sit idle while the old ones are overloaded. Why, and what do you change?',
            weak: 'The Kubernetes Service should balance it. We will restart the clients after each deploy.',
            whyWeak: 'A ClusterIP Service balances connections, and restarting clients is a manual workaround that does not survive the next scale-out.',
            follow: [
              { q: 'Why does the Service not balance gRPC calls?', a: 'It balances connections. Each gRPC client holds one long-lived HTTP/2 connection and sends every call on it.' },
              { q: 'What does the client do by default?', a: 'pick_first: one address, everything to it. round_robin must be configured, and it needs every pod\'s address (a headless Service).' },
              { q: 'With round_robin, why are new pods still idle?', a: 'The client resolves the name again only when connections break. Set maxConnectionAge on the server so connections are recycled and the client re-resolves.' },
              { q: 'When would you use a proxy instead?', a: 'When clients are many languages or you want per-call balancing, retries and metrics without client config: Envoy or a mesh, at the cost of a hop.' },
            ],
            strong: [
              'L4 balances connections; gRPC uses one long-lived connection.',
              'pick_first is the default; configure round_robin.',
              'Headless Service or another way to see every backend.',
              'maxConnectionAge to recycle; or an L7 proxy or xDS.',
            ],
            flags: ['Expects a ClusterIP Service to balance calls', 'Does not know the default policy', 'Fixes it by restarting clients'],
          },
        ],
        gaps: [
          {
            title: 'How the inventory service is wired',
            intro: 'Notes from a design doc for a gRPC service in Kubernetes that autoscales on CPU. After scale-outs the new pods stay idle. Find the causes, and the parts that are right.',
            lang: 'text',
            code: R`
              1. Clients target dns:///inventory:9090, a normal ClusterIP Service. ⟦clusterip⟧
              2. Channels use the default load-balancing policy. ⟦pickfirst⟧
              3. Servers keep connections open indefinitely (no maxConnectionAge). ⟦noage⟧
              4. Each call has a deadline of 300 ms. ⟦ok1⟧
              5. To spread load, clients create a new channel for every call. ⟦newch⟧
              6. Readiness probes keep pods out of DNS until they can serve. ⟦ok2⟧
            `,
            issues: [
              { id: 'clusterip', kind: 'slow', title: 'A ClusterIP Service gives the client one address', why: 'The client sees only the virtual IP, so client-side balancing has a single address and connection-level balancing pins each client.', fix: 'A headless Service («clusterIP: None») so DNS returns the pod IPs, or a proxy or xDS.' },
              { id: 'pickfirst', kind: 'slow', title: 'The default policy is pick_first', why: 'Even with every address resolved, pick_first sends all calls to one of them.', fix: '«defaultLoadBalancingPolicy("round_robin")» or a loadBalancingConfig in the service config.' },
              { id: 'noage', kind: 'slow', title: 'Connections are never recycled', why: 'Clients resolve the name again mostly when connections break. With connections that live forever, new pods are never discovered.', fix: '«maxConnectionAge» (minutes) with a «maxConnectionAgeGrace» on the server.' },
              { id: 'newch', kind: 'slow', title: 'A new channel per call', why: 'Each call pays name resolution, a TCP and TLS handshake, and HTTP/2 setup, and the client churns connections (and NAT ports). It spreads load at a high price.', fix: 'One long-lived channel per target with round_robin.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Right: every call needs a deadline.' },
              { id: 'ok2', why: 'Right: readiness gates keep unready pods out of the addresses clients see.' },
            ],
          },
        ],
      },

      /* ───────────── 4. performance ───────────── */
      {
        lesson: 'grpc-perf', title: 'gRPC performance: channels, streams, sizes and flow control', mins: 11,
        remember: 'Reuse channels and stubs; know the per-connection limit on concurrent calls (calls beyond it queue on the client); stream large data instead of one giant message (4 MB is the default limit); leave grpc-java\'s automatic flow control on; and keep keepalive pings within what the server permits.',
        cue: 'gRPC latency that grows with concurrency, RESOURCE_EXHAUSTED on big responses, or connections closed with too_many_pings → check channel reuse, stream limits on proxies, message size, and keepalive settings',
        body: R`
          ## Reuse channels and stubs

          A channel owns connections, name resolution and load balancing; creating one per call pays all of that each time. grpc.io's performance guide: always reuse stubs and channels when possible. Channels and stubs are thread-safe.

          ## Concurrent calls per connection

          HTTP/2 lets the server cap concurrent streams per connection («SETTINGS_MAX_CONCURRENT_STREAMS»; the spec recommends at least 100). grpc-java servers set no limit by default; nginx defaults to 128, and Envoy to 1,024. When a connection hits the limit, extra calls **queue on the client**, which shows up as latency that grows with concurrency while the server looks idle. Raise the limit, or use a small pool of channels.

          ## Message size

          grpc-java rejects inbound messages over **4 MB** by default, with RESOURCE_EXHAUSTED. Raising «maxInboundMessageSize» works, but one huge message is held whole in memory on both sides and blocks the connection's bandwidth while it moves. For large results, use **server streaming**: many moderate messages, processed as they arrive.

          ## Flow control

          HTTP/2 flow control limits how many bytes may be in flight per stream and per connection. grpc-java starts with a 1 MB window and, by default, **tunes it automatically** from the measured bandwidth-delay product. Calling «flowControlWindow(...)» on the channel builder fixes the window and turns that tuning off; a small fixed window caps throughput on high-latency links.

          ## Keepalive

          | Setting | grpc-java default |
          |---|---|
          | client «keepAliveTime» | off |
          | client «keepAliveTimeout» | 20 s |
          | server «keepAliveTime» | 2 hours |
          | server «permitKeepAliveTime» (the most often a client may ping) | 5 minutes |
          | server «permitKeepAliveWithoutCalls» | false |

          A client that pings more often than the server permits gets a GOAWAY with «too_many_pings» and loses its connection. If clients must ping often (the next lesson), lower the server's «permitKeepAliveTime» to match.

          ## Other levers

          - **Compression** (gzip) trades CPU for bytes: worth it for large, repetitive payloads on slow links, not for small messages on a fast network.
          - **Async stubs** (future or streaming stubs) let one thread drive many calls; blocking stubs tie a thread to each call.
          - Field numbers 1 to 15 take one byte: give them to the fields sent most often.

          @gaps 0

          @quiz 0
        `,
        quiz: [
          { q: 'Through an nginx proxy, gRPC latency climbs once a client has more than about 128 calls in flight, while the backends are idle. Why?', options: ['nginx is slow', 'nginx allows 128 concurrent streams per connection by default, so further calls queue on the client', 'The 4 MB limit', 'Keepalive'], answer: 1, why: 'http2_max_concurrent_streams defaults to 128. Calls over the limit wait for a free stream.' },
        ],
        defend: [
          {
            q: 'A gRPC service is slow under load but its CPU is low. What do you check?',
            weak: 'Increase the server thread pool and add more replicas.',
            whyWeak: 'Low server CPU suggests the calls are waiting before they reach it: on client channels, stream limits, or flow control.',
            follow: [
              { q: 'Where can calls wait before reaching the server?', a: 'On the client, when a connection is at its concurrent-stream limit (often a proxy\'s 100 or 128); in channel setup, if a channel is created per call; in flow control, if windows are small for the link.' },
              { q: 'How do you see it?', a: 'Client-side latency much higher than server-side handling time; per-connection stream counts at the proxy; traces with a gap before the server span.' },
              { q: 'Large responses fail with RESOURCE_EXHAUSTED. What is the fix?', a: 'They exceed the 4 MB default. Raising the limit is a stopgap; server streaming sends the data in pieces.' },
              { q: 'Clients set keepAliveTime to 10 s and connections keep dropping. Why?', a: 'The server permits pings at most every 5 minutes by default and answers faster pings with GOAWAY too_many_pings. Lower permitKeepAliveTime on the server, or ping less often.' },
            ],
            strong: [
              'Compare client and server latency to find where calls wait.',
              'Reuse channels; mind per-connection stream limits on proxies.',
              'Stream large data; 4 MB default limit.',
              'Leave auto flow control on; keepalive within the server\'s permit.',
            ],
            flags: ['Adds threads when the server is idle', 'A channel per call', 'Raises message limits to hundreds of MB'],
          },
        ],
        gaps: [
          {
            title: 'A pricing client tuned by trial and error',
            intro: 'This client calls a pricing service across regions (80 ms round trip). It is slow, big exports fail, and connections keep dropping.',
            lang: 'java',
            code: R`
              public Price quote(String sku) {
                  ManagedChannel ch = NettyChannelBuilder.forTarget("pricing.internal:443") ⟦newch⟧
                      .flowControlWindow(65_535) ⟦window⟧
                      .keepAliveTime(10, TimeUnit.SECONDS) ⟦ping⟧
                      .build();
                  try {
                      return PricingGrpc.newBlockingStub(ch)
                          .withDeadlineAfter(500, TimeUnit.MILLISECONDS) ⟦ok1⟧
                          .getPrice(PriceRequest.newBuilder().setSku(sku).build()).getPrice();
                  } finally {
                      ch.shutdown();
                  }
              }

              public List<PriceRow> exportAll() {
                  return pricing.exportAll(ExportRequest.getDefaultInstance()).getRowsList(); ⟦big⟧
              }
            `,
            issues: [
              { id: 'newch', kind: 'slow', title: 'A channel built and shut down for every quote', why: 'Each quote pays DNS, TCP and TLS handshakes and HTTP/2 setup across an 80 ms link: several round trips before the call itself.', fix: 'One channel for the application, built once and reused.' },
              { id: 'window', kind: 'slow', title: 'A fixed 64 KB flow-control window', why: 'Calling flowControlWindow turns off automatic tuning. With 80 ms round trips, 64 KB in flight caps a stream at well under 1 MB a second.', fix: 'Remove it and let grpc-java tune the window from the bandwidth-delay product.' },
              { id: 'ping', kind: 'stall', title: 'Pinging every 10 seconds', why: 'The server permits client pings at most every 5 minutes by default. It answers with GOAWAY too_many_pings and closes the connection, which is the dropping.', fix: 'Ping less often, or lower «permitKeepAliveTime» on the server to match.' },
              { id: 'big', kind: 'ops', title: 'Everything in one unary response', why: 'The response grows with the catalogue; past 4 MB it fails with RESOURCE_EXHAUSTED, and before that it is held whole in memory on both sides.', fix: 'A server-streaming method that sends rows in pages.' },
            ],
            decoys: [
              { id: 'ok1', why: 'Right: a deadline on every call.' },
            ],
          },
        ],
      },

      /* ───────────── 5. NAT and reverse tunnels ───────────── */
      {
        lesson: 'grpc-nat', title: 'gRPC through NAT, and flipping it with a reverse tunnel', mins: 14,
        remember: 'A NAT forgets idle connections silently (in minutes on cloud NAT gateways), and nothing outside can open a connection in. So long-lived gRPC connections need pings below the shortest idle timeout on the path, and a service behind NAT is reached either by having it dial out and hold a stream, or through a reverse tunnel, which lets callers treat it as an ordinary gRPC server.',
        cue: 'a long-lived stream that "hangs" after a quiet period, or "we cannot reach the agent inside the customer network" → check NAT idle timeouts against keepalive, then decide between a dial-out stream and a reverse tunnel',
        body: R`
          ## What NAT does to a connection

          1. A machine on a private network opens a connection to the internet.
          2. The NAT device rewrites the source address to its public address and a free port, and records the mapping in its state table.
          3. Replies come back to that public port and are rewritten to the private machine.
          4. If no packet crosses for the **idle timeout**, the mapping is deleted. Neither end is told.
          5. Later packets from outside find no mapping and are dropped. Packets from inside get a reset, on some NATs, only when they are sent.

          | NAT | Idle timeout for TCP |
          |---|---|
          | AWS NAT Gateway | 350 s |
          | Azure NAT Gateway, Azure Load Balancer | 4 minutes by default (configurable) |
          | Google Cloud NAT | 20 minutes (established connections) |
          | Linux conntrack | 5 days |

          So a quiet gRPC stream through an AWS NAT is dead after six minutes while both ends believe it is open. The next command sent to it vanishes: TCP retransmits for many minutes before giving up, and without a deadline nobody notices sooner.

          ## gRPC's defaults do not cover it

          Client keepalive is **off**, and the server pings only every **2 hours**, longer than every NAT timeout above. Fix it explicitly:

          - Client «keepAliveTime» below the shortest idle timeout on the path (60 s is safe for all of the above), and «keepAliveWithoutCalls(true)» if the connection is often idle.
          - On the server, «permitKeepAliveTime» at or below that interval and «permitKeepAliveWithoutCalls(true)», or the server answers with GOAWAY «too_many_pings».
          - Or have the **server** ping: its «keepAliveTime» below the timeout also keeps the mapping alive and detects dead clients.

          NAT also has a port budget. AWS allows 55,000 simultaneous connections per NAT IP to each unique destination; Azure gives 64,512 SNAT ports per public IP. Long-lived gRPC connections use few; a channel per call burns through them.

          ## Reaching a service behind NAT

          Nothing outside can open a connection to a machine behind NAT. If a control plane must send commands to agents running inside customer networks, one side has to dial out. Two designs:

          **A. The agent dials out and holds a stream.** The agent is the gRPC client: it calls «Connect()» on the control plane and keeps a bidirectional stream open. The control plane sends commands as stream messages; the agent sends results back.

          **B. A reverse tunnel.** The agent runs a tunnel client that dials out to a public tunnel server and keeps one multiplexed connection open. The tunnel server accepts gRPC on a public endpoint and forwards each call through the tunnel to the agent's local gRPC server. The agent becomes an ordinary gRPC server, reachable by address.

          ~~~mermaid The same agent, two ways
          flowchart TB
            subgraph A[A: agent dials out and holds a stream]
              direction LR
              CP1[Control plane: gRPC server] <-- one bidi stream, opened by the agent --> AG1[Agent: gRPC client]
            end
            A ~~~ B
            subgraph B[B: reverse tunnel]
              direction LR
              CP2[Control plane: gRPC client] -- unary calls --> TS[Tunnel server: public]
              TS == multiplexed tunnel, opened by the agent ==> TC[Tunnel client]
              TC -- local HTTP/2 --> AG2[Agent: gRPC server]
            end
          ~~~

          ## What flips

          | | A: dial-out stream | B: reverse tunnel |
          |---|---|---|
          | Who is the gRPC server | the control plane | the agent |
          | A command is | a message on a stream, matched to its result by your own id | a unary call with a request and a response |
          | Deadlines, cancellation, status codes | built by you inside the stream protocol | gRPC's own, per call |
          | Retries, interceptors, tracing | per stream; per command is custom | per call, the standard way |
          | Which control-plane instance can reach an agent | only the one holding its stream: route commands there | any: the tunnel routes by agent id |
          | Liveness | your stream keepalive | the tunnel's heartbeat, plus per-call deadlines |
          | Extra moving part | none | the tunnel server: availability, capacity, security |

          The flip trades protocol work (correlation ids, timeouts, stream ownership) for infrastructure (a tunnel service on the call path).

          ## FerroTunnel

          FerroTunnel is an open-source reverse tunnel written in Rust, usable as a CLI or embedded as a library («Client::builder()»), licensed MIT or Apache-2.0 (version 1.5.2, August 2026). From its README and source:

          - The tunnel client dials out to the server (TCP port 7835 by default), with optional TLS including client certificates, or QUIC, and multiplexes many streams over that one connection. Clients authenticate with a shared token.
          - It **detects gRPC** by «content-type: application/grpc» and forwards it over HTTP/2 to the local service, keeping trailers («grpc-status», «grpc-message») end to end. Raw TCP forwarding is also available.
          - A **heartbeat every 30 s** (90 s connection timeout) keeps NAT mappings alive, well under the 350 s AWS limit, and the client reconnects with exponential back-off from 1 s to 60 s with jitter.

          What to check before relying on it:
          - **Maturity.** The project started in January 2026; its README makes no stability claim and calls its benchmarks reference points, not guarantees.
          - **Streaming.** Its gRPC test covers a unary call. If you keep any streaming RPCs, test them through the tunnel.
          - **TLS.** In HTTP mode the tunnel server sees the gRPC traffic; the public listener seen in its source accepts cleartext HTTP/2. Terminate TLS in front of it, or use raw TCP forwarding and run TLS end to end.
          - **One TCP connection per agent** carries every call: a lost packet delays all of them (head-of-line blocking). The QUIC transport avoids that.
          - **The tunnel server is now on every call**: run more than one, and keep per-call deadlines short enough to fail fast when an agent's tunnel is down.

          @gaps 0

          @quiz 0
          @quiz 1
        `,
        quiz: [
          { q: 'Agents hold gRPC streams to the control plane through an AWS NAT Gateway. Commands sent after a quiet 10 minutes never arrive and no error appears. Why?', options: ['gRPC drops idle streams', 'The NAT forgot the connection after 350 s idle and drops packets silently; keepalive is off by default', 'The server deadline', 'Flow control'], answer: 1, why: 'NAT idle timeouts are silent. Ping below the timeout (and permit it on the server), and put deadlines on commands.' },
          { q: 'With a reverse tunnel, what is the agent in gRPC terms?', options: ['A client holding a stream', 'An ordinary gRPC server, called through the tunnel', 'A proxy', 'Nothing changes'], answer: 1, why: 'The tunnel client dials out, so callers can reach the agent\'s gRPC server by address and make normal calls.' },
        ],
        defend: [
          {
            q: 'Your control plane must send commands to agents running inside customer networks behind NAT. How do you design the gRPC part?',
            weak: 'Open a port on the customer firewall so the control plane can call the agent\'s gRPC server.',
            whyWeak: 'Inbound ports into customer networks are usually not allowed, and it ignores NAT entirely. The connection has to start from inside.',
            follow: [
              { q: 'What are the two designs that work?', a: 'The agent dials out and holds a bidirectional stream, and commands travel as messages on it; or a reverse tunnel, so the agent runs a normal gRPC server reached through a tunnel it opened.' },
              { q: 'What do you have to build yourself with the dial-out stream?', a: 'Matching commands to results, per-command timeouts and cancellation, routing a command to the control-plane instance holding that agent\'s stream, and reconnect handling.' },
              { q: 'Why do these connections die silently, and what do you set?', a: 'NAT idle timeouts (350 s on AWS NAT, 4 min on Azure) drop mappings without telling either end. Client keepAliveTime under the shortest timeout, keepAliveWithoutCalls, and permitKeepAliveTime on the server to allow it.' },
              { q: 'What does a reverse tunnel such as FerroTunnel give you, and cost?', a: 'Plain unary calls with gRPC deadlines, status codes and retries, routed by agent id. It costs an extra service on every call: its availability, capacity, TLS setup, and the maturity of the tunnel software.' },
              { q: 'How do you secure it?', a: 'Mutual TLS from the agent outwards, a per-agent identity rather than one shared secret where possible, and TLS end to end for the gRPC calls so the tunnel cannot read them.' },
            ],
            strong: [
              'The connection must start inside: dial-out stream or reverse tunnel.',
              'Dial-out streams need your own correlation, timeouts and routing.',
              'A reverse tunnel makes the agent a normal gRPC server; it adds a critical hop.',
              'Keepalive below NAT idle timeouts, permitted by the server.',
              'mTLS and end-to-end TLS.',
            ],
            flags: ['Asks customers to open inbound ports', 'Unaware of NAT idle timeouts', 'No deadlines on commands', 'Treats the tunnel as free'],
          },
        ],
        gaps: [
          {
            title: 'Agents behind NAT',
            intro: 'Agents in customer networks (behind AWS and Azure NAT gateways) keep a bidirectional stream open to the control plane, which sends jobs down it. Jobs sometimes never arrive. Find the causes.',
            lang: 'java',
            code: R`
              // agent
              ManagedChannel ch = NettyChannelBuilder.forTarget("control.example.com:443")
                  .keepAliveTime(20, TimeUnit.MINUTES) ⟦keep⟧
                  .build(); ⟦ok1⟧
              StreamObserver<AgentEvent> up = ControlGrpc.newStub(ch).connect(jobHandler); ⟦ok2⟧

              // control plane
              Server server = NettyServerBuilder.forPort(443)
                  .addService(control)
                  .build(); ⟦permit⟧

              void sendJob(String agentId, Job job) {
                  streams.get(agentId).onNext(Command.newBuilder().setJob(job).build()); ⟦fire⟧
              }
            `,
            issues: [
              { id: 'keep', kind: 'stall', title: 'Pings every 20 minutes: longer than the NAT timeouts', why: 'AWS NAT forgets an idle connection after 350 s and Azure after 4 minutes, silently. Between pings the stream is already dead.', fix: '«keepAliveTime(60, SECONDS)» and «keepAliveWithoutCalls(true)».' },
              { id: 'permit', kind: 'stall', title: 'The server still only permits pings every 5 minutes', why: 'Once agents ping every 60 s, the server\'s default «permitKeepAliveTime» (5 minutes) answers with GOAWAY too_many_pings and closes their connections.', fix: '«permitKeepAliveTime(30, SECONDS)» and «permitKeepAliveWithoutCalls(true)» on the server.' },
              { id: 'fire', kind: 'loss', title: 'A job is sent with no acknowledgement or deadline', why: 'onNext on a dead stream can appear to succeed; nothing tracks that the agent received and finished the job, so it silently never happens.', fix: 'Give each job an id, expect an acknowledgement and a result on the stream within a deadline, and resend or fail when they do not come. Or call the agent as a server through a reverse tunnel, so each job is a unary call with a deadline and a status.' },
            ],
            decoys: [
              { id: 'ok1', why: 'One long-lived channel per agent is right.' },
              { id: 'ok2', why: 'The agent dialling out and holding a stream is a valid design behind NAT.' },
            ],
          },
        ],
      },
    ],
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
