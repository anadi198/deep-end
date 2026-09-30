// In-browser Java compiler: OpenJDK javac + TeaVM (WebAssembly GC backend), both compiled to Wasm.
// Messages in:  { id, files: { 'Name.java': source }, mainClass }
// Messages out: { ready, ms } once, then { id, ok, diags, wasm, ms, javacMs } per request.
import { load } from '../vendor/teavm/compiler.wasm-runtime.js';

const t0 = performance.now();
let compiler = null;
let diags = [];

async function init() {
  const teavm = await load('../vendor/teavm/compiler.wasm', { stackDeobfuscator: { enabled: false } });
  compiler = teavm.exports.createCompiler();
  const bin = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return new Int8Array(await r.arrayBuffer()); };
  const [sdk, cls] = await Promise.all([bin('../vendor/teavm/compile-classlib-teavm.bin'), bin('../vendor/teavm/runtime-classlib-teavm.bin')]);
  compiler.setSdk(sdk);
  compiler.setTeaVMClasslib(cls);
  compiler.onDiagnostic((d) => {
    diags.push({ type: d.type, severity: d.severity, file: d.fileName ? String(d.fileName).replace(/^.*[\\/]/, '') : null, line: d.lineNumber, col: d.type === 'javac' ? d.columnNumber : 0, message: String(d.message) });
  });
}

const ready = init().then(
  () => postMessage({ ready: true, ms: performance.now() - t0 }),
  (e) => postMessage({ ready: false, error: String((e && e.message) || e) }),
);

self.onmessage = async (e) => {
  await ready;
  const { id, files, mainClass } = e.data;
  const t = performance.now();
  diags = [];
  try {
    compiler.clearSourceFiles();
    compiler.clearOutputFiles();
    for (const [name, src] of Object.entries(files)) compiler.addSourceFile(name, src);
    let ok = compiler.compile();
    const javacMs = performance.now() - t;
    let wasm = null;
    if (ok) {
      ok = compiler.generateWebAssembly({ outputName: 'app', mainClass });
      if (ok) wasm = compiler.getWebAssemblyOutputFile('app.wasm');
    }
    const errs = diags.filter((d) => d.severity === 'error');
    if (!ok && !errs.length) diags.push({ type: 'teavm', severity: 'error', file: null, line: -1, col: 0, message: 'Compilation failed without a message.' });
    postMessage({ id, ok: !!ok, diags, wasm, ms: performance.now() - t, javacMs }, wasm ? [wasm.buffer] : []);
  } catch (err) {
    postMessage({ id, ok: false, diags: [...diags, { type: 'internal', severity: 'error', file: null, line: -1, col: 0, message: 'The in-browser compiler crashed: ' + ((err && err.message) || err) + '. Try again, or switch to "Your JDK".' }], ms: performance.now() - t });
  }
};
