/* LLD Lab content registry. Each content/NN-*.js file calls LLD.module({...}).
 *
 * Module:   { id, title, short, blurb, intro, items: [ lesson | exercise, ... ] }
 * Lesson:   { lesson: 'id', title, mins, remember, cue, body, quiz: [{ q, options, answer, why }] }
 *             remember  the one thing to keep (shown first, and reviewed later as a card)
 *             cue       "when you see X, reach for Y" (reviewed later as a card)
 * Exercise: { exercise: { id, title, kind, mins, diff, patterns, statement, given, starter, tests,
 *                         lint, rubric, hints, solution, wrong, jdk, blind, file, imports } }
 *             kind      'build' (tests grade it) | 'refactor' (tests + design notes) | 'design' (Claude or you grade it)
 *             given     read-only Java shown as Given.java (interfaces, fakes)
 *             tests     [{ name, code, ex }]  Java method bodies; ex: true runs on Run, all run on Submit
 *                       assertions: eq(expected, actual, what) ok(cond, what) no(cond, what)
 *                                   near(a, b, what) fails(() -> ..., what) say(text)
 *                                   throwsA(SomeException.class, () -> ..., what)
 *             helpers   Java static methods added to the generated Main, for tests to share
 *             lint      [{ re, when: 'present'|'absent', note }]  design notes, never failures
 *             rubric    markdown list: what a strong answer covers (used by Claude reviews too)
 *             solution  { java, why, talk }
 *             wrong     [{ name, java }]  plausible wrong answers the tests must catch (checked by tools/build.mjs)
 *             jdk       true when it needs real threads (the in-browser engine has none)
 *             blind     true to hide the pattern tags until it is solved
 *
 * Markdown dialect (rendered by app.js):
 *   ## / ###, paragraphs, - lists, 1. lists, **bold**, *italic*, «code», [text](url), tables,
 *   ~~~java [label]   highlighted code        ~~~mermaid   a Mermaid diagram
 *   ~~~seq [title]    a step-through sequence (syntax in viz.js)
 *   :::kind Title … :::   callouts (key | interview | warn | java | note | cue | remember)
 *   ?? question / answer lines   flip cards
 *   @quiz n  @exercises id id  @pattern id  @family id  @stop   directives on their own line
 * Write bodies as String.raw templates (J`…`). Inline code uses «…» and fences use ~~~, because a
 * backtick would end the template literal.
 */
(function (root) {
  const LLD = root.LLD || (root.LLD = { modules: [], cheats: [], drill: [], patterns: {}, families: {}, kit: {} });
  LLD.module = function (m) { LLD.modules.push(m); return m; };
  LLD.J = String.raw;

  // Shared test fixtures, dropped into an exercise's «given».
  LLD.kit.clock = LLD.J`
/** Time as the code under test sees it. Tests pass a FakeClock so time moves only when they say so. */
interface Clock {
    long nowMillis();
}

class FakeClock implements Clock {
    private long now;
    FakeClock(long startMillis) { this.now = startMillis; }
    public long nowMillis() { return now; }
    void advance(long millis) { now += millis; }
}
`;

  if (typeof module !== 'undefined' && module.exports) module.exports = LLD;
})(typeof globalThis !== 'undefined' ? globalThis : this);
