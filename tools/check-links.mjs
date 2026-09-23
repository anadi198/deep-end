// Verifies every LeetCode link in the content against LeetCode's public GraphQL API:
// the slug exists, and the number, title and premium flag match what the content says.
// Results are cached in .build/lc-cache.json, so reruns only query new slugs.
// Usage: node tools/check-links.mjs [--refresh]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.build', 'lc-cache.json');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
load('content/_core.js');
load('content/meta.js');
for (const f of fs.readdirSync(path.join(ROOT, 'content')).filter((f) => /^\d.*\.js$/.test(f)).sort()) load('content/' + f);
load('content/drill.js');
const D = ctx.DSA;

// Gather every reference: { slug, n?, title?, premium?, where }
const refs = [];
for (const m of D.modules) {
  for (const l of m.more || []) refs.push({ ...l, where: `module ${m.id} (more)` });
  for (const it of m.items) if (it.problem) for (const l of it.problem.lc || []) refs.push({ ...l, where: `problem ${it.problem.id}` });
}
for (const d of D.drill || []) refs.push({ slug: d.lc, where: 'drill' });
const slugs = [...new Set(refs.map((r) => r.slug))].sort();

fs.mkdirSync(path.dirname(CACHE), { recursive: true });
let cache = {};
if (fs.existsSync(CACHE) && !process.argv.includes('--refresh')) cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

async function fetchOne(slug) {
  const body = JSON.stringify({ query: 'query q($s: String!) { question(titleSlug: $s) { questionFrontendId title isPaidOnly } }', variables: { s: slug } });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST', body,
        headers: { 'content-type': 'application/json', referer: `https://leetcode.com/problems/${slug}/`, 'user-agent': 'Mozilla/5.0 (dsa-lab link checker)' },
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      const j = await res.json();
      const q = j && j.data && j.data.question;
      return q ? { n: +q.questionFrontendId, title: q.title, premium: !!q.isPaidOnly } : { missing: true };
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return { error: true };
}

const todo = slugs.filter((s) => !cache[s] || cache[s].error);
console.log(`${refs.length} links, ${slugs.length} distinct slugs, ${todo.length} to query.`);
let done = 0;
const workers = Array.from({ length: 4 }, async () => {
  while (todo.length) {
    const s = todo.shift();
    cache[s] = await fetchOne(s);
    if (++done % 25 === 0) { console.log(`  ${done} queried…`); fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); }
    await new Promise((r) => setTimeout(r, 150));
  }
});
await Promise.all(workers);
fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));

const norm = (t) => String(t).toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
const problems = [];
for (const r of refs) {
  const c = cache[r.slug];
  if (!c || c.error) { problems.push(`? ${r.where}: couldn't check ${r.slug}`); continue; }
  if (c.missing) { problems.push(`✗ ${r.where}: no LeetCode problem with slug "${r.slug}"`); continue; }
  if (r.n != null && r.n !== c.n) problems.push(`✗ ${r.where}: ${r.slug} is #${c.n}, content says #${r.n}`);
  // Titles may carry a short parenthetical note in the content, e.g. "Subsets (bitmask enumeration)".
  if (r.title && norm(r.title) !== norm(c.title) && !norm(r.title).startsWith(norm(c.title) + ' (')) problems.push(`✗ ${r.where}: ${r.slug} is titled "${c.title}", content says "${r.title}"`);
  if (r.premium != null && !!r.premium !== c.premium) problems.push(`✗ ${r.where}: ${r.slug} premium is ${c.premium}, content says ${!!r.premium}`);
}
const uniq = [...new Set(problems)];
if (uniq.length) { console.log(uniq.join('\n')); console.log(`${uniq.length} issue(s).`); process.exit(1); }
console.log('All LeetCode links match.');
