# DSA Lab

Interview prep in Java, organized by pattern. There are 18 modules, 36 lessons, 170 original problems with tests, 74 step-by-step visualizations, and cheat sheets. That includes a *Which Java collection?* flowchart (the Java counterpart to the classic STL container chart) and a pattern finder. Solutions are graded by a real Java compiler, either in your browser or on your own JDK.

**Site:** https://anadi198.github.io/learn-dsa/

What's in each module:

- **Lessons**: how to recognize the pattern, the Java template, the proof idea, and a visualization you can step through and feed your own input.
- **Problems** (easy → hard): statement, three hints, and tests including large hidden ones, so an O(n²) answer times out where O(n log n) passes. Each full solution explains the pattern, intuition, pitfalls, alternative approaches (with code, each verified against the tests), follow-ups, and a 30-second "say it in the interview" summary.
- **LeetCode links** for every problem (same / variant / easier / harder), plus more practice per module. The link checker verifies all of them against LeetCode.
- **Java Collections, Under the Hood**: how ArrayList, HashMap, TreeMap (red-black tree), ArrayDeque, PriorityQueue and LinkedHashMap work inside, with costs and visualizations.
- **Tools**: pattern drill (name the pattern in 10 seconds, weighted toward your weak spots), spaced review, and mock interviews (timed, no tags, solution locked).

Progress is saved in your browser (localStorage).

## The two engines

Switch between them in the code panel:

| | In-browser (default) | Your JDK |
|---|---|---|
| Runs on | OpenJDK's javac + [TeaVM](https://teavm.org) compiled to WebAssembly, inside the tab | Your installed Java (17+), through a small local runner (`runner/`) |
| Needs | A browser with WebAssembly GC (recent Chrome, Edge, Firefox or Safari) | Node.js 18+ and a JDK on the PATH |
| Stack traces | Line numbers from the compiler; runtime exceptions reported by type | Full Java stack traces |
| Deep recursion | About 5,000 frames | Runs with `-Xss256m` |

### Using your own JDK

```
node runner/server.mjs
```

It prints two links:

- `http://localhost:8788/` serves the lab from this folder, already paired.
- `https://anadi198.github.io/learn-dsa/#pair=…` pairs the hosted site in this browser. You only need it once.

Then choose **Your JDK** in the code panel. Configure it with `DSALAB_PORT` (default `8788`) and `DSALAB_PAGES_URL`.

**Security:** the runner compiles and runs any Java the paired page sends, as your user. It only listens on `127.0.0.1`, only answers the known page origins, and needs the pairing token (kept in `runner/.dsalab-token`, which is git-ignored). Stop it with Ctrl+C when you're done.

## Running locally

The in-browser compiler needs http(s), so opening `index.html` from disk won't work:

```
node serve.mjs
```

That serves the site at http://localhost:8766. (`node runner/server.mjs` also serves it, on port 8788.)

## Files

| Path | What |
|---|---|
| `index.html`, `styles.css`, `app.js`, `extras.js` | The app: reader, editor (CodeMirror), grader, home, cheat sheets, flowcharts, drill, review, mock interviews |
| `harness.js` | Turns a problem spec + your code into Java files, parses the output, compares results. Shared by the page, the runner and the build tools |
| `engine.js`, `workers/` | The two engines (the browser engine compiles in one worker and runs each program in a fresh one, so infinite loops can be stopped) |
| `viz.js`, `tracers*.js` | The visualization player and the step tracers for each algorithm |
| `content/NN-*.js` | Modules: lessons and problems. `content/_core.js` documents the Markdown dialect |
| `content/meta.js` | Pattern catalogue (signals, commonly confused patterns) and the roadmap |
| `content/cheatsheets.js`, `content/drill.js` | Cheat sheets, flowcharts, pattern finder notes, extra drill prompts |
| `expected.js` | Generated: expected outputs for every test (see below) |
| `runner/server.mjs` | The local JDK runner (no dependencies) |
| `vendor/teavm/` | The in-browser compiler (see `vendor/teavm/NOTICE.md`) |

## Development

Requires Node.js 18+ and a JDK on the PATH.

```
node tools/build.mjs              # all problems
node tools/build.mjs m:dp-2d      # one module
node tools/build.mjs two-sum      # problems whose id contains "two-sum"
```

`build.mjs` compiles every reference solution, alternative solution and known-wrong solution with javac and runs them in one JVM. It checks hand-written expected values, requires alternatives to agree with the reference and wrong solutions to fail at least one test, and writes `expected.js` (big outputs are stored as hashes).

```
node tools/check-content.mjs      # internal links, visualization and flowchart ids, pattern keys, quizzes
node tools/check-links.mjs        # every LeetCode link: slug, number, title, premium flag (cached in .build/)
```

In the browser console on the lab, `await dsaSelfTest()` runs every reference solution through the grader on the selected engine (`dsaSelfTest({ filter: 'tree' })` runs a subset).

### Adding a problem

Add an entry to a module's `items` (copy a nearby problem: `fn` or `design` for the signature, `tests`, `hints`, `solution`, `lc`, `drill`), run `node tools/build.mjs <id>`, then `node tools/check-content.mjs`. Tests can use seeded generators (`{ $gen: 'ints', args: [n, lo, hi, seed] }`, see `__G` in `harness.js`) so large inputs don't bloat the source.

### Patched TeaVM class library

`tools/patch-teavm.mjs` rewrites the TeaVM class library files in `vendor/teavm/` from the originals in `vendor/teavm/orig/`. It exposes nested classes such as `Map.Entry` under their `java.util` names and adds methods the stock library is missing (`Integer.sum`, `Long.max`…). Rerun it with `node tools/patch-teavm.mjs` after updating the originals.
