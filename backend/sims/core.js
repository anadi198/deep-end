/* Backend Lab simulators: the registry and shared helpers.
 *
 * A sim is a pure, seeded model: run(params) returns the same result every time for the same params,
 * so tests can pin the behaviour each lesson describes. The page renders the result (simui.js).
 *
 * define(name, spec)
 *   spec.title, spec.blurb
 *   spec.params   [{ id, label, type: 'range'|'select'|'toggle', min, max, step, unit, options: [[value, label]], value, hint }]
 *   spec.compare  optional param id: the page can run every option of it side by side
 *   spec.run(p) → {
 *     stats  [{ label, value, unit, tone: 'good'|'bad'|'warn', note }]
 *     chart  { x: [...], xLabel, yLabel, lines: [{ name, values, tone, dash }], bands: [{ from, to, label }], marks: [{ x, label }] }
 *     bars   { title, items: [{ label, value, tone }], unit }
 *     notes  [string]   one-line takeaways shown under the result
 *     view   anything a custom renderer (spec.view, browser only) needs
 *   }
 */
(function (root) {
  'use strict';
  const BS = root.BackendSims || (root.BackendSims = { all: {} });

  // mulberry32: small, fast, and good enough for teaching models
  BS.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // nearest-rank percentile, without touching the caller's array
  BS.percentile = function (xs, p) {
    if (!xs.length) return NaN;
    const s = xs.slice().sort((a, b) => a - b);
    const k = Math.min(s.length, Math.max(1, Math.ceil((p / 100) * s.length)));
    return s[k - 1];
  };

  BS.define = function (name, spec) { spec.name = name; BS.all[name] = spec; return spec; };
  BS.defaults = function (name) {
    const out = {};
    for (const q of BS.all[name].params || []) out[q.id] = q.value;
    return out;
  };
  BS.run = function (name, params) { return BS.all[name].run({ ...BS.defaults(name), ...(params || {}) }); };

  if (typeof module !== 'undefined' && module.exports) module.exports = BS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
