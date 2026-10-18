import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldCache, scanExternal, buildManifest, PGLITE_BASE, FIREBASE_BASE } from '../offline-manifest.mjs';

const SITE = fileURLToPath(new URL('../../', import.meta.url));

test('shouldCache: keeps what the pages load, drops tooling, tests and docs', () => {
  for (const p of ['index.html', 'rust/app.js', 'rust/content/01-syntax.js', 'dsa/vendor/teavm/compiler.wasm',
    'lld/workers/compile.js', 'shared/sync-config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'pg/engine-worker.js']) {
    assert.equal(shouldCache(p), true, p);
  }
  for (const p of ['serve.mjs', 'README.md', 'rust/README.md', 'rust/test/harness.test.mjs', 'rust/tools/build.mjs',
    'rust/.build/cache.json', '.github/workflows/pages.yml', '.nojekyll', 'dsa/runner/server.mjs', 'pg/bridge/server.mjs',
    'lld/vendor/teavm/orig/runtime-classlib-teavm.bin', 'dsa/vendor/teavm/NOTICE.md', 'shared/sync-config.example.js',
    'firestore.rules', 'offline-manifest.json', 'sw.js', 'node_modules/x/index.js', 'tools/offline-manifest.mjs',
    'backend/test/sims.test.mjs', 'scratch/notes.txt']) {
    assert.equal(shouldCache(p), false, p);
  }
});

test('scanExternal: finds CDN files, skips folders, templates and links to docs', () => {
  const urls = scanExternal([
    { path: 'a.html', text: `<script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500&amp;display=swap">
      <a href="https://www.postgresql.org/docs/current/">docs</a>` },
    { path: 'b.js', text: `const PG = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist';
      const M = 'https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js';
      const T = \`https://cdn.jsdelivr.net/npm/x@1/\${name}.js\`;
      const again = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js';` },
  ]);
  assert.deepEqual(urls, [
    'https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js',
    'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500&display=swap',
  ]);
});

test('buildManifest: lists cacheable files with sizes and hashes; the version follows the content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'offline-'));
  mkdirSync(join(dir, 'rust', 'test'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<script src="https://cdnjs.cloudflare.com/ajax/libs/x/1.0/x.min.js"></script>');
  writeFileSync(join(dir, 'rust', 'app.js'), 'console.log(1)');
  writeFileSync(join(dir, 'rust', 'test', 'a.test.mjs'), 'x');
  writeFileSync(join(dir, 'README.md'), 'x');
  const a = buildManifest(dir);
  assert.deepEqual(a.files.map((f) => f.path), ['index.html', 'rust/app.js']);
  assert.equal(a.files[1].size, 14);
  assert.match(a.files[1].hash, /^[0-9a-f]{16}$/);
  assert.ok(a.external.includes('https://cdnjs.cloudflare.com/ajax/libs/x/1.0/x.min.js'));
  assert.ok(a.bytes >= 14 && a.externalBytes > 0);
  assert.equal(buildManifest(dir).version, a.version);
  writeFileSync(join(dir, 'rust', 'app.js'), 'console.log(2)');
  assert.notEqual(buildManifest(dir).version, a.version);
});

const SITE_MANIFEST = buildManifest(SITE);
const has = (p) => SITE_MANIFEST.files.some((f) => f.path === p);

test('site: every local script, stylesheet and worker a page loads is in the manifest', () => {
  for (const page of ['index.html', 'rust/index.html', 'lld/index.html', 'dsa/index.html', 'pg/index.html', 'backend/index.html']) {
    assert.ok(has(page), page);
    const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
    const html = readFileSync(join(SITE, page), 'utf8');
    for (const [, ref] of html.matchAll(/(?:src|href)="(?!https?:|data:|#|mailto:)([^"]+)"/g)) {
      if (ref === './' || ref.endsWith('/') || ref.includes('${')) continue;
      const path = new URL(ref, 'http://x/' + dir).pathname.slice(1);
      if (path === 'shared/sync-config.js') continue;   // written by the deploy, absent without the secret
      assert.ok(has(path), `${page} loads ${ref}, missing from the manifest`);
    }
  }
  for (const p of ['dsa/workers/compile.js', 'dsa/workers/run.js', 'lld/workers/compile.js', 'lld/workers/run.js', 'pg/engine-worker.js',
    'dsa/vendor/teavm/compiler.wasm', 'dsa/vendor/teavm/runtime-classlib-teavm.bin', 'dsa/vendor/teavm/compile-classlib-teavm.bin']) {
    assert.ok(has(p), p);
  }
});

test('site: the PGlite and Firebase versions match the ones the code loads', () => {
  const worker = readFileSync(join(SITE, 'pg', 'engine-worker.js'), 'utf8');
  assert.ok(worker.includes(`'${PGLITE_BASE}`), 'pg/engine-worker.js imports from ' + PGLITE_BASE);
  const sync = readFileSync(join(SITE, 'shared', 'sync.js'), 'utf8');
  const ver = sync.match(/const VER = '([^']+)'/)[1];
  assert.equal(FIREBASE_BASE, `https://www.gstatic.com/firebasejs/${ver}`);
  for (const u of [PGLITE_BASE + '/index.js', PGLITE_BASE + '/pglite.wasm', PGLITE_BASE + '/pglite.data', FIREBASE_BASE + '/firebase-auth.js']) {
    assert.ok(SITE_MANIFEST.external.includes(u), u);
  }
});

test('site: Mermaid loads as the single-file build, so it can be saved ahead of time', () => {
  for (const lab of ['rust', 'lld', 'backend']) {
    const viz = readFileSync(join(SITE, lab, 'viz.js'), 'utf8');
    assert.ok(!viz.includes('mermaid.esm'), `${lab}/viz.js still loads the split ESM build`);
  }
  assert.ok(SITE_MANIFEST.external.includes('https://cdn.jsdelivr.net/npm/mermaid@12.0.0/dist/mermaid.min.js'));
});
