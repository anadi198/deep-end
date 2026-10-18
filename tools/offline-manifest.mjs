// Writes offline-manifest.json: every file the site serves to a browser, with size and hash, plus the CDN files the
// labs load. The deploy runs it after writing shared/sync-config.js; serve.mjs builds it on the fly.
//   Usage:  node tools/offline-manifest.mjs
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PGLITE_BASE = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist';
export const FIREBASE_BASE = 'https://www.gstatic.com/firebasejs/12.19.0';

// PGlite's module graph for the five extensions pg/engine-worker.js loads, crawled from the CDN.
const PGLITE = ['index.js', 'chunk-2BOC2OMW.js', 'chunk-DDJLRBDX.js', 'chunk-F4GETNPB.js', 'chunk-JDT7TZ73.js', 'chunk-NNS5RQRF.js',
  'chunk-QY3QWFKW.js', 'chunk-RYDTTX3G.js', 'initdb.js', 'initdb.wasm', 'pglite.wasm', 'pglite.data',
  ...['pg_trgm', 'pg_stat_statements', 'btree_gist', 'pageinspect', 'pg_visibility'].flatMap((x) => [`contrib/${x}.js`, `${x}.tar.gz`])];
const FIREBASE = ['firebase-app.js', 'firebase-auth.js', 'firebase-firestore-lite.js'];
// Display estimate only: the CDN files above plus Mermaid, CodeMirror and fonts, measured October 2026.
const EXTERNAL_BYTES = 25e6;

const SKIP_DIRS = new Set(['node_modules', 'test', 'tools', 'runner', 'bridge', 'orig', 'scratch']);
const SKIP_EXT = new Set(['.md', '.mjs', '.rules']);
const SKIP_FILES = new Set(['offline-manifest.json', 'sw.js', 'sync-config.example.js', 'package.json', 'package-lock.json']);

export function shouldCache(rel) {
  const parts = rel.split('/');
  const name = parts[parts.length - 1];
  if (parts.some((p) => p.startsWith('.'))) return false;
  if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p))) return false;
  return !SKIP_EXT.has(extname(name)) && !SKIP_FILES.has(name);
}

const CDN_URL = /https:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com)\/[^"'`\s<>)]+/g;

export function scanExternal(files) {
  const out = new Set();
  for (const { text } of files) {
    for (const [m] of text.matchAll(CDN_URL)) {
      if (m.includes('${')) continue;
      const url = m.replace(/&amp;/g, '&');
      const u = new URL(url);
      if (u.host !== 'fonts.googleapis.com' && !u.pathname.split('/').pop().includes('.')) continue;
      out.add(url);
    }
  }
  return [...out].sort();
}

function walk(dir, root, out) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) walk(full, root, out); }
    else out.push(relative(root, full).split(sep).join('/'));
  }
  return out;
}

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

export function buildManifest(root) {
  const files = [], texts = [];
  for (const path of walk(root, root, []).filter(shouldCache).sort()) {
    const buf = readFileSync(join(root, path));
    files.push({ path, size: buf.length, hash: hash(buf) });
    if (/\.(html|js)$/.test(path)) texts.push({ path, text: buf.toString('utf8') });
  }
  const external = [...new Set([...scanExternal(texts), ...PGLITE.map((f) => `${PGLITE_BASE}/${f}`), ...FIREBASE.map((f) => `${FIREBASE_BASE}/${f}`)])].sort();
  const version = hash(files.map((f) => f.path + ' ' + f.hash).concat(external).join('\n'));
  return { version, bytes: files.reduce((n, f) => n + f.size, 0), externalBytes: EXTERNAL_BYTES, files, external };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const m = buildManifest(root);
  writeFileSync(join(root, 'offline-manifest.json'), JSON.stringify(m) + '\n');
  console.log(`offline-manifest.json: ${m.files.length} files, ${(m.bytes / 1e6).toFixed(1)} MB, ${m.external.length} CDN files, version ${m.version}`);
}
