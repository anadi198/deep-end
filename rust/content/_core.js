/* Rust Lab content registry. Each content/NN-*.js file calls RL.module({...}).
 *
 * Module:   { id, title, short, blurb, intro, items: [ lesson | exercise, ... ] }
 * Lesson:   { lesson: 'id', title, mins, remember, cue, body, quiz: [{ q, options, answer, why }],
 *             predict: [{ code, q, options, answer, why, error }] }
 *             remember  the one thing to keep (shown first, and reviewed later as a card)
 *             cue       "when you see X → reach for Y" (reviewed later as a card)
 *             predict   "what happens when this runs?"  options are printed output, or 'Compile error',
 *                       'It panics', 'It compiles'. error: the E-code a compile error must carry.
 *                       tools/build.mjs runs every one on the real compiler and fails if the answer is wrong.
 * Exercise: { exercise: { id, title, kind, mins, diff, topics, statement, starter, tests, solution,
 *                         wrong, starterFails, hints, lint } }
 *             kind      'fix' (make it compile or pass) | 'build' (write it) | 'review' (flag the bad lines)
 *             tests     [{ name, code, ex, async }]  Rust test bodies; ex: true runs on Run, all run on Submit
 *             solution  { rust, why, talk }
 *             wrong     [{ name, rust }]  plausible wrong answers the tests must catch
 *             starterFails  'compile' (the starter must not compile) | 'tests' (it compiles, a test fails)
 *             lint      [{ re, when: 'present'|'absent', note }]  review notes, never failures
 * Review:   { exercise: { id, title, kind: 'review', mins, diff, statement, file, code, issues, decoys,
 *                         hints, solution: { fixed, talk } } }
 *             code      the file after the PR: a leading "+" marks an added line, ⟦id⟧ at a line end
 *                       ties it to an issue or decoy. It must compile: the compiler passed this PR.
 *             issues    [{ id, tag, title, why, fix }]  tag is one of RL.tags
 *             issues may carry demo: a test body that must fail on the PR code (demoAsync: true runs it on tokio);
 *                       for block and hang issues, a test the Playground has to stop also counts as failing
 *             decoys    [{ id, why }]  lines that look wrong but are fine
 *
 * Markdown dialect (rendered by app.js):
 *   ## / ###, paragraphs, - lists, 1. lists, **bold**, *italic*, «code», [text](url), tables,
 *   ~~~rust [label]          highlighted, display only
 *   ~~~rust !run [label]     runs; the recorded output shows under it (it must succeed)
 *   ~~~rust !panic [label]   runs and must panic; the panic shows under it
 *   ~~~rust !fail [label]    must not compile; the compiler's message shows under it
 *   ~~~rust !clippy [label]  shows what clippy says
 *     Inside rust fences, "# " lines compile but are hidden, and a snippet without fn main runs inside one.
 *   ~~~java [label]   ~~~mermaid   ~~~seq [title]  (step-through sequence, syntax in viz.js)
 *   :::kind Title … :::   callouts (key | java | warn | review | note | cue | remember)
 *   :::vs Title … :::     a Java fence and a Rust fence side by side
 *   ?? question / answer lines   flip cards
 *   @quiz n  @predict n  @exercises id id  @hunt tag  @stop   directives on their own line
 * Write bodies as String.raw templates (R`…`). Inline code uses «…» and fences use ~~~, because a
 * backtick would end the template literal.
 */
(function (root) {
  const RL = root.RL || (root.RL = { modules: [], cheats: [], drill: [], kit: {} });
  RL.module = function (m) { RL.modules.push(m); return m; };
  RL.R = String.raw;

  // The eight things a Rust reviewer hunts for. The compiler already checked memory and data races.
  RL.tags = {
    panic: { n: 1, label: 'Can crash', group: 'crash', one: 'unwrap, expect, indexing, slicing or overflow on data you do not control.', cue: '«.unwrap()», «[i]», «&s[a..b]» or arithmetic on outside data → ask what happens on bad input' },
    swallow: { n: 2, label: 'Error swallowed', group: 'crash', one: 'A failure that nobody hears about: «let _ =», «.ok()», an ignored task result.', cue: '«let _ =», «.ok()», «if let Ok» with no else → who finds out when this fails?' },
    block: { n: 3, label: 'Blocks the runtime', group: 'async', one: 'Blocking I/O, sleep or heavy CPU inside async code stalls every task on that thread.', cue: '«std::thread::sleep», «std::fs», a long loop inside «async fn» → move it to spawn_blocking or the async version' },
    hang: { n: 4, label: 'Can wait forever', group: 'async', one: 'An await with no timeout, a channel that never closes, a lock held across an await.', cue: 'an «.await» on the network or a lock → what bounds how long this waits?' },
    lost: { n: 5, label: 'Work lost', group: 'async', one: 'Data dropped on cancel, shutdown or a dropped task: half-read buffers, unflushed writes.', cue: '«select!», «drop», shutdown paths → what happens to the work that was in flight?' },
    unbounded: { n: 6, label: 'Grows without limit', group: 'async', one: 'Unbounded channels, maps nobody prunes, one task per message with no cap.', cue: '«unbounded_channel», a map that only inserts, spawn in a loop → what caps it under a burst?' },
    logic: { n: 7, label: 'Wrong result', group: 'plain', one: 'A plain bug: truncating «as» casts, off-by-one, the wrong branch, silent defaults.', cue: '«as u8», «as u16», «unwrap_or(0)» → can this quietly produce a wrong value?' },
    cost: { n: 8, label: 'Needless cost', group: 'plain', one: 'Clones, copies and allocations that buy nothing, usually added to quiet the compiler.', cue: '«.clone()», «.to_vec()», «.to_string()» on big data in a hot path → would a borrow do?' },
  };
  RL.groups = {
    crash: { label: 'Crashes and silence', one: 'It dies on bad input, or it fails and nobody hears.' },
    async: { label: 'Async traps', one: 'It stalls, waits forever, drops work or eats memory. Tokio-shaped.' },
    plain: { label: 'Plain bugs', one: 'Wrong answers and wasted work, same as in Java.' },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
