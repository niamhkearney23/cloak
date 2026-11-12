import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { makePlanted, PLANTED, PHOTO_GPS } from './planted.js';
import { pdfFile, stream, scanImage } from './matter.js';
import { cloakFolder } from '../run.js';
import { extractBuffer, closeOcr } from '../extract.js';
import { writeZip } from '../zip.js';

// COMPLETENESS RULE: every part of every file is read, or the file is blocked.
// All files here are made up (planted.js).

const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');
const word = (w) => new RegExp(`(?<![\\p{L}])${w}(?![\\p{L}])`, 'iu');

let root, out, run, written;
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'cloak-planted-'));
  out = path.join(root, 'out');
  await makePlanted(path.join(root, 'in'));
  run = await cloakFolder({ folder: path.join(root, 'in'), outDir: out });
  written = (await Promise.all((await readdir(out)).map((n) => readFile(path.join(out, n), 'utf8')))).join('\n');
});
after(() => closeOcr());

test('a name planted in every part of every file type is read', () => {
  const places = Object.keys(PLANTED);
  assert.ok(places.length >= 55, `only ${places.length} places planted`);
  const everything = run.files.map((f) => [f.rel, ...f.parts.map((p) => p.text)].join('\n').replace(/_/g, ' ')).join('\n');
  const unread = places.filter((place) => !everything.includes(PLANTED[place].name));
  assert.deepEqual(unread, [], `not read: ${unread.join('; ')}`);
});

test('no planted name appears in any cloaked file or in the report', () => {
  const leaked = Object.entries(PLANTED).filter(([, p]) => p.words.some((w) => word(w).test(written))).map(([place, p]) => `${place} (${p.name})`);
  assert.deepEqual(leaked, [], `leaked: ${leaked.join('; ')}`);
});

test('each place is covered: Word, PDF, Excel, email, images, names of files and folders', () => {
  for (const place of [
    'Word: body', 'Word: header', 'Word: footer', 'Word: footnote', 'Word: endnote', 'Word: comment', 'Word: comment author',
    'Word: tracked change (inserted)', 'Word: tracked change (deleted)', 'Word: tracked change author', 'Word: text box', 'Word: table',
    'Word: embedded image', 'Word: properties (author)', 'Word: properties (last modified by)', 'Word: properties (manager)',
    'PDF: text layer', 'PDF: scanned page', 'PDF: annotation', 'PDF: annotation author', 'PDF: form field', 'PDF: bookmark', 'PDF: attachment', 'PDF: properties (author)',
    'Excel: cell', 'Excel: hidden sheet', 'Excel: hidden row', 'Excel: hidden column', 'Excel: cell comment', 'Excel: comment author', 'Excel: formula', 'Excel: sheet name', 'Excel: defined name',
    'Email: subject', 'Email: sender', 'Email: recipient', 'Email: cc', 'Email: bcc', 'Email: body', 'Email: quoted earlier email', 'Email: signature', 'Email: attachment',
    'Zip: file inside a zip', 'Zip: Email: bcc', 'Zip: attachment inside an email inside a zip',
    'Image: text in the picture', 'Image: photo details (author)', 'Image: PNG text in the picture', 'Image: PNG details (author)',
    'Hidden file', 'File name', 'Folder name',
  ]) assert.ok(PLANTED[place], `the test set has no name planted in "${place}"`);
});

test('where a photo was taken is read and hidden', () => {
  const photo = run.files.find((f) => f.rel === 'receipt photo.jpg');
  assert.ok(photo.parts.some((p) => p.text.includes(`GPS location: ${PHOTO_GPS}`)), 'GPS position was not read');
  assert.match(photo.cloaked, /GPS location: \{\{LOCATION_\d+\}\}/);
  assert.ok(!written.includes('3.157') && !written.includes('101.712'));
});

test('every file is read: hidden files, sub-folders, files in a zip, attachments', () => {
  const rels = run.files.map((f) => f.rel);
  for (const r of ['.hidden note.txt', 'bundle.zip', 'bundle.zip/inside/zipped email.eml', 'bundle.zip/inside/zipped email.eml/note.txt', 'bundle.zip/inside/plain note.txt', 'email.eml/letter.docx', 'letter.pdf/note.txt']) assert.ok(rels.includes(r), `${r} was not read as a file`);
  assert.ok(rels.some((r) => /^Client .*\/Statement of .*\.txt$/.test(r)));
  assert.equal(run.report.totals.files_on_disk, 9);
  assert.equal(run.report.totals.files_including_those_inside_others, 14);
  assert.equal(run.report.totals.cloaked, 13);
  assert.equal(run.report.totals.archives_opened, 1);
  assert.equal(run.report.totals.partly_read_blocked + run.report.totals.unreadable_blocked + run.report.totals.needs_manual_check, 0);
});

test('proof of reading: the report shows what was found, what was read, and what went through OCR', async () => {
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  const byType = (t, inside = null) => report.files.find((f) => f.type === t && f.found_inside === inside);
  const pdf = byType('pdf');
  assert.equal(pdf.proof.pages_found, 2);
  assert.equal(pdf.proof.pages_read, 2);
  assert.deepEqual(pdf.proof.went_through_ocr, [2]);
  assert.ok(pdf.proof.characters_extracted > 400);
  assert.deepEqual(pdf.proof.could_not_be_read, []);
  assert.ok(pdf.proof.parts_read.some((p) => /^Bookmarks: \d+ characters$/.test(p)));
  assert.ok(pdf.proof.parts_read.some((p) => /^Document properties/.test(p)));
  const sheet = byType('xlsx');
  assert.equal(sheet.proof.sheets_found, 3);
  assert.equal(sheet.proof.sheets_read, 3);
  assert.ok(sheet.proof.parts_read.some((p) => /hidden sheet/.test(p)));
  const doc = byType('docx');
  assert.ok(doc.proof.parts_read.length >= 10);
  assert.deepEqual(doc.proof.went_through_ocr, ['Picture 1']);
  for (const f of report.files) assert.ok(f.status && f.proof, 'every file has a status and proof');
});

test('cloaked copies are plain text rebuilt from what was read, never a copy of the original', async () => {
  const names = await readdir(out);
  for (const n of names) assert.match(n, /^(?:\d+-\w+\.cloaked\.txt|cloak-report\.json|NOT-REVIEWED\.txt)$/);
  for (const n of names) {
    const head = (await readFile(path.join(out, n))).subarray(0, 4).toString('latin1');
    assert.ok(!/^(?:PK\x03\x04|%PDF|\xff\xd8|\x89PNG)/.test(head), `${n} looks like an original file`);
  }
});

// ---- a file that is only partly read is blocked

async function runOn(files) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-part-'));
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, 'in', rel)), { recursive: true });
    await writeFile(path.join(dir, 'in', rel), content);
  }
  const r = await cloakFolder({ folder: path.join(dir, 'in'), outDir: path.join(dir, 'out') });
  r.outNames = await readdir(path.join(dir, 'out'));
  r.outText = (await Promise.all(r.outNames.map((n) => readFile(path.join(dir, 'out', n), 'utf8')))).join('\n');
  return r;
}
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const simpleDocx = (text, extra = {}) => writeZip({ 'word/document.xml': `<w:document ${W}><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`, ...extra });

test('a Word file with a part that cannot be read is blocked, not half-exported', async () => {
  const r = await runOn({
    'with object.docx': simpleDocx('The buyer is Jamilah binti Majid.', { 'word/embeddings/oleObject1.bin': Buffer.from('\xd0\xcf\x11\xe0 binary object naming Bakri bin Sarip', 'latin1') }),
    'with macro.docm': simpleDocx('The seller is Hasnah binti Ripin.', { 'word/vbaProject.bin': Buffer.from('compiled macro bytes') }),
    'fine.docx': simpleDocx('The witness is Nasir bin Bujang.'),
  });
  const by = (n) => r.files.find((f) => f.rel === n);
  assert.equal(by('with object.docx').status, 'partial');
  assert.match(by('with object.docx').reasons.join(' '), /embedded object/);
  assert.equal(by('with macro.docm').status, 'partial');
  assert.equal(by('fine.docx').status, 'cloaked');
  assert.equal(r.outNames.filter((n) => n.endsWith('.cloaked.txt')).length, 1);
  assert.doesNotMatch(r.outText, /Jamilah|Majid|Hasnah|Ripin|Bakri|Sarip|Nasir|Bujang/);
  assert.equal(r.report.totals.partly_read_blocked, 2);
});

test('an email is blocked when one of its attachments cannot be read', async () => {
  const b = 'bb';
  const eml = ['From: "Kalsom binti Tarmizi" <k@mail.example>', 'To: office@firm.example', 'Subject: Old memo', `Content-Type: multipart/mixed; boundary="${b}"`, '', `--${b}`, 'Content-Type: text/plain', '', 'Please see the attached memo.', `--${b}`, 'Content-Type: application/msword; name="memo.doc"', 'Content-Transfer-Encoding: base64', 'Content-Disposition: attachment; filename="memo.doc"', '', Buffer.from('old word bytes').toString('base64'), `--${b}--`, ''].join('\r\n');
  const r = await runOn({ 'mail.eml': eml, 'pack.zip': writeZip({ 'good.txt': 'Zahari bin Saidin signed.', 'bad.doc': 'old word bytes' }) });
  const by = (n) => r.files.find((f) => f.rel === n);
  assert.equal(by('mail.eml/memo.doc').status, 'unreadable');
  assert.equal(by('mail.eml').status, 'partial');
  assert.equal(by('mail.eml').out, undefined);
  // In a zip, one unreadable file does not block its neighbours.
  assert.equal(by('pack.zip/bad.doc').status, 'unreadable');
  assert.equal(by('pack.zip/good.txt').status, 'cloaked');
  assert.doesNotMatch(r.outText, /Kalsom|Tarmizi|Zahari|Saidin/);
});

// ---- pages that cannot be trusted

const pagePng = (draw) => { const c = createCanvas(1240, 1754); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1240, 1754); draw(g); return c.toBuffer('image/png'); };

test('handwriting-like marks, a faint scan and a blank page are told apart', async () => {
  const scribble = await extractBuffer('scribble.png', pagePng((g) => {
    g.strokeStyle = '#000'; g.lineWidth = 4;
    for (let k = 0; k < 6; k++) { g.beginPath(); for (let i = 0; i < 60; i++) g.lineTo(100 + i * 16, 300 + k * 120 + Math.sin(i * 1.3 + k) * 35 + Math.cos(i * 0.7) * 20); g.stroke(); }
  }));
  assert.equal(scribble.status, 'manual');
  assert.match(scribble.reasons.join(' '), /manual check/);

  const faint = await extractBuffer('faint.png', pagePng((g) => {
    g.fillStyle = '#d9d9d9'; g.font = '22px serif';
    ['Received from the tenant the sum stated above', 'in full and final settlement of all claims', 'signed this day before the witness named below'].forEach((l, i) => g.fillText(l, 120, 300 + i * 50));
    for (let i = 0; i < 9000; i++) { g.fillStyle = i % 2 ? '#999' : '#ccc'; g.fillRect((i * 7919) % 1240, (i * 104729) % 1754, 2, 2); }
  }));
  assert.equal(faint.status, 'manual');

  const blank = await extractBuffer('blank.png', pagePng(() => {}));
  assert.equal(blank.status, 'ok');
  const clear = await extractBuffer('clear.png', pagePng((g) => { g.fillStyle = '#000'; g.font = '34px serif'; g.fillText('This page is clear print and reads well.', 120, 300); }));
  assert.equal(clear.status, 'ok');
  assert.match(clear.parts[0].text, /clear print/);
});

test('a PDF page with almost no typed text is read as a picture too', async () => {
  // The words are a picture; the text layer only holds a page number.
  const jpg = scanImage(['The deposit was paid to Hanafi bin Marzuki', 'in cash at the office on the same day.']).toBuffer('image/jpeg');
  const pdf = pdfFile([
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [4 0 R] /Count 1 >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 6 0 R >> >> /Contents 5 0 R >>',
    stream('', 'q 595 0 0 842 0 0 cm /Im0 Do Q BT /F1 9 Tf 280 30 Td (Page 1 of 1 - scanned bundle) Tj ET'),
    stream('/Type /XObject /Subtype /Image /Width 1654 /Height 2339 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', jpg),
  ]);
  const r = await extractBuffer('bundle.pdf', pdf);
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.proof.ocr, [1]);
  assert.ok(r.parts.some((p) => /text found only in pictures/.test(p.label) && /Hanafi bin Marzuki/.test(p.text)), 'the words in the picture were not read');
});

test('less obvious places are read too: document variables, WordArt, bookmarks, UTF-16 text', async () => {
  const docx = simpleDocx('Body text.', {
    'word/settings.xml': `<w:settings ${W}><w:docVars><w:docVar w:name="ClientName" w:val="Roslan bin Ramlan"/></w:docVars></w:settings>`,
    'word/header1.xml': `<w:hdr ${W} xmlns:v="v"><w:p><w:bookmarkStart w:id="1" w:name="Azizah_binti_Sidin"/><w:r><w:pict><v:shape><v:textpath string="Harun bin Dahlan"/></v:shape></w:pict></w:r></w:p></w:hdr>`,
  });
  const r = await extractBuffer('vars.docx', docx);
  const all = r.parts.map((p) => p.text).join('\n');
  for (const name of ['Roslan bin Ramlan', 'Azizah binti Sidin', 'Harun bin Dahlan']) assert.ok(all.includes(name), `${name} was not read`);

  const utf16 = await extractBuffer('note.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Signed by Maimunah binti Ramlan.', 'utf16le')]));
  assert.match(utf16.parts[0].text, /Maimunah binti Ramlan/);
});
