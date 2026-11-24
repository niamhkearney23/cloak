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

test('a faint grey scan (mid-grey text) still goes through OCR', { timeout: 120000 }, async () => {
  const faint = deflateSync(greyPicture('Statement of Encik Zulkarnain\nMade-up faint test page', 170));
  const r = await read('letter-faint.pdf', multiPagePdf([LETTER, scanPage(1200, 400, '/BitsPerComponent 8 /Filter /FlateDecode', faint)]));
  assert.deepEqual(r.proof.ocr, [2], JSON.stringify(r.proof));
  assert.match(allText(r), /Zulkarnain/);
});
