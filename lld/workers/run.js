// Runs one compiled program (TeaVM WebAssembly) and streams its stdout back.
// In:  { wasm: Int8Array, args: string[] }
// Out: { lines: string[] } batches, then { done: true, ms } or { trap: message, ms }
import { load } from '../vendor/teavm/compiler.wasm-runtime.js';

self.onmessage = async (e) => {
  const { wasm, args } = e.data;
  let buf = '', errBuf = '', batch = [], sent = 0, bytes = 0;
  const flush = () => { if (batch.length) { postMessage({ lines: batch }); batch = []; } };
  const push = (line) => {
    bytes += line.length;
    if (bytes > 8e6) throw new Error('output limit exceeded (8 MB) — is something printing in a loop?');
    batch.push(line); sent++;
    if (line.startsWith('@@@') || batch.length >= 200) flush();
  };
  let mod;
  try {
    mod = await load(wasm, {
      installImports(o) {
        o.teavmConsole.putcharStdout = (c) => { if (c === 10) { push(buf); buf = ''; } else buf += String.fromCharCode(c); };
        o.teavmConsole.putcharStderr = (c) => { if (c === 10) { push('@@@ERR ' + errBuf); errBuf = ''; } else errBuf += String.fromCharCode(c); };
      },
    });
  } catch (err) {
    postMessage({ trap: 'could not load the compiled program: ' + ((err && err.message) || err), ms: 0 });
    return;
  }
  const t = performance.now();
  try {
    mod.exports.main(args || []);
    if (buf) push(buf);
    flush();
    postMessage({ done: true, ms: performance.now() - t });
  } catch (err) {
    if (buf) { try { push(buf); } catch { /* over limit */ } }
    flush();
    postMessage({ trap: String((err && err.message) || err), ms: performance.now() - t });
  }
};
