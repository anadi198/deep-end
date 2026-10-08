/* Backend Lab content registry. Each content/NN-*.js file calls BL.module({...}).
 *
 * Module:  { id, title, short, blurb, intro, items: [lesson, ...] }
 * Lesson:  { lesson: 'id', title, mins, remember, cue, body, quiz: [{ q, options, answer, why }], defend: [drill, ...] }
 *            remember  the one thing to keep (shown first, and reviewed later as a card)
 *            cue       "when you see X → reach for Y" (reviewed later as a card)
 * Drill:   { q, weak, whyWeak, follow: [{ q, a }], strong: [point, ...], flags: [red flag, ...] }
 *            an interview question worked as a round: answer it aloud, compare with a weak answer,
 *            take the follow-ups one at a time, then check against the points a strong answer covers
 *
 * Markdown dialect (rendered by app.js):
 *   ## / ###, paragraphs, - lists, 1. lists, **bold**, *italic*, «code», [text](url), tables, > quotes
 *   ~~~java  ~~~sql  ~~~text [label]   highlighted, display only
 *   ~~~mermaid   ~~~seq [title]       a diagram, or a step-through sequence (syntax in viz.js)
 *   :::kind Title … :::               callouts (key | warn | note | pitfall | aside)
 *   ?? question / answer lines        flip cards
 *   @sim name key=value …             a simulator from sims/, with preset parameters
 *   @defend n   @quiz n   @stop       directives on their own line
 *   @lab pg:locks Text                a card linking to a lesson in another lab
 * Write bodies as String.raw templates (R`…`). Inline code uses «…» and fences use ~~~, because a
 * backtick would end the template literal.
 */
(function (root) {
  const BL = root.BL || (root.BL = { modules: [], cheats: [], drill: [] });
  BL.module = function (m) { BL.modules.push(m); return m; };
  BL.R = String.raw;
  // other labs on the same site, for @lab links: lab id → [name, href for a lesson id]
  BL.labs = {
    pg: ['Postgres Lab', (id) => `../pg/#${id}`],
    lld: ['LLD Lab', (id) => `../lld/#/l/${id}`],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
