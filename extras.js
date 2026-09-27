/* LLD Lab pages: home, today's 5-minute review, pattern map, drill, cheat sheets, setup.
 * Also owns the review cards (spaced repetition) and wires cloud sync into the page. */
(function () {
  'use strict';
  const A = window.LLDApp, L = window.LLD, E = window.LLDEngine;
  const { esc, inline, md, PAGES } = A;
  const S = () => A.S;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const DAY = 86400000;
  const PATTERNS = L.patterns || {};
  const FAMILIES = L.families || {};

  /* ───────────── Review cards (spaced repetition) ─────────────
   * Card ids: r:<lesson> remember line · c:<lesson> cue card · q:<lesson>:<n> quiz · x:<exercise> recall
   * S.cards[id] = { due, ivl (days), reps, at } */
  function splitCue(cue) {
    const k = String(cue).lastIndexOf('→');
    return k > 0 ? [cue.slice(0, k).trim(), cue.slice(k + 1).trim()] : [null, cue];
  }
  function cardSpec(id) {
    const [kind, a, b] = id.split(':');
    if (kind === 'r' && A.LESSON[a] && A.LESSON[a].remember) { const l = A.LESSON[a]; return { id, kind: 'flip', label: 'Remember', front: `**${l.title}**: what is the one thing to remember?`, back: l.remember, link: '#/l/' + a }; }
    if (kind === 'c' && A.LESSON[a] && A.LESSON[a].cue) { const l = A.LESSON[a]; const [x, y] = splitCue(l.cue); return { id, kind: 'flip', label: 'Cue', front: x ? `When you see: *${x}*` : `The cue from **${l.title}**`, back: x ? `Reach for: **${y}**` : y, link: '#/l/' + a }; }
    if (kind === 'q' && A.LESSON[a] && (A.LESSON[a].quiz || [])[+b]) { return { id, kind: 'quiz', label: 'Quiz', q: A.LESSON[a].quiz[+b], link: '#/l/' + a }; }
    if (kind === 'x' && A.EX[a] && A.EX[a].solution && A.EX[a].solution.talk) { const x = A.EX[a]; return { id, kind: 'flip', label: 'Recall', front: `**${x.title}**: how would you explain your design in 30 seconds?`, back: x.solution.talk, link: '#/x/' + a }; }
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
  window.LLDToday = { seedLesson, seedExercise, dueCount: () => dueCards().length, rate, addCard };

  /* ───────────── Drill pool: "which pattern fits?" ───────────── */
  function drillPool() {
    const pool = (L.drill || []).filter((d) => PATTERNS[d.pattern]);
    for (const [k, p] of Object.entries(PATTERNS)) if (p.tier <= 2 && p.cue) pool.push({ prompt: p.cue, pattern: k, why: p.one, fromCue: true });
    return pool;
  }
  function weakness(p) {
    const st = S();
    const w = st.weak[p] ? st.weak[p].n : 0;
    const b = st.drill.by[p] || [0, 0];
    const miss = b[1] ? 1 - b[0] / b[1] : 0.5;
    return w + 2 * miss + (PATTERNS[p] && PATTERNS[p].tier === 1 ? 0.5 : 0);
  }
  function pickDrill(pool, avoid = new Set()) {
    const cand = pool.filter((q) => !avoid.has(q.prompt));
    const list = cand.length ? cand : pool;
    const weights = list.map((q) => 0.3 + weakness(q.pattern));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0), k = 0;
    while (k < list.length - 1 && r > weights[k]) { r -= weights[k]; k++; }
    return list[k];
  }
  function drillOptions(q) {
    const p = PATTERNS[q.pattern];
    const confuse = (p.confuse || []).filter((x) => PATTERNS[x]);
    const others = Object.keys(PATTERNS).filter((x) => x !== q.pattern && !confuse.includes(x) && PATTERNS[x].tier <= 2).sort(() => Math.random() - 0.5);
    return [q.pattern, ...confuse.sort(() => Math.random() - 0.5).slice(0, 2), ...others].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4).sort(() => Math.random() - 0.5);
  }
  function recordDrill(pattern, right) {
    const st = S();
    st.drill.n++; if (right) st.drill.right++;
    const b = st.drill.by[pattern] || [0, 0]; b[1]++; if (right) b[0]++; st.drill.by[pattern] = b;
    A.save();
  }

  /* ───────────── Home ───────────── */
  PAGES.home = (root) => {
    const st = S();
    const nx = A.nextItem();
    const due = dueCards().length;
    const total = A.ITEMS.length, done = A.ITEMS.filter((x) => A.isDone(x.id)).length;
    const weak = Object.entries(st.weak).filter(([p, w]) => PATTERNS[p] && w.n > 0).sort((a, b) => b[1].n - a[1].n).slice(0, 3);
    const cta = nx
      ? `<a class="btn primary big" href="${A.hrefOf(nx.it)}">${nx.resume ? 'Continue' : done ? 'Next' : 'Start'}: ${esc(nx.it.data.title)} <small>· ${A.itemMins(nx.it)} min</small></a>`
      : '<span class="btn good big">Course complete ✓</span>';
    root.innerHTML = `
      <section class="hero lld">
        <div>
          <div class="eyebrow">Interview prep · Java · LLD</div>
          <h1>Low-level design, one pattern at a time.</h1>
          <p class="lede">Short steps of 5 to 12 minutes. Every lesson starts with the one thing to remember, and a 5-minute daily review keeps it from leaking out. Code runs in your browser; Claude reviews your designs.</p>
          <div class="cta">${cta}${due ? `<a class="btn warn" href="#/today">Today's review · ${due} card${due === 1 ? '' : 's'} · 5 min</a>` : ''}</div>
          ${nx ? `<p class="small next-why">${nx.resume ? 'Picks up exactly where you stopped.' : 'The next unfinished step in the course.'}</p>` : ''}
        </div>
        <div class="stats">
          <div class="stat"><small>Progress</small><b>${done}<span class="of"> / ${total}</span></b><div class="diffbar"><i style="width:${(100 * done) / Math.max(1, total)}%;background:var(--good)"></i></div><span>steps done</span></div>
          <div class="stat"><small>Today</small><b>${due}</b><span>${due ? 'cards due, about 5 minutes' : Object.keys(st.cards).length ? 'nothing due, nice' : 'cards appear as you finish lessons'}</span></div>
          ${weak.length ? `<div class="stat wide"><small>Practise next</small><span class="weak">${weak.map(([p]) => `<a href="${PATTERNS[p].lesson ? '#/l/' + PATTERNS[p].lesson : '#/patterns'}">${esc(PATTERNS[p].label)}</a>`).join(' · ')}</span><span>flagged by your reviews and drills</span></div>` : ''}
        </div>
      </section>
      <div class="onething">
        <small>The one thing to remember</small>
        <p>Nearly every useful pattern is one of <b>four moves</b>: swap it, wrap it, pass it on, or build it. Learn the move first; the pattern names follow.</p>
        <div class="fam-row">${['swap', 'wrap', 'pass', 'build'].map((f) => A.familyCard(f)).join('')}</div>
        <a class="small" href="#/patterns">Open the pattern map →</a>
      </div>
      <h2 class="section-h">Modules</h2>
      <div class="mod-grid">${A.MODS.map((m) => { const s = A.modStats(m); return `<a class="mod-card" href="#/m/${m.id}"><span class="n">${String(m.n).padStart(2, '0')}</span><h3>${esc(m.title)}</h3><p>${inline(m.blurb || '')}</p><div class="bar"><i style="width:${s.n ? (100 * s.d) / s.n : 0}%"></i></div><small>${s.d}/${s.n} steps · about ${m.units.reduce((a, u) => a + (u.mins || (A.LESSON[u.id] === u ? 6 : 12)), 0)} min</small></a>`; }).join('')}</div>`;
  };

  /* ───────────── Today: the 5-minute review ───────────── */
  let session = null;
  function buildSession() {
    const due = dueCards().slice(0, 8).map((id) => ({ type: 'card', id }));
    const pool = drillPool();
    const room = Math.max(0, (due.length >= 5 ? 2 : 6) - 0);
    const avoid = new Set();
    const drills = [];
    for (let k = 0; k < Math.min(room, 8 - due.length); k++) { const q = pickDrill(pool, avoid); if (!q) break; avoid.add(q.prompt); drills.push({ type: 'drill', q, opts: drillOptions(q) }); }
    const items = [...due];
    drills.forEach((d, k) => items.splice(Math.min(items.length, 1 + k * 2), 0, d));   // interleave
    return { items: items.slice(0, 8), k: 0, right: 0, shown: false, pick: null, start: Date.now() };
  }
  PAGES.today = (root) => {
    if (!session || session.finished) session = buildSession();
    const draw = () => {
      const s = session;
      const n = s.items.length;
      if (!n) {
        root.innerHTML = `<div class="eyebrow">Daily</div><h1>Today's review</h1><p class="lede">Nothing to review yet. Cards appear as you finish lessons: each lesson's "remember this" line and cue card come back here a day later, then at growing intervals.</p>${nextBlock()}`;
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
      if (it.type === 'drill') {
        const q = it.q, p = PATTERNS[q.pattern];
        card = `<div class="tcard"><small class="tlabel">Which pattern?</small><p class="front">${inline(q.prompt)}</p><div class="choice-grid">${it.opts.map((o) => `<button class="choice ${s.shown ? (o === q.pattern ? 'right' : o === s.pick ? 'wrong' : '') : ''}" data-o="${o}" ${s.shown ? 'disabled' : ''}>${esc(PATTERNS[o].label)}</button>`).join('')}</div>${s.shown ? `<div class="drill-why"><b>${s.pick === q.pattern ? '✓ Right.' : `It's ${esc(p.label)}.`}</b> ${inline(q.why || p.one)}</div><button class="btn primary" data-t="next">Next →</button>` : ''}</div>`;
      } else {
        const c = cardSpec(it.id);
        if (c.kind === 'quiz') {
          const q = c.q;
          card = `<div class="tcard"><small class="tlabel">${esc(c.label)}</small><p class="front">${inline(q.q)}</p><div class="choice-grid one">${q.options.map((o, k) => `<button class="choice ${s.shown ? (k === q.answer ? 'right' : k === s.pick ? 'wrong' : '') : ''}" data-qo="${k}" ${s.shown ? 'disabled' : ''}>${inline(o)}</button>`).join('')}</div>${s.shown ? `<div class="drill-why">${md(q.why)}</div><button class="btn primary" data-t="next">Next →</button>` : ''}</div>`;
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
      if (o && !s.shown) { s.pick = o.dataset.o; s.shown = true; recordDrill(it.q.pattern, s.pick === it.q.pattern); draw(); return; }
      const qo = e.target.closest('[data-qo]');
      if (qo && !s.shown) { const c = cardSpec(it.id); s.pick = +qo.dataset.qo; s.shown = true; rate(it.id, s.pick === c.q.answer ? 'good' : 'again'); draw(); return; }
      const r = e.target.closest('[data-r]');
      if (r) { rate(it.id, r.dataset.r); next(); }
    });
    const key = (e) => {
      if (location.hash !== '#/today') { document.removeEventListener('keydown', key); return; }
      if (e.target.closest('input,textarea,select,.CodeMirror')) return;
      const s = session; if (!s || s.finished) return;
      if (e.key === ' ' && !s.shown && s.items[s.k] && s.items[s.k].type === 'card') { e.preventDefault(); const b = $('[data-t=show]', root); if (b) b.click(); }
      if (e.key === 'Enter') { const b = $('[data-t=next]', root); if (b) b.click(); }
      if (/^[1-4]$/.test(e.key)) { const b = $$('[data-r],[data-o],[data-qo]', root).filter((x) => !x.disabled)[+e.key - 1]; if (b) b.click(); }
    };
    document.addEventListener('keydown', key);
    draw();
  };
  function nextBlock() {
    const nx = A.nextItem();
    return nx ? `<div class="next-card"><div class="nc-left"><small>Your next step</small><a class="nc-title" href="${A.hrefOf(nx.it)}">${esc(nx.it.data.title)}</a><span class="nc-meta">${nx.it.kind === 'lesson' ? 'Lesson' : A.kindLabel(nx.it.data)} · about ${A.itemMins(nx.it)} min</span></div><div class="nc-right"><a class="btn primary" href="${A.hrefOf(nx.it)}">Go →</a></div></div>` : '';
  }

  /* ───────────── Pattern map ───────────── */
  PAGES.patterns = (root) => {
    const byFam = (f, tier) => Object.entries(PATTERNS).filter(([, p]) => p.family === f && p.tier === tier);
    root.innerHTML = `
      <div class="eyebrow">Reference</div><h1>The pattern map</h1>
      <p class="lede">23 patterns, but only 12 are worth learning properly, and they fall into four moves. Learn the <b>core 6</b> first. The <b>next 6</b> you only need to recognise by their cue. The rest: know the name.</p>
      <div class="fam-cols">${['swap', 'wrap', 'pass', 'build'].map((f) => `
        <section class="fam-col ${f}">
          <h2>${esc(FAMILIES[f].label)}</h2><p class="small">${inline(FAMILIES[f].one)}</p>
          ${byFam(f, 1).map(([k]) => A.patternCard(k)).join('')}
          ${byFam(f, 2).map(([k]) => A.patternCard(k)).join('')}
          ${byFam(f, 3).length ? `<details class="t3"><summary>Recognise only (${byFam(f, 3).length})</summary>${byFam(f, 3).map(([k]) => A.patternCard(k)).join('')}</details>` : ''}
        </section>`).join('')}</div>
      <div class="prose" style="margin-top:28px">${md(L.mapNotes || '')}</div>`;
  };

  /* ───────────── Drill ───────────── */
  let drill = null;
  PAGES.drill = (root) => {
    const pool = drillPool();
    const st = S().drill;
    const next = () => { const q = pickDrill(pool, new Set(drill && drill.q ? [drill.q.prompt] : [])); drill = { q, opts: drillOptions(q), answered: false }; draw(); };
    const draw = () => {
      const { q, opts, answered, pick } = drill;
      const p = PATTERNS[q.pattern];
      root.innerHTML = `
        <div class="eyebrow">Tool</div><h1>Pattern drill</h1>
        <p class="lede">Read the situation, name the pattern. Questions lean toward the patterns you miss and the ones your reviews flagged.</p>
        <div class="drill-bar"><span>Score <b>${st.right}/${st.n}</b></span><span style="margin-left:auto"><button class="btn sm quiet" data-d="stats">Accuracy by pattern</button></span></div>
        <div class="drill-card">
          <p class="prompt"><small>Which pattern fits?</small>${inline(q.prompt)}</p>
          <div class="choice-grid">${opts.map((o) => `<button class="choice ${answered ? (o === q.pattern ? 'right' : o === pick ? 'wrong' : '') : ''}" data-o="${o}" ${answered ? 'disabled' : ''}>${esc(PATTERNS[o].label)}</button>`).join('')}</div>
          ${answered ? `<div class="drill-why"><b>${pick === q.pattern ? '✓ Right.' : `✗ It's ${esc(p.label)}.`}</b> ${inline(q.why || p.one)}${p.lesson && A.LESSON[p.lesson] ? ` <a href="#/l/${p.lesson}">Lesson →</a>` : ''}</div><div style="margin-top:12px"><button class="btn primary" data-d="next">Next →</button> <span class="small">or press Enter</span></div>` : ''}
        </div>
        <div class="drill-stats" hidden></div>`;
    };
    root.addEventListener('click', (e) => {
      const o = e.target.closest('[data-o]');
      if (o && drill && !drill.answered) { drill.answered = true; drill.pick = o.dataset.o; recordDrill(drill.q.pattern, drill.pick === drill.q.pattern); draw(); }
      const d = e.target.closest('[data-d]');
      if (d && d.dataset.d === 'next') next();
      if (d && d.dataset.d === 'stats') {
        const box = $('.drill-stats', root); box.hidden = !box.hidden;
        const rows = Object.entries(PATTERNS).map(([k, p]) => ({ p, b: st.by[k] || [0, 0] })).filter((x) => x.b[1]).sort((x, y) => x.b[0] / x.b[1] - y.b[0] / y.b[1]);
        box.innerHTML = rows.length ? `<div class="prose"><table class="t"><thead><tr><th>Pattern</th><th>Right</th><th>Accuracy</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.p.label)}</td><td>${x.b[0]}/${x.b[1]}</td><td>${Math.round((100 * x.b[0]) / x.b[1])}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="small">Answer a few first.</p>';
      }
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
    const sheets = L.cheats || [];
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
  PAGES.quizFor = (lid) => { const s = (L.cheats || []).find((x) => 'cheat-' + x.id === lid); return s && s.quiz; };

  /* ───────────── Setup ───────────── */
  PAGES.setup = (root) => {
    const draw = () => {
      const l = E.Local, c = l.claude;
      const sync = window.LabSync ? window.LabSync.status() : { state: 'off' };
      const configured = window.LabSync && window.LabSync.configured();
      const win = /Windows/i.test(navigator.userAgent);
      const loginCmd = win ? 'Get-ChildItem "$env:APPDATA\\Claude\\claude-code\\*\\claude.exe" | Select-Object -Last 1 | ForEach-Object { & $_.FullName auth login }' : 'claude auth login';
      const pill = (ok, t) => `<span class="pill ${ok === true ? 'ok' : ok === false ? 'no' : 'wait'}">${t}</span>`;
      root.innerHTML = `
        <div class="eyebrow">Setup</div><h1>Setup</h1>
        <p class="lede">Everything works in the browser with no setup. These three extras are optional.</p>
        <div class="prose">
          <h2 style="border:0;padding-top:0">1. Your JDK runner ${pill(l.state === 'ready', l.state === 'ready' ? 'connected' : l.state === 'unpaired' ? 'not paired' : 'not running')}</h2>
          <p>Needed for the concurrency exercises (real threads) and for Claude reviews. Needs a JDK 17+ and Node.js 18+. From the <code>learn-lld</code> folder:</p>
          ${A.codeBlock('node runner/server.mjs', { lang: 'text', label: 'terminal' })}
          <p>Open the link it prints. <code>http://localhost:8789/</code> comes paired; the <code>#pair=…</code> link pairs this hosted site once.</p>
          <h2>2. Claude reviews ${pill(c ? (c.found && c.loggedIn) : null, !c ? 'needs the runner' : !c.found ? 'CLI not found' : c.loggedIn ? 'ready' : 'sign in needed')}</h2>
          <p>The runner asks the Claude Code CLI (it ships with the Claude desktop app) to review your code, with every tool switched off, so a review can only return text. It uses your Claude plan. Sign the CLI in once:</p>
          ${A.codeBlock(loginCmd, { lang: 'text', label: win ? 'PowerShell' : 'terminal' })}
          <p><button class="btn" data-s="recheck">Check again</button> <span class="small">Without the runner, every exercise has a <b>Copy for Claude</b> button instead.</span></p>
          <h2>3. Cloud sync ${pill(sync.state === 'synced' ? true : sync.state === 'error' ? false : null, !configured ? 'not set up' : sync.state === 'synced' ? 'on' : sync.state === 'syncing' ? 'syncing' : sync.state === 'error' ? 'problem' : 'signed out')}</h2>
          ${configured ? `
            <p>Sign in with Google to keep progress, code, reviews and review cards in step across your devices. Your data lives in a private Firebase database that only your account can read.</p>
            ${sync.email ? `<p>Signed in as <b>${esc(sync.email)}</b>${sync.at ? ` · last synced ${A.ago(sync.at)}` : ''}.</p><p><button class="btn" data-s="now">Sync now</button> <button class="btn quiet" data-s="out">Sign out</button></p>` : '<p><button class="btn primary" data-s="in">Sign in with Google</button></p>'}
            ${sync.error ? `<div class="callout warn"><b>Sync problem</b><p>${esc(sync.error)}</p></div>` : ''}` : `
            <p>Not configured yet. The site owner creates a free Firebase project (Spark plan, no card), turns on Google sign-in, adds <code>anadi198.github.io</code> to the authorized domains, creates a Firestore database, publishes <code>firestore.rules</code>, and pastes the web config into <code>sync-config.js</code>.</p>`}
          <h2>Focus mode</h2>
          <p>The <b>◎</b> button in the top bar hides the outline and everything else except the current step. <b>Esc</b> leaves it.</p>
        </div>`;
    };
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'recheck') { b.disabled = true; try { await fetch(E.Local.base + '/api/hello?recheck', { headers: { 'x-lldlab-token': E.token() } }); } catch { /* not running */ } await E.Local.check(); draw(); }
      if (b.dataset.s === 'in') window.LabSync.signIn();
      if (b.dataset.s === 'out') window.LabSync.signOut();
      if (b.dataset.s === 'now') window.LabSync.syncNow();
    });
    const off = window.LabSync ? window.LabSync.onStatus(() => { if (location.hash.startsWith('#/setup')) draw(); else off(); }) : null;
    E.Local.check().then(() => { if (location.hash.startsWith('#/setup')) draw(); });
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
      lab: 'lld',
      getState: () => A.syncable(),
      merge: (a, b) => A.mergeState(a, b),
      apply: (cloud) => A.applyMerged(cloud),
      subscribe: (fn) => A.listeners.add(fn),
    });
  }

  A.start();
})();
