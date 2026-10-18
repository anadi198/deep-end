import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const G = require('../gaps.js');

const SRC = `
# producer
acks=1 ⟦acks⟧
linger.ms=20 ⟦ok⟧
enable.idempotence=false ⟦idem,acks⟧
`;

test('gaps: parse strips markers, numbers lines from 1 and records which lines carry each id', () => {
  const p = G.parse(SRC);
  assert.deepEqual(p.lines.map((l) => l.text), ['# producer', 'acks=1', 'linger.ms=20', 'enable.idempotence=false']);
  assert.deepEqual(p.marks, { acks: [2, 4], ok: [3], idem: [4] });
  assert.deepEqual(p.lines[3].marks, ['idem', 'acks']);
});

const X = {
  issues: [{ id: 'acks', kind: 'loss' }, { id: 'idem', kind: 'dupe' }],
  decoys: [{ id: 'ok', why: 'fine' }],
};

test('gaps: grade finds an issue when any of its lines is flagged, and checks the kind', () => {
  const g = G.grade(X, G.parse(SRC), { 2: 'loss' });
  assert.equal(g.found, 1);
  assert.equal(g.total, 2);
  assert.equal(g.issues[0].found, true);
  assert.equal(g.issues[0].kindOk, true);
  assert.equal(g.issues[1].found, false);
  assert.equal(g.done, false);
});

test('gaps: a wrong kind still counts as found, but not as kindOk', () => {
  const g = G.grade(X, G.parse(SRC), { 2: 'slow', 4: 'dupe' });
  assert.equal(g.found, 2);
  assert.equal(g.issues[0].kindOk, false);
  assert.equal(g.issues[1].kindOk, true);
  assert.equal(g.done, true);
});

test('gaps: flagging a line with no issue is a false alarm, and names the decoy it fell for', () => {
  const g = G.grade(X, G.parse(SRC), { 1: 'ops', 3: 'slow' });
  assert.deepEqual(g.falseAlarms, [{ n: 1, decoy: null }, { n: 3, decoy: 'ok' }]);
});

test('gaps: the kinds are a fixed, labelled set', () => {
  for (const k of ['loss', 'dupe', 'order', 'slow', 'stall', 'ops']) assert.ok(G.KINDS[k] && G.KINDS[k].label, k);
});

test('gaps: parse removes the common indentation of a template literal, keeping relative indents', () => {
  const p = G.parse('\n      for (x : xs) { ⟦a⟧\n          go(x);\n      }\n    ');
  assert.deepEqual(p.lines.map((l) => l.text), ['for (x : xs) {', '    go(x);', '}']);
});
