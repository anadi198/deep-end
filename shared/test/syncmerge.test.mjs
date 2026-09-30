import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../syncmerge.js');

const SPEC = { solved: 'byAt:at', review: 'byAt:last', read: 'max', drafts: 'fill', drill: 'moreN', history: 'union:3' };

test('pick: only listed fields leave the device', () => {
  const s = { v: 1, solved: { a: { at: 1 } }, engine: 'local', bridgeToken: 'secret', open: { m: true } };
  assert.deepEqual(M.pick(s, SPEC), { v: 1, solved: { a: { at: 1 } } });
});

test('byAt: per id, the record with the newer field wins', () => {
  const local = { solved: { a: { at: 5, n: 1 }, b: { at: 1, n: 1 } } };
  const remote = { solved: { a: { at: 3, n: 9 }, b: { at: 4, n: 2 }, c: { at: 2, n: 1 } } };
  assert.deepEqual(M.merge(local, remote, SPEC).solved, { a: { at: 5, n: 1 }, b: { at: 4, n: 2 }, c: { at: 2, n: 1 } });
  assert.deepEqual(M.merge({ review: { x: { last: 1 } } }, { review: { x: { last: 7, ivl: 3 } } }, SPEC).review, { x: { last: 7, ivl: 3 } });
});

test('max: per id, the larger number wins', () => {
  assert.deepEqual(M.merge({ read: { a: 5, b: 1 } }, { read: { a: 3, b: 4, c: 2 } }, SPEC).read, { a: 5, b: 4, c: 2 });
});

test('fill: local wins, missing ids come from the other copy', () => {
  assert.deepEqual(M.merge({ drafts: { a: 'mine' } }, { drafts: { a: 'theirs', b: 'new' } }, SPEC).drafts, { a: 'mine', b: 'new' });
});

test('moreN: the copy with the larger n wins, maps merged underneath', () => {
  const r = M.merge({ drill: { n: 5, right: 4, by: { x: [1, 2] } } }, { drill: { n: 9, right: 6, by: { y: [3, 3] } } }, SPEC).drill;
  assert.equal(r.n, 9);
  assert.equal(r.right, 6);
  assert.deepEqual(r.by, { x: [1, 2], y: [3, 3] });
});

test('union: local order first, the other copy fills in, capped from the newest end', () => {
  assert.deepEqual(M.merge({ history: ['q1', 'q2'] }, { history: ['q0', 'q2', 'q3'] }, SPEC).history, ['q2', 'q0', 'q3']);
});

test('merge keeps unlisted local fields and never takes unlisted remote ones', () => {
  const r = M.merge({ engine: 'local', solved: {} }, { engine: 'browser', bridgeToken: 'x', solved: {} }, SPEC);
  assert.equal(r.engine, 'local');
  assert.equal('bridgeToken' in r, false);
});

test('changed: tells whether the synced part differs', () => {
  assert.equal(M.changed({ read: { a: 1 }, engine: 'x' }, { read: { a: 1 }, engine: 'y' }, SPEC), false);
  assert.equal(M.changed({ read: { a: 1 } }, { read: { a: 2 } }, SPEC), true);
});
