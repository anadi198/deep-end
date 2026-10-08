import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BS = require('../sims/core.js');
require('../sims/fanout.js');
const run = (p) => BS.run('fanout', p).out;

test('fanout: push (fan-out on write) makes every feed load a single read, but one big account\'s post is a huge burst', () => {
  const o = run({ strategy: 'write' });
  assert.equal(o.lookupsPerLoad, 1);
  assert.equal(o.biggestPost, o.maxFollowers);
});

test('fanout: pull (fan-out on read) stores each post once and pays at read time instead', () => {
  const w = run({ strategy: 'write' }), r = run({ strategy: 'read' });
  assert.ok(r.insertsPerSec < w.insertsPerSec / 5, `${r.insertsPerSec} vs ${w.insertsPerSec}`);
  assert.ok(r.lookupsPerLoad > 10, `lookups ${r.lookupsPerLoad}`);
});

test('fanout: the hybrid pulls only big accounts, capping the burst and keeping reads cheap', () => {
  const h = run({ strategy: 'hybrid', threshold: 10000 });
  const r = run({ strategy: 'read' }), w = run({ strategy: 'write' });
  assert.ok(h.biggestPost < 10000);
  assert.ok(h.lookupsPerLoad < r.lookupsPerLoad / 3);
  assert.ok(h.insertsPerSec < w.insertsPerSec);
});
