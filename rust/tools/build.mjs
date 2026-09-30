// Checks every Rust claim in the course against the real compiler (the Rust Playground) and records
// the output the page shows under each snippet.
//   * rust fences flagged !run / !panic / !fail / !clippy behave as flagged
//   * every predict question's answer is what actually happens
//   * every exercise solution passes all its tests; every wrong answer fails; starters fail as declared
//   * every review file compiles (the compiler passed that PR), and so does its fixed version
// Writes outputs.js. Responses are cached in .build/cache.json, so re-runs only send what changed.
//
//   node tools/build.mjs              everything
//   node tools/build.mjs own          only items whose location contains "own"
//   node tools/build.mjs --static     structure checks only (no network)
//   node tools/build.mjs --fresh      ignore the cache
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = require(path.join(ROOT, 'harness.js'));
const args = process.argv.slice(2);
const staticOnly = args.includes('--static');
const fresh = args.includes('--fresh');
const filter = args.find((a) => !a.startsWith('--')) || '';

export function loadContent() {
  require(path.join(ROOT, 'content', '_core.js'));
  const files = fs.readdirSync(path.join(ROOT, 'content')).filter((f) => /^\d.*\.js$/.test(f)).sort();
  for (const f of files) require(path.join(ROOT, 'content', f));
  for (const f of ['drill.js', 'cheatsheets.js']) if (fs.existsSync(path.join(ROOT, 'content', f))) require(path.join(ROOT, 'content', f));
  return { RL: globalThis.RL, files };
}

const problems = [];
const bad = (msg) => problems.push(msg);

/* ───────────── structure ───────────── */
const { RL, files } = loadContent();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const f of files) if (!html.includes(`content/${f}`)) bad(`index.html does not load content/${f}`);
const EM = /—/;
const ids = new Set();
const lessons = [], exercises = [];
for (const m of RL.modules) {
  if (!m.id || !m.title) bad(`module without id/title: ${JSON.stringify(m).slice(0, 80)}`);
  for (const it of m.items) {
    const id = it.lesson || (it.exercise && it.exercise.id);
    if (!id) { bad(`${m.id}: item without an id`); continue; }
    if (ids.has(id)) bad(`duplicate id ${id}`);
    ids.add(id);
    if (it.lesson) {
      lessons.push(it);
      if (!it.title || !it.body) bad(`lesson ${id}: needs title and body`);
      if (!it.remember) bad(`lesson ${id}: needs a remember line`);
      if (it.cue && !it.cue.includes('→')) bad(`lesson ${id}: cue should read "when you see X → Y"`);
      if ((it.mins || 0) > 10) bad(`lesson ${id}: ${it.mins} min is too long; split it`);
      for (const [, n] of String(it.body).matchAll(/@quiz (\d+)/g)) if (!(it.quiz || [])[+n]) bad(`lesson ${id}: @quiz ${n} has no question`);
      for (const [, n] of String(it.body).matchAll(/@predict (\d+)/g)) if (!(it.predict || [])[+n]) bad(`lesson ${id}: @predict ${n} has no question`);
      (it.predict || []).forEach((p, n) => { if (!String(it.body).includes(`@predict ${n}`)) bad(`lesson ${id}: predict ${n} is never shown`); if (!(p.answer >= 0 && p.answer < p.options.length)) bad(`lesson ${id}: predict ${n} answer out of range`); });
      (it.quiz || []).forEach((q, n) => { if (!(q.answer >= 0 && q.answer < q.options.length)) bad(`lesson ${id}: quiz ${n} answer out of range`); });
      if (EM.test(JSON.stringify(it))) bad(`lesson ${id}: contains an em dash`);
    } else {
      const x = it.exercise;
      exercises.push(x);
      x.module = m.id;
      if (!['fix', 'build', 'review'].includes(x.kind)) bad(`exercise ${id}: unknown kind ${x.kind}`);
      if (!x.title || !x.statement) bad(`exercise ${id}: needs title and statement`);
      if (EM.test(JSON.stringify(x))) bad(`exercise ${id}: contains an em dash`);
      if (x.kind === 'review') {
        const p = H.parseReview(x.code || '');
        for (const is of x.issues || []) {
          if (!RL.tags[is.tag]) bad(`review ${id}: issue ${is.id} has unknown tag ${is.tag}`);
          if (!p.marks[is.id]) bad(`review ${id}: issue ${is.id} is not marked on any line`);
          if (!is.title || !is.why) bad(`review ${id}: issue ${is.id} needs title and why`);
        }
        for (const d of x.decoys || []) if (!p.marks[d.id]) bad(`review ${id}: decoy ${d.id} is not marked on any line`);
        const known = new Set([...(x.issues || []), ...(x.decoys || [])].map((z) => z.id));
        for (const k of Object.keys(p.marks)) if (!known.has(k)) bad(`review ${id}: line mark ⟦${k}⟧ is neither an issue nor a decoy`);
        if (!(x.issues || []).length) bad(`review ${id}: no issues`);
      } else {
        if (!(x.tests || []).length) bad(`exercise ${id}: no tests`);
        if (!(x.tests || []).some((t) => t.ex)) bad(`exercise ${id}: no visible (ex) test`);
        if (!x.solution || !x.solution.rust) bad(`exercise ${id}: no solution.rust`);
        if (!['compile', 'tests'].includes(x.starterFails)) bad(`exercise ${id}: starterFails must be 'compile' or 'tests'`);
      }
    }
  }
}
for (const c of RL.cheats) if (EM.test(JSON.stringify(c))) bad(`cheat sheet ${c.id}: contains an em dash`);
for (const d of RL.drill) { if (!(d.answer >= 0 && d.answer < d.options.length)) bad(`drill "${d.q.slice(0, 40)}": answer out of range`); if (EM.test(JSON.stringify(d))) bad(`drill "${d.q.slice(0, 40)}": contains an em dash`); }

// «» mark inline code in prose; inside Rust source they would show up literally.
const noMarkers = (where, src) => { if (/[«»]/.test(src || '')) bad(`${where}: «» inside Rust code (use plain words in code comments)`); };
for (const l of lessons) { (l.predict || []).forEach((p, n) => noMarkers(`lesson ${l.lesson} predict ${n}`, p.code)); H.fences(l.body).forEach((f, k) => noMarkers(`lesson ${l.lesson} fence ${k + 1}`, f.src)); }
for (const x of exercises) {
  noMarkers(`exercise ${x.id} starter`, x.starter); noMarkers(`exercise ${x.id} code`, x.code);
  noMarkers(`exercise ${x.id} solution`, x.solution && (x.solution.rust || x.solution.fixed));
  (x.tests || []).forEach((t) => noMarkers(`exercise ${x.id} test ${t.name}`, t.code));
  (x.issues || []).forEach((is) => noMarkers(`exercise ${x.id} issue ${is.id} demo`, is.demo));
}

/* ───────────── jobs ───────────── */
const jobs = [];
const demoOut = {};
const job = (where, kind, code, check, record) => { if (!filter || where.includes(filter)) jobs.push({ where, kind, code, check, record }); };
const expectFor = {
  run: (o) => o.kind === 'ok' || `expected it to run, got ${o.kind}\n${o.text}`,
  panic: (o) => o.kind === 'panic' || `expected a panic, got ${o.kind}\n${o.text}`,
  fail: (o) => o.kind === 'compile-error' || `expected a compile error, got ${o.kind}`,
  clippy: (o) => o.kind !== 'compile-error' || `clippy snippet does not compile\n${o.text}`,
  hang: (o) => o.kind === 'timeout' || `expected it to hang until the Playground stops it, got ${o.kind}\n${o.text}`,
};
function fenceJobs(where, body) {
  H.fences(body).forEach((f, k) => {
    const s = H.snippet(f.flag, f.src);
    job(`${where} fence ${k + 1}${f.label ? ' (' + f.label + ')' : ''}`, s.kind, s.program, expectFor[f.flag], s.key);
  });
}
for (const l of lessons) {
  fenceJobs(`lesson ${l.lesson}`, l.body);
  (l.predict || []).forEach((p, n) => {
    const s = H.snippet('run', p.code);
    job(`lesson ${l.lesson} predict ${n}`, 'run', s.program, (o) => { const c = H.checkPredict(p, o); return c.ok || `answer says "${p.options[p.answer]}"${p.error ? ' (' + p.error + ')' : ''}, but it was "${c.actual}"${o.diags ? ' ' + o.diags.map((d) => d.code).join(',') : ''}\n${o.text}`; }, s.key);
  });
}
for (const c of RL.cheats) fenceJobs(`cheat ${c.id}`, c.body);
const allPass = (n) => (o, resp) => {
  if (o.kind === 'compile-error') return 'does not compile\n' + o.text;
  const r = H.parseLibtest(resp.stdout, n);
  const failed = r.map((t, i) => [t, i]).filter(([t]) => t.status !== 'pass');
  return !failed.length || failed.map(([t, i]) => `test ${i} ${t.status}: ${t.msg || ''}`).join('\n');
};
const someFail = (n) => (o, resp) => o.kind === 'compile-error' || H.parseLibtest(resp.stdout, n).some((t) => t.status !== 'pass') || 'every test passes';
for (const x of exercises) {
  fenceJobs(`exercise ${x.id} statement`, x.statement);
  if (x.kind === 'review') {
    const p = H.parseReview(x.code);
    job(`review ${x.id}`, 'clippy', p.code, (o) => o.kind !== 'compile-error' || 'the PR code does not compile\n' + o.text, H.key('clippy', p.code));
    // An issue's demo is a test that must fail against the PR code: proof the planted bug is real.
    for (const is of x.issues || []) {
      if (!is.demo) continue;
      const code = H.buildTestCrate(p.code, [{ code: is.demo, async: is.demoAsync }]).code;
      job(`review ${x.id} issue ${is.id} demo`, 'test', code, (o, resp) => {
        if (o.kind === 'compile-error') return 'the demo does not compile against the PR code\n' + o.text;
        // For a stall or a hang, a test that never finishes is the proof.
        if (o.kind === 'timeout' && ['block', 'hang'].includes(is.tag)) { demoOut[H.key('demo', is.demo)] = { k: 'fail', o: '', t: '', e: 'The test never finished: the Playground stopped it after about 10 seconds.' }; return true; }
        const t = H.parseLibtest(resp.stdout, 1)[0];
        if (t.status !== 'fail') return 'the demo passes on the PR code, so it does not show the bug';
        demoOut[H.key('demo', is.demo)] = { k: 'fail', o: t.stdout.join('\n'), t: '', e: t.msg || '' };
        return true;
      });
    }
    if (x.solution && x.solution.fixed) {
      const fixed = H.splitHidden(x.solution.fixed.trim()).full;
      job(`review ${x.id} fixed`, 'clippy', fixed, (o) => o.kind !== 'compile-error' || 'the fixed code does not compile\n' + o.text, H.key('clippy', fixed));
    }
    continue;
  }
  const n = x.tests.length;
  job(`exercise ${x.id} solution`, 'test', H.buildTestCrate(x.solution.rust, x.tests).code, allPass(n));
  job(`exercise ${x.id} starter`, 'test', H.buildTestCrate(x.starter || '', x.tests).code,
    x.starterFails === 'compile' ? (o) => o.kind === 'compile-error' || 'the starter compiles, but starterFails says compile' : (o, resp) => (o.kind === 'compile-error' ? 'the starter does not compile\n' + o.text : someFail(n)(o, resp)));
  for (const w of x.wrong || []) job(`exercise ${x.id} wrong "${w.name}"`, 'test', H.buildTestCrate(w.rust, x.tests).code, someFail(n));
}

/* ───────────── Playground ───────────── */
const CACHE_FILE = path.join(ROOT, '.build', 'cache.json');
let cache = {};
if (!fresh) try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { /* first run */ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let sent = 0;
async function play(kind, code) {
  const k = H.key(kind, code);
  if (cache[k]) return cache[k];
  const { endpoint, body } = H.request(kind, code);
  for (let attempt = 0; ; attempt++) {
    try {
      if (sent++) await sleep(250);
      const r = await fetch('https://play.rust-lang.org/' + endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
      if ((r.status === 429 || r.status >= 500) && attempt < 3) { await sleep(2000 * 2 ** attempt); continue; }
      const j = await r.json();
      if (j.exit_detail && !j.exitDetail) j.exitDetail = j.exit_detail;
      if (!j.error || /timed out|deadline/i.test(j.error)) { cache[k] = j; save(); }
      return j;
    } catch (e) {
      if (attempt < 3) { await sleep(2000 * 2 ** attempt); continue; }
      return { error: 'network: ' + (e.message || e) };
    }
  }
}
function save() { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); }

/* ───────────── run ───────────── */
if (!staticOnly) {
  const outFile = path.join(ROOT, 'outputs.js');
  const OUT = {};
  try { Object.assign(OUT, JSON.parse(/=\s*(\{[\s\S]*\});\s*$/.exec(fs.readFileSync(outFile, 'utf8'))[1])); } catch { /* none yet */ }
  const t0 = Date.now();
  let k = 0;
  for (const j of jobs) {
    k++;
    const resp = await play(j.kind, j.code);
    const o = H.outcome(resp);
    if (o.kind === 'error') { bad(`${j.where}: Playground error: ${o.text}`); continue; }
    const r = j.check(o, resp);
    if (r !== true) bad(`${j.where}: ${r}`);
    if (j.record) OUT[j.record] = H.record(o);
    process.stdout.write(`\r${k}/${jobs.length} ${r === true ? 'ok ' : 'BAD'} ${j.where.slice(0, 70).padEnd(70)}`);
  }
  process.stdout.write('\n');
  Object.assign(OUT, demoOut);
  // Every error code a cheat sheet names must be one the real compiler produced somewhere in the course.
  if (!filter) {
    const seen = new Set(Object.values(OUT).flatMap((v) => [...String(v.t || '').matchAll(/error\[(E\d{4})\]/g)].map((m) => m[1])));
    for (const c of RL.cheats) for (const [code] of new Set(String(c.body).matchAll(/E\d{4}/g))) if (!seen.has(code)) bad(`cheat ${c.id}: names ${code}, but no snippet in the course produces it`);
  }
  // keep only outputs that some snippet still uses (unless this was a filtered run)
  if (!filter) { const live = new Set([...jobs.map((j) => j.record).filter(Boolean), ...Object.keys(demoOut)]); for (const key of Object.keys(OUT)) if (!live.has(key)) delete OUT[key]; }
  const sorted = Object.fromEntries(Object.keys(OUT).sort().map((key) => [key, OUT[key]]));
  fs.writeFileSync(outFile, '/* Generated by tools/build.mjs: real compiler output for every checked snippet. Do not edit. */\nwindow.RUSTLAB_OUT = ' + JSON.stringify(sorted, null, 0).replace(/\},"/g, '},\n"') + ';\n');
  console.log(`${jobs.length} checks in ${((Date.now() - t0) / 1000).toFixed(0)} s (${sent} sent to the Playground, the rest cached)`);
}

console.log(`${lessons.length} lessons, ${exercises.length} exercises, ${lessons.reduce((a, l) => a + (l.predict || []).length, 0)} predicts, ${RL.drill.length} drill items, ${RL.cheats.length} cheat sheets`);
if (problems.length) { console.log(`\n${problems.length} problem${problems.length === 1 ? '' : 's'}:`); for (const p of problems) console.log('✗ ' + p.replace(/\n/g, '\n    ')); process.exit(1); }
console.log('✓ all good');
