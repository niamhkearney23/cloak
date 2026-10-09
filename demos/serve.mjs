// Serves the concept demos on http://localhost:8080 with no dependencies.
//
//   node demos/serve.mjs            # then open http://localhost:8080
//   PORT=9000 node demos/serve.mjs
//
// Each demo lives in its own folder and works as a plain static page, so
// you can also open the index.html files straight from disk.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4' };

const INDEX = `<!doctype html><meta charset="utf-8"><title>Concept demos</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#1c2230}a{color:#1f4e79}li{margin:8px 0}</style>
<h1>Concept demos</h1><p>Three small working examples built to show the kind of thing I make. All names and figures are fictional.</p>
<ol><li><a href="/legal-dashboard/">Legal dashboard</a> — matters, deadlines and task assignment.</li>
<li><a href="/marketing-automation/">Marketing automation</a> — a new enquiry triggers a follow-up workflow.</li>
<li><a href="/booking-site/">Booking website</a> — choose a treatment, pick a time, get a confirmation.</li></ol>`;

http.createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/') { res.writeHead(200, { 'content-type': TYPES['.html'] }); return res.end(INDEX); }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(ROOT, '.' + pathname);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(PORT, () => console.log(`Concept demos: http://localhost:${PORT}`));
