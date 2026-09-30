/* Merging two copies of a lab's saved progress (this device's and the cloud's) for LabSync.
 * A spec lists every field that may sync, with how to merge it. Fields not in the spec never leave
 * the device and are never taken from the cloud (device settings, pairing tokens).
 *   'byAt:<field>'  object of records: per id, the record whose <field> is larger (newer) wins
 *   'max'           object of numbers: per id, the larger number wins
 *   'fill'          object: this device's value wins; ids it lacks come from the other copy
 *   'moreN'         a counter object: the copy with the larger n wins, and its by-map is merged
 *   'union:<cap>'   list: this device's order first, then the other's extras; keeps the last <cap> */
(function (root) {
  'use strict';

  const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

  function mergeField(how, a, b) {
    const [kind, arg] = how.split(':');
    if (kind === 'byAt') {
      const o = { ...obj(a) };
      for (const [id, rec] of Object.entries(obj(b))) {
        const mine = o[id];
        if (mine === undefined || ((rec && rec[arg]) || 0) > ((mine && mine[arg]) || 0)) o[id] = rec;
      }
      return o;
    }
    if (kind === 'max') {
      const o = { ...obj(a) };
      for (const [id, n] of Object.entries(obj(b))) o[id] = Math.max(Number(o[id]) || 0, Number(n) || 0);
      return o;
    }
    if (kind === 'fill') return { ...obj(b), ...obj(a) };
    if (kind === 'moreN') {
      const x = obj(a), y = obj(b);
      const win = (y.n || 0) > (x.n || 0) ? y : x, lose = win === x ? y : x;
      return { ...win, by: { ...obj(lose.by), ...obj(win.by) } };
    }
    if (kind === 'union') {
      const list = [...(Array.isArray(a) ? a : [])];
      for (const item of Array.isArray(b) ? b : []) if (!list.includes(item)) list.push(item);
      const cap = Number(arg) || list.length;
      return list.slice(-cap);
    }
    throw new Error('unknown merge strategy ' + how);
  }

  // The part of the state that may leave the device.
  function pick(state, spec) {
    const out = { v: state.v };
    for (const k of Object.keys(spec)) if (state[k] !== undefined) out[k] = state[k];
    return out;
  }

  function merge(local, remote, spec) {
    const out = { ...local };
    if (!remote) return out;
    for (const [k, how] of Object.entries(spec)) {
      if (remote[k] === undefined) continue;
      out[k] = local[k] === undefined ? remote[k] : mergeField(how, local[k], remote[k]);
    }
    return out;
  }

  const changed = (a, b, spec) => JSON.stringify(pick(a, spec)) !== JSON.stringify(pick(b, spec));

  const api = { pick, merge, changed, mergeField };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SyncMerge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
