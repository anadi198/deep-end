# Rust Lab

Read and review Rust as a Java developer, one idea at a time.

The bar is reading and reviewing Rust, not writing it fluently. The compiler already proves there are no dangling pointers and no data races, so the lab teaches what is left for a reviewer: the syntax, ownership and borrowing, errors, and eight "review hunts" (crashes, swallowed errors, async traps, plain bugs).

* Lessons lead with the one thing to remember, and end with a cue card.
* Every checked snippet shows the real compiler's output (Rust stable on the Rust Playground), recorded ahead of time so it shows offline.
* Predict questions: say what a snippet does before you see it.
* Exercises: **fix** (make it compile or pass), **build** (write it), **review** (an AI-written PR: click the lines you would comment on and pick the hunt).
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

## Deploying, and cloud sync

Both are shared by every lab: see the [Deep End README](../README.md).
