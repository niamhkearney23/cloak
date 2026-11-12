// A made-up file set with one invented name planted in every place a file
// can hold text. The completeness test fails if any planted name is not read
// or shows up in cloaked output.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { writeZip } from '../zip.js';
import { pdfFile, stream, textPage, scanImage } from './matter.js';

// One distinct made-up name per place. All use bin/binti so that reading,
// not name detection, is what the test measures.
const FIRST = ['Hamidah', 'Kamal', 'Rashid', 'Zaleha', 'Rosnah', 'Jalil', 'Mariam', 'Azhar', 'Latifah', 'Borhan', 'Salmah', 'Fauzi', 'Rokiah', 'Hashim', 'Zubaidah', 'Nordin', 'Halimah', 'Sufian', 'Maznah', 'Tajuddin', 'Asmah', 'Yahya', 'Normah', 'Zamri', 'Saodah', 'Mokhtar', 'Rubiah', 'Shukri', 'Khadijah', 'Ghazali', 'Rahimah', 'Johari', 'Zaharah', 'Mansor', 'Faridah', 'Idris', 'Jamilah', 'Bakri', 'Hasnah', 'Nasir', 'Kalsom', 'Zahari', 'Sakinah', 'Hanafi', 'Maimunah', 'Roslan', 'Azizah', 'Harun'];
const FATHER = ['Sulong', 'Zainal', 'Deraman', 'Musa', 'Jaafar', 'Lebai', 'Kechik', 'Pandak', 'Derus', 'Tumin', 'Jidin', 'Buyong', 'Kulop', 'Mamat', 'Senik', 'Dollah', 'Lajis', 'Embong', 'Tahar', 'Saad', 'Jantan', 'Endut', 'Itam', 'Timah', 'Besar', 'Seman', 'Yaakob', 'Bidin', 'Leman', 'Puteh', 'Siraj', 'Tompang', 'Kadir', 'Mahat', 'Supian', 'Ludin', 'Majid', 'Sarip', 'Ripin', 'Bujang', 'Tarmizi', 'Saidin', 'Marzuki', 'Ramlan', 'Sidin', 'Jusoh', 'Dahlan', 'Kulub'];

/** place -> planted name, filled in as the files are built. */
export const PLANTED = {};
let used = 0;
function plant(place) {
  const i = used++;
  // Each place gets its own pairing of first name and father's name.
  const first = FIRST[i % FIRST.length];
  const father = FATHER[(i + Math.floor(i / FIRST.length) * 11) % FATHER.length];
  const female = /ah$|am$|om$/.test(first);
  const name = `${first} ${female ? 'binti' : 'bin'} ${father}`;
  PLANTED[place] = { name, words: [first, father] };
  return name;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const run = (t) => `<w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const para = (t) => `<w:p>${run(t)}</w:p>`;

function wordFile() {
  const picture = scanImage([`Cheque payable to ${plant('Word: embedded image')}`]).toBuffer('image/png');
  const body = [
    para(`This statement is made by ${plant('Word: body')} of Ipoh.`),
    `<w:tbl><w:tr><w:tc>${para('Witness')}</w:tc><w:tc>${para(plant('Word: table'))}</w:tc></w:tr></w:tbl>`,
    `<w:p><w:ins w:id="1" w:author="${esc(plant('Word: tracked change author'))}">${run(`Inserted: the guarantor is ${plant('Word: tracked change (inserted)')}.`)}</w:ins></w:p>`,
    `<w:p><w:del w:id="2" w:author="Reviewer"><w:r><w:delText>Deleted: the first buyer was ${esc(plant('Word: tracked change (deleted)'))}.</w:delText></w:r></w:del></w:p>`,
    `<w:p><w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wps"><w:drawing><wps:txbx><w:txbxContent>${para(`Text box: call ${plant('Word: text box')} first.`)}</w:txbxContent></wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent>${para(`Text box: call ${PLANTED['Word: text box'].name} first.`)}</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`,
  ].join('');
  return writeZip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`,
    'word/header1.xml': `<w:hdr ${W}>${para(`Matter of ${plant('Word: header')}`)}</w:hdr>`,
    'word/footer1.xml': `<w:ftr ${W}>${para(`Prepared for ${plant('Word: footer')}`)}</w:ftr>`,
    'word/footnotes.xml': `<w:footnotes ${W}><w:footnote>${para(`See the letter from ${plant('Word: footnote')}.`)}</w:footnote></w:footnotes>`,
    'word/endnotes.xml': `<w:endnotes ${W}><w:endnote>${para(`As told by ${plant('Word: endnote')}.`)}</w:endnote></w:endnotes>`,
    'word/comments.xml': `<w:comments ${W}><w:comment w:id="0" w:author="${esc(plant('Word: comment author'))}">${para(`Check this with ${plant('Word: comment')}.`)}</w:comment></w:comments>`,
    'word/media/image1.png': picture,
    'docProps/core.xml': `<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>${esc(plant('Word: properties (author)'))}</dc:creator><cp:lastModifiedBy>${esc(plant('Word: properties (last modified by)'))}</cp:lastModifiedBy><dc:title>Statement</dc:title></cp:coreProperties>`,
    'docProps/app.xml': `<Properties><Manager>${esc(plant('Word: properties (manager)'))}</Manager></Properties>`,
  });
}

function excelFile() {
  const sheet = (rows) => `<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`;
  const cell = (ref, text) => `<c r="${ref}" t="inlineStr"><is><t>${esc(text)}</t></is></c>`;
  return writeZip({
    'xl/workbook.xml': `<workbook xmlns:r="r"><sheets><sheet name="Payments" sheetId="1" r:id="rId1"/><sheet name="Old list" sheetId="2" state="hidden" r:id="rId2"/><sheet name="${esc(plant('Excel: sheet name'))}" sheetId="3" r:id="rId3"/></sheets><definedNames><definedName name="${plant('Excel: defined name').replace(/ /g, '_')}">Payments!$A$1</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet([
      `<row r="1">${cell('A1', 'Payee')}${cell('B1', plant('Excel: cell'))}</row>`,
      `<row r="2" hidden="1">${cell('A2', 'Hidden row')}${cell('B2', plant('Excel: hidden row'))}</row>`,
      `<row r="3"><c r="A3" t="str"><f>"Paid to "&amp;"${esc(plant('Excel: formula'))}"</f><v>Paid</v></c><c r="Z3" t="inlineStr"><is><t>${esc(`Far column: ${plant('Excel: hidden column')}`)}</t></is></c></row>`,
    ]),
    'xl/worksheets/sheet2.xml': sheet([`<row r="1">${cell('A1', `Earlier payee: ${plant('Excel: hidden sheet')}`)}</row>`]),
    'xl/worksheets/sheet3.xml': sheet([`<row r="1">${cell('A1', 'Totals')}</row>`]),
    'xl/comments1.xml': `<comments><authors><author>${esc(plant('Excel: comment author'))}</author></authors><commentList><comment ref="B1" authorId="0"><text><r><t>${esc(`Confirm with ${plant('Excel: cell comment')}.`)}</t></r></text></comment></commentList></comments>`,
  });
}

function pdfDocument() {
  const s = (t) => `(${t.replace(/[\\()]/g, '\\$&')})`;
  const jpg = scanImage([`Scanned page: received by ${plant('PDF: scanned page')}`]).toBuffer('image/jpeg');
  const attachment = `Attached note: the money was handed to ${plant('PDF: attachment')}.`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R /Outlines 10 0 R /AcroForm << /Fields [9 0 R] /DA (/F1 10 Tf 0 g) /DR << /Font << /F1 3 0 R >> >> >> /Names << /EmbeddedFiles << /Names [(note.txt) 12 0 R] >> >> >>',
    '<< /Type /Pages /Kids [4 0 R 6 0 R] /Count 2 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R /Annots [8 0 R 9 0 R] >>',
    stream('', textPage(['LETTER', '', `We write on behalf of ${plant('PDF: text layer')} about the outstanding sum.`, 'The sum has been outstanding for more than ninety days despite two reminders.', 'Unless it is paid within fourteen days we have instructions to begin proceedings.', 'Please let us have your reply by return so that costs can be avoided.'])),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 7 0 R >> >> /Contents 14 0 R >>',
    stream('/Type /XObject /Subtype /Image /Width 1654 /Height 2339 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', jpg),
    `<< /Type /Annot /Subtype /Text /Rect [50 700 70 720] /Contents ${s(`Sticky note: ask ${plant('PDF: annotation')}.`)} /T ${s(plant('PDF: annotation author'))} >>`,
    `<< /Type /Annot /Subtype /Widget /FT /Tx /T (payee) /V ${s(plant('PDF: form field'))} /Rect [100 600 400 620] /P 4 0 R /DA (/F1 10 Tf 0 g) >>`,
    '<< /Type /Outlines /First 11 0 R /Last 11 0 R /Count 1 >>',
    `<< /Title ${s(`Statement of ${plant('PDF: bookmark')}`)} /Parent 10 0 R /Dest [4 0 R /Fit] >>`,
    '<< /Type /Filespec /F (note.txt) /EF << /F 13 0 R >> >>',
    stream('/Type /EmbeddedFile', attachment),
    stream('', 'q 595 0 0 842 0 0 cm /Im0 Do Q'),
    `<< /Author ${s(plant('PDF: properties (author)'))} /Title (Letter) >>`,
  ];
  return pdfFile(objects, '/Info 15 0 R');
}

/** A JPEG photo with EXIF: artist and GPS position. */
function photoWithExif() {
  const jpg = scanImage([`Receipt signed by ${plant('Image: text in the picture')}`]).toBuffer('image/jpeg');
  const artist = Buffer.from(`${plant('Image: photo details (author)')}\0`, 'latin1');
  // TIFF, little-endian. IFD0: Artist, GPS pointer. GPS IFD: lat/lon.
  const ifd0 = 8, gps = ifd0 + 2 + 2 * 12 + 4, data = gps + 2 + 4 * 12 + 4;
  const t = Buffer.alloc(data + artist.length + 48);
  t.write('II', 0, 'latin1'); t.writeUInt16LE(42, 2); t.writeUInt32LE(ifd0, 4);
  const entry = (at, tag, type, count, value) => { t.writeUInt16LE(tag, at); t.writeUInt16LE(type, at + 2); t.writeUInt32LE(count, at + 4); if (typeof value === 'string') t.write(value, at + 8, 'latin1'); else t.writeUInt32LE(value, at + 8); };
  t.writeUInt16LE(2, ifd0);
  entry(ifd0 + 2, 0x013b, 2, artist.length, data);
  entry(ifd0 + 14, 0x8825, 4, 1, gps);
  artist.copy(t, data);
  const lat = data + artist.length, lon = lat + 24;
  t.writeUInt16LE(4, gps);
  entry(gps + 2, 1, 2, 2, 'N\0');
  entry(gps + 14, 2, 5, 3, lat);
  entry(gps + 26, 3, 2, 2, 'E\0');
  entry(gps + 38, 4, 5, 3, lon);
  [[3, 1], [9, 1], [2520, 100]].forEach(([n, d], i) => { t.writeUInt32LE(n, lat + i * 8); t.writeUInt32LE(d, lat + i * 8 + 4); });
  [[101, 1], [42, 1], [4440, 100]].forEach(([n, d], i) => { t.writeUInt32LE(n, lon + i * 8); t.writeUInt32LE(d, lon + i * 8 + 4); });
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), t]);
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xffe1, 0); head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([jpg.subarray(0, 2), head, body, jpg.subarray(2)]);
}
export const PHOTO_GPS = '3.157000, 101.712333';

/** A PNG with a text chunk naming its author. */
function pngWithText() {
  const png = scanImage([`Screenshot of a message from ${plant('Image: PNG text in the picture')}`]).toBuffer('image/png');
  const data = Buffer.from(`Author\0${plant('Image: PNG details (author)')}`, 'latin1');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0); chunk.write('tEXt', 4, 'latin1'); data.copy(chunk, 8);
  chunk.writeUInt32BE(zlib.crc32 ? zlib.crc32(chunk.subarray(4, 8 + data.length)) : 0, 8 + data.length);
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

function email({ attachment, attachmentName, inner }) {
  const b = 'cloak-test-boundary';
  const lines = [
    `From: "${plant(`${inner}Email: sender`)}" <sender@mail.example>`,
    `To: "${plant(`${inner}Email: recipient`)}" <to@mail.example>`,
    `Cc: "${plant(`${inner}Email: cc`)}" <cc@mail.example>`,
    `Bcc: "${plant(`${inner}Email: bcc`)}" <bcc@mail.example>`,
    `Subject: Loan to ${plant(`${inner}Email: subject`)}`,
    'Date: Mon, 4 Dec 2023 09:14:00 +0800', 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${b}"`, '',
    `--${b}`, 'Content-Type: text/plain; charset=utf-8', '',
    `Dear Sir,`, '', `Please see below. The borrower is ${plant(`${inner}Email: body`)}.`, '',
    'Regards,', plant(`${inner}Email: signature`), 'Senior Clerk', '',
    'On 1 Dec 2023, someone wrote:', `> The guarantor will be ${plant(`${inner}Email: quoted earlier email`)}.`, '> Please confirm.', '',
    `--${b}`, `Content-Type: application/octet-stream; name="${attachmentName}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${attachmentName}"`, '',
    attachment.toString('base64').replace(/(.{76})/g, '$1\r\n'), `--${b}--`, '',
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8');
}

/** Writes the planted file set into `dir`. Returns the list of places. */
export async function makePlanted(dir) {
  used = 0;
  for (const k of Object.keys(PLANTED)) delete PLANTED[k];
  const attachedDoc = writeZip({ 'word/document.xml': `<w:document ${W}><w:body>${para(`Attached letter signed by ${plant('Email: attachment')}.`)}</w:body></w:document>` });
  const innerNote = Buffer.from(`Note attached to the zipped email: collect from ${plant('Zip: attachment inside an email inside a zip')}.`, 'utf8');
  const files = {
    'statement.docx': wordFile(),
    'payments.xlsx': excelFile(),
    'letter.pdf': pdfDocument(),
    'email.eml': email({ attachment: attachedDoc, attachmentName: 'letter.docx', inner: '' }),
    'bundle.zip': writeZip({
      'inside/zipped email.eml': email({ attachment: innerNote, attachmentName: 'note.txt', inner: 'Zip: ' }),
      'inside/plain note.txt': `A file inside the zip names ${plant('Zip: file inside a zip')}.`,
    }),
    'receipt photo.jpg': photoWithExif(),
    'screenshot.png': pngWithText(),
    '.hidden note.txt': `A hidden file names ${plant('Hidden file')}.`,
    [`Client ${plant('Folder name')}/Statement of ${plant('File name')}.txt`]: 'This file has an ordinary body. The names are in its file name and folder name.',
  };
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), content);
  }
  return Object.keys(PLANTED);
}
