import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/drift.js');
const run = (p) => BS.run('drift', p).out;

test('drift: dual writes with a naive consumer leave orders wrong downstream and send duplicate emails', () => {
  const o = run({ write: 'dual', consumer: 'naive', recon: false });
  assert.ok(o.endMismatch > 0, `mismatch ${o.endMismatch}`);
  assert.ok(o.dupEffects > 0);
  assert.ok(o.lost > 0, 'a crash between commit and publish loses the event');
});

test('drift: the outbox plus an idempotent, version-checking consumer stays in agreement', () => {
  const o = run({ write: 'outbox', consumer: 'idempotent', recon: false });
  assert.equal(o.endMismatch, 0);
  assert.equal(o.dupEffects, 0);
  assert.equal(o.lost, 0);
});

test('drift: a late, older event still triggers its own side effect once; only its status update is skipped', () => {
  assert.equal(run({ write: 'outbox', consumer: 'idempotent', recon: false }).missedEffects, 0);
});

test('drift: an idempotent consumer cannot repair events that were never published', () => {
  const o = run({ write: 'dual', consumer: 'idempotent', recon: false });
  assert.ok(o.endMismatch > 0);
  assert.equal(o.dupEffects, 0);
});

test('drift: the outbox alone still lets duplicates and reordering through to a naive consumer', () => {
  const o = run({ write: 'outbox', consumer: 'naive', recon: false });
  assert.ok(o.dupEffects > 0);
  assert.ok(o.endMismatch > 0);
});

test('drift: reconciliation repairs what slipped through', () => {
  const without = run({ write: 'dual', consumer: 'naive', recon: false });
  const withRecon = run({ write: 'dual', consumer: 'naive', recon: true });
  assert.ok(withRecon.repaired > 0);
  assert.ok(withRecon.endMismatch < without.endMismatch);
});
