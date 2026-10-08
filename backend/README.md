# Backend Lab

A quick look at backend systems under failure: timeouts, retries, idempotency, caching, Kafka, databases and drift. Each lesson teaches one mechanism, runs it in a simulator, and ends with interview drills that work through the follow-up questions.

Live at https://anadi198.github.io/deep-end/backend/

## Layout

| Path | What |
|---|---|
| `index.html` | The page; lists every sim and content file it loads |
| `app.js` | Routing, outline, lessons, the markdown dialect, quizzes, "Defend it" rounds, progress, sync merge |
| `extras.js` | Home, Today (spaced review), Mock round, recognition drill, cheat sheets, setup, sync wiring |
| `simui.js` | Renders a simulator: controls, stat tiles, line charts, bars, tables, the ownership grid, comparisons |
| `sims/core.js` | The simulator registry, a seeded random generator and percentiles |
| `sims/*.js` | One seeded model per simulator; each runs in the page and in Node |
| `content/_core.js` | The content registry and the full content format |
| `content/NN-*.js` | One module per file |
| `content/cheatsheets.js`, `content/drill.js` | Cheat sheets and recognition-drill items |
| `highlight.js`, `viz.js` | Java and SQL highlighting; the step-through sequence player and Mermaid diagrams |

## Checks

```bash
node --test "test/*.test.mjs"
```

* `test/<sim>.test.mjs` pins the behaviour each lesson describes: for example, that three immediate retries never recover from a five-second slowdown, or that stale-while-revalidate sends one query and makes nobody wait.
* `test/content.test.mjs` checks that every `@sim` names a real simulator with real parameter values, every `@quiz` and `@defend` points at something, every `@lab pg:<id>` link exists in the Postgres Lab, every lesson has its remember line, cue and drills, every file is loaded by the page, and there are no em dashes.

## Adding a simulator

1. Write `test/<name>.test.mjs` first, asserting the behaviour the lesson will claim.
2. Add `sims/<name>.js` with `BS.define('<name>', { title, blurb, params, compare, run })`. `run(params)` must be deterministic: use `BS.rng(seed)`, never `Math.random()`.
3. List it in `index.html` between the `@sims` markers and use it from a lesson with `@sim <name> key=value`.

The progress key is `backendlab.v1`; cloud sync stores it at `users/{uid}/labs/backend`.
