// Tiny static server for Deep End: every lab, as GitHub Pages serves them.
// The in-browser compilers need http(s), so opening the files from disk won't work.
//   Usage:  node serve.mjs  → http://localhost:8767
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 8767);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.sql': 'text/plain; charset=utf-8',
  '.java': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.bin': 'application/octet-stream',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const path = normalize(join(root, url.endsWith('/') ? url + 'index.html' : url));
  if (!path.startsWith(root) || path.slice(root.length).split(sep).some((seg) => seg.startsWith('.'))) { res.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) {
    // like GitHub Pages: /rust → /rust/, so the lab's relative links resolve
    if (e.code === 'EISDIR') res.writeHead(301, { location: url + '/' }).end();
    else res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`Deep End → http://localhost:${port}`));
