// Used by offline.test.js, under the network tripwire:
//   node --require test/net-tripwire.cjs test/offline-run.js
// Cloaks the made-up 20-file matter (Word, Excel, PDF, scans through OCR,
// emails, a picture), so every reader runs, in the reading threads and the
// OCR threads. Then it tries the network twice on purpose, once from this
// thread and once from a new worker thread, to show the tripwire is armed in
// both.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { makeMatter } from './matter.js';
import { cloakFolder } from '../run.js';

const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-offline-'));
const docs = path.join(root, 'documents');
await makeMatter(docs);
const run = await cloakFolder({ folder: docs, outDir: path.join(root, 'cloaked'), user: 'offline-test', concurrency: 2 });
console.log(JSON.stringify({ files: run.files.length, ocr: run.report.totals.ocr_files, cloaked: run.report.totals.cloaked }));

try { await fetch('https://example.com/'); } catch { /* refused, as it should be */ }
await new Promise((resolve) => {
  const w = new Worker("try { fetch('https://example.org/'); } catch {}", { eval: true });
  w.on('exit', resolve);
  w.on('error', resolve);
});
process.exit(0);
