// Runs in a worker thread: reads files one at a time so several cores can
// work on a folder at once. Text goes back to the main thread in memory only.
import { parentPort } from 'node:worker_threads';
import { extractTree, closeOcr } from './extract.js';

parentPort.on('message', async (msg) => {
  if (msg.type === 'close') {
    await closeOcr();
    process.exit(0);
  }
  const started = Date.now();
  // The file and every file found inside it (attachments, zip entries).
  const results = await extractTree(msg.file, msg.rel);
  parentPort.postMessage({ id: msg.id, results, ms: Date.now() - started });
});
