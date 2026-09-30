/* Rust Lab pages: home, today's 5-minute review, the review map, the recognition drill, cheat sheets,
 * setup. Also owns the review cards (spaced repetition) and wires cloud sync into the page. */
(function () {
  'use strict';
  const A = window.RustApp, RL = window.RL, E = window.RustEngine, H = window.RustHarness, HL = window.RustHighlight;
  const { esc, inline, md, PAGES, TAGS, GROUPS } = A;
  const S = () => A.S;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const DAY = 86400000;
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  /* ───────────── Review cards (spaced repetition) ─────────────
   * Card ids: r:<lesson> remember · c:<lesson> cue · q:<lesson>:<n> quiz · p:<lesson>:<n> predict · x:<exercise> recall
   * S.cards[id] = { due, ivl (days), reps, at } */
  function splitCue(cue) {
    const k = String(cue).lastIndexOf('→');
    return k > 0 ? [cue.slice(0, k).trim(), cue.slice(k + 1).trim()] : [null, cue];
  }
  function cardSpec(id) {
    const [kind, a, b] = id.split(':');
    const l = A.LESSON[a];
    if (kind === 'r' && l && l.remember) return { id, kind: 'flip', label: 'Remember', front: `**${l.title}**: what is the one thing to remember?`, back: l.remember, link: '#/l/' + a };
    if (kind === 'c' && l && l.cue) { const [x, y] = splitCue(l.cue); return { id, kind: 'flip', label: 'Cue', front: x ? `When you see: ${x}` : `The cue from **${l.title}**`, back: x ? `Reach for: **${y}**` : y, link: '#/l/' + a }; }
    if (kind === 'q' && l && (l.quiz || [])[+b]) return { id, kind: 'quiz', label: 'Quiz', q: l.quiz[+b], link: '#/l/' + a };
    if (kind === 'p' && l && (l.predict || [])[+b]) return { id, kind: 'predict', label: 'Predict', q: l.predict[+b], link: '#/l/' + a };
    if (kind === 'x' && A.EX[a] && A.EX[a].solution && A.EX[a].solution.talk) { const x = A.EX[a]; return { id, kind: 'flip', label: 'Recall', front: `**${x.title}**: ${x.kind === 'review' ? 'what was wrong with that PR?' : 'what was the fix, in one breath?'}`, back: x.solution.talk, link: '#/x/' + a }; }
    return null;
  }
  function addCard(id, inDays = 1) {
    const st = S();
    if (st.cards[id] || !cardSpec(id)) return;
    st.cards[id] = { due: Date.now() + inDays * DAY - 3 * 3600000, ivl: 0, reps: 0, at: Date.now() };
  }
  function seedLesson(l) {
    if (l.remember) addCard('r:' + l.id);
    if (l.cue) addCard('c:' + l.id, 1);
    (l.predict || []).forEach((p, n) => addCard(`p:${l.id}:${n}`, 2));
    (l.quiz || []).forEach((q, n) => addCard(`q:${l.id}:${n}`, 3));
    A.save();
  }
  function seedExercise(x) { if (x.solution && x.solution.talk) addCard('x:' + x.id, 3); }
  function rate(id, how) {
    const st = S();
    const c = st.cards[id] || { ivl: 0, reps: 0 };
    let ivl;
    if (how === 'again') ivl = 1;
    else if (how === 'hard') ivl = Math.max(1, Math.round((c.ivl || 1) * 1.3));
    else if (how === 'good') ivl = c.reps ? Math.max(3, Math.round(c.ivl * 2.5)) : 3;
    else ivl = c.reps ? Math.max(6, Math.round(c.ivl * 3.5)) : 6;
    st.cards[id] = { ivl, reps: how === 'again' ? 0 : (c.reps || 0) + 1, due: Date.now() + ivl * DAY - 3 * 3600000, at: Date.now(), last: how };
    A.save();
  }
  const dueCards = () => Object.entries(S().cards).filter(([id, c]) => c.due <= Date.now() && cardSpec(id)).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
  window.RustToday = { seedLesson, seedExercise, dueCount: () => dueCards().length, rate, addCard };

  /* ───────────── Drill pool: recognition questions ─────────────
   * Hand-written items (content/drill.js), plus "which hunt?" for every planted issue in a PR you
   * already reviewed, plus each hunt's own cue. */
  function drillPool() {
    const pool = RL.drill.map((d) => ({ ...d }));
    const tags = Object.keys(TAGS);
    for (const x of A.ALL_EX) {
      if (x.kind !== 'review' || !S().done[x.id]) continue;
      for (const is of x.issues) {
        const lines = (x.parsed.marks[is.id] || []).map((n) => x.parsed.lines[n - 1].text.trim());
        const opts = shuffle([is.tag, ...shuffle(tags.filter((t) => t !== is.tag)).slice(0, 3)]);
        pool.push({ q: `From the PR "${x.title}": which hunt is this line?`, code: lines.join('\n'), options: opts.map((t) => TAGS[t].label), answer: opts.indexOf(is.tag), why: is.title, topic: 'hunt:' + is.tag });
      }
    }
    for (const t of tags) {
      const [see] = splitCue(TAGS[t].cue);
      if (!see) continue;
      const opts = shuffle([t, ...shuffle(tags.filter((z) => z !== t)).slice(0, 3)]);
      pool.push({ q: `In a PR you see ${see}. Which hunt does that start?`, options: opts.map((z) => TAGS[z].label), answer: opts.indexOf(t), why: TAGS[t].one, topic: 'hunt:' + t });
    }
    return pool;
  }
  function weakness(topic) {
    const b = S().drill.by[topic] || [0, 0];
    return b[1] ? 1 - b[0] / b[1] : 0.5;
  }
  function pickDrill(pool, avoid = new Set()) {
    const cand = pool.filter((q) => !avoid.has(q.q + (q.code || '')));
    const list = cand.length ? cand : pool;
    if (!list.length) return null;
    const weights = list.map((q) => 0.3 + 2 * weakness(q.topic || 'misc'));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), k = 0;
    while (k < list.length - 1 && r > weights[k]) { r -= weights[k]; k++; }
    return list[k];
  }
  function recordDrill(topic, right) {
    const st = S();
    st.drill.n++; if (right) st.drill.right++;
    const b = st.drill.by[topic || 'misc'] || [0, 0]; b[1]++; if (right) b[0]++; st.drill.by[topic || 'misc'] = b;
    A.save();
  }
  const drillCode = (q) => (q.code ? `<div class="codeblock lang-rust mini"><pre>${HL.rust(q.code)}</pre></div>` : '');

  /* ───────────── Home ───────────── */
  PAGES.home = (root) => {
    const nx = A.nextItem();
    const due = dueCards().length;
    const total = A.ITEMS.length, done = A.ITEMS.filter((x) => A.isDone(x.id)).length;
    const reviews = A.ALL_EX.filter((x) => x.kind === 'review');
    const cta = nx
      ? `<a class="btn primary big" href="${A.hrefOf(nx.it)}">${nx.resume ? 'Continue' : done ? 'Next' : 'Start'}: ${inline(nx.it.data.title)} <small>· ${A.itemMins(nx.it)} min</small></a>`
      : '<span class="btn good big">Everything built so far is done ✓</span>';
    root.innerHTML = `
      <section class="hero rust">
        <div>
          <div class="eyebrow">Java developer · Rust reviewer</div>
          <h1>Read and review Rust, one idea at a time.</h1>
          <p class="lede">Short steps of 3 to 10 minutes. Every lesson starts with the one thing to remember, every snippet shows what the real compiler said, and a 5-minute daily review keeps it from leaking out.</p>
          <div class="cta">${cta}${due ? `<a class="btn warn" href="#/today">Today's review · ${due} card${due === 1 ? '' : 's'} · 5 min</a>` : ''}</div>
          ${nx ? `<p class="small next-why">${nx.resume ? 'Picks up exactly where you stopped.' : 'The next unfinished step in the course.'}</p>` : ''}
        </div>
        <div class="stats">
          <div class="stat"><small>Progress</small><b>${done}<span class="of"> / ${total}</span></b><div class="diffbar"><i style="width:${(100 * done) / Math.max(1, total)}%;background:var(--good)"></i></div><span>steps done</span></div>
          <div class="stat"><small>Today</small><b>${due}</b><span>${due ? 'cards due, about 5 minutes' : Object.keys(S().cards).length ? 'nothing due, nice' : 'cards appear as you finish lessons'}</span></div>
          <div class="stat wide"><small>PRs reviewed</small><b>${reviews.filter((x) => S().done[x.id]).length}<span class="of"> / ${reviews.length}</span></b><span>AI-written pull requests with planted issues</span></div>
        </div>
      </section>
      <div class="onething">
        <small>The one thing to remember</small>
        <p>The compiler already proved there are no dangling pointers and no data races. <b>Your review hunts what it cannot see</b>: crashes and silence, async traps, and plain bugs.</p>
        ${A.huntsHtml()}
      </div>
      <h2 class="section-h">Modules</h2>
      <div class="mod-grid">${A.MODS.map((m) => { const s = A.modStats(m); return `<a class="mod-card" href="#/m/${m.id}"><span class="n">${String(m.n).padStart(2, '0')}</span><h3>${esc(m.title)}</h3><p>${inline(m.blurb || '')}</p><div class="bar"><i style="width:${s.n ? (100 * s.d) / s.n : 0}%"></i></div><small>${s.d}/${s.n} steps · about ${m.units.reduce((a, u) => a + (u.mins || (A.LESSON[u.id] === u ? 6 : 10)), 0)} min</small></a>`; }).join('')}
      </div>`;
  };

  /* ───────────── Today: the 5-minute review ───────────── */
  let session = null;
  function buildSession() {
    const due = dueCards().slice(0, 8).map((id) => ({ type: 'card', id }));
    const pool = drillPool();
    const avoid = new Set();
    const drills = [];
    for (let k = 0; k < Math.min(due.length >= 5 ? 2 : 4, 8 - due.length); k++) { const q = pickDrill(pool, avoid); if (!q) break; avoid.add(q.q + (q.code || '')); drills.push({ type: 'drill', q }); }
    const items = [...due];
    drills.forEach((d, k) => items.splice(Math.min(items.length, 1 + k * 2), 0, d));
    return { items: items.slice(0, 8), k: 0, shown: false, pick: null, start: Date.now() };
  }
  function mcq(q, s, attr) {
    return `<div class="choice-grid one">${q.options.map((o, k) => `<button class="choice ${s.shown ? (k === q.answer ? 'right' : k === s.pick ? 'wrong' : '') : ''}" ${attr}="${k}" ${s.shown ? 'disabled' : ''}>${/\n/.test(o) ? `<code class="multi">${esc(o)}</code>` : inline(o)}</button>`).join('')}</div>`;
  }
  PAGES.today = (root) => {
    if (!session || session.finished) session = buildSession();
    const draw = () => {
      const s = session;
      const n = s.items.length;
      if (!n) {
        root.innerHTML = `<div class="eyebrow">Daily</div><h1>Today's review</h1><p class="lede">Nothing to review yet. Cards appear as you finish lessons: each lesson's remember line, cue card and predict questions come back here a day later, then at growing intervals.</p>${nextBlock()}`;
        return;
      }
      if (s.k >= n) {
        s.finished = true;
        const mins = Math.max(1, Math.round((Date.now() - s.start) / 60000));
        A.markDay(); A.save(); A.renderChips(); A.renderNav();
        root.innerHTML = `<div class="eyebrow">Daily</div><h1>Done for today ✓</h1><p class="lede">${n} card${n === 1 ? '' : 's'} in about ${mins} minute${mins === 1 ? '' : 's'}. That is the whole habit: a few minutes, most days. The cards come back just before you would forget them.</p>${nextBlock()}<p><button class="btn quiet" data-t="more">Another round</button></p>`;
        $('[data-t=more]', root).onclick = () => { session = buildSession(); draw(); };
        return;
      }
      const it = s.items[s.k];
      const bar = `<div class="today-bar"><span>Card ${s.k + 1} of ${n}</span><div class="unitbar">${s.items.map((_, j) => `<i class="${j < s.k ? 'done' : ''} ${j === s.k ? 'here' : ''}"></i>`).join('')}</div></div>`;
      let card;
      const next = '<button class="btn primary" data-t="next">Next →</button>';
      if (it.type === 'drill') {
        const q = it.q;
        card = `<div class="tcard"><small class="tlabel">Recognise it</small><p class="front">${inline(q.q)}</p>${drillCode(q)}${mcq(q, s, 'data-o')}${s.shown ? `<div class="drill-why"><b>${s.pick === q.answer ? '✓ Right.' : '✗ Not quite.'}</b> ${inline(q.why)}</div>${next}` : ''}</div>`;
      } else {
        const c = cardSpec(it.id);
        if (c.kind === 'quiz' || c.kind === 'predict') {
          const q = c.q;
          const snip = c.kind === 'predict' ? H.snippet('run', q.code) : null;
          const rec = snip && A.OUT[snip.key];
          card = `<div class="tcard"><small class="tlabel">${esc(c.label)}</small><p class="front">${inline(q.q || 'What happens when this runs?')}</p>${snip ? `<div class="codeblock lang-rust mini"><pre>${HL.rust(snip.shown)}</pre></div>` : ''}${mcq(q, s, 'data-qo')}${s.shown ? `<div class="drill-why">${md(q.why)}${rec ? `<div class="cb-out">${A.outputHtml(rec, 'run')}</div>` : ''}</div>${next}` : ''}</div>`;
        } else {
          card = `<div class="tcard"><small class="tlabel">${esc(c.label)}</small><p class="front">${inline(c.front)}</p>${s.shown ? `<div class="back">${md(c.back)}</div><div class="rate-row"><span>How well did you remember it?</span>${[['again', 'Forgot', 'tomorrow'], ['hard', 'Hard', 'soon'], ['good', 'Got it', 'in a few days'], ['easy', 'Easy', 'in a week+']].map(([k, t, sub]) => `<button class="btn ${k === 'good' ? 'primary' : ''}" data-r="${k}">${t}<span class="k">${sub}</span></button>`).join('')}</div><a class="small" href="${c.link}">Open the lesson</a>` : '<button class="btn primary" data-t="show">Show answer <span class="k">space</span></button>'}</div>`;
        }
      }
      root.innerHTML = `<div class="eyebrow">Daily · about 5 minutes</div><h1>Today's review</h1>${bar}${card}`;
    };
    const next = () => { session.k++; session.shown = false; session.pick = null; draw(); };
    root.addEventListener('click', (e) => {
      const s = session; if (!s || s.finished) return;
      const it = s.items[s.k]; if (!it) return;
      const t = e.target.closest('[data-t]');
      if (t && t.dataset.t === 'show') { s.shown = true; draw(); return; }
      if (t && t.dataset.t === 'next') { next(); return; }
      const o = e.target.closest('[data-o]');
      if (o && !s.shown) { s.pick = +o.dataset.o; s.shown = true; recordDrill(it.q.topic, s.pick === it.q.answer); draw(); return; }
      const qo = e.target.closest('[data-qo]');
      if (qo && !s.shown) { const c = cardSpec(it.id); s.pick = +qo.dataset.qo; s.shown = true; rate(it.id, s.pick === c.q.answer ? 'good' : 'again'); draw(); return; }
      const r = e.target.closest('[data-r]');
      if (r) { rate(it.id, r.dataset.r); next(); }
    });
    const key = (e) => {
      if (location.hash !== '#/today') { document.removeEventListener('keydown', key); return; }
      if (e.target.closest('input,textarea,select,.CodeMirror')) return;
      const s = session; if (!s || s.finished) return;
      if (e.key === ' ' && !s.shown && s.items[s.k] && $('[data-t=show]', root)) { e.preventDefault(); $('[data-t=show]', root).click(); }
      if (e.key === 'Enter') { const b = $('[data-t=next]', root); if (b) b.click(); }
      if (/^[1-4]$/.test(e.key)) { const b = $$('[data-r],[data-o],[data-qo]', root).filter((x) => !x.disabled)[+e.key - 1]; if (b) b.click(); }
    };
    document.addEventListener('keydown', key);
    draw();
  };
  function nextBlock() {
    const nx = A.nextItem();
    return nx ? `<div class="next-card"><div class="nc-left"><small>Your next step</small><a class="nc-title" href="${A.hrefOf(nx.it)}">${inline(nx.it.data.title)}</a><span class="nc-meta">${nx.it.kind === 'lesson' ? 'Lesson' : A.kindLabel(nx.it.data)} · about ${A.itemMins(nx.it)} min</span></div><div class="nc-right"><a class="btn primary" href="${A.hrefOf(nx.it)}">Go →</a></div></div>` : '';
  }

  /* ───────────── Review map: the eight hunts ───────────── */
  PAGES.hunts = (root) => {
    const where = (t) => {
      const ls = Object.values(A.LESSON).filter((l) => (l.hunts || []).includes(t));
      const xs = A.ALL_EX.filter((x) => x.kind === 'review' && x.issues.some((i) => i.tag === t));
      if (!ls.length && !xs.length) return '<p class="small dim">Taught in a later module.</p>';
      return `<p class="small">${ls.map((l) => `<a href="#/l/${l.id}">${inline(l.title)}</a>`).concat(xs.map((x) => `<a href="#/x/${x.id}">PR: ${esc(x.title)}</a>`)).join(' · ')}</p>`;
    };
    root.innerHTML = `
      <div class="eyebrow">Reference</div><h1>The review map</h1>
      <p class="lede">Eight hunts in three groups. The compiler handles memory and data races; these are what is left for you. Each has a cue: the thing in the code that should make you stop.</p>
      <div class="hunt-cols">${Object.entries(GROUPS).map(([g, gr]) => `
        <section class="hunt-col ${g}">
          <h2>${esc(gr.label)}</h2><p class="small">${inline(gr.one)}</p>
          ${Object.keys(TAGS).filter((t) => TAGS[t].group === g).map((t) => A.huntCard(t) + where(t)).join('')}
        </section>`).join('')}</div>`;
  };

  /* ───────────── Drill ───────────── */
  let drill = null;
  PAGES.drill = (root) => {
    const pool = drillPool();
    const st = S().drill;
    const next = () => { const q = pickDrill(pool, new Set(drill && drill.q ? [drill.q.q + (drill.q.code || '')] : [])); drill = { q, answered: false }; draw(); };
    const draw = () => {
      if (!drill.q) { root.innerHTML = '<div class="eyebrow">Tool</div><h1>Recognition drill</h1><p class="lede">No questions yet.</p>'; return; }
      const { q, answered, pick } = drill;
      root.innerHTML = `
        <div class="eyebrow">Tool</div><h1>Recognition drill</h1>
        <p class="lede">Quick recognition: what a symbol means, which rule an error breaks, which hunt a line starts. Questions lean toward the topics you miss. Every PR you finish adds its planted lines here.</p>
        <div class="drill-bar"><span>Score <b>${st.right}/${st.n}</b></span></div>
        <div class="drill-card">
          <p class="prompt">${inline(q.q)}</p>
          ${drillCode(q)}
          <div class="choice-grid one">${q.options.map((o, k) => `<button class="choice ${answered ? (k === q.answer ? 'right' : k === pick ? 'wrong' : '') : ''}" data-o="${k}" ${answered ? 'disabled' : ''}>${/\n/.test(o) ? `<code class="multi">${esc(o)}</code>` : inline(o)}</button>`).join('')}</div>
          ${answered ? `<div class="drill-why"><b>${pick === q.answer ? '✓ Right.' : '✗ Not quite.'}</b> ${inline(q.why)}</div><div style="margin-top:12px"><button class="btn primary" data-d="next">Next →</button> <span class="small">or press Enter</span></div>` : ''}
        </div>`;
    };
    root.addEventListener('click', (e) => {
      const o = e.target.closest('[data-o]');
      if (o && drill && !drill.answered) { drill.answered = true; drill.pick = +o.dataset.o; recordDrill(drill.q.topic, drill.pick === drill.q.answer); draw(); }
      const d = e.target.closest('[data-d]');
      if (d && d.dataset.d === 'next') next();
    });
    const key = (e) => {
      if (location.hash !== '#/drill') { document.removeEventListener('keydown', key); return; }
      if (e.target.closest('input,textarea,select,.CodeMirror')) return;
      if (e.key === 'Enter' && drill && drill.answered) next();
      if (/^[1-4]$/.test(e.key) && drill && !drill.answered) { const b = $$('.choice', root)[+e.key - 1]; if (b) b.click(); }
    };
    document.addEventListener('keydown', key);
    next();
  };

  /* ───────────── Cheat sheets ───────────── */
  PAGES.cheats = (root, arg) => {
    const sheets = RL.cheats || [];
    const cur = sheets.find((s) => s.id === arg);
    if (!cur) {
      root.innerHTML = `
        <div class="eyebrow">Reference</div><h1>Cheat sheets</h1>
        <p class="lede">One page each, for rereading before you open a PR. They print cleanly too (Ctrl/⌘ + P).</p>
        <div class="mod-grid">${sheets.map((s) => `<a class="mod-card" href="#/cheats/${s.id}"><span class="n">${esc(s.kind || 'Sheet')}</span><h3>${esc(s.title)}</h3><p>${inline(s.blurb || '')}</p></a>`).join('')}</div>`;
      return;
    }
    const i = sheets.indexOf(cur);
    root.innerHTML = `
      <div class="eyebrow"><a href="#/cheats">Cheat sheets</a><span class="meta">${esc(cur.kind || '')}</span></div>
      <h1>${esc(cur.title)}</h1>
      ${cur.lede ? `<p class="lede">${inline(cur.lede)}</p>` : ''}
      <div class="prose cheat">${md(cur.body, { id: 'cheat-' + cur.id, quiz: cur.quiz })}</div>
      <nav class="pager">${sheets[i - 1] ? `<a href="#/cheats/${sheets[i - 1].id}"><small>← Sheet</small><span>${esc(sheets[i - 1].title)}</span></a>` : ''}${sheets[i + 1] ? `<a class="next" href="#/cheats/${sheets[i + 1].id}"><small>Sheet →</small><span>${esc(sheets[i + 1].title)}</span></a>` : ''}</nav>`;
  };
  PAGES.quizFor = (lid) => { const s = (RL.cheats || []).find((x) => 'cheat-' + x.id === lid); return s && s.quiz; };

  /* ───────────── Setup ───────────── */
  PAGES.setup = (root) => {
    const draw = () => {
      const p = E.Play;
      const sync = window.LabSync ? window.LabSync.status() : { state: 'off' };
      const configured = window.LabSync && window.LabSync.configured();
      const pill = (ok, t) => `<span class="pill ${ok === true ? 'ok' : ok === false ? 'no' : 'wait'}">${t}</span>`;
      root.innerHTML = `
        <div class="eyebrow">Setup</div><h1>Setup</h1>
        <p class="lede">Nothing to install. Reading works offline; running code needs the internet.</p>
        <div class="prose">
          <h2 style="border:0;padding-top:0">Where your code runs ${pill(p.state === 'offline' ? false : p.version ? true : null, p.version ? 'Rust ' + p.version : p.state === 'offline' ? 'unreachable' : 'checking')}</h2>
          <p>Code runs on the official <a href="https://play.rust-lang.org/" target="_blank" rel="noopener">Rust Playground</a>: the real compiler on the stable channel, edition 2024, with the most popular crates available (tokio, serde, anyhow, thiserror and more). Each run takes a few seconds, and the Playground stops anything that runs longer than about 10 seconds.</p>
          <p>Snippet outputs in lessons were recorded from the same Playground by <code>tools/build.mjs</code>, so they show even when you are offline.</p>
          <p><button class="btn" data-s="recheck">Check again</button></p>
          <h2>Cloud sync ${pill(sync.state === 'synced' ? true : sync.state === 'error' ? false : null, !configured ? 'not set up' : sync.state === 'synced' ? 'on' : sync.state === 'syncing' ? 'syncing' : sync.state === 'error' ? 'problem' : 'signed out')}</h2>
          ${configured ? `
            <p>Sign in with Google to keep progress, code, review flags and cards in step across your devices. Your data lives in a private Firebase database that only your account can read.</p>
            ${sync.email ? `<p>Signed in as <b>${esc(sync.email)}</b>${sync.at ? ` · last synced ${A.ago(sync.at)}` : ''}.</p><p><button class="btn" data-s="now">Sync now</button> <button class="btn quiet" data-s="out">Sign out</button></p>` : '<p><button class="btn primary" data-s="in">Sign in with Google</button></p>'}
            ${sync.error ? `<div class="callout warn"><b>Sync problem</b><p>${esc(sync.error)}</p></div>` : ''}` : '<p>Not configured on this copy. The deploy workflow writes the config from the <code>LAB_FIREBASE</code> repository secret; for a local copy, fill in <code>sync-config.example.js</code> and save it as <code>sync-config.js</code> (gitignored).</p>'}
          <h2>Focus mode</h2>
          <p>The <b>◎</b> button in the top bar hides the outline and everything else except the current step. <b>Esc</b> leaves it.</p>
        </div>`;
    };
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'recheck') { b.disabled = true; E.Play.version = null; await E.Play.loadVersion(); draw(); }
      if (b.dataset.s === 'in') window.LabSync.signIn();
      if (b.dataset.s === 'out') window.LabSync.signOut();
      if (b.dataset.s === 'now') window.LabSync.syncNow();
    });
    const off = window.LabSync ? window.LabSync.onStatus(() => { if (location.hash.startsWith('#/setup')) draw(); else off(); }) : null;
    draw();
  };

  /* ───────────── Cloud sync wiring ───────────── */
  const chip = $('#syncChip');
  function paintSync(st) {
    if (!chip) return;
    if (!window.LabSync || !window.LabSync.configured()) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.className = 'chip sync ' + st.state;
    chip.textContent = st.state === 'synced' ? '☁ Synced' : st.state === 'syncing' ? '☁ Syncing…' : st.state === 'error' ? '☁ Sync problem' : '☁ Sign in to sync';
    chip.title = st.state === 'synced' ? `Signed in as ${st.email || ''}. Last synced ${A.ago(st.at)}.` : st.error || 'Keep your progress on every device';
  }
  if (chip) chip.onclick = () => { const st = window.LabSync && window.LabSync.status(); if (st && st.state === 'signed-out') window.LabSync.signIn(); else location.hash = '#/setup'; };
  if (window.LabSync) {
    window.LabSync.onStatus(paintSync);
    window.LabSync.init({
      lab: 'rust',
      getState: () => A.syncable(),
      merge: (a, b) => A.mergeState(a, b),
      apply: (cloud) => A.applyMerged(cloud),
      subscribe: (fn) => A.listeners.add(fn),
    });
  }

  A.start();
})();
