// Shared by the made-up matters used to measure the name rules
// (test/heldout/ and test/namesdev/) and by test/names-measure.js.
//
// In a generator's texts every real name is marked «kind|Name» and every
// ordinary word that must stay readable is marked «trap|word». The marks are
// taken out before the files are written. A check makes sure that no listed
// string appears anywhere without a mark, so the list of marks is the full
// list of real values that must not appear.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { writeZip } from '../zip.js';
import { xlsx, pdf } from './matter.js';

/** What each kind of mark means, as shown in the measurement table. */
export const CATEGORIES = {
  ml: 'Malay full name',
  cn: 'Chinese full name',
  in: 'Indian full name',
  en: 'English or other full name',
  mono: 'Indonesian / Javanese single name',
  nick: 'Nickname',
  short: 'First name or short form used alone',
  title: 'Title + single name',
  chat: 'Chat speaker label',
  sign: 'Email greeting or sign-off name',
  lower: 'Lowercase name in informal text',
  init: 'Initials',
  em: 'Name inside an email address',
  co: 'Company',
};

const MARK = /«([a-z]+)\|([^«»|]+)»/g;

/** Take the marks out of a string: the clean text and each mark's place in it. */
export function parseMarks(marked) {
  let clean = '';
  let last = 0;
  const occ = [];
  for (const m of marked.matchAll(MARK)) {
    clean += marked.slice(last, m.index);
    if (m[1] !== 'trap' && !CATEGORIES[m[1]]) throw new Error(`Unknown mark kind "${m[1]}" in: ${m[0]}`);
    occ.push({ kind: m[1] === 'trap' ? 'trap' : 'real', cat: m[1], value: m[2], at: clean.length });
    clean += m[2];
    last = m.index + m[0].length;
  }
  clean += marked.slice(last);
  if (/[«»]/.test(clean)) throw new Error(`A mark is broken near: ${clean.slice(Math.max(0, clean.search(/[«»]/) - 40), clean.search(/[«»]/) + 40)}`);
  return { clean, occ };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Finds every listed string in a text: any letter case, whole words, longest first. */
export function matcher(strings) {
  const list = [...new Set(strings.map((s) => s.toLowerCase()))].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return (text) => [...text.matchAll(re)].map((m) => ({ text: m[0], at: m.index }));
}

// ------------------------------------------------------------ file builders

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const para = (t) => `<w:p><w:r><w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r></w:p>`;

/** A .docx with a body and document properties (title, author). Same shape as docx() in matter.js, with this matter's own properties. */
function wordFile({ body, title, author }) {
  return writeZip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.split('\n').map(para).join('')}</w:body></w:document>`,
    'docProps/core.xml': `<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:title>${xmlEsc(title)}</dc:title><dc:creator>${xmlEsc(author)}</dc:creator></cp:coreProperties>`,
  });
}

/**
 * The pieces of a file, in the order the reader gives them back, so that the
 * marks can be matched up with what was read.
 *   txt:  { text }
 *   eml:  { text }                       the whole message, headers first
 *   docx: { body, title, author }        properties come after the body
 *   xlsx: { sheet, rows }                cells row by row
 *   pdf:  { lines }                      one page with a text layer
 */
function pieces(f) {
  if (f.kind === 'txt' || f.kind === 'eml') return [f.text];
  if (f.kind === 'docx') return [f.body, f.title, f.author];
  if (f.kind === 'xlsx') return [f.sheet, ...f.rows.flat().filter((c) => typeof c === 'string')];
  if (f.kind === 'pdf') return f.lines;
  throw new Error(`Unknown file kind ${f.kind}`);
}

function build(f, clean) {
  let i = 0;
  const next = () => clean[i++];
  if (f.kind === 'txt') return Buffer.from(next(), 'utf8');
  if (f.kind === 'eml') return Buffer.from(next().replace(/\r?\n/g, '\r\n'), 'utf8');
  if (f.kind === 'docx') return wordFile({ body: next(), title: next(), author: next() });
  if (f.kind === 'xlsx') { const sheet = next(); return xlsx(sheet, f.rows.map((row) => row.map((c) => (typeof c === 'string' ? next() : c)))); }
  if (f.kind === 'pdf') return pdf([{ text: f.lines.map(() => next()) }]);
  throw new Error(`Unknown file kind ${f.kind}`);
}

/**
 * Writes the files of a marked matter into `dir`. Returns, for each file, its
 * clean relative path and every marked occurrence in reading order (file name
 * first), plus the full list of listed strings.
 */
export async function writeMarkedMatter(dir, files) {
  const parsed = files.map((f) => {
    const name = parseMarks(f.rel);
    const parts = pieces(f).map(parseMarks);
    return { f, name, parts };
  });
  const listed = [...new Set(parsed.flatMap((p) => [p.name, ...p.parts].flatMap((x) => x.occ.map((o) => o.value))))];
  const find = matcher(listed);
  // Every listed string, in any letter case, must carry a mark wherever it appears.
  for (const p of parsed) {
    for (const piece of [p.name, ...p.parts]) {
      const hits = find(piece.clean);
      const want = piece.occ.map((o) => `${o.at}:${o.value.toLowerCase()}`).join(' | ');
      const got = hits.map((h) => `${h.at}:${h.text.toLowerCase()}`).join(' | ');
      if (want !== got) throw new Error(`Marks and text disagree in ${p.name.clean}:\n  marked: ${want}\n  found:  ${got}\n  text: ${piece.clean.slice(0, 200)}`);
    }
  }
  const out = [];
  for (const p of parsed) {
    const full = path.join(dir, p.name.clean);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, build(p.f, p.parts.map((x) => x.clean)));
    out.push({ rel: p.name.clean, occ: [p.name, ...p.parts].flatMap((x) => x.occ.map(({ kind, cat, value }) => ({ kind, cat, value }))) });
  }
  return { files: out, listed };
}

/** The marks of a matter's files without writing anything: [{ rel, occ }]. */
export function listMarks(files) {
  return files.map((f) => {
    const name = parseMarks(f.rel);
    return { rel: name.clean, occ: [name, ...pieces(f).map(parseMarks)].flatMap((x) => x.occ.map(({ kind, cat, value }) => ({ kind, cat, value }))) };
  });
}

/** Every real value once, with its categories and files: the list of what must not appear. */
export function realValues(files) {
  const by = new Map();
  for (const f of files) for (const o of f.occ) {
    if (o.kind !== 'real') continue;
    const k = o.value;
    if (!by.has(k)) by.set(k, { value: k, cats: new Set(), files: new Set(), count: 0 });
    const e = by.get(k);
    e.cats.add(o.cat); e.files.add(f.rel); e.count++;
  }
  return [...by.values()].map((e) => ({ ...e, cats: [...e.cats], files: [...e.files] }));
}

/** Every trap once, with how often it appears. */
export function trapWords(files) {
  const by = new Map();
  for (const f of files) for (const o of f.occ) if (o.kind === 'trap') by.set(o.value, (by.get(o.value) || 0) + 1);
  return [...by].map(([word, count]) => ({ word, count }));
}
