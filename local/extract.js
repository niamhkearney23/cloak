// Turns one file into plain text, entirely on this machine.
//
// Every file ends up in exactly one of three states:
//   ok         - text was read (parts[] holds it, section by section)
//   manual     - text was read but cannot be trusted to be complete or
//                cloakable: a page in Chinese, Tamil or another non-Latin
//                script, or OCR that came out too uncertain. Export is blocked.
//   unreadable - nothing could be read (old .doc, .heic, password-protected,
//                damaged, unknown type). Listed and blocked, never skipped.
//
// Cloaked output is built only from parts[], so anything not extracted here
// (document properties, embedded objects) is simply absent from the output.

import { readFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { readZip } from './zip.js';

const require = createRequire(import.meta.url);

const TEXT_TYPES = new Set(['.txt', '.md', '.csv', '.log']);
const IMAGE_TYPES = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp']);
const UNREADABLE = {
  '.doc': 'Old Word format (.doc). Re-save it as .docx or PDF.',
  '.rtf': 'RTF is not supported. Re-save it as .docx or PDF.',
  '.heic': 'iPhone photo format (.heic). Convert it to JPG or PDF first.',
  '.heif': 'iPhone photo format (.heif). Convert it to JPG or PDF first.',
  '.xls': 'Old Excel format (.xls). Re-save it as .xlsx.',
  '.ppt': 'PowerPoint is not supported. Save it as PDF.',
  '.pptx': 'PowerPoint is not supported. Save it as PDF.',
  '.zip': 'ZIP archive. Unzip it into the folder.',
};

// Below this average confidence the OCR text is not trusted.
const MIN_OCR_CONFIDENCE = 60;
// A PDF page with fewer characters than this in its text layer is treated as
// a scan and sent to OCR.
const MIN_TEXT_LAYER_CHARS = 20;

const NON_LATIN = /[\p{Script=Han}\p{Script=Tamil}\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Thai}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
export function nonLatinCount(text) {
  return (String(text).match(NON_LATIN) || []).length;
}

const xmlDecode = (s) => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e.toLowerCase()];
});

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

/** OCR one image held in memory. Nothing is written to disk. */
export async function ocrImage(image) {
  ocrLatin ||= ocrWorker(['eng', 'msa']);
  const first = (await (await ocrLatin).recognize(image)).data;
  let text = first.text || '';
  let confidence = first.confidence ?? 0;
  let script = nonLatinCount(text) >= 5 ? 'non-latin' : 'latin';

  // Poor or empty Latin OCR may mean the page is in another script: look
  // again with the Chinese and Tamil models.
  if (confidence < 75 || text.replace(/\s/g, '').length < 20) {
    ocrOther ||= ocrWorker(['chi_sim', 'chi_tra', 'tam']);
    const second = (await (await ocrOther).recognize(image)).data;
    if (nonLatinCount(second.text) >= 8 && (second.confidence ?? 0) >= confidence - 10) {
      script = 'non-latin';
      text = second.text;
      confidence = second.confidence ?? 0;
    }
  }
  return { text, confidence, script };
}

export async function closeOcr() {
  for (const w of [ocrLatin, ocrOther]) if (w) await (await w).terminate().catch(() => {});
  ocrLatin = ocrOther = null;
}

// ------------------------------------------------------------------ .docx

function wordXmlToText(xml) {
  let out = '';
  const deleted = [];
  let inText = false;
  let inDel = false;
  let del = '';
  const re = /<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g;
  for (let m; (m = re.exec(xml));) {
    if (m[5] !== undefined) {
      if (inText) out += xmlDecode(m[5]);
      else if (inDel) del += xmlDecode(m[5]);
      continue;
    }
    const [, close, tag] = m;
    if (tag === 'w:t') inText = !close && !m[4];
    else if (tag === 'w:delText') {
      inDel = !close && !m[4];
      if (close && del.trim()) { deleted.push(del.trim()); del = ''; }
    } else if (tag === 'w:tab' && !close) out += '\t';
    else if ((tag === 'w:br' || tag === 'w:cr') && !close) out += '\n';
    else if (tag === 'w:p' && close) out += '\n';
    else if (tag === 'w:tc' && close) out += '\t';
  }
  return { text: out.replace(/\t\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), deleted };
}

async function extractDocx(buf, result) {
  const zip = readZip(buf);
  const body = zip.text('word/document.xml');
  if (body === null) throw new Error('not a Word document');
  const deleted = [];
  const add = (label, xml) => {
    if (!xml) return;
    const r = wordXmlToText(xml);
    if (r.text) result.parts.push({ label, text: r.text });
    deleted.push(...r.deleted);
  };
  add('Body', body);
  const byKind = (re) => zip.names.filter((n) => re.test(n)).sort();
  byKind(/^word\/header\d*\.xml$/).forEach((n) => add('Header', zip.text(n)));
  byKind(/^word\/footer\d*\.xml$/).forEach((n) => add('Footer', zip.text(n)));
  add('Footnotes', zip.text('word/footnotes.xml'));
  add('Endnotes', zip.text('word/endnotes.xml'));
  add('Comments', zip.text('word/comments.xml'));
  if (deleted.length) result.parts.push({ label: 'Deleted text (tracked changes)', text: deleted.join('\n') });

  const images = byKind(/^word\/media\/.+\.(png|jpe?g|bmp|tiff?)$/i);
  let n = 0;
  for (const name of images) {
    n++;
    const r = await ocrImage(zip.read(name));
    result.ocrImages++;
    if (r.script === 'non-latin') flagManual(result, `Picture ${n} contains non-Latin script (Chinese, Tamil or similar).`);
    const words = r.text.trim().split(/\s+/).filter((w) => /\p{L}{2,}|\d{3,}/u.test(w));
    if (words.length < 3) continue; // a logo or a signature: nothing to read
    if (r.confidence < MIN_OCR_CONFIDENCE) flagManual(result, `Picture ${n} could not be read reliably (OCR confidence ${Math.round(r.confidence)}%).`);
    result.parts.push({ label: `Text in picture ${n}`, text: r.text.trim(), ocr: true });
  }
  const skipped = zip.names.filter((n2) => /^word\/media\//.test(n2)).length - images.length;
  if (skipped) result.notes.push(`${skipped} embedded picture(s) in a format that cannot be read were left out of the cloaked copy.`);
  if (zip.names.some((n2) => /^word\/embeddings\//.test(n2))) result.notes.push('Embedded files (e.g. a spreadsheet inside the document) were left out of the cloaked copy.');
}

// ------------------------------------------------------------------ .xlsx

function extractXlsx(buf, result) {
  const zip = readZip(buf);
  const wb = zip.text('xl/workbook.xml');
  if (wb === null) throw new Error('not an Excel workbook');
  const shared = [];
  const sst = zip.text('xl/sharedStrings.xml') || '';
  for (const si of sst.match(/<si>[\s\S]*?<\/si>/g) || []) {
    shared.push([...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join(''));
  }
  const names = [...wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => xmlDecode(m[1]));
  const sheets = zip.names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  sheets.forEach((file, i) => {
    const rows = [];
    for (const row of zip.text(file).match(/<row\b[\s\S]*?<\/row>/g) || []) {
      const cells = [];
      for (const c of row.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const type = (/\bt="(\w+)"/.exec(c[1]) || [])[1];
        const inner = c[2] || '';
        const v = (/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1];
        if (type === 's') cells.push(shared[Number(v)] ?? '');
        else if (type === 'inlineStr') cells.push([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => xmlDecode(m[1])).join(''));
        else cells.push(v === undefined ? '' : xmlDecode(v));
      }
      if (cells.some((x) => x !== '')) rows.push(cells.join('\t'));
    }
    if (rows.length) result.parts.push({ label: `Sheet: ${names[i] || i + 1}`, text: rows.join('\n') });
  });
  const comments = zip.names.filter((n) => /^xl\/(comments\d*|threadedComments\/[^/]+)\.xml$/.test(n));
  const notes = comments.flatMap((n) => [...zip.text(n).matchAll(/<(?:t|text)[^>]*>([\s\S]*?)<\/(?:t|text)>/g)].map((m) => xmlDecode(m[1])));
  if (notes.length) result.parts.push({ label: 'Comments', text: notes.join('\n') });
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
  result.pages = doc.numPages;
  let picturesOnTextPages = 0;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = content.items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join('').trim();
    const ops = await page.getOperatorList();
    const hasPicture = ops.fnArray.some((f) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject);

    // Only pages without a usable text layer go to OCR.
    if (text.replace(/\s/g, '').length >= MIN_TEXT_LAYER_CHARS) {
      result.parts.push({ label: `Page ${n}`, text });
      if (hasPicture) picturesOnTextPages++;
    } else if (hasPicture) {
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
      const r = await ocrImage(canvas.toBuffer('image/png'));
      result.ocrPages.push(n);
      if (r.script === 'non-latin') flagManual(result, `Page ${n} is in a non-Latin script (Chinese, Tamil or similar).`);
      else if (r.text.trim() && r.confidence < MIN_OCR_CONFIDENCE) flagManual(result, `Page ${n} could not be read reliably (OCR confidence ${Math.round(r.confidence)}%).`);
      if (r.text.trim()) result.parts.push({ label: `Page ${n} (scanned)`, text: r.text.trim(), ocr: true });
    }
    page.cleanup();
  }
  if (picturesOnTextPages) result.notes.push(`${picturesOnTextPages} page(s) have pictures as well as text. Words inside those pictures (stamps, letterheads, handwriting) were not read and are not in the cloaked copy.`);
  await task.destroy();
}

// ----------------------------------------------------------------- emails

function decodeBody(body, encoding, charset) {
  let bytes;
  const enc = (encoding || '').toLowerCase();
  if (enc === 'base64') bytes = Buffer.from(body.replace(/\s+/g, ''), 'base64');
  else if (enc === 'quoted-printable') {
    bytes = Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  } else bytes = Buffer.from(body, 'latin1');
  try { return new TextDecoder(charset || 'utf-8').decode(bytes); } catch { return bytes.toString('utf8'); }
}

function decodeHeader(value) {
  return value.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, charset, kind, data) =>
    decodeBody(kind.toUpperCase() === 'B' ? data : data.replace(/_/g, ' '), kind.toUpperCase() === 'B' ? 'base64' : 'quoted-printable', charset));
}

function htmlToText(html) {
  return xmlDecode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseMime(raw) {
  const split = raw.search(/\r?\n\r?\n/);
  const head = split < 0 ? raw : raw.slice(0, split);
  const body = split < 0 ? '' : raw.slice(split).replace(/^\r?\n\r?\n/, '');
  const headers = {};
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  const type = headers['content-type'] || 'text/plain';
  const boundary = (/boundary="?([^";]+)"?/i.exec(type) || [])[1];
  const out = { headers, text: '', html: '', attachments: 0 };
  if (boundary) {
    for (const piece of body.split(`--${boundary}`).slice(1)) {
      if (piece.startsWith('--')) break;
      const sub = parseMime(piece.replace(/^\r?\n/, ''));
      out.text ||= sub.text;
      out.html ||= sub.html;
      out.attachments += sub.attachments;
    }
    return out;
  }
  if (/attachment/i.test(headers['content-disposition'] || '') || !/^text\//i.test(type)) {
    out.attachments = 1;
    return out;
  }
  const decoded = decodeBody(body, headers['content-transfer-encoding'], (/charset="?([^";]+)"?/i.exec(type) || [])[1]);
  if (/^text\/html/i.test(type)) out.html = decoded; else out.text = decoded;
  return out;
}

function emailParts(result, { from, to, cc, subject, date, body, attachments }) {
  const head = [['From', from], ['To', to], ['Cc', cc], ['Date', date], ['Subject', subject]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
  result.parts.push({ label: 'Email', text: `${head}\n\n${(body || '').replace(/\r\n/g, '\n').trim()}` });
  if (attachments) result.notes.push(`${attachments} attachment(s) inside this email were not opened. Save them into the folder to cloak them.`);
}

function extractEml(buf, result) {
  const m = parseMime(buf.toString('latin1'));
  const h = (k) => decodeHeader(m.headers[k] || '');
  emailParts(result, { from: h('from'), to: h('to'), cc: h('cc'), subject: h('subject'), date: h('date'), body: m.text || htmlToText(m.html), attachments: m.attachments });
}

function extractMsg(buf, result) {
  const MsgReader = require('@kenjiuno/msgreader').default;
  const d = new MsgReader(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)).getFileData();
  if (d.error) throw new Error(d.error);
  const who = (r) => [r.name, r.smtpAddress || r.email].filter(Boolean).join(' ');
  const rec = (kind) => (d.recipients || []).filter((r) => (r.recipType || 'to') === kind).map(who).join('; ');
  emailParts(result, {
    from: [d.senderName, d.senderSmtpAddress || d.senderEmail].filter(Boolean).join(' '),
    to: rec('to'), cc: rec('cc'), subject: d.subject, date: d.messageDeliveryTime || d.clientSubmitTime,
    body: d.body || (d.bodyHtml ? htmlToText(d.bodyHtml) : ''), attachments: (d.attachments || []).length,
  });
}

// -------------------------------------------------------------- one file

function flagManual(result, reason) {
  result.status = 'manual';
  result.reasons.push(reason);
}

/**
 * Read one file. Never throws: a file that cannot be read comes back with
 * status "unreadable" and the reason.
 */
export async function extractFile(file) {
  const ext = path.extname(file).toLowerCase();
  const result = { status: 'ok', type: ext.slice(1) || 'unknown', parts: [], reasons: [], notes: [], pages: 0, ocrPages: [], ocrImages: 0 };
  const fail = (reason) => Object.assign(result, { status: 'unreadable', parts: [], reasons: [reason] });
  if (UNREADABLE[ext]) return fail(UNREADABLE[ext]);
  try {
    const buf = await readFile(file);
    if (TEXT_TYPES.has(ext)) result.parts.push({ label: 'Text', text: buf.toString('utf8').replace(/^﻿/, '') });
    else if (ext === '.docx') await extractDocx(buf, result);
    else if (ext === '.xlsx') extractXlsx(buf, result);
    else if (ext === '.pdf') await extractPdf(buf, result);
    else if (ext === '.eml') extractEml(buf, result);
    else if (ext === '.msg') extractMsg(buf, result);
    else if (IMAGE_TYPES.has(ext)) {
      const r = await ocrImage(buf);
      result.ocrPages.push(1);
      result.pages = 1;
      if (r.script === 'non-latin') flagManual(result, 'The picture is in a non-Latin script (Chinese, Tamil or similar).');
      else if (r.text.trim() && r.confidence < MIN_OCR_CONFIDENCE) flagManual(result, `The picture could not be read reliably (OCR confidence ${Math.round(r.confidence)}%).`);
      if (r.text.trim()) result.parts.push({ label: 'Picture (scanned)', text: r.text.trim(), ocr: true });
    } else return fail(`File type ${ext || '(none)'} is not supported.`);
  } catch (err) {
    return fail(/password/i.test(err.message) ? 'The file is password-protected. Remove the password and try again.' : `The file could not be opened (${err.message}).`);
  }

  // A text layer in Chinese, Tamil, Jawi etc.: the name rules do not cover
  // those scripts, so a person must check the file.
  const other = result.parts.reduce((n, p) => n + (p.ocr ? 0 : nonLatinCount(p.text)), 0);
  if (other >= 5) flagManual(result, `Contains ${other} characters in a non-Latin script (Chinese, Tamil, Jawi or similar). Names in those scripts are not detected.`);
  result.parts = result.parts.filter((p) => p.text.trim());
  if (!result.parts.length && result.status === 'ok') fail('No text was found in the file.');
  return result;
}
