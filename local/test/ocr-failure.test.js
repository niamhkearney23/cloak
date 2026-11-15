import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractFile, closeOcr, READER_VERSION } from '../extract.js';
import { cloakFolder } from '../run.js';
import { FAX, FAX_DICT, JPX, LETTER, multiPagePdf, scanPage, greyPicture } from './pdf-kit.js';

after(() => closeOcr());

// The completeness rule: every page is read, or the file is flagged. A page
// that came out empty because its picture could not be decoded must never
// count as read.

async function read(name, bytes) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-pdfcomplete-'));
  const file = path.join(dir, name);
  await writeFile(file, bytes);
  return extractFile(file);
}
const allText = (r) => r.parts.map((p) => p.text).join('\n');

test('a picture the OCR engine cannot open fails that file with a reason and the folder still finishes', { timeout: 180000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-badpic-'));
  const docs = path.join(root, 'documents');
  await mkdir(docs);
  await writeFile(path.join(docs, 'a scan.jpg'), Buffer.alloc(0));
  await writeFile(path.join(docs, 'b scan.png'), Buffer.from('this is not really a png picture'));
  await writeFile(path.join(docs, 'c note.txt'), 'Made-up note from Messrs Example about the made-up matter.');
  await writeFile(path.join(docs, 'd note.txt'), 'A second made-up note, also readable.');
  const run = await Promise.race([
    cloakFolder({ folder: docs, outDir: path.join(root, 'out'), user: 'test', concurrency: 1, write: false }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('the run hung')), 90000).unref()),
  ]);
  const by = Object.fromEntries(run.files.map((f) => [f.rel, f]));
  assert.equal(by['a scan.jpg'].status, 'unreadable');
  assert.match(by['a scan.jpg'].reasons.join(' '), /picture|image/i);
  assert.equal(by['b scan.png'].status, 'unreadable');
  assert.equal(by['c note.txt'].status, 'cloaked');
  assert.equal(by['d note.txt'].status, 'cloaked');
});

test('an unreadable picture on its own does not kill the reader', { timeout: 120000 }, async () => {
  const r = await read('empty.jpg', Buffer.alloc(0));
  assert.equal(r.status, 'unreadable');
  const again = await read('ok.txt', 'still alive');
  assert.equal(again.status, 'ok');
});
