// Turns one file into plain text, entirely on this machine.
//
// COMPLETENESS RULE: every part of every file is read, or the file says
// clearly that it could not be. A file ends up in exactly one state:
//   ok         - every part was read (parts[] holds the text, section by
//                section; proof says what was found and what was read)
//   manual     - read, but a person must check it: a page in a non-Latin
//                script, OCR that came out uncertain, or a page with marks
//                but almost no text
//   partial    - some part could not be read. The whole file is blocked.
//   unreadable - nothing could be read
// Only "ok" files are ever written out. Files inside files (zip entries,
// email attachments, files embedded in Word, Excel or PDF) are returned as
// children and read as files in their own right.
//
// Cloaked copies are rebuilt from parts[] only. The original is never copied
// or edited, so nothing hidden in it can carry over.

import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { readZip } from './zip.js';
import { photoDetails } from './metadata.js';

const require = createRequire(import.meta.url);

const TEXT_TYPES = new Set(['.txt', '.md', '.csv', '.tsv', '.log', '.json', '.xml', '.ics', '.vcf']);
const HTML_TYPES = new Set(['.html', '.htm']);
const IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp', '.gif']);
const UNREADABLE = {
  '.doc': 'Old Word format (.doc). Re-save it as .docx or PDF.',
  '.rtf': 'RTF is not supported. Re-save it as .docx or PDF.',
  '.heic': 'iPhone photo format (.heic). Convert it to JPG or PDF first.',
  '.heif': 'iPhone photo format (.heif). Convert it to JPG or PDF first.',
  '.xls': 'Old Excel format (.xls). Re-save it as .xlsx.',
  '.ppt': 'PowerPoint is not supported. Save it as PDF.',
  '.pptx': 'PowerPoint is not supported. Save it as PDF.',
  '.rar': 'RAR archives cannot be opened. Unpack it into the folder.',
  '.7z': '7z archives cannot be opened. Unpack it into the folder.',
  '.gz': 'Compressed archives other than ZIP cannot be opened. Unpack it into the folder.',
  '.tar': 'TAR archives cannot be opened. Unpack it into the folder.',
};

// Below this average confidence a page of OCR text is not trusted.
const MIN_OCR_CONFIDENCE = 60;
// A PDF page whose text layer is shorter than this is also looked at as a
// picture, in case the words are drawn rather than typed.
const SPARSE_PAGE_CHARS = 200;
// More dark pixels than this on a page that gave almost no text means
// something is there that was not read (handwriting, a stamp, a faint scan).
const INK_RATIO = 0.004;
const ALMOST_NO_TEXT = 30;
const MAX_DEPTH = 6;

const NON_LATIN = /[\p{Script=Han}\p{Script=Tamil}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
export function nonLatinCount(text) {
  return (String(text).match(NON_LATIN) || []).length;
}

const xmlDecode = (s) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()];
});
const attr = (tag, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag); return m ? xmlDecode(m[1]) : null; };
/** Every piece of text in an XML part we have no special reader for. */
const xmlText = (xml) => [...xml.replace(/<\?[\s\S]*?\?>/g, '').matchAll(/>([^<]+)</g)].map((m) => xmlDecode(m[1]).trim()).filter(Boolean).join('\n');
const chars = (s) => String(s).replace(/\s/g, '').length;

function newResult(type) {
  return { status: 'ok', type, parts: [], reasons: [], notes: [], children: [], proof: { unit: 'parts', found: 0, read: 0, characters: 0, ocr: [], unread: [] } };
}
// A problem never makes a file less blocked than it already is.
const RANK = { ok: 0, manual: 1, partial: 2, unreadable: 3 };
function flag(result, status, reason) {
  if (RANK[status] > RANK[result.status]) result.status = status;
  result.reasons.push(reason);
  if (status === 'partial') result.proof.unread.push(reason);
}
const add = (result, label, text, extra = {}) => { if (String(text || '').trim()) result.parts.push({ label, text: String(text).trim(), ...extra }); };

// ------------------------------------------------------------------- OCR

let ocrLatin = null;
let ocrOther = null;
let langDirReady = null;

// The OCR engine looks for language data in one folder. The data ships inside
// the app (npm packages); it is copied once to a local folder and never
// downloaded.
async function langDir() {
  if (!langDirReady) {
    langDirReady = (async () => {
      const dir = path.join(os.tmpdir(), 'cloak-ocr-lang');
      await mkdir(dir, { recursive: true });
      for (const l of ['eng', 'msa', 'chi_sim', 'chi_tra', 'tam']) {
        const src = path.join(path.dirname(require.resolve(`@tesseract.js-data/${l}/package.json`)), '4.0.0', `${l}.traineddata.gz`);
        const dest = path.join(dir, `${l}.traineddata.gz`);
        try { await stat(dest); } catch { await copyFile(src, dest); }
      }
      return dir;
    })();
  }
  return langDirReady;
}

async function ocrWorker(langs) {
  const { createWorker } = require('tesseract.js');
  const dir = await langDir();
  return createWorker(langs, 1, { langPath: dir, cachePath: dir, gzip: true });
}

/**
 * OCR one image held in memory. Nothing is written to disk.
 * Returns the text, the page confidence, the script, and the words with their
 * own confidence so unclear marks can be told apart from clear print.
 */
export async function ocrImage(image) {
  ocrLatin ||= ocrWorker(['eng', 'msa']);
  const first = (await (await ocrLatin).recognize(image, {}, { blocks: true })).data;
  let text = first.text || '';
  let confidence = first.confidence ?? 0;
  let script = nonLatinCount(text) >= 5 ? 'non-latin' : 'latin';
  const lines = (first.blocks || []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.map((l) => ({ text: l.text.trim(), words: l.words.map((w) => ({ text: w.text, confidence: w.confidence })) }))));

  // Poor or empty Latin OCR may mean the page is in another script: look
  // again with the Chinese and Tamil models.
  if (confidence < 75 || chars(text) < 20) {
    ocrOther ||= ocrWorker(['chi_sim', 'chi_tra', 'tam']);
    const second = (await (await ocrOther).recognize(image)).data;
    if (nonLatinCount(second.text) >= 8 && (second.confidence ?? 0) >= confidence - 10) {
      script = 'non-latin';
      text = second.text;
      confidence = second.confidence ?? 0;
    }
  }
  return { text, confidence, script, lines };
}

export async function closeOcr() {
  for (const w of [ocrLatin, ocrOther]) if (w) await (await w).terminate().catch(() => {});
  ocrLatin = ocrOther = null;
}

/** Share of dark pixels on a canvas: is there anything drawn on the page? */
function inkRatio(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let dark = 0;
  let seen = 0;
  for (let i = 0; i < data.length; i += 16) { // every 4th pixel
    seen++;
    if (data[i + 3] > 40 && data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11 < 140) dark++;
  }
  return seen ? dark / seen : 0;
}

/** Judge one OCR result and note anything a person has to look at. */
function judgeOcr(result, where, r, ink) {
  if (r.script === 'non-latin') flag(result, 'manual', `${where} is in a non-Latin script (Chinese, Tamil or similar). Needs a manual check.`);
  else if (r.text.trim() && r.confidence < MIN_OCR_CONFIDENCE) flag(result, 'manual', `${where} could not be read reliably (OCR confidence ${Math.round(r.confidence)}%): faint scan, handwriting, stamp or skewed page. Needs a manual check.`);
  else if (chars(r.text) < ALMOST_NO_TEXT && ink !== null && ink > INK_RATIO) flag(result, 'manual', `${where} has marks on it but almost no text could be read (${chars(r.text)} characters). It may be handwriting, a stamp or a picture. Needs a manual check.`);
  else {
    const unclear = r.lines.flatMap((l) => l.words).filter((w) => /[\p{L}\p{N}]{3,}/u.test(w.text) && w.confidence < 50).length;
    const clear = r.lines.flatMap((l) => l.words).filter((w) => w.confidence >= 50).length;
    if (unclear >= 4 && unclear > clear * 0.2) flag(result, 'manual', `${where} has ${unclear} words that could not be read reliably (handwriting, stamp or faint print). Needs a manual check.`);
  }
}

async function canvasOf(buf) {
  const { loadImage, createCanvas } = require('@napi-rs/canvas');
  const img = await loadImage(buf);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas;
}

/** A picture inside another file (Word, Excel). */
async function readPicture(result, name, buf, label) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.svg') { add(result, `${label} (drawing text)`, xmlText(buf.toString('utf8'))); return; }
  if (!IMAGE_TYPES.has(ext)) { flag(result, 'partial', `${label} is in a format that cannot be read (${ext || 'unknown'}).`); return; }
  let ink = null;
  try { ink = inkRatio(await canvasOf(buf)); } catch { /* tif: no pixel check */ }
  const r = await ocrImage(buf);
  result.proof.ocr.push(label);
  judgeOcr(result, label, r, ink);
  add(result, `Text in ${label.toLowerCase()}`, r.text, { ocr: true });
  const details = photoDetails(buf);
  if (details.error) flag(result, 'partial', `${label}: its photo details could not be read (${details.error}).`);
  add(result, `Details stored in ${label.toLowerCase()}`, details.text);
}

// ---------------------------------------------- Office files (ZIP of XML)

const OFFICE_IGNORE = /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/thumbnail\.\w+|(?:word|xl)\/(?:styles|stylesWithEffects|fontTable|webSettings|numbering|commentsExtended|commentsIds|commentsExtensible|calcChain|metadata|sharedStrings)\.xml|(?:word|xl)\/theme\/.*|customXml\/itemProps\d+\.xml|.*\/_rels\/.*\.rels|xl\/worksheets\/sheet\d+\.xml|xl\/workbook\.xml|xl\/persons\/.*)$/;

function officeProperties(zip, result, seen) {
  const lines = [];
  const core = zip.text('docProps/core.xml');
  if (core !== null) {
    seen.add('docProps/core.xml');
    for (const [tag, label] of [['dc:title', 'Title'], ['dc:subject', 'Subject'], ['dc:creator', 'Author'], ['cp:lastModifiedBy', 'Last modified by'], ['cp:keywords', 'Keywords'], ['dc:description', 'Comments'], ['cp:category', 'Category'], ['cp:contentStatus', 'Status']]) {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(core);
      if (m && m[1].trim()) lines.push(`${label}: ${xmlDecode(m[1]).trim()}`);
    }
  }
  const app = zip.text('docProps/app.xml');
  if (app !== null) {
    seen.add('docProps/app.xml');
    for (const [tag, label] of [['Company', 'Company'], ['Manager', 'Manager'], ['HyperlinkBase', 'Link base'], ['Template', 'Template']]) {
      const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(app);
      if (m && m[1].trim()) lines.push(`${label}: ${xmlDecode(m[1]).trim()}`);
    }
  }
  const custom = zip.text('docProps/custom.xml');
  if (custom !== null) {
    seen.add('docProps/custom.xml');
    for (const m of custom.matchAll(/<property\b[^>]*\bname="([^"]*)"[^>]*>([\s\S]*?)<\/property>/g)) lines.push(`${xmlDecode(m[1])}: ${xmlText(m[2])}`);
  }
  add(result, 'Document properties', lines.join('\n'));
}

/** Links and outside files a part points to. */
function externalTargets(zip, seen) {
  const out = [];
  for (const name of zip.names.filter((n) => /_rels\/.*\.rels$/.test(n))) {
    seen.add(name);
    for (const m of zip.text(name).matchAll(/<Relationship\b[^>]*>/g)) {
      if (attr(m[0], 'TargetMode') === 'External') out.push(attr(m[0], 'Target'));
    }
  }
  return [...new Set(out.filter(Boolean))];
}

/** Whatever is left in the file that no reader above has dealt with. */
async function officeLeftovers(zip, result, seen, mediaPrefix) {
  let pic = 0;
  for (const name of zip.names) {
    if (seen.has(name) || name.endsWith('/') || OFFICE_IGNORE.test(name)) continue;
    if (name.startsWith(mediaPrefix)) { pic++; await readPicture(result, name, zip.read(name), `Picture ${pic}`); continue; }
    if (/\/embeddings\//.test(name)) {
      // A file inside the file: read as a file in its own right.
      if (/\.bin$/i.test(name)) flag(result, 'partial', `An embedded object (${path.basename(name)}) is in a format that cannot be opened.`);
      else result.children.push({ name: path.basename(name), buf: zip.read(name), what: 'embedded file' });
      continue;
    }
    if (/printerSettings\d*\.bin$/.test(name)) { add(result, 'Printer settings', printableStrings(zip.read(name))); continue; }
    if (/\.(?:xml|vml)$/i.test(name)) { add(result, `Other content (${path.basename(name)})`, xmlText(zip.text(name))); continue; }
    flag(result, 'partial', `A part of the file could not be read: ${name}.`);
  }
}

function printableStrings(buf) {
  const out = new Set();
  for (const m of buf.toString('latin1').matchAll(/[\x20-\x7e]{4,}/g)) out.add(m[0].trim());
  for (const m of buf.toString('utf16le').matchAll(/[\x20-\x7e]{4,}/g)) out.add(m[0].trim());
  return [...out].filter(Boolean).join('\n');
}

// ------------------------------------------------------------------ .docx

function wordXmlToText(xml) {
  // A text box is stored twice (new and old style): keep one copy.
  xml = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '');
  let out = '';
  const deleted = [];
  const fields = [];
  let inText = false;
  let inDel = false;
  let inField = false;
  let del = '';
  const re = /<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g;
  for (let m; (m = re.exec(xml));) {
    if (m[5] !== undefined) {
      if (inText) out += xmlDecode(m[5]);
      else if (inDel) del += xmlDecode(m[5]);
      else if (inField) fields.push(xmlDecode(m[5]).trim());
      continue;
    }
    const [, close, tag] = m;
    if (tag === 'w:t') inText = !close && !m[4];
    else if (tag === 'w:delText') {
      inDel = !close && !m[4];
      if (close && del.trim()) { deleted.push(del.trim()); del = ''; }
    } else if (tag === 'w:instrText' || tag === 'w:delInstrText') inField = !close && !m[4];
    else if (tag === 'w:tab' && !close) out += '\t';
    else if ((tag === 'w:br' || tag === 'w:cr') && !close) out += '\n';
    else if (tag === 'w:p' && close) out += '\n';
    else if (tag === 'w:tc' && close) out += '\t';
  }
  const people = [...xml.matchAll(/\bw:(?:author|initials)="([^"]+)"/g)].map((m) => xmlDecode(m[1]));
  const described = [...xml.matchAll(/<(?:wp:docPr|pic:cNvPr)\b[^>]*>/g)].flatMap((m) => [attr(m[0], 'descr'), attr(m[0], 'title')]).filter(Boolean);
  // WordArt, labels of form controls, drop-down choices, tooltips, bookmark names.
  described.push(...[...xml.matchAll(/<v:textpath\b[^>]*>/g)].map((m) => attr(m[0], 'string')).filter(Boolean));
  described.push(...[...xml.matchAll(/<w:(?:alias|tag|placeholder|docVar)\b[^>]*>/g)].flatMap((m) => [attr(m[0], 'w:name'), attr(m[0], 'w:val')]).filter(Boolean));
  described.push(...[...xml.matchAll(/<w:listItem\b[^>]*>/g)].flatMap((m) => [attr(m[0], 'w:displayText'), attr(m[0], 'w:value')]).filter(Boolean));
  described.push(...[...xml.matchAll(/\bw:tooltip="([^"]+)"/g)].map((m) => xmlDecode(m[1])));
  described.push(...[...xml.matchAll(/<w:bookmarkStart\b[^>]*>/g)].map((m) => attr(m[0], 'w:name')).filter((n) => n && !/^_/.test(n)).map((n) => n.replace(/_/g, ' ')));
  return { text: out.replace(/\t\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), deleted, fields: fields.filter((f) => /\p{L}{3,}/u.test(f) && !/^(?:PAGE|NUMPAGES|TOC|DATE|TIME)\b/i.test(f)), people, described };
}

async function extractDocx(buf, result) {
  const zip = readZip(buf);
  if (zip.text('word/document.xml') === null) throw new Error('not a Word document');
  const seen = new Set();
  const deleted = [];
  const fields = [];
  const people = [];
  const described = [];
  const read = (label, name) => {
    const xml = zip.text(name);
    if (xml === null) return;
    seen.add(name);
    result.proof.found++;
    const r = wordXmlToText(xml);
    add(result, label, r.text);
    deleted.push(...r.deleted);
    fields.push(...r.fields);
    people.push(...r.people);
    described.push(...r.described);
    result.proof.read++;
  };
  const byKind = (re) => zip.names.filter((n) => re.test(n)).sort();
  read('Body', 'word/document.xml');
  byKind(/^word\/header\d*\.xml$/).forEach((n) => read('Header', n));
  byKind(/^word\/footer\d*\.xml$/).forEach((n) => read('Footer', n));
  read('Footnotes', 'word/footnotes.xml');
  read('Endnotes', 'word/endnotes.xml');
  read('Comments', 'word/comments.xml');
  read('Building blocks', 'word/glossary/document.xml');
  read('Document variables', 'word/settings.xml');
  if (deleted.length) add(result, 'Deleted text (tracked changes)', deleted.join('\n'));
  if (fields.length) add(result, 'Field codes', [...new Set(fields)].join('\n'));
  for (const n of byKind(/^word\/(?:charts|diagrams)\/[^/]+\.xml$/)) { seen.add(n); add(result, 'Text in charts and diagrams', xmlText(zip.text(n))); }
  const who = zip.text('word/people.xml');
  if (who !== null) { seen.add('word/people.xml'); people.push(...[...who.matchAll(/\bw:author="([^"]+)"/g)].map((m) => xmlDecode(m[1]))); }
  if (people.length) add(result, 'Reviewer names', [...new Set(people)].map((p) => `Reviewer: ${p}`).join('\n'));
  if (described.length) add(result, 'Descriptions, labels and bookmarks', [...new Set(described)].join('\n'));
  for (const n of byKind(/^customXml\/item\d+\.xml$/)) { seen.add(n); add(result, 'Custom data', xmlText(zip.text(n))); }
  officeProperties(zip, result, seen);
  const links = externalTargets(zip, seen);
  if (links.length) add(result, 'Links', links.join('\n'));
  await officeLeftovers(zip, result, seen, 'word/media/');
}

// ------------------------------------------------------------------ .xlsx

async function extractXlsx(buf, result) {
  const zip = readZip(buf);
  const wb = zip.text('xl/workbook.xml');
  if (wb === null) throw new Error('not an Excel workbook');
  const seen = new Set(['xl/workbook.xml']);
  result.proof.unit = 'sheets';

  const shared = [];
  for (const si of (zip.text('xl/sharedStrings.xml') || '').match(/<si>[\s\S]*?<\/si>/g) || []) {
    shared.push([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join(''));
  }
  const rels = new Map([...(zip.text('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], 'Id'), attr(m[0], 'Target')]));
  const sheets = [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m, i) => {
    const target = rels.get(attr(m[0], 'r:id')) || `worksheets/sheet${i + 1}.xml`;
    return { name: attr(m[0], 'name') || `Sheet ${i + 1}`, hidden: /hidden/i.test(attr(m[0], 'state') || ''), file: target.startsWith('/') ? target.slice(1) : `xl/${target}` };
  });
  result.proof.found = sheets.length;

  for (const s of sheets) {
    const xml = zip.text(s.file);
    if (xml === null) { flag(result, 'partial', `Sheet "${s.name}" could not be read.`); continue; }
    seen.add(s.file);
    const rows = [];
    for (const row of xml.match(/<row\b[\s\S]*?<\/row>/g) || []) {
      const cells = [];
      for (const c of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = (/\bt="(\w+)"/.exec(c[1]) || [])[1];
        const inner = c[2] || '';
        const v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        const f = (/<f\b[^>]*>([\s\S]*?)<\/f>/.exec(inner) || [])[1];
        let value;
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') value = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join('');
        else value = v === undefined ? '' : xmlDecode(v);
        cells.push(f ? `${value} [formula: =${xmlDecode(f)}]` : value);
      }
      if (cells.some((x) => x !== '')) rows.push(cells.join('\t'));
    }
    const extra = [];
    for (const m of xml.matchAll(/<(oddHeader|oddFooter|evenHeader|evenFooter|firstHeader|firstFooter)>([\s\S]*?)<\/\1>/g)) extra.push(`Page ${/Header/.test(m[1]) ? 'header' : 'footer'}: ${xmlDecode(m[2])}`);
    for (const m of xml.matchAll(/<formula[12]>([\s\S]*?)<\/formula[12]>/g)) extra.push(`Drop-down list: ${xmlDecode(m[1])}`);
    for (const m of xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, '').matchAll(/\b(?:user|userName|comment|prompt|error|promptTitle|errorTitle|name)="([^"]{2,})"/g)) extra.push(`Stored note: ${xmlDecode(m[1])}`);
    for (const m of xml.matchAll(/<hyperlink\b[^>]*>/g)) extra.push(...[attr(m[0], 'display'), attr(m[0], 'tooltip'), attr(m[0], 'location')].filter(Boolean).map((x) => `Link: ${x}`));
    add(result, `Sheet: ${s.name}${s.hidden ? ' (hidden sheet)' : ''}`, [`Sheet name: ${s.name}`, ...rows, ...extra].join('\n'));
    result.proof.read++;
  }

  const users = [...wb.matchAll(/\b(?:userName|lastEdited|codeName)="([^"]{2,})"/g)].map((m) => `Stored note: ${xmlDecode(m[1])}`);
  if (users.length) add(result, 'Workbook details', users.join('\n'));
  const defined = [...wb.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)].map((m) => `Defined name: ${(attr(m[1], 'name') || '').replace(/_/g, ' ')} = ${xmlDecode(m[2])}`);
  if (defined.length) add(result, 'Defined names', defined.join('\n'));

  const notes = [];
  for (const n of zip.names.filter((x) => /^xl\/(?:comments\d*|threadedComments\/[^/]+)\.xml$/.test(x))) {
    seen.add(n);
    const xml = zip.text(n);
    notes.push(...[...xml.matchAll(/<author>([\s\S]*?)<\/author>/g)].map((m) => `Comment by: ${xmlDecode(m[1])}`));
    notes.push(...[...xml.matchAll(/<(?:comment|threadedComment)\b[^>]*>([\s\S]*?)<\/(?:comment|threadedComment)>/g)].map((m) => xmlText(`>${m[1]}<`).replace(/\n/g, ' ')));
  }
  for (const n of zip.names.filter((x) => /^xl\/persons\//.test(x))) notes.push(...[...zip.text(n).matchAll(/\bdisplayName="([^"]+)"/g)].map((m) => `Comment by: ${xmlDecode(m[1])}`));
  if (notes.length) add(result, 'Comments', [...new Set(notes)].join('\n'));

  for (const n of zip.names.filter((x) => /^xl\/(?:drawings|charts|diagrams)\/[^/]+\.xml$/.test(x))) { seen.add(n); add(result, 'Text boxes and charts', xmlText(zip.text(n))); }
  for (const n of zip.names.filter((x) => /^xl\/(?:pivotCache|externalLinks|queryTables|connections|tables)\b.*\.xml$/.test(x) && !/_rels/.test(x))) {
    seen.add(n);
    const xml = zip.text(n);
    const values = [...xml.matchAll(/\b(?:v|name|displayName|connectionString|command)="([^"]+)"/g)].map((m) => xmlDecode(m[1]));
    add(result, `Stored data (${path.basename(n)})`, [...new Set([...values, xmlText(xml)])].filter(Boolean).join('\n'));
  }
  officeProperties(zip, result, seen);
  const links = externalTargets(zip, seen);
  if (links.length) add(result, 'Links and outside files', links.join('\n'));
  await officeLeftovers(zip, result, seen, 'xl/media/');
}

// ------------------------------------------------------------------- .pdf

let pdfjsReady = null;
async function extractPdf(buf, result) {
  pdfjsReady ||= import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfjs = await pdfjsReady;
  const { createCanvas } = require('@napi-rs/canvas');
  let doc;
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
  try {
    doc = await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new Error('password-protected');
    throw err;
  }
  result.proof.unit = 'pages';
  result.proof.found = doc.numPages;
  const wordsOf = (t) => new Set((t.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []));
  const pinned = new Map(); // files attached to pages

  for (let n = 1; n <= doc.numPages; n++) {
    let page;
    try {
      page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('').trim();
      const ops = await page.getOperatorList();
      const hasPicture = ops.fnArray.some((f) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject);
      const sparse = chars(text) < SPARSE_PAGE_CHARS;

      // The page is also read as a picture when it has pictures on it or
      // has very little typed text: words may be drawn, scanned or stamped.
      let ocr = null;
      let ink = null;
      if (hasPicture || sparse) {
        const viewport = page.getViewport({ scale: 2 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const g = canvas.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: g, viewport, canvas }).promise;
        ink = inkRatio(canvas);
        if (ink > 0.0005) ocr = await ocrImage(canvas.toBuffer('image/png'));
      }

      const layer = chars(text);
      if (!ocr) {
        add(result, `Page ${n}`, text);
      } else if (layer < 20) {
        // No usable text layer: a scanned page.
        result.proof.ocr.push(n);
        judgeOcr(result, `Page ${n}`, ocr, ink);
        add(result, `Page ${n} (scanned)`, ocr.text, { ocr: true });
      } else {
        add(result, `Page ${n}`, text);
        // Lines the picture of the page shows that the text layer does not
        // have: words inside pictures, stamps, handwriting.
        const known = wordsOf(text);
        const extra = ocr.lines.filter((l) => {
          const w = [...wordsOf(l.text)];
          return w.length >= 1 && w.filter((x) => known.has(x)).length < w.length * 0.5;
        });
        const clear = extra.filter((l) => l.words.every((w) => w.confidence >= 50) || l.words.filter((w) => w.confidence >= 60).length >= l.words.length * 0.7);
        const unclear = extra.length - clear.length;
        if (extra.length) result.proof.ocr.push(n);
        if (clear.length) add(result, `Page ${n} (text found only in pictures)`, clear.map((l) => l.text).join('\n'), { ocr: true });
        if (unclear >= 2) flag(result, 'manual', `Page ${n} has ${unclear} line(s) inside pictures that could not be read reliably (stamp, handwriting or faint print). Needs a manual check.`);
        if (nonLatinCount(ocr.text) >= 5 && nonLatinCount(text) < 5) flag(result, 'manual', `Page ${n} has a picture with non-Latin script. Needs a manual check.`);
      }

      // Notes, highlights with comments, form fields and files pinned to the page.
      const notes = [];
      for (const a of await page.getAnnotations()) {
        const bits = [a.titleObj?.str && `Note by: ${a.titleObj.str}`, a.contentsObj?.str, a.fieldName && a.fieldValue ? `Form field ${a.fieldName}: ${[].concat(a.fieldValue).join(', ')}` : (typeof a.fieldValue === 'string' ? a.fieldValue : null), a.alternativeText, a.url || a.unsafeUrl].filter((x) => x && String(x).trim());
        notes.push(...bits);
        if (a.fileId || a.file) {
          const content = a.file?.content || (a.fileId ? await doc.getAttachmentContent(a.fileId).catch(() => null) : null);
          const fileName = a.filename || a.file?.filename || `attachment-page-${n}`;
          if (content) pinned.set(fileName, Buffer.from(content));
          else flag(result, 'partial', `A file attached to page ${n} could not be opened.`);
        }
      }
      if (notes.length) add(result, `Page ${n} notes and form fields`, [...new Set(notes)].join('\n'));
      result.proof.read++;
    } catch (err) {
      flag(result, 'partial', `Page ${n} could not be read (${err.message}).`);
    } finally {
      page?.cleanup();
    }
  }

  const outline = [];
  const walkOutline = (items) => { for (const it of items || []) { if (it.title) outline.push(it.title); walkOutline(it.items); } };
  walkOutline(await doc.getOutline().catch(() => null));
  if (outline.length) add(result, 'Bookmarks', outline.join('\n'));

  const fields = await doc.getFieldObjects().catch(() => null);
  if (fields) {
    const lines = [...(fields instanceof Map ? fields : Object.entries(fields))].flatMap(([name, list]) => list.filter((f) => f.value || f.defaultValue).map((f) => `Form field ${name}: ${[].concat(f.value || f.defaultValue).join(', ')}`));
    if (lines.length) add(result, 'Form fields', [...new Set(lines)].join('\n'));
  }

  const attachments = await doc.getAttachments().catch(() => null);
  for (const [id, a] of attachments instanceof Map ? attachments : Object.entries(attachments || {})) {
    const content = a?.content || await doc.getAttachmentContent?.(id).catch(() => null);
    if (content) pinned.set(a?.filename || id, Buffer.from(content));
    else flag(result, 'partial', 'A file attached inside the PDF could not be opened.');
  }
  for (const [fileName, content] of pinned) result.children.push({ name: fileName, buf: content, what: 'file attached inside a PDF' });

  const meta = await doc.getMetadata().catch(() => null);
  if (meta) {
    const labels = { Title: 'Title', Author: 'Author', Subject: 'Subject', Keywords: 'Keywords', Creator: 'Created with', Producer: 'Produced with' };
    const lines = Object.entries(meta.info || {}).filter(([k, v]) => typeof v === 'string' && v.trim() && (labels[k] || k === 'Custom' || !/^(?:PDFFormatVersion|Language|EncryptFilterName|CreationDate|ModDate|Trapped)$/.test(k))).map(([k, v]) => `${labels[k] || k}: ${v}`);
    for (const [k, v] of Object.entries(meta.info?.Custom || {})) lines.push(`${k}: ${v}`);
    const xmp = meta.metadata?.getAll?.() || {};
    for (const [k, v] of Object.entries(xmp)) if (/creator|title|description|subject|rights|author|keywords/i.test(k) && v) lines.push(`${k.replace(/^.*:/, '')}: ${[].concat(v).join(', ')}`);
    if (meta.info?.IsXFAPresent) flag(result, 'partial', 'The PDF contains an XFA form, which cannot be read.');
    if (lines.length) add(result, 'Document properties', [...new Set(lines)].join('\n'));
  }
  await task.destroy();
}

// ----------------------------------------------------------------- emails

function decodeBytes(body, encoding) {
  const enc = (encoding || '').toLowerCase();
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64');
  if (enc === 'quoted-printable') return Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  return Buffer.from(body, 'latin1');
}
function decodeText(bytes, charset) {
  try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch { return bytes.toString('utf8'); }
}
function decodeHeader(value) {
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, charset, kind, data) =>
    decodeText(decodeBytes(kind.toUpperCase() === 'B' ? data : data.replace(/_/g, ' '), kind.toUpperCase() === 'B' ? 'base64' : 'quoted-printable'), charset));
}

function htmlToText(html) {
  return xmlDecode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const MIME_EXT = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'text/calendar': '.ics', 'message/rfc822': '.eml', 'application/zip': '.zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx', 'application/msword': '.doc' };

function parseMime(raw, out = { text: [], html: [], attachments: [] }) {
  const split = raw.search(/\r?\n\r?\n/);
  const head = split < 0 ? raw : raw.slice(0, split);
  const body = split < 0 ? '' : raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  out.headers ||= headers;
  const type = headers['content-type'] || 'text/plain';
  const mime = type.split(';')[0].trim().toLowerCase();
  const boundary = (/boundary="?([^";]+)"?/i.exec(type) || [])[1];
  if (boundary) {
    for (const piece of body.split(`--${boundary}`).slice(1)) {
      if (piece.startsWith('--')) break;
      parseMime(piece.replace(/^\r?\n/, ''), out);
    }
    return out;
  }
  const disposition = headers['content-disposition'] || '';
  const fileName = decodeHeader((/filename\*?="?([^";]+)"?/i.exec(disposition) || /name\*?="?([^";]+)"?/i.exec(type) || [])[1] || '');
  if (mime === 'message/rfc822') { out.attachments.push({ name: fileName || `attached-email-${out.attachments.length + 1}.eml`, buf: decodeBytes(body, headers['content-transfer-encoding']) }); return out; }
  if (/attachment/i.test(disposition) || fileName || !/^text\/(?:plain|html)/.test(mime)) {
    out.attachments.push({ name: fileName || `attachment-${out.attachments.length + 1}${MIME_EXT[mime] || ''}`, buf: decodeBytes(body, headers['content-transfer-encoding']) });
    return out;
  }
  const decoded = decodeText(decodeBytes(body, headers['content-transfer-encoding']), (/charset="?([^";]+)"?/i.exec(type) || [])[1]);
  (mime === 'text/html' ? out.html : out.text).push(decoded);
  return out;
}

function emailParts(result, { from, sender, replyTo, to, cc, bcc, subject, date, text, html }) {
  const head = [['From', from], ['Sender', sender], ['Reply-To', replyTo], ['To', to], ['Cc', cc], ['Bcc', bcc], ['Date', date], ['Subject', subject]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
  const plain = (text || '').replace(/\r\n/g, '\n').trim();
  const fromHtml = html ? htmlToText(html) : '';
  add(result, 'Email', `${head}\n\n${plain || fromHtml}`);
  // The formatted version of an email can say things the plain one does not.
  if (plain && fromHtml) {
    const have = new Set(plain.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
    const extra = fromHtml.split('\n').filter((l) => { const w = l.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []; return w.length && w.some((x) => !have.has(x)); });
    if (extra.length) add(result, 'Email (formatted version, extra text)', extra.join('\n'));
  }
}

function extractEml(buf, result) {
  const m = parseMime(buf.toString('latin1'));
  const h = (k) => decodeHeader(m.headers[k] || '');
  emailParts(result, { from: h('from'), sender: h('sender'), replyTo: h('reply-to'), to: h('to'), cc: h('cc'), bcc: h('bcc'), subject: h('subject'), date: h('date'), text: m.text.join('\n\n'), html: m.html.join('\n') });
  result.proof.found = 1 + m.attachments.length;
  result.proof.read = 1;
  for (const a of m.attachments) result.children.push({ ...a, what: 'email attachment' });
}

function extractMsg(buf, result) {
  const MsgReader = require('@kenjiuno/msgreader').default;
  const reader = new MsgReader(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const d = reader.getFileData();
  if (d.error) throw new Error(d.error);
  const who = (r) => [r.name, r.smtpAddress || r.email].filter(Boolean).join(' ');
  const rec = (kind) => (d.recipients || []).filter((r) => (r.recipType || 'to') === kind).map(who).join('; ');
  emailParts(result, {
    from: [d.senderName, d.senderSmtpAddress || d.senderEmail].filter(Boolean).join(' '),
    to: rec('to'), cc: rec('cc'), bcc: rec('bcc'), subject: d.subject, date: d.messageDeliveryTime || d.clientSubmitTime,
    text: d.body, html: typeof d.bodyHtml === 'string' ? d.bodyHtml : '',
  });
  if (!String(d.body || '').trim() && !(typeof d.bodyHtml === 'string' && d.bodyHtml.trim())) flag(result, 'partial', 'The body of this Outlook email is stored in a rich-text form that cannot be read.');
  const list = d.attachments || [];
  result.proof.found = 1 + list.length;
  result.proof.read = 1;
  list.forEach((a, i) => {
    try {
      if (a.innerMsgContent) throw new Error('an email attached inside an Outlook email');
      const file = reader.getAttachment(a);
      if (!file?.content) throw new Error('empty');
      result.children.push({ name: file.fileName || a.fileName || `attachment-${i + 1}`, buf: Buffer.from(file.content), what: 'email attachment' });
    } catch (err) {
      flag(result, 'partial', `Attachment ${i + 1} could not be opened (${err.message}).`);
    }
  });
}

// ------------------------------------------------------------ zip archive

function extractZip(buf, result) {
  const zip = readZip(buf);
  result.type = 'zip';
  const entries = zip.names.filter((n) => !n.endsWith('/'));
  result.proof.unit = 'files';
  result.proof.found = entries.length;
  for (const name of entries) {
    try {
      result.children.push({ name, buf: zip.read(name), what: 'file inside a zip' });
      result.proof.read++;
    } catch (err) {
      flag(result, 'partial', `"${name}" inside the zip could not be opened (${/password/.test(err.message) ? 'password-protected' : err.message}).`);
    }
  }
  result.container = true;
}

// -------------------------------------------------------------- one file

/**
 * Read one file held in memory. Never throws: a file that cannot be read
 * comes back as "unreadable" with the reason. Files found inside it are in
 * result.children, not yet read.
 */
export async function extractBuffer(name, buf) {
  const ext = path.extname(name).toLowerCase();
  const result = newResult(ext.slice(1) || 'unknown');
  const fail = (reason) => Object.assign(result, { status: 'unreadable', parts: [], children: [], reasons: [reason] });
  if (UNREADABLE[ext]) return fail(UNREADABLE[ext]);
  try {
    if (TEXT_TYPES.has(ext)) {
      const utf16 = buf[0] === 0xff && buf[1] === 0xfe ? 'utf-16le' : buf[0] === 0xfe && buf[1] === 0xff ? 'utf-16be' : null;
      add(result, 'Text', (utf16 ? new TextDecoder(utf16).decode(buf) : buf.toString('utf8')).replace(/^\uFEFF/, ''));
      result.proof.found = result.proof.read = 1;
    }
    else if (HTML_TYPES.has(ext)) { add(result, 'Text', htmlToText(buf.toString('utf8'))); result.proof.found = result.proof.read = 1; }
    else if (ext === '.docx' || ext === '.docm') await extractDocx(buf, result);
    else if (ext === '.xlsx' || ext === '.xlsm') await extractXlsx(buf, result);
    else if (ext === '.pdf') await extractPdf(buf, result);
    else if (ext === '.eml') extractEml(buf, result);
    else if (ext === '.msg') extractMsg(buf, result);
    else if (ext === '.zip') extractZip(buf, result);
    else if (IMAGE_TYPES.has(ext)) {
      result.proof.unit = 'pages';
      result.proof.found = 1;
      let ink = null;
      try { ink = inkRatio(await canvasOf(buf)); } catch { /* tif: no pixel check */ }
      const r = await ocrImage(buf);
      result.proof.ocr.push(1);
      judgeOcr(result, 'The picture', r, ink);
      add(result, 'Picture (scanned)', r.text, { ocr: true });
      const details = photoDetails(buf);
      if (details.error) flag(result, 'partial', `The photo details stored in the picture could not be read (${details.error}).`);
      add(result, 'Photo details', details.text);
      result.proof.read = 1;
      // A picture with nothing on it is still "read": say so.
      if (!result.parts.length && result.status === 'ok') add(result, 'Picture (scanned)', '(no text found in the picture)', { ocr: true });
    } else return fail(`File type ${ext || '(none)'} is not supported.`);
  } catch (err) {
    return fail(/password/i.test(err.message) ? 'The file is password-protected. Remove the password and try again.' : `The file could not be opened (${err.message}).`);
  }

  // A text layer in Chinese, Tamil, Jawi etc.: the name rules do not cover
  // those scripts, so a person must check the file.
  const other = result.parts.reduce((n, p) => n + (p.ocr ? 0 : nonLatinCount(p.text)), 0);
  if (other >= 5) flag(result, 'manual', `Contains ${other} characters in a non-Latin script (Chinese, Tamil, Jawi or similar). Names in those scripts are not detected. Needs a manual check.`);
  result.parts = result.parts.filter((p) => p.text.trim());
  result.proof.characters = result.parts.reduce((n, p) => n + p.text.length, 0);
  result.proof.parts = result.parts.map((p) => ({ part: p.label, characters: p.text.length }));
  if (!result.parts.length && !result.container && result.status === 'ok') fail('No text was found in the file.');
  return result;
}

/**
 * Read a file from disk and every file inside it, to any depth. Returns a
 * flat list: the file first, then what was found inside it. A file is blocked
 * if anything inside it could not be fully read.
 */
export async function extractTree(file, rel = path.basename(file)) {
  const out = [];
  async function visit(name, buf, relPath, depth, what) {
    const r = await extractBuffer(name, buf);
    const node = { ...r, rel: relPath, inside: what || null };
    delete node.children;
    out.push(node);
    for (const child of r.children || []) {
      const childRel = `${relPath}/${child.name}`;
      if (depth >= MAX_DEPTH) {
        out.push({ ...newResult(path.extname(child.name).slice(1)), status: 'unreadable', reasons: ['Nested too deeply inside other files to open.'], rel: childRel, inside: child.what });
        flag(node, 'partial', `"${child.name}" inside this file is nested too deeply to open.`);
        continue;
      }
      const sub = await visit(child.name, child.buf, childRel, depth + 1, child.what);
      // Never export a file whose attachment or embedded file was not fully read.
      if (!node.container && sub.status !== 'ok') flag(node, sub.status === 'manual' ? 'manual' : 'partial', `"${child.name}" inside this file ${sub.status === 'manual' ? 'needs a manual check' : 'could not be fully read'}.`);
    }
    return node;
  }
  let buf;
  try {
    buf = await readFile(file);
  } catch (err) {
    return [{ ...newResult(path.extname(file).slice(1)), status: 'unreadable', reasons: [`The file could not be opened (${err.message}).`], rel, inside: null }];
  }
  await visit(path.basename(file), buf, rel, 0, null);
  return out;
}

/** Read one file from disk (without the files inside it). */
export async function extractFile(file) {
  return (await extractTree(file))[0];
}
