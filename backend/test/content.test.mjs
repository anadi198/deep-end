import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const lab = join(here, '..');
const html = readFileSync(join(lab, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);

// load sims and content exactly as the page lists them
const BS = require(join(lab, 'sims/core.js'));
for (const s of scripts.filter((x) => x.startsWith('sims/') && x !== 'sims/core.js')) require(join(lab, s));
const BL = require(join(lab, 'content/_core.js'));
for (const s of scripts.filter((x) => x.startsWith('content/') && x !== 'content/_core.js')) require(join(lab, s));

const lessons = BL.modules.flatMap((m) => m.items.map((l) => ({ ...l, module: m })));
const pgSource = ['course.js', 'course2.js'].map((f) => readFileSync(join(lab, '../pg', f), 'utf8')).join('\n');
const directives = (body, name) => [...String(body).matchAll(new RegExp(`^\\s*@${name}\\s+(.*)$`, 'gm'))].map((m) => m[1].trim());

test('content: every sims/ and content/ file is loaded by the page', () => {
  for (const dir of ['sims', 'content']) {
    for (const f of readdirSync(join(lab, dir)).filter((x) => x.endsWith('.js'))) assert.ok(scripts.includes(`${dir}/${f}`), `${dir}/${f} is not in index.html`);
  }
});

test('content: lesson ids are unique and every lesson has its parts', () => {
  const seen = new Set();
  for (const l of lessons) {
    assert.ok(l.lesson && !seen.has(l.lesson), `duplicate or missing id ${l.lesson}`);
    seen.add(l.lesson);
    for (const k of ['title', 'mins', 'remember', 'cue', 'body']) assert.ok(l[k], `${l.lesson} has no ${k}`);
    assert.match(l.cue, /→/, `${l.lesson}: a cue reads "when you see X → reach for Y"`);
  }
});

test('content: quizzes are well formed and every @quiz points at one', () => {
  for (const l of lessons) {
    for (const q of l.quiz || []) {
      assert.ok(q.q && q.why && q.options.length >= 2, `${l.lesson}: a quiz is incomplete`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${l.lesson}: answer out of range in "${q.q}"`);
    }
    for (const n of directives(l.body, 'quiz')) assert.ok((l.quiz || [])[+n], `${l.lesson}: @quiz ${n} has no quiz`);
  }
});

test('content: every lesson outside the start module has a Defend-it round with real follow-ups', () => {
  for (const l of lessons.filter((x) => x.module.id !== 'start')) {
    assert.ok((l.defend || []).length, `${l.lesson} has no defend round`);
    for (const d of l.defend) {
      for (const k of ['q', 'weak', 'whyWeak']) assert.ok(d[k], `${l.lesson}: defend round has no ${k}`);
      assert.ok(d.follow.length >= 3 && d.follow.every((f) => f.q && f.a), `${l.lesson}: needs 3+ follow-ups with answers`);
      assert.ok(d.strong.length >= 3, `${l.lesson}: needs 3+ strong-answer points`);
    }
    for (const n of directives(l.body, 'defend')) assert.ok(l.defend[+n], `${l.lesson}: @defend ${n} has no round`);
  }
});

test('content: every @sim names a simulator and only its real parameters and values', () => {
  const used = new Set();
  for (const l of lessons) {
    for (const d of directives(l.body, 'sim')) {
      const [name, ...pre] = d.split(/\s+/);
      const spec = BS.all[name];
      assert.ok(spec, `${l.lesson}: unknown simulator ${name}`);
      used.add(name);
      for (const kv of pre) {
        const [k, v] = kv.split('=');
        const q = spec.params.find((x) => x.id === k);
        assert.ok(q, `${l.lesson}: ${name} has no parameter ${k}`);
        if (q.type === 'select') assert.ok(q.options.some(([o]) => o === v), `${l.lesson}: ${name}.${k} has no option ${v}`);
      }
      assert.doesNotThrow(() => BS.run(name, {}), `${name} runs with its defaults`);
    }
  }
  for (const name of Object.keys(BS.all)) assert.ok(used.has(name), `simulator ${name} is not used by any lesson`);
});

test('content: @lab links point at lessons that exist', () => {
  for (const l of lessons) {
    for (const d of directives(l.body, 'lab')) {
      const m = /^(\w+):([\w-]+)\s+\S/.exec(d);
      assert.ok(m && BL.labs[m[1]], `${l.lesson}: bad @lab ${d}`);
      if (m[1] === 'pg') assert.ok(pgSource.includes(`id: '${m[2]}'`), `${l.lesson}: no Postgres Lab lesson ${m[2]}`);
    }
  }
});

test('content: drill items and cheat sheets are well formed', () => {
  for (const d of BL.drill) {
    assert.ok(d.q && d.why && d.topic && d.options.length >= 2, `drill item incomplete: ${d.q}`);
    assert.ok(d.answer >= 0 && d.answer < d.options.length, `drill answer out of range: ${d.q}`);
  }
  for (const c of BL.cheats) assert.ok(c.id && c.title && c.body, `cheat sheet incomplete: ${c.id}`);
});

test('content: no em dashes anywhere in the lab text', () => {
  for (const s of scripts.filter((x) => x.startsWith('content/') || x.startsWith('sims/'))) {
    assert.ok(!readFileSync(join(lab, s), 'utf8').includes('—'), `${s} has an em dash`);
  }
});
