// Checks cross-references in the content: internal links (#/p, #/l, #/m, #/cheats), @viz / viz ids,
// @flow ids, @problems ids, pattern keys, lesson practice lists and roadmap ids.
// Usage: node tools/check-content.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
load('content/_core.js');
load('content/meta.js');
for (const f of fs.readdirSync(path.join(ROOT, 'content')).filter((f) => /^\d.*\.js$/.test(f)).sort()) load('content/' + f);
load('content/cheatsheets.js');
load('content/drill.js');
const D = ctx.DSA;

// Tracer ids, from the add('id', …) calls in tracers*.js
const vizIds = new Set();
for (const f of fs.readdirSync(ROOT).filter((f) => /^tracers.*\.js$/.test(f)))
  for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/\badd\('([\w-]+)'/g)) vizIds.add(m[1]);

const problems = new Map(), lessons = new Map(), modules = new Set();
for (const m of D.modules) {
  modules.add(m.id);
  for (const it of m.items) {
    if (it.problem) problems.set(it.problem.id, { p: it.problem, m });
    if (it.lesson) lessons.set(it.lesson, { l: it, m });
  }
}
const cheats = new Set((D.cheats || []).map((c) => c.id));
const pages = new Set(['cheats', 'finder', 'drill', 'review', 'mock', '']);
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

function checkText(where, text) {
  if (!text) return;
  text = String(text);
  for (const m of text.matchAll(/\]\(#\/([^)\s]*)\)/g)) {
    const [kind, id] = m[1].split('/');
    if (kind === 'p' && !problems.has(id)) err(where, `link to unknown problem ${id}`);
    else if (kind === 'l' && !lessons.has(id)) err(where, `link to unknown lesson ${id}`);
    else if (kind === 'm' && !modules.has(id)) err(where, `link to unknown module ${id}`);
    else if (kind === 'cheats' && id && !cheats.has(id)) err(where, `link to unknown cheat sheet ${id}`);
    else if (!['p', 'l', 'm', 'cheats'].includes(kind) && !pages.has(kind)) err(where, `link to unknown page ${m[1]}`);
  }
  for (const m of text.matchAll(/^\s*@viz\s+([\w-]+)/gm)) if (!vizIds.has(m[1])) err(where, `unknown @viz ${m[1]}`);
  for (const m of text.matchAll(/^\s*@flow\s+([\w-]+)/gm)) if (!(D.flows || {})[m[1]]) err(where, `unknown @flow ${m[1]}`);
  for (const m of text.matchAll(/^\s*@problems\s+(.+)$/gm))
    for (const id of m[1].split(/[\s,]+/).filter(Boolean)) if (!problems.has(id)) err(where, `@problems lists unknown ${id}`);
  // «…» spans must be closed on the same line
  for (const line of text.split('\n')) if ((line.match(/«/g) || []).length !== (line.match(/»/g) || []).length) err(where, `unbalanced «» in: ${line.trim().slice(0, 80)}`);
}

for (const m of D.modules) {
  checkText(`module ${m.id}`, m.intro);
  for (const it of m.items) {
    if (it.lesson) {
      const w = `lesson ${it.lesson}`;
      checkText(w, it.body);
      (it.quiz || []).forEach((q, i) => { checkText(`${w} quiz ${i}`, q.why); if (q.answer >= q.options.length) err(w, `quiz ${i} answer out of range`); });
      const used = [...String(it.body).matchAll(/^\s*@quiz\s+(\d+)/gm)].map((x) => +x[1]);
      for (const i of used) if (!(it.quiz || [])[i]) err(w, `@quiz ${i} has no question`);
      for (const id of it.practice || []) if (!problems.has(id)) err(w, `practice lists unknown problem ${id}`);
    }
    if (it.problem) {
      const p = it.problem, w = `problem ${p.id}`;
      checkText(w, p.statement);
      checkText(w, (p.hints || []).join('\n'));
      const s = p.solution || {};
      for (const k of ['intuition', 'why', 'pitfalls', 'followups', 'walk', 'pattern', 'talk']) checkText(`${w} solution.${k}`, s[k]);
      (s.alts || []).forEach((a) => checkText(`${w} alt ${a.name}`, a.note));
      if (p.viz && !vizIds.has(p.viz.id)) err(w, `unknown viz ${p.viz.id}`);
      if (p.drill && !D.patterns[p.drill.pattern]) err(w, `unknown drill pattern ${p.drill.pattern}`);
      if (!p.drill) err(w, 'no drill entry');
      if (!(p.lc || []).length) err(w, 'no LeetCode links');
    }
  }
}
for (const [k, p] of Object.entries(D.patterns)) if (!lessons.has(p.lesson)) err(`pattern ${k}`, `unknown lesson ${p.lesson}`);
for (const id of Object.keys((D.roadmap || {}).pos || {})) if (!modules.has(id)) err('roadmap', `unknown module ${id}`);
for (const [a, b] of (D.roadmap || {}).edges || []) if (!modules.has(a) || !modules.has(b)) err('roadmap', `edge ${a} → ${b} names an unknown module`);
for (const m of modules) if (!((D.roadmap || {}).pos || {})[m]) err('roadmap', `module ${m} has no position`);
for (const c of D.cheats || []) { checkText(`cheat ${c.id}`, c.body); (c.quiz || []).forEach((q, i) => checkText(`cheat ${c.id} quiz ${i}`, q.why)); }
for (const [id, f] of Object.entries(D.flows || {})) {
  for (const [nid, n] of Object.entries(f.nodes)) {
    checkText(`flow ${id} node ${nid}`, n.info);
    if (n.x < 0 || n.x > f.w || n.y < 0 || n.y > f.h) err(`flow ${id}`, `node ${nid} is outside the canvas`);
  }
  for (const [a, b] of f.edges) if (!f.nodes[a] || !f.nodes[b]) err(`flow ${id}`, `edge ${a} → ${b} names an unknown node`);
  const starts = Object.values(f.nodes).filter((n) => n.t === 'start').length;
  if (starts !== 1) err(`flow ${id}`, `${starts} start nodes`);
}
checkText('finderNotes', D.finderNotes);
for (const d of D.drill || []) if (!D.patterns[d.pattern]) err('drill', `unknown pattern ${d.pattern} (${d.lc})`);

// Every pattern should have something to drill
const counts = {};
for (const { p } of problems.values()) if (p.drill) counts[p.drill.pattern] = (counts[p.drill.pattern] || 0) + 1;
for (const d of D.drill || []) counts[d.pattern] = (counts[d.pattern] || 0) + 1;
const thin = Object.keys(D.patterns).filter((k) => (counts[k] || 0) < 3);

console.log(`${D.modules.length} modules, ${lessons.size} lessons, ${problems.size} problems, ${cheats.size} cheat sheets, ${Object.keys(D.flows || {}).length} flowcharts, ${(D.drill || []).length} extra drill prompts, ${vizIds.size} visualizations.`);
if (thin.length) console.log('Patterns with fewer than 3 drill prompts:', thin.map((k) => `${k} (${counts[k] || 0})`).join(', '));
if (errors.length) { console.error(errors.map((e) => '✗ ' + e).join('\n')); console.error(`${errors.length} problem(s).`); process.exit(1); }
console.log('All references OK.');
