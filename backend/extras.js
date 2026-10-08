/* Backend Lab pages: home, today's 5-minute review, mock rounds, the recognition drill, cheat sheets,
 * setup. Also owns the review cards (spaced repetition) and wires cloud sync into the page. */
(function () {
  'use strict';
  const A = window.LabApp, BL = window.BL;
  const { esc, inline, md, PAGES } = A;
  const S = () => A.S;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const DAY = 86400000;
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  /* ───────────── Review cards (spaced repetition) ─────────────
   * Card ids: r:<lesson> remember · c:<lesson> cue · q:<lesson>:<n> quiz · d:<lesson>:<n> a Defend-it round
   * S.cards[id] = { due, ivl (days), reps, at } */
  function splitCue(cue) {
    const k = String(cue).lastIndexOf('→');
    return k > 0 ? [cue.slice(0, k).trim(), cue.slice(k + 1).trim()] : [null, cue];
  }
  function cardSpec(id) {
    const [kind, a, b] = id.split(':');
    const l = A.LESSON[a];
    if (!l) return null;
    if (kind === 'r' && l.remember) return { id, kind: 'flip', label: 'Remember', front: `**${l.title}**: what is the one thing to remember?`, back: l.remember, link: '#/l/' + a };
    if (kind === 'c' && l.cue) { const [x, y] = splitCue(l.cue); return { id, kind: 'flip', label: 'Cue', front: x ? `When you see: ${x}` : `The cue from **${l.title}**`, back: x ? `Reach for: **${y}**` : y, link: '#/l/' + a }; }
    if (kind === 'q' && (l.quiz || [])[+b]) return { id, kind: 'quiz', label: 'Quiz', q: l.quiz[+b], link: '#/l/' + a };
    if (kind === 'd' && (l.defend || [])[+b]) { const d = l.defend[+b]; return { id, kind: 'flip', label: 'Defend it', front: `${d.q} Say the outline out loud.`, back: (d.strong || []).map((s) => `- ${s}`).join('\n'), link: '#/l/' + a }; }
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
    (l.quiz || []).forEach((q, n) => addCard(`q:${l.id}:${n}`, 3));
    A.save();
  }
  function seedDrill(did, rate) {
    const id = 'd:' + did, st = S();
    const days = rate === 'missed' ? 1 : rate === 'shaky' ? 2 : 6;
    st.cards[id] = { due: Date.now() + days * DAY - 3 * 3600000, ivl: days, reps: rate === 'solid' ? 1 : 0, at: Date.now() };
    A.save();
  }
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
  window.LabToday = { seedLesson, seedDrill, dueCount: () => dueCards().length, rate, addCard };

  /* ───────────── Recognition drill ───────────── */
  function weakness(topic) {
    const b = S().drill.by[topic] || [0, 0];
    return b[1] ? 1 - b[0] / b[1] : 0.5;
  }
  function pickDrill(pool, avoid = new Set()) {
    const cand = pool.filter((q) => !avoid.has(q.q));
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

  /* ───────────── Home ───────────── */
  PAGES.home = (root) => {
    const nx = A.nextItem();
    const due = dueCards().length;
    const total = A.ITEMS.length, done = A.ITEMS.filter((x) => A.isDone(x.id)).length;
    const rated = A.DRILLS.filter((x) => S().defend[x.id]).length;
    const cta = nx
      ? `<a class="btn primary big" href="${A.hrefOf(nx.it)}">${nx.resume ? 'Continue' : done ? 'Next' : 'Start'}: ${inline(nx.it.data.title)} <small>· ${A.itemMins(nx.it)} min</small></a>`
      : '<span class="btn good big">Every lesson done ✓</span>';
    root.innerHTML = `
      <section class="hero">
        <div>
          <div class="eyebrow">A quick look at backend systems</div>
          <h1>What your service does when things go wrong.</h1>
          <p class="lede">Timeouts, retries, caches, queues, databases and drift: the questions that decide senior backend interviews, each taught as a mechanism you can run. Every lesson has a simulator to break things in, and interview drills to defend your answer against the follow-ups.</p>
          <div class="cta">${cta}${due ? `<a class="btn warn" href="#/today">Today's review · ${due} card${due === 1 ? '' : 's'} · 5 min</a>` : ''}</div>
          ${nx ? `<p class="small next-why">${nx.resume ? 'Picks up exactly where you stopped.' : 'The next unfinished lesson.'}</p>` : ''}
        </div>
        <div class="stats">
          <div class="stat"><small>Lessons</small><b>${done}<span class="of"> / ${total}</span></b><div class="diffbar"><i style="width:${(100 * done) / Math.max(1, total)}%;background:var(--good)"></i></div><span>read</span></div>
          <div class="stat"><small>Today</small><b>${due}</b><span>${due ? 'cards due, about 5 minutes' : Object.keys(S().cards).length ? 'nothing due, nice' : 'cards appear as you finish lessons'}</span></div>
          <div class="stat wide"><small>Interview drills</small><b>${rated}<span class="of"> / ${A.DRILLS.length}</span></b><span>answered and rated · <a href="#/mock">take a mock round</a></span></div>
        </div>
      </section>
      <div class="onething">
        <small>The one thing to remember</small>
        <p>A timeout tells the caller only that <b>it stopped waiting</b>. The server may have done nothing, finished the work, or still be doing it. Nearly every question in this lab is about building systems that stay correct when the caller cannot tell which.</p>
      </div>
      <h2 class="section-h">Modules</h2>
      <div class="mod-grid">${A.MODS.map((m) => { const s = A.modStats(m); return `<a class="mod-card" href="#/m/${m.id}"><span class="n">${String(m.n).padStart(2, '0')}</span><h3>${esc(m.title)}</h3><p>${inline(m.blurb || '')}</p><div class="bar"><i style="width:${s.n ? (100 * s.d) / s.n : 0}%"></i></div><small>${s.d}/${s.n} lessons · about ${s.mins} min</small></a>`; }).join('')}
      </div>`;
  };

  /* ───────────── Today: the 5-minute review ───────────── */
  let session = null;
  function buildSession() {
    const due = dueCards().slice(0, 8).map((id) => ({ type: 'card', id }));
    const pool = BL.drill, avoid = new Set(), drills = [];
    for (let k = 0; k < Math.min(due.length >= 5 ? 2 : 4, 8 - due.length); k++) { const q = pickDrill(pool, avoid); if (!q) break; avoid.add(q.q); drills.push({ type: 'drill', q }); }
    const items = [...due];
    drills.forEach((d, k) => items.splice(Math.min(items.length, 1 + k * 2), 0, d));
    return { items: items.slice(0, 8), k: 0, shown: false, pick: null, start: Date.now() };
  }
  function mcq(q, s, attr) {
    return `<div class="choice-grid one">${q.options.map((o, k) => `<button class="choice ${s.shown ? (k === q.answer ? 'right' : k === s.pick ? 'wrong' : '') : ''}" ${attr}="${k}" ${s.shown ? 'disabled' : ''}>${inline(o)}</button>`).join('')}</div>`;
  }
  PAGES.today = (root) => {
    if (!session || session.finished) session = buildSession();
    const draw = () => {
      const s = session, n = s.items.length;
      if (!n) { root.innerHTML = `<div class="eyebrow">Daily</div><h1>Today's review</h1><p class="lede">Nothing to review yet. Cards appear as you finish lessons and rate interview drills: they come back a day later, then at growing intervals.</p>${nextBlock()}`; return; }
      if (s.k >= n) {
        s.finished = true;
        const mins = Math.max(1, Math.round((Date.now() - s.start) / 60000));
        A.markDay(); A.save(); A.renderChips(); A.renderNav();
        root.innerHTML = `<div class="eyebrow">Daily</div><h1>Done for today ✓</h1><p class="lede">${n} card${n === 1 ? '' : 's'} in about ${mins} minute${mins === 1 ? '' : 's'}. The cards come back just before you would forget them.</p>${nextBlock()}<p><button class="btn quiet" data-t="more">Another round</button> <a class="btn" href="#/mock">A mock interview round</a></p>`;
        $('[data-t=more]', root).onclick = () => { session = buildSession(); draw(); };
        return;
      }
      const it = s.items[s.k];
      const bar = `<div class="today-bar"><span>Card ${s.k + 1} of ${n}</span><div class="unitbar">${s.items.map((_, j) => `<i class="${j < s.k ? 'done' : ''} ${j === s.k ? 'here' : ''}"></i>`).join('')}</div></div>`;
      const next = '<button class="btn primary" data-t="next">Next →</button>';
      let card;
      if (it.type === 'drill') {
        const q = it.q;
        card = `<div class="tcard"><small class="tlabel">Recognise it</small><p class="front">${inline(q.q)}</p>${mcq(q, s, 'data-o')}${s.shown ? `<div class="drill-why"><b>${s.pick === q.answer ? '✓ Right.' : '✗ Not quite.'}</b> ${inline(q.why)}</div>${next}` : ''}</div>`;
      } else {
        const c = cardSpec(it.id);
        if (c.kind === 'quiz') card = `<div class="tcard"><small class="tlabel">${esc(c.label)}</small><p class="front">${inline(c.q.q)}</p>${mcq(c.q, s, 'data-qo')}${s.shown ? `<div class="drill-why">${md(c.q.why)}</div>${next}` : ''}</div>`;
        else card = `<div class="tcard"><small class="tlabel">${esc(c.label)}</small><p class="front">${inline(c.front)}</p>${s.shown ? `<div class="back">${md(c.back)}</div><div class="rate-row"><span>How well did you remember it?</span>${[['again', 'Forgot', 'tomorrow'], ['hard', 'Hard', 'soon'], ['good', 'Got it', 'in a few days'], ['easy', 'Easy', 'in a week+']].map(([k, t, sub]) => `<button class="btn ${k === 'good' ? 'primary' : ''}" data-r="${k}">${t}<span class="k">${sub}</span></button>`).join('')}</div><a class="small" href="${c.link}">Open the lesson</a>` : '<button class="btn primary" data-t="show">Show answer <span class="k">space</span></button>'}</div>`;
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
      if (e.target.closest('input,textarea,select')) return;
      const s = session; if (!s || s.finished) return;
      if (e.key === ' ' && !s.shown && $('[data-t=show]', root)) { e.preventDefault(); $('[data-t=show]', root).click(); }
      if (e.key === 'Enter') { const b = $('[data-t=next]', root); if (b) b.click(); }
      if (/^[1-4]$/.test(e.key)) { const b = $$('[data-r],[data-o],[data-qo]', root).filter((x) => !x.disabled)[+e.key - 1]; if (b) b.click(); }
    };
    document.addEventListener('keydown', key);
    draw();
  };
  function nextBlock() {
    const nx = A.nextItem();
    return nx ? `<div class="next-card"><div class="nc-left"><small>Your next step</small><a class="nc-title" href="${A.hrefOf(nx.it)}">${inline(nx.it.data.title)}</a><span class="nc-meta">Lesson · about ${A.itemMins(nx.it)} min</span></div><div class="nc-right"><a class="btn primary" href="${A.hrefOf(nx.it)}">Go →</a></div></div>` : '';
  }

  /* ───────────── Mock round: interview drills, weighted toward the weak ones ───────────── */
  PAGES.mock = (root) => {
    const pickNext = (avoid) => {
      const read = A.DRILLS.filter((x) => S().read[x.lesson.id]);
      const pool = (read.length >= 3 ? read : A.DRILLS).filter((x) => x.id !== avoid);
      const w = (x) => { const r = S().defend[x.id]; return !r ? 3 : r.rate === 'missed' ? 4 : r.rate === 'shaky' ? 2.5 : 0.6; };
      let r = Math.random() * pool.reduce((a, x) => a + w(x), 0), k = 0;
      while (k < pool.length - 1 && r > w(pool[k])) { r -= w(pool[k]); k++; }
      return pool[k];
    };
    let cur = pickNext(null);
    const draw = () => {
      const counts = { solid: 0, shaky: 0, missed: 0 };
      for (const v of Object.values(S().defend)) counts[v.rate] = (counts[v.rate] || 0) + 1;
      root.innerHTML = `
        <div class="eyebrow">Practice</div><h1>Mock round</h1>
        <p class="lede">One interview question at a time, the way it is really asked: answer aloud, then face the follow-ups. Questions you rated <b>Missed it</b> or <b>Shaky</b> come up more often; questions from lessons you have read come first.</p>
        <div class="round-bar"><span>${A.DRILLS.length} questions</span><span class="good">✓ ${counts.solid} solid</span><span class="warn">! ${counts.shaky} shaky</span><span class="bad">✕ ${counts.missed} missed</span><button class="btn" data-mock="next">Another question →</button></div>
        ${cur ? A.defendHtml(cur.id, { page: true }) : '<p>No questions yet.</p>'}`;
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mock]');
      if (b) { cur = pickNext(cur && cur.id); draw(); root.scrollIntoView(); }
    });
    draw();
  };

  /* ───────────── Drill ───────────── */
  let drill = null;
  PAGES.drill = (root) => {
    const pool = BL.drill, st = S().drill;
    const next = () => { drill = { q: pickDrill(pool, new Set(drill && drill.q ? [drill.q.q] : [])), answered: false }; draw(); };
    const draw = () => {
      if (!drill.q) { root.innerHTML = '<div class="eyebrow">Practice</div><h1>Recognition drill</h1><p class="lede">No questions yet.</p>'; return; }
      const { q, answered, pick } = drill;
      root.innerHTML = `
        <div class="eyebrow">Practice</div><h1>Recognition drill</h1>
        <p class="lede">Fast recognition: a symptom and its likely cause, a setting and its default, a pattern and when it breaks. Questions lean toward the topics you miss.</p>
        <div class="drill-bar"><span>Score <b>${st.right}/${st.n}</b></span></div>
        <div class="drill-card">
          <p class="prompt">${inline(q.q)}</p>
          <div class="choice-grid one">${q.options.map((o, k) => `<button class="choice ${answered ? (k === q.answer ? 'right' : k === pick ? 'wrong' : '') : ''}" data-o="${k}" ${answered ? 'disabled' : ''}>${inline(o)}</button>`).join('')}</div>
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
      if (e.target.closest('input,textarea,select')) return;
      if (e.key === 'Enter' && drill && drill.answered) next();
      if (/^[1-4]$/.test(e.key) && drill && !drill.answered) { const b = $$('.choice', root)[+e.key - 1]; if (b) b.click(); }
    };
    document.addEventListener('keydown', key);
    next();
  };

  /* ───────────── Cheat sheets ───────────── */
  PAGES.cheats = (root, arg) => {
    const sheets = BL.cheats || [];
    const cur = sheets.find((s) => s.id === arg);
    if (!cur) {
      root.innerHTML = `
        <div class="eyebrow">Reference</div><h1>Cheat sheets</h1>
        <p class="lede">One page each, for rereading before an interview. They print cleanly too (Ctrl/⌘ + P).</p>
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
  PAGES.quizFor = (lid) => { const s = (BL.cheats || []).find((x) => 'cheat-' + x.id === lid); return s && s.quiz; };

  /* ───────────── Setup ───────────── */
  PAGES.setup = (root) => {
    const draw = () => {
      const sync = window.LabSync ? window.LabSync.status() : { state: 'off' };
      const configured = window.LabSync && window.LabSync.configured();
      const pill = (ok, t) => `<span class="pill ${ok === true ? 'ok' : ok === false ? 'no' : 'wait'}">${t}</span>`;
      root.innerHTML = `
        <div class="eyebrow">Setup</div><h1>Setup</h1>
        <p class="lede">Nothing to install. The simulators run in this page, so everything works offline once loaded.</p>
        <div class="prose">
          <h2 style="border:0;padding-top:0">Cloud sync ${pill(sync.state === 'synced' ? true : sync.state === 'error' ? false : null, !configured ? 'not set up' : sync.state === 'synced' ? 'on' : sync.state === 'syncing' ? 'syncing' : sync.state === 'error' ? 'problem' : 'signed out')}</h2>
          ${configured ? `
            <p>Sign in with Google to keep lessons read, quiz answers, drill ratings and review cards in step across your devices. Your data lives in a private Firebase database that only your account can read.</p>
            ${sync.email ? `<p>Signed in as <b>${esc(sync.email)}</b>${sync.at ? ` · last synced ${A.ago(sync.at)}` : ''}.</p><p><button class="btn" data-s="now">Sync now</button> <button class="btn quiet" data-s="out">Sign out</button></p>` : '<p><button class="btn primary" data-s="in">Sign in with Google</button></p>'}
            ${sync.error ? `<div class="callout warn"><b>Sync problem</b><p>${esc(sync.error)}</p></div>` : ''}` : '<p>Not configured on this copy. The deploy workflow writes the config from the <code>LAB_FIREBASE</code> repository secret; for a local copy, fill in <code>shared/sync-config.example.js</code> and save it as <code>shared/sync-config.js</code> (gitignored).</p>'}
          <h2>The simulators</h2>
          <p>Each simulator is a small, seeded model written for this lab: the same settings always give the same result, and the tests in <code>backend/test/</code> pin the behaviour each lesson describes. They are models of mechanisms, not benchmarks of any product.</p>
          <h2>Focus mode</h2>
          <p>The <b>◎</b> button in the top bar hides the outline and everything else except the current lesson. <b>Esc</b> leaves it.</p>
        </div>`;
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
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
      lab: 'backend',
      getState: () => A.syncable(),
      merge: (a, b) => A.mergeState(a, b),
      apply: (cloud) => A.applyMerged(cloud),
      subscribe: (fn) => A.listeners.add(fn),
    });
  }

  A.start();
})();
