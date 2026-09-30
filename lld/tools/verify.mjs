// Checks the course content with your JDK:
//   * structure: unique ids, required fields, known pattern ids, lessons that patterns point to
//   * every reference solution passes all of its tests
//   * every "wrong" solution fails at least one test (so the tests really catch that mistake)
//   * every starter compiles against the tests (so a fresh exercise shows test failures, not compile errors)
//
//   node tools/verify.mjs              everything
//   node tools/verify.mjs strategy     only exercises whose id contains "strategy"
//   node tools/verify.mjs --static     structure checks only (no JDK needed)
//
// Needs javac/java on PATH (JDK 17+). Exits non-zero on any problem.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = require(path.join(ROOT, 'harness.js'));
const args = process.argv.slice(2);
const staticOnly = args.includes('--static');
const filter = args.find((a) => !a.startsWith('--')) || '';

export function loadContent() {
  require(path.join(ROOT, 'content', '_core.js'));
  require(path.join(ROOT, 'content', 'meta.js'));
  const files = fs.readdirSync(path.join(ROOT, 'content')).filter((f) => /^\d.*\.js$/.test(f)).sort();
  for (const f of files) require(path.join(ROOT, 'content', f));
  for (const f of ['drill.js', 'cheatsheets.js']) if (fs.existsSync(path.join(ROOT, 'content', f))) require(path.join(ROOT, 'content', f));
  return { L: globalThis.LLD, files };
}

const problems = [];
const bad = (msg) => problems.push(msg);

/* ───────────── structure ───────────── */
const { L, files } = loadContent();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const f of files) if (!html.includes(`content/${f}`)) bad(`index.html does not load content/${f}`);
const ids = new Set();
const lessons = {}, exercises = [];
for (const m of L.modules) {
  if (!m.id || !m.title) bad(`module without id/title: ${JSON.stringify(m).slice(0, 80)}`);
  for (const it of m.items) {
    const id = it.lesson || (it.exercise && it.exercise.id);
    if (!id) { bad(`${m.id}: item without an id`); continue; }
    if (ids.has(id)) bad(`duplicate id ${id}`);
    ids.add(id);
    if (it.lesson) {
      lessons[id] = it;
      if (!it.title || !it.body) bad(`lesson ${id}: needs title and body`);
      if (!it.remember) bad(`lesson ${id}: needs a remember line`);
      if (it.cue && !it.cue.includes('→')) bad(`lesson ${id}: cue should read "when you see X → Y"`);
      if ((it.mins || 0) > 10) bad(`lesson ${id}: ${it.mins} min is too long; split it`);
      for (const [, n] of String(it.body).matchAll(/@quiz (\d+)/g)) if (!(it.quiz || [])[+n]) bad(`lesson ${id}: @quiz ${n} has no question`);
      if (/—/.test(it.body + it.remember + (it.cue || ''))) bad(`lesson ${id}: contains an em dash`);
    } else {
      const x = it.exercise;
      exercises.push({ ...x, module: m.id });
      if (!x.title || !x.statement) bad(`exercise ${id}: needs title and statement`);
      if (!['build', 'refactor', 'design'].includes(x.kind || 'build')) bad(`exercise ${id}: unknown kind ${x.kind}`);
      if ((x.kind || 'build') !== 'design' && !(x.tests || []).length) bad(`exercise ${id}: a ${x.kind || 'build'} exercise needs tests`);
      if ((x.kind || 'build') !== 'design' && !(x.tests || []).some((t) => t.ex)) bad(`exercise ${id}: no visible (ex) test`);
      if (!x.solution || !x.solution.java) bad(`exercise ${id}: needs solution.java`);
      if (x.starter === undefined) bad(`exercise ${id}: needs a starter`);
      for (const p of x.patterns || []) if (!L.patterns[p]) bad(`exercise ${id}: unknown pattern ${p}`);
      const names = new Set();
      for (const t of x.tests || []) { if (!t.name || !t.code) bad(`exercise ${id}: test without name/code`); if (names.has(t.name)) bad(`exercise ${id}: duplicate test name "${t.name}"`); names.add(t.name); }
      for (const l of x.lint || []) { try { new RegExp(l.re, l.flags || 'm'); } catch (e) { bad(`exercise ${id}: bad lint regex ${l.re}: ${e.message}`); } }
      if (/—/.test(x.statement + (x.rubric || ''))) bad(`exercise ${id}: contains an em dash`);
    }
  }
}
for (const [k, p] of Object.entries(L.patterns)) {
  if (!L.families[p.family]) bad(`pattern ${k}: unknown family ${p.family}`);
  if (p.lesson && !lessons[p.lesson]) console.log(`  note: pattern ${k} points to lesson "${p.lesson}", not written yet`);
  for (const c of p.confuse || []) if (!L.patterns[c]) bad(`pattern ${k}: confuse lists unknown ${c}`);
}
for (const d of L.drill) if (!L.patterns[d.pattern]) bad(`drill prompt points to unknown pattern ${d.pattern}`);
console.log(`Structure: ${L.modules.length} modules, ${Object.keys(lessons).length} lessons, ${exercises.length} exercises, ${L.drill.length} drill prompts.`);

/* ───────────── JDK ───────────── */
if (!staticOnly) {
  const list = exercises.filter((x) => x.id.includes(filter) && x.solution && x.solution.java);
  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'lldverify-'));
  const jobs = [];
  const add = (x, kind, code, name) => {
    const pkg = 'p' + jobs.length;
    const { files: fl } = H.buildFiles(x, code, x.tests || [], { engine: 'jdk' });
    const dir = path.join(OUT, kind === 'starter' ? 'starters' : 'src', pkg);
    fs.mkdirSync(dir, { recursive: true });
    for (const [n, src] of Object.entries(fl)) fs.writeFileSync(path.join(dir, n), `package ${pkg}; ` + src);
    jobs.push({ pkg, x, kind, name, dir });
  };
  for (const x of list) {
    add(x, 'ref', x.solution.java, 'reference');
    (x.wrong || []).forEach((w, k) => add(x, 'wrong', w.java || w, w.name || `wrong ${k + 1}`));
    if (x.starter !== undefined) add(x, 'starter', x.starter, 'starter');
  }
  const javaFiles = (sub) => { const out = []; const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.java')) out.push(p); } }; walk(path.join(OUT, sub)); return out; };
  const pkgOf = (file) => /[\\/](p\d+)[\\/]/.exec(file)?.[1];

  // 1. references and wrong answers must compile
  const argFile = path.join(OUT, 'src.txt');
  fs.writeFileSync(argFile, javaFiles('src').map((f) => `"${f.replace(/\\/g, '/')}"`).join('\n'));
  let c = spawnSync('javac', ['-encoding', 'UTF-8', '-nowarn', '-Xmaxerrs', '500', '-d', path.join(OUT, 'classes'), '@' + argFile], { encoding: 'utf8' });
  if (c.status !== 0) {
    const byPkg = {};
    for (const line of (c.stderr + c.stdout).split(/\r?\n/)) { const p = pkgOf(line); if (p && /error:/.test(line)) (byPkg[p] = byPkg[p] || []).push(line.replace(/^.*[\\/](p\d+[\\/])/, '$1')); }
    for (const [p, errs] of Object.entries(byPkg)) { const j = jobs.find((z) => z.pkg === p); bad(`${j.x.id} (${j.name}) does not compile:\n      ${errs.slice(0, 4).join('\n      ')}`); }
    if (!Object.keys(byPkg).length) bad('javac failed:\n' + (c.stderr + c.stdout).slice(0, 2000));
  } else {
    // 2. run each Main in one JVM
    const batch = `import java.io.*;
public class Batch {
  public static void main(String[] a) throws Exception {
    PrintStream orig = System.out;
    for (String pkg : a) {
      ByteArrayOutputStream bo = new ByteArrayOutputStream();
      System.setOut(new PrintStream(bo, true, "UTF-8"));
      try { Class.forName(pkg + ".Main").getMethod("main", String[].class).invoke(null, (Object) new String[] { "0" }); }
      catch (Throwable t) { System.out.println("@@@CRASH " + t); }
      System.setOut(orig);
      orig.println("@@@JOB " + pkg);
      orig.print(bo.toString("UTF-8"));
      orig.println("@@@ENDJOB");
    }
  }
}`;
    fs.writeFileSync(path.join(OUT, 'Batch.java'), batch);
    c = spawnSync('javac', ['-d', path.join(OUT, 'classes'), path.join(OUT, 'Batch.java')], { encoding: 'utf8' });
    const runJobs = jobs.filter((j) => j.kind !== 'starter');
    const r = spawnSync('java', ['-Xss64m', '-cp', path.join(OUT, 'classes'), 'Batch', ...runJobs.map((j) => j.pkg)], { encoding: 'utf8', timeout: 300000, maxBuffer: 256 * 1024 * 1024 });
    if (r.error) bad('the test JVM failed: ' + r.error.message);
    const out = r.stdout || '';
    for (const j of runJobs) {
      const m = new RegExp(`@@@JOB ${j.pkg}\\r?\\n([\\s\\S]*?)@@@ENDJOB`).exec(out);
      const n = (j.x.tests || []).length;
      if (!m) { bad(`${j.x.id} (${j.name}): no output (did the JVM hang or crash?)`); continue; }
      const parsed = H.parseRun(m[1], n);
      const fails = parsed.results.map((res, i) => ({ res, t: j.x.tests[i] })).filter((z) => !z.res || z.res.status !== 'pass');
      if (j.kind === 'ref') {
        if (!parsed.done) bad(`${j.x.id} (reference): did not finish`);
        for (const f of fails) bad(`${j.x.id} (reference) fails "${f.t.name}": ${f.res ? f.res.status + ' ' + (f.res.msg || '') : 'no result'}`);
      } else if (!fails.length) bad(`${j.x.id}: the wrong answer "${j.name}" passes every test; add a test that catches it`);
      else console.log(`  ${j.x.id}: "${j.name}" caught by: ${fails.map((f) => f.t.name).slice(0, 3).join('; ')}`);
    }
  }

  // 3. starters compile, one javac per starter (a broken starter must not hide the others)
  for (const j of jobs.filter((z) => z.kind === 'starter')) {
    const fl = fs.readdirSync(j.dir).map((f) => path.join(j.dir, f));
    const s = spawnSync('javac', ['-encoding', 'UTF-8', '-nowarn', '-d', path.join(OUT, 'starter-classes', j.pkg), ...fl], { encoding: 'utf8' });
    if (s.status !== 0) bad(`${j.x.id}: the starter does not compile against the tests:\n      ${(s.stderr + s.stdout).split(/\r?\n/).filter((l) => /error:/.test(l)).slice(0, 4).map((l) => l.replace(/^.*[\\/]/, '')).join('\n      ')}`);
  }
  console.log(`JDK: ${list.length} exercises, ${jobs.filter((j) => j.kind === 'ref').length} references, ${jobs.filter((j) => j.kind === 'wrong').length} wrong answers, ${jobs.filter((j) => j.kind === 'starter').length} starters.`);
  fs.rmSync(OUT, { recursive: true, force: true });
}

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exit(1);
}
console.log('\nAll good.');
