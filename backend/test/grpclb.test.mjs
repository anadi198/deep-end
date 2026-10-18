import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/grpclb.js');
const run = (p) => BS.run('grpclb', p).out;

test('grpclb: behind an L4 load balancer, backends added later get no calls', () => {
  assert.equal(run({ strategy: 'l4' }).newShare, 0);
});

test('grpclb: round_robin alone never sees new backends, because nothing makes it resolve again', () => {
  assert.equal(run({ strategy: 'rr' }).newShare, 0);
});

test('grpclb: round_robin with a server max connection age picks new backends up within a minute', () => {
  const o = run({ strategy: 'rrage' });
  assert.ok(Math.abs(o.newShare - 0.5) < 0.02, `new backends carry ${o.newShare}`);
  assert.ok(o.pickedUpAfter <= 40);
});

test('grpclb: a per-request (L7) proxy spreads calls at once', () => {
  const o = run({ strategy: 'l7' });
  assert.ok(Math.abs(o.newShare - 0.5) < 0.02);
  assert.ok(o.pickedUpAfter <= 10);
});

test('grpclb: pick_first sends each client to one backend, so the spread is lumpy', () => {
  const pf = run({ strategy: 'pickfirst' });
  const l7 = run({ strategy: 'l7' });
  assert.ok(pf.imbalance > 1.3, `busiest over average ${pf.imbalance}`);
  assert.ok(l7.imbalance < 1.05);
});
