import zlib from 'node:zlib'; import fs from 'node:fs';
export function readArchive(path) {
  const b = zlib.gunzipSync(fs.readFileSync(path)); const out = new Map(); let p = 0;
  while (p < b.length) { const nl = b.readUInt16BE(p); p += 2; const name = b.subarray(p, p + nl).toString('utf8'); p += nl; const sz = b.readUInt32BE(p); p += 4; out.set(name, b.subarray(p, p + sz)); p += sz; }
  return out;
}
export function parseClass(buf) {
  let p = 8; const u2 = () => { const v = buf.readUInt16BE(p); p += 2; return v; }; const u4 = () => { const v = buf.readUInt32BE(p); p += 4; return v; };
  const n = u2(); const cp = [null];
  for (let i = 1; i < n; i++) { const tag = buf[p++]; let e = { tag };
    if (tag === 1) { const l = u2(); e.s = buf.subarray(p, p + l).toString('utf8'); p += l; }
    else if (tag === 3 || tag === 4) { p += 4; } else if (tag === 5 || tag === 6) { p += 8; cp.push(e); i++; e = { tag: 0 }; }
    else if (tag === 7 || tag === 8 || tag === 16 || tag === 19 || tag === 20) { e.i = u2(); }
    else if (tag === 9 || tag === 10 || tag === 11 || tag === 12 || tag === 17 || tag === 18) { e.a = u2(); e.b = u2(); }
    else if (tag === 15) { p += 3; } else throw new Error('tag ' + tag);
    cp.push(e); }
  const str = (i) => cp[i].s; const cls = (i) => i ? str(cp[i].i) : null;
  const access = u2(); const self = cls(u2()); const sup = cls(u2()); const ic = u2(); const ifs = []; for (let i = 0; i < ic; i++) ifs.push(cls(u2()));
  const readAttrs = () => { const c = u2(); const a = []; for (let i = 0; i < c; i++) { const nm = str(u2()); const l = u4(); a.push({ name: nm, off: p, len: l }); p += l; } return a; };
  const fields = []; const fc = u2(); for (let i = 0; i < fc; i++) { const acc = u2(); const nm = str(u2()); const d = str(u2()); readAttrs(); fields.push({ acc, nm, d }); }
  const methods = []; const mc = u2(); for (let i = 0; i < mc; i++) { const acc = u2(); const nm = str(u2()); const d = str(u2()); readAttrs(); methods.push({ acc, nm, d }); }
  const attrsStart = p; const attrs = readAttrs();
  return { cp, access, self, sup, ifs, fields, methods, attrs, attrsStart };
}
