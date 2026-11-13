// Facts: dates, amounts, percentages and reference numbers.
//
// Two jobs use this file:
//   - Strict blurring: every date, amount and reference is replaced by a tag
//     ({{DATE_3}}, {{AMOUNT_1}}, {{REF_2}}). The same fact gets the same tag in
//     every file, however it was written. Each way of writing it gets its own
//     ending ({{DATE_3}}, {{DATE_3.B}}, {{DATE_3.C}}) so the restore step can put
//     it back exactly as it was written.
//   - The chronology table, which needs the same dates found in the same way.
//
// What it finds is listed in README.md ("Dates and amounts"). Anything not
// listed there is not found.

import { formLanguage } from './translate.js';

// ---------------------------------------------------------------- months

const MONTH_NUMBER = {
  january: 1, jan: 1, januari: 1, february: 2, feb: 2, februari: 2, march: 3, mar: 3, mac: 3,
  april: 4, apr: 4, may: 5, mei: 5, june: 6, jun: 6, july: 7, jul: 7, julai: 7,
  august: 8, aug: 8, ogos: 8, september: 9, sept: 9, sep: 9, october: 10, oct: 10, oktober: 10, okt: 10,
  november: 11, nov: 11, december: 12, dec: 12, disember: 12, dis: 12,
};
const MONTH = `(?:${Object.keys(MONTH_NUMBER).sort((a, b) => b.length - a.length).join('|')})`;
const monthOf = (word) => MONTH_NUMBER[word.toLowerCase().replace(/\.$/, '')];
const NOT_AFTER = String.raw`(?![\p{L}])`;
const NOT_BEFORE = String.raw`(?<![\p{L}\p{N}])`;

const valid = (y, m, d) => {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const day = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000;
const pad = (n) => String(n).padStart(2, '0');

const CJK_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const cjkYear = (s) => Number([...s].map((c) => CJK_DIGIT[c]).join(''));
const cjkSmall = (s) => {
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + CJK_DIGIT[s[1]];
  if (s.endsWith('十')) return CJK_DIGIT[s[0]] * 10;
  if (s.includes('十')) return CJK_DIGIT[s[0]] * 10 + CJK_DIGIT[s[2]];
  return CJK_DIGIT[s];
};

// ---------------------------------------------------------------- dates

const DATE_RULES = [
  // 3 July 2025, 3rd July 2025, 3hb Julai 2025, 21st day of July 2025
  { re: new RegExp(`${NOT_BEFORE}(\\d{1,2})(?:\\s?(?:st|nd|rd|th|hb\\.?|haribulan))?\\s+(?:(?:day\\s+of|of|hari\\s+bulan)\\s+)?(${MONTH})\\.?,?\\s+(\\d{4})(?!\\d)`, 'giu'), get: (m) => [+m[3], monthOf(m[2]), +m[1]], style: 'dmy-word' },
  // July 3, 2025
  { re: new RegExp(`${NOT_BEFORE}(${MONTH})\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?\\s+(\\d{4})(?!\\d)`, 'giu'), get: (m) => [+m[3], monthOf(m[1]), +m[2]], style: 'mdy-word' },
  // 2025-07-03
  { re: /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g, get: (m) => [+m[1], +m[2], +m[3]], style: 'iso' },
  // 03/07/2025, 3-7-2025, 3.7.25 : day first, as in Malaysia and Singapore
  { re: /(?<![\p{L}\p{N}/.\-])(\d{1,2})([/.\-])(\d{1,2})\2(\d{4}|\d{2})(?![\d])/gu, get: (m) => [m[4].length === 2 ? (+m[4] > 69 ? 1900 : 2000) + +m[4] : +m[4], +m[3], +m[1]], style: 'numeric', ambiguous: (m) => +m[1] <= 12 && +m[3] <= 12 && +m[1] !== +m[3] },
  // 2025年7月3日
  { re: /(\d{4})\s?年\s?(\d{1,2})\s?月\s?(\d{1,2})\s?[日号]/gu, get: (m) => [+m[1], +m[2], +m[3]], style: 'cjk' },
  // 二零二五年七月三日
  { re: /([〇零一二三四五六七八九]{4})年([一二三四五六七八九十]{1,3})月([一二三四五六七八九十]{1,3})日/gu, get: (m) => [cjkYear(m[1]), cjkSmall(m[2]), cjkSmall(m[3])], style: 'cjk-numerals' },
];
// A month and a year with no day: "March 2024", "Mac 2024". The month must start with a capital.
const MONTH_YEAR = new RegExp(`${NOT_BEFORE}(\\p{Lu}[\\p{L}]*)\\.?,?\\s+(\\d{4})(?!\\d)`, 'gu');
// A day and a month with no year: "5 June", "5hb Jun".
const DAY_MONTH = new RegExp(`${NOT_BEFORE}(\\d{1,2})(?:\\s?(?:st|nd|rd|th|hb\\.?))?\\s+(${MONTH})${NOT_AFTER}(?!\\.?,?\\s+\\d{4})`, 'giu');
const RANGE_JOIN = String.raw`\s*(?:and|to|-|–|—|dan|hingga|sehingga|till|until|&)\s*`;
const RANGE_SAME_MONTH = new RegExp(`${NOT_BEFORE}(\\d{1,2})(?:st|nd|rd|th|\\s?hb\\.?)?${RANGE_JOIN}(\\d{1,2})(?:st|nd|rd|th|\\s?hb\\.?)?\\s+(${MONTH})\\.?,?\\s+(\\d{4})(?!\\d)`, 'giu');
const RANGE_TWO_MONTHS = new RegExp(`${NOT_BEFORE}(\\d{1,2})(?:st|nd|rd|th|\\s?hb\\.?)?\\s+(${MONTH})${RANGE_JOIN}(\\d{1,2})(?:st|nd|rd|th|\\s?hb\\.?)?\\s+(${MONTH})\\.?,?\\s+(\\d{4})(?!\\d)`, 'giu');
const DAY_MONTH_NUMERIC = new RegExp(`((?<![\\p{L}])(?:on|pada|pd|by|before|after|since|sehingga|menjelang)\\s+)?(?<![\\p{L}\\p{N}/.\\-])(\\d{1,2})/(\\d{1,2})(?![\\d/\\-]|\\.\\d|\\p{L})`, 'giu');
// A year on its own, only when a word says it is a year: "in 2024", "pada tahun 2024".
const YEAR_ONLY = /(?<![\p{L}\p{N}])(?:in|during|since|until|by|before|after|pada tahun|tahun|year|sejak|menjelang)\s+(?:the year\s+)?((?:19|20)\d{2})(?![\d/.\-])/giu;

/**
 * Every date in the text. Each result:
 * { start, end, text, precision: 'day'|'month'|'year'|'dm', key, sort, style, ambiguous }
 *   key   - what makes two dates "the same date" (2025-07-03, 2025-07, 2025, --07-03)
 *   sort  - days since 1970, for putting dates in time order
 */
export function findDates(text) {
  const found = [];
  const add = (m, precision, key, sortDays, style, ambiguous = false, from = m.index, len = m[0].length) => found.push({ start: from, end: from + len, text: text.slice(from, from + len), precision, key, sort: sortDays, style, ambiguous });
  for (const rule of DATE_RULES) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      const [y, mo, d] = rule.get(m);
      if (!mo || !valid(y, mo, d)) continue;
      add(m, 'day', `${y}-${pad(mo)}-${pad(d)}`, day(y, mo, d), rule.style, rule.ambiguous ? rule.ambiguous(m) : false);
    }
  }
  for (const m of text.matchAll(MONTH_YEAR)) {
    const mo = monthOf(m[1]);
    if (!mo || +m[2] < 1900 || +m[2] > 2100) continue;
    add(m, 'month', `${m[2]}-${pad(mo)}`, day(+m[2], mo, 1), 'month-year');
  }
  for (const m of text.matchAll(DAY_MONTH)) {
    const mo = monthOf(m[2]);
    if (!mo || +m[1] < 1 || +m[1] > 31) continue;
    add(m, 'dm', `--${pad(mo)}-${pad(+m[1])}`, 1e6 + mo * 40 + +m[1], 'day-month');
  }
  // 2 and 3 March 2025 / 2-3 March 2025 / 30 June to 2 July 2025: a range of days.
  for (const m of text.matchAll(RANGE_SAME_MONTH)) {
    const mo = monthOf(m[3]);
    if (mo && valid(+m[4], mo, +m[1]) && valid(+m[4], mo, +m[2])) add(m, 'range', `${m[4]}-${pad(mo)}-${pad(+m[1])}/${m[4]}-${pad(mo)}-${pad(+m[2])}`, day(+m[4], mo, +m[1]), 'range');
  }
  for (const m of text.matchAll(RANGE_TWO_MONTHS)) {
    const a = monthOf(m[2]);
    const b = monthOf(m[4]);
    if (a && b && valid(+m[5], a, +m[1]) && valid(+m[5], b, +m[3])) add(m, 'range', `${m[5]}-${pad(a)}-${pad(+m[1])}/${m[5]}-${pad(b)}-${pad(+m[3])}`, day(+m[5], a, +m[1]), 'range');
  }
  // 28/5 : a day and a month with no year. Taken as a date only when the first number can only be a day (13 to 31), or a word such as "on" or "pada" comes first.
  for (const m of text.matchAll(DAY_MONTH_NUMERIC)) {
    const d = +m[2];
    const mo = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || !(d > 12 || m[1])) continue;
    const from = m.index + m[0].length - `${m[2]}/${m[3]}`.length;
    add(m, 'dm', `--${pad(mo)}-${pad(d)}`, 1e6 + mo * 40 + d, 'day-month-numeric', false, from, `${m[2]}/${m[3]}`.length);
  }
  for (const m of text.matchAll(YEAR_ONLY)) {
    const from = m.index + m[0].lastIndexOf(m[1]);
    add(m, 'year', m[1], day(+m[1], 1, 1), 'year-only', false, from, 4);
  }
  return nonOverlapping(found);
}

/** Longest first; of two overlapping finds keep the one that says more. */
function nonOverlapping(list) {
  const rank = { range: 4, day: 3, month: 2, dm: 2, year: 1 };
  const sorted = list.slice().sort((a, b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)) || ((rank[b.precision] || 0) - (rank[a.precision] || 0)));
  const out = [];
  for (const f of sorted) {
    const last = out[out.length - 1];
    if (last && f.start < last.end) {
      if ((f.end - f.start) > (last.end - last.start)) out[out.length - 1] = f;
      continue;
    }
    out.push(f);
  }
  return out;
}

// Words for numbers, for relative expressions.
const NUM_WORD = '(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|twenty|thirty|satu|dua|tiga|empat|lima|enam|tujuh|lapan|sembilan|sepuluh)';
const UNIT = '(?:days?|weeks?|months?|years?|hari|minggu|bulan|tahun)';
const WEEKDAY = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Isnin|Selasa|Rabu|Khamis|Jumaat|Sabtu|Ahad)';
const RELATIVE = new RegExp([
  `${NOT_BEFORE}(?:yesterday|today|tomorrow|tonight|kelmarin|semalam|hari ini|esok|petang tadi|pagi tadi)${NOT_AFTER}`,
  `${NOT_BEFORE}(?:last|next|this|previous|following|minggu|bulan|tahun)\\s+(?:week|month|year|weekend|${WEEKDAY}|lepas|depan|ini)${NOT_AFTER}`,
  `${NOT_BEFORE}(?:within|in|after|before|dalam masa|selepas|sebelum)\\s+${NUM_WORD}\\s+${UNIT}(?:\\s+(?:of|from|after|before|selepas|sebelum)\\b)?`,
  `${NOT_BEFORE}${NUM_WORD}\\s+${UNIT}\\s+(?:ago|later|earlier|before|after|lepas|kemudian)${NOT_AFTER}`,
  `${NOT_BEFORE}(?:the\\s+)?(?:end|beginning|start|middle|mid)\\s+of\\s+(?:the\\s+)?(?:this\\s+|last\\s+|next\\s+)?(?:week|month|year|${MONTH})${NOT_AFTER}`,
  `${NOT_BEFORE}(?:on|pada)\\s+${WEEKDAY}${NOT_AFTER}`,
].join('|'), 'giu');

/** Relative and vague dates ("last Friday", "within 14 days"). They are listed, never turned into a date. */
export function findRelative(text) {
  return [...text.matchAll(RELATIVE)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0] }));
}

// ---------------------------------------------------------------- amounts

const CUR = '(?:RM|MYR|S\\$|SGD|US\\$|USD|A\\$|AUD|\\$|EUR|GBP|£|€|Rp\\.?|IDR|RMB|CNY)';
const SUFFIX = '(?:[Mm]illion|[Mm]il|[Jj]uta|[Bb]illion|[Bb]ilion|[Tt]housand|[Rr]ibu|[mbkMBK])';
const MULT = { million: 1e6, mil: 1e6, juta: 1e6, billion: 1e9, bilion: 1e9, thousand: 1e3, ribu: 1e3, m: 1e6, b: 1e9, k: 1e3 };
const CURRENCY = { RM: 'MYR', MYR: 'MYR', 'S$': 'SGD', SGD: 'SGD', 'US$': 'USD', USD: 'USD', 'A$': 'AUD', AUD: 'AUD', $: '$', EUR: 'EUR', '€': 'EUR', GBP: 'GBP', '£': 'GBP', 'Rp': 'IDR', 'Rp.': 'IDR', IDR: 'IDR', RMB: 'CNY', CNY: 'CNY' };
const AMOUNT_BEFORE = new RegExp(`${NOT_BEFORE}(${CUR})\\s?(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?(?:\\s?(${SUFFIX})(?![\\p{L}]))?(?![\\d,]*\\d)`, 'gu');
const AMOUNT_AFTER = new RegExp(`${NOT_BEFORE}(\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.(\\d+))?\\s?(?:(${SUFFIX})\\s)?(ringgit|dollars?|rupiah)${NOT_AFTER}`, 'giu');

function amountFrom(m, currency, int, frac, suffix) {
  const mult = suffix ? MULT[suffix.toLowerCase()] : 1;
  const cents = Math.round(Number(int.replace(/,/g, '') + (frac ? `.${frac}` : '')) * mult * 100);
  // A figure written with million / juta / k is a rounded figure: it stands for any exact amount within half a step.
  const step = suffix ? Math.round(10 ** -(frac ? frac.length : 0) * mult * 100) : 0;
  return { start: m.index, end: m.index + m[0].length, text: m[0], currency, cents, rounded: !!suffix, step, key: `${currency}|${cents}` };
}

/** Every amount of money with a currency sign or word. Bare numbers are not amounts. */
export function findAmounts(text) {
  const out = [];
  for (const m of text.matchAll(AMOUNT_BEFORE)) out.push(amountFrom(m, CURRENCY[m[1]] || m[1], m[2], m[3], m[4]));
  for (const m of text.matchAll(AMOUNT_AFTER)) {
    const word = m[4].toLowerCase();
    out.push(amountFrom(m, word === 'ringgit' ? 'MYR' : word === 'rupiah' ? 'IDR' : '$', m[1], m[2], m[3]));
  }
  return nonOverlapping(out.map((a) => ({ ...a, precision: 'day' }))).map(({ precision, ...a }) => a);
}

/** Percentages: 30%, 30 per cent, 30 peratus. */
export function findPercents(text) {
  return [...text.matchAll(/(?<![\p{L}\p{N}.])(\d{1,3}(?:\.\d+)?)\s?(?:%|per\s?cent(?![\p{L}])|peratus(?![\p{L}]))/giu)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0], key: `pct|${Number(m[1])}` }));
}

// ---------------------------------------------------------------- references

// A cue word, then a reference with at least one digit: "cheque no. 663801", "Invoice INV-2025-0388". ("Our ref" and "Your ref" numbers are already tagged as ID numbers by the identifier rules.)
const REF = new RegExp(`${NOT_BEFORE}(?:cheque|cheq|check|invoice|inv|contract|agreement|purchase order|PO|delivery order|DO|receipt|policy|claim)\\.?\\s*(?:no\\.?|number|nombor|#|:)?\\s*([A-Z0-9][A-Z0-9/\\-.]{2,}[A-Z0-9])`, 'giu');

export function findRefs(text) {
  const out = [];
  for (const m of text.matchAll(REF)) {
    const value = m[1];
    if (!/\d/.test(value)) continue;
    const from = m.index + m[0].lastIndexOf(value);
    out.push({ start: from, end: from + value.length, text: value, key: `ref|${value.toUpperCase().replace(/[\s.]+/g, '')}` });
  }
  return out;
}

// ---------------------------------------------------------------- places, projects, job titles, courts

// Towns, districts and islands of Malaysia and Singapore. This is a list, not a map: a place that is not on it, and has no cue word, is not found.
const PLACES = ['Kuala Lumpur', 'Petaling Jaya', 'Shah Alam', 'Subang Jaya', 'Klang', 'Port Klang', 'Pelabuhan Klang', 'Puchong', 'Cheras', 'Ampang', 'Kajang', 'Bangi', 'Gombak', 'Batu Caves', 'Rawang', 'Kepong', 'Sentul', 'Bangsar', 'Mont Kiara', 'Damansara', 'Sri Hartamas', 'Cyberjaya', 'Putrajaya', 'Seremban', 'Nilai', 'Port Dickson', 'Johor Bahru', 'Iskandar Puteri', 'Muar', 'Batu Pahat', 'Kluang', 'Segamat', 'Melaka', 'Ipoh', 'Taiping', 'Teluk Intan', 'George Town', 'Bayan Lepas', 'Butterworth', 'Bukit Mertajam', 'Kuantan', 'Kuala Terengganu', 'Kota Bharu', 'Alor Setar', 'Sungai Petani', 'Langkawi', 'Pulau Indah', 'Pulau Ketam', 'Pulau Pinang', 'Labuan', 'Kota Kinabalu', 'Sandakan', 'Tawau', 'Kuching', 'Miri', 'Sibu', 'Bintulu', 'Jurong', 'Tampines', 'Woodlands', 'Orchard', 'Raffles Place', 'Changi', 'Tuas', 'Bukit Timah', 'Sentosa', 'Medan', 'Jakarta', 'Batam'];
const PLACE_CUE = String.raw`(?:Mukim|Daerah|Pulau|Bandar|Kampung|Kg\.?|Bukit|Lembah|Taman|Kawasan Perindustrian|Pekan|Seksyen|Section|District of|Town of|Island of|Port of)`;
const CAP = String.raw`\p{Lu}[\p{L}'\-]+`;
const PLACE_RE = new RegExp(`${NOT_BEFORE}(?:${PLACES.slice().sort((a, b) => b.length - a.length).map((p) => p.replace(/ /g, '\\s+')).join('|')}|${PLACE_CUE}\\s+${CAP}(?:\\s+${CAP}){0,2})${NOT_AFTER}`, 'gu');
const PROJECT_RE = new RegExp(`${NOT_BEFORE}(?:${CAP}\\s+){1,3}(?:Residences?|Residency|Heights|Towers?|Villas?|Gardens|Square|Mall|Plaza|Hub|City|Suites|Court|Park|Business Park|Industrial Park|Development|Resort)${NOT_AFTER}`, 'gu');
const JOB_RE = new RegExp(`${NOT_BEFORE}(?:[Tt]he\\s+)?(?:(?:Chief|Head|Senior|Managing|Finance|Financial|Branch|Operations|Sales|General|Project|Harbour|Port|Company|Group|Executive|Technical|Marketing)\\s+)+(?:Manager|Director|Officer|Master|Secretary|Executive|Accountant|Controller|Superintendent|Engineer|Pengarah|Pengurus)${NOT_AFTER}|${NOT_BEFORE}(?:[Tt]he\\s+)?(?:harbour master|port captain|company secretary|branch manager|managing director|chief executive officer|chief financial officer|pengarah urusan|setiausaha syarikat)${NOT_AFTER}`, 'gu');
const COURT_RE = new RegExp(`${NOT_BEFORE}(?:(?:The\\s+)?High Court of (?:Malaya|Sabah and Sarawak|Singapore)(?:\\s+(?:at|in)\\s+${CAP}(?:\\s+${CAP}){0,2})?|Mahkamah\\s+(?:Tinggi|Sesyen|Majistret|Rayuan|Persekutuan)(?:\\s+Malaya)?(?:\\s+(?:di|at)\\s+${CAP}(?:\\s+${CAP}){0,2})?|(?:Sessions|Magistrates'?|Magistrate's|Appeal|Federal|Industrial|Syariah|Small Claims) Court(?:\\s+(?:at|in)\\s+${CAP}(?:\\s+${CAP}){0,2})?|${CAP}(?:\\s+${CAP}){0,2}\\s+(?:JCA|JC|FCJ|CJM|CJ|PK|HMR|J)(?![\\p{L}]))`, 'gu');
const COURT_UPPER = new RegExp(`${NOT_BEFORE}(?:IN THE |DALAM )?(?:HIGH COURT OF (?:MALAYA|SABAH AND SARAWAK)|MAHKAMAH (?:TINGGI|SESYEN|MAJISTRET|RAYUAN|PERSEKUTUAN)(?: MALAYA)?)(?: (?:AT|DI) \\p{Lu}[\\p{Lu} ]*\\p{Lu})?${NOT_AFTER}`, 'gu');

const simple = (re, kind) => (text) => [...text.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[0], key: `${kind}|${m[0].toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ').trim()}` }));
export const findPlaces = simple(PLACE_RE, 'place');
export const findProjects = simple(PROJECT_RE, 'project');
export const findJobs = simple(JOB_RE, 'job');
export const findCourts = (text) => [...simple(COURT_RE, 'court')(text), ...simple(COURT_UPPER, 'court')(text)];

// ---------------------------------------------------------------- spreadsheet amounts

const AMOUNT_HEADER = /(?:amount|\brm\b|myr|\bsgd\b|paid|balance|total|sum|price|fee|jumlah|harga|bayaran|deposit|value)/i;
const NUMBER_CELL = /^(\d[\d,]*(?:\.\d+)?)(\s*\[formula:[^\]]*\])?$/;

/**
 * The data rows of every table in a sheet's text, each with ITS OWN header row.
 * A sheet can hold several tables one below the other: a header row is a row of
 * words (no numbers) that is followed by a row with a number in it. A new sheet
 * (a "[Sheet" or "Sheet name:" line) starts again. Returns
 * [{ start, line, cells, header }] where start is the offset of the line in the text.
 */
export function sheetRows(text) {
  const lines = [];
  let at = 0;
  for (const line of String(text).split('\n')) {
    lines.push({ line, start: at, cells: (line.match(/\t/g) || []).length >= 2 ? line.split('\t') : null, newSheet: /^\s*(?:\[Sheet|Sheet name:)/.test(line) });
    at += line.length + 1;
  }
  const numeric = (c) => NUMBER_CELL.test(c.trim());
  const out = [];
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.newSheet) header = null;
    if (!L.cells) continue;
    const filled = L.cells.filter((c) => c.trim());
    const allWords = filled.length >= 2 && filled.every((c) => !numeric(c));
    let next = null;
    for (let j = i + 1; j < lines.length && !lines[j].newSheet; j++) if (lines[j].cells) { next = lines[j]; break; }
    // A header is a row of words followed by a row with a number or a date in it.
    if (allWords && next && (next.cells.some(numeric) || findDates(next.cells.join(' ')).length)) { header = L.cells.map((c) => c.trim()); continue; }
    if (header) out.push({ start: L.start, line: L.line, cells: L.cells, header });
  }
  return out;
}

/**
 * Bare numbers in a spreadsheet column called Amount, Paid, Balance, Total...
 * are amounts of money (taken as ringgit unless the column says another currency),
 * zero included. Each table in a sheet is read with its own header row.
 */
export function findSheetAmounts(text) {
  const out = [];
  for (const row of sheetRows(text)) {
    let pos = row.start;
    row.cells.forEach((cell, i) => {
      const trimmed = cell.trim();
      const m = NUMBER_CELL.exec(trimmed);
      if (m && AMOUNT_HEADER.test(row.header[i] || '')) {
        const lead = cell.length - cell.trimStart().length;
        const value = m[1];
        const currency = /\bsgd\b/i.test(row.header[i]) ? 'SGD' : 'MYR';
        const cents = Math.round(Number(value.replace(/,/g, '')) * 100);
        out.push({ start: pos + lead, end: pos + lead + value.length, text: value, currency, cents, rounded: false, step: 0, key: `${currency}|${cents}`, sheet: true });
      }
      pos += cell.length + 1;
    });
  }
  return out;
}

// ---------------------------------------------------------------- the registry

const LETTERS = 'BCDEFGHIJKLMNOPQRSTUVWXYZ';
const formEnding = (i) => (i === 0 ? '' : `.${i <= LETTERS.length ? LETTERS[i - 1] : `F${i + 1}`}`);
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const KIND_TAG = { date: 'DATE', amount: 'AMOUNT', percent: 'PERCENT', ref: 'REF', place: 'PLACE', project: 'PROJECT', job: 'JOB', court: 'COURT' };

/**
 * One matter's facts. Learn every file first, call finalize(), then apply().
 *
 * Numbering: dates are numbered in true time order across the whole matter, so
 * {{DATE_3}} is always later than {{DATE_2}}. Dates with no year ("5 June") cannot
 * be placed in time and are numbered after all the others. Because of this, date
 * numbers can change when a file with a new date is added; `datesVersion` goes up
 * whenever the numbering changes, and drafts made under an older version must
 * not be restored with the new key without a warning.
 */
export class Facts {
  constructor({ level = 'strict', percentages = false, courts = true } = {}) {
    this.level = level;
    this.percentages = percentages;   // optional switch: percentages and shareholdings
    this.courts = courts;             // optional switch: court, judge and registry names
    this.items = new Map();      // "kind|key" -> { kind, key, sort, precision, forms: [surface], first, approxOf }
    this.unblurred = [];         // [{ kind, key, by, when }]  facts a person chose to leave visible
    this.computed = [];          // totals Cloak worked out itself: [{ n, parts: [tag], cents, currency }]
    this.numbers = new Map();    // "kind|key" -> n
    this.datesVersion = 0;
    this.order = 0;
  }

  get on() { return this.level === 'strict'; }

  /** Everything this text contains, in text order. */
  find(text) {
    const finds = [];
    for (const d of findDates(text)) finds.push({ kind: 'date', ...d });
    for (const a of findAmounts(text)) finds.push({ kind: 'amount', ...a });
    if (this.percentages) for (const p of findPercents(text)) finds.push({ kind: 'percent', ...p });
    for (const r of findRefs(text)) finds.push({ kind: 'ref', ...r });
    for (const p of findPlaces(text)) finds.push({ kind: 'place', ...p });
    for (const p of findProjects(text)) finds.push({ kind: 'project', ...p });
    for (const j of findJobs(text)) finds.push({ kind: 'job', ...j });
    if (this.courts) for (const c of findCourts(text)) finds.push({ kind: 'court', ...c });
    return nonOverlapping(finds.map((f) => ({ ...f, precision: f.precision || 'day' }))).map((f) => ({ ...f }));
  }

  /** Remember what a text contains. */
  learn(text) {
    if (!this.on) return;
    for (const f of findSheetAmounts(text)) this.remember({ kind: 'amount', ...f, precision: 'day' });
    for (const part of this.segments(text)) {
      if (part.token) continue;
      for (const f of this.find(part.text)) this.remember(f);
    }
  }

  remember(f, surface = squash(f.text)) {
    const id = `${f.kind}|${f.key}`;
    let item = this.items.get(id);
    if (!item) {
      item = { kind: f.kind, key: f.key, sort: f.sort ?? 0, precision: f.precision, cents: f.cents, currency: f.currency, forms: [], langs: {}, first: this.order++, rounded: [] };
      this.items.set(id, item);
    }
    if (f.rounded) {
      if (!item.rounded.some((r) => r.surface === surface)) item.rounded.push({ surface, cents: f.cents, step: f.step, currency: f.currency });
    }
    if (!item.forms.includes(surface)) item.forms.push(surface);
    // The language of each way of writing it is kept with the key, so a restore can use the form that fits the sentence.
    item.langs = item.langs || {};
    item.langs[surface] = formLanguage(item.kind, surface);
    if (item.kind === 'amount' && /^\d[\d,]*(?:\.\d+)?$/.test(surface)) (item.bare = item.bare || []).includes(surface) || item.bare.push(surface);
  }

  segments(text) {
    const parts = [];
    let at = 0;
    for (const m of String(text).matchAll(/\{\{[^}]*\}\}/g)) {
      if (m.index > at) parts.push({ text: text.slice(at, m.index) });
      parts.push({ token: true, text: m[0] });
      at = m.index + m[0].length;
    }
    if (at < text.length) parts.push({ text: text.slice(at) });
    return parts;
  }

  /**
   * Work out the numbers. Rounded amounts ("RM4.3 million") are folded into the
   * one exact amount they could be a rounding of, when there is exactly one;
   * otherwise they keep a tag of their own.
   */
  finalize() {
    // Rounded forms that match exactly one exact amount move over to it.
    const amounts = [...this.items.values()].filter((i) => i.kind === 'amount');
    for (const item of amounts) {
      if (item.key.split('|')[1] && item.forms.length && item.rounded.length === item.forms.length) {
        const matches = amounts.filter((o) => o !== item && o.currency === item.currency && o.rounded.length < o.forms.length && item.rounded.every((r) => Math.abs(o.cents - r.cents) * 2 <= r.step));
        if (matches.length === 1) {
          const target = matches[0];
          for (const s of item.forms) if (!target.forms.includes(s)) target.forms.push(s);
          target.approx = [...(target.approx || []), ...item.rounded.map((r) => r.surface)];
          this.items.delete(`${item.kind}|${item.key}`);
        }
      }
    }
    const before = JSON.stringify([...this.numbers]);
    this.numbers = new Map();
    for (const kind of Object.keys(KIND_TAG)) {
      const list = [...this.items.values()].filter((i) => i.kind === kind);
      list.sort(kind === 'date' ? (a, b) => (a.sort - b.sort) || (precisionRank(a) - precisionRank(b)) || (a.first - b.first) : (a, b) => a.first - b.first);
      list.forEach((item, i) => this.numbers.set(`${kind}|${item.key}`, i + 1));
    }
    if (JSON.stringify([...this.numbers]) !== before) this.datesVersion += 1;
  }

  tokenFor(item, surface) {
    const n = this.numbers.get(`${item.kind}|${item.key}`);
    const i = item.forms.indexOf(surface);
    return `${KIND_TAG[item.kind]}_${n}${formEnding(i < 0 ? 0 : i)}`;
  }

  isUnblurred(kind, key) {
    return this.unblurred.some((u) => u.kind === kind && u.key === key);
  }

  /** Replace every fact in a text with its tag. Text already holding tags is left alone around them. */
  apply(text) {
    if (!this.on) return text;
    // Numbers in a spreadsheet's amount columns first: they need the column names, which are on another line.
    for (const f of findSheetAmounts(text).reverse()) {
      const item = this.items.get(`amount|${f.key}`);
      if (!item || this.isUnblurred('amount', f.key) || !item.forms.includes(f.text)) continue;
      text = text.slice(0, f.start) + `{{${this.tokenFor(item, f.text)}}}` + text.slice(f.end);
    }
    return this.segments(text).map((part) => {
      if (part.token) return part.text;
      let out = '';
      let at = 0;
      for (const f of this.find(part.text)) {
        const surface = squash(f.text);
        let item = this.items.get(`${f.kind}|${f.key}`);
        if (!item || !item.forms.includes(surface)) item = this.resolve(f, surface);
        if (!item || this.isUnblurred(item.kind, item.key)) continue;
        out += part.text.slice(at, f.start) + `{{${this.tokenFor(item, surface)}}}`;
        at = f.end;
      }
      return out + part.text.slice(at);
    }).join('');
  }

  // A rounded form that was folded into an exact amount is found under that amount.
  resolve(f, surface) {
    for (const item of this.items.values()) if (item.kind === f.kind && item.forms.includes(surface)) return item;
    return null;
  }

  /** The key entries: tag -> exactly what was written. */
  entries() {
    const out = [];
    for (const item of this.items.values()) {
      if (this.isUnblurred(item.kind, item.key)) continue;
      item.forms.forEach((surface) => out.push({ token: this.tokenFor(item, surface), value: surface, kind: item.kind, key: item.key, lang: (item.langs || {})[surface] ?? formLanguage(item.kind, surface), bare: !!(item.bare || []).includes(surface), currency: item.currency }));
    }
    for (const t of this.computed) out.push({ token: `AMOUNT_${t.n}`, value: t.text, kind: 'amount', key: `computed|${t.n}` });
    return out;
  }

  /** Put the fact entries into a Cloak's key, replacing the ones from the last numbering. */
  syncInto(cloak) {
    const mine = new Set(Object.values(KIND_TAG));
    cloak.entries = cloak.entries.filter((e) => !mine.has(e.token.replace(/_\d+.*$/, '')));
    for (const t of [...cloak.byToken.keys()]) if (mine.has(t.replace(/_\d+.*$/, ''))) cloak.byToken.delete(t);
    for (const prefix of mine) cloak.counters.delete(prefix);
    for (const e of this.entries()) cloak.register(e.token, e.value, { match: false });
  }

  /** A person chose to leave this fact visible. Recorded with who and when. */
  unblur(kind, key, by, when = new Date().toISOString()) {
    if (!this.unblurred.some((u) => u.kind === kind && u.key === key)) this.unblurred.push({ kind, key, by, when });
  }
  reblur(kind, key) {
    this.unblurred = this.unblurred.filter((u) => !(u.kind === kind && u.key === key));
  }

  /**
   * A total Cloak works out itself, so the AI never has to add tags up.
   * `parts` are AMOUNT tags (base tags). The total gets its own tag.
   */
  total(parts, { text = null } = {}) {
    let cents = 0;
    let currency = null;
    let first = null;
    // A part written with a minus in front ("-AMOUNT_2") is taken away.
    for (const raw of parts) {
      const sign = raw.startsWith('-') ? -1 : 1;
      const p = raw.replace(/^[-+]/, '');
      const item = [...this.items.values()].find((i) => i.kind === 'amount' && `AMOUNT_${this.numbers.get(`amount|${i.key}`)}` === p.replace(/\..*$/, ''));
      if (!item) throw new Error(`${p} is not an amount in this matter.`);
      if (currency && item.currency !== currency) throw new Error('Amounts in different currencies cannot be combined.');
      currency = item.currency;
      first = first || item.forms[0];
      cents += sign * item.cents;
    }
    const n = this.numbers.size ? [...this.numbers.keys()].filter((k) => k.startsWith('amount|')).length + this.computed.length + 1 : 1;
    const shown = text || formatLike(first, cents, currency);
    this.computed.push({ n, parts: parts.map((p) => p.replace(/\..*$/, '')), cents, currency, text: shown });
    return `AMOUNT_${n}`;
  }

  /** What a review screen shows, with counts taken from the files' tag counts. */
  list(tagCounts = new Map()) {
    const rows = [];
    for (const item of this.items.values()) {
      const forms = item.forms.map((surface) => {
        const token = this.tokenFor(item, surface);
        return { token, surface, count: tagCounts.get(token) || 0 };
      });
      rows.push({ kind: item.kind, key: item.key, tag: `${KIND_TAG[item.kind]}_${this.numbers.get(`${item.kind}|${item.key}`)}`, precision: item.precision, forms, unblurred: this.isUnblurred(item.kind, item.key), count: forms.reduce((n, f) => n + f.count, 0) });
    }
    return rows;
  }

  /** Dates in time order with the gap in days from the one before. No real dates in it. */
  dateTable() {
    const days = [...this.items.values()].filter((i) => i.kind === 'date' && !this.isUnblurred('date', i.key)).sort((a, b) => this.numbers.get(`date|${a.key}`) - this.numbers.get(`date|${b.key}`));
    let prev = null;
    return days.map((d) => {
      const tag = `DATE_${this.numbers.get(`date|${d.key}`)}`;
      const exact = d.precision === 'day';
      const row = { tag, precision: d.precision, gap_days: null, note: '' };
      if (d.precision === 'range') row.note = 'a range of days: the gap is counted from the first day';
      else if (d.precision === 'dm') row.note = 'year not stated; cannot be placed in time';
      else if (d.precision === 'month') row.note = 'month only: the day is not stated';
      else if (d.precision === 'year') row.note = 'year only';
      if (d.precision !== 'dm') {
        if (prev) row.gap_days = Math.round(d.sort - prev.sort);
        if (prev && (!exact || prev.precision !== 'day')) row.note = row.note || 'approximate: one of the two dates is not a full date';
        prev = d;
      }
      return row;
    });
  }

  /** Amount relations with no real figures: which is larger, which is the sum of which. */
  amountTable() {
    const list = [...this.items.values()].filter((i) => i.kind === 'amount' && !this.isUnblurred('amount', i.key)).map((i) => ({ tag: `AMOUNT_${this.numbers.get(`amount|${i.key}`)}`, cents: i.cents, currency: i.currency, rounded: i.rounded.length > 0 && i.rounded.length === i.forms.length }));
    const byCurrency = new Map();
    for (const a of list) byCurrency.set(a.currency, [...(byCurrency.get(a.currency) || []), a]);
    const out = { ranking: [], sums: [], notes: [] };
    for (const [currency, group] of byCurrency) {
      const sorted = group.slice().sort((a, b) => b.cents - a.cents);
      out.ranking.push({ currency_group: byCurrency.size > 1 ? currency : null, largest_to_smallest: sorted.map((a) => a.tag), equal_to_each_other: [] });
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) for (let k = 0; k < group.length; k++) {
        if (k === i || k === j) continue;
        if (group[i].cents + group[j].cents === group[k].cents && !group[i].rounded && !group[j].rounded && !group[k].rounded) out.sums.push(`${group[i].tag} + ${group[j].tag} = ${group[k].tag} (so ${group[k].tag} − ${group[i].tag} = ${group[j].tag})`);
      }
    }
    for (const t of this.computed) out.sums.push(`${t.parts.map((p, i) => (p.startsWith('-') ? ` - ${p.slice(1)}` : `${i ? ' + ' : ''}${p}`)).join('')} = AMOUNT_${t.n} (worked out by Cloak)`);
    return out;
  }

  state() {
    return { level: this.level, percentages: this.percentages, items: [...this.items], unblurred: this.unblurred, computed: this.computed, numbers: [...this.numbers], datesVersion: this.datesVersion, order: this.order };
  }

  static fromState(s) {
    const f = new Facts({ level: s.level, percentages: s.percentages });
    f.items = new Map(s.items);
    f.unblurred = s.unblurred || [];
    f.computed = s.computed || [];
    f.numbers = new Map(s.numbers);
    f.datesVersion = s.datesVersion || 0;
    f.order = s.order || 0;
    return f;
  }
}

/** A total written the way the first amount was written: RM60,000.00 -> RM540,000.00; RM 600,000 -> RM 540,000. */
function formatLike(surface, cents, currency) {
  const m = /^(\D*?)(\s?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/.exec(surface || '');
  const bare = m && !m[1];
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents) / 100;
  if (!m || bare) return `${sign}${currency === 'MYR' ? 'RM' : currency} ${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const decimals = m[4] ? m[4].length - 1 : 0;
  const number = abs.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: m[3].includes(',') });
  return `${sign}${m[1]}${m[2]}${number}`;
}

const precisionRank = (i) => ({ year: 0, month: 1, day: 2, range: 2, dm: 3 }[i.precision] ?? 2);

/**
 * The key sweep for facts. Reads a cloaked text again and looks for any fact
 * the matter holds, written in ANY format: a date, amount or reference whose
 * meaning is in the key. Returns [{ kind, text, start }].
 */
export function sweepFacts(facts, cloakedText) {
  const hits = [];
  const probe = new Facts({ level: 'strict', percentages: facts.percentages });
  for (const part of probe.segments(cloakedText)) {
    if (part.token) continue;
    for (const f of probe.find(part.text)) {
      const item = facts.items.get(`${f.kind}|${f.key}`);
      const approx = f.kind === 'amount' && f.rounded && [...facts.items.values()].some((i) => i.kind === 'amount' && i.currency === f.currency && Math.abs(i.cents - f.cents) * 2 <= f.step);
      if (item && !facts.isUnblurred(f.kind, f.key)) hits.push({ kind: f.kind, text: f.text });
      else if (approx) hits.push({ kind: f.kind, text: f.text, approximate: true });
    }
  }
  return hits;
}
