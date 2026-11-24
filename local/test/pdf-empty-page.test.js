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

test('the reader version was raised for these changes', () => {
  assert.ok(READER_VERSION >= 3);
});

test('a page whose picture cannot be decoded is flagged and not counted as read', { timeout: 120000 }, async () => {
  const junk = Buffer.alloc(4000);
  for (let i = 0; i < junk.length; i++) junk[i] = (i * 2654435761) >>> 24;
  const r = await read('letter-fax-bad.pdf', multiPagePdf([
    LETTER,
    scanPage(1200, 400, FAX_DICT, FAX),
    scanPage(1200, 400, '/BitsPerComponent 1 /Filter /JBIG2Decode', junk),
  ]));
  assert.equal(r.status, 'manual', JSON.stringify(r.reasons));
  assert.match(r.reasons.join(' '), /Page 3/);
  assert.equal(r.proof.found, 3);
  assert.equal(r.proof.read, 2, 'page 3 is not counted as read');
  assert.equal(r.proof.unread.length, 1);
  assert.match(allText(r), /Zulkarnain/, 'the good fax page is still read');
});

test('a truncated JPEG 2000 scan after a letter is flagged', { timeout: 120000 }, async () => {
  const r = await read('letter-jpx-cut.pdf', multiPagePdf([LETTER, scanPage(640, 110, '/BitsPerComponent 8 /Filter /JPXDecode', JPX.subarray(0, 200))]));
  assert.equal(r.status, 'manual');
  assert.match(r.reasons.join(' '), /Page 2/);
  assert.equal(r.proof.read, 1);
});

test('a scanned page with only a typed Bates stamp left is flagged', { timeout: 120000 }, async () => {
  const r = await read('bates.pdf', multiPagePdf([LETTER, scanPage(640, 110, '/BitsPerComponent 8 /Filter /JPXDecode', JPX.subarray(0, 200), 'EXH-ZK-000017')]));
  assert.equal(r.status, 'manual');
  assert.match(r.reasons.join(' '), /Page 2/);
});

test('a page of text whose character map cannot be loaded is flagged, not counted as read', { timeout: 120000 }, async () => {
  const cjk = {
    resources: (n) => `<< /Font << /F1 ${n} 0 R >> >>`,
    // Made-up Chinese line in a font whose character map does not exist.
    content: 'BT /F1 24 Tf 72 700 Td <5F204E096B206B3E4E945343> Tj ET\n',
    objects: [
      '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /NoSuchMap-UCS2-H /DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /DW 1000 >>] >>',
    ],
  };
  const r = await read('cmap-missing.pdf', multiPagePdf([LETTER, cjk]));
  assert.equal(r.status, 'manual', JSON.stringify(r));
  assert.match(r.reasons.join(' '), /Page 2/);
  assert.equal(r.proof.read, 1);
});
