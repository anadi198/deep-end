# Rust Lab

A Rust crash course, from the ground up.

| Part | Modules |
|---|---|
| Foundations | Syntax; Types; Control flow and patterns; Structs, enums and impl |
| The core | Ownership; Borrowing; Collections and text; Errors; Traits and generics; Iterators and closures; Crates |
| Applied | Shared state; Async; Channels; Networking; Wire formats (serde, protobuf, gRPC, tests) |
| Practice | Find the bugs |

* Lessons lead with the one thing to remember, give the formal syntax and the rules, and end with a cue card.
* Every checked snippet shows the real compiler's output (Rust stable on the Rust Playground), recorded ahead of time so it shows offline.
* Predict questions: say what a snippet does before you see it.
* Exercises: **fix** (make it compile or pass), **build** (write it; tests grade it), **find the bugs** (click the lines that are wrong and name the kind of bug).
* A 5-minute daily review brings remember lines, cues and predicts back at growing intervals.

**Site:** https://anadi198.github.io/deep-end/rust/ (part of [Deep End](../README.md))

Code runs on the official [Rust Playground](https://play.rust-lang.org/), which accepts requests from any page, so there is nothing to install.

## Run it locally

From the Deep End folder:

```bash
node serve.mjs
```

Then open http://localhost:8767/rust/.

## Check the content

From this folder:

```bash
node --test test/
```

```bash
node tools/build.mjs
```

The first runs the harness and highlighter tests. The second sends every checked snippet, predict answer, exercise solution, starter, wrong answer and review PR to the real compiler, fails on any claim that does not hold, and writes `outputs.js`. Responses are cached in `.build/`; `--fresh` ignores the cache, `--static` skips the network.

The content format is described at the top of `content/_core.js`.

The Playground has no tonic, prost or mockall. Lessons that need them use small stand-ins with the same names and signatures, kept in "# " lines that compile but are not shown (in lesson snippets and in review PRs alike), and say so where they are used.

## Deploying, and cloud sync

Both are shared by every lab: see the [Deep End README](../README.md).
