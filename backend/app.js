/* Backend Lab: routing, outline, lessons, quizzes, simulators, interview drills ("Defend it"), progress. */
(function () {
  'use strict';
  const BL = window.BL, V = window.LabViz, HL = window.LabHighlight, SIM = window.SimUI;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = HL.esc;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const narrow = () => matchMedia('(max-width: 920px)').matches;

  /* ───────────── State ─────────────
   * Everything that syncs carries a timestamp so two devices can merge (see mergeState). */
  const KEY = 'backendlab.v1';
  const blank = () => ({
    v: 1, read: {}, quiz: {}, cards: {}, defend: {}, days: {}, last: null,
    drill: { n: 0, right: 0, by: {} },
    // device-only
    open: {}, focus: false,
  });
  let S;
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch { S = blank(); }
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* full or blocked */ } };
  const save = debounce(() => { persist(); for (const f of listeners) f(); }, 250);
  const saveNow = () => { persist(); for (const f of listeners) f(); };
  window.addEventListener('beforeunload', persist);

  /* ───────────── Content index ───────────── */
  const MODS = BL.modules;
  const ITEMS = [], LESSON = {}, MOD = {};
  MODS.forEach((m, mi) => {
    m.n = mi; MOD[m.id] = m; m.lessons = [];
    for (const it of m.items) {
      const l = { ...it, id: it.lesson, module: m };
      LESSON[l.id] = l; m.lessons.push(l); ITEMS.push({ kind: 'lesson', id: l.id, data: l, module: m });
    }
  });
  const DRILLS = [];   // every "Defend it" round: { id: 'lesson:n', lesson, d }
  for (const l of Object.values(LESSON)) (l.defend || []).forEach((d, n) => DRILLS.push({ id: `${l.id}:${n}`, lesson: l, d }));
  const hrefOf = (it) => `#/l/${it.id}`;
  const isDone = (id) => !!S.read[id];
  const itemMins = (it) => it.data.mins || 8;

  /* ───────────── Mini Markdown ───────────── */
  function dedent(src) {
    const lines = String(src).replace(/\r/g, '').split('\n');
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
    return lines.map((l) => l.slice(Math.min(ind, /^ */.exec(l)[0].length)));
  }
  function inline(s) {
    const parts = String(s).split(/(«[^»]*»|`+[^`]*?`+)/g);
    return parts.map((p, i) => {
      if (i % 2) {
        if (p[0] === '«') return `<code>${esc(p.slice(1, -1))}</code>`;
        const m = /^(`+)([\s\S]*?)\1$/.exec(p); return `<code>${esc(m ? m[2] : p.replace(/`/g, ''))}</code>`;
      }
      let t = esc(p);
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m0, txt, url) => {
        const ext = /^https?:/.test(url);
        return `<a href="${url.replace(/"/g, '%22')}"${ext ? ' target="_blank" rel="noopener"' : ''}>${txt}</a>`;
      });
      t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>');
      return t;
    }).join('');
  }
  function md(src, ctx = {}) {
    if (!src) return '';
    const Ls = dedent(String(src).replace(/\r/g, '').replace(/^\n+|\s+$/g, ''));
    let out = '', i = 0;
    const para = [];
    const flush = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para.length = 0; } };
    while (i < Ls.length) {
      const line = Ls[i];
      if (!line.trim()) { flush(); i++; continue; }
      let m;
      if ((m = /^(?:```|~~~)(\w*)\s*(.*)$/.exec(line))) {
        flush();
        const lang = m[1], label = m[2];
        const buf = []; i++;
        while (i < Ls.length && !/^(?:```|~~~)\s*$/.test(Ls[i])) buf.push(Ls[i++]);
        i++;
        if (lang === 'mermaid') out += `<div class="mmd-mount" data-src="${esc(buf.join('\n'))}"></div>${label ? `<p class="fig-cap">${inline(label)}</p>` : ''}`;
        else if (lang === 'seq') out += `<div class="seq-mount" data-src="${esc(buf.join('\n'))}" data-title="${esc(label)}"></div>`;
        else out += codeBlock(buf.join('\n'), lang || 'text', label);
        continue;
      }
      if ((m = /^:::(\w+)\s*(.*)$/.exec(line))) {
        flush();
        const kind = m[1], title = m[2];
        const buf = []; i++;
        let depth = 0;
        while (i < Ls.length) {
          if (/^:::\w/.test(Ls[i])) depth++;
          else if (/^:::\s*$/.test(Ls[i])) { if (!depth) break; depth--; }
          buf.push(Ls[i++]);
        }
        i++;
        out += `<div class="callout ${kind}">${title ? `<b>${inline(title)}</b>` : ''}${md(buf.join('\n'), ctx)}</div>`;
        continue;
      }
      if ((m = /^@(\w+)\s*(.*)$/.exec(line))) { flush(); i++; out += directive(m[1], m[2], ctx); continue; }
      if (/^\?\? /.test(line)) {
        flush();
        let cards = '';
        while (i < Ls.length && /^\?\? /.test(Ls[i])) {
          const q = Ls[i].slice(3); i++;
          const ans = [];
          while (i < Ls.length && Ls[i].trim()) ans.push(Ls[i++]);
          while (i < Ls.length && !Ls[i].trim() && i + 1 < Ls.length && /^\?\? /.test(Ls[i + 1])) i++;
          cards += `<details class="card"><summary>${inline(q)}</summary><div class="ans">${md(ans.join('\n'), ctx)}</div></details>`;
        }
        out += `<div class="cards">${cards}</div>`;
        continue;
      }
      if ((m = /^(#{2,4})\s+(.*)$/.exec(line))) { flush(); out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`; i++; continue; }
      if (/^> ?/.test(line)) {
        flush();
        const buf = [];
        while (i < Ls.length && /^> ?/.test(Ls[i])) buf.push(Ls[i++].replace(/^> ?/, ''));
        out += `<blockquote>${md(buf.join('\n'), ctx)}</blockquote>`;
        continue;
      }
      if (/^\|.*\|\s*$/.test(line)) {
        flush();
        const rows = [];
        while (i < Ls.length && /^\|.*\|\s*$/.test(Ls[i])) rows.push(Ls[i++]);
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
        const head = cells(rows[0]);
        const body = rows.slice(/^\|[\s:-]+\|/.test(rows[1] || '') && /-/.test(rows[1]) ? 2 : 1).map(cells);
        out += `<div class="tablewrap"><table class="t"><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      if (/^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line)) {
        flush();
        const ordered = /^\s*\d+\. /.test(line);
        const items = [];
        while (i < Ls.length && (/^\s*[-*] /.test(Ls[i]) || /^\s*\d+\. /.test(Ls[i]) || (/^\s{2,}\S/.test(Ls[i]) && items.length))) {
          if (/^\s*[-*] /.test(Ls[i]) || /^\s*\d+\. /.test(Ls[i])) items.push(Ls[i].replace(/^\s*(?:[-*]|\d+\.) /, ''));
          else items[items.length - 1] += ' ' + Ls[i].trim();
          i++;
        }
        out += `<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
        continue;
      }
      if (/^</.test(line)) { flush(); const buf = []; while (i < Ls.length && Ls[i].trim()) buf.push(Ls[i++]); out += buf.join('\n'); continue; }
      para.push(line.trim()); i++;
    }
    flush();
    return out;
  }

  const LANG = { java: 'Java', sql: 'SQL', http: 'HTTP', text: '', yaml: 'YAML', json: 'JSON' };
  function codeBlock(src, lang = 'text', label = '') {
    return `<div class="codeblock lang-${esc(lang)}"><pre>${HL.code(src, lang)}</pre><div class="cb-bar"><span class="lbl">${esc(label || LANG[lang] || '')}</span><button class="btn quiet" data-cb="copy">Copy</button></div></div>`;
  }

  function directive(name, rest, ctx) {
    rest = rest.trim();
    if (name === 'quiz') { const q = (ctx.quiz || [])[+rest]; return q ? quizHtml(q, `${ctx.id}:${rest}`) : ''; }
    if (name === 'defend') { const n = +rest || 0; return (ctx.defend || [])[n] ? defendHtml(`${ctx.id}:${n}`) : ''; }
    if (name === 'sim') { const [nm, ...pre] = rest.split(/\s+/); return `<div class="sim-mount" data-sim="${esc(nm)}" data-preset="${esc(pre.join(' '))}"></div>`; }
    if (name === 'lab') {
      const m = /^(\w+):([\w-]+)\s+(.*)$/.exec(rest);
      const lab = m && BL.labs[m[1]];
      return lab ? `<a class="labcard" href="${lab[1](m[2])}"><small>${esc(lab[0])}</small><span>${inline(m[3])}</span><i aria-hidden="true">→</i></a>` : '';
    }
    if (name === 'stop') return '<div class="stop-here"><span>✓</span><div><b>Good place to stop.</b> Everything so far is saved. Come back to the next part any time.</div></div>';
    return '';
  }
  function quizHtml(q, qid) {
    const chosen = S.quiz[qid] ? S.quiz[qid].pick : undefined;
    return `<div class="quiz" data-qid="${esc(qid)}"><p class="q"><span class="qt">Quiz</span><span>${inline(q.q)}</span></p>${q.options.map((o, k) => `<label class="${chosen !== undefined ? (k === q.answer ? 'right' : k === chosen ? 'wrong' : '') : ''}"><input type="radio" name="${esc(qid)}" value="${k}" ${chosen === k ? 'checked' : ''} ${chosen !== undefined ? 'disabled' : ''}><span>${inline(o)}</span></label>`).join('')}<div class="why" ${chosen === undefined ? 'hidden' : ''}>${md(q.why)}</div></div>`;
  }
  const quizOf = (qid) => { const [lid, n] = qid.split(':'); return (((LESSON[lid] || {}).quiz) || (PAGES.quizFor && PAGES.quizFor(lid)) || [])[+n]; };

  /* ───────────── Defend it: an interview question, worked as a round ─────────────
   * stage 0: the question and a timer · 1: a weak answer and the follow-ups · 2: what a strong answer covers, red flags, rating */
  const drillOf = (did) => DRILLS.find((x) => x.id === did);
  const RATES = [['solid', 'Solid', 'covered it, with the mechanism'], ['shaky', 'Shaky', 'right idea, thin on follow-ups'], ['missed', 'Missed it', 'would not have got there']];
  const stageOf = {};
  function defendHtml(did, { page = false } = {}) {
    const x = drillOf(did); if (!x) return '';
    const d = x.d, rated = S.defend[did];
    const stage = stageOf[did] ?? (rated ? 2 : 0);
    const follow = (d.follow || []).map((f, k) => `<details class="df-f"><summary><span class="n">${k + 1}</span>${inline(f.q)}</summary><div class="ans">${md(f.a)}</div></details>`).join('');
    return `<section class="defend${page ? ' page' : ''}" data-did="${esc(did)}">
      <div class="df-head"><span class="tag">Defend it</span>${page ? `<a class="small" href="#/l/${x.lesson.id}">${inline(x.lesson.title)}</a>` : ''}</div>
      <p class="df-q">${inline(d.q)}</p>
      ${stage === 0 ? `<div class="df-go"><p>Answer it out loud first, the way you would to an interviewer: about 90 seconds, mechanism first.</p><div class="row"><button class="btn" data-df="timer">Start a 90 s timer</button><span class="df-clock" aria-live="polite"></span><button class="btn primary" data-df="1">Done: show a weak answer →</button></div></div>` : ''}
      ${stage >= 1 ? `<div class="df-weak"><small>A weak answer</small><blockquote>${inline(d.weak)}</blockquote><p><b>Why it falls flat:</b> ${inline(d.whyWeak)}</p></div>
        <div class="df-follow"><small>The follow-ups · answer each before you open it</small>${follow}</div>` : ''}
      ${stage === 1 ? '<div class="row"><button class="btn primary" data-df="2">Show what a strong answer covers →</button></div>' : ''}
      ${stage >= 2 ? `<div class="df-strong"><small>A strong answer covers</small><ul>${(d.strong || []).map((s) => `<li>${inline(s)}</li>`).join('')}</ul></div>
        ${(d.flags || []).length ? `<div class="df-flags"><small>Red flags interviewers listen for</small><ul>${d.flags.map((s) => `<li>${inline(s)}</li>`).join('')}</ul></div>` : ''}
        <div class="df-rate"><span>How did your answer compare?</span>${RATES.map(([k, t, sub]) => `<button class="btn ${rated && rated.rate === k ? 'on' : ''}" data-rate="${k}" title="${esc(sub)}">${t}</button>`).join('')}${rated ? `<span class="small">Saved · ${ago(rated.at)}</span>` : ''}</div>` : ''}
    </section>`;
  }
  function redrawDefend(box) {
    const did = box.dataset.did, page = box.classList.contains('page');
    const tmp = document.createElement('div'); tmp.innerHTML = defendHtml(did, { page });
    const fresh = tmp.firstElementChild; box.replaceWith(fresh);
    return fresh;
  }
  const clocks = new WeakMap();
  function clickDefend(e) {
    const box = e.target.closest('.defend'); if (!box) return false;
    const did = box.dataset.did;
    const b = e.target.closest('[data-df],[data-rate]'); if (!b) return true;
    if (b.dataset.df === 'timer') {
      const out = $('.df-clock', box);
      clearInterval(clocks.get(box));
      let left = 90; out.textContent = '1:30';
      clocks.set(box, setInterval(() => { left--; out.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Time.'; if (left <= 0) clearInterval(clocks.get(box)); }, 1000));
      return true;
    }
    if (b.dataset.df) { stageOf[did] = +b.dataset.df; clearInterval(clocks.get(box)); redrawDefend(box); return true; }
    if (b.dataset.rate) {
      S.defend[did] = { rate: b.dataset.rate, at: Date.now() };
      if (window.LabToday) window.LabToday.seedDrill(did, b.dataset.rate);
      markDay(); save(); redrawDefend(box); renderChips();
      toast(b.dataset.rate === 'solid' ? 'Saved. It comes back in a few days.' : 'Saved. It comes back soon, in Today and in Mock rounds.');
    }
    return true;
  }

  /* ───────────── Elements ───────────── */
  const el = { app: $('#app'), nav: $('#nav'), reader: $('#reader'), pane: $('#readerPane'), progress: $('#progressChip'), todayChip: $('#todayChip'), focusBtn: $('#focusBtn') };

  function toast(msg, ms = 2600) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
  const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };

  /* ───────────── Theme / nav / focus / menu ───────────── */
  (function theme() {
    let saved = null; try { saved = localStorage.getItem('backendlab.theme'); } catch { /* blocked */ }
    if (saved) document.documentElement.dataset.theme = saved;
    $('#themeBtn').onclick = () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('backendlab.theme', document.documentElement.dataset.theme); } catch { /* ignore */ }
    };
  })();
  $('#navToggle').onclick = () => { if (narrow()) el.app.classList.toggle('nav-open'); else el.app.classList.toggle('nav-hidden'); };
  document.addEventListener('click', (e) => {
    if (el.app.classList.contains('nav-open') && !e.target.closest('.nav') && !e.target.closest('#navToggle')) el.app.classList.remove('nav-open');
  });
  function setFocus(on) {
    S.focus = !!on; save();
    el.app.classList.toggle('focus', S.focus);
    el.focusBtn.classList.toggle('on', S.focus);
    el.focusBtn.title = S.focus ? 'Leave focus mode (Esc)' : 'Focus mode: hide everything but this step';
  }
  el.focusBtn.onclick = () => setFocus(!S.focus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.focus && !$('.modal-back') && !$('.pop')) setFocus(false); });

  $('#menuBtn').onclick = (e) => {
    popover(e.currentTarget, `
      <a class="item" href="#/setup"><b>Setup</b><span>Cloud sync and focus mode</span></a>
      <button class="item" data-m="export"><b>Export progress</b><span>Copy your progress as text</span></button>
      <button class="item" data-m="import"><b>Import progress</b><span>Paste progress exported from another device</span></button>
      <hr>
      <a class="item" href="../"><b>All labs</b><span>Back to Deep End</span></a>
      <a class="item" href="https://github.com/anadi198/deep-end/tree/main/backend" target="_blank" rel="noopener"><b>Source on GitHub</b><span>anadi198/deep-end, folder backend</span></a>
      <hr>
      <button class="item" data-m="reset"><b>Reset all progress…</b><span>Clears lessons read, quiz answers, ratings and cards in this browser</span></button>`,
    (m) => {
      if (m === 'export') modal('Export progress', `<p>Copy this text and import it on another device (⋯ → Import progress). Cloud sync does this for you once it is set up.</p><textarea readonly style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)">${esc(btoa(unescape(encodeURIComponent(JSON.stringify(S)))))}</textarea>`, [{ label: 'Copy', primary: true, fn: (m2) => { navigator.clipboard.writeText($('textarea', m2).value); toast('Copied'); } }]);
      if (m === 'import') modal('Import progress', '<p>Paste exported progress. It replaces the progress in this browser.</p><textarea style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)"></textarea>', [{ label: 'Import', primary: true, fn: (m2) => {
        try { const v = JSON.parse(decodeURIComponent(escape(atob($('textarea', m2).value.trim())))); if (!v || v.v !== 1 || !v.defend) throw new Error('not Backend Lab progress'); S = Object.assign(blank(), v); saveNow(); location.reload(); }
        catch (err) { toast('Could not import: ' + err.message); return false; }
      } }]);
      if (m === 'reset') modal('Reset all progress?', '<p>This clears lessons read, quiz answers, your Defend-it ratings and review cards in this browser. If cloud sync is on, sign out first or the cloud copy comes back.</p>', [{ label: 'Reset everything', danger: true, fn: () => { S = blank(); saveNow(); location.hash = '#/'; location.reload(); } }]);
    });
  };
  function popover(anchor, html, onPick) {
    closePop();
    const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    const below = r.bottom + 6 + p.offsetHeight < window.innerHeight - 8;
    p.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - p.offsetHeight)) + 'px';
    p.style.left = Math.max(16, Math.min(window.innerWidth - p.offsetWidth - 16, r.right - p.offsetWidth)) + 'px';
    p.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { closePop(); onPick(b.dataset.m); } else if (e.target.closest('a')) closePop(); });
    setTimeout(() => document.addEventListener('click', closePopOutside), 0);
    return p;
  }
  function closePopOutside(e) { if (!e.target.closest('.pop')) closePop(); }
  function closePop() { $$('.pop').forEach((p) => p.remove()); document.removeEventListener('click', closePopOutside); }
  function modal(title, body, buttons = []) {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>${body}<div class="row"><button class="btn quiet" data-b="close">Close</button>${buttons.map((b, k) => `<button class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'warn' : ''}" data-b="${k}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(back);
    const m = $('.modal', back);
    back.addEventListener('click', (e) => {
      if (e.target === back) { back.remove(); return; }
      const b = e.target.closest('[data-b]'); if (!b) return;
      if (b.dataset.b === 'close') { back.remove(); return; }
      const r = buttons[+b.dataset.b].fn(m);
      if (r !== false) back.remove();
    });
    const onKey = (e) => { if (e.key === 'Escape') { back.remove(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    return m;
  }

  /* ───────────── Progress helpers ───────────── */
  function modStats(m) {
    const n = m.lessons.length, d = m.lessons.filter((l) => isDone(l.id)).length;
    const dr = DRILLS.filter((x) => x.lesson.module === m);
    return { n, d, drills: dr.length, rated: dr.filter((x) => S.defend[x.id]).length, mins: m.lessons.reduce((a, l) => a + (l.mins || 8), 0) };
  }
  function nextItem() {
    if (S.last && S.last.hash) {
      const id = S.last.hash.split('/')[2];
      const it = ITEMS.find((x) => x.id === id);
      if (it && !isDone(it.id)) return { it, resume: true };
      if (it) { const i = ITEMS.indexOf(it); const nx = ITEMS.slice(i + 1).find((x) => !isDone(x.id)); if (nx) return { it: nx, resume: false }; }
    }
    const nx = ITEMS.find((x) => !isDone(x.id));
    return nx ? { it: nx, resume: false } : null;
  }
  function markDay() { const d = new Date().toISOString().slice(0, 10); S.days[d] = (S.days[d] || 0) + 1; }
  const cardsDue = () => (window.LabToday ? window.LabToday.dueCount() : 0);
  function renderChips() {
    const n = ITEMS.length, d = ITEMS.filter((x) => isDone(x.id)).length;
    const frac = n ? d / n : 0;
    const R = 6.5, C = 2 * Math.PI * R;
    el.progress.innerHTML = `<svg class="ring" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--rule)" stroke-width="2.5"/><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--good)" stroke-width="2.5" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 8 8)" stroke-linecap="round"/></svg><span>${d}<span class="lbl"> / ${n} lessons</span></span>`;
    const due = cardsDue();
    el.todayChip.hidden = !due;
    el.todayChip.textContent = `Today: ${due} card${due === 1 ? '' : 's'}`;
    el.todayChip.onclick = () => { location.hash = '#/today'; };
  }

  /* ───────────── Nav ───────────── */
  const TOP_LINKS = [
    ['#/', '⌂', 'Home'],
    ['#/today', '☀', 'Today (5 min)'],
    ['#/mock', '◆', 'Mock round'],
    ['#/drill', '◎', 'Recognition drill'],
    ['#/cheats', '▦', 'Cheat sheets'],
  ];
  let navScrolled = false;
  function renderNav() {
    const cur = location.hash || '#/';
    const due = cardsDue();
    let html = `<div class="top-links">${TOP_LINKS.map(([h, ic, t]) => `<a href="${h}" class="${cur === h || (h !== '#/' && cur.startsWith(h)) ? 'active' : ''}"><span class="ic">${ic}</span>${t}${h === '#/today' && due ? `<span class="badge">${due}</span>` : ''}</a>`).join('')}</div>`;
    for (const m of MODS) {
      const st = modStats(m);
      const open = S.open[m.id] ?? (ROUTE.module === m.id);
      html += `<div class="mod ${open ? 'open' : ''}" data-m="${m.id}"><button aria-expanded="${open}"><span class="num">${String(m.n).padStart(2, '0')}</span><span class="t">${esc(m.title)}</span><span class="c ${st.n && st.d === st.n ? 'done' : ''}">${st.d}/${st.n}</span><span class="bar"><i style="width:${st.n ? (100 * st.d) / st.n : 0}%"></i></span></button><ul>`;
      html += `<li><a class="item ${ROUTE.view === 'module' && ROUTE.id === m.id ? 'active' : ''}" href="#/m/${m.id}"><span class="st lesson">◇</span><span>Overview</span><span></span></a></li>`;
      for (const l of m.lessons) html += `<li><a class="item ${ROUTE.id === l.id ? 'active' : ''}" href="#/l/${l.id}"><span class="st lesson ${S.read[l.id] ? 'read' : ''}">${S.read[l.id] ? '✓' : '▤'}</span><span>${esc(l.title.replace(/[«»]/g, ''))}</span><span class="lvl">${l.mins || 8}m</span></a></li>`;
      html += '</ul></div>';
    }
    el.nav.innerHTML = html;
    const a = $('.item.active', el.nav) || $('.top-links a.active', el.nav);
    if (a && !navScrolled) { a.scrollIntoView({ block: 'center' }); navScrolled = true; }
  }
  el.nav.addEventListener('click', (e) => {
    const b = e.target.closest('.mod > button');
    if (b) {
      const m = b.parentElement; const open = !m.classList.contains('open');
      m.classList.toggle('open', open); b.setAttribute('aria-expanded', open); S.open[m.dataset.m] = open; save();
      return;
    }
    if (e.target.closest('a')) el.app.classList.remove('nav-open');
  });

  /* ───────────── Router ───────────── */
  let ROUTE = { view: 'home' };
  const PAGES = {};  // extras.js registers: home, today, mock, drill, cheats, setup
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    if (!a) return { view: 'home', page: 'home' };
    if (a === 'l' && LESSON[b]) return { view: 'lesson', id: b, module: LESSON[b].module.id };
    if (a === 'm' && MOD[b]) return { view: 'module', id: b, module: b };
    if (PAGES[a]) return { view: 'page', page: a, arg: b };
    return { view: 'home', page: 'home' };
  }
  function route() {
    closePop();
    ROUTE = parseRoute();
    el.app.dataset.view = ROUTE.view === 'lesson' || ROUTE.view === 'module' ? 'lesson' : ROUTE.view === 'page' ? 'page' : 'home';
    if (ROUTE.module && S.open[ROUTE.module] === undefined) S.open[ROUTE.module] = true;
    if (ROUTE.view === 'lesson') renderLesson(LESSON[ROUTE.id]);
    else if (ROUTE.view === 'module') renderModule(MOD[ROUTE.id]);
    else {
      const page = PAGES[ROUTE.page] || PAGES.home;
      el.reader.innerHTML = '';
      const fresh = el.reader.cloneNode(false); el.reader.replaceWith(fresh); el.reader = fresh;   // drop page-level listeners
      if (page) page(el.reader, ROUTE.arg);
      enhance(el.reader);
    }
    el.pane.scrollTop = 0;
    if (ROUTE.view === 'lesson') { S.last = { hash: location.hash.split('/').slice(0, 3).join('/'), at: Date.now() }; save(); }
    navScrolled = false;
    renderNav(); renderChips();
    const plain = (s) => String(s).replace(/[«»]/g, '');
    document.title = (ROUTE.view === 'lesson' ? plain(LESSON[ROUTE.id].title) : ROUTE.view === 'module' ? MOD[ROUTE.id].title : 'A quick look at backend systems') + ' · Backend Lab';
  }
  window.addEventListener('hashchange', route);

  /* ───────────── Enhancement (after rendering markdown) ───────────── */
  function enhance(root) {
    for (const m of $$('.seq-mount', root)) { const d = document.createElement('div'); m.replaceWith(d); V.mountSeq(d, m.dataset.src, m.dataset.title); }
    for (const m of $$('.mmd-mount', root)) { const d = document.createElement('div'); d.dataset.src = m.dataset.src; m.replaceWith(d); V.mountMermaid(d); }
    for (const m of $$('.sim-mount', root)) { const d = document.createElement('div'); m.replaceWith(d); SIM.mount(d, m.dataset.sim, m.dataset.preset); }
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#reader')) return;
    if (clickDefend(e)) return;
    const cb = e.target.closest('[data-cb="copy"]');
    if (cb) { navigator.clipboard.writeText($('pre', cb.closest('.codeblock')).textContent).then(() => toast('Copied')); return; }
    const q = e.target.closest('.quiz input');
    if (q) {
      const box = q.closest('.quiz'); const qid = box.dataset.qid;
      const spec = quizOf(qid); if (!spec) return;
      S.quiz[qid] = { pick: +q.value, right: +q.value === spec.answer, at: Date.now() }; save();
      $$('label', box).forEach((lab, k) => { lab.classList.toggle('right', k === spec.answer); lab.classList.toggle('wrong', k === +q.value && k !== spec.answer); $('input', lab).disabled = true; });
      $('.why', box).hidden = false;
    }
  });

  /* ───────────── Lessons & modules ───────────── */
  function pager(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const prev = ITEMS[i - 1], next = ITEMS[i + 1];
    return `<nav class="pager">${prev ? `<a href="${hrefOf(prev)}"><small>← Lesson</small><span>${inline(prev.data.title)}</span></a>` : ''}${next ? `<a class="next" href="${hrefOf(next)}"><small>Lesson →</small><span>${inline(next.data.title)}</span></a>` : ''}</nav>`;
  }
  function unitBar(m, id) {
    const k = m.lessons.findIndex((u) => u.id === id);
    return `<div class="unitbar" title="Where you are in this module">${m.lessons.map((u, j) => `<i class="${isDone(u.id) ? 'done' : ''} ${j === k ? 'here' : ''}"></i>`).join('')}<span>${k + 1} of ${m.lessons.length}</span></div>`;
  }
  function nextCard(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const next = ITEMS.slice(i + 1).find((x) => !isDone(x.id)) || ITEMS.find((x) => !isDone(x.id) && x.id !== id) || ITEMS[i + 1];
    const due = cardsDue();
    return `<div class="next-card">
      <div class="nc-left"><small>${next && ITEMS.indexOf(next) < i ? 'Still open' : 'Next up'}</small>${next ? `<a href="${hrefOf(next)}" class="nc-title">${inline(next.data.title)}</a><span class="nc-meta">Lesson · about ${itemMins(next)} min</span>` : '<span class="nc-title">You finished every lesson. Keep the daily review and mock rounds going.</span>'}</div>
      <div class="nc-right">${next ? `<a class="btn primary" href="${hrefOf(next)}">Go →</a>` : ''}${due ? `<a class="btn" href="#/today">Or: today's ${due} card${due === 1 ? '' : 's'}</a>` : ''}</div>
    </div>`;
  }
  function renderLesson(l) {
    const m = l.module;
    const ctx = { id: l.id, quiz: l.quiz, defend: l.defend };
    const used = new Set((String(l.body).match(/^\s*@defend\s+(\d+)/gm) || []).map((s) => +s.replace(/\D/g, '')));
    const rest = (l.defend || []).map((_, n) => n).filter((n) => !used.has(n));
    el.reader.innerHTML = `
      <div class="eyebrow"><a href="#/m/${m.id}">${String(m.n).padStart(2, '0')} · ${esc(m.title)}</a><span class="meta">Lesson · ${l.mins || 8} min</span></div>
      ${unitBar(m, l.id)}
      <h1>${inline(l.title)}</h1>
      ${l.remember ? `<div class="remember"><small>Remember this</small><p>${inline(l.remember)}</p></div>` : ''}
      <div class="prose">${md(l.body, ctx)}${rest.map((n) => defendHtml(`${l.id}:${n}`)).join('')}</div>
      ${l.cue ? `<div class="cuecard"><small>Cue card</small><p>${inline(l.cue)}</p></div>` : ''}
      <div class="lesson-end" data-end="${l.id}">
        <div class="stop-here"><span>✓</span><div><b>${S.read[l.id] ? 'Done.' : 'Reached the end: marked as done.'}</b> The remember line, the cue card and the quiz join your 5-minute daily review, so you do not have to memorise them now.</div></div>
        ${nextCard(l.id)}
      </div>
      ${pager(l.id)}`;
    enhance(el.reader);
    const end = $('.lesson-end', el.reader);
    const mark = () => { if (!S.read[l.id]) { S.read[l.id] = Date.now(); markDay(); if (window.LabToday) window.LabToday.seedLesson(l); save(); renderNav(); renderChips(); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { mark(); io.disconnect(); } }, { root: el.pane, threshold: 0.3 });
      io.observe(end);
    } else mark();
  }
  function renderModule(m) {
    const st = modStats(m);
    el.reader.innerHTML = `
      <div class="eyebrow"><span>Module ${String(m.n).padStart(2, '0')}</span><span class="meta">${st.n} lessons · ${st.drills} interview drills · about ${st.mins} min</span></div>
      <h1>${esc(m.title)}</h1>
      ${m.blurb ? `<p class="lede">${inline(m.blurb)}</p>` : ''}
      <div class="prose">
        ${m.intro ? md(m.intro, { id: m.id }) : ''}
        <h2>Lessons <span class="small">(${st.d}/${st.n} done)</span></h2>
        <div class="plist steps">${m.lessons.map((u, k) => `<a href="#/l/${u.id}"><span class="st ${isDone(u.id) ? 'solved' : ''}" style="${isDone(u.id) ? '' : 'background:var(--accent)'}"></span><span>${k + 1}. ${inline(u.title)} <small>· ${u.mins || 8} min${(u.defend || []).length ? ` · ${u.defend.length} drill${u.defend.length === 1 ? '' : 's'}` : ''}</small></span><span></span></a>`).join('')}</div>
      </div>`;
    enhance(el.reader);
  }

  /* ───────────── Sync support: merging two copies of the state ───────────── */
  const DEVICE_ONLY = ['open', 'focus'];
  const newer = (a, b) => ((b && (b.at || 0)) > (a && (a.at || 0)) ? b : a);
  function mergeState(local, remote) {
    if (!remote || remote.v !== 1) return local;
    const out = { ...blank(), ...local };
    const byAt = (k) => { const a = local[k] || {}, b = remote[k] || {}; const o = { ...a }; for (const id of Object.keys(b)) o[id] = a[id] === undefined ? b[id] : newer(a[id], b[id]); out[k] = o; };
    ['cards', 'quiz', 'defend'].forEach(byAt);
    const maxNum = (k) => { const a = local[k] || {}, b = remote[k] || {}; const o = { ...a }; for (const id of Object.keys(b)) o[id] = Math.max(a[id] || 0, b[id] || 0); out[k] = o; };
    ['read', 'days'].forEach(maxNum);
    out.last = newer(local.last, remote.last);
    const dl = local.drill || { n: 0, right: 0, by: {} }, dr = remote.drill || { n: 0, right: 0, by: {} };
    out.drill = dl.n >= dr.n ? { ...dl, by: { ...dr.by, ...dl.by } } : { ...dr, by: { ...dl.by, ...dr.by } };
    for (const k of DEVICE_ONLY) out[k] = local[k];
    return out;
  }
  const syncable = () => { const o = { ...S }; for (const k of DEVICE_ONLY) delete o[k]; return o; };
  function applyMerged(remote) {
    const merged = mergeState(S, remote);
    const strip = (o) => { const c = { ...o }; for (const k of DEVICE_ONLY) delete c[k]; return c; };
    if (JSON.stringify(strip(S)) === JSON.stringify(strip(merged))) return false;
    Object.keys(S).forEach((k) => delete S[k]);
    Object.assign(S, merged);
    persist();
    renderNav(); renderChips();
    if (ROUTE.view === 'page' || ROUTE.view === 'home' || ROUTE.view === 'module') route();
    return true;
  }

  /* ───────────── Boot ───────────── */
  window.LabApp = {
    get S() { return S; }, save, saveNow, md, inline, esc, quizHtml, quizOf, defendHtml, enhance, toast, modal, popover, ago,
    LESSON, MOD, MODS, ITEMS, DRILLS, PAGES, isDone, modStats, markDay, nextItem, hrefOf, itemMins,
    route, renderNav, renderChips, listeners, mergeState, applyMerged, syncable, blank, drillOf,
  };
  setFocus(S.focus);
  window.LabApp.start = function () { route(); };
})();
