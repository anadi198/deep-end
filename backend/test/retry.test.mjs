import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/retry.js');
const run = (p) => BS.run('retry', p);

test('retry: three immediate retries keep the dependency overloaded after it recovers (a metastable failure)', () => {
  const r = run({ strategy: 'naive' });
  assert.equal(r.out.recoveredAfter, null, 'never recovers inside the run');
  assert.ok(r.out.peakAmplification >= 3, `amplification ${r.out.peakAmplification}`);
});

test('retry: no retries recovers, but only after the queue drains work nobody is waiting for', () => {
  const r = run({ strategy: 'none' });
  assert.ok(r.out.recoveredAfter !== null, 'recovers');
  assert.ok(r.out.recoveredAfter > run({ strategy: 'deadline' }).out.recoveredAfter + 3, `recovered after ${r.out.recoveredAfter}`);
});

test('retry: a retry budget caps the extra load and recovers, still slowed by dead work', () => {
  const r = run({ strategy: 'budget' });
  assert.ok(r.out.peakAmplification <= 1.2, `amplification ${r.out.peakAmplification}`);
  assert.ok(r.out.recoveredAfter !== null);
  assert.ok(r.out.recoveredAfter > run({ strategy: 'deadline' }).out.recoveredAfter);
});

test('retry: a circuit breaker recovers and beats naive retries on overall success', () => {
  const b = run({ strategy: 'breaker' }), n = run({ strategy: 'naive' });
  assert.ok(b.out.recoveredAfter !== null);
  assert.ok(b.out.success > n.out.success);
});

test('retry: dropping work whose caller already gave up lets the queue drain', () => {
  const r = run({ strategy: 'deadline' });
  assert.ok(r.out.recoveredAfter !== null);
  assert.ok(r.out.wasted < run({ strategy: 'naive' }).out.wasted);
});

test('retry: exponential backoff with jitter spreads retries but does not cap them', () => {
  const r = run({ strategy: 'backoff' });
  assert.ok(r.out.peakAmplification > 1.5);
});
