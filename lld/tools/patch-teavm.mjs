// Patches the TeaVM class libraries that the in-browser Java engine uses.
//
//   node tools/patch-teavm.mjs [srcDir] [outDir]
//
// srcDir holds the unmodified files from https://teavm.org/playground/ (default: vendor/teavm/orig,
// falling back to vendor/teavm). The patched archives are written to outDir (default: vendor/teavm).
//
// Four fixes:
//  1. compile-classlib-teavm.bin (the stubs javac compiles against) still names nested classes by
//     their TeaVM-internal names in InnerClasses attributes, e.g. `org/teavm/classlib/java/util/TMap$Entry`
//     instead of `java/util/Map$Entry`. javac then can't resolve `Map.Entry`. We rename those strings.
//  2. A few small static methods that LeetCode-style Java uses all the time are missing from both
//     the stubs and TeaVM's runtime classes: Integer.sum (for `map.merge(k, 1, Integer::sum)`),
//     Long.sum/max/min and Double.sum/max/min. We add them to both archives.
//  3. Stub methods still carrying TeaVM's internal names (getMessage0 ...), see STUB_RENAMES.
//  4. Overloads that became identical after fix 1 (StringBuilder.append(Object) twice), which makes
//     javac call every such call ambiguous. See ClassFile.hideDuplicateMethods.
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.join(here, '..', 'vendor', 'teavm');
const srcDir = process.argv[2] || (fs.existsSync(path.join(vendor, 'orig')) ? path.join(vendor, 'orig') : vendor);
const outDir = process.argv[3] || vendor;

function readArchive(file) {
  const b = zlib.gunzipSync(fs.readFileSync(file));
  const out = new Map();
  let p = 0;
  while (p < b.length) {
    const nl = b.readUInt16BE(p); p += 2;
    const name = b.subarray(p, p + nl).toString('utf8'); p += nl;
    const sz = b.readUInt32BE(p); p += 4;
    out.set(name, Buffer.from(b.subarray(p, p + sz))); p += sz;
  }
  return out;
}
function writeArchive(file, entries) {
  const parts = [];
  for (const [name, data] of entries) {
    const nb = Buffer.from(name, 'utf8');
    const h = Buffer.alloc(2 + nb.length + 4);
    h.writeUInt16BE(nb.length, 0); nb.copy(h, 2); h.writeUInt32BE(data.length, 2 + nb.length);
    parts.push(h, data);
  }
  fs.writeFileSync(file, zlib.gzipSync(Buffer.concat(parts), { level: 9 }));
}

// Minimal class-file editor: parses the constant pool and the method table, lets us rename Utf8
// constants, append constants and append methods, then re-serialises.
class ClassFile {
  constructor(buf) {
    this.buf = buf;
    let p = 8;
    const n = buf.readUInt16BE(p); p += 2;
    this.cp = [null];
    for (let i = 1; i < n; i++) {
      const start = p, tag = buf[p++];
      let s = null;
      if (tag === 1) { const l = buf.readUInt16BE(p); p += 2; s = buf.subarray(p, p + l).toString('utf8'); p += l; }
      else if (tag === 3 || tag === 4) p += 4;
      else if (tag === 5 || tag === 6) p += 8;
      else if ([7, 8, 16, 19, 20].includes(tag)) p += 2;
      else if ([9, 10, 11, 12, 17, 18].includes(tag)) p += 4;
      else if (tag === 15) p += 3;
      else throw new Error('bad constant tag ' + tag);
      this.cp.push({ tag, s, raw: buf.subarray(start, p) });
      if (tag === 5 || tag === 6) { this.cp.push(null); i++; }
    }
    this.bodyStart = p;                       // access_flags
    p += 6;
    const ic = buf.readUInt16BE(p); p += 2 + 2 * ic;
    const skipMembers = () => {
      const c = buf.readUInt16BE(p); p += 2;
      for (let i = 0; i < c; i++) {
        p += 6;
        const ac = buf.readUInt16BE(p); p += 2;
        for (let j = 0; j < ac; j++) { const l = buf.readUInt32BE(p + 2); p += 6 + l; }
      }
    };
    skipMembers();                            // fields
    this.methodsAt = p;
    this.methodCount = buf.readUInt16BE(p);
    skipMembers();                            // methods
    this.methodsEnd = p;
    this.added = [];
    this.newMethods = [];
  }
  utf8(s) {
    for (let i = 1; i < this.cp.length; i++) if (this.cp[i] && this.cp[i].tag === 1 && this.cp[i].s === s) return i;
    return this.add(1, Buffer.from(s, 'utf8'), s);
  }
  add(tag, payload, s = null) {
    let raw;
    if (tag === 1) { raw = Buffer.alloc(3 + payload.length); raw[0] = 1; raw.writeUInt16BE(payload.length, 1); payload.copy(raw, 3); }
    else { raw = Buffer.concat([Buffer.from([tag]), payload]); }
    this.cp.push({ tag, s, raw });
    return this.cp.length - 1;
  }
  u2s(...v) { const b = Buffer.alloc(2 * v.length); v.forEach((x, i) => b.writeUInt16BE(x, 2 * i)); return b; }
  classRef(name) { return this.add(7, this.u2s(this.utf8(name))); }
  methodRef(cls, name, desc) {
    const nt = this.add(12, this.u2s(this.utf8(name), this.utf8(desc)));
    return this.add(10, this.u2s(this.classRef(cls), nt));
  }
  renameUtf8(fn) {
    let changed = 0;
    for (const e of this.cp) {
      if (!e || e.tag !== 1) continue;
      const t = fn(e.s);
      if (t !== e.s) {
        const b = Buffer.from(t, 'utf8');
        e.raw = Buffer.alloc(3 + b.length); e.raw[0] = 1; e.raw.writeUInt16BE(b.length, 1); b.copy(e.raw, 3);
        e.s = t; changed++;
      }
    }
    return changed;
  }
  fieldRef(cls, name, desc) {
    const nt = this.add(12, this.u2s(this.utf8(name), this.utf8(desc)));
    return this.add(9, this.u2s(this.classRef(cls), nt));
  }
  // Replaces a method's whole Code attribute with straight-line bytecode (no branches, so no
  // StackMapTable is needed). Returns false if the method is absent.
  replaceMethodCode(name, desc, code) {
    let p = this.methodsAt + 2;
    for (let i = 0; i < this.methodCount; i++) {
      const start = p;
      const nm = this.cp[this.buf.readUInt16BE(p + 2)].s, d = this.cp[this.buf.readUInt16BE(p + 4)].s;
      p += 6;
      const ac = this.buf.readUInt16BE(p); p += 2;
      for (let j = 0; j < ac; j++) { const l = this.buf.readUInt32BE(p + 2); p += 6 + l; }
      if (nm !== name || d !== desc) continue;
      const body = Buffer.concat([this.u2s(code.maxStack, code.maxLocals), Buffer.alloc(4), code.bytes, this.u2s(0, 0)]);
      body.writeUInt32BE(code.bytes.length, 4);
      const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
      const method = Buffer.concat([this.buf.subarray(start, start + 6), this.u2s(1, this.utf8('Code')), len, body]);
      this.buf = Buffer.concat([this.buf.subarray(0, start), method, this.buf.subarray(p)]);
      this.methodsEnd += method.length - (p - start);
      return true;
    }
    return false;
  }
  // After internal names are mapped to java/*, two TeaVM overloads (TObject vs Object) can end up
  // with the same name and descriptor; javac then calls every use of them ambiguous. Mark the later
  // copies synthetic bridges, which javac ignores. Returns how many were marked.
  hideDuplicateMethods() {
    const seen = new Set();
    let p = this.methodsAt + 2, marked = 0;
    for (let i = 0; i < this.methodCount; i++) {
      const key = this.cp[this.buf.readUInt16BE(p + 2)].s + this.cp[this.buf.readUInt16BE(p + 4)].s;
      const flags = this.buf.readUInt16BE(p);
      if (!(flags & 0x0040)) {
        if (seen.has(key)) {
          this.buf = Buffer.from(this.buf);
          this.buf.writeUInt16BE(flags | 0x1040, p);
          marked++;
        } else seen.add(key);
      }
      p += 6;
      const ac = this.buf.readUInt16BE(p); p += 2;
      for (let j = 0; j < ac; j++) { const l = this.buf.readUInt32BE(p + 2); p += 6 + l; }
    }
    return marked;
  }
  // Points an existing method at a new name (a fresh Utf8 constant); returns false if absent.
  renameMethod(name, desc, newName) {
    let p = this.methodsAt + 2;
    for (let i = 0; i < this.methodCount; i++) {
      const nm = this.cp[this.buf.readUInt16BE(p + 2)].s, d = this.cp[this.buf.readUInt16BE(p + 4)].s;
      if (nm === name && d === desc) {
        this.buf = Buffer.from(this.buf);
        this.buf.writeUInt16BE(this.utf8(newName), p + 2);
        return true;
      }
      p += 6;
      const ac = this.buf.readUInt16BE(p); p += 2;
      for (let j = 0; j < ac; j++) { const l = this.buf.readUInt32BE(p + 2); p += 6 + l; }
    }
    return false;
  }
  hasMethod(name, desc) {
    let p = this.methodsAt + 2;
    for (let i = 0; i < this.methodCount; i++) {
      const nm = this.cp[this.buf.readUInt16BE(p + 2)].s, d = this.cp[this.buf.readUInt16BE(p + 4)].s;
      if (nm === name && d === desc) return true;
      p += 6;
      const ac = this.buf.readUInt16BE(p); p += 2;
      for (let j = 0; j < ac; j++) { const l = this.buf.readUInt32BE(p + 2); p += 6 + l; }
    }
    return false;
  }
  // code: null for a signature-only stub, else { maxStack, maxLocals, bytes: Buffer }
  addMethod(flags, name, desc, code) {
    if (this.hasMethod(name, desc)) return false;
    const parts = [this.u2s(flags, this.utf8(name), this.utf8(desc))];
    if (!code) parts.push(this.u2s(0));
    else {
      const body = Buffer.concat([this.u2s(code.maxStack, code.maxLocals), Buffer.alloc(4), code.bytes, this.u2s(0, 0)]);
      body.writeUInt32BE(code.bytes.length, 4);
      const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
      parts.push(this.u2s(1, this.utf8('Code')), len, body);
    }
    this.newMethods.push(Buffer.concat(parts));
    return true;
  }
  toBuffer() {
    const count = Buffer.alloc(2); count.writeUInt16BE(this.cp.length);
    const mc = Buffer.alloc(2); mc.writeUInt16BE(this.methodCount + this.newMethods.length);
    return Buffer.concat([
      this.buf.subarray(0, 8), count, ...this.cp.filter(Boolean).map((e) => e.raw),
      this.buf.subarray(this.bodyStart, this.methodsAt), mc,
      this.buf.subarray(this.methodsAt + 2, this.methodsEnd), ...this.newMethods,
      this.buf.subarray(this.methodsEnd),
    ]);
  }
}

const ACC_PUBLIC_STATIC = 0x0009;
const TMATH = 'org/teavm/classlib/java/lang/TMath';
// [class, name, descriptor, runtime bytecode builder]
const ADDITIONS = [
  ['java/lang/Integer', 'sum', '(II)I', () => ({ maxStack: 2, maxLocals: 2, bytes: Buffer.from([0x1a, 0x1b, 0x60, 0xac]) })],
  ['java/lang/Long', 'sum', '(JJ)J', () => ({ maxStack: 4, maxLocals: 4, bytes: Buffer.from([0x1e, 0x20, 0x61, 0xad]) })],
  ['java/lang/Double', 'sum', '(DD)D', () => ({ maxStack: 4, maxLocals: 4, bytes: Buffer.from([0x26, 0x28, 0x63, 0xaf]) })],
  ...['max', 'min'].flatMap((m) => [
    ['java/lang/Long', m, '(JJ)J', (cf) => callStatic(cf, [0x1e, 0x20], m, '(JJ)J', 0xad)],
    ['java/lang/Double', m, '(DD)D', (cf) => callStatic(cf, [0x26, 0x28], m, '(DD)D', 0xaf)],
  ]),
];
// Stub-only fixes: annotation elements javac needs (a missing SuppressWarnings.value() sends the
// in-browser javac into infinite recursion while it reports the error).
const STUB_ONLY = [
  ['java/lang/SuppressWarnings', 0x0401, 'value', '()[Ljava/lang/String;'],
];
// Stub-only renames. TeaVM's class library declares some methods as «getMessage0» with a @Rename
// annotation that TeaVM applies when it builds the program, so they work at runtime, but javac
// only sees the stubs and reports "cannot find symbol getMessage()". wait/notify stay hidden on
// purpose: there are no threads in the browser engine. clone() and getSuppressed() stay hidden too:
// they compile once renamed but trap at runtime, and a compile error is kinder than a crash.
const STUB_RENAMES = [
  ['java/lang/Throwable', 'getMessage0', '()Ljava/lang/String;', 'getMessage'],
  ['java/lang/Throwable', 'getLocalizedMessage0', '()Ljava/lang/String;', 'getLocalizedMessage'],
  ['java/lang/Throwable', 'toString0', '()Ljava/lang/String;', 'toString'],
  ['java/lang/Throwable', 'getStackTrace0', '()[Ljava/lang/StackTraceElement;', 'getStackTrace'],
  ['java/lang/Throwable', 'getClass0', '()Ljava/lang/Class;', 'getClass'],
  ['java/lang/Object', 'getClass0', '()Ljava/lang/Class;', 'getClass'],
  ['java/lang/annotation/Annotation', 'annotationType0', '()Ljava/lang/Class;', 'annotationType'],
  ['java/net/URISyntaxException', 'getMessage0', '()Ljava/lang/String;', 'getMessage'],
];
function callStatic(cf, loads, name, desc, ret) {
  const ref = cf.methodRef(TMATH, name, desc);
  return { maxStack: 4, maxLocals: 4, bytes: Buffer.from([...loads, 0xb8, ref >> 8, ref & 255, ret]) };
}

// 1+2a. compile stubs
const compile = readArchive(path.join(srcDir, 'compile-classlib-teavm.bin'));
let renamed = 0, methodRenames = 0, duplicatesHidden = 0;
const toJava = (s) => s.replace(/org\/teavm\/classlib\/((?:[a-z0-9_]+\/)*)T([A-Za-z0-9_]+)((?:\$[A-Za-z0-9_]+)*)/g, (m, pkg, name, nested) => {
  const target = pkg + name + nested;
  return compile.has(target + '.class') ? target : m;
});
for (const [name, data] of compile) {
  if (!name.endsWith('.class')) continue;
  const cf = new ClassFile(data);
  const n = cf.renameUtf8(toJava);
  const adds = ADDITIONS.filter(([c]) => c + '.class' === name);
  for (const [, m, d] of adds) cf.addMethod(ACC_PUBLIC_STATIC, m, d, null);
  const stubs = STUB_ONLY.filter(([c]) => c + '.class' === name);
  for (const [, flags, m, d] of stubs) cf.addMethod(flags, m, d, null);
  let rn = 0;
  for (const [c, from, d, to] of STUB_RENAMES) if (c + '.class' === name && !cf.hasMethod(to, d) && cf.renameMethod(from, d, to)) rn++;
  const hidden = cf.hideDuplicateMethods();
  if (n || adds.length || stubs.length || rn || hidden) { compile.set(name, cf.toBuffer()); renamed += n; methodRenames += rn; duplicatesHidden += hidden; }
}
writeArchive(path.join(outDir, 'compile-classlib-teavm.bin'), compile);
console.log(`compile classlib: renamed ${renamed} internal class names, ${methodRenames} methods to their Java names, hid ${duplicatesHidden} duplicate overloads, added ${ADDITIONS.length + STUB_ONLY.length} method stubs`);

// 2b. runtime classes
const runtime = readArchive(path.join(srcDir, 'runtime-classlib-teavm.bin'));
let added = 0;
for (const [cls, m, d, build] of ADDITIONS) {
  const entry = cls.replace(/^java\/lang\//, 'org/teavm/classlib/java/lang/T') + '.class';
  const cf = new ClassFile(runtime.get(entry));
  if (cf.addMethod(ACC_PUBLIC_STATIC, m, d, build(cf))) added++;
  runtime.set(entry, cf.toBuffer());
}
// 2c. TTreeSet.add stores the element as the map value («map.put(e, e) != VALUE»), but remove()
// answers «map.remove(o) == VALUE». So remove() returned false for anything added with add(), and
// add() returned true for duplicates. Store VALUE instead: return Objects.isNull(map.put(e, VALUE)).
{
  const TS = 'org/teavm/classlib/java/util/TTreeSet', TM = 'org/teavm/classlib/java/util/TTreeMap';
  const cf = new ClassFile(runtime.get(TS + '.class'));
  const map = cf.fieldRef(TS, 'map', `L${TM};`);
  const value = cf.fieldRef(TS, 'VALUE', 'Ljava/lang/Object;');
  const put = cf.methodRef(TM, 'put', '(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;');
  const isNull = cf.methodRef('org/teavm/classlib/java/util/TObjects', 'isNull', '(Ljava/lang/Object;)Z');
  const bytes = Buffer.from([0x2a, 0xb4, map >> 8, map & 255, 0x2b, 0xb2, value >> 8, value & 255, 0xb6, put >> 8, put & 255, 0xb8, isNull >> 8, isNull & 255, 0xac]);
  if (cf.replaceMethodCode('add', '(Ljava/lang/Object;)Z', { maxStack: 3, maxLocals: 2, bytes })) { runtime.set(TS + '.class', cf.toBuffer()); added++; }
  else console.warn('TTreeSet.add not found; TreeSet fix skipped');
}
writeArchive(path.join(outDir, 'runtime-classlib-teavm.bin'), runtime);
console.log(`runtime classlib: added or replaced ${added} methods`);
