/* Rust Lab: routing, outline, lessons, exercises, code panel, grading, PR reviews, progress. */
(function () {
  'use strict';
  const H = window.RustHarness, RL = window.RL, V = window.RustViz, HL = window.RustHighlight, E = window.RustEngine;
  const OUT = window.RUSTLAB_OUT || {};
  const TAGS = RL.tags, GROUPS = RL.groups;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = HL.esc;
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const narrow = () => matchMedia('(max-width: 920px)').matches;

  /* ───────────── State ─────────────
   * Everything that syncs carries a timestamp so two devices can merge (see mergeState). */
  const KEY = 'rustlab.v1';
  const blank = () => ({
    v: 1, done: {}, tries: {}, drafts: {}, hints: {}, seen: {}, read: {}, cards: {}, quiz: {}, days: {}, last: null,
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
  const MODS = RL.modules;
  const ITEMS = [], LESSON = {}, EX = {}, MOD = {};
  MODS.forEach((m, mi) => {
    m.n = mi; MOD[m.id] = m;
    m.lessons = []; m.exercises = []; m.units = [];
    for (const it of m.items) {
      if (it.lesson) { const l = { ...it, id: it.lesson, module: m }; LESSON[l.id] = l; m.lessons.push(l); m.units.push(l); ITEMS.push({ kind: 'lesson', id: l.id, data: l, module: m }); }
      else if (it.exercise) {
        const x = it.exercise; x.module = m; EX[x.id] = x; m.exercises.push(x); m.units.push(x); ITEMS.push({ kind: 'exercise', id: x.id, data: x, module: m });
        if (x.kind === 'review') x.parsed = H.parseReview(x.code);
      }
    }
  });
  const ALL_EX = ITEMS.filter((x) => x.kind === 'exercise').map((x) => x.data);
  const hrefOf = (it) => (it.kind === 'lesson' ? `#/l/${it.id}` : `#/x/${it.id}`);
  const isDone = (id) => !!(S.done[id] || S.read[id]);
  const itemMins = (it) => it.data.mins || (it.kind === 'lesson' ? 6 : 10);
  const kindLabel = (x) => ({ fix: 'Fix', build: 'Build', review: 'Review a PR' }[x.kind] || 'Exercise');

  /* ───────────── Mini Markdown ───────────── */
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
    const Ls = H.dedent(String(src).replace(/\r/g, '').replace(/^\n+|\s+$/g, ''));
    let out = '', i = 0;
    const para = [];
    const flush = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>`; para.length = 0; } };
    while (i < Ls.length) {
      const line = Ls[i];
      if (!line.trim()) { flush(); i++; continue; }
      let m;
      if ((m = /^(?:```|~~~)(.*)$/.exec(line))) {
        flush();
        const f = H.fenceInfo(m[1]);
        const buf = []; i++;
        while (i < Ls.length && !/^(?:```|~~~)\s*$/.test(Ls[i])) buf.push(Ls[i++]);
        i++;
        if (f.lang === 'mermaid') out += `<div class="mmd-mount" data-src="${esc(buf.join('\n'))}"></div>${f.label ? `<p class="fig-cap">${inline(f.label)}</p>` : ''}`;
        else if (f.lang === 'seq') out += `<div class="seq-mount" data-src="${esc(buf.join('\n'))}" data-title="${esc(f.label)}"></div>`;
        else out += codeBlock(buf.join('\n'), { lang: f.lang || 'rust', label: f.label, flag: f.flag, ctx });
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
        out += kind === 'vs'
          ? `<div class="callout vs">${title ? `<b>${inline(title)}</b>` : ''}<div class="vs-grid">${md(buf.join('\n'), ctx)}</div></div>`
          : `<div class="callout ${kind}">${title ? `<b>${inline(title)}</b>` : ''}${md(buf.join('\n'), ctx)}</div>`;
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

  /* Code blocks. A flagged rust fence shows the compiler's recorded output under it and can be edited and run. */
  const CODE_SRC = {};
  let cbSeq = 0;
  function codeBlock(src, { lang = 'rust', label = '', flag = null, ctx = {} } = {}) {
    const id = 'cb' + ++cbSeq;
    let body, rec = null;
    if (lang === 'rust') {
      const s = flag ? H.snippet(flag, src) : { shown: H.splitHidden(src).shown };
      body = HL.rust(s.shown);
      if (flag) rec = OUT[s.key] || null;
    } else if (lang === 'java') body = HL.java(src);
    else body = esc(src);
    CODE_SRC[id] = { src, flag, lang };
    const canLoad = lang === 'rust' && ctx.exercise && ctx.loadable;
    const buttons = `${flag ? '<button class="btn quiet" data-cb="edit" title="Change this code and run it on the Rust Playground">Edit &amp; run</button>' : ''}<button class="btn quiet" data-cb="copy">Copy</button>${canLoad ? '<button class="btn quiet" data-cb="load" title="Replace the editor contents with this code">Load into editor</button>' : ''}`;
    const out = flag ? `<div class="cb-out">${rec ? outputHtml(rec, flag) : '<div class="out none"><small>Not recorded yet</small><p>Press <b>Edit &amp; run</b> to see what it does.</p></div>'}</div>` : '';
    return `<div class="codeblock lang-${esc(lang)}${flag ? ' checked' : ''}" data-id="${id}"><pre>${body}</pre><div class="cb-bar"><span class="lbl">${esc(label || (lang === 'java' ? 'Java' : ''))}</span>${buttons}</div>${out}</div>`;
  }
  // rec (H.record): { k: outcome kind, o: stdout, t: compiler errors or warnings, e: the program's own stderr }
  function outputHtml(rec, flag, live = false) {
    const who = live ? 'Your run · ' : '';
    if (rec.k === 'error') return `<div class="out none"><small>Could not run</small><p>${esc(rec.t)}</p></div>`;
    if (rec.k === 'timeout') return flag === 'hang'
      ? `<div class="out panic"><small>${who}It hangs</small><p>It never finished: the Playground stopped it after about 10 seconds.</p></div>`
      : `<div class="out panic"><small>${who}Stopped</small><p>It ran for more than 10 seconds, the Playground's limit. An endless loop, or a wait that never ends?</p></div>`;
    if (rec.k === 'compile-error') return `<div class="out err"><small>${who}Compiler says</small><pre class="rustc">${HL.rustc(rec.t)}</pre></div>`;
    if (flag === 'clippy') return `<div class="out warn"><small>${who}Clippy says</small>${rec.t ? `<pre class="rustc">${HL.rustc(rec.t)}</pre>` : '<p>No warnings.</p>'}</div>`;
    let html = '';
    if (rec.o) html += `<div class="out ok"><small>${who}Output</small><pre>${esc(rec.o.replace(/\n$/, ''))}</pre></div>`;
    if (rec.k === 'panic') html += `<div class="out panic"><small>${who}It panics</small><pre class="rustc">${HL.rustc(rec.e || rec.t)}</pre></div>`;
    else if (rec.e) html += `<div class="out panic"><small>${who}Printed to stderr</small><pre class="rustc">${HL.rustc(rec.e)}</pre></div>`;
    if (rec.t) html += `<details class="out-warn"><summary>Compiler warnings</summary><pre class="rustc">${HL.rustc(rec.t)}</pre></details>`;
    if (rec.k === 'ok' && !rec.o && !rec.e) html += `<div class="out ok"><small>${who}Output</small><p class="dim">(prints nothing)</p></div>`;
    if (rec.k === 'exit') html += `<div class="out panic"><small>${who}Exited with an error</small></div>`;
    return html;
  }

  function directive(name, rest, ctx) {
    rest = rest.trim();
    if (name === 'quiz') { const q = (ctx.quiz || [])[+rest]; return q ? quizHtml(q, `${ctx.id}:${rest}`) : ''; }
    if (name === 'predict') { const p = (ctx.predict || [])[+rest]; return p ? predictHtml(p, `p:${ctx.id}:${rest}`) : ''; }
    if (name === 'exercises') return exList(rest.split(/\s+/).filter(Boolean));
    if (name === 'hunts') return huntsHtml();
    if (name === 'hunt') return huntCard(rest);
    if (name === 'stop') return '<div class="stop-here"><span>✓</span><div><b>Good place to stop.</b> Everything so far is saved. Come back to the next part any time.</div></div>';
    return '';
  }
  function exList(ids) {
    return `<div class="plist">${ids.map((id) => {
      const x = EX[id]; if (!x) return `<span class="small">unknown exercise ${esc(id)}</span>`;
      return `<a href="#/x/${id}"><span class="st ${S.done[id] ? 'solved' : x.diff || 'easy'}"></span><span>${esc(x.title)} <small>· ${esc(kindLabel(x))} · ${x.mins || 10} min</small></span><span class="diff ${x.diff || 'easy'}" style="font-size:10px;padding:3px 7px">${x.diff || 'easy'}</span></a>`;
    }).join('')}</div>`;
  }
  const tagChip = (t, extra = '') => `<span class="hchip h-${esc(t)} ${extra}"><i>${TAGS[t] ? TAGS[t].n : '?'}</i>${esc(TAGS[t] ? TAGS[t].label : t)}</span>`;
  function huntCard(t) {
    const h = TAGS[t]; if (!h) return '';
    return `<div class="hcard h-${esc(t)}"><div class="hc-top">${tagChip(t)}<span class="grp">${esc(GROUPS[h.group].label)}</span></div><p>${inline(h.one)}</p><p class="cue"><b>Cue:</b> ${inline(h.cue)}</p></div>`;
  }
  function huntsHtml() {
    return `<div class="hunt-groups">${Object.entries(GROUPS).map(([g, gr]) => `<div class="hgroup ${g}"><b>${esc(gr.label)}</b><span>${inline(gr.one)}</span><div>${Object.keys(TAGS).filter((t) => TAGS[t].group === g).map((t) => tagChip(t)).join('')}</div></div>`).join('')}</div><p class="small"><a href="#/hunts">Open the review map →</a></p>`;
  }
  function quizHtml(q, qid) {
    const chosen = S.quiz[qid] ? S.quiz[qid].pick : undefined;
    return `<div class="quiz" data-qid="${esc(qid)}"><p class="q"><span class="qt">Quiz</span><span>${inline(q.q)}</span></p>${q.options.map((o, k) => `<label class="${chosen !== undefined ? (k === q.answer ? 'right' : k === chosen ? 'wrong' : '') : ''}"><input type="radio" name="${esc(qid)}" value="${k}" ${chosen === k ? 'checked' : ''} ${chosen !== undefined ? 'disabled' : ''}><span>${inline(o)}</span></label>`).join('')}<div class="why" ${chosen === undefined ? 'hidden' : ''}>${md(q.why)}</div></div>`;
  }
  // "What happens when this runs?" The reveal shows the real compiler's recorded output.
  function predictHtml(p, qid) {
    const chosen = S.quiz[qid] ? S.quiz[qid].pick : undefined;
    const s = H.snippet('run', p.code);
    const rec = OUT[s.key];
    return `<div class="quiz predict" data-qid="${esc(qid)}"><p class="q"><span class="qt">Predict</span><span>${inline(p.q || 'What happens when this runs?')}</span></p><div class="codeblock lang-rust mini"><pre>${HL.rust(s.shown)}</pre></div><div class="opts">${p.options.map((o, k) => `<label class="${chosen !== undefined ? (k === p.answer ? 'right' : k === chosen ? 'wrong' : '') : ''}"><input type="radio" name="${esc(qid)}" value="${k}" ${chosen === k ? 'checked' : ''} ${chosen !== undefined ? 'disabled' : ''}><span>${/\n/.test(o) ? `<code class="multi">${esc(o)}</code>` : inline(o)}</span></label>`).join('')}</div><div class="why" ${chosen === undefined ? 'hidden' : ''}>${md(p.why)}${rec ? `<div class="cb-out">${outputHtml(rec, 'run')}</div>` : ''}</div></div>`;
  }
  // A review issue's demo: a test the build proved fails on the PR code.
  function demoHtml(is) {
    if (!is.demo) return '';
    const rec = OUT[H.key('demo', is.demo)];
    return `<details class="demo"><summary>A test that exposes it</summary><pre class="tcode">${HL.rust(is.demo)}</pre>${rec && rec.e ? `<div class="out panic"><small>On this PR it fails with</small><pre class="rustc">${HL.rustc(rec.e)}</pre></div>` : ''}</details>`;
  }
  const predictOf = (qid) => { const [, lid, n] = qid.split(':'); return ((LESSON[lid] || {}).predict || [])[+n]; };
  const quizOf = (qid) => { const [lid, n] = qid.split(':'); return (((LESSON[lid] || {}).quiz) || (PAGES.quizFor && PAGES.quizFor(lid)) || [])[+n]; };

  /* ───────────── Elements ───────────── */
  const el = {
    app: $('#app'), nav: $('#nav'), reader: $('#reader'), pane: $('#readerPane'), code: $('#code'),
    fileTabs: $('#fileTabs'), engineState: $('#engineState'), resBody: $('#resBody'), editorWrap: $('#editorWrap'),
    run: $('#runBtn'), submit: $('#submitBtn'), reset: $('#resetCode'),
    progress: $('#progressChip'), todayChip: $('#todayChip'), focusBtn: $('#focusBtn'), codeHint: $('#codeHint'),
  };

  function toast(msg, ms = 2600) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  /* ───────────── Theme / nav / focus / menu ───────────── */
  (function theme() {
    let saved = null; try { saved = localStorage.getItem('rustlab.theme'); } catch { /* blocked */ }
    if (saved) document.documentElement.dataset.theme = saved;
    $('#themeBtn').onclick = () => {
      const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
      try { localStorage.setItem('rustlab.theme', document.documentElement.dataset.theme); } catch { /* ignore */ }
    };
  })();
  $('#navToggle').onclick = () => {
    if (narrow()) el.app.classList.toggle('nav-open');
    else el.app.classList.toggle('nav-hidden');
  };
  document.addEventListener('click', (e) => {
    if (el.app.classList.contains('nav-open') && !e.target.closest('.nav') && !e.target.closest('#navToggle')) el.app.classList.remove('nav-open');
  });
  function setFocus(on) {
    S.focus = !!on; save();
    el.app.classList.toggle('focus', S.focus);
    el.focusBtn.classList.toggle('on', S.focus);
    el.focusBtn.title = S.focus ? 'Leave focus mode (Esc)' : 'Focus mode: hide everything but this step';
    if (cm) setTimeout(() => cm.refresh(), 0);
  }
  el.focusBtn.onclick = () => setFocus(!S.focus);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.focus && !$('.modal-back') && !$('.pop')) setFocus(false); });

  $('#menuBtn').onclick = (e) => {
    popover(e.currentTarget, `
      <a class="item" href="#/setup"><b>Setup</b><span>Where code runs, and cloud sync</span></a>
      <button class="item" data-m="export"><b>Export progress</b><span>Copy your progress as text</span></button>
      <button class="item" data-m="import"><b>Import progress</b><span>Paste progress exported from another device</span></button>
      <hr>
      <a class="item" href="../"><b>All labs</b><span>Back to Deep End</span></a>
      <a class="item" href="https://github.com/anadi198/anadi198.github.io/tree/main/rust" target="_blank" rel="noopener"><b>Source on GitHub</b><span>anadi198/anadi198.github.io, folder rust</span></a>
      <hr>
      <button class="item" data-m="reset"><b>Reset all progress…</b><span>Clears exercises, drafts, flags and cards in this browser</span></button>`,
    (m) => {
      if (m === 'export') modal('Export progress', `<p>Copy this text and import it on another device (⋯ → Import progress). Cloud sync does this for you once it is set up.</p><textarea readonly style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)">${esc(btoa(unescape(encodeURIComponent(JSON.stringify(S)))))}</textarea>`, [{ label: 'Copy', primary: true, fn: (m2) => { navigator.clipboard.writeText($('textarea', m2).value); toast('Copied'); } }]);
      if (m === 'import') modal('Import progress', '<p>Paste exported progress. It replaces the progress in this browser.</p><textarea style="width:100%;min-height:160px;font:12px/1.4 var(--f-mono)"></textarea>', [{ label: 'Import', primary: true, fn: (m2) => {
        try { const v = JSON.parse(decodeURIComponent(escape(atob($('textarea', m2).value.trim())))); if (!v || v.v !== 1) throw new Error('not Rust Lab progress'); S = Object.assign(blank(), v); saveNow(); location.reload(); }
        catch (err) { toast('Could not import: ' + err.message); return false; }
      } }]);
      if (m === 'reset') modal('Reset all progress?', '<p>This clears finished exercises, code drafts, review flags, hints, quiz answers and review cards in this browser. If cloud sync is on, sign out first or the cloud copy comes back.</p>', [{ label: 'Reset everything', danger: true, fn: () => { S = blank(); saveNow(); location.hash = '#/'; location.reload(); } }]);
    });
  };
  function popover(anchor, html, onPick, { at } = {}) {
    closePop();
    const p = document.createElement('div'); p.className = 'pop'; p.innerHTML = html; document.body.appendChild(p);
    const r = at || anchor.getBoundingClientRect();
    const below = r.bottom + 6 + p.offsetHeight < window.innerHeight - 8;
    p.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - p.offsetHeight)) + 'px';
    p.style.left = Math.max(16, Math.min(window.innerWidth - p.offsetWidth - 16, (at ? r.left : r.right - p.offsetWidth))) + 'px';
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
    const n = m.units.length;
    const d = m.units.filter((u) => isDone(u.id)).length;
    return { n, d, ex: m.exercises.length, exd: m.exercises.filter((x) => S.done[x.id]).length, lessons: m.lessons.length, lr: m.lessons.filter((l) => S.read[l.id]).length };
  }
  function nextItem() {
    if (S.last && S.last.hash) {
      const [, k, id] = S.last.hash.split('/');
      const it = ITEMS.find((x) => x.id === id && (k === 'l' ? x.kind === 'lesson' : x.kind === 'exercise'));
      if (it && !isDone(it.id)) return { it, resume: true };
      if (it) { const i = ITEMS.indexOf(it); const nx = ITEMS.slice(i + 1).find((x) => !isDone(x.id)); if (nx) return { it: nx, resume: false }; }
    }
    const nx = ITEMS.find((x) => !isDone(x.id));
    return nx ? { it: nx, resume: false } : null;
  }
  function markDay() { const d = new Date().toISOString().slice(0, 10); S.days[d] = (S.days[d] || 0) + 1; }
  const cardsDue = () => (window.RustToday ? window.RustToday.dueCount() : 0);
  function renderChips() {
    const n = ITEMS.length, d = ITEMS.filter((x) => isDone(x.id)).length;
    const frac = n ? d / n : 0;
    const R = 6.5, C = 2 * Math.PI * R;
    el.progress.innerHTML = `<svg class="ring" viewBox="0 0 16 16"><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--rule)" stroke-width="2.5"/><circle cx="8" cy="8" r="${R}" fill="none" stroke="var(--good)" stroke-width="2.5" stroke-dasharray="${C * frac} ${C}" transform="rotate(-90 8 8)" stroke-linecap="round"/></svg><span>${d}<span class="lbl"> / ${n} steps</span></span>`;
    const due = cardsDue();
    el.todayChip.hidden = !due;
    el.todayChip.textContent = `Today: ${due} card${due === 1 ? '' : 's'}`;
    el.todayChip.onclick = () => { location.hash = '#/today'; };
  }

  /* ───────────── Nav ───────────── */
  const TOP_LINKS = [
    ['#/', '⌂', 'Home'],
    ['#/today', '☀', 'Today (5 min)'],
    ['#/hunts', '◈', 'Review map'],
    ['#/drill', '◎', 'Recognition drill'],
    ['#/cheats', '▦', 'Cheat sheets'],
  ];
  let navScrolled = false;
  function renderNav() {
    const cur = location.hash || '#/';
    const due = cardsDue();
    let html = `<div class="top-links">${TOP_LINKS.map(([h, ic, t]) => `<a href="${h}" class="${cur === h || (h !== '#/' && cur.startsWith(h)) ? 'active' : ''}"><span class="ic">${ic}</span>${t}${h === '#/today' && due ? `<span class="badge">${due}</span>` : ''}</a>`).join('')}</div>`;
    const active = ROUTE.id;
    for (const m of MODS) {
      const st = modStats(m);
      const open = S.open[m.id] ?? (ROUTE.module === m.id);
      html += `<div class="mod ${open ? 'open' : ''}" data-m="${m.id}"><button aria-expanded="${open}"><span class="num">${String(m.n).padStart(2, '0')}</span><span class="t">${esc(m.title)}</span><span class="c ${st.n && st.d === st.n ? 'done' : ''}">${st.d}/${st.n}</span><span class="bar"><i style="width:${st.n ? (100 * st.d) / st.n : 0}%"></i></span></button><ul>`;
      html += `<li><a class="item ${ROUTE.view === 'module' && ROUTE.id === m.id ? 'active' : ''}" href="#/m/${m.id}"><span class="st lesson">◇</span><span>Overview</span><span></span></a></li>`;
      for (const u of m.units) {
        const isL = LESSON[u.id] === u;
        if (isL) html += `<li><a class="item ${active === u.id ? 'active' : ''}" href="#/l/${u.id}"><span class="st lesson ${S.read[u.id] ? 'read' : ''}">${S.read[u.id] ? '✓' : '▤'}</span><span>${esc(u.title.replace(/[«»]/g, ''))}</span><span class="lvl">${u.mins || 6}m</span></a></li>`;
        else html += `<li><a class="item ${active === u.id ? 'active' : ''}" href="#/x/${u.id}"><span class="st dot ${u.diff || 'easy'} ${S.done[u.id] ? 'solved' : ''}"></span><span>${esc(u.title)}</span><span class="lvl">${u.kind === 'review' ? 'PR' : u.kind === 'fix' ? 'fix' : 'build'}</span></a></li>`;
      }
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
  const PAGES = {};  // extras.js registers: home, today, hunts, drill, cheats, setup
  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b, c] = h.split('/');
    if (!a) return { view: 'home', page: 'home' };
    if (a === 'l' && LESSON[b]) return { view: 'lesson', id: b, module: LESSON[b].module.id };
    if (a === 'x' && EX[b]) return { view: 'exercise', id: b, tab: c || 'task', module: EX[b].module.id };
    if (a === 'm' && MOD[b]) return { view: 'module', id: b, module: b };
    if (PAGES[a]) return { view: 'page', page: a, arg: b };
    return { view: 'home', page: 'home' };
  }
  function route() {
    closePop();
    const prev = ROUTE;
    ROUTE = parseRoute();
    el.app.dataset.view = ROUTE.view === 'exercise' ? 'problem' : ROUTE.view === 'lesson' || ROUTE.view === 'module' ? 'lesson' : ROUTE.view === 'page' ? 'page' : 'home';
    if (ROUTE.module && S.open[ROUTE.module] === undefined) S.open[ROUTE.module] = true;
    const same = prev.view === 'exercise' && ROUTE.view === 'exercise' && prev.id === ROUTE.id;
    if (ROUTE.view === 'exercise') {
      if (!same) { renderExercise(EX[ROUTE.id]); loadEditor(EX[ROUTE.id]); }
      else setExTab(ROUTE.tab);
    } else if (ROUTE.view === 'lesson') renderLesson(LESSON[ROUTE.id]);
    else if (ROUTE.view === 'module') renderModule(MOD[ROUTE.id]);
    else {
      CUR = null;
      const page = PAGES[ROUTE.page] || PAGES.home;
      el.reader.innerHTML = '';
      if (page) page(el.reader, ROUTE.arg);
      enhance(el.reader, {});
    }
    if (!same) el.pane.scrollTop = 0;
    if (ROUTE.view === 'lesson' || ROUTE.view === 'exercise') { S.last = { hash: location.hash.split('/').slice(0, 3).join('/'), at: Date.now() }; save(); }
    if (ROUTE.view === 'exercise' && !same && narrow()) setMobileTab('read');
    navScrolled = same;
    renderNav(); renderChips();
    const plain = (s) => String(s).replace(/[«»]/g, '');
    document.title = (ROUTE.view === 'exercise' ? EX[ROUTE.id].title : ROUTE.view === 'lesson' ? plain(LESSON[ROUTE.id].title) : ROUTE.view === 'module' ? MOD[ROUTE.id].title : 'Read and review Rust') + ' · Rust Lab';
  }
  window.addEventListener('hashchange', route);

  const setMobileTab = (t) => { el.app.dataset.tab = t; $('#tabRead').classList.toggle('on', t === 'read'); $('#tabCode').classList.toggle('on', t === 'code'); if (t === 'code' && cm) setTimeout(() => cm.refresh(), 0); };
  $('#tabRead').onclick = () => setMobileTab('read');
  $('#tabCode').onclick = () => setMobileTab('code');

  /* ───────────── Enhancement (after rendering markdown) ───────────── */
  const ENHANCERS = [];
  function enhance(root, ctx) {
    for (const m of $$('.seq-mount', root)) { const d = document.createElement('div'); m.replaceWith(d); V.mountSeq(d, m.dataset.src, m.dataset.title); }
    for (const m of $$('.mmd-mount', root)) { const d = document.createElement('div'); d.dataset.src = m.dataset.src; m.replaceWith(d); V.mountMermaid(d); }
    for (const f of ENHANCERS) f(root, ctx);
  }
  // Inline "Edit & run": the snippet becomes an editor, and Run sends it to the Playground.
  function editSnippet(box) {
    const spec = CODE_SRC[box.dataset.id];
    if (!spec || box.classList.contains('editing')) return;
    box.classList.add('editing');
    const full = H.splitHidden(spec.src).full;
    const pre = $('pre', box);
    const holder = document.createElement('div'); holder.className = 'cb-editor';
    pre.replaceWith(holder);
    const ed = window.CodeMirror ? window.CodeMirror(holder, { value: full, mode: 'rust', lineNumbers: false, indentUnit: 4, matchBrackets: true, autoCloseBrackets: true, viewportMargin: Infinity, inputStyle: touch ? 'contenteditable' : 'textarea',
      extraKeys: { 'Ctrl-Enter': () => go(), 'Cmd-Enter': () => go(), Tab: (c) => c.replaceSelection('    ', 'end') } }) : null;
    let ta = null;
    if (!ed) { ta = document.createElement('textarea'); ta.className = 'fallback'; ta.value = full; ta.rows = Math.min(20, full.split('\n').length + 1); holder.appendChild(ta); }
    const bar = $('.cb-bar', box);
    bar.insertAdjacentHTML('afterbegin', '<button class="btn primary sm" data-cb="run">Run <span class="k">⌘↵</span></button><button class="btn quiet sm" data-cb="undo">Reset</button>');
    $('[data-cb=edit]', bar).remove();
    const go = () => runSnippet(box, ed ? ed.getValue() : ta.value);
    box.__get = () => (ed ? ed.getValue() : ta.value);
    box.__set = (v) => (ed ? ed.setValue(v) : (ta.value = v));
    if (ed) setTimeout(() => { ed.refresh(); ed.focus(); }, 0);
  }
  async function runSnippet(box, code) {
    const spec = CODE_SRC[box.dataset.id];
    const out = $('.cb-out', box);
    const kind = spec.flag === 'clippy' ? 'clippy' : 'run';
    out.innerHTML = `<div class="out none"><small>Running</small><p><span class="spin"></span> ${kind === 'clippy' ? 'Asking clippy' : 'Compiling and running'} on the Rust Playground…</p></div>`;
    const resp = await E.Play.call(kind, H.programOf(code));
    const o = H.outcome(resp);
    out.innerHTML = outputHtml(H.record(o), spec.flag, true);
  }
  el.reader.addEventListener('click', (e) => {
    const cb = e.target.closest('[data-cb]');
    if (cb) {
      const box = cb.closest('.codeblock');
      const spec = CODE_SRC[box.dataset.id];
      const a = cb.dataset.cb;
      if (a === 'copy') navigator.clipboard.writeText(box.__get ? box.__get() : spec.lang === 'rust' ? H.splitHidden(spec.src).full : spec.src).then(() => toast('Copied'));
      if (a === 'edit') editSnippet(box);
      if (a === 'run') runSnippet(box, box.__get());
      if (a === 'undo') { box.__set(H.splitHidden(spec.src).full); const k = H.snippet(spec.flag, spec.src); $('.cb-out', box).innerHTML = OUT[k.key] ? outputHtml(OUT[k.key], spec.flag) : ''; }
      if (a === 'load' && CUR) modal('Replace your code?', '<p>This puts the model answer in the editor. Your current code is replaced (it is not kept).</p>', [{ label: 'Replace', primary: true, fn: () => { setCode(spec.src); saveDraft(); if (narrow()) setMobileTab('code'); } }]);
      return;
    }
    const q = e.target.closest('.quiz input');
    if (q) {
      const box = q.closest('.quiz'); const qid = box.dataset.qid;
      const spec = qid.startsWith('p:') ? predictOf(qid) : quizOf(qid);
      if (!spec) return;
      S.quiz[qid] = { pick: +q.value, right: +q.value === spec.answer, at: Date.now() }; save();
      $$('label', box).forEach((lab, k) => { lab.classList.toggle('right', k === spec.answer); lab.classList.toggle('wrong', k === +q.value && k !== spec.answer); $('input', lab).disabled = true; });
      $('.why', box).hidden = false;
    }
  });

  /* ───────────── Lessons & modules ───────────── */
  function pager(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const prev = ITEMS[i - 1], next = ITEMS[i + 1];
    const lab = (x) => (x.kind === 'lesson' ? 'Lesson' : 'Exercise');
    return `<nav class="pager">${prev ? `<a href="${hrefOf(prev)}"><small>← ${lab(prev)}</small><span>${inline(prev.data.title)}</span></a>` : ''}${next ? `<a class="next" href="${hrefOf(next)}"><small>${lab(next)} →</small><span>${inline(next.data.title)}</span></a>` : ''}</nav>`;
  }
  function unitBar(m, id) {
    const k = m.units.findIndex((u) => u.id === id);
    return `<div class="unitbar" title="Where you are in this module">${m.units.map((u, j) => `<i class="${isDone(u.id) ? 'done' : ''} ${j === k ? 'here' : ''}"></i>`).join('')}<span>${k + 1} of ${m.units.length}</span></div>`;
  }
  function nextCard(id) {
    const i = ITEMS.findIndex((x) => x.id === id);
    const next = ITEMS.slice(i + 1).find((x) => !isDone(x.id)) || ITEMS.find((x) => !isDone(x.id) && x.id !== id) || ITEMS[i + 1];
    const due = cardsDue();
    return `<div class="next-card">
      <div class="nc-left"><small>${next && ITEMS.indexOf(next) < i ? 'Still open' : 'Next up'}</small>${next ? `<a href="${hrefOf(next)}" class="nc-title">${inline(next.data.title)}</a><span class="nc-meta">${next.kind === 'lesson' ? 'Lesson' : kindLabel(next.data)} · about ${itemMins(next)} min</span>` : '<span class="nc-title">You finished everything built so far. Keep the daily review going.</span>'}</div>
      <div class="nc-right">${next ? `<a class="btn primary" href="${hrefOf(next)}">Go →</a>` : ''}${due ? `<a class="btn" href="#/today">Or: today's ${due} card${due === 1 ? '' : 's'}</a>` : ''}</div>
    </div>`;
  }
  function renderLesson(l) {
    CUR = null;
    const m = l.module;
    el.reader.innerHTML = `
      <div class="eyebrow"><a href="#/m/${m.id}">${String(m.n).padStart(2, '0')} · ${esc(m.title)}</a><span class="meta">Lesson · ${l.mins || 6} min</span></div>
      ${unitBar(m, l.id)}
      <h1>${inline(l.title)}</h1>
      ${l.remember ? `<div class="remember"><small>Remember this</small><p>${inline(l.remember)}</p></div>` : ''}
      <div class="prose">${md(l.body, { id: l.id, quiz: l.quiz, predict: l.predict })}</div>
      ${l.cue ? `<div class="cuecard"><small>Cue card</small><p>${inline(l.cue)}</p></div>` : ''}
      <div class="lesson-end" data-end="${l.id}">
        <div class="stop-here"><span>✓</span><div><b>${S.read[l.id] ? 'Done.' : 'Reached the end: marked as done.'}</b> ${l.remember || l.cue ? 'The remember line, the cue card and the predict questions join your 5-minute daily review, so you do not have to memorise them now.' : 'Good place to stop.'}</div></div>
        ${nextCard(l.id)}
      </div>
      ${pager(l.id)}`;
    enhance(el.reader, { lesson: l });
    const end = $('.lesson-end', el.reader);
    const mark = () => { if (!S.read[l.id]) { S.read[l.id] = Date.now(); markDay(); if (window.RustToday) window.RustToday.seedLesson(l); save(); renderNav(); renderChips(); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { mark(); io.disconnect(); } }, { root: el.pane, threshold: 0.3 });
      io.observe(end);
    } else mark();
  }
  function renderModule(m) {
    CUR = null;
    const st = modStats(m);
    el.reader.innerHTML = `
      <div class="eyebrow"><span>Module ${String(m.n).padStart(2, '0')}</span><span class="meta">${st.lessons} lessons · ${st.ex} exercises · about ${m.units.reduce((a, u) => a + (u.mins || (LESSON[u.id] === u ? 6 : 10)), 0)} min</span></div>
      <h1>${esc(m.title)}</h1>
      ${m.blurb ? `<p class="lede">${inline(m.blurb)}</p>` : ''}
      <div class="prose">
        ${m.intro ? md(m.intro, { id: m.id }) : ''}
        <h2>Steps <span class="small">(${st.d}/${st.n} done)</span></h2>
        <div class="plist steps">${m.units.map((u, k) => { const isL = LESSON[u.id] === u; return `<a href="${isL ? '#/l/' : '#/x/'}${u.id}"><span class="st ${isDone(u.id) ? 'solved' : isL ? '' : u.diff || 'easy'}" style="${isDone(u.id) || !isL ? '' : 'background:var(--accent)'}"></span><span>${k + 1}. ${inline(u.title)} <small>· ${isL ? 'Lesson' : kindLabel(u)} · ${u.mins || (isL ? 6 : 10)} min</small></span><span></span></a>`; }).join('')}</div>
      </div>`;
    enhance(el.reader, {});
  }

  /* ───────────── Exercise page ───────────── */
  let CUR = null;
  function renderExercise(x) {
    CUR = x;
    const done = !!S.done[x.id];
    const review = x.kind === 'review';
    const tabs = [['task', review ? 'The PR' : 'Task'], ['hints', `Hints<span class="n">${x.hints ? x.hints.length : 0}</span>`], ['solution', review ? 'Answers' : 'Solution']];
    const m = x.module;
    el.reader.innerHTML = `
      <div class="eyebrow"><a href="#/m/${m.id}">${String(m.n).padStart(2, '0')} · ${esc(m.title)}</a><span class="meta">${esc(kindLabel(x))} · about ${x.mins || 10} min</span></div>
      ${unitBar(m, x.id)}
      <h1>${esc(x.title)}</h1>
      <div class="p-head"><span class="diff ${x.diff || 'easy'}">${x.diff || 'easy'}</span><span class="tag">${esc(kindLabel(x))}</span>${review ? `<span class="tag">${(x.issues || []).length} planted issue${(x.issues || []).length === 1 ? '' : 's'}</span>` : ''}${done ? '<span class="solved-pill">✓ Done</span>' : ''}</div>
      <div class="p-tabs" role="tablist">${tabs.map(([k, t]) => `<button data-pt="${k}" role="tab">${t}</button>`).join('')}</div>
      <section data-panel="task">
        <div class="statement prose">${md(x.statement, { exercise: x })}</div>
        <div class="section-h">How to work it</div>
        <p class="howto">${review
          ? `Read the PR on the right like a reviewer. <b>Click a line</b> you would comment on and pick which hunt it is (keys <b>1</b> to <b>8</b>). <b>Submit review</b> tells you what you found and what you missed. <b>Clippy</b> shows what Rust's linter says, for comparison.`
          : `<b>Run</b> checks the ${(x.tests || []).filter((t) => t.ex).length} visible tests; <b>Submit</b> runs all ${(x.tests || []).length}. Code runs on the Rust Playground, so each run takes a few seconds.`} Stuck for 10 minutes? Open one hint.</p>
        ${review ? `<div class="hunt-mini">${Object.keys(TAGS).map((t) => tagChip(t)).join('')}</div>` : ''}
        ${nextCard(x.id)}
      </section>
      <section data-panel="hints" hidden></section>
      <section data-panel="solution" hidden></section>
      ${pager(x.id)}`;
    renderHints(x, S.hints[x.id] || 0);
    setExTab(ROUTE.tab || 'task');
    enhance(el.reader, { exercise: x });
    $('.p-tabs', el.reader).addEventListener('click', (e) => {
      const b = e.target.closest('[data-pt]'); if (!b) return;
      history.replaceState(null, '', `#/x/${x.id}${b.dataset.pt === 'task' ? '' : '/' + b.dataset.pt}`);
      setExTab(b.dataset.pt);
    });
  }
  function setExTab(tab) {
    const x = CUR; if (!x) return;
    const panels = $$('[data-panel]', el.reader);
    if (!panels.some((p) => p.dataset.panel === tab)) tab = 'task';
    panels.forEach((p) => { p.hidden = p.dataset.panel !== tab; });
    $$('.p-tabs [data-pt]', el.reader).forEach((b) => b.classList.toggle('on', b.dataset.pt === tab));
    if (tab === 'solution') renderSolution(x);
  }
  function renderHints(x, shown) {
    const sec = $('[data-panel="hints"]', el.reader); if (!sec) return;
    const hs = x.hints || [];
    if (!hs.length) { sec.innerHTML = '<p class="small">No hints for this one.</p>'; return; }
    sec.innerHTML = `<div class="hints">${hs.slice(0, shown).map((h, k) => `<div class="hint-card"><b class="h">Hint ${k + 1}</b>${md(h)}</div>`).join('')}${shown < hs.length ? `<div class="hint-locked"><span>${shown ? `${hs.length - shown} more hint${hs.length - shown > 1 ? 's' : ''}.` : `${hs.length} hints, from a nudge to nearly the answer.`}</span><button class="btn" data-hint>Show hint ${shown + 1}</button></div>` : `<p class="small">That is every hint. Next stop: the ${x.kind === 'review' ? 'answers' : 'solution'} tab.</p>`}</div>`;
    const b = $('[data-hint]', sec);
    if (b) b.onclick = () => { S.hints[x.id] = shown + 1; save(); renderHints(x, shown + 1); };
  }
  function renderSolution(x) {
    const sec = $('[data-panel="solution"]', el.reader);
    if (!sec || sec.dataset.done) return;
    const s = x.solution || {};
    if (!S.seen[x.id] && !S.done[x.id]) {
      sec.innerHTML = `<div class="gate"><p><b>Try it first?</b> Ten honest minutes is where the learning happens. If you are stuck, a hint keeps most of it intact.</p><button class="btn" data-g="hints">Show hints instead</button> <button class="btn primary" data-g="show">Show the ${x.kind === 'review' ? 'answers' : 'solution'}</button></div>`;
      sec.onclick = (e) => {
        const g = e.target.closest('[data-g]'); if (!g) return;
        if (g.dataset.g === 'hints') { history.replaceState(null, '', `#/x/${x.id}/hints`); setExTab('hints'); }
        else { S.seen[x.id] = Date.now(); save(); sec.onclick = null; renderSolution(x); if (x.kind === 'review') paintDiff(); }
      };
      return;
    }
    sec.dataset.done = 1;
    if (x.kind === 'review') {
      sec.innerHTML = `<div class="prose">
        <h2>The planted issues</h2>
        ${x.issues.map((is) => `<div class="issue"><div class="is-top">${tagChip(is.tag)}<span class="small">line${(x.parsed.marks[is.id] || []).length > 1 ? 's' : ''} ${(x.parsed.marks[is.id] || []).join(', ')}</span></div><h3>${inline(is.title)}</h3>${md(is.why)}${is.fix ? `<div class="fix"><b>Fix</b>${md(is.fix)}</div>` : ''}${demoHtml(is)}</div>`).join('')}
        ${(x.decoys || []).length ? `<h2>Looks wrong, but is fine</h2>${x.decoys.map((d) => `<div class="issue decoy"><div class="is-top"><span class="small">line ${(x.parsed.marks[d.id] || []).join(', ')}</span></div>${md(d.why)}</div>`).join('')}` : ''}
        ${s.fixed ? `<h2>The file with every fix</h2>${codeBlock(s.fixed.trim(), { lang: 'rust', label: x.file || 'src/lib.rs' })}` : ''}
        ${s.talk ? `<div class="callout review"><b>Say it in the review</b>${md(s.talk)}</div>` : ''}
      </div>`;
    } else {
      sec.innerHTML = `
        <div class="prose">
          ${s.why ? md(s.why, { exercise: x }) : ''}
          ${s.rust ? `<h2>Reference solution</h2>${codeBlock(s.rust.trim(), { lang: 'rust', label: 'src/lib.rs', ctx: { exercise: x, loadable: true } })}` : ''}
          ${s.talk ? `<div class="callout key"><b>In one breath</b>${md(s.talk)}</div>` : ''}
        </div>`;
    }
    enhance(sec, { exercise: x });
  }

  /* ───────────── Code panel ───────────── */
  let cm = null, fallback = null;
  const touch = matchMedia('(pointer: coarse)').matches;
  const starterFor = (x) => (x.starter || '').replace(/^\n+/, '');
  const diffBox = document.createElement('div'); diffBox.className = 'rv-diff'; diffBox.hidden = true;
  el.editorWrap.appendChild(diffBox);
  function initEditor() {
    if (window.CodeMirror) {
      cm = window.CodeMirror(el.editorWrap, {
        mode: 'rust', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, smartIndent: true,
        matchBrackets: true, autoCloseBrackets: true, styleActiveLine: true, lineWrapping: false,
        inputStyle: touch ? 'contenteditable' : 'textarea', viewportMargin: 50,
        extraKeys: {
          'Ctrl-Enter': () => runCode('run'), 'Cmd-Enter': () => runCode('run'),
          'Shift-Ctrl-Enter': () => runCode('submit'), 'Shift-Cmd-Enter': () => runCode('submit'),
          'Ctrl-/': 'toggleComment', 'Cmd-/': 'toggleComment',
          Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end')),
          'Shift-Tab': (c) => c.indentSelection('subtract'),
        },
      });
      cm.on('change', debounce(() => saveDraft(), 400));
      cm.on('change', () => clearMarks());
    } else {
      fallback = document.createElement('textarea'); fallback.className = 'fallback'; fallback.spellcheck = false; el.editorWrap.appendChild(fallback);
      fallback.addEventListener('input', debounce(saveDraft, 400));
      fallback.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(e.shiftKey ? 'submit' : 'run'); }
        if (e.key === 'Tab') { e.preventDefault(); const s = fallback.selectionStart; fallback.setRangeText('    ', s, fallback.selectionEnd, 'end'); }
      });
    }
  }
  const editorEl = () => (cm ? cm.getWrapperElement() : fallback);
  function clearMarks() { if (cm && cm.__marks) { cm.__marks.forEach((m) => m.clear()); cm.__marks = null; for (let i = 0; i < cm.lineCount(); i++) cm.removeLineClass(i, 'background', 'err-line'); } }
  const getCode = () => (cm ? cm.getValue() : fallback.value);
  const setCode = (src) => { if (cm) cm.setValue(src); else fallback.value = src; };
  function saveDraft() {
    if (!CUR || CUR.kind === 'review') return;
    const code = getCode();
    if (code === starterFor(CUR)) delete S.drafts[CUR.id]; else S.drafts[CUR.id] = { code, at: Date.now() };
    save();
  }
  const LAST = {};  // exercise id → last results html
  function loadEditor(x) {
    const review = x.kind === 'review';
    editorEl().style.display = review ? 'none' : '';
    diffBox.hidden = !review;
    el.code.classList.toggle('reviewing', review);
    if (review) {
      el.fileTabs.innerHTML = `<button class="on">${esc(x.file || 'src/lib.rs')}</button><span class="pr-badge">pull request · ${x.parsed.lines.filter((l) => l.added).length} lines added</span>`;
      el.run.innerHTML = 'Clippy';
      el.run.title = 'What Rust\'s linter says about this PR';
      el.submit.innerHTML = 'Submit review <span class="k">⇧⌘↵</span>';
      el.reset.textContent = 'Clear flags';
      el.reset.title = 'Remove every flag you placed';
      el.codeHint.innerHTML = 'Click a line to flag it · keys <b>1</b> to <b>8</b> pick the hunt';
      paintDiff();
    } else {
      const d = S.drafts[x.id];
      setCode(d ? d.code : starterFor(x));
      if (cm) { cm.clearHistory(); setTimeout(() => cm.refresh(), 0); }
      el.fileTabs.innerHTML = '<button class="on">src/lib.rs</button>';
      el.run.innerHTML = 'Run <span class="k">⌘↵</span>';
      el.run.title = 'Run the visible tests (Ctrl/⌘ + Enter)';
      el.submit.innerHTML = 'Submit <span class="k">⇧⌘↵</span>';
      el.reset.textContent = 'Reset';
      el.reset.title = 'Replace your code with the starter code';
      el.codeHint.innerHTML = `Rust ${E.Play.version || 'stable'} · edition 2024 · tokio available`;
    }
    el.resBody.innerHTML = LAST[x.id] || emptyResults(x);
  }
  function emptyResults(x) {
    if (x.kind === 'review') return reviewDraftHtml(x);
    const ex = (x.tests || []).filter((t) => t.ex).length;
    return `<div class="res-empty"><div><b>Run</b> checks ${ex} visible test${ex === 1 ? '' : 's'}. <b>Submit</b> runs all ${(x.tests || []).length}.</div><div>${x.starterFails === 'compile' ? 'This starter does not compile yet. Press <b>Run</b> to read what the compiler says.' : 'The starter compiles, but the tests fail until you write the code.'}</div></div>`;
  }
  el.reset.onclick = () => {
    if (!CUR) return;
    if (CUR.kind === 'review') {
      modal('Clear every flag?', '<p>Removes all the lines you flagged on this PR.</p>', [{ label: 'Clear', primary: true, fn: () => { delete S.drafts[CUR.id]; delete LAST[CUR.id]; save(); paintDiff(); el.resBody.innerHTML = reviewDraftHtml(CUR); } }]);
      return;
    }
    modal('Reset to the starter code?', '<p>Your current code for this exercise is replaced by the starter code.</p>', [{ label: 'Reset', primary: true, fn: () => { setCode(starterFor(CUR)); delete S.drafts[CUR.id]; save(); } }]);
  };

  /* engine state */
  function renderEngine() {
    const p = E.Play;
    el.engineState.className = 'engine-state ' + (p.state === 'busy' ? 'busy' : p.state === 'offline' ? 'err' : p.state === 'ok' ? 'ok' : '');
    el.engineState.textContent = p.state === 'busy' ? 'on the Rust Playground…' : p.state === 'offline' ? 'Playground unreachable' : `Rust ${p.version || ''} · Playground`;
    el.engineState.title = p.error || 'Your code compiles and runs on play.rust-lang.org, the official Rust Playground.';
    el.run.disabled = el.submit.disabled = running;
  }
  E.Play.listeners.add(renderEngine);

  /* ───────────── Running & grading (fix / build) ───────────── */
  let running = false;
  el.run.onclick = () => runCode('run');
  el.submit.onclick = () => runCode('submit');

  async function runCode(kind) {
    const x = CUR;
    if (!x || running) return;
    if (x.kind === 'review') { if (kind === 'submit') submitReview(); else showClippy(); return; }
    if (narrow()) setMobileTab('code');
    saveDraft();
    const code = getCode();
    const all = x.tests || [];
    const idx = all.map((t, i) => i).filter((i) => kind === 'submit' || all[i].ex);
    const tests = idx.map((i) => all[i]);
    running = true; renderEngine();
    el.resBody.innerHTML = '<div class="res-note"><span class="spin"></span> Compiling and testing on the Rust Playground… (a few seconds)</div>';
    const t0 = performance.now();
    try {
      const built = H.buildTestCrate(code, tests);
      const resp = await E.Play.call('test', built.code);
      const o = H.outcome(resp);
      const html = resultsHtml(x, kind, tests, o, resp, built, performance.now() - t0);
      el.resBody.innerHTML = html;
      LAST[x.id] = html;
      if (o.kind === 'compile-error') markErrors(o.diags, built);
    } catch (e) {
      el.resBody.innerHTML = `<div class="verdict no"><b>Could not run</b></div><div class="res-note">${esc(e.message || e)}</div>`;
    } finally {
      running = false; renderEngine();
    }
  }
  function markErrors(diags, built) {
    if (!cm) return;
    cm.__marks = [];
    for (const d of diags) {
      if (!(d.line > 0) || d.line > built.userLines) continue;
      const line = d.line - 1;
      cm.addLineClass(line, 'background', 'err-line');
      const col = Math.max(0, (d.col || 1) - 1);
      const text = cm.getLine(line) || '';
      let end = col; while (end < text.length && /\w/.test(text[end])) end++;
      if (end === col) end = Math.min(text.length, col + 1);
      cm.__marks.push(cm.markText({ line, ch: col }, { line, ch: end }, { className: 'err-mark' }));
    }
  }
  function diagHtml(diags, built) {
    return diags.slice(0, 8).map((d) => {
      const mine = d.line > 0 && d.line <= built.userLines;
      const where = mine ? `line ${d.line}` : d.line ? 'in the tests' : 'compiler';
      const note = !mine && d.line ? '<div class="dnote">The tests could not use your code. Keep the names and signatures from the starter.</div>' : '';
      return `<div class="diag" data-line="${mine ? d.line : ''}"><span class="where">${esc(where)}${d.code ? ` · ${esc(d.code)}` : ''}</span>${note}<pre class="rustc">${HL.rustc(d.text)}</pre></div>`;
    }).join('') + (diags.length > 8 ? `<div class="res-note">… and ${diags.length - 8} more</div>` : '');
  }
  function resultsHtml(x, kind, tests, o, resp, built, ms) {
    if (o.kind === 'error') return `<div class="verdict no"><b>Could not reach the Playground</b></div><div class="res-note">${esc(o.text)}</div>`;
    if (o.kind === 'timeout') return '<div class="verdict no"><b>Time limit</b><span>10 s</span></div><div class="res-note">The Playground stops anything that runs longer than about 10 seconds. An endless loop, or a wait that never ends?</div>';
    if (o.kind === 'compile-error') {
      const codes = [...new Set(o.diags.map((d) => d.code).filter(Boolean))];
      return `<div class="verdict no"><b>Does not compile</b><span>${o.diags.length} error${o.diags.length === 1 ? '' : 's'}${codes.length ? ' · ' + codes.join(', ') : ''}</span></div><div class="res-note">Read each message top to bottom: what it expected, where, and the <b>help</b> line. Click a message to jump to its line.</div>${diagHtml(o.diags, built)}`;
    }
    const res = H.parseLibtest(resp.stdout, tests.length);
    const rows = tests.map((t, k) => ({ t, res: res[k] }));
    const pass = rows.filter((z) => z.res.status === 'pass').length;
    const firstBad = rows.find((z) => z.res.status !== 'pass');
    const warnings = H.parseDiagnostics(resp.stderr).filter((d) => d.severity === 'warning' && d.line <= built.userLines);
    let verdict;
    if (!firstBad) verdict = `<div class="verdict ok"><b>${kind === 'submit' ? 'All tests pass' : 'Visible tests pass'}</b><span>${pass}/${rows.length} · ${fmtMs(ms)}</span></div>`;
    else verdict = `<div class="verdict no"><b>${firstBad.res.status === 'skip' ? 'Not run' : 'Test failed'}</b><span>${pass}/${rows.length} passed${kind === 'run' ? ' (visible)' : ''}</span></div>`;
    const note = !firstBad && kind === 'run' ? `<div class="res-note">Now <b>Submit</b> to run all ${(x.tests || []).length} tests.</div>` : '';
    const list = rows.map((z) => {
      const ok = z.res.status === 'pass', st = z.res.status;
      const icon = ok ? '✓' : st === 'skip' ? '·' : '✗';
      const detail = !ok && st !== 'skip' ? `<div class="tmsg">${esc(z.res.msg || 'failed')}${z.res.line > built.userLines ? '' : z.res.line ? `<span class="dim"> (your line ${z.res.line})</span>` : ''}</div>` : '';
      const so = z.res.stdout && z.res.stdout.length ? `<pre class="stdout">${esc(z.res.stdout.join('\n'))}</pre>` : '';
      return `<details class="trow ${ok ? 'ok' : st === 'skip' ? 'skip' : 'no'}" ${z === firstBad ? 'open' : ''}><summary><span class="ti">${icon}</span><span class="tn">${esc(z.t.name)}</span>${z.t.ex ? '' : '<span class="hid">hidden</span>'}</summary>${detail}${so}${z.t.ex || S.done[x.id] ? `<pre class="tcode">${HL.rust(String(z.t.code).trim())}</pre>` : '<div class="dim small">The test code shows once the exercise is solved.</div>'}</details>`;
    }).join('');
    const notes = lintNotes(x, getCode());
    const extra = (warnings.length ? `<details class="out-warn"><summary>${warnings.length} compiler warning${warnings.length === 1 ? '' : 's'} in your code</summary><pre class="rustc">${HL.rustc(warnings.map((w) => w.text).join('\n\n'))}</pre></details>` : '')
      + (notes.length ? `<div class="design-notes"><b>Review notes</b> <span class="dim">(quick source checks, not failures)</span><ul>${notes.map((n) => `<li>${inline(n)}</li>`).join('')}</ul></div>` : '');
    if (kind === 'submit') { S.tries[x.id] = (S.tries[x.id] || 0) + 1; save(); }
    if (kind === 'submit' && !firstBad) setTimeout(() => markExDone(x, 'tests'), 30);
    return `${verdict}${note}<div class="tlist">${list}</div>${extra}`;
  }
  function lintNotes(x, code) {
    return (x.lint || []).filter((l) => { const hit = new RegExp(l.re, 'm').test(code); return l.when === 'absent' ? !hit : hit; }).map((l) => l.note);
  }
  const fmtMs = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
  el.resBody.addEventListener('click', (e) => {
    const d = e.target.closest('.diag');
    if (d && d.dataset.line && cm) { cm.focus(); cm.setCursor({ line: +d.dataset.line - 1, ch: 0 }); if (narrow()) setMobileTab('code'); }
    const f = e.target.closest('[data-goto]');
    if (f) { const row = $(`.rv-line[data-n="${f.dataset.goto}"]`, diffBox); if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('pulse'); setTimeout(() => row.classList.remove('pulse'), 900); } }
  });

  /* ───────────── PR review: flag lines, pick a hunt, get graded ───────────── */
  const flagsOf = (x) => ((S.drafts[x.id] && S.drafts[x.id].flags) || {});
  function paintDiff() {
    const x = CUR; if (!x || x.kind !== 'review') return;
    const flags = flagsOf(x);
    const g = LAST_GRADE[x.id];
    const showAll = !!(S.seen[x.id] || S.done[x.id]);
    const issueAt = {};
    if (g) for (const is of g.issues) for (const n of is.lines) issueAt[n] = is.found ? 'found' : showAll ? 'missed' : '';
    if (showAll) for (const is of x.issues) for (const n of x.parsed.marks[is.id] || []) issueAt[n] = issueAt[n] || 'missed';
    diffBox.innerHTML = x.parsed.lines.map((l) => {
      const f = flags[l.n];
      return `<div class="rv-line ${l.added ? 'add' : ''} ${f ? 'flagged' : ''} ${issueAt[l.n] ? 'is-' + issueAt[l.n] : ''}" data-n="${l.n}" tabindex="0" role="button" aria-label="Line ${l.n}${f ? ', flagged as ' + TAGS[f].label : ''}"><span class="ln">${l.n}</span><span class="mk">${l.added ? '+' : ''}</span><code>${HL.rust(l.text) || ' '}</code>${f ? tagChip(f, 'on-line') : ''}</div>`;
    }).join('');
  }
  const LAST_GRADE = {};
  function pickTag(n, anchor) {
    const x = CUR; const flags = flagsOf(x);
    const line = x.parsed.lines[n - 1];
    const p = popover(anchor, `<div class="tag-pick"><div class="tp-head">Line ${n}: what would you comment?</div><code class="tp-code">${HL.rust(line.text.trim())}</code>${Object.entries(GROUPS).map(([g, gr]) => `<div class="tp-group"><small>${esc(gr.label)}</small>${Object.keys(TAGS).filter((t) => TAGS[t].group === g).map((t) => `<button class="item tp h-${t} ${flags[n] === t ? 'on' : ''}" data-m="${t}"><i>${TAGS[t].n}</i><b>${esc(TAGS[t].label)}</b></button>`).join('')}</div>`).join('')}${flags[n] ? '<button class="item tp clear" data-m="clear"><b>Remove this flag</b></button>' : ''}</div>`, (t) => setFlag(n, t === 'clear' ? null : t), { at: anchor.getBoundingClientRect() });
    const onKey = (e) => {
      if (!document.body.contains(p)) { document.removeEventListener('keydown', onKey); return; }
      const k = +e.key;
      if (k >= 1 && k <= 8) { e.preventDefault(); const t = Object.keys(TAGS).find((z) => TAGS[z].n === k); closePop(); setFlag(n, t); document.removeEventListener('keydown', onKey); }
      if (e.key === 'Backspace' || e.key === 'Delete') { closePop(); setFlag(n, null); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);
  }
  function setFlag(n, tag) {
    const x = CUR;
    const d = S.drafts[x.id] || (S.drafts[x.id] = { flags: {}, at: 0 });
    d.flags = d.flags || {};
    if (tag) d.flags[n] = tag; else delete d.flags[n];
    d.at = Date.now();
    if (!Object.keys(d.flags).length) delete S.drafts[x.id];
    save();
    paintDiff();
    if (!LAST[x.id]) el.resBody.innerHTML = reviewDraftHtml(x);
  }
  diffBox.addEventListener('click', (e) => { const row = e.target.closest('.rv-line'); if (row) pickTag(+row.dataset.n, row); });
  diffBox.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.rv-line')) { e.preventDefault(); const row = e.target.closest('.rv-line'); pickTag(+row.dataset.n, row); } });
  function reviewDraftHtml(x) {
    const flags = flagsOf(x);
    const ns = Object.keys(flags).map(Number).sort((a, b) => a - b);
    if (!ns.length) return `<div class="res-empty"><div>Read the PR the way you would at work. When a line deserves a comment, <b>click it</b> and pick the hunt.</div><div>There ${x.issues.length === 1 ? 'is 1 planted issue' : `are ${x.issues.length} planted issues`}. Some lines only look suspicious.</div></div>`;
    return `<div class="res-note">Your review so far: ${ns.length} line${ns.length === 1 ? '' : 's'} flagged. <b>Submit review</b> when you are done.</div><ul class="flag-list">${ns.map((n) => `<li data-goto="${n}"><span class="ln">line ${n}</span>${tagChip(flags[n])}<code>${HL.rust(x.parsed.lines[n - 1].text.trim())}</code></li>`).join('')}</ul>`;
  }
  function submitReview() {
    const x = CUR;
    if (narrow()) setMobileTab('code');
    const flags = flagsOf(x);
    if (!Object.keys(flags).length) { toast('Flag at least one line first: click it in the PR.'); return; }
    const g = H.gradeReview(x, x.parsed, flags);
    LAST_GRADE[x.id] = g;
    S.tries[x.id] = (S.tries[x.id] || 0) + 1; save();
    const byId = Object.fromEntries(x.issues.map((i) => [i.id, i]));
    const decoy = Object.fromEntries((x.decoys || []).map((d) => [d.id, d]));
    const many = Object.keys(flags).length > 3 * x.issues.length;
    const missed = g.issues.filter((i) => !i.found);
    const verdict = g.done
      ? `<div class="verdict ok"><b>You found all ${g.total}</b><span>${g.falseAlarms.length ? `${g.falseAlarms.length} extra flag${g.falseAlarms.length === 1 ? '' : 's'}` : 'no false alarms'}</span></div>`
      : `<div class="verdict no"><b>Found ${g.found} of ${g.total}</b><span>${g.falseAlarms.length} false alarm${g.falseAlarms.length === 1 ? '' : 's'}</span></div>`;
    const found = g.issues.filter((i) => i.found).map((i) => {
      const is = byId[i.id];
      const said = i.flagged.map((n) => flags[n]);
      return `<div class="issue found"><div class="is-top">${tagChip(is.tag)}${i.tagOk ? '<span class="ok-tag">✓ right hunt</span>' : `<span class="small">you said ${said.map((t) => esc(TAGS[t].label)).join(', ')}</span>`}<button class="btn sm quiet" data-goto="${i.lines[0]}">line ${i.lines.join(', ')}</button></div><h3>${inline(is.title)}</h3>${md(is.why)}${is.fix ? `<div class="fix"><b>Fix</b>${md(is.fix)}</div>` : ''}${demoHtml(is)}</div>`;
    }).join('');
    const hidden = missed.length ? `<div class="issue missed"><b>${missed.length} still hidden.</b> ${missed.map((i) => `One is ${tagChip(byId[i.id].tag)}.`).join(' ')} Flag more lines and submit again, or open <b>Answers</b> on the left.</div>` : '';
    const alarms = g.falseAlarms.map((f) => f.decoy
      ? `<div class="issue decoy"><div class="is-top"><button class="btn sm quiet" data-goto="${f.n}">line ${f.n}</button><span class="small">looks suspicious, but it is fine</span></div>${md(decoy[f.decoy].why)}</div>`
      : `<div class="issue decoy"><div class="is-top"><button class="btn sm quiet" data-goto="${f.n}">line ${f.n}</button><span class="small">nothing planted here</span></div><p class="small">If you would still comment on it at work, that is fine. It is just not one of the planted issues.</p></div>`).join('');
    const html = `${verdict}${many ? '<div class="res-note">That is a lot of flags. Flag what you would actually comment on; flagging everything teaches nothing.</div>' : ''}${found}${hidden}${alarms ? `<div class="section-h">Your other flags</div>${alarms}` : ''}`;
    el.resBody.innerHTML = html;
    LAST[x.id] = html;
    paintDiff();
    if (g.done) setTimeout(() => markExDone(x, 'review'), 30);
  }
  async function showClippy() {
    const x = CUR;
    const k = H.key('clippy', x.parsed.code);
    let rec = OUT[k];
    if (!rec) {
      running = true; renderEngine();
      el.resBody.innerHTML = '<div class="res-note"><span class="spin"></span> Asking clippy on the Rust Playground…</div>';
      const o = H.outcome(await E.Play.call('clippy', x.parsed.code));
      rec = H.record(o);
      running = false; renderEngine();
    }
    el.resBody.innerHTML = `<div class="res-note"><b>Clippy</b> is Rust's linter. It catches style slips and some bugs. Compare what it says with what you flagged: the planted issues are the kind a linter cannot judge.</div>${outputHtml(rec, 'clippy')}<p><button class="btn sm" data-back>Back to your review</button></p>`;
    $('[data-back]', el.resBody).onclick = () => { el.resBody.innerHTML = LAST[x.id] || reviewDraftHtml(x); };
  }

  /* ───────────── Done + celebration ───────────── */
  function markExDone(x, how) {
    const first = !S.done[x.id];
    const rec = S.done[x.id] || { first: Date.now(), n: 0 };
    rec.n++; rec.at = Date.now(); rec.how = how;
    rec.hints = Math.max(rec.hints || 0, S.hints[x.id] || 0);
    rec.sawSolution = rec.sawSolution || !!S.seen[x.id];
    S.done[x.id] = rec;
    if (window.RustToday) window.RustToday.seedExercise(x);
    markDay(); save();
    renderNav(); renderChips();
    const pill = $('.p-head', el.reader);
    if (pill && !$('.solved-pill', pill)) pill.insertAdjacentHTML('beforeend', '<span class="solved-pill">✓ Done</span>');
    if (first) { confetti(); toast(how === 'review' ? 'Every planted issue found. Marked as done.' : 'Done! Next step is linked under the task.'); }
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#A5401A', '#237148', '#C17A0B', '#1F5F99', '#B3261E', '#F29E6D'];
    for (let k = 0; k < 60; k++) {
      const i = document.createElement('i');
      i.style.left = Math.random() * 100 + 'vw'; i.style.background = cols[k % cols.length];
      i.style.animationDelay = Math.random() * 0.4 + 's'; i.style.animationDuration = 1 + Math.random() * 0.8 + 's';
      box.appendChild(i);
    }
    document.body.appendChild(box); setTimeout(() => box.remove(), 2600);
  }

  /* ───────────── Splitters ───────────── */
  (function splitters() {
    const split = $('#split'), vsplit = $('#vsplit');
    try { const w = localStorage.getItem('rustlab.codeW'); if (w) el.app.style.setProperty('--code-w', w); const rh = localStorage.getItem('rustlab.resH'); if (rh) el.code.style.setProperty('--results-h', rh); } catch { /* blocked */ }
    split.addEventListener('pointerdown', (e) => {
      split.classList.add('drag'); split.setPointerCapture(e.pointerId);
      const move = (ev) => { const px = Math.max(340, Math.min(window.innerWidth - 420, window.innerWidth - ev.clientX)); el.app.style.setProperty('--code-w', px + 'px'); };
      const up = () => { split.classList.remove('drag'); split.removeEventListener('pointermove', move); try { localStorage.setItem('rustlab.codeW', el.app.style.getPropertyValue('--code-w')); } catch { /* */ } if (cm) cm.refresh(); };
      split.addEventListener('pointermove', move); split.addEventListener('pointerup', up, { once: true });
    });
    vsplit.addEventListener('pointerdown', (e) => {
      vsplit.classList.add('drag'); vsplit.setPointerCapture(e.pointerId);
      const box = el.code.getBoundingClientRect();
      const move = (ev) => { const px = Math.max(90, Math.min(box.height - 160, box.bottom - ev.clientY - 44)); el.code.style.setProperty('--results-h', px + 'px'); };
      const up = () => { vsplit.classList.remove('drag'); vsplit.removeEventListener('pointermove', move); try { localStorage.setItem('rustlab.resH', el.code.style.getPropertyValue('--results-h')); } catch { /* */ } if (cm) cm.refresh(); };
      vsplit.addEventListener('pointermove', move); vsplit.addEventListener('pointerup', up, { once: true });
    });
  })();

  /* ───────────── Sync support: merging two copies of the state ───────────── */
  const DEVICE_ONLY = ['open', 'focus'];
  const newer = (a, b) => ((b && (b.at || 0)) > (a && (a.at || 0)) ? b : a);
  function mergeState(local, remote) {
    if (!remote || remote.v !== 1) return local;
    const out = { ...blank(), ...local };
    const byAt = (k) => { const a = local[k] || {}, b = remote[k] || {}; const o = { ...a }; for (const id of Object.keys(b)) o[id] = a[id] === undefined ? b[id] : newer(a[id], b[id]); out[k] = o; };
    ['done', 'drafts', 'cards', 'quiz'].forEach(byAt);
    const maxNum = (k) => { const a = local[k] || {}, b = remote[k] || {}; const o = { ...a }; for (const id of Object.keys(b)) o[id] = Math.max(a[id] || 0, b[id] || 0); out[k] = o; };
    ['hints', 'tries', 'seen', 'read', 'days'].forEach(maxNum);
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

  /* ───────────── Self-test (run in the browser console) ─────────────
   * await rustSelfTest()   every fix/build solution on the Playground, through the page's own code path */
  window.rustSelfTest = async function ({ filter = '' } = {}) {
    const list = ALL_EX.filter((x) => x.id.includes(filter) && x.kind !== 'review');
    const fails = [];
    const t0 = performance.now();
    for (const x of list) {
      const built = H.buildTestCrate(x.solution.rust, x.tests);
      const o = H.outcome(await E.Play.call('test', built.code));
      if (o.kind === 'compile-error' || o.kind === 'error') { fails.push({ id: x.id, why: o.text.slice(0, 200) }); continue; }
      const res = H.parseLibtest(o.stdout, x.tests.length);
      res.forEach((r, i) => { if (r.status !== 'pass') fails.push({ id: x.id, test: x.tests[i].name, why: r.status + ' ' + (r.msg || '') }); });
    }
    for (const x of ALL_EX.filter((z) => z.kind === 'review' && z.id.includes(filter))) {
      const g = H.gradeReview(x, x.parsed, Object.fromEntries(x.issues.map((i) => [x.parsed.marks[i.id][0], i.tag])));
      if (!g.done || g.falseAlarms.length) fails.push({ id: x.id, why: 'flagging every planted line does not grade as done' });
    }
    const msg = `rustSelfTest: ${list.length} exercises in ${((performance.now() - t0) / 1000).toFixed(0)} s, ${fails.length} problem${fails.length === 1 ? '' : 's'}`;
    console.log(msg); if (fails.length) console.table(fails);
    return { ok: !fails.length, fails, msg };
  };

  /* ───────────── Boot ───────────── */
  window.RustApp = {
    get S() { return S; }, save, saveNow, md, inline, esc, codeBlock, outputHtml, exList, quizHtml, predictHtml, predictOf, quizOf, huntCard, huntsHtml, tagChip, enhance, toast, modal, popover,
    EX, LESSON, MOD, MODS, ITEMS, ALL_EX, PAGES, ENHANCERS, TAGS, GROUPS, OUT, isDone, modStats, markDay, nextItem, hrefOf, itemMins, kindLabel,
    route, renderNav, renderChips, listeners, mergeState, applyMerged, syncable, blank,
    ago: (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; },
    get CUR() { return CUR; },
  };
  initEditor();
  renderEngine();
  setFocus(S.focus);
  window.RustApp.start = function () {
    E.Play.loadVersion();
    route();
  };
})();
