/* DSA Lab content registry. Each content/NN-*.js file calls DSA.module({...}).
 * Text fields (lesson bodies, statements, solutions) are written in a small Markdown dialect,
 * rendered by app.js:
 *   ## / ###, paragraphs, - lists, 1. lists, **bold**, *italic*, «code», [text](url), tables,
 *   ~~~java [label]  fenced code (highlighted),  :::kind Title … :::  callouts
 *   (kind: key | interview | warn | java | note), and directives on their own line:
 *   @viz id {"input":…} [Optional title]     a step-through visualizer
 *   @problems id id id                       a list of problem cards
 *   @flow id                                 a flowchart (cheat sheets)
 *   @quiz n                                  the lesson's n-th quiz question
 *   lines starting with "<" are passed through as raw HTML.
 * Write bodies and Java code as String.raw templates (J`…`) so backslashes survive. Inline code uses
 * «…» and fences use ~~~, because a backtick would end the template literal.
 */
(function (root) {
  const DSA = root.DSA || (root.DSA = { modules: [], extras: {}, drill: [], cheats: [], flows: {} });
  DSA.module = function (m) { DSA.modules.push(m); return m; };
  // LeetCode link: lc(1, 'two-sum', 'Two Sum', 'same' | 'variant' | 'harder' | 'easier' | 'similar', { premium })
  DSA.lc = function (n, slug, title, rel = 'similar', opts = {}) { return { n, slug, title, rel, premium: !!opts.premium }; };
  if (typeof module !== 'undefined' && module.exports) module.exports = DSA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
