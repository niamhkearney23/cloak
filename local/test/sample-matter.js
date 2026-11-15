// The sample matter that ships with Cloak ("Try a sample matter" on the home
// screen). Ten made-up documents about a home renovation dispute in Selangor.
// Every person, company, number and address here is invented.
//
// The files are written once into app/sample/ by `node test/make-sample.js`
// and committed, so the installer carries them. Word and Excel files are
// built as proper Office files (not the bare minimum Cloak can read), so a
// person can open the originals in Word, Excel or a PDF viewer and compare
// them with the cloaked copies.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { writeZip } from '../zip.js';
import { pdfFile, stream } from './matter.js';

const require = createRequire(import.meta.url);

/** What the app needs to set the sample matter up (written to app/sample/sample.json). */
export const SAMPLE_INFO = {
  name: 'Cloak sample matter (made-up documents)',
  about: 'Ten made-up documents about a home renovation dispute in Selangor. Every name, number and address in them is invented.',
  client: 'Nurul Huda binti Rahmat; Nurul Huda; Puan Nurul Huda',
  others: 'Kemas Jaya Renovation Sdn Bhd; Kemas Jaya; KJR\nperson: Lee Chee Keong; Mr Lee',
  level: 'strict',
};

// Real values that must never leave in a cloaked copy, a log or a support
// file. Whole words, any letter case.
export const SAMPLE_REAL = [
  'Nurul Huda', 'Nurul', 'Huda', 'Rahmat', 'Kemas Jaya', 'Kemas', 'KJR', 'Lee Chee Keong', 'Chee Keong', 'Keong',
  'Suresh', 'Ramasamy', 'Faris', 'Abdul Latif', 'Latif', 'Gan Wei Ming', 'Wei Ming', 'Azman', 'Farah', 'Aziz', 'Rajan',
  '870214-10-5562', '760823-07-5113', '201801023456', '3187662015',
  '012-338 4410', '019-722 5180', '016-221 7093', '017-640 2286', '012-905 6631', '03-8070 1234',
  'nurulhuda.rahmat', 'ck.lee', 'kemasjaya.example', 'aziz-ong.example', 'suresh@kemasjaya',
  'Jalan Cempaka', 'Taman Cempaka Indah', 'Jalan Perindustrian', 'Bukit Puchong', 'Menara Cendana', 'Jalan Kenari', 'Jalan Bayu',
  'BPC 4821', 'KJR-0457', 'AOP/LIT/2025/031', 'TR/KJR/2025/88', '李志强',
];
// Surnames that are also ordinary letters or words: exact case, whole word.
export const SAMPLE_REAL_EXACT = ['Lee', 'Gan', 'Ong', 'Tan'];
// Facts a Strict matter hides: dates, amounts and towns as written in the documents.
export const SAMPLE_FACTS = ['6 January 2025', '3 March 2025', '30 April 2025', '2 July 2025', '16 July 2025', 'RM 45,000.00', 'RM 30,000.00', 'RM 150,000.00', 'RM 93,500.00', 'RM 18,500.00', '45,000', '93,500', 'Puchong', 'Shah Alam'];

// How a careful reviewer answers the "not sure" list for the sample: a word
// that is (part of) a person's name is hidden as a person, part of the
// company or an address as something else; everything else is fine.
const PEOPLE_WORDS = new Set(['nurul', 'huda', 'rahmat', 'lee', 'chee', 'keong', 'suresh', 'ramasamy', 'faris', 'abdul', 'latif', 'gan', 'wei', 'ming', 'azman', 'farah', 'aziz', 'ong', 'rajan']);
const COMPANY_WORDS = new Set(['kemas', 'jaya', 'kjr', 'kemasjaya']);
const GENERIC_WORDS = new Set(['jalan', 'taman', 'bukit', 'menara', 'indah', 'perindustrian', 'example', 'mail', 'lit']);
const words = (s) => String(s).toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
const REAL_WORDS = new Set(SAMPLE_REAL.flatMap(words).filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w)));

/** 'PERSON', 'COMPANY' or 'OTHER' to hide a "not sure" word, or null when it is fine. */
export function sampleDecision(text) {
  const ws = words(text);
  if (ws.some((w) => PEOPLE_WORDS.has(w))) return 'PERSON';
  if (ws.some((w) => COMPANY_WORDS.has(w))) return 'COMPANY';
  if (ws.some((w) => REAL_WORDS.has(w))) return 'OTHER';
  return null;
}

/** Decide everything on the review screen of the sample as a careful reviewer would, and finish the review. */
export async function finishSampleReview(session) {
  let d = session.reviewData();
  for (let guard = 0; guard < 300 && (d.unsure.length || d.merges.length || d.shortForms.length); guard++) {
    if (d.unsure.length) {
      const kind = sampleDecision(d.unsure[0].text);
      d = await session.reviewAction(kind ? { type: 'add', text: d.unsure[0].text, kind } : { type: 'fine', text: d.unsure[0].text });
    } else if (d.merges.length) d = await session.reviewAction({ type: 'confirmMerge', tag: d.merges[0].tag });
    else d = await session.reviewAction({ type: 'confirmShortForm', tag: d.shortForms[0].tag, also: d.shortForms[0].also });
  }
  for (const f of d.files.filter((x) => x.status === 'manual' && !x.checkedBy)) {
    if (f.nonLatinShowing) await session.reviewAction({ type: 'hideNonLatin', number: f.number });
    await session.approveFile(f.number);
  }
  return session.completeReview();
}

// The words on the scanned receipt live only in its picture; kept here so tests can find them.
export const RECEIPT_LINES = [
  '# KEMAS JAYA RENOVATION SDN BHD',
  'No. 7, Jalan Perindustrian 2, 47100 Puchong',
  '',
  '# OFFICIAL RECEIPT   No. KJR-0457',
  '',
  'Date: 6 January 2025',
  'Received from: Nurul Huda binti Rahmat',
  'The sum of: RM 45,000.00',
  'Being: deposit for renovation works at',
  'No. 18, Jalan Cempaka 3/2, Taman Cempaka Indah',
  'Paid by: online transfer to account 3187662015',
  '',
  'Received by: Suresh a/l Ramasamy',
];

// ------------------------------------------------------------------ Word

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument';
const STAMP = '2025-07-21T09:00:00Z';

const run = (text, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;

/**
 * A paragraph. Plain text, or an object:
 *   { text, bold, center, title }            formatting
 *   { text, footnote: 1 }                    a footnote mark at the end
 *   { text, comment: 0 }                     the whole paragraph is commented on
 *   { text, deleted: 'old words', author }   tracked deletion at the end
 */
function paragraph(p) {
  if (typeof p === 'string') p = { text: p };
  const props = [p.center || p.title ? '<w:jc w:val="center"/>' : '', '<w:spacing w:after="120"/>'].join('');
  const rProps = p.title ? '<w:b/><w:sz w:val="28"/>' : p.bold ? '<w:b/>' : '';
  let inner = run(p.text, rProps);
  if (p.comment !== undefined) inner = `<w:commentRangeStart w:id="${p.comment}"/>${inner}<w:commentRangeEnd w:id="${p.comment}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${p.comment}"/></w:r>`;
  if (p.footnote !== undefined) inner += `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${p.footnote}"/></w:r>`;
  if (p.deleted) inner += `<w:del w:id="${90 + (p.comment || 0)}" w:author="${xmlEsc(p.author)}" w:date="${STAMP}"><w:r><w:delText xml:space="preserve">${xmlEsc(p.deleted)}</w:delText></w:r></w:del>`;
  return `<w:p><w:pPr>${props}</w:pPr>${inner}</w:p>`;
}

/** A .docx that Word opens: body, optional header, footer, one footnote, one comment, document properties. */
export function wordFile({ paragraphs, header, footer, footnote, comment, title, author }) {
  const files = {};
  const overrides = [['/word/document.xml', `${CT}.wordprocessingml.document.main+xml`], ['/word/styles.xml', `${CT}.wordprocessingml.styles+xml`], ['/word/settings.xml', `${CT}.wordprocessingml.settings+xml`], ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'], ['/docProps/app.xml', `${CT}.extended-properties+xml`]];
  const rels = [['rId1', 'styles', 'styles.xml'], ['rId2', 'settings', 'settings.xml']];
  let sect = '';
  if (header) {
    files['word/header1.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:hdr ${W}>${paragraph({ text: header, center: true })}</w:hdr>`;
    overrides.push(['/word/header1.xml', `${CT}.wordprocessingml.header+xml`]);
    rels.push(['rId3', 'header', 'header1.xml']);
    sect += '<w:headerReference w:type="default" r:id="rId3"/>';
  }
  if (footer) {
    files['word/footer1.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:ftr ${W}>${paragraph({ text: footer, center: true })}</w:ftr>`;
    overrides.push(['/word/footer1.xml', `${CT}.wordprocessingml.footer+xml`]);
    rels.push(['rId4', 'footer', 'footer1.xml']);
    sect += '<w:footerReference w:type="default" r:id="rId4"/>';
  }
  if (footnote) {
    files['word/footnotes.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:footnotes ${W}><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote><w:footnote w:id="1"><w:p><w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r>${run(` ${footnote}`)}</w:p></w:footnote></w:footnotes>`;
    overrides.push(['/word/footnotes.xml', `${CT}.wordprocessingml.footnotes+xml`]);
    rels.push(['rId5', 'footnotes', 'footnotes.xml']);
  }
  if (comment) {
    files['word/comments.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments ${W}><w:comment w:id="0" w:author="${xmlEsc(comment.author)}" w:date="${STAMP}" w:initials="${xmlEsc(comment.initials)}"><w:p><w:r><w:annotationRef/></w:r>${run(comment.text)}</w:p></w:comment></w:comments>`;
    overrides.push(['/word/comments.xml', `${CT}.wordprocessingml.comments+xml`]);
    rels.push(['rId6', 'comments', 'comments.xml']);
  }
  files['word/document.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${paragraphs.map(paragraph).join('')}<w:sectPr>${sect}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1304" w:bottom="1440" w:left="1304" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  files['word/styles.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="SimSun" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style></w:styles>`;
  files['word/settings.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:settings ${W}><w:defaultTabStop w:val="720"/>${footnote ? '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>' : ''}<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  files['word/_rels/document.xml.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
  return officePackage(files, overrides, 'word/document.xml', { title, author });
}

/** Content types, package relationships and document properties around the parts. */
function officePackage(files, overrides, main, { title, author }) {
  files['docProps/core.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${title ? `<dc:title>${xmlEsc(title)}</dc:title>` : ''}${author ? `<dc:creator>${xmlEsc(author)}</dc:creator><cp:lastModifiedBy>${xmlEsc(author)}</cp:lastModifiedBy>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">${STAMP}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${STAMP}</dcterms:modified></cp:coreProperties>`;
  files['docProps/app.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Cloak sample matter</Application></Properties>';
  files['_rels/.rels'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="${main}"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`).join('')}</Types>`;
  // [Content_Types].xml first, as Office writes it.
  return writeZip({ '[Content_Types].xml': types, ...files });
}

// ----------------------------------------------------------------- Excel

/** A one-sheet .xlsx that Excel opens. Numbers stay numbers; the first row is bold. */
export function excelFile({ sheet, rows, widths = [], title, author }) {
  const strings = [];
  const index = new Map();
  const col = (c) => String.fromCharCode(65 + c);
  const cell = (v, r, c) => {
    const ref = `${col(c)}${r + 1}`;
    const style = r === 0 ? ' s="1"' : typeof v === 'number' ? ' s="2"' : '';
    if (v === '' || v === null || v === undefined) return '';
    if (typeof v === 'number') return `<c r="${ref}"${style}><v>${v}</v></c>`;
    if (!index.has(v)) { index.set(v, strings.length); strings.push(v); }
    return `<c r="${ref}"${style} t="s"><v>${index.get(v)}</v></c>`;
  };
  const S = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const data = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c)).join('')}</row>`).join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const files = {
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook ${S} xmlns:r="${REL}"><sheets><sheet name="${xmlEsc(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet ${S}>${cols}<sheetData>${data}</sheetData></worksheet>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet ${S}><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  files['xl/sharedStrings.xml'] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst ${S} count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}</sst>`;
  const overrides = [['/xl/workbook.xml', `${CT}.spreadsheetml.sheet.main+xml`], ['/xl/worksheets/sheet1.xml', `${CT}.spreadsheetml.worksheet+xml`], ['/xl/sharedStrings.xml', `${CT}.spreadsheetml.sharedStrings+xml`], ['/xl/styles.xml', `${CT}.spreadsheetml.styles+xml`], ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'], ['/docProps/app.xml', `${CT}.extended-properties+xml`]];
  return officePackage(files, overrides, 'xl/workbook.xml', { title, author });
}

// ------------------------------------------------------------------- PDF

const pdfText = (s) => `(${s.replace(/[\\()]/g, '\\$&')})`;

/** A text PDF on A4. A line starting with "# " is a bold heading. Plain ASCII only. */
export function textPdf(lines) {
  const body = lines.map((l) => (l.startsWith('# ') ? `/F2 12 Tf ${pdfText(l.slice(2))} Tj T* /F1 10.5 Tf` : `${pdfText(l)} Tj T*`)).join('\n');
  const content = `BT /F1 10.5 Tf 15 TL 64 780 Td\n${body}\nET`;
  return pdfFile([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [5 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>',
    stream('', content),
  ]);
}

/** A scanned page: the lines are drawn into a picture and the PDF holds only the picture (no text layer). */
export function scannedPdf(lines) {
  const { createCanvas } = require('@napi-rs/canvas');
  const width = 1654;
  const height = 2339;
  const c = createCanvas(width, height);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, width, height);
  g.fillStyle = '#111';
  let y = 230;
  for (const l of lines) {
    g.font = l.startsWith('# ') ? 'bold 44px serif' : '36px serif';
    g.fillText(l.replace(/^# /, ''), 150, y);
    y += l.startsWith('# ') ? 80 : 66;
  }
  const jpg = c.toBuffer('image/jpeg', 85);
  return pdfFile([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
    stream('', 'q 595 0 0 842 0 0 cm /Im0 Do Q'),
    stream(`/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, jpg),
  ]);
}

// ----------------------------------------------------------------- email

const email = ({ from, to, cc, subject, date, body }) => [`From: ${from}`, `To: ${to}`, cc ? `Cc: ${cc}` : null, `Subject: ${subject}`, `Date: ${date}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', ...body].filter((l) => l !== null).join('\r\n');

// -------------------------------------------------------------- the files

const FIRM_HEADER = 'AZIZ, ONG & PARTNERS   Advocates & Solicitors';
const FIRM_FOOTER = 'Suite 8-3, Menara Cendana, Jalan Kenari, 47100 Puchong, Selangor   Tel: 03-8070 1234   farah@aziz-ong.example';

/** The ten documents, by path inside the sample folder. */
export function sampleDocuments() {
  return {
    '01 Renovation agreement.pdf': textPdf([
      '# RENOVATION AGREEMENT', '',
      'This Agreement is made on 6 January 2025', '',
      '# BETWEEN',
      'NURUL HUDA BINTI RAHMAT (NRIC No. 870214-10-5562)',
      'of No. 18, Jalan Cempaka 3/2, Taman Cempaka Indah, 47100 Puchong, Selangor ("the Owner")', '',
      '# AND',
      'KEMAS JAYA RENOVATION SDN BHD (Company No. 201801023456)',
      'of No. 7, Jalan Perindustrian 2, Taman Perindustrian Bukit Puchong, 47100 Puchong',
      '("the Contractor")', '',
      '1. The Contractor shall renovate the kitchen and two bathrooms of the Owner\'s house at',
      '   No. 18, Jalan Cempaka 3/2 for the contract sum of RM 150,000.00.',
      '2. The Owner shall pay a deposit of RM 45,000.00 on signing, and a progress payment of',
      '   RM 30,000.00 when the kitchen cabinets are installed.',
      '3. The works shall be completed by 30 April 2025. The Contractor shall pay RM 500.00 for',
      '   each day of delay after that date.',
      '4. The Contractor shall make good any defect notified within 12 months of completion.',
      '5. Payments shall be made to Public Bank account no. 3187662015 in the name of the Contractor.', '',
      'Signed by the Owner: Nurul Huda binti Rahmat', '',
      'Signed for the Contractor: Lee Chee Keong (NRIC No. 760823-07-5113), Director', '',
      'Witness: Suresh a/l Ramasamy, Project Manager',
    ]),
    '02 Payment schedule.xlsx': excelFile({
      sheet: 'Payments', title: 'Payments to Kemas Jaya', author: 'Nurul Huda',
      widths: [18, 26, 32, 14, 14, 30],
      rows: [
        ['Date', 'Paid by', 'Paid to', 'Account', 'Amount (RM)', 'Note'],
        ['6 January 2025', 'Nurul Huda binti Rahmat', 'Kemas Jaya Renovation Sdn Bhd', '3187662015', 45000, 'Deposit'],
        ['3 March 2025', 'Nurul Huda binti Rahmat', 'Kemas Jaya Renovation Sdn Bhd', '3187662015', 30000, 'Progress payment (cabinets)'],
        ['', '', '', 'Total paid', 75000, ''],
        ['Contact', 'Suresh a/l Ramasamy', '017-640 2286', '', '', 'Project manager'],
      ],
    }),
    '03 Deposit receipt (scanned).pdf': scannedPdf(RECEIPT_LINES),
    '04 WhatsApp chat with contractor.txt': [
      'WhatsApp chat with Ah Keong (Kemas Jaya)',
      'Exported by Nurul Huda on 21 July 2025',
      '',
      '[03/03/2025, 10:12 am] Nurul Huda: Ah Keong, I have transferred the RM 30,000 progress payment. Please confirm.',
      '[03/03/2025, 10:31 am] Ah Keong (Kemas Jaya): Received, thank you Puan. The cabinets are done, tiles start next week.',
      '[14/03/2025, 6:45 pm] Nurul Huda: Nobody came to the site this week. The bathroom pipe is leaking into the kitchen ceiling.',
      '[14/03/2025, 8:02 pm] Ah Keong (Kemas Jaya): 我是李志强。工人下个星期才回来，请多多包涵。',
      '[14/03/2025, 8:05 pm] Ah Keong (Kemas Jaya): Sorry Puan, workers only come back next week. Azman will redo the tiles.',
      '[02/04/2025, 9:20 am] Nurul Huda: Still no workers. My husband Faris called Suresh twice, no answer.',
      '[02/04/2025, 9:48 am] Ah Keong (Kemas Jaya): Very busy now. Can call me at 016-221 7093.',
      '[28/04/2025, 7:15 pm] Nurul Huda: Completion is in 2 days. The leak is worse. Please send someone.',
      '',
    ].join('\n'),
    '05 Email from Kemas Jaya.eml': email({
      from: '"Lee Chee Keong" <ck.lee@kemasjaya.example>',
      to: '"Nurul Huda" <nurulhuda.rahmat@mail.example>',
      cc: '"Suresh Ramasamy" <suresh@kemasjaya.example>',
      subject: 'Re: Leaking bathroom and delay',
      date: 'Mon, 5 May 2025 11:20:00 +0800',
      body: [
        'Dear Puan Nurul Huda,', '',
        'We are sorry for the delay. Our tiler was on medical leave in March and April.',
        'We will finish the remaining works by 31 May 2025 at no extra cost.',
        'The leak was caused by the old pipes in your house, which are not part of our contract.', '',
        'Regards,', 'Lee Chee Keong', 'Director, Kemas Jaya Renovation Sdn Bhd', '016-221 7093', '',
        'On Fri, 2 May 2025 at 9:02 pm, Nurul Huda <nurulhuda.rahmat@mail.example> wrote:',
        '> Mr Lee, the works were due on 30 April 2025. The bathroom is still leaking and',
        '> half the tiles are cracked. Please tell me in writing when you will finish.',
        '> Nurul Huda',
        '> 012-338 4410',
      ],
    }),
    '06 Statement of Nurul Huda.docx': wordFile({
      title: 'Statement of Nurul Huda binti Rahmat', author: 'Farah Aziz',
      paragraphs: [
        { text: 'WITNESS STATEMENT OF NURUL HUDA BINTI RAHMAT', title: true },
        { text: '(NRIC No. 870214-10-5562)', center: true },
        '1. I am the owner of the house at No. 18, Jalan Cempaka 3/2, Taman Cempaka Indah, 47100 Puchong. I make this statement from my own knowledge.',
        '2. On 6 January 2025 I signed a renovation agreement with Kemas Jaya Renovation Sdn Bhd. Mr Lee Chee Keong signed for the company. Mr Suresh a/l Ramasamy, its project manager, witnessed it.',
        '3. I paid a deposit of RM 45,000.00 the same day and a progress payment of RM 30,000.00 on 3 March 2025.',
        { text: '4. From mid-March 2025 no workers came. The bathroom pipe leaked into the kitchen ceiling. My husband, Mohd Faris bin Abdul Latif, telephoned Suresh many times on 019-722 5180.', deleted: ' Ah Keong promised a refund on the telephone.', author: 'Farah Aziz' },
        '5. Our neighbour, Mr Gan Wei Ming, saw the contractor\'s lorry, BPC 4821, take away the tiles on 18 March 2025.',
        { text: '6. Another contractor has quoted RM 18,500.00 to repair the leak and the tiles.', footnote: 1, comment: 0 },
        '',
        'Nurul Huda binti Rahmat',
        'Date: 21 July 2025',
      ],
      footnote: 'Quotation from Bina Kukuh Services dated 10 July 2025.',
      comment: { author: 'Farah Aziz', initials: 'FA', text: 'Ask the client for the quotation and the photos of the ceiling.' },
    }),
    '07 Letter of demand.docx': wordFile({
      title: 'Letter of demand to Kemas Jaya', author: 'Farah Aziz',
      header: FIRM_HEADER, footer: FIRM_FOOTER,
      paragraphs: [
        'Our ref: AOP/LIT/2025/031', '2 July 2025', '',
        'BY HAND AND EMAIL (ck.lee@kemasjaya.example)',
        'Kemas Jaya Renovation Sdn Bhd', 'No. 7, Jalan Perindustrian 2', 'Taman Perindustrian Bukit Puchong', '47100 Puchong, Selangor', '',
        'Attention: Mr Lee Chee Keong, Director', '',
        'Dear Sirs,',
        { text: 'NOTICE OF DEMAND: RENOVATION OF NO. 18, JALAN CEMPAKA 3/2, TAMAN CEMPAKA INDAH', bold: true },
        '1. We act for Puan Nurul Huda binti Rahmat, the owner of the above property.',
        '2. Under the agreement dated 6 January 2025, our client paid you RM 45,000.00 on 6 January 2025 and RM 30,000.00 on 3 March 2025.',
        '3. You stopped work in March 2025 and did not complete the works by 30 April 2025. The work you did is defective.',
        '4. Our client has been quoted RM 18,500.00 to repair the defects.',
        '5. We demand that you pay our client RM 93,500.00 within 14 days of this letter. Otherwise we have instructions to commence proceedings in the Sessions Court at Shah Alam without further notice.',
        '', 'Yours faithfully,', '', 'Farah Aziz', 'Aziz, Ong & Partners', 'c.c. Client',
      ],
    }),
    '08 File note - call with neighbour.txt': [
      'FILE NOTE', '',
      'Date: 21 July 2025',
      'Matter: Nurul Huda / Kemas Jaya',
      'By: Farah Aziz', '',
      'Spoke to Mr Gan Wei Ming, the client\'s neighbour at No. 20, Jalan Cempaka 3/2 (tel 012-905 6631).', '',
      'Wei Ming says he saw the Kemas Jaya lorry, BPC 4821, outside the client\'s house on 18 March 2025. Two workers loaded boxes of tiles and left. No one came back after that.', '',
      'He also says the tiler, Azman, told him the company had not paid the workers since February.', '',
      'Wei Ming is willing to give a statement. He prefers to be called after 6 pm.', '',
    ].join('\n'),
    'Correspondence/09 Reply from Tan & Rajan.pdf': textPdf([
      '# TAN & RAJAN',
      'Advocates & Solicitors',
      'No. 22, Jalan Bayu 5, 40000 Shah Alam, Selangor', '',
      '16 July 2025', '',
      'Messrs Aziz, Ong & Partners',
      'Suite 8-3, Menara Cendana, Jalan Kenari, 47100 Puchong', '',
      'Your ref: AOP/LIT/2025/031    Our ref: TR/KJR/2025/88', '',
      'Dear Sirs,', '',
      '# RE: NURUL HUDA BINTI RAHMAT / KEMAS JAYA RENOVATION SDN BHD', '',
      'We act for Kemas Jaya Renovation Sdn Bhd.',
      'Our client denies that the works are defective. The delay was caused by your client\'s',
      'late approval of the tile samples, and by leaking pipes outside the scope of works.',
      'Our client is prepared to complete the works by 31 August 2025. It does not accept',
      'the claim for RM 93,500.00.', '',
      'Yours faithfully,', '', 'Tan & Rajan',
    ]),
    'Correspondence/10 Our reply.docx': wordFile({
      title: 'Reply to Tan & Rajan', author: 'Farah Aziz',
      header: FIRM_HEADER, footer: FIRM_FOOTER,
      paragraphs: [
        '30 July 2025', '',
        'Messrs Tan & Rajan', 'No. 22, Jalan Bayu 5', '40000 Shah Alam', '',
        'Your ref: TR/KJR/2025/88    Our ref: AOP/LIT/2025/031', '',
        'Dear Sirs,',
        { text: 'RE: NURUL HUDA BINTI RAHMAT / KEMAS JAYA RENOVATION SDN BHD', bold: true },
        'We refer to your letter of 16 July 2025.',
        'Completion by 31 August 2025 is not acceptable to our client. Your client has had the works since January.',
        'Unless the sum of RM 93,500.00 is paid by 15 August 2025, we will file the claim.',
        '', 'Yours faithfully,', '', 'Aziz, Ong & Partners',
      ],
    }),
  };
}

/** Write the sample into `dir`: documents/ (the files to cloak) and sample.json (what the app needs). */
export async function writeSample(dir) {
  const docs = sampleDocuments();
  for (const [rel, content] of Object.entries(docs)) {
    const file = path.join(dir, 'documents', ...rel.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  await writeFile(path.join(dir, 'sample.json'), `${JSON.stringify({ ...SAMPLE_INFO, files: Object.keys(docs) }, null, 2)}\n`, 'utf8');
  return Object.keys(docs);
}
