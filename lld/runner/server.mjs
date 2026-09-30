// LLD Lab runner: lets the LLD Lab page (on GitHub Pages or served from here) compile and run your
// Java with the JDK on this computer, and ask Claude to review your code through the Claude Code CLI.
//
//   node lld/runner/server.mjs          (no npm install needed; needs javac + java on PATH, JDK 17+)
//
// It listens on 127.0.0.1 only, answers only the known page origins, and every request must carry
// the pairing token (kept in runner/.lldlab-token). It runs any Java the paired page sends, as you.
// Reviews run the Claude Code CLI with every tool disabled, so a review can only produce text.
// Stop it with Ctrl+C when you're done.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SITE_ROOT = normalize(join(HERE, '..', '..')); // the Deep End folder: the lab page loads ../shared/
const PORT = Number(process.env.LLDLAB_PORT || 8789);
const PAGES_URL = process.env.LLDLAB_PAGES_URL || 'https://anadi198.github.io/deep-end/lld/';
const ORIGINS = new Set([
  new URL(PAGES_URL).origin,
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
  'http://localhost:8767', 'http://127.0.0.1:8767',
  ...(process.env.LLDLAB_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]);
const MAX_OUT = 16 * 1024 * 1024;

/* ── pairing token: persisted so a paired browser stays paired across restarts ── */
const TOKEN_FILE = join(HERE, '.lldlab-token');
let TOKEN = process.env.LLDLAB_TOKEN || '';
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
  const dir = await mkdtemp(join(os.tmpdir(), 'lldlab-'));
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
      const r = await run('java', ['-Xss64m', '-cp', 'out', mainClass, ...a.map(String)], { cwd: dir, timeoutMs: Math.min(Math.max(1000, timeoutMs), 60000) });
      runs.push({ stdout: r.out, stderr: r.err.slice(0, 20000), exitCode: r.code, ms: r.ms, timedOut: r.timedOut, truncated: r.truncated });
    }
    return { compile: { ok: true, ms: c.ms }, runs };
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/* ── Claude Code CLI, for reviews ── */
// The desktop app ships the CLI without putting it on PATH, so look there too.
function findClaude() {
  if (process.env.LLDLAB_CLAUDE) return process.env.LLDLAB_CLAUDE;
  const onPath = spawnSync('claude', ['--version'], { encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32' });
  if (!onPath.error && onPath.status === 0) return 'claude';
  const roots = [
    process.env.APPDATA && join(process.env.APPDATA, 'Claude', 'claude-code'),
    join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude-code'),
  ].filter(Boolean);
  const ver = (s) => s.split('.').map((x) => parseInt(x, 10) || 0);
  const newer = (a, b) => { const x = ver(a), y = ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  for (const r of roots) {
    let dirs = [];
    try { dirs = fs.readdirSync(r).filter((d) => /^\d+\.\d+/.test(d)); } catch { continue; }
    dirs.sort((a, b) => (newer(a, b) ? -1 : newer(b, a) ? 1 : 0));
    for (const d of dirs) for (const exe of ['claude.exe', 'claude']) { const p = join(r, d, exe); if (fs.existsSync(p)) return p; }
  }
  return null;
}
const CLAUDE = findClaude();

// A session started from inside Claude Code inherits variables that point the CLI at that host's
// sign-in. The runner is its own process, so it uses the CLI's own sign-in instead.
function cliEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_') || k.startsWith('CLAUDE_AGENT_SDK')) delete env[k];
  return env;
}

let claudeStatus = { found: !!CLAUDE, loggedIn: null, checkedAt: 0 };
async function checkClaude(force = false) {
  if (!CLAUDE) return claudeStatus;
  if (!force && Date.now() - claudeStatus.checkedAt < (claudeStatus.loggedIn ? 10 * 60000 : 15000)) return claudeStatus;
  const r = await run(CLAUDE, ['auth', 'status'], { cwd: os.tmpdir(), timeoutMs: 20000 });
  let loggedIn = null;
  try { loggedIn = !!JSON.parse(r.out).loggedIn; } catch { loggedIn = /logged in/i.test(r.out) && !/not logged in/i.test(r.out); }
  claudeStatus = { found: true, loggedIn, checkedAt: Date.now() };
  return claudeStatus;
}

// The page sends the full review guide along with the exercise, so this only frames the job.
const REVIEW_SYSTEM = 'You review code for LLD Lab, a Java low-level design course. The user message holds your instructions, the exercise and the learner\'s code. You have no tools: answer with text only, in the format the message asks for.';

let reviewBusy = false;
function review(req, res, b) {
  const sse = (obj) => res.write('data: ' + JSON.stringify(obj) + '\n\n');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
  if (!CLAUDE) { sse({ error: 'The Claude Code CLI was not found. Install the Claude desktop app, or set LLDLAB_CLAUDE to the CLI path.' }); res.end(); return; }
  if (reviewBusy) { sse({ error: 'A review is already running. Wait for it to finish.' }); res.end(); return; }
  const prompt = String(b.prompt || '').slice(0, 120000);
  if (!prompt) { sse({ error: 'empty prompt' }); res.end(); return; }
  const model = /^[\w.-]{2,40}$/.test(b.model || '') ? b.model : 'opus';
  const effort = ['low', 'medium', 'high', 'xhigh'].includes(b.effort) ? b.effort : 'medium';
  reviewBusy = true;
  const args = ['-p', '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
    '--tools', '', '--no-session-persistence', '--model', model, '--effort', effort, '--append-system-prompt', REVIEW_SYSTEM];
  const p = spawn(CLAUDE, args, { cwd: os.tmpdir(), env: cliEnv(), windowsHide: true });
  let buf = '', sawDelta = false, finished = false, errText = '';
  const finish = (extra) => { if (finished) return; finished = true; reviewBusy = false; clearTimeout(timer); if (extra) sse(extra); sse({ done: true }); res.end(); };
  const timer = setTimeout(() => { p.kill('SIGKILL'); finish({ error: 'The review took longer than 5 minutes and was stopped.' }); }, 5 * 60000);
  p.stdout.on('data', (c) => {
    buf += c.toString('utf8');
    let k;
    while ((k = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.type === 'stream_event' && m.event && m.event.type === 'content_block_delta' && m.event.delta && m.event.delta.type === 'text_delta') {
        sawDelta = true; sse({ t: m.event.delta.text });
      } else if (m.type === 'result') {
        if (m.is_error) finish({ error: loginHint(String(m.result || 'the review failed')) });
        else { if (!sawDelta && m.result) sse({ t: m.result }); finish(); }
      }
    }
  });
  p.stderr.on('data', (c) => { errText += c.toString('utf8'); if (errText.length > 4000) errText = errText.slice(-4000); });
  p.on('error', (e) => finish({ error: 'Could not start the Claude Code CLI: ' + (e.message || e) }));
  p.on('close', (code) => finish(code ? { error: loginHint(errText.trim().split('\n').slice(-3).join(' ') || `the CLI exited with code ${code}`) } : null));
  res.on('close', () => { if (!finished) { p.kill('SIGKILL'); finished = true; reviewBusy = false; clearTimeout(timer); } });
  p.stdin.end(prompt);
}
function loginHint(msg) {
  if (/not logged in|\/login|authenticat/i.test(msg)) {
    claudeStatus.loggedIn = false;
    return 'Claude Code on this computer is not signed in. Run the sign-in command from the LLD Lab setup (claude auth login), then try again.';
  }
  return msg;
}

/* ── HTTP ── */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8' };

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-lldlab-token');
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
    const path = normalize(join(SITE_ROOT, decodeURIComponent(url.pathname).replace(/\/$/, '/index.html')));
    const rel = path.slice(SITE_ROOT.length).split(/[\\/]/).filter(Boolean);
    if (!path.startsWith(SITE_ROOT + sep) || rel.some((seg) => seg.startsWith('.') || ['runner', 'bridge', 'tools', 'node_modules'].includes(seg))) { res.writeHead(404).end(); return; }
    try {
      const data = await readFile(path);
      let out = data;
      // Served from here: pair automatically.
      if (path === join(SITE_ROOT, 'lld', 'index.html')) out = Buffer.from(data.toString('utf8').replace('<head>', `<head><script>window.LLDLAB_LOCAL_TOKEN=${JSON.stringify(TOKEN)};</script>`));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(out);
    } catch (e) {
      if (e.code === 'EISDIR') res.writeHead(301, { location: url.pathname + '/' }).end();
      else res.writeHead(404).end('not found');
    }
    return;
  }

  if (!originOk) { send(res, 403, { error: 'origin not allowed' }); return; }
  if (url.pathname === '/api/hello') {
    const paired = tokenOk(req.headers['x-lldlab-token']);
    const c = paired ? await checkClaude(url.searchParams.has('recheck')) : null;
    send(res, 200, { ok: true, app: 'lld-lab', java: JAVA, paired, claude: c && { found: c.found, loggedIn: c.loggedIn } });
    return;
  }
  if (!tokenOk(req.headers['x-lldlab-token'])) { send(res, 401, { error: 'not paired: open the pairing link printed by the runner' }); return; }
  if (url.pathname === '/api/run' && req.method === 'POST') {
    try {
      const b = await body(req);
      const job = busy.then(() => compileAndRun(b));
      busy = job.catch(() => {});
      send(res, 200, await job);
    } catch (e) { send(res, 400, { error: String(e.message || e) }); }
    return;
  }
  if (url.pathname === '/api/review' && req.method === 'POST') {
    let b;
    try { b = await body(req); } catch (e) { send(res, 400, { error: String(e.message || e) }); return; }
    review(req, res, b);
    return;
  }
  send(res, 404, { error: 'unknown endpoint' });
});

if (!JAVA) { console.error('javac/java not found on PATH. Install a JDK (17+) and try again.'); process.exit(1); }
server.listen(PORT, '127.0.0.1', async () => {
  console.log(`LLD Lab runner - Java ${JAVA}`);
  console.log('');
  console.log(`  Open the lab here (already paired):  http://localhost:${PORT}/lld/`);
  console.log(`  Or pair the hosted site once:        ${PAGES_URL}#pair=${TOKEN}`);
  console.log('');
  if (!CLAUDE) console.log('Claude reviews: the Claude Code CLI was not found (install the Claude desktop app, or set LLDLAB_CLAUDE).');
  else {
    const c = await checkClaude(true);
    console.log(c.loggedIn ? `Claude reviews: ready (${CLAUDE})` : `Claude reviews: sign in once with:\n  "${CLAUDE}" auth login`);
  }
  console.log('');
  console.log('Then pick "Your JDK" in the code panel. Ctrl+C stops the runner.');
});
