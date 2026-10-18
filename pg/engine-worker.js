/* Postgres Lab: the engine worker. PGlite runs here, off the page's thread; app.js talks to it with {id, op} messages.
 * A real file, not a blob, so the offline copy's service worker sees its requests. */
import { PGlite } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/index.js';
import { pg_trgm } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/contrib/pg_trgm.js';
import { pg_stat_statements } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/contrib/pg_stat_statements.js';
import { btree_gist } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/contrib/btree_gist.js';
import { pageinspect } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/contrib/pageinspect.js';
import { pg_visibility } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.5.8/dist/contrib/pg_visibility.js';
const EXT = { pg_trgm, pg_stat_statements, btree_gist, pageinspect, pg_visibility };
let db = null, RAW = {};
const post = (m) => self.postMessage(m);
async function openDb(blob) {
  if (db) { try { await db.close(); } catch (e) {} db = null; }
  db = await PGlite.create({ loadDataDir: blob || undefined, extensions: EXT });
  RAW = {};
  for (const k of Object.keys(db.parsers || {})) RAW[k] = (x) => x;
  for (const k of [16, 17, 20, 21, 23, 26, 114, 700, 701, 1082, 1083, 1114, 1184, 1186, 1700, 2950, 3802]) RAW[k] = (x) => x;
  try { Object.assign(db.parsers, RAW); } catch (e) {}
}
const errObj = (e) => ({ message: (e && e.message) || String(e), code: e && e.code, detail: e && e.detail, hint: e && e.hint,
  position: e && e.position, where: e && e.where, severity: e && e.severity });
async function runOne(sql, maxRows) {
  const notices = []; const t0 = performance.now();
  try {
    const res = await db.exec(sql, { rowMode: 'array', parsers: RAW,
      onNotice: (n) => notices.push({ severity: n.severity, message: n.message, detail: n.detail, hint: n.hint }) });
    const ms = performance.now() - t0;
    const results = res.map((r) => ({
      fields: (r.fields || []).map((f) => ({ name: f.name, type: f.dataTypeID })),
      rows: (r.rows || []).slice(0, maxRows), total: (r.rows || []).length,
      command: r.command, rowCount: r.rowCount, affected: r.affectedRows }));
    return { ok: true, results, notices, ms, intx: db.isInTransaction() };
  } catch (e) {
    return { ok: false, error: errObj(e), notices, ms: performance.now() - t0, intx: db.isInTransaction() };
  }
}
self.onmessage = async ({ data }) => {
  const { id, op } = data;
  try {
    if (op === 'open') {
      await openDb(data.blob);
      post({ id, ok: true });
    } else if (op === 'seed') {
      await openDb(null);
      for (let i = 0; i < data.steps.length; i++) {
        post({ type: 'progress', i, label: data.steps[i][0] });
        const t0 = performance.now();
        await db.exec(data.steps[i][1]);
        post({ type: 'progress', i, label: data.steps[i][0], done: true, ms: performance.now() - t0 });
      }
      post({ id, ok: true });
    } else if (op === 'exec') {
      post(Object.assign({ id }, await runOne(data.sql, data.maxRows == null ? 500 : data.maxRows)));
    } else if (op === 'dump') {
      if (db.isInTransaction()) throw new Error('Finish your open transaction (COMMIT or ROLLBACK) before saving a snapshot.');
      await db.exec('CHECKPOINT');
      const blob = await db.dumpDataDir('gzip');
      post({ id, ok: true, blob });
    }
  } catch (e) { post({ id, ok: false, error: errObj(e) }); }
};
