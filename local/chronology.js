// The chronology table. No AI: plain rules.
//
// Every sentence that holds a date, an amount of money or a named party becomes
// a row: date, text, people, source file and part (page, sheet, body...).
// Rows are sorted by date, rows about the same event are grouped, rows that
// look as if they disagree are flagged, and a person can edit, merge, delete and
// add rows and then confirm the table with their name and the time.
//
// The confirmed table is exported as its own document, which is then cloaked
// like any other file.
//
// What it does not do is in README.md ("The chronology table").

import path from 'node:path';
import { findAmounts, findDates, findRelative } from './facts.js';
import { formatDate } from './dates.js';

const ABBREVIATION = /(?:^|[\s(\[])(?:Mr|Mrs|Ms|Dr|Dato|Datuk|Datin|Sdn|Bhd|No|Nos|Bt|Bte|Bin|Hj|Hjh|En|Pn|Cik|St|Jln|Co|Ltd|Inc|Hon|Prof|vs|v|Sri|Ex|Exh|Vol|cl|Cl|Sec|para|paras|approx|ca|etc|Rd|Ave|Mohd|Muhd|Md|Ir|Bhg|Yg|Tn|Y)\.$/i;
const INITIAL = /(?:^|[\s(\[])\p{L}\.$/u;
const NUMBERING = /^\(?\d+[.)]$/;

/** Split text into sentences. A line is always a sentence boundary; so is a full stop followed by a capital, unless it follows an abbreviation or an initial. */
export function sentences(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let start = 0;
    const re = /[.!?](\s+)(?=["“(\[]?[\p{Lu}\d])|[。！？]/gu;
    for (const m of line.matchAll(re)) {
      const end = m.index + 1;
      const before = line.slice(start, end);
      if (ABBREVIATION.test(before) || INITIAL.test(before) || NUMBERING.test(before.trim())) continue;
      out.push(line.slice(start, end).trim());
      start = m.index + m[0].length;
    }
    const rest = line.slice(start).trim();
    if (rest) out.push(rest);
  }
  return out;
}

const STOP = new Set('about after again also because been before being between both could does done each from have here into more most only other over same should since some such than that their them then there these they this those through under until very were what when where which while will with would your yang dan untuk dengan pada kepada telah akan tidak atau dalam oleh adalah itu ini mereka kami kita saya'.split(' '));
// A few event words that mean the same in English, Malay and Chinese, so a Malay sentence and an English sentence about the same event can be recognised as the same event.
const CONCEPTS = {
  meeting: ['meeting', 'bertemu', 'pertemuan', 'mesyuarat', 'met', 'attended', 'hadir', 'present'],
  agreement: ['agreement', 'perjanjian', 'contract', 'kontrak', 'signed', 'ditandatangani'],
  deposit: ['deposit', 'booking', 'tempahan'],
  payment: ['paid', 'payment', 'bayar', 'membayar', 'dibayar', 'bayaran', 'transferred', 'transfer', 'pindahan', 'dipindahkan', 'remitted'],
  letter: ['letter', 'surat', 'letters'],
  affidavit: ['affidavit', 'afidavit', 'diikrarkan', 'ikrar', 'affirm', 'affirmed'],
  claim: ['claim', 'tuntutan', 'plaintiff', 'plaintif'],
  defence: ['defence', 'pembelaan', 'defendant', 'defendan'],
  notice: ['notice', 'notis', 'pemberitahuan'],
  email: ['email', 'emel', 'e-mel'],
  call: ['called', 'telephoned', 'telefon', 'menelefon', 'phone', 'call'],
};
const CONCEPT_OF = new Map(Object.entries(CONCEPTS).flatMap(([c, words]) => words.map((w) => [w, `~${c}`])));
const CJK_CONCEPTS = [['订金', '~deposit'], ['定金', '~deposit'], ['合同', '~agreement'], ['协议', '~agreement'], ['会议', '~meeting'], ['会面', '~meeting'], ['转账', '~payment'], ['付款', '~payment'], ['信函', '~letter'], ['通知', '~notice']];
const contentWords = (t) => {
  const low = t.toLowerCase();
  const words = new Set();
  for (const w of low.match(/\p{L}{3,}/gu) || []) {
    if (CONCEPT_OF.has(w)) words.add(CONCEPT_OF.get(w));
    else if (w.length >= 4 && !STOP.has(w)) words.add(w);
  }
  for (const [cjk, concept] of CJK_CONCEPTS) if (t.includes(cjk)) words.add(concept);
  return words;
};
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / (a.size + b.size - n);
};

const stripFacts = (text) => {
  let out = text;
  for (const f of [...findDates(text), ...findAmounts(text)].sort((a, b) => b.start - a.start)) out = out.slice(0, f.start) + ' ' + out.slice(f.end);
  return out;
};

const titleOf = (rel) => path.basename(rel).replace(/\.[A-Za-z0-9]{1,5}$/, '');
const emailAddress = /\s*<[^>]*>/g;

/** The rows of one part of one file. */
function partRows(file, part, matter) {
  const rows = [];
  const lines = String(part.text).split(/\r?\n/);
  const add = (kind, text, extra = {}) => rows.push({ kind, text: text.replace(/\s+/g, ' ').trim(), file: file.rel, part: part.label, ...extra });

  // An email: the Date: header is when it was sent.
  const header = {};
  let bodyFrom = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(From|To|Cc|Bcc|Date|Sent|Subject):\s*(.*)$/i.exec(lines[i]);
    if (m) { header[m[1].toLowerCase()] = m[2]; bodyFrom = i + 1; } else if (lines[i].trim() === '' && bodyFrom) { bodyFrom = i + 1; break; } else if (bodyFrom) break;
  }
  let body = lines;
  if (header.date && (header.from || header.subject)) {
    add('email', `Email "${(header.subject || '').trim()}" from ${(header.from || '').replace(emailAddress, '')} to ${(header.to || '').replace(emailAddress, '')}`, { dateText: header.date });
    body = lines.slice(bodyFrom);
  }

  // A spreadsheet: each row read with its column names.
  const tabbed = body.filter((l) => (l.match(/\t/g) || []).length >= 2);
  if (tabbed.length >= 2 && /^Sheet/i.test(part.label || '')) {
    const columns = tabbed[0].split('\t').map((c) => c.trim());
    for (const row of tabbed.slice(1)) {
      const cells = row.split('\t').map((c) => c.trim());
      if (cells.every((c) => !c)) continue;
      // A bare number in a column called Amount, Paid, Total... is an amount of money.
      const sums = cells.flatMap((c, i) => (/(?:amount|\brm\b|myr|paid|balance|total|sum|jumlah|harga|bayaran|deposit)/i.test(columns[i] || '') && /^\d[\d,]*(?:\.\d+)?$/.test(c) && Number(c.replace(/,/g, '')) > 0 ? [`RM${c}`] : []));
      add('row', cells.map((c, i) => (c && columns[i] ? `${columns[i]}: ${c}` : c)).filter(Boolean).join('; '), { sums });
    }
    body = body.filter((l) => !tabbed.includes(l));
  }

  for (const s of sentences(body.join('\n'))) add('sentence', s);

  const out = [];
  for (const r of rows) {
    const searchIn = r.dateText ? r.dateText : r.text;
    const dates = findDates(searchIn);
    const amounts = findAmounts(r.text + (r.sums?.length ? ` ; ${r.sums.join(' ; ')}` : ''));
    const people = matter ? peopleIn(matter, r.text) : [];
    if (!dates.length && !amounts.length && !people.length) continue;
    // A line that is only a date is the date of the document.
    if (r.kind === 'sentence' && dates.length === 1 && stripFacts(r.text).replace(/[\p{P}\s]|\b(?:date|dated|bertarikh|tarikh)\b/giu, '').length < 3) {
      out.push({ ...r, kind: 'dateline', text: `Document "${titleOf(file.rel)}" is dated ${dates[0].text}`, dates, amounts: [], people: [], relative: [], title: contentWords(titleOf(file.rel).replace(/^\d+\s*/, '')) });
      continue;
    }
    out.push({ ...r, dates, amounts, people, relative: findRelative(r.text) });
  }
  return out;
}

/** Names of the people and companies a text mentions, using the matter's key. */
function peopleIn(matter, text) {
  const names = [];
  for (const m of matter.apply(text).matchAll(/\{\{((?:PERSON|COMPANY)_\d+)(?:\.[A-Z0-9_]+)?\}\}/g)) {
    const name = matter.cloak.byToken.get(m[1]);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

const dateOf = (d) => (d ? { key: d.key, precision: d.precision, text: d.text, sort: d.sort, ambiguous: !!d.ambiguous } : null);
const sameText = (a, b) => a.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export class Chronology {
  constructor({ rows = [], confirmed = null, history = [], built = null, version = 0 } = {}) {
    this.rows = rows;
    this.confirmed = confirmed;   // { by, when }
    this.history = history;       // [{ when, by, action, row }] - never the text
    this.built = built;
    this.version = version;
    this.counter = rows.reduce((n, r) => Math.max(n, Number(String(r.id).replace(/\D/g, '')) || 0), 0);
  }

  /** Build the first version from every readable file of a run. */
  static build({ files, matter }) {
    const raw = [];
    for (const f of files) {
      if (!f.parts?.length) continue;
      for (const p of f.parts) raw.push(...partRows(f, p, matter));
    }
    // The same sentence twice in one file (a header and a footer) is one row.
    const seen = new Set();
    const unique = raw.filter((r) => {
      const k = `${r.file}|${r.part}|${r.text.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const c = new Chronology({ built: new Date().toISOString() });
    const entries = unique.map((r) => ({
      id: `R${++c.counter}`,
      kind: r.kind,
      text: r.text,
      date: dateOf(r.dates[0]),
      otherDates: r.dates.slice(1).map((d) => d.text),
      amounts: r.amounts.map((a) => ({ text: a.text, key: a.key })),
      people: r.people,
      relative: r.relative.map((x) => x.text),
      sources: [{ file: r.file, part: r.part }],
      status: 'auto',
      removed: false,
      group: null,
      conflict: null,
      words: contentWords(stripFacts(r.text)),
      title: r.title || null,
    }));
    c.group(entries);
    c.flagConflicts(entries);
    c.rows = entries.map(({ words, ...r }) => r);
    c.sort();
    return c;
  }

  /** Rows about one event: same day, and either the same amount or mostly the same words. */
  group(entries) {
    const parent = entries.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i];
      if (!a.date || a.date.precision !== 'day') continue;
      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j];
        if (!b.date || b.date.key !== a.date.key) continue;
        const sharedAmount = a.amounts.some((x) => b.amounts.some((y) => x.key === y.key));
        // A document's own date line and a later sentence that names that kind of document on the same day.
        const names = (d, o) => d.kind === 'dateline' && d.title && [...d.title].some((w) => o.words.has(w));
        const concepts = [...a.words].filter((w) => w.startsWith('~') && b.words.has(w)).length;
        if (sharedAmount || jaccard(a.words, b.words) >= 0.3 || sameText(a.text, b.text) || names(a, b) || names(b, a) || concepts >= 1) parent[find(j)] = find(i);
      }
    }
    const groups = new Map();
    entries.forEach((e, i) => { const g = find(i); groups.set(g, [...(groups.get(g) || []), e]); });
    let n = 0;
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      n++;
      for (const e of members) e.group = `E${n}`;
    }
  }

  /** Two rows that read as the same event but give a different date or amount. */
  flagConflicts(entries) {
    let n = 0;
    const flag = (a, b, why) => {
      const id = a.conflict?.id || b.conflict?.id || `C${++n}`;
      for (const [x, y] of [[a, b], [b, a]]) x.conflict = { id, with: [...new Set([...(x.conflict?.with || []), y.id])], why: [...new Set([...(x.conflict?.why || []), why])] };
    };
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.group && a.group === b.group) continue;
      // Documents' own dates, emails and spreadsheet rows repeat by nature; they are not compared.
      if (['dateline', 'email', 'row'].includes(a.kind) || ['dateline', 'email', 'row'].includes(b.kind)) continue;
      const similar = jaccard(a.words, b.words);
      if (similar < 0.5) continue;
      if (a.date?.precision === 'day' && b.date?.precision === 'day' && a.date.key !== b.date.key) flag(a, b, 'the same event is given different dates');
      else if (a.date?.key && a.date.key === b.date?.key && a.amounts.length === 1 && b.amounts.length === 1 && a.amounts[0].key !== b.amounts[0].key) flag(a, b, 'the same event is given different amounts');
    }
  }

  sort() {
    this.rows.sort((a, b) => {
      const ka = a.date ? a.date.sort : Infinity;
      const kb = b.date ? b.date.sort : Infinity;
      return (ka - kb) || (a.group || '').localeCompare(b.group || '') || (Number(a.id.slice(1)) - Number(b.id.slice(1)));
    });
  }

  // ---------------------------------------------------------------- editing

  changed(by, action, row) {
    this.confirmed = null;
    this.version++;
    this.history.push({ when: new Date().toISOString(), by, action, row });
  }

  get(id) {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('That row is not in the chronology.');
    return row;
  }

  /** Change a row. patch: { dateText, text, people, amounts }. */
  edit(id, patch, by = '') {
    const row = this.get(id);
    if (patch.dateText !== undefined) {
      if (!patch.dateText.trim()) row.date = null;
      else {
        const d = findDates(patch.dateText)[0];
        if (!d) throw new Error('That is not a date Cloak can read. Write it like 3 July 2025 or 03/07/2025.');
        row.date = dateOf(d);
      }
    }
    if (patch.text !== undefined) row.text = patch.text;
    if (patch.people !== undefined) row.people = patch.people;
    if (patch.amounts !== undefined) row.amounts = findAmounts(patch.amounts.join(' ; ')).map((a) => ({ text: a.text, key: a.key }));
    row.status = 'edited';
    this.sort();
    this.changed(by, 'edit', id);
  }

  /** Join rows into the first one: the sources and people are kept, the texts joined. */
  merge(ids, by = '') {
    if (ids.length < 2) throw new Error('Pick two or more rows to merge.');
    const rows = ids.map((id) => this.get(id));
    const [into, ...rest] = rows;
    for (const r of rest) {
      if (!sameText(into.text, r.text) && !into.text.includes(r.text)) into.text += ` / ${r.text}`;
      for (const p of r.people) if (!into.people.includes(p)) into.people.push(p);
      for (const a of r.amounts) if (!into.amounts.some((x) => x.key === a.key)) into.amounts.push(a);
      for (const s of r.sources) if (!into.sources.some((x) => x.file === s.file && x.part === s.part)) into.sources.push(s);
      if (!into.date && r.date) into.date = r.date;
      this.rows = this.rows.filter((x) => x.id !== r.id);
    }
    into.status = 'edited';
    into.conflict = null;
    this.sort();
    this.changed(by, 'merge', into.id);
    return into.id;
  }

  remove(id, by = '') {
    this.get(id).removed = true;
    this.changed(by, 'remove', id);
  }
  restore(id, by = '') {
    this.get(id).removed = false;
    this.changed(by, 'restore', id);
  }

  /** Add a row the rules did not find. source: { file, part } or a note such as "client's instructions". */
  add({ dateText = '', text, people = [], source = 'added by hand' }, by = '') {
    if (!String(text || '').trim()) throw new Error('Write what happened.');
    const d = dateText.trim() ? findDates(dateText)[0] : null;
    if (dateText.trim() && !d) throw new Error('That is not a date Cloak can read. Write it like 3 July 2025 or 03/07/2025.');
    const row = { id: `R${++this.counter}`, kind: 'added', text: text.trim(), date: dateOf(d), otherDates: [], amounts: findAmounts(text).map((a) => ({ text: a.text, key: a.key })), people, relative: [], sources: [typeof source === 'string' ? { file: source, part: '' } : source], status: 'added', removed: false, group: null, conflict: null };
    this.rows.push(row);
    this.sort();
    this.changed(by, 'add', row.id);
    return row.id;
  }

  /** The person has checked the table. Any later change takes the confirmation away. */
  confirm(by, when = new Date().toISOString()) {
    if (!by) throw new Error('Say who is confirming the chronology.');
    this.confirmed = { by, when };
    this.history.push({ when, by, action: 'confirm', row: null });
  }

  active() { return this.rows.filter((r) => !r.removed); }
  dated() { return this.active().filter((r) => r.date); }
  undated() { return this.active().filter((r) => !r.date); }

  // ---------------------------------------------------------------- output

  /** The table as people see it on screen. */
  table({ undated = false } = {}) {
    const list = undated ? this.active() : this.dated();
    return list.map((r) => ({ id: r.id, date: r.date ? r.date.text : '', precision: r.date?.precision || null, event: r.text, people: r.people, source: r.sources.map((s) => (s.part ? `${titleOf(s.file)}, ${s.part}` : titleOf(s.file))), group: r.group, conflict: r.conflict, relative: r.relative, status: r.status }));
  }

  /** The confirmed chronology as one document. It is real text: it is cloaked like any other file. */
  document({ undated = true } = {}) {
    const lines = ['CHRONOLOGY', ''];
    lines.push(this.confirmed ? `Confirmed by ${this.confirmed.by} on ${formatDate(this.confirmed.when)}.` : 'NOT CONFIRMED. A person has not yet checked this chronology.');
    lines.push('Dates are as written in the documents. Rows marked "possible conflict" read as the same event but give a different date or amount.', '');
    const body = (rows) => rows.forEach((r, i) => {
      const bits = [`${i + 1}.`, r.date ? r.date.text : '(no date)', '|', r.text];
      if (r.people.length) bits.push('|', `People: ${r.people.join('; ')}`);
      bits.push('|', `Source: ${r.sources.map((s) => (s.part ? `${titleOf(s.file)}, ${s.part}` : titleOf(s.file))).join('; ')}`);
      if (r.conflict) bits.push('|', `POSSIBLE CONFLICT (${r.conflict.why.join('; ')})`);
      if (r.relative.length) bits.push('|', `Relative date: ${r.relative.join('; ')}`);
      lines.push(bits.join(' '));
    });
    body(this.dated());
    if (undated && this.undated().length) { lines.push('', 'NOT DATED', ''); body(this.undated()); }
    return `${lines.join('\n')}\n`;
  }

  /** A stand-in for an extracted file, so the same cloaking and checks apply. */
  asFile() {
    const text = this.document();
    return { rel: 'Chronology (confirmed).txt', type: 'txt', status: 'ok', parts: [{ label: 'Text', text }], proof: { unit: 'parts', found: 1, read: 1, characters: text.length, ocr: [], unread: [], parts: [] }, disk: { rel: 'Chronology (confirmed).txt' }, reasons: [], index: 0 };
  }

  toJSON() {
    return { rows: this.rows, confirmed: this.confirmed, history: this.history, built: this.built, version: this.version };
  }
  static fromJSON(data) {
    return new Chronology(data);
  }
}
