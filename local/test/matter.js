// A made-up matter of 20 files for testing. Every person, company, number
// and address here is invented. The same people appear under different
// spellings and short forms across the files, the way real bundles do.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { writeZip } from '../zip.js';

const require = createRequire(import.meta.url);

// Real values that must never appear in any cloaked file. Whole words,
// matched in any letter case unless marked exact.
export const REAL_VALUES = [
  'Ahmad', 'Ismail', 'Siti', 'Boon Huat', 'Huat', 'Nurhaliza', 'Abdullah', 'Ravi', 'Muthu', 'Mei Ling', 'Mei-Ling', 'Faizal', 'Hassan',
  'Kavitha', 'Subramaniam', 'Kah Fai', 'Thompson', 'Sarah', 'Zulkifli', 'Aminah', 'Gurdip', 'Chong Wei Jie', 'Wei Jie',
  'Maju Jaya', 'MJSB', 'Bina Teguh', 'Kaur', 'Hong Seng', 'Perdana',
  '800505-14-5521', '800505145521', '850712-10-5688', '790230-08-6123', 'A12345678', 'S8512345D', '880915-08-5377',
  '5141 2345 6789', '5141-2345-6789', '514123456789', '8001234567',
  '012-987 6543', '0129876543', '03-2161 8899', '019-445 2210',
  'WA-22NCvC-123-01/2024', 'BA-A72NCvC-55-03/2023', 'Geran 45678', 'Lot 1234', '9876', 'WXY 1234', 'BKV 8821',
  'Jalan Ampang', 'Jalan Tun Sambanthan', 'Taman Desa Jaya', 'Persiaran Gurney', 'lkp.example', 'majujaya.example', 'ahmad.ismail',
];
// Short surnames that are also letters inside ordinary words: exact case, whole word.
export const REAL_EXACT = ['Tan', 'Lim', 'Wong', 'Singh', 'David'];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
const wordDoc = (body) => `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

/** A .docx with optional header, footer, footnote, comment and tracked changes. */
export function docx({ body, header, footer, footnote, comment, deleted, inserted }) {
  const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  let xml = body.split('\n').map(para).join('');
  if (deleted) xml += `<w:p><w:del w:author="Reviewer"><w:r><w:delText>${esc(deleted)}</w:delText></w:r></w:del><w:ins w:author="Reviewer"><w:r><w:t>${esc(inserted || '')}</w:t></w:r></w:ins></w:p>`;
  const files = { '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>', 'word/document.xml': wordDoc(xml) };
  if (header) files['word/header1.xml'] = `<w:hdr ${w}>${para(header)}</w:hdr>`;
  if (footer) files['word/footer1.xml'] = `<w:ftr ${w}>${para(footer)}</w:ftr>`;
  if (footnote) files['word/footnotes.xml'] = `<w:footnotes ${w}><w:footnote>${para(footnote)}</w:footnote></w:footnotes>`;
  if (comment) files['word/comments.xml'] = `<w:comments ${w}><w:comment w:author="Reviewer">${para(comment)}</w:comment></w:comments>`;
  files['docProps/core.xml'] = '<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:creator>Lim Mei Ling</dc:creator><dc:title>Affidavit of Ahmad bin Ismail</dc:title></cp:coreProperties>';
  return writeZip(files);
}

export function xlsx(sheetName, rows) {
  const strings = [];
  const cell = (v, r, c) => {
    const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
    if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
    strings.push(v);
    return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
  };
  const sheet = `<worksheet><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return writeZip({
    'xl/workbook.xml': `<workbook><sheets><sheet name="${esc(sheetName)}" sheetId="1"/></sheets></workbook>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/sharedStrings.xml': `<sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`,
  });
}

function pdfFile(objects) {
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [];
  const length = () => parts.reduce((n, p) => n + p.length, 0);
  objects.forEach((o, i) => {
    offsets.push(length());
    parts.push(Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(o) ? o : Buffer.from(o), Buffer.from('\nendobj\n'));
  });
  const xref = length();
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(parts);
}

const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`), Buffer.isBuffer(data) ? data : Buffer.from(data), Buffer.from('\nendstream')]);

function textPage(lines) {
  const body = lines.map((l) => `(${l.replace(/[\\()]/g, '\\$&')}) Tj T*`).join('\n');
  return `BT /F1 11 Tf 14 TL 60 780 Td\n${body}\nET`;
}

/** Draws lines of text as a picture: a "scan" with no text layer. */
function scanImage(lines) {
  const { createCanvas } = require('@napi-rs/canvas');
  const W = 1654, H = 2339;
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#111'; g.font = '34px serif';
  lines.forEach((l, i) => g.fillText(l, 150, 240 + i * 64));
  return c;
}

/** pages: [{ text: [...] } | { scan: [...] }] - text pages and scanned pages can be mixed. */
export function pdf(pages) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const p of pages) {
    const pageNo = objects.length + 1;
    if (p.text) {
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageNo + 1} 0 R >>`);
      objects.push(stream('', textPage(p.text)));
    } else {
      const jpg = scanImage(p.scan).toBuffer('image/jpeg');
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${pageNo + 2} 0 R >> >> /Contents ${pageNo + 1} 0 R >>`);
      objects.push(stream('', 'q 595 0 0 842 0 0 cm /Im0 Do Q'));
      objects.push(stream('/Type /XObject /Subtype /Image /Width 1654 /Height 2339 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', jpg));
    }
    kids.push(`${pageNo} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  return pdfFile(objects);
}

export const png = (lines) => scanImage(lines).toBuffer('image/png');

const eml = ({ from, to, cc, subject, date, body }) => [`From: ${from}`, `To: ${to}`, cc ? `Cc: ${cc}` : null, `Subject: ${subject}`, `Date: ${date}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', body].filter((l) => l !== null).join('\r\n');

const HEADING = ['DALAM MAHKAMAH TINGGI MALAYA DI KUALA LUMPUR', 'DALAM WILAYAH PERSEKUTUAN, MALAYSIA', 'GUAMAN SIVIL NO: WA-22NCvC-123-01/2024', '', 'ANTARA', '', 'AHMAD BIN ISMAIL (No. K/P: 800505-14-5521)                ... PLAINTIF', '', 'DAN', '', '1. MAJU JAYA SDN BHD (No. Syarikat: 201901012345)', '2. TAN BOON HUAT (No. K/P: 790230-08-6123)                ... DEFENDAN-DEFENDAN', ''];

/** Writes the 20 files into `dir` and returns their relative paths. */
export async function makeMatter(dir) {
  const files = {
    '01 Writ and Statement of Claim.docx': docx({
      header: 'Ahmad bin Ismail v Maju Jaya Sdn Bhd & Anor',
      footer: 'Tetuan Lim, Kaur & Partners, Tingkat 12, Menara Perdana, Jalan Ampang, 50450 Kuala Lumpur. Tel: 03-2161 8899',
      body: [...HEADING, 'PERNYATAAN TUNTUTAN', '',
        '1. Plaintif, Ahmad bin Ismail, ialah seorang individu yang beralamat di No. 12, Jalan Ampang, 50450 Kuala Lumpur.',
        '2. Defendan Pertama, Maju Jaya Sdn. Bhd. ("MJSB"), ialah sebuah syarikat pemaju yang beralamat berdaftar di Unit 3-2, Persiaran Gurney, 54000 Kuala Lumpur.',
        '3. Defendan Kedua, Dato\' Sri Tan Boon Huat, ialah pengarah urusan MJSB pada setiap masa yang material.',
        '4. Melalui perjanjian jual beli bertarikh 3 Mac 2023, Plaintif bersetuju membeli hartanah yang dipegang di bawah Geran 45678, Lot 1234, Mukim Batu, Daerah Gombak daripada MJSB dengan harga RM 600,000.00.',
        '5. Plaintif membayar deposit RM 60,000.00 ke akaun Maybank 5141 2345 6789 milik MJSB.',
        '6. Dato\' Sri Tan berjanji secara lisan bahawa deposit akan dipulangkan. Encik Tan gagal berbuat demikian.',
        '7. Menurut Seksyen 74 Akta Kontrak 1950, Plaintif menuntut pemulangan deposit dan ganti rugi.', '',
        'Bertarikh 15 Januari 2024', '', 'Lim Mei Ling', 'Peguamcara Plaintif'].join('\n'),
      footnote: 'Lihat surat Encik Mohd Faizal bin Hassan bertarikh 10 Mac 2023.',
      comment: 'Mei Ling to confirm the NRIC of Tan Boon Huat before filing.',
      deleted: 'Plaintif juga menuntut daripada Hong Seng Trading.', inserted: 'Tuntutan terhadap pihak ketiga ditarik balik.',
    }),
    '02 Affidavit Ahmad bin Ismail.txt': [...HEADING, 'AFIDAVIT SOKONGAN', '',
      'Saya, AHMAD BIN ISMAIL (No. K/P: 800505-14-5521), seorang warganegara Malaysia yang cukup umur dan beralamat di No. 12, Jalan Ampang, 50450 Kuala Lumpur, dengan sesungguhnya berikrar dan menyatakan seperti berikut:', '',
      '1. Saya adalah Plaintif dalam tindakan ini.',
      '2. Pada 3 Mac 2023 saya bertemu dengan Dato\' Sri Tan Boon Huat di pejabat Maju Jaya di Persiaran Gurney. Turut hadir ialah isteri saya, Puan Siti Nurhaliza binti Abdullah, dan Encik Ravi a/l Muthu, ejen hartanah.',
      '3. Boon Huat memberitahu saya bahawa geran akan dipindah milik dalam masa tiga bulan.',
      '4. Saya telah memandu ke sana dengan kereta saya, WXY 1234.',
      '5. Saya boleh dihubungi di talian 012-987 6543 atau ahmad.ismail@mail.example.', '',
      'Diikrarkan oleh AHMAD BIN ISMAIL di Kuala Lumpur pada 20 Januari 2024', '', 'Di hadapan saya,', 'Pesuruhjaya Sumpah'].join('\n'),
    '03 Affidavit of Siti Nurhaliza.docx': docx({
      body: [...HEADING, 'AFFIDAVIT', '',
        'I, Siti Nurhaliza bt Abdullah (NRIC No. 850712-10-5688), of No. 12, Jalan Ampang, 50450 Kuala Lumpur, do solemnly affirm and say as follows:', '',
        '1. I am the wife of the Plaintiff, Ahmad Ismail.',
        '2. I was present at the meeting on 3 March 2023. Mr Tan told my husband the deposit was "as good as in the bank".',
        '3. Mr Ravi Muthu, the estate agent, wrote down what was said. Siti Nurhaliza and Ravi both signed the note.',
        '4. I later telephoned Ms Sarah Thompson, the finance director of Maju Jaya, on 019-445 2210. Ms Thompson said she would "look into it". Sarah never called back.'].join('\n'),
    }),
    '04 Letter of Demand.docx': docx({
      header: 'LIM, KAUR & PARTNERS   Advocates & Solicitors',
      body: ['Our ref: LKP/2024/118', 'Date: 5 December 2023', '', 'Maju Jaya Sdn Bhd', 'Unit 3-2, Persiaran Gurney', '54000 Kuala Lumpur', '', 'Attention: Tan Sri Tan Boon Huat', '', 'Dear Sirs,', '',
        'RE: DEMAND FOR REFUND OF DEPOSIT OF RM60,000.00', '',
        'We act for Mr Ahmad Ismail of No. 12, Jalan Ampang, 50450 Kuala Lumpur.',
        'Our client paid a deposit of RM60,000.00 to your account no. 5141-2345-6789 on 3 March 2023.',
        'Despite repeated requests to Mr. Tan and to your Ms Thompson, the deposit has not been refunded.',
        'TAKE NOTICE that unless the sum is paid within 14 days, our client will commence proceedings without further reference to you.', '',
        'Yours faithfully,', '', 'Lim Mei-Ling', 'Partner', 'meiling@lkp.example'].join('\n'),
    }),
    '05 Reply from Maju Jaya.pdf': pdf([{ text: ['MAJU JAYA SDN. BHD. (201901012345)', 'Unit 3-2, Persiaran Gurney, 54000 Kuala Lumpur', 'Tel: 03-2161 8899   Email: finance@majujaya.example', '', '12 December 2023', '', 'Messrs Lim, Kaur & Partners', '', 'Dear Sirs,', '', 'YOUR REF: LKP/2024/118', '', 'We refer to your letter dated 5 December 2023 written on behalf of Encik Ahmad.', 'The deposit paid by Ahmad b. Ismail was forfeited under clause 9 of the agreement.', 'Our Dato\' Sri Tan Boon Huat has instructed us to deny liability.', 'Kindly direct further correspondence to our solicitors, Messrs Chong & Co.', '', 'Yours faithfully,', 'Sarah Thompson', 'Finance Director', 'Maju Jaya Sdn. Bhd.'] }]),
    '06 Email Ahmad to Lim.eml': eml({ from: '"Ahmad Ismail" <ahmad.ismail@mail.example>', to: '"Lim Mei Ling" <meiling@lkp.example>', subject: 'Deposit - Maju Jaya', date: 'Mon, 4 Dec 2023 09:14:00 +0800',
      body: 'Dear Ms Lim,\r\n\r\nThank you for seeing me. As discussed, I paid RM60,000 to Maju Jaya on 3 March 2023. Tan Boon Huat has stopped answering my calls.\r\n\r\nMy wife Siti can confirm what was said. Ravi (the agent, 0129876543) was there too.\r\n\r\nRegards,\r\nAhmad\r\n012-987 6543' }),
    '07 Email Lim to Faizal.eml': eml({ from: '"Lim Mei Ling" <meiling@lkp.example>', to: '"Mohd Faizal Hassan" <faizal@bank.example>', cc: '"Gurdip Singh" <gurdip@lkp.example>', subject: 'Confirmation of transfer', date: 'Wed, 6 Dec 2023 16:02:00 +0800',
      body: 'Dear Encik Faizal,\r\n\r\nWe act for Ahmad bin Ismail (NRIC 800505145521). Please confirm the transfer of RM60,000.00 on 3 March 2023 from his account 8001234567 to Maybank account 514123456789 held by Maju Jaya Sdn Bhd.\r\n\r\nMy colleague Gurdip Singh will collect the letter.\r\n\r\nKind regards,\r\nMei Ling' }),
    '08 Bank confirmation.pdf': pdf([{ text: ['BANK CONFIRMATION', '', '8 December 2023', '', 'To: Messrs Lim, Kaur & Partners', '', 'We confirm that on 3 March 2023 the sum of RM60,000.00 was transferred from', 'account no. 8001234567 (Ahmad Bin Ismail) to account no. 5141 2345 6789', '(MAJU JAYA SDN BHD).', '', 'Muhammad Faizal bin Hassan', 'Branch Manager'] }]),
    '09 Sale and Purchase Agreement (scanned).pdf': pdf([{ scan: ['SALE AND PURCHASE AGREEMENT', '', 'THIS AGREEMENT is made on 3 March 2023', '', 'BETWEEN', '', 'MAJU JAYA SDN BHD (Company No. 201901012345) of Unit 3-2,', 'Persiaran Gurney, 54000 Kuala Lumpur ("the Vendor")', '', 'AND', '', 'AHMAD BIN ISMAIL (NRIC No. 800505-14-5521) of No. 12,', 'Jalan Ampang, 50450 Kuala Lumpur ("the Purchaser")', '', '1. The Vendor agrees to sell the land held under Geran 45678,', 'Lot 1234, Mukim Batu, Daerah Gombak for RM 600,000.00.', '', 'Signed for the Vendor by TAN BOON HUAT', 'Witnessed by RAVI A/L MUTHU'] }]),
    '10 Agent note.png': png(['Meeting note - 3 March 2023', '', 'Present: Ahmad bin Ismail, Siti Nurhaliza,', 'Tan Boon Huat, Ravi Muthu', '', 'Mr Tan said deposit refundable.', 'Signed: Ravi a/l Muthu  019-445 2210']),
    '11 Payment schedule.xlsx': xlsx('Payments', [['Date', 'Payer', 'Payee', 'Account', 'Amount (RM)'], ['3 March 2023', 'Ahmad bin Ismail', 'Maju Jaya Sdn Bhd', '5141 2345 6789', 60000], ['1 June 2023', 'Ahmad bin Ismail', 'Maju Jaya Sdn Bhd', '5141 2345 6789', 0], ['Contact', 'Sarah Thompson', '019-445 2210', '', '']]),
    '12 Witness statement Ravi.docx': docx({
      body: ['WITNESS STATEMENT OF RAVI A/L MUTHU', '',
        'I, Ravi a/l Muthu (NRIC No. 880915-08-5377), of 27, Jalan Tun Sambanthan, 50470 Kuala Lumpur, state as follows:', '',
        '1. I am a registered estate agent. I introduced Ahmad to Maju Jaya.',
        '2. I have known Mr Tan Boon Huat for ten years. Boon Huat is the managing director.',
        '3. On 3 March 2023 Dr Kavitha a/p Subramaniam, a friend of the Plaintiff, was also present for part of the meeting.',
        '4. Dr Kavitha left before the deposit was discussed. Kavitha Subramaniam can confirm this.',
        '5. Mr Ravi\'s commission was to be paid by Perdana Holdings Berhad, the parent of Maju Jaya.'].join('\n'),
    }),
    '13 Defence.txt': [...HEADING, 'PEMBELAAN', '',
      '1. Defendan-Defendan menafikan setiap dakwaan dalam Pernyataan Tuntutan.',
      '2. Deposit telah dilucuthakkan kerana Plaintif gagal membayar baki harga belian.',
      '3. Defendan Kedua, Tan Boon Huat, tidak pernah membuat sebarang janji lisan.',
      '4. Perdana Holdings Berhad bukan pihak kepada perjanjian itu. Perdana Holdings tidak menanggung sebarang liabiliti.', '',
      'Bertarikh 20 Februari 2024', '', 'Tetuan Chong & Co', 'Peguamcara Defendan-Defendan', 'Chong Wei Jie'].join('\n'),
    '14 Related suit notice.txt': 'NOTICE\n\nTake notice that Shah Alam Sessions Court Suit No. BA-A72NCvC-55-03/2023 between Syarikat Bina Teguh Enterprise and Maju Jaya Sdn Bhd concerns the same development.\n\nThe land there is held under HS(D) 9876, PT 555, Mukim Petaling.\n\nThe director of Bina Teguh, Zulkifli bin Omar, drives a lorry BKV 8821.\n\nDated 1 March 2024',
    '15 Passport and ID list.txt': 'IDENTIFICATION\n\nAhmad bin Ismail - MyKad 800505-14-5521 - Passport No. A12345678\nSarah Thompson - Singapore NRIC S8512345D\nSiti Nurhaliza binti Abdullah - 850712-10-5688\nAminah binti Yusof (mother of the Plaintiff) - Taman Desa Jaya, 43000 Kajang, Selangor',
    '16 File note (call with David Wong).txt': 'FILE NOTE\n\n11 December 2023\n\nCalled David Wong Kah Fai, former sales manager of Maju Jaya. David Wong confirmed that Mr Tan routinely promised refunds. Wong Kah Fai is willing to give evidence. Mr Wong asked that we contact him only by email.\n\nNote taken by Gurdip Singh.',
    '17 Chinese notice.txt': '通知\n\n陈文华先生已于二零二三年三月三日收到订金。\n\nPlease see the English translation.',
    '18 Old memo.doc': Buffer.from('\xd0\xcf\x11\xe0 old word binary Ahmad bin Ismail', 'latin1'),
    '19 Photo of cheque.heic': Buffer.from('\x00\x00\x00\x18ftypheic made-up bytes', 'latin1'),
    'Correspondence/20 Reminder letter.docx': docx({
      body: ['20 December 2023', '', 'Maju Jaya (M) Sdn Bhd', 'Attn: Dato Sri Tan Boon Huat', '', 'Dear Sirs,', '', 'REMINDER', '', 'We refer to our letter of 5 December 2023. Our client, Ahmad Bin Ismail, has heard nothing further from Mr Tan or from Maju Jaya.', 'Mohamad Faizal Hassan of the bank has confirmed the transfer in writing.', '', 'Yours faithfully,', 'Lim, Kaur & Partners'].join('\n'),
    }),
  };
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
    await writeFile(path.join(dir, rel), content);
  }
  return Object.keys(files);
}
