import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Proof that cloaking makes no network call: a whole cloak of the made-up
// matter runs with the tripwire (net-tripwire.cjs) loaded into every thread,
// and every attempt to use the network is recorded and refused. The window
// side (Chromium) is checked by the licence test in app.test.js.

const here = path.dirname(fileURLToPath(import.meta.url));

test('a whole cloak of the made-up matter makes no network call from any thread', { timeout: 300000 }, async () => {
  const log = path.join(await mkdtemp(path.join(os.tmpdir(), 'cloak-tripwire-')), 'tripwire.log');
  await writeFile(log, '');
  const child = spawn(process.execPath, ['--require', path.join(here, 'net-tripwire.cjs'), path.join(here, 'offline-run.js')], { env: { ...process.env, CLOAK_NET_TRIPWIRE: log } });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, stderr);
  const summary = JSON.parse(stdout.trim().split('\n').pop());
  assert.equal(summary.files, 20);
  assert.ok(summary.ocr >= 2, 'the scans went through OCR');
  const entries = (await readFile(log, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // Only the two attempts made on purpose at the end, one from the main thread and one from a worker thread.
  assert.deepEqual(entries.map((e) => [e.what, e.detail, e.thread === 0 ? 'main thread' : 'worker thread']), [
    ['fetch', 'https://example.com/', 'main thread'],
    ['fetch', 'https://example.org/', 'worker thread'],
  ], JSON.stringify(entries, null, 1));
});
