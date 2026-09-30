// Builds expected.js: runs every problem's reference solution on every test with your local JDK,
// and checks the answers it can (hand-written `expect` values, alternative solutions, known-wrong
// solutions that must fail).
//
//   node tools/build.mjs            all problems
//   node tools/build.mjs two-sum    only problems whose id contains "two-sum" (expected.js is merged)
//   node tools/build.mjs m:hashing  only the problems in one module
//
// Needs javac/java on PATH (JDK 17+).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = require(path.join(ROOT, 'harness.js'));
const DSA = loadContent();
const filter = process.argv[2] || '';
const OUT = path.join(ROOT, '.build');

export function loadContent() {
  require(path.join(ROOT, 'content', '_core.js'));
  const files = fs.readdirSync(path.join(ROOT, 'content')).filter((f) => /^\d.*\.js$/.test(f)).sort();
  for (const f of files) require(path.join(ROOT, 'content', f));
  return globalThis.DSA;
}
export function allProblems(dsa = DSA) {
  const out = [];
  for (const m of dsa.modules) for (const it of m.items) if (it.problem) out.push({ ...it.problem, module: m.id });
  return out;
}


function main() {
  const problems = allProblems().filter((p) => (filter.startsWith('m:') ? p.module === filter.slice(2) : p.id.includes(filter)));
  const ids = new Set();
  for (const p of allProblems()) { if (ids.has(p.id)) fail(`duplicate problem id ${p.id}`); ids.add(p.id); }
  console.log(`Building ${problems.length} problem(s)…`);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'src'), { recursive: true });

  // Every solution variant becomes its own Java package: p<N>.
  const jobs = [];
  problems.forEach((p) => {
    validateShape(p);
    const add = (kind, code, tests, extra = {}) => {
      const pkg = 'p' + jobs.length;
      const { files } = H.buildFiles(p, code, tests);
      const dir = path.join(OUT, 'src', pkg);
      fs.mkdirSync(dir);
      for (const [name, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), `package ${pkg}; ` + src);
      jobs.push({ pkg, p, kind, tests, ...extra });
    };
    add('ref', p.solution.java, p.tests);
    (p.solution.alts || []).forEach((a, k) => { if (a.java && a.check !== false) add('alt', a.java, p.tests.filter((t) => !t.big && !(a.skipBig && t.slow)), { name: a.name || `alt ${k + 1}` }); });
    (p.wrong || []).forEach((w, k) => add('wrong', w.java || w, p.tests, { name: w.name || `wrong ${k + 1}` }));
  });

  // Compile everything in one javac run; drop packages that fail and retry.
  let bad = new Set();
  for (let round = 0; round < 5; round++) {
    const srcs = jobs.filter((j) => !bad.has(j.pkg)).flatMap((j) => fs.readdirSync(path.join(OUT, 'src', j.pkg)).map((f) => path.join(OUT, 'src', j.pkg, f)));
    fs.writeFileSync(path.join(OUT, 'sources.txt'), srcs.map((s) => '"' + s.replace(/\\/g, '/') + '"').join('\n'));
    const r = spawnSync('javac', ['-encoding', 'UTF-8', '-nowarn', '-Xmaxerrs', '1000', '-d', path.join(OUT, 'classes'), '@' + path.join(OUT, 'sources.txt')], { encoding: 'utf8' });
    if (r.status === 0) break;
    const newBad = new Set();
    for (const m of (r.stderr || '').matchAll(/[\\/]src[\\/](p\d+)[\\/]([\w$]+\.java):(\d+): error: (.*)/g)) {
      newBad.add(m[1]);
      const j = jobs.find((x) => x.pkg === m[1]);
      console.error(`✗ ${j.p.id} [${j.kind}${j.name ? ' ' + j.name : ''}] ${m[2]}:${m[3]}: ${m[4]}`);
    }
    if (!newBad.size) { console.error(r.stderr); fail('javac failed'); }
    for (const b of newBad) bad.add(b);
  }

  // Run all packages in one JVM (each Main gets its own captured stdout).
  fs.writeFileSync(path.join(OUT, 'Driver.java'), DRIVER);
  execFileSync('javac', ['-d', path.join(OUT, 'classes'), path.join(OUT, 'Driver.java')]);
  const run = jobs.filter((j) => !bad.has(j.pkg));
  const t0 = Date.now();
  const r = spawnSync('java', ['-Xss512m', '-cp', path.join(OUT, 'classes'), 'Driver', ...run.map((j) => j.pkg)], { encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) { console.error(r.stderr); fail('driver failed'); }
  const outputs = {};
  for (const block of r.stdout.split('\n@@@PKG ').slice(1)) {
    const nl = block.indexOf('\n');
    outputs[block.slice(0, nl).trim()] = block.slice(nl + 1);
  }
  console.log(`Ran ${run.length} solution variants in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  // Check and collect.
  const expected = loadExpected();
  let problemsOk = 0, errors = bad.size;
  const refOut = {};
  for (const j of run) {
    const parsed = H.parseRun(outputs[j.pkg] || '', j.tests.length);
    const p = j.p;
    const mode = p.compare || 'exact';
    const cmp = (exp, got, t) => H.compare(exp, got, mode, { validate: p.validate, args: t.args });
    if (j.kind === 'ref') {
      const exp = [], times = [];
      let ok = true;
      j.tests.forEach((t, i) => {
        const res = parsed.results[i];
        if (!res || res.status !== 'ran') { ok = false; console.error(`✗ ${p.id} test ${i}: reference ${res ? res.status + ' ' + (res.error || '') : 'did not run'}`); exp.push(null); return; }
        if (t.expect !== undefined && !cmp(JSON.stringify(t.expect), res.out, t).ok) { ok = false; console.error(`✗ ${p.id} test ${i}: reference returned ${H.showOutput(res.out, 200)} but the test expects ${JSON.stringify(t.expect)}`); }
        if (p.validate && !cmp(res.out, res.out, t).ok) { ok = false; console.error(`✗ ${p.id} test ${i}: reference output fails the validator: ${cmp(res.out, res.out, t).why}`); }
        if (res.ns > 1.5e9) console.warn(`! ${p.id} test ${i}: reference took ${(res.ns / 1e6).toFixed(0)} ms`);
        exp.push(res.out); times.push(Math.round(res.ns / 1e3));
      });
      refOut[p.id] = exp;
      if (ok) { expected[p.id] = exp; problemsOk++; } else errors++;
    }
  }
  for (const j of run) {
    if (j.kind === 'ref') continue;
    const p = j.p, mode = p.compare || 'exact';
    const exp = refOut[p.id]; if (!exp) continue;
    const parsed = H.parseRun(outputs[j.pkg] || '', j.tests.length);
    const idx = j.tests.map((t) => p.tests.indexOf(t));
    const fails = [];
    j.tests.forEach((t, i) => {
      const res = parsed.results[i];
      const ok = res && res.status === 'ran' && H.compare(exp[idx[i]], res.out, mode, { validate: p.validate, args: t.args }).ok;
      if (!ok) fails.push({ i: idx[i], got: res ? (res.status === 'ran' ? res.out : res.status + ' ' + (res.error || '')) : 'no result' });
    });
    if (j.kind === 'alt' && fails.length) { errors++; for (const f of fails.slice(0, 3)) console.error(`✗ ${p.id} [${j.name}] test ${f.i}: got ${H.showOutput(f.got, 160)} expected ${H.showOutput(exp[f.i], 160)}`); }
    if (j.kind === 'wrong' && !fails.length) { errors++; console.error(`✗ ${p.id} [wrong: ${j.name}] passed every test — the tests need a case that catches it`); }
  }
  writeExpected(expected);
  console.log(`${problemsOk}/${problems.length} problems OK${errors ? `, ${errors} error(s)` : ''}. Wrote expected.js (${Object.keys(expected).length} problems).`);
  if (errors) process.exitCode = 1;
}

function validateShape(p) {
  const need = ['id', 'title', 'diff', 'statement', 'tests', 'solution'];
  for (const k of need) if (!p[k]) fail(`${p.id || '?'}: missing ${k}`);
  if (!p.fn && !p.design) fail(`${p.id}: needs fn or design`);
  if (!p.solution.java) fail(`${p.id}: missing solution.java`);
  if (!['easy', 'medium', 'hard'].includes(p.diff)) fail(`${p.id}: diff must be easy/medium/hard`);
  if (!p.tests.some((t) => t.ex)) fail(`${p.id}: mark at least one test as an example (ex: true)`);
  for (const t of p.tests) {
    if (p.design && (!t.ops || !t.args)) fail(`${p.id}: design tests need ops + args`);
    if (p.fn && (!Array.isArray(t.args) || t.args.length !== p.fn.params.length)) fail(`${p.id}: test args must match ${p.fn.params.length} params: ${JSON.stringify(t.args).slice(0, 80)}`);
  }
}
function loadExpected() {
  const f = path.join(ROOT, 'expected.js');
  if (!filter || !fs.existsSync(f)) return {};
  const txt = fs.readFileSync(f, 'utf8');
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
}
function writeExpected(exp) {
  const sorted = Object.fromEntries(Object.keys(exp).sort().map((k) => [k, exp[k]]));
  fs.writeFileSync(path.join(ROOT, 'expected.js'), '/* Generated by tools/build.mjs — reference outputs for every test. Do not edit. */\nglobalThis.DSA_EXPECTED = ' + JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"') + ';\n');
}
function fail(msg) { console.error('✗ ' + msg); process.exit(1); }

const DRIVER = `import java.io.*;
import java.lang.reflect.*;
public class Driver {
  public static void main(String[] args) throws Exception {
    PrintStream real = System.out;
    for (String pkg : args) {
      ByteArrayOutputStream buf = new ByteArrayOutputStream();
      PrintStream ps = new PrintStream(buf, true, "UTF-8");
      System.setOut(ps);
      final Throwable[] err = new Throwable[1];
      Thread t = new Thread(null, () -> {
        try { Class.forName(pkg + ".Main").getMethod("main", String[].class).invoke(null, (Object) new String[0]); }
        catch (Throwable e) { err[0] = e; }
      }, pkg, 1L << 29);
      t.start();
      t.join(60000);
      System.setOut(real);
      real.print("\\n@@@PKG " + pkg + "\\n");
      real.print(buf.toString("UTF-8"));
      if (t.isAlive()) { real.println("@@@TIMEOUT"); real.flush(); System.exit(0); }
      if (err[0] != null) real.println("@@@CRASH " + err[0]);
    }
    real.flush();
  }
}
`;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
