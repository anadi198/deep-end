/* One-page cheat sheets. Each: { id, title, kind, blurb, lede, body } */
(function (root) {
  const RL = root.RL, R = RL.R;
  RL.cheats.push(
    {
      id: 'phrasebook', title: 'Java to Rust phrasebook', kind: 'Reading',
      blurb: 'The Java you know, and the Rust you will see instead. Types, classes, null and exceptions, collections, concurrency.',
      lede: 'Skim the left column for what you would write in Java; the middle column is what a PR will contain.',
      body: R`
        ## Types

        | Java | Rust | Note |
        |---|---|---|
        | «byte», «int», «long» | «u8»/«i8», «i32», «i64» | unsigned types exist: «u16» ports, «u8» bytes |
        | «int» index or size | «usize» | every «.len()» is a «usize» |
        | «String» | «String» (owned), «&str» (a view) | functions that only read take «&str» |
        | «byte[]» | «Vec<u8>» (owned), «&[u8]» (a view) | |
        | «ArrayList», «HashMap» | «Vec», «HashMap» | |
        | «Optional<T>», null | «Option<T>» | there is no null |
        | «throws X» | «-> Result<T, X>» | errors are return values |
        | «(int) x» | «x as u8» (truncates!), «u8::try_from(x)» (checks) | |

        ## Classes and methods

        | Java | Rust |
        |---|---|
        | «class Frame { fields; methods }» | «struct Frame { fields }» plus «impl Frame { methods }» |
        | constructor | a plain function, by habit «new», returning «Self» |
        | getter | «fn kind(&self) -> &str» |
        | setter, or any mutating method | «fn retry(&mut self)» |
        | «static» method | a function in «impl» with no «self»: «Frame::new(...)» |
        | «interface» | «trait» (module 05) |
        | «@ToString», «@EqualsAndHashCode» | «#[derive(Debug, PartialEq, Eq, Hash)]» |
        | «implements AutoCloseable» | «impl Drop» (runs by itself at scope end) |
        | «public» | «pub» (private is the default) |

        ## Null and exceptions

        | Java | Rust |
        |---|---|
        | «if (x != null)» | «if let Some(x) = opt» |
        | «x == null ? d : x» | «opt.unwrap_or(d)» |
        | «optional.get()» | «opt.unwrap()» (panics on None) |
        | «throw new X(...)» | «return Err(X::...)» |
        | letting an exception propagate | «?» |
        | «catch (X e) { ... }» | «match r { Ok(v) => ..., Err(e) => ... }» |
        | wrapping with a message | «.context("doing what")?» (anyhow), «.map_err(...)?» |
        | an unchecked «RuntimeException» | «panic!» (and «unwrap», indexing, overflow) |

        ## Collections and loops

        | Java | Rust |
        |---|---|
        | «for (String s : list)» | «for s in &list» |
        | «for (int i = 0; i < n; i++)» | «for i in 0..n» |
        | «switch» expression | «match», which must cover every case |
        | «cond ? a : b» | «if cond { a } else { b }» |
        | «map.get(k)» (may be null) | «map.get(&k)» returns «Option<&V>» |
        | «map.computeIfAbsent(...)» | «map.entry(k).or_insert(...)» |
        | «list.stream().map(...).collect(...)» | «list.iter().map(...).collect()» (module 06) |

        ## Sharing and threads (preview)

        | Java | Rust |
        |---|---|
        | a shared object | «Arc<T>» |
        | «synchronized», «ReentrantLock» | «Mutex<T>»: the lock owns the data; «.lock()» returns a guard |
        | «new Thread(r).start()» | «std::thread::spawn(move \|\| ...)» |
        | «CompletableFuture», «Mono» | «async fn» and «.await» on tokio (module 08) |
      `,
    },
    {
      id: 'errors', title: 'The compiler errors you will actually see', kind: 'Errors',
      blurb: 'The error codes that make up most of daily Rust, what each one means, and the usual fix.',
      lede: 'Each of these was produced by the real compiler somewhere in this lab; the lesson link shows it happening.',
      body: R`
        | Code | Starts with | Means | Usual fix | See |
        |---|---|---|---|---|
        | E0382 | borrow of moved value | something took ownership earlier | borrow with «&», or clone if two copies are truly needed | [moves](#/l/own-one-owner) |
        | E0502 | cannot borrow as mutable because it is also borrowed as immutable | a read and a write overlap | finish reading first, or copy the small value out | [read-write lock](#/l/borrow-rwlock) |
        | E0499 | cannot borrow as mutable more than once | two writers | one «&mut» at a time | [read-write lock](#/l/borrow-rwlock) |
        | E0596 | cannot borrow as mutable | the variable is not «mut» | «let mut» | [receivers](#/l/borrow-self) |
        | E0597 | does not live long enough | a reference outlives its value | keep the value alive longer, or own the data | [lifetimes](#/l/borrow-lifetimes) |
        | E0515 | cannot return value referencing local variable | returning a reference into something about to be dropped | return an owned value | [lifetimes](#/l/borrow-lifetimes) |
        | E0373 | closure may outlive the current function | a thread or task borrows local data | «move» the data in, or share an «Arc» | [lifetimes](#/l/borrow-lifetimes) |
        | E0308 | mismatched types | expected one type, found another; often a stray semicolon | read the "expected, found" line | [shape](#/l/read-shape) |
        | E0277 | doesn't implement / trait bound not satisfied | a type lacks a trait («Debug», «Send»), or «?» where no error can be returned | derive or implement the trait; return «Result» | [symbols](#/l/read-symbols), [«?»](#/l/err-question) |
        | E0204 | the trait «Copy» cannot be implemented | a «Copy» type holds a non-«Copy» field | drop «Copy», keep «Clone» | [Copy and Clone](#/l/own-copy-clone) |
        | E0004 | non-exhaustive patterns | a «match» misses a variant, often one just added | handle it explicitly rather than with «_ =>» | [enums](#/l/tr-enums) |
        | E0117 | only traits defined in the current crate can be implemented | someone else's trait for someone else's type | wrap the type in your own struct | [traits](#/l/tr-traits) |
        | (none) | future cannot be sent between threads safely | a spawned task holds something non-«Send» (an «Rc», a std «MutexGuard») across «.await» | drop it before the await, or use «Arc» | [Send and Sync](#/l/sh-send-sync) |

        ## How to read one

        1. The **first line**: the code and the one-sentence problem.
        2. The **arrow line** (« --> src/lib.rs:5:16»): where.
        3. The **labels** under the code: the compiler often draws the whole story (moved here, borrowed here, used here).
        4. The **help** line: very often the exact fix.

        Fix the **first** error first. Later ones are often knock-on effects that disappear with it.
      `,
    },
    {
      id: 'reactor', title: 'Reactor to Tokio phrasebook', kind: 'Async',
      blurb: 'The Reactor you already know, and the Tokio you will see in PRs instead. Plus the three rules of async Rust.',
      lede: 'Same model, different spelling: Tokio code reads top to bottom instead of as a chain of operators.',
      body: R`
        ## The three rules

        1. **Nothing runs until it is awaited or spawned.** Futures are as lazy as a Mono nobody subscribed to.
        2. **Never block a worker thread.** No sleeps, file I/O or heavy loops inside «async fn»; use the async version or «spawn_blocking».
        3. **Every network await needs a bound.** «tokio::time::timeout» on reads, connects and replies.

        ## Phrasebook

        | Reactor or Java | Tokio | Note |
        |---|---|---|
        | «Mono<T>» | a future: «async fn f() -> T» | lazy in both |
        | «subscribe()» | «tokio::spawn(fut)» | keep the «JoinHandle», or failures vanish |
        | «block()» | «.await» inside async code | never block inside async code |
        | «Mono.zip(a, b)» | «tokio::join!(a, b)» | concurrent, no extra threads |
        | «Mono.firstWithSignal(a, b)» | «tokio::select! { .. }» | the losers are dropped mid-flight |
        | «.timeout(d)» | «tokio::time::timeout(d, fut)» | gives «Err(Elapsed)» |
        | «Flux<T>» | an «mpsc» receiver, or a «Stream» | «while let Some(x) = rx.recv().await» |
        | «Sinks.many().unicast()» | «mpsc::channel(n)» | bounded means backpressure |
        | «Sinks.many().multicast()» | «broadcast::channel(n)» | slow subscribers skip messages |
        | «CompletableFuture», «Sinks.one()» | «oneshot::channel()» | one reply |
        | a volatile field plus listeners | «watch::channel(v)» | latest value only; stop signals |
        | «onBackpressureBuffer()» | «unbounded_channel()» | a review flag |
        | «Schedulers.boundedElastic()» | «tokio::task::spawn_blocking» | for work that must block |
        | event loop threads | Tokio worker threads | one per core by default |
        | BlockHound | nothing: you review for it | |
        | «dispose()» | «handle.abort()», or a «CancellationToken» | |
        | «retryWhen(backoff)» | a loop with capped backoff and jitter | |
        | «doFinally» | «Drop», or the code after the loop | |
        | Reactor «Context» | «tracing» spans | |
      `,
    },
    {
      id: 'review', title: 'Rust PR review checklist', kind: 'Review',
      blurb: 'The eight hunts with their cues, the questions to ask, and when to ask for a second reviewer.',
      lede: 'Print it or keep it open next to the diff.',
      body: R`
        ## Before the diff

        - The compiler already proved: no use of freed memory, no data races, every match complete, no null.
        - So you are **not** checking memory safety. You are checking the eight hunts below, plus whether the change does what the description says.

        ## Crashes and silence

        @hunt panic

        - Every «.unwrap()», «.expect()», «[i]», «&s[a..b]», «/» on data from a socket, a file, a config or another system.
        - «String::from_utf8(...).unwrap()» on bytes from a peer.
        - Arithmetic on sizes in «u8» or «u16»: debug panics, release wraps.

        @hunt swallow

        - «let _ =», «.ok()», «if let Ok(..)» with no else, «.unwrap_or_default()» on something that matters.
        - Errors passed up with «?» but no context.

        ## Async traps

        @hunt block

        - «std::thread::sleep», «std::fs», blocking clients or CPU-heavy loops inside «async fn»: «tokio::time::sleep», «tokio::fs», «spawn_blocking».
        - «std::fs::write» or other I/O while holding a lock.

        @hunt hang

        - Any «.await» on a socket, a reply or a lock with no «timeout». «connect» with no timeout.
        - A tokio «Mutex» guard held across a slow «.await». Two locks taken in different orders.
        - «Ok(..) = fut» or «Some(..) = fut» patterns in «select!» that can switch a branch off.
        - A receive loop whose senders are never all dropped. Reads with no idle timeout or keepalive.

        @hunt lost

        - «select!» racing futures that are not cancel-safe («read_exact», «write_all»), or a timer that covers a whole frame.
        - An ACK sent before the message is safely forwarded or stored.
        - «broadcast» subscribers that can lag, and «while let Ok(..) = sub.recv()» loops that quit when they do.
        - Tasks with unfinished work when main returns; no shutdown signal, no drain.

        @hunt unbounded

        - «unbounded_channel()», one task per connection with no cap, maps that only insert.
        - A length read from the wire used to allocate, with no maximum. «Box::leak» per call.
        - A buffer that never discards junk.

        ## Supervision (part of «swallow»)

        - Every «tokio::spawn»: where does the «JoinHandle» go? A dropped handle means a failed or panicked task is invisible.
        - «let _ = tx.send(..)»: what if the receiver has died?

        ## Plain bugs

        @hunt logic

        - «as» casts that narrow, «unwrap_or(0)» that turns "missing" into a real-looking value, «_ =>» arms swallowing new enum variants.

        @hunt cost

        - «.clone()», «.to_vec()», «.to_string()» on big data in a loop; «map.clone()» to read one entry.
        - A function taking «String» or «Vec<u8>» that only reads: it should take «&str» or «&[u8]».
        - «RefCell» or «Rc<RefCell>» added to "fix borrow errors".

        ## Ask for a second reviewer when you see

        - «unsafe», raw pointers, «transmute».
        - Hand-written «Future» or «Pin» code.
        - «macro_rules!» or procedural macros.
      `,
    },
    {
      id: 'crates', title: 'Crates, serde, protobuf and gRPC at a glance', kind: 'Reading',
      blurb: 'Cargo.toml, visibility, the macros to stop at, serde attributes, what prost generates, tonic status codes and test attributes, on one page.',
      lede: 'For the code around the logic: the manifest, the generated types, the wire and the tests.',
      body: R`
        ## Cargo.toml

        | You see | Means |
        |---|---|
        | «tokio = "1.38"» | 1.38 or any later 1.x; «Cargo.lock» pins the exact version |
        | «tonic = "0.12"» | 0.12.x only: 0.13 is a breaking upgrade |
        | «features = [...]» | switches that add code, shared by the whole build |
        | «optional = true», «"dep:name"» | a dependency only a feature pulls in |
        | «default-features = false» | drop the crate's default features; list the ones you need |
        | «[dev-dependencies]» | tests, examples and benchmarks only |
        | «build.rs», «[build-dependencies]» | runs on the build machine at compile time |
        | "configured out" in a compiler error | a feature is off: the fix is in «Cargo.toml» |

        ## Visibility

        | Written | Who can use it |
        |---|---|
        | nothing | this module and the modules inside it |
        | «pub(super)» | the parent module too |
        | «pub(crate)» | the whole crate, never another crate |
        | «pub» | everyone |
        | «pub use a::B» | re-export: «B» is also reachable here |

        ## Macros to stop at

        | Macro | Why |
        |---|---|
        | «todo!», «unimplemented!», «unreachable!» | panics if the line runs |
        | «debug_assert!» | compiled out of release builds |
        | «dbg!» | debugging left in: prints to stderr |
        | «?body» in a log macro, «#[instrument]» without «skip» | logs whole values, message bodies included |

        ## serde

        | Default or attribute | Effect |
        |---|---|
        | missing field | error, unless «Option» or a default |
        | unknown field | ignored, unless «#[serde(deny_unknown_fields)]» |
        | number out of range | error (unlike «as», it never truncates) |
        | «#[serde(default)]» on the struct | every missing field defaults, required ones included |
        | «#[serde(default = "f")]» on a field | missing means «f()» |
        | «#[serde(untagged)]» | first variant that fits wins: strictest first |
        | «.unwrap_or_default()» after parsing | a broken message becomes an empty one, silently |

        ## What prost generates

        | .proto | Rust | Not sent |
        |---|---|---|
        | «string», numbers, «bool», «bytes» | «String», «i64», «bool», «Vec<u8>» | «""», 0, «false», empty |
        | a message field | «Option<T>» | «None» |
        | an enum field | «i32», plus a getter | 0; the getter maps unknown values to the default variant |
        | «optional» scalar | «Option<T>» | «None» |
        | «repeated», «map» | «Vec<T>», «HashMap<K, V>» | empty |
        | «oneof» | «Option<an enum>» | «None» |

        Read enums with «Kind::try_from(raw)», and convert generated types into your own once, at the boundary.

        ## tonic

        | Status | Tells the caller |
        |---|---|
        | «invalid_argument» | the request is wrong: do not retry |
        | «not_found» | it does not exist |
        | «unavailable» | a passing problem: retry with backoff |
        | «deadline_exceeded» | too slow; it may have happened anyway |
        | «internal» | a bug on this side |

        - Client calls: «Endpoint::timeout», «connect_timeout», or «request.set_timeout». Without them a call waits as long as the server takes.
        - Status messages: no internal error text. Log the detail, send something the caller can act on.
        - Server streams: a bounded channel plus «ReceiverStream»; stop the producer when «send» fails.

        ## Tests

        | You see | Means |
        |---|---|
        | «#[cfg(test)] mod tests» | unit tests; can reach private items |
        | «#[tokio::test(start_paused = true)]» | async test with a clock that jumps ahead |
        | «#[should_panic(expected = "...")]» | passes only if it panics with that text |
        | «#[ignore]» | skipped unless run with «-- --ignored» |
        | mockall «.withf(..)», «.times(n)» | which arguments, how many calls; without them, any |

        A test proves only what it asserts: no assert, or «let _ =» on the result, proves only "it did not panic".
      `,
    },
  );
})(typeof globalThis !== 'undefined' ? globalThis : this);
