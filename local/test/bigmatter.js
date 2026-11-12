// A second made-up matter with realistic sizes, for measuring speed:
//   - a 300-page scanned bundle (pictures only, no text layer)
//   - a 60-page typed agreement
//   - a 5,000-row spreadsheet (a client ledger)
// Every name and number is invented.

import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pdf, xlsx } from './matter.js';

const require = createRequire(import.meta.url);
const { createCanvas } = require('@napi-rs/canvas');

let seed = 20261112;
const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed % n; };
const pick = (list) => list[rnd(list.length)];
const SYL = ['ha', 'ri', 'ma', 'na', 'si', 'ta', 'ra', 'ju', 'ka', 'li', 'mu', 'da', 'fa', 'zu', 'ni', 'bu', 'sa', 'la', 'ya', 'wi', 'ro', 'pe', 'ge', 'to'];
const word = (min = 2, max = 3) => { let w = ''; for (let i = min + rnd(max - min + 1); i > 0; i--) w += pick(SYL); return w[0].toUpperCase() + w.slice(1); };
const SURNAMES = ['Tan', 'Lim', 'Lee', 'Wong', 'Ng', 'Chan', 'Chong', 'Teoh', 'Khaw', 'Loo', 'Yeoh', 'Ooi', 'Kuan', 'Gan', 'Yap', 'Foo'];

/** A made-up person: Malay (bin / binti), Chinese or Indian (a/l, a/p). */
export function person() {
  const r = rnd(100);
  if (r < 60) return `${word()} ${word(1, 2)} ${rnd(2) ? 'bin' : 'binti'} ${word()}`;
  if (r < 85) return `${pick(SURNAMES)} ${word(1, 2)} ${word(1, 2)}`;
  return `${word()} ${rnd(2) ? 'a/l' : 'a/p'} ${word()}`;
}
const company = () => `${word()} ${word(1, 2)} ${pick(['Sdn Bhd', 'Berhad', 'Trading', 'Enterprise'])}`;
const nric = () => `${String(50 + rnd(50)).padStart(2, '0')}${String(1 + rnd(12)).padStart(2, '0')}${String(1 + rnd(28)).padStart(2, '0')}-${String(1 + rnd(14)).padStart(2, '0')}-${String(1000 + rnd(9000))}`;
const phone = () => `01${rnd(10)}-${100 + rnd(900)} ${1000 + rnd(9000)}`;
const address = () => `No. ${1 + rnd(99)}, Jalan ${word()} ${1 + rnd(20)}, Taman ${word()}, ${String(40000 + rnd(9999))} Shah Alam, Selangor`;

const SENTENCES = [
  () => `The Plaintiff, ${person()} (NRIC ${nric()}), of ${address()}, entered into the agreement with ${company()}.`,
  () => `On the said date ${person()} telephoned our client on ${phone()} and confirmed that ${company()} would pay the sum of RM ${(1000 + rnd(90000)).toLocaleString('en-US')}.00.`,
  () => `Encik ${person()} states that the goods were collected from the premises and signed for by ${person()}.`,
  () => `We refer to the letter of demand to ${company()} dated ${1 + rnd(28)} March 2023 and to the reply from Puan ${person()}.`,
  () => `Pursuant to Section ${1 + rnd(90)} of the Contracts Act 1950 the Vendor shall deliver vacant possession within ${1 + rnd(12)} weeks.`,
  () => `The parties agree that all notices shall be sent to ${person()} at ${address()} or by email to ${word().toLowerCase()}@mail.example.`,
];
const paragraph = () => Array.from({ length: 3 + rnd(3) }, () => pick(SENTENCES)()).join(' ');
const wrap = (text, width) => { const out = []; let line = ''; for (const w of text.split(' ')) { if ((line + ' ' + w).trim().length > width) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); } if (line) out.push(line); return out; };

function scanPage(lines) {
  const c = createCanvas(1654, 2339);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 1654, 2339);
  g.fillStyle = '#111'; g.font = '30px serif';
  lines.forEach((l, i) => g.fillText(l, 130, 200 + i * 52));
  return c.toBuffer('image/jpeg', 60);
}

export async function makeBigMatter(dir, { scanPages = 300, agreementPages = 60, sheetRows = 5000 } = {}) {
  await mkdir(dir, { recursive: true });
  const t0 = Date.now();

  // 300-page scanned bundle: pictures only.
  const { pdfFile, stream } = await import('./matter.js');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', null];
  const kids = [];
  for (let n = 0; n < scanPages; n++) {
    const lines = wrap(paragraph() + ' ' + paragraph(), 78).slice(0, 36);
    const jpg = scanPage(lines);
    const at = objects.length + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${at + 2} 0 R >> >> /Contents ${at + 1} 0 R >>`);
    objects.push(stream('', 'q 595 0 0 842 0 0 cm /Im0 Do Q'));
    objects.push(stream('/Type /XObject /Subtype /Image /Width 1654 /Height 2339 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', jpg));
    kids.push(`${at} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  await writeFile(path.join(dir, 'Bundle of documents (scanned).pdf'), pdfFile(objects));

  // 60-page typed agreement.
  const pages = [];
  for (let n = 0; n < agreementPages; n++) pages.push({ text: [`SALE AND PURCHASE AGREEMENT - PAGE ${n + 1}`, '', ...wrap(paragraph() + ' ' + paragraph() + ' ' + paragraph(), 92)].slice(0, 46) });
  await writeFile(path.join(dir, 'Sale and purchase agreement.pdf'), pdf(pages));

  // 5,000-row client ledger.
  const rows = [['Ref', 'Client', 'NRIC', 'Phone', 'Email', 'Company', 'Amount (RM)', 'Date']];
  for (let i = 1; i <= sheetRows; i++) {
    const name = person();
    rows.push([`LED-${String(i).padStart(5, '0')}`, name, nric(), phone(), `${name.split(' ')[0].toLowerCase()}${i}@mail.example`, company(), 500 + rnd(90000), `${1 + rnd(28)} Feb 2024`]);
  }
  await writeFile(path.join(dir, 'Client ledger.xlsx'), xlsx('Ledger', rows));
  return { seconds: (Date.now() - t0) / 1000 };
}
