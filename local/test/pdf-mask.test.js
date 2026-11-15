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

test('a picture stored as a 1-bit image mask on a typed page is read', { timeout: 120000 }, async () => {
  const typed = {
    resources: (n) => `<< /Font << /F1 ${n} 0 R >> /XObject << /Im1 ${n + 1} 0 R >> >>`,
    content: `BT /F1 10 Tf 40 760 Td 13 TL ${['Made-up firm, Advocates and Solicitors, 1 March 2026.', 'RE: Made-up matter between Contoh Sdn Bhd and a made-up purchaser.', 'This page has a typed text layer that is longer than two hundred characters,', 'as a searchable scan or a typed letter with a pasted-in picture would have.', 'The picture below holds words that are not in this typed text at all.'].map((l) => `(${l}) '`).join(' ')} ET q 600 0 0 200 6 400 cm /Im1 Do Q`,
    objects: ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', { dict: `/Type /XObject /Subtype /Image /Width 1200 /Height 400 /ImageMask true ${FAX_DICT}`, data: FAX }],
  };
  const r = await read('mask.pdf', multiPagePdf([typed]));
  assert.deepEqual(r.proof.ocr, [1], JSON.stringify(r.proof));
  assert.match(allText(r), /Zulkarnain/);
});
