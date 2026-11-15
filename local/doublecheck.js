// The double checker (feature 4): a second, independent check of everything
// that is about to be exported, run after the review is signed off.
//
// It reads the text that would be written (each cloaked copy, the context
// sheet, the chronology, the exported file names, cloak-report.json and the
// marker file) and runs five checks on it. Every check calls the detectors
// afresh on that text; nothing the first pass found is reused.
//
//   1. Key sweep       every value the key holds (names and all their forms,
//                      ID numbers, addresses, emails, phones, folder names)
//                      outside a tag, and every blurred fact in any format
//   2. Pattern sweep   MyKad/NRIC, passports, phones, emails, bank and card
//                      numbers, case numbers, land titles, vehicle plates,
//                      postcode and town, company numbers
//   3. Leftover names  words after a title (Encik, Puan, Mr, Dato'...), names
//                      with bin, binti, a/l or a/p, words in the name lists,
//                      and capitalised words that are not ordinary words
//   4. Hidden places   every part of every file is read, and each finding
//                      says which part it is in: the file name, a header, a
//                      footer, comments, tracked changes, document properties,
//                      a sheet name, defined names, email headers, attachments
//   5. Tags            every tag is well formed and in the key, and one real
//                      value never sits under two different tags
//
// No AI is used. Findings carry the real text so that a person can judge them
// on this computer. They are never written into an exported file or the log.

import { TOKEN_RE, PATTERNS, FORWARD_DETECTORS, findAddresses, isStop, norm } from './engine.js';
import { Facts, findDates, findAmounts, findSheetAmounts, findPlaces, findCourts, findProjects, findJobs } from './facts.js';
import { NAME_WORDS, CHINESE_SURNAMES, MALAY_NAMES, INDIAN_NAMES, ENGLISH_NAMES, AMBIGUOUS, GENERIC_PARTS, HONOURS } from './names.js';
import { AI_RULES } from './context.js';

// ---------------------------------------------------------------- basics

const TAG = /\{\{[A-Z][A-Z0-9_]*_\d+(?:\.[A-Z0-9_]+)?\}\}/g;
const WELL_FORMED = /^\{\{[A-Z][A-Z0-9_]*_\d+(?:\.[A-Z0-9_]+)?\}\}$/;
// Stands in for a tag or a masked phrase. It keeps every offset, so a finding's line is the line in the copy.
const HOLD = '\uFFFC';
const FACT_TYPES = new Set(['DATE', 'AMOUNT', 'PERCENT', 'REF', 'PLACE', 'PROJECT', 'JOB', 'COURT']);
const KIND_TAG = { date: 'DATE', amount: 'AMOUNT', percent: 'PERCENT', ref: 'REF', place: 'PLACE', project: 'PROJECT', job: 'JOB', court: 'COURT' };
const CHECKS = ['key', 'fact', 'pattern', 'name', 'tag'];
const baseOf = (t) => t.split('.')[0];
const typeOf = (t) => baseOf(t).replace(/_\d+$/, '');

/** Replace spans with stand-ins of the same length. Line breaks stay, so lines keep their numbers. */
function blank(text, spans, ch = HOLD) {
  if (!spans.length) return text;
  const sorted = spans.slice().sort((a, b) => a[0] - b[0]);
  let out = '';
  let at = 0;
  for (const [s, e] of sorted) {
    if (e <= at) continue;
    const from = Math.max(s, at);
    out += text.slice(at, from) + text.slice(from, e).replace(/[^\n]/g, ch);
    at = e;
  }
  return out + text.slice(at);
}

function lineStarts(text) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}
function lineAt(starts, offset) {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

/** Lines a check must skip (a time stamp in the report, the reviewer's name...) are blanked for that check. */
function forCheck(text, unit, check) {
  if (!unit.exempt?.size) return text;
  const starts = unit.starts || (unit.starts = lineStarts(unit.text));
  const spans = [];
  for (const [line, skip] of unit.exempt) {
    if (skip !== 'all' && !skip.has(check)) continue;
    const s = starts[line - 1];
    const e = line < starts.length ? starts[line] - 1 : text.length;
    if (s !== undefined) spans.push([s, e]);
  }
  return blank(text, spans, ' ');
}

// ---------------------------------------------------------------- finding words fast
//
// Thousands of key values against a long text: one pass over the text's words
// with a tree of the values, not one regular expression per value.

const WORD = /[\p{L}\p{N}_]/u;
const TOKENS = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;
const tokenKey = (t) => (WORD.test(t[0]) ? `w${t.toLowerCase()}` : /\s/.test(t[0]) ? ' ' : `p${t === '’' ? "'" : t}`);

function treeOf(items) {
  const root = new Map();
  for (const item of items) {
    let node = root;
    for (const m of item.value.matchAll(TOKENS)) {
      const k = tokenKey(m[0]);
      if (!node.has(k)) node.set(k, new Map());
      node = node.get(k);
    }
    if (node !== root) (node.ends ||= []).push(item);
  }
  return root;
}

/** Every place one of the values occurs as whole words, in any letter case. Overlaps are left in. */
function occurrences(text, root) {
  if (!root.size) return [];
  const toks = [];
  for (const m of text.matchAll(TOKENS)) toks.push({ s: m[0], i: m.index, k: tokenKey(m[0]) });
  const found = [];
  for (let a = 0; a < toks.length; a++) {
    const first = toks[a];
    if (first.k === ' ' || !root.has(first.k)) continue;
    if (first.i > 0 && WORD.test(text[first.i - 1])) continue;
    let node = root;
    for (let b = a; b < toks.length; b++) {
      node = node.get(toks[b].k);
      if (!node) break;
      if (!node.ends) continue;
      const end = toks[b].i + toks[b].s.length;
      if (end < text.length && WORD.test(text[end])) continue;
      for (const item of node.ends) found.push({ start: first.i, end, item });
    }
  }
  return found;
}

/**
 * Keep finds in the order given, dropping any that overlaps one already kept
 * (`dropped(find, keptFind)` hears of each). One pass over the characters, so
 * thousands of finds cost no more than the text is long.
 */
function keepApart(list, dropped = () => {}) {
  const owner = new Int32Array(list.reduce((n, f) => Math.max(n, f.end), 0) + 1).fill(-1);
  const kept = [];
  for (const f of list) {
    let hit = -1;
    for (let i = f.start; i < f.end && hit === -1; i++) hit = owner[i];
    if (hit !== -1) { dropped(f, kept[hit]); continue; }
    owner.fill(kept.length, f.start, f.end);
    kept.push(f);
  }
  return kept.sort((x, y) => x.start - y.start);
}

/** The longest first, then the earliest; anything overlapping one already kept is dropped. */
const longestFirst = (list) => keepApart(list.slice().sort((x, y) => (y.end - y.start) - (x.end - x.start) || x.start - y.start));

// ---------------------------------------------------------------- 1. the key sweep

// Honours and joining words: a key value that is only one of these is not swept on its own.
// ("Tan" and "Toh" are swept: they are common surnames, and "Tan Sri" and "Toh Puan" are recognised as honours below.)
const HONOUR_ONLY = new Set(['sri', 'seri', 'dato', 'datuk', 'datin', 'tun', 'haji', 'hajah', 'raja', 'tengku', 'tunku', 'syed', 'sharifah', 'encik', 'puan', 'cik', 'tuan', 'bin', 'binti', 'anak']);
// Short surnames that are also everyday English words: counted only when written with a capital, and not at the start of a sentence.
const ALSO_ENGLISH = new Set('low saw sin see son sun tee wee woo hew lye ting tong long law man may sum yam pan hong kong mark will bill rose hope grace joy'.split(' '));
// "Tan" in "Tan Sri" is the honour, not the surname.
const HONOUR_START = new RegExp(`^(?:${HONOURS.filter((h) => /\s/.test(h)).map((h) => h.replace(/['’]/g, "['’]?").replace(/\s+/g, '\\s+')).join('|')})(?![\\p{L}])`, 'iu');

function shape(s) {
  const words = s.match(/\p{L}+/gu) || [];
  if (!words.length) return 'none';
  if (words.every((w) => w === w.toUpperCase())) return words.join('').length > 1 ? 'upper' : 'title';
  if (words.every((w) => w === w.toLowerCase())) return 'lower';
  if (words.every((w) => /^\p{Lu}/u.test(w))) return 'title';
  return 'mixed';
}

/** Is the word at `at` the first of its sentence? A full stop after "Mr" or an initial does not end a sentence. */
function sentenceStart(text, at) {
  for (let i = at - 1; i >= 0; i--) {
    const c = text[i];
    if (c === '\n') return true;
    if (/[.!?:;]/.test(c)) {
      if (!/\s/.test(text[i + 1] || ' ') && text[i + 1] !== HOLD) return false;
      if (c === '.') {
        const w = /(\p{L}+)$/u.exec(text.slice(Math.max(0, i - 12), i));
        if (w && (ABBREV.has(w[1].toLowerCase()) || w[1].length === 1)) return false;
      }
      return true;
    }
    if (/[\p{L}]/u.test(c)) return false;
  }
  return true;
}

/** Every value the key holds that is looked for word by word. Facts are looked for by meaning instead. */
function keyItems(matter) {
  const items = [];
  for (const e of matter.cloak.entries) {
    const type = typeOf(e.token);
    if (matter.facts.on && FACT_TYPES.has(type)) continue;
    if (/\.TITLE\d*$/.test(e.token)) continue; // honours (Dato' Sri) are shared by many people
    const value = norm(e.value);
    const letters = (value.match(/[\p{L}\p{N}]/gu) || []).length;
    if (letters < 3) continue;
    const low = value.toLowerCase().replace(/['’.]/g, '');
    if (HONOUR_ONLY.has(low)) continue;
    const single = !/\s/.test(value) && /^\p{L}/u.test(value);
    const common = single && (isStop(value) || ALSO_ENGLISH.has(low));
    // Three letters and an ordinary word ("may", "low"): not swept at all.
    if (common && letters <= 3) continue;
    items.push({
      token: e.token,
      value,
      // An ordinary word wrongly taken for a name ("Cabinets") counts only when written the way the key has it.
      sameCase: common,
      // Short forms and names that are also words count only when written with a capital.
      capital: !common && single && (letters <= 3 || AMBIGUOUS.has(low)),
      shape: shape(value),
      short: letters <= 3,
      english: ALSO_ENGLISH.has(low) || AMBIGUOUS.has(low),
      hidden: e.match === false, // folder names and other values that are only used for putting back
      oneWord: single,
      // One word that is not in the name lists ("Cabinets" taken for a name by mistake): written with other
      // capitals it may be the ordinary word, so it is listed as a possible name for a person to decide.
      softCase: single && !common && !(letters <= 3) && !NAME_WORDS.has(low),
    });
  }
  return items;
}

function caseFits(o, text) {
  const { item } = o;
  const slice = text.slice(o.start, o.end);
  const form = shape(slice);
  // An ordinary word counts only written as in the key, and not where any word has a capital (the start of a sentence).
  if (item.sameCase) return form === item.shape && !(form === 'title' && sentenceStart(text, o.start));
  if (!item.capital) return true;
  if (form === 'title' || form === 'upper') return !(item.english && form === 'title' && sentenceStart(text, o.start));
  // Three letters in lower case joined by a dot to another word: part of a user name (lim.meiling).
  if (item.short && ((text[o.end] === '.' && /[\p{L}\p{N}]/u.test(text[o.end + 1] || '')) || (text[o.start - 1] === '.' && /[\p{L}\p{N}]/u.test(text[o.start - 2] || '')))) return true;
  return false;
}

/**
 * `who(offset)` is true on a line naming who reviewed or checked. There a
 * one-word form ("Siti", "Tan") is not counted: a reviewer may share a common
 * name word with a party. A full name or a number the key holds is.
 */
function keyFinds(text, ctx, who = () => false) {
  const hits = occurrences(text, ctx.keyTree).filter((o) => caseFits(o, text) && !HONOUR_START.test(text.slice(o.start, o.start + 40)) && !(o.item.oneWord && who(o.start)));
  return longestFirst(hits).map((o) => {
    const value = text.slice(o.start, o.end);
    const otherCase = shape(value) !== o.item.shape;
    if (o.item.softCase && otherCase) return { check: 'name', rule: 'case', start: o.start, end: o.end, value, token: o.item.token };
    return { check: 'key', start: o.start, end: o.end, value, token: o.item.token, hidden: o.item.hidden, otherCase };
  });
}

const tagOfFact = (facts, item) => `${KIND_TAG[item.kind]}_${facts.numbers.get(`${item.kind}|${item.key}`)}`;

/**
 * Facts the key holds, written in ANY format (RM4,317,250 for RM 4,317,250.00),
 * and rounded amounts close to one. In a cloaked copy of a Strict matter any
 * date, amount, reference, place, project, job title or court still showing is
 * listed too, even if the key does not have it.
 */
function factFinds(matter, text, { allowKinds = [], unknownToo = false } = {}) {
  const facts = matter.facts;
  if (!facts.on) return [];
  const probe = new Facts({ level: 'strict', percentages: facts.percentages, courts: facts.courts !== false });
  const out = [];
  const add = (f) => {
    if (allowKinds.includes(f.kind) || facts.isUnblurred(f.kind, f.key)) return;
    const item = facts.items.get(`${f.kind}|${f.key}`);
    const base = { check: 'fact', start: f.start, end: f.end, value: text.slice(f.start, f.end), fact: f.kind };
    if (item) return out.push({ ...base, token: tagOfFact(facts, item) });
    if (f.kind === 'amount' && f.rounded) {
      const near = [...facts.items.values()].find((i) => i.kind === 'amount' && i.currency === f.currency && Math.abs(i.cents - f.cents) * 2 <= f.step && !facts.isUnblurred('amount', i.key));
      if (near) return out.push({ ...base, token: tagOfFact(facts, near), approximate: true });
    }
    if (unknownToo) out.push({ ...base, unknown: true });
  };
  for (const f of probe.find(text)) add(f);
  for (const f of findSheetAmounts(text)) add({ kind: 'amount', ...f });
  return longestFirst(out);
}

// ---------------------------------------------------------------- 2. the pattern sweep

// Legal provisions are never identifiers ("Order 14", "Seksyen 74"): the same rule the first pass uses.
const PROVISIONS = [
  /\b(?:[Ss]ections?|[Ss]eksyen|[Ss]\.|ss\.|[Oo]rder|[Aa]turan|[Rr]ules?|[Kk]aedah|[Aa]rticles?|[Pp]erkara|[Pp]aragraphs?|[Pp]erenggan|[Pp]ara\.?|[Cc]lauses?|[Kk]lausa|[Ss]chedule|[Jj]adual|[Rr]egulations?|[Pp]eraturan|[Ff]orm|[Bb]orang)\s+\d+[A-Z]{0,2}(?:\(\w{1,4}\))*(?:\s+(?:[Rr]ule|[Rr]\.|[Kk]aedah)\s+\d+[A-Z]?(?:\(\w{1,4}\))*)?/g,
  /\b(?:\p{Lu}[\p{L}'’-]*\s+){1,6}(?:Act|Ordinance|Enactment|Code|Rules)\s+(?:19|20)\d{2}\b/gu,
  /\b(?:Akta|Ordinan|Enakmen|Kanun|Kaedah-Kaedah)(?:\s+(?:\p{Lu}[\p{L}'’-]*|dan|dan\s+\p{Lu}[\p{L}'’-]*)){1,6}\s+(?:19|20)\d{2}\b/gu,
];
const provisionSpans = (text) => PROVISIONS.flatMap((re) => [...text.matchAll(re)].map((m) => [m.index, m.index + m[0].length]));
const factSpans = (text) => [...findDates(text), ...findAmounts(text)].map((f) => [f.start, f.end]);

const PATTERN_WORDS = {
  NRIC: 'an NRIC or MyKad number', MY_IC: 'an NRIC or MyKad number', SG_NRIC: 'a Singapore NRIC or FIN', PASSPORT: 'a passport number', PHONE: 'a phone number', EMAIL: 'an email address',
  ACCOUNT: 'a bank account or card number', CARD: 'a card number', IBAN: 'a bank account number', NUMBER: 'a long number (an account or ID)', CASE: 'a court case number', CASE_NO: 'a court case number',
  LAND: 'a land title or lot', VEHICLE: 'a vehicle plate', ADDRESS: 'a postal address', POSTCODE: 'a postcode and town', COMPANY_NO: 'a company number', UEN: 'a company number (UEN)',
  TAX_NO: 'a tax number', ID_NUMBER: 'an ID or reference number', URL: 'a web address', LOCATION: 'a GPS position', PPSN: 'an ID number', NINO: 'an ID number', EIRCODE: 'a postcode',
};

function patternFinds(text, ctx) {
  const kept = new Uint8Array(text.length);
  for (const [s, e] of [...factSpans(text), ...provisionSpans(text)]) kept.fill(1, s, e);
  const found = [];
  const push = (type, start, value) => {
    const end = start + value.length;
    if (!value.trim() || value.includes(HOLD)) return;
    for (let i = start; i < end; i++) if (kept[i]) return;
    if (ctx.keepValues.has(norm(value).toLowerCase())) return;
    found.push({ check: 'pattern', start, end, value, type });
  };
  for (const span of findAddresses(text)) push('ADDRESS', span.start, text.slice(span.start, span.end).replace(/[,.\s]+$/, ''));
  for (const p of [...PATTERNS, ...FORWARD_DETECTORS]) {
    for (const m of text.matchAll(p.re)) {
      const value = p.forward ? m.groups.__val : m[0];
      if (!value) continue;
      if (p.valid && !p.valid(value)) continue;
      if (p.minDigits && value.replace(/\D/g, '').length < p.minDigits) continue;
      push(p.type, p.forward ? m.index + m.groups.__pre.length : m.index, value);
    }
  }
  return longestFirst(found);
}

// ---------------------------------------------------------------- 3. leftover names

// Titles that come before a name. Two-word titles first.
const TITLES = ['Tan Sri', 'Puan Sri', 'Toh Puan', "Dato' Seri", "Dato' Sri", 'Dato Seri', 'Dato Sri', 'Datuk Seri', 'Datuk Sri', 'Datin Seri', 'Datin Sri', 'Yang Berhormat', 'Yang Mulia', 'Yang Berbahagia', 'Mak Cik', 'Pak Cik',
  "Dato'", 'Dato', 'Datuk', 'Datin', 'Tun', 'Encik', 'En', 'Puan', 'Pn', 'Cik', 'Tuan', 'Mr', 'Mrs', 'Ms', 'Miss', 'Mdm', 'Madam', 'Dr', 'Prof', 'Professor', 'Haji', 'Hajah', 'Hj', 'Hjh', 'Ir', 'Ts',
  'Kak', 'Kakak', 'Abang', 'Pak', 'Pakcik', 'Mak', 'Makcik', 'Uncle', 'Aunty', 'Auntie', 'Cikgu', 'Ustaz', 'Ustazah', 'Sir', 'Dame', 'Lady', 'Lord', 'Tengku', 'Tunku', 'Syed', 'Sharifah',
  'YB', 'YBhg', 'YM', 'YAB', 'Inspector', 'Insp', 'ASP', 'DSP', 'Supt', 'Sgt', 'Sjn', 'Sarjan', 'Kpl', 'Cpl', 'Koperal', 'Konstabel', 'Constable'];
const titleWords = (t) => t.toLowerCase().replace(/’/g, "'").replace(/\.$/, '').split(/\s+/);
const TITLE_SEQ = TITLES.map(titleWords).sort((a, b) => b.length - a.length);
const PARTICLES = new Set(['bin', 'binti', 'binte', 'bte', 'bt', 'a/l', 'a/p', 's/o', 'd/o', 'anak', 'ibni']);
// Abbreviations that may be followed by a full stop inside a name ("Mr. Tan", "Mohd. Zaki", "Ahmad b. Ismail").
const ABBREV = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'hj', 'hjh', 'en', 'pn', 'mdm', 'md', 'mohd', 'muhd', 'bt', 'bte', 'b', 'sgt', 'insp', 'supt', 'cpl', 'kpl', 'sjn', 'st', 'jr', 'sr', 'ybhg']);
// A name word right after one of these, or right before one of the second list, is part of a place or a public body.
const PLACE_BEFORE = new Set('jalan jln lorong lrg persiaran lebuh lebuhraya taman tmn bandar kampung kampong kg bukit sungai sg kuala teluk tanjung pulau masjid surau sekolah sk smk sjkc sjkt universiti university kolej college institut institute hospital dewan wisma menara bangunan plaza kompleks pusat stadium balai jabatan kementerian lembaga majlis mahkamah'.split(' '));
const PLACE_AFTER = new Set('town city road street avenue lane drive hall square island bridge tower towers centre center institution school college hospital mosque university park gardens heights residences estate building hotel plaza mall'.split(' '));
const DOC_WORDS = new Set('affidavit afidavit exhibit annexure appendix bundle schedule clause recital whereas page pages sheet text body file files folder copy draft final version scanned'.split(' '));
const COMPANY_WORD = /\b(?:sdn|bhd|berhad|enterprise|trading|holdings|syarikat|bank|berhad|plt|llp|pte|ltd|limited|partners|associates|& co)\b/i;

const NAME_TOKEN = /[AaSsDd]\/[LlPpOo]|[\p{L}][\p{L}\p{M}'’-]*/gu;
const plainWord = (w) => w.toLowerCase().replace(/’/g, "'").replace(/'s$/, '').replace(/'$/, '');
const stopWord = (w) => plainWord(w).split('-').every((p) => !p || isStop(p));
const letterCount = (w) => (w.match(/\p{L}/gu) || []).length;

function nameKind(tok) {
  const w = tok.plain;
  if (!NAME_WORDS.has(w) || stopWord(tok.text)) return null;
  if (AMBIGUOUS.has(w) || ALSO_ENGLISH.has(w)) return 'weak';
  if (GENERIC_PARTS.has(w)) return 'generic';
  if (CHINESE_SURNAMES.has(w) && !MALAY_NAMES.has(w) && !INDIAN_NAMES.has(w) && !ENGLISH_NAMES.has(w)) return 'surname';
  return 'strong';
}

/** Runs of capitalised words joined by single spaces (particles such as bin and a/l may sit inside), one line at a time. */
function runsIn(text) {
  const runs = [];
  let lineStart = 0;
  for (const line of text.split('\n')) {
    let run = [];
    let prev = null;
    const flush = () => { if (run.length) runs.push(run); run = []; };
    for (const m of line.matchAll(NAME_TOKEN)) {
      const t = m[0];
      const local = m.index;
      const low = plainWord(t).replace(/\.$/, '');
      const tok = {
        text: t.replace(/['’]$/, (q) => (/^dato/i.test(t) ? q : '')),
        start: lineStart + local,
        end: lineStart + local + t.length,
        cap: /^\p{Lu}/u.test(t),
        upper: letterCount(t) >= 2 && t === t.toUpperCase(),
        plain: low,
        particle: PARTICLES.has(low) || (low === 'b' && line[local + t.length] === '.'),
        initial: sentenceStart(text, lineStart + local),
      };
      if (tok.text.length < t.length) tok.end = tok.start + tok.text.length;
      const sep = prev ? line.slice(prev.end - lineStart, local) : null;
      const joined = prev && (sep === ' ' || sep === '\u00a0' || (/^\.[ \u00a0]$/.test(sep) && (ABBREV.has(prev.plain) || prev.plain.length === 1)));
      if (!joined) flush();
      if (tok.cap) run.push(tok);
      else if (tok.particle && (run.length || /\uFFFC[ \u00a0]$/.test(line.slice(0, local)))) { if (!run.length) run.afterTag = true; run.push(tok); }
      else flush();
      prev = tok;
    }
    flush();
    lineStart += line.length + 1;
  }
  return runs;
}

function titleAt(run, i) {
  for (const words of TITLE_SEQ) {
    if (i + words.length > run.length) continue;
    if (words.every((w, k) => run[i + k].plain.replace(/'$/, '') === w.replace(/'$/, '') && (run[i + k].cap || w === 'a/l'))) return words.length;
  }
  return 0;
}

const trimEnds = (toks) => {
  let a = 0;
  let b = toks.length;
  while (a < b && (toks[a].particle || stopWord(toks[a].text))) a++;
  while (b > a && (toks[b - 1].particle || stopWord(toks[b - 1].text))) b--;
  return toks.slice(a, b);
};

function placeContext(run, from, to) {
  for (let i = Math.max(0, from - 1); i <= to; i++) if (PLACE_BEFORE.has(run[i].plain) && i < to) return true;
  for (let i = from; i <= Math.min(run.length - 1, to + 1); i++) if (PLACE_AFTER.has(run[i].plain) && i > from) return true;
  return false;
}

/** Possible names in one unit's text. `prose` adds rule D (capitalised words), used for documents. */
function nameFinds(text, ctx, { prose }) {
  // What a reviewer marked as fine, and places, courts, projects, job titles, dates, amounts and provisions, are not names.
  const spans = [...occurrences(text, ctx.safeTree).map((o) => [o.start, o.end])];
  for (const f of [...findPlaces(text), ...findCourts(text), ...findProjects(text), ...findJobs(text)]) spans.push([f.start, f.end]);
  spans.push(...factSpans(text), ...provisionSpans(text));
  const masked = blank(text, spans);
  const finds = [];
  const add = (rule, toks) => {
    if (!toks.length) return;
    const start = toks[0].start;
    const end = toks[toks.length - 1].end;
    finds.push({ check: 'name', rule, start, end, value: masked.slice(start, end) });
  };
  for (const run of runsIn(masked)) {
    // A. Words after a title: Encik Zainal, Puan Rohani, Dato' Sri Halim, Mr. Ong.
    for (let i = 0; i < run.length; i++) {
      let n = titleAt(run, i);
      if (!n) continue;
      let j = i + n;
      while (j < run.length && (n = titleAt(run, j))) j += n;
      const words = [];
      for (; j < run.length; j++) { if (!run[j].particle && (stopWord(run[j].text) || titleAt(run, j))) break; words.push(run[j]); }
      const name = trimEnds(words);
      if (name.length && name[0] === words[0]) add('title', name);
      i = Math.max(i, j - 1);
    }
    // B. Names with bin, binti, a/l, a/p: Zainal bin Kassim; "{{PERSON_1}} bin Ismail" (half a name).
    const pi = run.findIndex((t) => t.particle);
    if (pi !== -1) {
      const after = run.slice(pi + 1).filter((t) => t.cap && !stopWord(t.text));
      const before = run.slice(0, pi).filter((t) => t.cap && !stopWord(t.text) && !titleAt(run, run.indexOf(t)));
      if (after.length && (before.length || run.afterTag)) {
        let from = 0;
        while (from < pi && (titleAt(run, from) || stopWord(run[from].text))) from += titleAt(run, from) || 1;
        add('particle', trimEnds(run.slice(run.afterTag ? pi + 1 : from)));
      }
    }
    // C. Words in the name lists, and D. capitalised words that are not ordinary words.
    let sub = [];
    const subs = [];
    run.forEach((t, i) => {
      if (!t.particle && (stopWord(t.text) || titleAt(run, i))) { if (sub.length) subs.push(sub); sub = []; } else sub.push({ ...t, at: i });
    });
    if (sub.length) subs.push(sub);
    for (const s0 of subs) {
      let s = trimEnds(s0);
      // The first word of a sentence has a capital anyway: unless it is a name word, it is not part of the name ("Later Toh").
      if (s.length > 1 && s[0].initial && !nameKind(s[0])) s = s.slice(1);
      if (!s.length) continue;
      const from = s[0].at;
      const to = s[s.length - 1].at;
      if (placeContext(run, from, to)) continue;
      const qualifies = s.some((t, k) => {
        const kind = nameKind(t);
        if (!kind || t.particle) return false;
        if (!t.cap) return false;
        if (kind === 'strong') return !(t.upper && s.length === 1 && t.plain.length <= 3);
        if (kind === 'surname') return (k === 0 && s.length >= 2 && s.slice(1).some((x) => x.cap && !x.particle && !stopWord(x.text))) || (s.length === 1 && !t.upper && !t.initial);
        if (kind === 'generic') return s.slice(k + 1).some((x) => x.cap && !x.particle && !stopWord(x.text));
        return false;
      });
      if (qualifies) { add('list', s); continue; }
      if (!prose) continue;
      const titled = s.filter((t) => !t.particle);
      if (titled.some((t) => t.upper)) continue;
      if (s.length === 1 && s[0].initial) continue;
      if (titled.some((t) => letterCount(t.text) >= 2 && !stopWord(t.text) && !ctx.decided.has(t.plain) && !DOC_WORDS.has(t.plain))) add('caps', s);
    }
  }
  // One finding per place: a title or particle find wins over a list or capitals find on the same words.
  const rank = { title: 0, particle: 1, list: 2, caps: 3 };
  return keepApart(finds.sort((a, b) => rank[a.rule] - rank[b.rule] || (b.end - b.start) - (a.end - a.start)));
}

// ---------------------------------------------------------------- 5. tags

function tagFinds(matter, text, { bare, usage, unit }) {
  const out = [];
  for (const m of text.matchAll(/\{\{[^{}\n]{0,80}\}\}/g)) {
    const at = { check: 'tag', start: m.index, end: m.index + m[0].length, value: m[0] };
    if (!WELL_FORMED.test(m[0])) out.push({ ...at, kind: 'malformed' });
    else if (!matter.cloak.byToken.has(m[0].slice(2, -2))) out.push({ ...at, kind: 'unknown' });
    else usage.push({ token: m[0].slice(2, -2), unit, start: m.index });
  }
  for (const m of text.matchAll(/\{\{(?![^{}\n]{0,80}\}\})/g)) out.push({ check: 'tag', kind: 'malformed', start: m.index, end: m.index + 2, value: text.slice(m.index, m.index + 30).split('\n')[0] });
  for (const m of text.matchAll(/(?<!\{\{[^{}\n]{0,80})\}\}/g)) out.push({ check: 'tag', kind: 'malformed', start: m.index, end: m.index + 2, value: text.slice(Math.max(0, m.index - 28), m.index + 2).split('\n').pop() });
  for (const m of text.matchAll(/(?<!\{)\{[A-Z][A-Z0-9_]*_\d+(?:\.[A-Z0-9_]+)?\}(?!\})/g)) out.push({ check: 'tag', kind: 'malformed', start: m.index, end: m.index + m[0].length, value: m[0] });
  if (bare) {
    const types = new Set(matter.cloak.entries.map((e) => typeOf(e.token)));
    const plain = text.replace(/\{\{[^{}\n]{0,80}\}\}/g, (m) => ' '.repeat(m.length));
    for (const m of plain.matchAll(/(?<![\p{L}\p{N}_{])([A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)*)_\d+(?:\.[A-Z0-9_]+)?(?![\p{L}\p{N}_}])/gu)) {
      if (types.has(m[1])) out.push({ check: 'tag', kind: 'bare', start: m.index, end: m.index + m[0].length, value: m[0] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the units that are checked

const ALL = 'all';
const ONLY_KEY = new Set(['fact', 'pattern', 'name']); // the checks a who-line skips: only the key sweep runs on it

/** A cloaked copy (or the chronology) as the double checker reads it: its text and where each part starts. */
export function documentUnit(f, { title = f.rel, label = null } = {}) {
  const text = f.cloaked;
  const lines = text.split('\n');
  const parts = [{ line: 1, label: 'File name' }];
  const plain = f.parts?.length === 1 && !f.parts[0].ocr && /^(?:Text|Body|Email|Page 1)$/.test(f.parts[0].label);
  if (plain || !f.parts?.length) parts.push({ line: 3, label: label || f.parts?.[0]?.label || 'Text' });
  else {
    let from = 2;
    for (const p of f.parts) {
      const exact = `[${p.label}]`;
      const head = `[${p.label.split(/[\s:(]/)[0]}`;
      let at = -1;
      for (let j = from; j < lines.length; j++) {
        if (lines[j] === exact || (lines[j].startsWith(head) && lines[j].endsWith(']') && (j === 2 || lines[j - 1] === ''))) { at = j; break; }
      }
      if (at === -1) continue;
      parts.push({ line: at + 1, label: lines[at].slice(1, -1) });
      from = at + 1;
    }
  }
  // "File: " is Cloak's own label, not part of the name ("File: 01 Writ" is not file number 01).
  return { id: f.out, title, kind: 'document', text, parts, fixed: text.startsWith('File: ') ? [[0, 6]] : [] };
}

/** The context sheet: Cloak's own headings and rules are fixed text and are not checked; job titles may show (each person's role). */
export function sheetUnit(sheet) {
  const lines = sheet.cloaked.split('\n');
  const fixed = new Set(AI_RULES);
  const exempt = new Map();
  const parts = [{ line: 1, label: 'Context sheet' }];
  lines.forEach((l, i) => {
    const heading = /^[A-Z][A-Z ]+[A-Z](?: \(.*\))?$/.test(l);
    if (fixed.has(l) || heading || /^Cloak \S+$/.test(l)) exempt.set(i + 1, ALL);
    if (heading && i > 0) parts.push({ line: i + 1, label: l.replace(/ \(.*$/, '').toLowerCase().replace(/^./, (c) => c.toUpperCase()) });
  });
  return { id: sheet.out, title: 'Context sheet for the AI', kind: 'generated', text: sheet.cloaked, parts, exempt, allowKinds: ['job'] };
}

const TIME_KEYS = new Set(['when', 'when_text', 't', 'first_cloaked', 'last_cloaked', 'cloak_version']);
const WHO_KEYS = new Set(['by', 'review', 'statement', 'fine_marked_by']);

/**
 * cloak-report.json, line by line as it is written. Time stamps and the
 * version are skipped; the names of the people who reviewed and checked are
 * only looked at by the key sweep (they are there on purpose, but must not be
 * a name the key holds); numbers and true/false are skipped; tag names used as
 * keys must be in the key.
 */
export function reportUnit(text, id = 'cloak-report.json') {
  const exempt = new Map();
  const bareTags = [];
  const parts = [{ line: 1, label: 'Report' }];
  const stack = [];
  text.split('\n').forEach((line, i) => {
    const n = i + 1;
    const m = /^(\s*)(?:"((?:[^"\\]|\\.)*)"\s*:\s*)?(.*?)\s*$/.exec(line);
    const own = m[2] !== undefined ? JSON.parse(`"${m[2]}"`) : null;
    let rest = m[3].replace(/,$/, '');
    const parent = stack[stack.length - 1] ?? null;
    const key = own ?? parent;
    if (/^[\]}]/.test(rest)) { stack.pop(); exempt.set(n, ALL); return; }
    if (rest === '{' || rest === '[') {
      const element = own === null && parent === 'files';
      stack.push(element ? 'file' : own ?? parent);
      exempt.set(n, ALL);
      if (element && rest === '{') parts.push({ line: n, label: 'Report: a file' });
      return;
    }
    if (own !== null && (parent === 'tags' || parent === 'replaced')) { bareTags.push({ line: n, name: own, parent }); exempt.set(n, ALL); return; }
    if (!rest.startsWith('"')) { exempt.set(n, ALL); return; }
    // Cloak's own words for a file whose name it does not show ("(file 4: name not shown because...)").
    if (TIME_KEYS.has(key) || /^"\(file \d+: name not shown because the file was not read\)"$/.test(rest)) exempt.set(n, ALL);
    else if (WHO_KEYS.has(key)) exempt.set(n, ONLY_KEY);
    if (own === 'name' && parent === 'file') parts[parts.length - 1].label = `Report: entry for ${JSON.parse(rest)}`;
  });
  return { id, title: 'Report (cloak-report.json)', kind: 'report', text, parts, exempt, bareTags };
}

/** The marker file. The lines saying who reviewed and who double-checked are only looked at by the key sweep. */
export function markerUnit(text, id) {
  const exempt = new Map();
  text.split('\n').forEach((l, i) => { if (/^(?:Reviewed by|Double-checked by|Cloak \S+$)/.test(l)) exempt.set(i + 1, /^Cloak /.test(l) ? ALL : ONLY_KEY); });
  return { id, title: 'Marker file', kind: 'marker', text, parts: [{ line: 1, label: 'Marker file' }], exempt };
}

/** The names the exported files will have. */
export function namesUnit(names) {
  return { id: '(file names)', title: 'Names of the exported files', kind: 'names', text: names.join('\n'), parts: [{ line: 1, label: 'Exported file names' }] };
}

// ---------------------------------------------------------------- running the checks

function context(matter) {
  const words = (list) => list.map((v) => ({ value: norm(v) })).filter((x) => x.value);
  return {
    keyTree: treeOf(keyItems(matter)),
    keepTree: treeOf(words(matter.keep || [])),
    safeTree: treeOf(words(matter.safeWords || [])),
    keepValues: new Set((matter.keep || []).map((k) => norm(k).toLowerCase())),
    // Single words a reviewer marked as fine, for rule D only: "Chinese Tamil Jawi" covers "Tamil" on its own.
    decided: new Set((matter.safeWords || []).flatMap((w) => plainWord(w).split(/[\s-]+/)).filter(Boolean)),
  };
}

function excerptOf(text, starts, line, s, e) {
  const from = starts[line - 1];
  const to = line < starts.length ? starts[line] - 1 : text.length;
  const lineText = text.slice(from, to);
  let a = Math.max(0, s - from - 50);
  let b = Math.min(lineText.length, e - from + 50);
  // The excerpt never cuts a tag in half.
  for (const t of lineText.matchAll(/\{\{[^{}]*\}\}/g)) {
    if (t.index < a && t.index + t[0].length > a) a = t.index;
    if (t.index < b && t.index + t[0].length > b) b = t.index + t[0].length;
  }
  const before = (a > 0 ? '…' : '') + lineText.slice(a, s - from);
  const found = text.slice(s, Math.min(e, to));
  return { excerpt: `${before}${found}${lineText.slice(e - from, b)}${b < lineText.length ? '…' : ''}`.replace(/\t/g, ' '), mark: [before.length, before.length + found.length], lineText };
}

/** Check a set of units. Returns each finding with where it is: unit, part, line and a short excerpt. */
export function inspect(matter, units) {
  const ctx = context(matter);
  const usage = [];
  const finds = [];
  for (const unit of units) {
    if (!unit?.text) continue;
    const starts = (unit.starts = lineStarts(unit.text));
    // Tags stand aside, and so do values a reviewer chose to show (with two confirmations for numbers).
    const held = blank(unit.text.replace(TAG, (m) => HOLD.repeat(m.length)), unit.fixed || [], ' ');
    const base = blank(held, occurrences(held, ctx.keepTree).map((o) => [o.start, o.end]));
    const own = [];
    const whoLines = new Set([...(unit.exempt || [])].filter(([, skip]) => skip === ONLY_KEY).map(([line]) => line));
    own.push(...keyFinds(forCheck(base, unit, 'key'), ctx, (at) => whoLines.has(lineAt(starts, at))));
    own.push(...factFinds(matter, forCheck(base, unit, 'fact'), { allowKinds: unit.allowKinds || [], unknownToo: unit.kind === 'document' }));
    own.push(...patternFinds(forCheck(base, unit, 'pattern'), ctx));
    own.push(...nameFinds(forCheck(base, unit, 'name'), ctx, { prose: unit.kind === 'document' }));
    // Words found by two checks are listed once: the longer find wins, so hiding it covers the whole name
    // ("Lim Kah Wai", not just "Lim"); on the same words a key value comes first, then a fact, a pattern, a possible name.
    const rank = { key: 0, fact: 1, pattern: 2, name: 3 };
    const values = keepApart(own.sort((a, b) => (b.end - b.start) - (a.end - a.start) || rank[a.check] - rank[b.check] || a.start - b.start), (f, over) => {
      if (f.check === 'key' && over.check !== 'key') (over.inKey ||= []).push(f.token);
    });
    const tags = tagFinds(matter, forCheck(unit.text, unit, 'tag'), { bare: unit.kind !== 'report', usage, unit: unit.id });
    for (const b of unit.bareTags || []) {
      // Tag names counted in the report ("PERSON_1": 3) must be tags of this matter.
      const ok = b.parent === 'replaced' ? matter.cloak.entries.some((e) => typeOf(e.token) === b.name) : matter.cloak.byToken.has(b.name);
      if (!ok) tags.push({ check: 'tag', kind: 'unknown', start: starts[b.line - 1], end: starts[b.line - 1] + unit.text.split('\n')[b.line - 1].length, value: b.name });
    }
    for (const f of [...values, ...tags]) {
      const line = lineAt(starts, f.start);
      const part = unit.parts.filter((p) => p.line <= line).pop()?.label || '';
      // A line saying who reviewed or checked is Cloak's own: hiding cannot change it.
      const who = unit.exempt?.get(line) === ONLY_KEY;
      finds.push({ ...f, unit: unit.id, title: unit.title, unitKind: unit.kind, part, line, who, ...excerptOf(unit.text, starts, line, f.start, f.end) });
    }
  }
  return { units, finds, usage };
}

const FACT_WORDS = { date: 'date', amount: 'amount', ref: 'reference number', percent: 'percentage', place: 'place', project: 'project name', job: 'job title', court: 'court or judge' };
const inKeyNote = (f) => (f.inKey?.length ? ` Part of it is in the key: ${[...new Set(f.inKey)].map((t) => `{{${t}}}`).join(', ')}.` : '');
const WHAT = {
  key: (f) => `In the key as {{${f.token}}}${f.hidden ? ' (kept only for putting back, so it is never hidden in the text)' : ''}${f.otherCase ? ', written in another letter case' : ''}.`,
  fact: (f) => (f.unknown ? `A ${FACT_WORDS[f.fact]} that Strict should have hidden. It is not in the key.` : f.approximate ? `A rounded amount close to {{${f.token}}}.` : `The same ${FACT_WORDS[f.fact]} as {{${f.token}}}, written another way.`) + inKeyNote(f),
  pattern: (f) => `Looks like ${PATTERN_WORDS[f.type] || 'a number or identifier'}.${inKeyNote(f)}`,
  name: (f) => ({ title: 'Possible name: it follows a title (Encik, Puan, Mr, Dato\'...).', particle: 'Possible name: it has bin, binti, a/l or a/p.', list: 'Possible name: a word from the name lists.', caps: 'Capitalised words that may be a name. No one has marked them as fine.', case: `Possible name: the key holds this word as {{${f.token}}}, with other capitals. Here it may be the ordinary word.` }[f.rule]) + inKeyNote(f),
  tag: (f) => ({ malformed: 'A damaged tag. Tags are written {{TYPE_1}} or {{TYPE_1.ENDING}}.', bare: 'A tag name without its braces.', unknown: 'A tag that is not in this matter\'s key.', same: `One real value under two different tags: ${f.value}.` }[f.kind]),
};

const keyOfFind = (f) => (f.check === 'tag' ? `tag|${f.kind}|${f.value}` : f.check === 'pattern' ? `pattern|${norm(f.value).toLowerCase()}` : `${f.check}|${norm(f.value).toLowerCase()}`);
// Where an approval applies. In a copy, the line; in the report and marker, whose lines move as files are added, the text of the line.
export const placeOf = (f) => (f.unitKind === 'report' || f.unitKind === 'marker' || f.unitKind === 'names' ? `${f.unit}|${norm(f.lineText)}` : `${f.unit}#${f.line}`);
// Hiding cannot change what Cloak writes about who did the work, nor fix a tag, nor change the context sheet or the
// list of file names, which Cloak writes from tags and numbers: those can only be marked as fine.
const fixable = (f) => f.check !== 'tag' && !f.who && f.unitKind !== 'generated' && f.unitKind !== 'names';
const hideAs = (f) => (f.check === 'name' ? (COMPANY_WORD.test(f.value) ? 'COMPANY' : f.rule === 'caps' ? 'OTHER' : 'PERSON') : null);

/** One real value never sits under two different tags (honours and facts aside: many people are Dato' Sri, and the same figure can be two facts). */
function sameValue(matter, inspections) {
  const byValue = new Map();
  for (const ins of inspections) {
    for (const u of ins.usage) {
      if (/\.TITLE\d*$/.test(u.token) || FACT_TYPES.has(typeOf(u.token))) continue;
      const value = norm(matter.cloak.byToken.get(u.token)).toLowerCase();
      if (!value) continue;
      if (!byValue.has(value)) byValue.set(value, new Map());
      const bases = byValue.get(value);
      if (!bases.has(baseOf(u.token))) bases.set(baseOf(u.token), { ...u, ins });
    }
  }
  const out = [];
  for (const bases of byValue.values()) {
    if (bases.size < 2) continue;
    const list = [...bases.keys()].sort();
    const where = [...bases.values()][1];
    const unit = where.ins.units.find((x) => x.id === where.unit);
    const line = lineAt(unit.starts, where.start);
    out.push({ check: 'tag', kind: 'same', value: list.map((t) => `{{${t}}}`).join(' and '), start: where.start, end: where.start, unit: unit.id, title: unit.title, unitKind: unit.kind, part: unit.parts.filter((p) => p.line <= line).pop()?.label || '', line, ...excerptOf(unit.text, unit.starts, line, where.start, where.start) });
  }
  return out;
}

/**
 * Put the inspections together: findings grouped by what was found, each
 * place marked decided when a person approved it there, and each unit's
 * result. The check has passed when nothing is left to decide.
 */
export function verdict(matter, inspections, { approvals = {} } = {}) {
  const finds = [...inspections.flatMap((i) => i.finds), ...sameValue(matter, inspections)];
  const units = inspections.flatMap((i) => i.units).filter((u) => u?.text);
  const groups = new Map();
  for (const f of finds) {
    const key = keyOfFind(f);
    if (!groups.has(key)) groups.set(key, { key, check: f.check, rule: f.rule || f.kind || f.type || null, value: f.value, what: WHAT[f.check](f), token: f.token || null, type: f.type || null, fact: f.fact || null, hideAs: hideAs(f), fixable: true, places: [] });
    const g = groups.get(key);
    const approval = approvals[key];
    const place = placeOf(f);
    g.places.push({ unit: f.unit, title: f.title, part: f.part, line: f.line, excerpt: f.excerpt, mark: f.mark, place, decided: approval && approval.places.includes(place) ? { by: approval.by, when: approval.when } : null });
    if (!fixable(f)) { g.fixable = false; g.whyNot = f.check === 'tag' ? 'tag' : f.who ? 'who' : 'generated'; }
  }
  const list = [...groups.values()].map((g) => ({ ...g, undecided: g.places.filter((p) => !p.decided).length }));
  const perUnit = units.map((u) => {
    const places = list.flatMap((g) => g.places.filter((p) => p.unit === u.id));
    const undecided = places.filter((p) => !p.decided).length;
    return { id: u.id, title: u.title, kind: u.kind, findings: places.length, undecided, status: undecided ? 'fail' : 'pass' };
  });
  const places = list.reduce((n, g) => n + g.places.length, 0);
  const undecided = list.reduce((n, g) => n + g.undecided, 0);
  return {
    passed: undecided === 0,
    units: perUnit,
    groups: list.sort((a, b) => (b.undecided > 0) - (a.undecided > 0) || CHECKS.indexOf(a.check) - CHECKS.indexOf(b.check) || a.value.localeCompare(b.value)),
    // The list of file names is checked too, but it is not a file.
    counts: { files: perUnit.filter((u) => u.kind !== 'names').length, places, groups: list.length, undecided, markedFine: places - undecided, filesFailing: perUnit.filter((u) => u.status === 'fail').length },
  };
}

/** Run every check on a set of units and give the verdict. */
export function doubleCheck(matter, units, options = {}) {
  return verdict(matter, [inspect(matter, units)], options);
}

// ---------------------------------------------------------------- the key sweep on its own

/**
 * Read cloaked text again and look for anything the key holds: the exact
 * value (whole words; any letter case for names of four letters or more,
 * written with a capital for three-letter short forms and for names that are
 * also words, written the way the key has it for ordinary words), and facts
 * in any format. Returns where each hit is: paragraph number and a short
 * excerpt. Used by the double checker and by the restore check.
 */
export function keySweep(matter, text, { allowKinds = [] } = {}) {
  const ctx = context(matter);
  const plain = String(text).replace(TAG, (m) => HOLD.repeat(m.length)).replace(TOKEN_RE, (m) => HOLD.repeat(m.length));
  const starts = lineStarts(plain);
  const lines = String(text).split('\n');
  const paragraphOf = (line) => lines.slice(0, line).filter((l) => l.trim()).length;
  const hits = [];
  for (const f of keyFinds(plain, ctx).filter((x) => x.check === 'key')) hits.push({ kind: 'key', at: f.start, value: f.value, token: f.token });
  for (const f of factFinds(matter, plain, { allowKinds })) hits.push({ kind: f.fact, at: f.start, value: f.value, approximate: !!f.approximate });
  return hits.sort((a, b) => a.at - b.at).map((h) => {
    const line = lineAt(starts, h.at);
    return { kind: h.kind, paragraph: paragraphOf(line), approximate: h.approximate || undefined, excerpt: lines[line - 1].slice(0, 80).replace(/\s+/g, ' '), value: h.value };
  });
}
