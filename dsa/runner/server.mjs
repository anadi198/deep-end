// DSA Lab runner: lets the DSA Lab page (on GitHub Pages or served from here) compile and run
// your Java with the JDK installed on this computer, instead of the in-browser compiler.
//
//   node runner/server.mjs          (no npm install needed; needs javac + java on PATH, JDK 17+)
//
// It listens on 127.0.0.1 only, answers only the known page origins, and every run request must
// carry the pairing token (kept in runner/.dsalab-token). It runs any Java the paired page sends,
// as you — stop it with Ctrl+C when you're done.
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP_ROOT = normalize(join(HERE, '..'));
const PORT = Number(process.env.DSALAB_PORT || 8788);
const PAGES_URL = process.env.DSALAB_PAGES_URL || 'https://anadi198.github.io/learn-dsa/';
const ORIGINS = new Set([
  new URL(PAGES_URL).origin,
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
  'http://localhost:8766', 'http://127.0.0.1:8766',
  ...(process.env.DSALAB_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);
const MAX_OUT = 16 * 1024 * 1024;

/* ── pairing token: persisted so a paired browser stays paired across restarts ── */
const TOKEN_FILE = join(HERE, '.dsalab-token');
let TOKEN = process.env.DSALAB_TOKEN || '';
if (!TOKEN) {
  try { TOKEN = (await readFile(TOKEN_FILE, 'utf8')).trim(); } catch { /* first run */ }
  if (!TOKEN) { TOKEN = crypto.randomBytes(18).toString('base64url'); await writeFile(TOKEN_FILE, TOKEN + '\n'); }
}
const tokenOk = (t) => typeof t === 'string' && t.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(TOKEN));

/* ── Java ── */
function javaVersion() {
  const r = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const m = /version "([^"]+)"/.exec((r.stderr || '') + (r.stdout || ''));
  const c = spawnSync('javac', ['-version'], { encoding: 'utf8' });
  if (c.error) return null;
  return m ? m[1] : 'unknown';
}
const JAVA = javaVersion();

function run(cmd, args, { cwd, timeoutMs, input }) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const p = spawn(cmd, args, { cwd, windowsHide: true });
    let out = '', err = '', size = 0, killed = false, timedOut = false;
    const cap = (s, chunk) => { size += chunk.length; if (size > MAX_OUT) { if (!killed) { killed = true; p.kill('SIGKILL'); } return s; } return s + chunk.toString('utf8'); };
    p.stdout.on('data', (c) => { out = cap(out, c); });
    p.stderr.on('data', (c) => { err = cap(err, c); });
    const timer = setTimeout(() => { timedOut = true; p.kill('SIGKILL'); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out, err: String(e.message || e), ms: performance.now() - t0, timedOut }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err, ms: performance.now() - t0, timedOut, truncated: size > MAX_OUT }); });
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

// javac output → [{ file, line, col, message }]
function parseJavac(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:.*[\\/])?([\w$]+\.java):(\d+): (error|warning): (.*)$/.exec(lines[i]);
    if (!m) continue;
    const d = { file: m[1], line: +m[2], severity: m[3], message: m[4], col: 0 };
    // following lines: the source line, then a caret line, then extra detail ("symbol: ...")
    let j = i + 1;
    const extra = [];
    for (; j < lines.length && !/^(?:.*[\\/])?[\w$]+\.java:\d+: /.test(lines[j]) && !/^\d+ errors?$/.test(lines[j]); j++) {
      if (/^\s*\^\s*$/.test(lines[j])) d.col = lines[j].indexOf('^') + 1;
      else if (j > i + 1 && lines[j].trim()) extra.push(lines[j].trim());
    }
    if (extra.length) d.message += '\n' + extra.join('\n');
    out.push(d);
    i = j - 1;
  }
  return out;
}

async function compileAndRun({ files, mainClass = 'Main', args = [], timeoutMs = 10000 }) {
  if (!files || typeof files !== 'object') throw new Error('files missing');
  const dir = await mkdtemp(join(os.tmpdir(), 'dsalab-'));
  try {
    const names = [];
    for (const [name, src] of Object.entries(files)) {
      if (!/^[\w$]+\.java$/.test(name)) throw new Error('bad file name ' + name);
      await writeFile(join(dir, name), String(src), 'utf8');
      names.push(name);
    }
    const c = await run('javac', ['-encoding', 'UTF-8', '-nowarn', '-Xmaxerrs', '50', '-d', 'out', ...names], { cwd: dir, timeoutMs: 60000 });
    if (c.code !== 0) return { compile: { ok: false, ms: c.ms, diagnostics: parseJavac(c.err + c.out), raw: (c.err + c.out).slice(0, 20000) } };
    const runs = [];
    for (const a of Array.isArray(args[0]) ? args : [args]) {
      const r = await run('java', ['-Xss256m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-cp', 'out', mainClass, ...a.map(String)], { cwd: dir, timeoutMs: Math.min(Math.max(1000, timeoutMs), 60000) });
      runs.push({ stdout: r.out, stderr: r.err.slice(0, 20000), exitCode: r.code, ms: r.ms, timedOut: r.timedOut, truncated: r.truncated });
    }
    return { compile: { ok: true, ms: c.ms }, runs };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ── HTTP ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-dsalab-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  return !origin || ORIGINS.has(origin);
}
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
async function body(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 20e6) throw new Error('request too large'); chunks.push(c); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

let busy = Promise.resolve();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const originOk = cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(originOk ? 204 : 403); res.end(); return; }

  if (!url.pathname.startsWith('/api/')) { // static app files, so http://localhost:PORT works too
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    const path = normalize(join(APP_ROOT, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname)));
    const rel = path.slice(APP_ROOT.length).split(/[\\/]/).filter(Boolean);
    if (!path.startsWith(APP_ROOT) || ['runner', 'tools', 'node_modules'].includes(rel[0]) || rel.some((seg) => seg.startsWith('.'))) { res.writeHead(404).end(); return; }
    try {
      const data = await readFile(path);
      let out = data;
      // Served from here: pair automatically.
      if (url.pathname === '/' || url.pathname === '/index.html') out = Buffer.from(data.toString('utf8').replace('<head>', `<head><script>window.DSALAB_LOCAL_TOKEN=${JSON.stringify(TOKEN)};</script>`));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(out);
    } catch { res.writeHead(404).end('not found'); }
    return;
  }

  if (!originOk) { send(res, 403, { error: 'origin not allowed' }); return; }
  if (url.pathname === '/api/hello') { send(res, 200, { ok: true, app: 'dsa-lab', java: JAVA, paired: tokenOk(req.headers['x-dsalab-token']) }); return; }
  if (!tokenOk(req.headers['x-dsalab-token'])) { send(res, 401, { error: 'not paired — open the pairing link printed by the runner' }); return; }
  if (url.pathname === '/api/run' && req.method === 'POST') {
    try {
      const b = await body(req);
      const job = busy.then(() => compileAndRun(b));
      busy = job.catch(() => {});
      send(res, 200, await job);
    } catch (e) { send(res, 400, { error: String(e.message || e) }); }
    return;
  }
  send(res, 404, { error: 'unknown endpoint' });
});

if (!JAVA) { console.error('javac/java not found on PATH. Install a JDK (17+) and try again.'); process.exit(1); }
server.listen(PORT, '127.0.0.1', () => {
  console.log(`DSA Lab runner — Java ${JAVA}`);
  console.log('');
  console.log(`  Open the lab here (already paired):  http://localhost:${PORT}/`);
  console.log(`  Or pair the hosted site once:        ${PAGES_URL}#pair=${TOKEN}`);
  console.log('');
  console.log('Then pick "Your JDK" in the code panel. Ctrl+C stops the runner.');
});
