// Test helper: builds tiny made-up PDFs in memory (never shipped).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// The made-up fax and JPEG 2000 pictures kept in pdf-decoders.test.js.
const src = readFileSync(fileURLToPath(new URL('./pdf-decoders.test.js', import.meta.url)), 'utf8');
export const FAX = Buffer.from(/const FAX = '([^']+)'/.exec(src)[1], 'base64');
export const JPX = Buffer.from(/const JPX = '([^']+)'/.exec(src)[1], 'base64');
export const FAX_DICT = '/BitsPerComponent 1 /Filter /CCITTFaxDecode /DecodeParms << /K -1 /BlackIs1 false /Columns 1200 /Rows 400 >>';

const stream = (dict, data) => Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);

/**
 * A PDF with several pages. Each page is { resources: (firstObj) => string,
 * content: string, objects: [...] }; its own objects are numbered from firstObj.
 */
export function multiPagePdf(pages) {
  const bodies = [null, null];
  const kids = [];
  for (const p of pages) {
    const pageNo = bodies.length + 1;
    kids.push(pageNo);
    bodies.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${p.resources(pageNo + 2)} /Contents ${pageNo + 1} 0 R >>`));
    bodies.push(stream('', Buffer.from(p.content, 'latin1')));
    for (const o of p.objects || []) bodies.push(Buffer.isBuffer(o.data) ? stream(o.dict, o.data) : Buffer.from(o));
  }
  bodies[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>');
  bodies[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  const chunks = [Buffer.from('%PDF-1.5\n')];
  const offsets = [];
  let at = chunks[0].length;
  bodies.forEach((body, i) => {
    const piece = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), body, Buffer.from('\nendobj\n')]);
    offsets.push(at);
    at += piece.length;
    chunks.push(piece);
  });
  chunks.push(Buffer.from(`xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

const esc = (s) => s.replace(/[()\\]/g, (c) => `\\${c}`);
/** A typed page in Helvetica. */
export const textPage = (lines) => ({
  resources: (n) => `<< /Font << /F1 ${n} 0 R >> >>`,
  content: `BT /F1 11 Tf 72 740 Td 14 TL ${lines.map((l) => `(${esc(l)}) '`).join(' ')} ET`,
  objects: ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
});
export const LETTER = textPage(['MESSRS EXAMPLE & CO (made-up firm)', 'Advocates & Solicitors', '1 March 2026', 'Dear Sirs,', 'We enclose the statement of our client (next page).', 'Please acknowledge receipt of this made-up letter.', 'Yours faithfully,']);

/** A scanned page: one picture, optionally with a short typed stamp (a Bates number). */
export const scanPage = (width, height, dict, data, stamp = null) => ({
  resources: (n) => `<< /XObject << /Im1 ${n} 0 R >>${stamp ? ` /Font << /F1 ${n + 1} 0 R >>` : ''} >>`,
  content: `q ${width / 2} 0 0 ${height / 2} 36 600 cm /Im1 Do Q${stamp ? ` BT /F1 9 Tf 480 40 Td (${esc(stamp)}) Tj ET` : ''}`,
  objects: [{ dict: `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray ${dict}`, data }, ...(stamp ? ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'] : [])],
});

/** 1200 x 400 8-bit grey picture of `text` in grey level `grey` (made up with a canvas). */
export function greyPicture(text, grey) {
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(1200, 400);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 1200, 400);
  g.fillStyle = `rgb(${grey},${grey},${grey})`;
  g.font = 'bold 64px sans-serif';
  text.split('\n').forEach((l, i) => g.fillText(l, 40, 140 + i * 90));
  const rgba = g.getImageData(0, 0, 1200, 400).data;
  const out = Buffer.alloc(1200 * 400);
  for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4];
  return out;
}
