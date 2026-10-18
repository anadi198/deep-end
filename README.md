# Deep End

Hands-on labs, one site: **https://anadi198.github.io/deep-end/**

| Lab | Folder | What it teaches |
|---|---|---|
| [Rust Lab](https://anadi198.github.io/deep-end/rust/) | `rust/` | A Rust crash course: syntax and types, ownership, traits, errors, async; on the real compiler |
| [LLD Lab](https://anadi198.github.io/deep-end/lld/) | `lld/` | Low-level design, one pattern at a time, in Java |
| [DSA Lab](https://anadi198.github.io/deep-end/dsa/) | `dsa/` | Interview patterns and Java problems, graded in the browser |
| [Postgres Lab](https://anadi198.github.io/deep-end/pg/) | `pg/` | PostgreSQL 18 in the browser: plans, indexes, locking, schema design |
| [Backend Lab](https://anadi198.github.io/deep-end/backend/) | `backend/` | A quick look at backend failure modes: timeouts, retries, caches, Kafka, databases; simulators and interview drills |

Every lab runs in the browser with nothing to install. Each lab's own README covers its content, its checks and its optional local runner.

## Run it locally

```bash
node serve.mjs
```

Then open http://localhost:8767. The in-browser compilers need http(s), so opening the files from disk won't work.

## Offline

"Save for offline" on the home page keeps every lab on the device (about 42 MB), for flights and bad connections. Everything then works with no network except running Rust and C++ code, which goes to the Rust Playground and Compiler Explorer.

1. The deploy writes `offline-manifest.json`: every file the site serves, with its size and hash, plus the CDN files the labs load (CodeMirror, fonts, Mermaid, PGlite, the Firebase SDK). `serve.mjs` builds it per request.
2. `shared/offline.js`, on every page, registers `sw.js` and does the downloading. Site files are checked against their hash, so a download that straddles a deploy fails instead of saving a mix.
3. Once saved, `sw.js` answers site and CDN requests from the saved copy first.
4. On online visits (at most every 5 minutes; every load on localhost), `shared/offline.js` fetches only the files whose hash changed, writes them all at once, and offers a reload.

`manifest.webmanifest` and `icons/` let a phone add Deep End to its home screen. On iPhone, the home screen app keeps its own storage, separate from Safari.

## Layout

| Path | What |
|---|---|
| `index.html` | The home page: every lab, and where you left off |
| `<lab>/` | One lab, self-contained apart from `shared/` |
| `shared/sync.js`, `shared/syncmerge.js` | Cloud sync, used by every lab |
| `sw.js`, `shared/offline.js`, `shared/offline-plan.js` | The offline copy (see Offline above) |
| `tools/offline-manifest.mjs` | Writes `offline-manifest.json`; the deploy runs it |
| `manifest.webmanifest`, `icons/` | Add to Home Screen |
| `serve.mjs` | Local static server for the whole site |
| `firestore.rules` | Security rules for the sync database |
| `.github/workflows/pages.yml` | Deploys the site to GitHub Pages |

Labs share one origin, so progress in the browser survives moving between them. Each lab keeps its own storage keys (`rustlab.*`, `lldlab.*`, `dsalab.*`, `pglab.*`, `backendlab.*`).

## Adding a lab

1. Put it in its own folder, with its own `index.html` and relative paths.
2. Load `../shared/sync-config.js` and `../shared/sync.js` (plus `../shared/syncmerge.js` if it merges per field), and call `LabSync.init` with a new lab id. Load `../shared/offline-plan.js` and `../shared/offline.js`, and link `../manifest.webmanifest`, like the other labs. The offline file list picks up the new folder by itself; a new CDN file is picked up if its URL is written out in full in a page or script.
3. Add one entry to `LABS` in the root `index.html`, and a row to the table above.

## Deploying, and cloud sync

GitHub Pages deploys through `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions).

Cloud sync needs a Firebase web config, and that config is never committed:

* On Pages, the workflow writes `shared/sync-config.js` from the `LAB_FIREBASE` repository secret (Settings → Secrets and variables → Actions). Paste the `firebaseConfig` object from the Firebase console as the secret's value.
* Locally, copy `shared/sync-config.example.js` to `shared/sync-config.js` (gitignored) and fill it in.
* Without either, every lab works and sync stays off.

`firestore.rules` only lets one account read or write; put your Firebase user id in place of `OWNER_UID` in the console copy before publishing.

## Tests

```bash
node --test "shared/test/*.test.mjs" "tools/test/*.test.mjs"
```

Each lab's README lists its own checks.
