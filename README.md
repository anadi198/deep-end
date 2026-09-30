# Deep End

Hands-on labs, one site: **https://anadi198.github.io/**

| Lab | Folder | What it teaches |
|---|---|---|
| [Rust Lab](https://anadi198.github.io/rust/) | `rust/` | Reading and reviewing Rust as a Java developer, on the real compiler |
| [LLD Lab](https://anadi198.github.io/lld/) | `lld/` | Low-level design, one pattern at a time, in Java |
| [DSA Lab](https://anadi198.github.io/dsa/) | `dsa/` | Interview patterns and Java problems, graded in the browser |
| [Postgres Lab](https://anadi198.github.io/pg/) | `pg/` | PostgreSQL 18 in the browser: plans, indexes, locking, schema design |

Every lab runs in the browser with nothing to install. Each lab's own README covers its content, its checks and its optional local runner.

## Run it locally

```bash
node serve.mjs
```

Then open http://localhost:8767. The in-browser compilers need http(s), so opening the files from disk won't work.

## Layout

| Path | What |
|---|---|
| `index.html` | The home page: every lab, and where you left off |
| `<lab>/` | One lab, self-contained apart from `shared/` |
| `shared/sync.js`, `shared/syncmerge.js` | Cloud sync, used by every lab |
| `serve.mjs` | Local static server for the whole site |
| `firestore.rules` | Security rules for the sync database |
| `.github/workflows/pages.yml` | Deploys the site to GitHub Pages |

Labs share one origin, so progress in the browser survives moving between them. Each lab keeps its own storage keys (`rustlab.*`, `lldlab.*`, `dsalab.*`, `pglab.*`).

## Adding a lab

1. Put it in its own folder, with its own `index.html` and relative paths.
2. Load `../shared/sync-config.js` and `../shared/sync.js` (plus `../shared/syncmerge.js` if it merges per field), and call `LabSync.init` with a new lab id.
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
node --test shared/test/
```

Each lab's README lists its own checks.
