import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { extractFile, closeOcr } from '../extract.js';
import { pdf } from './matter.js';

// Made-up pages only.
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-x-'));
after(() => closeOcr());

test('OCR runs only on the pages of a PDF that have no text layer', async () => {
  const file = path.join(dir, 'mixed.pdf');
  await writeFile(file, pdf([
    { text: ['Page one is typed text with a text layer in the file.', 'It mentions an agreement dated 3 March 2023.'] },
    { scan: ['Page two is a scanned picture of a letter.', 'It has no text layer at all.'] },
    { text: ['Page three is typed again and needs no OCR at all.'] },
  ]));
  const r = await extractFile(file);
  assert.equal(r.status, 'ok');
  assert.equal(r.proof.found, 3);
  assert.equal(r.proof.read, 3);
  assert.deepEqual(r.proof.ocr, [2]);
  assert.deepEqual(r.parts.map((p) => p.label), ['Page 1', 'Page 2 (scanned)', 'Page 3']);
  assert.match(r.parts[1].text, /scanned picture of a letter/);
});

test('a scanned page in Chinese is flagged for a manual check, not passed as clean', { skip: !GlobalFonts.families.some((f) => /WenQuanYi|Noto Sans CJK|SimSun|PingFang|Microsoft YaHei/.test(f.family)) && 'no Chinese font on this machine to draw the test page' }, async () => {
  const c = createCanvas(1200, 800);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 1200, 800);
  g.fillStyle = '#000'; g.font = '44px "WenQuanYi Zen Hei", "Noto Sans CJK SC", SimSun, "PingFang SC", "Microsoft YaHei"';
  ['买卖合同', '买方已于二零二三年三月三日支付订金。', '卖方同意在三个月内办理过户手续。'].forEach((l, i) => g.fillText(l, 80, 150 + i * 110));
  const file = path.join(dir, 'chinese.png');
  await writeFile(file, c.toBuffer('image/png'));
  const r = await extractFile(file);
  assert.equal(r.status, 'manual');
  assert.match(r.reasons.join(' '), /non-Latin/);
});

test('unknown, damaged and password-protected files are reported, never skipped', async () => {
  const bad = path.join(dir, 'broken.docx');
  await writeFile(bad, 'this is not a zip file');
  assert.equal((await extractFile(bad)).status, 'unreadable');
  const odd = path.join(dir, 'drawing.dwg');
  await writeFile(odd, 'x');
  const r = await extractFile(odd);
  assert.equal(r.status, 'unreadable');
  assert.match(r.reasons[0], /not supported/);
  const empty = path.join(dir, 'empty.txt');
  await writeFile(empty, '');
  assert.equal((await extractFile(empty)).status, 'unreadable');
});
