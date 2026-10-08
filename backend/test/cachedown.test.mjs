import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/cachedown.js');
const run = (strategy, extra) => BS.run('cachedown', { strategy, ...extra }).out;

test('cachedown: falling back to the database for everything overwhelms it; almost nothing succeeds', () => {
  const o = run('failopen');
  assert.ok(o.outageSuccess < 0.1, `success ${o.outageSuccess}`);
  assert.ok(o.addedWaitMs >= 1000, 'each request first waits out the cache timeout');
  assert.ok(o.peakDbLoad >= 4, 'several times the database capacity');
});

test('cachedown: failing fast on the cache fixes latency, not load', () => {
  const o = run('fastfail');
  assert.ok(o.outageSuccess < 0.1);
  assert.ok(o.addedWaitMs < 100);
});

test('cachedown: shedding what the database cannot take keeps it serving at capacity', () => {
  const o = run('shed');
  assert.ok(o.outageSuccess > 0.15 && o.outageSuccess < 0.25, `success ${o.outageSuccess}`);
});

test('cachedown: an in-process cache in front of Redis keeps most traffic working', () => {
  assert.ok(run('l1').outageSuccess >= 0.75);
});

test('cachedown: when Redis comes back empty, the warm-up hurts an unprotected database more', () => {
  assert.ok(run('shed').warmSuccess > run('failopen').warmSuccess);
  assert.ok(run('l1').warmSuccess > 0.9);
});
