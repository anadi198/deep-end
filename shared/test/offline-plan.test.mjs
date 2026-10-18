import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../offline-plan.js');
const BASE = 'https://anadi198.github.io/deep-end/';

test('cacheKey: site files drop the query and fragment, folders mean index.html', () => {
  assert.equal(P.cacheKey(BASE + 'rust/app.js?v=3#x', BASE), BASE + 'rust/app.js');
  assert.equal(P.cacheKey(BASE + 'rust/', BASE), BASE + 'rust/index.html');
  assert.equal(P.cacheKey(BASE, BASE), BASE + 'index.html');
  assert.equal(P.cacheKey(BASE + 'pg/#/lesson/3', BASE), BASE + 'pg/index.html');
});

test('cacheKey: the manifest itself and pages outside the site are never cached', () => {
  assert.equal(P.cacheKey(BASE + 'offline-manifest.json', BASE), null);
  assert.equal(P.cacheKey(BASE + 'sw.js', BASE), null);
  assert.equal(P.cacheKey('https://anadi198.github.io/other/', BASE), null);
});

test('cacheKey: known CDNs keep their query (fonts CSS needs it), others are not cached', () => {
  const css = 'https://fonts.googleapis.com/css2?family=Archivo&display=swap';
  assert.equal(P.cacheKey(css, BASE), css);
  assert.equal(P.cacheKey('https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js', BASE), 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js');
  assert.equal(P.cacheKey('https://fonts.gstatic.com/s/archivo/v1/a.woff2', BASE), 'https://fonts.gstatic.com/s/archivo/v1/a.woff2');
  assert.equal(P.cacheKey('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js', BASE), 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
  assert.equal(P.cacheKey('https://www.gstatic.com/other/thing.js', BASE), null);
  assert.equal(P.cacheKey('https://play.rust-lang.org/meta/versions', BASE), null);
  assert.equal(P.cacheKey('https://firestore.googleapis.com/v1/projects/x', BASE), null);
});

const M1 = {
  version: 'a',
  files: [{ path: 'index.html', hash: 'h1', size: 10 }, { path: 'rust/app.js', hash: 'h2', size: 20 }, { path: 'old.js', hash: 'h3', size: 5 }],
  external: ['https://cdn.example/a.js'],
};
const M2 = {
  version: 'b',
  files: [{ path: 'index.html', hash: 'h1', size: 10 }, { path: 'rust/app.js', hash: 'h2b', size: 21 }, { path: 'new.js', hash: 'h4', size: 7 }],
  external: ['https://cdn.example/a.js', 'https://cdn.example/b.js'],
};

test('diff: a first save fetches every file and every external', () => {
  const d = P.diff(null, M1);
  assert.deepEqual(d.fetch.map((x) => x.path || x.url), ['index.html', 'rust/app.js', 'old.js', 'https://cdn.example/a.js']);
  assert.deepEqual(d.remove, []);
});

test('diff: an update fetches only changed or new entries and removes dropped ones', () => {
  const d = P.diff(M1, M2);
  assert.deepEqual(d.fetch.map((x) => x.path || x.url), ['rust/app.js', 'new.js', 'https://cdn.example/b.js']);
  assert.deepEqual(d.remove, ['old.js']);
});

test('diff: the same manifest needs nothing', () => {
  assert.deepEqual(P.diff(M2, M2), { fetch: [], remove: [] });
});

test('fontFiles: pulls the font file URLs out of a Google Fonts stylesheet', () => {
  const css = `@font-face { font-family: 'Archivo'; src: url(https://fonts.gstatic.com/s/archivo/v19/a.woff2) format('woff2'); }
@font-face { src: url("https://fonts.gstatic.com/s/jb/v1/b.woff2") format('woff2'); }
@font-face { src: url(https://fonts.gstatic.com/s/archivo/v19/a.woff2) format('woff2'); }`;
  assert.deepEqual(P.fontFiles(css), ['https://fonts.gstatic.com/s/archivo/v19/a.woff2', 'https://fonts.gstatic.com/s/jb/v1/b.woff2']);
});

test('sha: matches the hash the deploy writes into the manifest', async () => {
  const bytes = new TextEncoder().encode('fn main() { println!("hi"); }\n');
  const expected = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  assert.equal(await P.sha(bytes), expected);
});

test('megabytes: rounds for display', () => {
  assert.equal(P.megabytes(41_234_567), '41 MB');
  assert.equal(P.megabytes(420_000), '0.4 MB');
});
