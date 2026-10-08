import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/latency.js');
const run = (p) => BS.run('latency', p);

test('latency: the defaults average about 120 ms while the p99 is over a second', () => {
  const r = run({});
  assert.ok(r.out.call.mean > 105 && r.out.call.mean < 135, `mean ${r.out.call.mean}`);
  assert.ok(r.out.call.p50 < 120, `p50 ${r.out.call.p50}`);
  assert.ok(r.out.call.p99 > 1000, `p99 ${r.out.call.p99}`);
});

test('latency: fan-out to 100 backends makes most page loads slow (1 - 0.99^100, about 63%)', () => {
  const r = run({ slowPct: 1, fanout: 100 });
  assert.ok(r.out.pageSlowShare > 0.58 && r.out.pageSlowShare < 0.68, `share ${r.out.pageSlowShare}`);
});

test('latency: with no fan-out the page p99 equals the call p99', () => {
  const r = run({ fanout: 1 });
  assert.equal(r.out.page.p99, r.out.call.p99);
});

test('latency: a session of 20 page loads hits a slow one far more often than one load does', () => {
  const r = run({ fanout: 1, slowPct: 2 });
  assert.ok(r.out.sessionSlowShare > 0.3, `session ${r.out.sessionSlowShare}`);
});

test('latency: averaging two servers\' p99s is not the p99 of their combined traffic', () => {
  const r = run({});
  assert.notEqual(Math.round(r.out.avgOfP99s), Math.round(r.out.pooledP99));
});
