import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.vrm': 'model/gltf-binary', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/play' || pathname === '/play/') pathname = '/play.html';
    const target = path.resolve(root, '.' + pathname);
    if (!target.startsWith(root) || pathname.split('/').some(segment => segment.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    const contents = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(contents);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Rosebay: http://127.0.0.1:${port}/play`));
