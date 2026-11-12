// The matter engine: finds confidential details across a whole folder and
// replaces them with {{TAGS}}, using one shared name map (the existing Cloak
// class) so the same real value gets the same tag in every file.
//
// Order of work, per the firm's rules:
//   1. pattern rules  - NRIC, passport, phone, email, bank account, case
//                       number, land title, vehicle plate, address
//   2. key search     - everything already in the matter's name map
//   3. name rules     - people and companies (rules and word lists, no AI)
//
// Tags keep the website's format. A person is one number; the ending says
// which form of the name appeared, so a restored draft reads as written:
//   {{PERSON_1}} full name   {{PERSON_1.FIRST}}   {{PERSON_1.SURNAME}}
//   {{PERSON_1.ALT2}} another spelling of the full name

import { createRequire } from 'node:module';
import { CHINESE_SURNAMES, AMBIGUOUS, NAME_WORDS, GENERIC_PARTS, GENERIC_TITLES, HONOURS, NOT_NAMES } from './names.js';

const require = createRequire(import.meta.url);
const { Cloak, findSuspects, isCommonWord, TOKEN_RE, DETECTORS } = require('../public/cloak.js');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const alt = (list) => list.slice().sort((a, b) => b.length - a.length).map((t) => escapeRe(t).replace(/\\?'|’/g, "['’]?").replace(/ /g, '\\s+')).join('|');

// A capitalised or ALL-CAPS word, as found in names.
const W = String.raw`\p{Lu}[\p{L}'’-]*`;
const PARTICLE = String.raw`(?:bin|binti|bt\.?|bte\.?|b\.|ibni|a\/l|a\/p|s\/o|d\/o|anak|BIN|BINTI|BT\.?|BTE\.?|IBNI|A\/L|A\/P|S\/O|D\/O|ANAK)`;
const PARTICLE_WORD = /^(?:bin|binti|bt\.?|bte\.?|b\.|ibni|a\/l|a\/p|s\/o|d\/o|anak|al|ap)$/i;
const TITLE_RE = alt([...GENERIC_TITLES, ...HONOURS]);
const HONOUR_RE = alt(HONOURS);

const isStop = (w) => {
  const k = w.toLowerCase().replace(/['’]s$/, '').replace(/\.$/, '');
  return isCommonWord(k) || NOT_NAMES.has(k);
};
const isNameWord = (w) => NAME_WORDS.has(w.toLowerCase().replace(/\.$/, ''));

// -------------------------------------------------- things that are kept

// Dates, money and legal provisions stay readable unless switched on. They
// are lifted out before any detector runs so that "12-10-2024" is never taken
// for a case number or "Order 14" for a plate.
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|Januari|Februari|Mac|Mei|Julai|Ogos|Oktober|Disember';
const KEEP = [
  { type: 'DATE', option: 'dates', re: new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th|hb)?\s+(?:${MONTHS})\.?,?\s+\d{4}\b|\b(?:${MONTHS})\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b|(?<![\w\/-])(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:19|20)\d{2}(?![\w\/-])|(?<![\w\/-])(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\w\/-])`, 'gi') },
  { type: 'AMOUNT', option: 'amounts', re: /(?:RM|MYR|S\$|SGD|US\$|USD|Ringgit Malaysia)\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?(?:million|juta|ribu|thousand|billion|k|m)\b)?/gi },
  { type: 'PROVISION', option: 'provisions', re: /\b(?:[Ss]ections?|[Ss]eksyen|[Ss]\.|ss\.|[Oo]rder|[Aa]turan|[Rr]ules?|[Kk]aedah|[Aa]rticles?|[Pp]erkara|[Pp]aragraphs?|[Pp]erenggan|[Pp]ara\.?|[Cc]lauses?|[Kk]lausa|[Ss]chedule|[Jj]adual|[Rr]egulations?|[Pp]eraturan|[Ff]orm|[Bb]orang)\s+\d+[A-Z]{0,2}(?:\(\w{1,4}\))*(?:\s+(?:[Rr]ule|[Rr]\.|[Kk]aedah)\s+\d+[A-Z]?(?:\(\w{1,4}\))*)?/g },
  { type: 'PROVISION', option: 'provisions', re: new RegExp(String.raw`\b(?:${W}\s+){1,6}(?:Act|Ordinance|Enactment|Code|Rules)\s+(?:19|20)\d{2}\b`, 'gu') },
  { type: 'PROVISION', option: 'provisions', re: new RegExp(String.raw`\b(?:Akta|Ordinan|Enakmen|Kanun|Kaedah-Kaedah)(?:\s+(?:${W}|dan|dan\s+${W})){1,6}\s+(?:19|20)\d{2}\b`, 'gu') },
];

// ------------------------------------------------------- pattern rules

const fromOld = (type) => DETECTORS.filter((d) => d.type === type);
const STATES = 'Selangor|Johor|Perak|Kedah|Kelantan|Terengganu|Pahang|Negeri Sembilan|Melaka|Malacca|Perlis|Pulau Pinang|Penang|Sabah|Sarawak|Kuala Lumpur|Putrajaya|Labuan|Wilayah Persekutuan(?: Kuala Lumpur| Putrajaya| Labuan)?|W\\.?P\\.?(?: Kuala Lumpur| Putrajaya| Labuan)?|Selangor Darul Ehsan|Johor Darul Ta.?zim|Perak Darul Ridzuan|Kedah Darul Aman|Pahang Darul Makmur|Malaysia';
const ADDRESS_WORD = /\b(?:Jalan|Jln|Lorong|Lrg|Taman|Tmn|Persiaran|Lebuh|Lebuhraya|Kampung|Kg|Bandar|Seksyen|Section|Desa|Bukit|Pusat|Wisma|Menara|Plaza|Kompleks|Bangunan|Tingkat|Level|Floor|Aras|Blok|Block|Unit|Suite|Lot|No|Off|Batu|Medan|Changkat|Pangsapuri|Apartment|Kondominium|Condominium|Residensi|Residence|Tower|Flat|Rumah|Pekan|Simpang|Solok|Lengkok|Lingkaran|Dataran|Laman|Vista|Heights|Park|Garden|Gardens|Avenue|Road|Street|Lane|Drive|Peti Surat|P\.?O\.? Box)\b\.?/i;

/** Postal addresses: found by postcode + town, then walked back to the start. */
function findAddresses(text) {
  const spans = [];
  const anchor = new RegExp(String.raw`\b\d{5}\s+(?!(?:Tel|Fax|Email|Emel|Phone|HP)\b)\p{Lu}\p{L}*(?:[ \t]+(?!(?:Tel|Fax|Email|Emel|Phone|HP)\b)\p{Lu}\p{L}*){0,3}(?:\s*,\s*(?:${STATES}))*`, 'gu');
  for (const m of text.matchAll(anchor)) {
    // Walk back over up to six comma- or line-separated pieces that look
    // like part of an address ("No. 12", "Jalan Ampang", "Tingkat 3").
    let start = m.index;
    let pieces = 0;
    while (pieces < 6) {
      const before = text.slice(Math.max(0, start - 90), start);
      const piece = /(?:^|[,\n])([^,\n]{1,80})[,\n]\s*$/.exec(before);
      if (!piece) break;
      const body = piece[1].trim();
      const addressy = ADDRESS_WORD.test(body) || /^[A-Z]?-?\d+[A-Z]?(?:[-/]\d+[A-Z]?)*$/.test(body) || /^\d+[A-Z]?\s/.test(body);
      if (!addressy) break;
      // "…yang beralamat di No. 12" : keep only the part from the address word.
      const cut = /\b(?:at|di|of|alamat|address(?:ed)?|beralamat di|residing at|located at|situated at|:)\s+(?=\S)/gi;
      let from = 0;
      for (const c of body.matchAll(cut)) from = c.index + c[0].length;
      start = start - before.length + before.lastIndexOf(piece[1]) + piece[1].indexOf(body) + from;
      pieces++;
      if (from > 0) break;
    }
    if (pieces > 0) spans.push({ type: 'ADDRESS', start, end: m.index + m[0].length });
  }
  // Streets mentioned without a postcode: "at Jalan Tun Razak".
  const street = new RegExp(String.raw`\b(?:Jalan|Jln\.?|Lorong|Lrg\.?|Persiaran|Lebuh|Lebuhraya|Taman|Tmn\.?|Kampung|Kg\.?)\s+${W}(?:\s+${W}){0,3}(?:\s+\d+[A-Z]?(?:\/\d+[A-Z]?)?)?`, 'gu');
  for (const m of text.matchAll(street)) spans.push({ type: 'ADDRESS', start: m.index, end: m.index + m[0].length });
  return spans;
}

const LAND_TAIL = String.raw`(?:\s*,?\s*(?:Lot|PT|Plot)\s*(?:No\.?\s*)?\d[\w\/-]*)?(?:\s*,?\s*(?:Seksyen|Section)\s*\d+[A-Z]?)?(?:\s*,?\s*(?:Mukim|Bandar|Pekan|Daerah|District\s+of|Town\s+of|Tempat|Locality\s+of)\s+(?:of\s+)?\p{Lu}[\p{L}]*(?:\s+\p{Lu}[\p{L}]*){0,2})*`;
const PATTERNS = [
  { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Land titles: Geran 12345, GM 678, HS(D) 12345, PN 4321, Lot 1234 Mukim X.
  { type: 'LAND', re: new RegExp(String.raw`\b(?:Geran(?:\s+Mukim)?|GRN|GM|GN|PN|PM|H\.?S\.?\s?\(?[DM]\)?|Pajakan\s+(?:Negeri|Mukim)|Hakmilik(?:\s+Sementara)?(?:\s+(?:Daerah|Mukim))?|Title)\s*(?:No\.?|Nombor)?\s*:?\s*\d[\d\/-]*${LAND_TAIL}`, 'gu') },
  { type: 'LAND', re: new RegExp(String.raw`\b(?:Lot|PT|Plot)\s*(?:No\.?\s*)?\d[\w\/-]*(?:\s*,?\s*(?:Seksyen|Section)\s*\d+[A-Z]?)?\s*,?\s*(?:Mukim|Bandar|Pekan|Daerah)\s+(?:of\s+)?\p{Lu}[\p{L}]*(?:\s+\p{Lu}[\p{L}]*){0,2}`, 'gu') },
  // Court case numbers, new and old styles.
  ...fromOld('CASE_NO').map((d) => ({ type: 'CASE', re: d.re })),
  { type: 'CASE', re: /\b(?:[A-Z]{1,2}-)?[A-Z]?\d{2}[A-Za-z()]{2,10}-\d{1,6}-(?:\d{1,2}\/)?\d{4}\b/g },
  { type: 'CASE', re: /\b[A-Z]{1,2}-\d{2}[A-Za-z()]{0,10}-\d{1,6}-(?:\d{1,2}\/)?\d{4}\b/g },
  // Bank accounts: a label or a bank's name, then the number.
  { type: 'ACCOUNT', re: /(?<=\b(?:account|acc|acct|a\/c|akaun|akaun bank|bank account)\s*(?:no\.?|number|nombor|num\.?|#)?\s*[:.]?\s*)\d(?:[\d -]{5,20})\d\b/gi },
  { type: 'ACCOUNT', re: /(?<=\b(?:Maybank|CIMB|Public Bank|RHB|Hong Leong|AmBank|Bank Islam|Bank Rakyat|BSN|Affin|Alliance|OCBC|UOB|HSBC|Standard Chartered|Bank Muamalat|Agrobank)(?: Bank| Berhad| Islamic)*\s*(?:account|akaun|a\/c)?\s*(?:no\.?)?\s*[:.]?\s*)\d(?:[\d -]{6,20})\d\b/gi },
  ...fromOld('CARD').map((d) => ({ type: 'ACCOUNT', re: d.re })),
  // MyKad with or without separators, Singapore NRIC.
  { type: 'NRIC', re: /\b\d{6}[-\s]\d{2}[-\s]\d{4}\b/g },
  ...fromOld('SG_NRIC').map((d) => ({ type: 'NRIC', re: d.re })),
  ...DETECTORS.filter((d) => d.type === 'MY_IC' && d.valid).map((d) => ({ type: 'NRIC', re: d.re, valid: d.valid })),
  { type: 'PASSPORT', re: /(?<=\b(?:passport|pasport)\s*(?:no\.?|number|nombor)?\s*[:.]?\s*)[A-Z]{1,2}\d{6,9}[A-Z]?\b/gi },
  ...fromOld('PASSPORT').map((d) => ({ type: 'PASSPORT', re: d.re })),
  // Vehicle plates: labelled, or the usual three letters + digits.
  ...fromOld('VEHICLE').map((d) => ({ type: 'VEHICLE', re: d.re })),
  { type: 'VEHICLE', re: /\b(?!(?:THE|AND|FOR|NOT|BUT|YOU|ARE|WAS|HAS|HAD|ALL|ANY|CAN|MAY|ITS|OUR|HIS|HER|WHO|ACT|SEC|ROC|ROB|SSM|PDF|USD|SGD|MYR|EUR|GBP|GST|SST|EPF|TNB|KWSP|PTD|PTB|PTG|HSD|HSM|GRN|LOT|NOS|REF|TEL|FAX|BIL|JLN|TMN)\b)[A-Z]{3}\s?\d{3,4}\b(?!\s*[\/-]\d)/g },
  ...fromOld('PHONE').slice(0, 2).map((d) => ({ type: 'PHONE', re: d.re })),
];

// The same number written differently is the same thing.
const idKey = {
  NRIC: (v) => v.replace(/\W/g, '').toUpperCase(),
  PASSPORT: (v) => v.replace(/\W/g, '').toUpperCase(),
  ACCOUNT: (v) => v.replace(/\D/g, ''),
  PHONE: (v) => v.replace(/\D/g, '').replace(/^60/, '0').replace(/^65/, ''),
  EMAIL: (v) => v.toLowerCase(),
  CASE: (v) => v.replace(/\s/g, '').toUpperCase(),
  VEHICLE: (v) => v.replace(/\s/g, '').toUpperCase(),
  LAND: (v) => v.toLowerCase().replace(/\bno\.?\b|nombor|[\s.,:]/g, ''),
  ADDRESS: (v) => v.toLowerCase().replace(/\bjln\b/g, 'jalan').replace(/\btmn\b/g, 'taman').replace(/\bkg\b/g, 'kampung').replace(/\blrg\b/g, 'lorong').replace(/\bno\b\.?/g, '').replace(/[^a-z0-9]/g, ''),
};

// ----------------------------------------------------------- name keys

const MOHD = /^(?:mohd|mohamad|mohamed|mohammad|mohammed|muhammad|muhamad|muhammed|md|mohd\.|md\.)$/;
const titleStrip = new RegExp(`^(?:(?:${TITLE_RE})\\.?\\s+)+`, 'iu');

function nameWords(name) {
  return norm(name).replace(titleStrip, '').split(/[\s]+/).filter(Boolean);
}

/** Key that is equal for the same person written in different ways. */
export function personKey(name) {
  return nameWords(name)
    .filter((w) => !PARTICLE_WORD.test(w))
    .map((w) => w.toLowerCase().replace(/['’]s$/, '').replace(/[.'’]/g, '').replace(/-/g, ' '))
    .filter(Boolean)
    .map((w) => (MOHD.test(w) ? 'mohd' : w === 'abd' ? 'abdul' : w))
    .join(' ');
}

const CO_SUFFIX_WORDS = /\b(?:sdn\.?|bhd\.?|berhad|pte\.?|ltd\.?|limited|plt|llp|inc\.?|corporation|corp\.?|m\/s|messrs\.?|tetuan)(?=\s|$|,)/gi;
export function companyKey(name) {
  return norm(name.toLowerCase().replace(/\((?:m|malaysia|asia)\)/g, ' ').replace(CO_SUFFIX_WORDS, ' ').replace(/&/g, ' and ').replace(/\bdan\b/g, 'and').replace(/[^\p{L}\p{N} ]/gu, ' '));
}

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

// ------------------------------------------------- finding candidates

const CO_END = String.raw`(?:Sdn\.?\s*Bhd\.?|SDN\.?\s*BHD\.?|Berhad|BERHAD|Bhd\.?|BHD\.?|PLT|Pte\.?\s*Ltd\.?|PTE\.?\s*LTD\.?|Ltd\.?|LTD\.?|Limited|LIMITED|LLP|Inc\.?|Enterprises?|ENTERPRISES?|Trading|TRADING|Holdings|HOLDINGS|Industries|INDUSTRIES|Realty|Ventures|&\s*Co\.?|&\s*Associates|&\s*Partners|&\s*Rakan-Rakan|dan\s+Rakan-Rakan)`;
const CO_WORD = String.raw`(?:${W}|\d+[A-Z]*|&|\((?:M|Malaysia|MALAYSIA|Asia|ASIA|KL|Sabah|Sarawak)\))`;
const COMPANY_RES = [
  new RegExp(String.raw`\b(?:Messrs\.?|Tetuan|M\/s) +(${W}(?:(?: *, *| +)(?:${W}|&|and|dan))*(?: +Co\.?)?)`, 'gu'),
  new RegExp(String.raw`(${W}(?: *, *${W}| +${W}){0,5} *(?:&|and|dan) *(?:Partners|PARTNERS|Co\.?|CO\.?|Associates|ASSOCIATES|Rakan-Rakan|RAKAN-RAKAN|Company|COMPANY))(?![\p{L}])`, 'gu'),
  new RegExp(String.raw`(${W}(?: +${CO_WORD}){0,7}) +(${CO_END})(?![\p{L}])`, 'gu'),
  new RegExp(String.raw`\b((?:Syarikat|Perusahaan|Klinik|Restoran|Kedai|Bengkel|Koperasi|Persatuan|Yayasan|Kilang|Pasaraya) +${W}(?: +${W}){0,4})`, 'gu'),
  new RegExp(String.raw`\b((?:${W} +){1,3}Bank(?: +(?:Berhad|Bhd\.?|Islamic|Malaysia|\(M\)))*|Bank +(?!Negara)${W}(?: +${W}){0,2}|Maybank|CIMB|AmBank|Agrobank|HSBC|OCBC|UOB)\b`, 'gu'),
];
const LEAD_DROP = /^(?:the|a|an|and|dan|between|antara|by|oleh|of|to|kepada|from|daripada|with|dengan|against|in|at|di|for|untuk|as|that|bahawa|dear|our|your|its|said|plaintiff|plaintif|defendant|defendan|messrs\.?|tetuan|m\/s|syarikat)$/i;

function tidyCompany(raw) {
  let words = raw.split(/[ \t]+/);
  // "Director of Maju Jaya Sdn Bhd": drop a leading role and its connector.
  for (let i = words.length - 2; i > 0; i--) {
    if (/^(?:of|and|dan|&)$/i.test(words[i]) && words.slice(0, i).every((w) => isStop(w) || LEAD_DROP.test(w))) { words = words.slice(i + 1); break; }
  }
  while (words.length > 1 && (LEAD_DROP.test(words[0]) || /^(?:and|dan|of|&)$/i.test(words[0]))) words.shift();
  return words.join(' ');
}

const ROLE_ALIAS = /^(?:the\s+)?(?:(?:1st|2nd|3rd|first|second|third|said|pertama|kedua|ketiga)\s+)?(?:plaintiff|plaintif|defendant|defendan|claimant|respondent|responden|appellant|perayu|applicant|pemohon|company|syarikat|bank|vendor|purchaser|pembeli|penjual|landlord|tenant|penyewa|borrower|peminjam|lender|employer|majikan|employee|pekerja|contractor|kontraktor|client|deceased|si mati|property|hartanah|land|tanah|premises|premis|agreement|perjanjian|vehicle|kenderaan|deponent|witness|saksi|director|pengarah|owner|pemilik|guarantor|penjamin|developer|pemaju|parties|party|pihak)s?$/i;

// A capitalised first word of a sentence that is a verb or adverb, not a name.
const VERBISH = /(?:ed|ing|ly|tion|ment|ence|ance|ity|ous|ive|ise|ize|ify|ate|ct|pt)$|^(?:Call|Contact|Email|Phone|Meet|Met|Saw|Told|Asked|Ask|Spoke|Speak|Wrote|Write|Sent|Send|Paid|Pay|Per|Via|Note|See|Cc|Attn|Attention|Present|Signed|Witnessed|Between|Both|Then|When|Where|After|Before|Also|Only)$/i;

/** Collect people and companies named in one text. Returns [{kind, text}]. */
export function findNames(text) {
  const found = [];
  const add = (kind, value, why) => { value = norm(value).replace(/['’]s$/i, ''); if (value.length > 1) found.push({ kind, text: value, why }); };

  // Companies first, so "Tan & Lim Sdn Bhd" is not read as two people.
  let rest = text;
  for (const re of COMPANY_RES) {
    rest = rest.replace(re, (m, name, end) => {
      const full = tidyCompany(typeof end === 'string' ? `${name} ${end}` : name);
      const core = companyKey(full);
      if (!core || core.split(' ').every((w) => isStop(w))) return m;
      add('COMPANY', full, 'company');
      return m.replace(/[^\n]/g, ' ');
    });
  }

  const trim = (input) => {
    const out = input.slice();
    while (out.length > 2 && !isNameWord(out[0]) && !GENERIC_PARTS.has(out[0].toLowerCase()) && isNameWord(out[1]) && !AMBIGUOUS.has(out[1].toLowerCase()) && /^\p{Lu}\p{Ll}/u.test(out[0]) && VERBISH.test(out[0])) out.shift();
    while (out.length && (isStop(out[0]) || PARTICLE_WORD.test(out[0])) && !isNameWord(out[0])) out.shift();
    while (out.length && (isStop(out[out.length - 1]) || PARTICLE_WORD.test(out[out.length - 1])) && !isNameWord(out[out.length - 1])) out.pop();
    return out;
  };

  // 1. Names with a particle: Ahmad bin Ismail, RAVI A/L MUTHU, Lim Ah Kow @ Ah Kau.
  const particle = new RegExp(String.raw`(?<![\p{L}])(${W}(?: +${W}){0,3}) +${PARTICLE} +(${W}(?: +${W}){0,3})(?: +${PARTICLE} +${W}(?: +${W}){0,2})?`, 'gu');
  rest = rest.replace(particle, (m) => {
    const words = trim(m.split(/\s+/));
    if (words.length < 3 || !words.some((w) => PARTICLE_WORD.test(w))) return m;
    add('PERSON', words.join(' '), 'particle');
    return m.replace(/[^\n]/g, ' ');
  });

  // 2. Names after a title: Dato' Sri Lim, Encik Ahmad, Dr. Kavitha Nair.
  const titled = new RegExp(String.raw`(?<![\p{L}])((?:(?:${TITLE_RE})\.? +)+)(${W}(?: +(?:${W}|${PARTICLE})){0,5})`, 'gu');
  rest = rest.replace(titled, (m, title, name) => {
    const words = trim(name.split(/\s+/));
    if (!words.length) return m;
    add('PERSON', `${norm(title)} ${words.join(' ')}`, 'title');
    return m.replace(/[^\n]/g, ' ');
  });

  // 3. A name right before an ID in brackets: Tan Boon Huat (NRIC No. ...).
  const beforeId = new RegExp(String.raw`(${W}(?: +${W}){1,5}) *\(\s*(?:NRIC|No\.?\s*K\/P|K\/P|I\/?C|MyKad|Passport|Pasport|No\.?\s*Pasport|Company\s+No|No\.?\s*Syarikat)`, 'gu');
  rest = rest.replace(beforeId, (m, name) => {
    const words = trim(name.split(/\s+/));
    if (words.length < 2) return m;
    add('PERSON', words.join(' '), 'next to an ID');
    return m.replace(name, name.replace(/[^\n]/g, ' '));
  });

  // 3b. Party lines in a court heading: "AHMAD BIN ISMAIL ... PLAINTIF".
  const party = new RegExp(String.raw`^[ \t]*(?:\d+\.[ \t]*)?(${W}(?: +(?:${W}|${PARTICLE}|&)){1,7})[ \t]*(?:\([^)\n]*\))?[ \t]*(?:\.{2,}|…+|-{2,}|[ \t]{3,})[ \t]*(?:PLAINTIFF?S?|DEFENDANT?S?|DEFENDAN-DEFENDAN|PLAINTIF-PLAINTIF|APPELLANTS?|PERAYU|RESPONDENTS?|RESPONDEN|APPLICANTS?|PEMOHON|PETITIONERS?|PEMPETISYEN|CLAIMANTS?|PIHAK\s+MENUNTUT|THIRD\s+PARTY|PIHAK\s+KETIGA|INTERVENERS?|PENCELAH)\b`, 'gimu');
  rest = rest.replace(party, (m, name) => {
    const words = trim(name.split(/\s+/));
    if (words.length < 2) return m;
    add('PERSON', words.join(' '), 'party in a court heading');
    return m.replace(name, name.replace(/[^\n]/g, ' '));
  });

  // 3b2. Headings that name a person: "AFFIDAVIT OF RAVI A/L MUTHU".
  const headed = new RegExp(String.raw`(?:AFFIDAVIT OF|AFIDAVIT|WITNESS STATEMENT OF|PERNYATAAN SAKSI|ESTATE OF|HARTA PUSAKA|IN THE MATTER OF|DALAM PERKARA|STATUTORY DECLARATION OF|AKUAN BERKANUN) +(\p{Lu}[\p{Lu}'’-]*(?: +(?:\p{Lu}[\p{Lu}'’-]*|${PARTICLE})){1,6})(?=[ \t]*(?:,|\(|$))`, 'gmu');
  rest = rest.replace(headed, (m, name) => {
    const words = trim(name.split(/\s+/));
    if (words.length < 2 || words.some((w) => isStop(w) && !isNameWord(w) && !PARTICLE_WORD.test(w))) return m;
    add('PERSON', words.join(' '), 'named in a heading');
    return m.replace(name, name.replace(/[^\n]/g, ' '));
  });

  // 3c. Two to four capitalised words after a word that usually comes before
  // a person ("signed by", "oleh", "kepada"), or before one that follows a
  // person ("told", "berkata"). Hidden to be safe; shown in review.
  const cue = new RegExp(String.raw`(?<![\p{L}])(?:by|from|with|to|told|informed|met|called|named|against|between|oleh|kepada|daripada|dengan|bersama|bernama|antara|terhadap) +(${W}(?: +${W}){1,3})(?![\p{L}])`, 'gu');
  const cueAfter = new RegExp(String.raw`(?<![\p{L}])(${W}(?: +${W}){1,3}) +(?:told|said|stated|informed|confirmed|agreed|signed|paid|wrote|replied|denied|admitted|promised|testified|berkata|memberitahu|mengesahkan|bersetuju|menandatangani|membayar|menafikan|mengaku|berjanji)(?![\p{L}])`, 'gu');
  for (const re of [cue, cueAfter]) {
    rest = rest.replace(re, (m, name) => {
      const words = trim(name.split(/\s+/));
      if (words.length < 2 || words.some((w) => isStop(w) && !isNameWord(w)) || words.every((w) => w === w.toUpperCase())) return m;
      add('PERSON', words.join(' '), 'looks like a name from the words around it');
      return m.replace(name, name.replace(/[^\n]/g, ' '));
    });
  }

  // 4. Email headers: From: "Lim Mei Ling" <meiling@example.com>.
  for (const line of rest.matchAll(/^(?:From|To|Cc|Bcc|Daripada|Kepada|Sent by|Reply-To):[ \t]*(.+)$/gim)) {
    for (const piece of line[1].split(/[;,]/)) {
      const name = norm(piece.replace(/<[^>]*>|\S+@\S+|["']/g, ''));
      const words = name.split(' ').filter(Boolean);
      if (words.length >= 2 && words.length <= 6 && words.every((w) => /^\p{Lu}/u.test(w) || PARTICLE_WORD.test(w)) && !words.some((w) => isStop(w) && !isNameWord(w))) add('PERSON', name, 'email header');
    }
  }

  // 5. Runs of capitalised words that contain a known name word.
  for (const line of rest.split(/\n+/)) {
    for (const sentence of line.split(/(?<=[.!?:;])\s+/)) {
      const tokens = [...sentence.matchAll(/[\p{L}][\p{L}'’\/-]*/gu)];
      let run = [];
      let lastEnd = -1;
      const flush = () => {
        const words = trim(run);
        run = [];
        if (words.length < 2 || words.length > 6) return;
        if (words.some((w) => isStop(w) && !isNameWord(w) && !PARTICLE_WORD.test(w))) return;
        const hits = words.filter((w) => isNameWord(w));
        const strong = hits.filter((w) => !AMBIGUOUS.has(w.toLowerCase()));
        const chinese = CHINESE_SURNAMES.has(words[0].toLowerCase()) && words.length <= 4;
        if (strong.length >= 1 || hits.length >= 2 || (chinese && words.length >= 3)) add('PERSON', words.join(' '), 'name list');
      };
      for (const t of tokens) {
        // Only single spaces join a name: a comma, tab or bracket ends it.
        if (run.length && sentence.slice(lastEnd, t.index) !== ' ') flush();
        if (/^\p{Lu}/u.test(t[0])) run.push(t[0].replace(/['’]s$/, '')); else flush();
        lastEnd = t.index + t[0].length;
      }
      flush();
    }
  }
  return found;
}

// ------------------------------------------------------------ the matter

const SENTINEL = (i) => String.fromCodePoint(0xf0000 + i);
const SENTINEL_RE = /[\u{f0000}-\u{ffffd}]/gu;
const HONOUR_MARK = (i) => String.fromCodePoint(0x100000 + i);
const HONOUR_MARK_RE = /([\u{100000}-\u{10fffd}]) (?:(?=(\{\{(PERSON_\d+)[.}]))|)/gu;

export class Matter {
  constructor({ options = {}, key = null } = {}) {
    this.options = { dates: false, amounts: false, provisions: false, ...options };
    this.cloak = key ? Cloak.fromJSON(key) : new Cloak();
    this.people = new Map();     // personKey -> base tag
    this.companies = new Map();  // companyKey -> base tag
    this.ids = new Map();        // "TYPE|key" -> base tag
    this.merges = [];            // variants joined under one tag, for review
    this.ambiguous = [];         // short forms that fit more than one person
    this.kinds = new Map();      // base tag -> how it was found
  }

  /** Register a value under a new ending of an existing tag. */
  variant(base, value, ending) {
    const existing = this.cloak.byValue.get(norm(value).toLowerCase());
    if (existing) return existing;
    let name = `${base}.${ending}`;
    for (let n = 2; this.cloak.byToken.has(name); n++) name = `${base}.${ending}${n}`;
    return this.cloak.register(name, value);
  }

  /** A short form (first name, surname). Noted if it fits two people. */
  shortForm(base, value, ending) {
    if (value.length < 2) return;
    const existing = this.cloak.byValue.get(value.toLowerCase());
    if (existing) {
      const other = existing.split('.')[0];
      if (other !== base && !this.ambiguous.some((a) => a.token === existing && a.also === base)) this.ambiguous.push({ token: existing, also: base });
      return;
    }
    this.variant(base, value, ending);
  }

  addPerson(raw, why = 'name rule') {
    const honour = (new RegExp(`^((?:(?:${HONOUR_RE})\\s+)+)`, 'iu').exec(norm(raw)) || [])[1];
    const words = nameWords(raw);
    const name = words.join(' ');
    const key = personKey(raw);
    if (!key) return null;

    let base = this.people.get(key);
    let reason = 'same name written differently';
    if (!base) {
      // One word ("Encik Ahmad", "Mr Tan"): link to the one person who has it.
      if (!key.includes(' ')) {
        const existing = this.cloak.byValue.get(name.toLowerCase());
        if (existing) return existing.split('.')[0];
        const owners = [...this.people.entries()].filter(([k]) => k.split(' ').includes(key)).map(([, t]) => t);
        if (owners.length === 1) base = owners[0];
        else if (owners.length > 1) { base = owners[0]; this.ambiguous.push({ token: base, also: owners[1], value_is_short_form: true }); }
        reason = 'short form';
      } else {
        // All its words belong to exactly one longer name: "David Wong" for
        // "David Wong Kah Fai".
        const mine = key.split(' ');
        const longer = [...new Set([...this.people.entries()].filter(([k]) => { const theirs = k.split(' '); return theirs.length > mine.length && mine.every((w) => theirs.includes(w)); }).map(([, t]) => t))];
        if (longer.length === 1) { base = longer[0]; reason = 'short form of a longer name'; }
      }
      if (!base && key.includes(' ')) {
        // A near-identical spelling of a known full name.
        for (const [k, t] of this.people) {
          if (k.split(' ').length !== key.split(' ').length) continue;
          const allowed = key.length >= 16 ? 2 : key.length >= 9 ? 1 : 0;
          if (allowed && editDistance(k, key, allowed) <= allowed) { base = t; reason = 'spelling looks like the same person'; break; }
        }
      }
    }

    if (base) {
      if (!this.cloak.byValue.has(name.toLowerCase())) {
        const token = this.variant(base, name, 'ALT');
        this.merges.push({ token, into: base, reason });
        this.people.set(key, base);
        if (key.includes(' ')) this.personParts(base, words);
      }
    } else {
      base = this.cloak.nextToken('PERSON');
      this.cloak.register(base, name);
      this.people.set(key, base);
      this.kinds.set(base, why);
      this.personParts(base, words);
    }
    if (honour) this.titleFor(base, norm(honour));
    return base;
  }

  /** Short forms of a full name: given names, each name word. */
  personParts(base, words) {
    const split = words.findIndex((w) => PARTICLE_WORD.test(w));
    const given = split === -1 ? words : words.slice(0, split);
    if (split > 0 && given.length > 1) this.shortForm(base, given.join(' '), 'GIVEN');
    // Chinese order: surname first, then the given names as a pair.
    if (split === -1 && words.length === 3 && CHINESE_SURNAMES.has(words[0].toLowerCase())) this.shortForm(base, words.slice(1).join(' '), 'GIVEN');
    // "Abdul Rahman", "Nur Aisyah": the pair, not "Abdul" on its own.
    given.forEach((w, i) => {
      if (GENERIC_PARTS.has(w.toLowerCase().replace(/\.$/, '')) && given[i + 1]) this.shortForm(base, `${w} ${given[i + 1]}`, 'GIVEN');
    });
    given.forEach((w, i) => {
      const plain = w.toLowerCase().replace(/\.$/, '');
      if (GENERIC_PARTS.has(plain) || PARTICLE_WORD.test(w)) return;
      if (w.length < 3 && !CHINESE_SURNAMES.has(plain)) return;
      const last = i === given.length - 1 && given.length > 1;
      const chineseSurname = i === 0 && CHINESE_SURNAMES.has(plain);
      this.shortForm(base, w, chineseSurname || last ? 'SURNAME' : i === 0 ? 'FIRST' : 'MIDDLE');
    });
  }

  /** "Dato' Sri" in front of a person is part of who they are. */
  titleFor(base, honour) {
    const have = this.cloak.entries.find((e) => e.token.startsWith(`${base}.TITLE`) && e.value.toLowerCase() === honour.toLowerCase());
    if (have) return have.token;
    let name = `${base}.TITLE`;
    for (let n = 2; this.cloak.byToken.has(name); n++) name = `${base}.TITLE${n}`;
    return this.cloak.register(name, honour, { match: false });
  }

  addCompany(raw) {
    const name = norm(raw).replace(/^(?:Messrs\.?|Tetuan|M\/s)\s+/i, '');
    const key = companyKey(name);
    if (!key) return null;
    let base = this.companies.get(key);
    if (!base) {
      for (const [k, t] of this.companies) {
        const allowed = key.length >= 16 ? 2 : key.length >= 9 ? 1 : 0;
        if (allowed && editDistance(k, key, allowed) <= allowed) { base = t; this.merges.push({ token: null, into: t, reason: 'spelling looks like the same company' }); break; }
      }
    }
    if (base) {
      if (!this.cloak.byValue.has(name.toLowerCase())) {
        const token = this.variant(base, name, 'ALT');
        if (!this.merges.some((m) => m.into === base && m.token === null)) this.merges.push({ token, into: base, reason: 'same company written differently' });
      }
      this.companies.set(key, base);
      return base;
    }
    base = this.cloak.nextToken('COMPANY');
    this.cloak.register(base, name);
    this.companies.set(key, base);
    this.kinds.set(base, 'company rule');
    // The name without "Sdn Bhd": matched as written, e.g. "Maju Jaya".
    const short = norm(name.replace(new RegExp(`[\\s,]+(?:\\((?:M|Malaysia|Asia)\\)\\s*)?${CO_END}\\.?$`, 'u'), '').replace(/\s*\((?:M|Malaysia|Asia)\)\s*$/i, ''));
    if (short && short.length >= 4 && short.toLowerCase() !== name.toLowerCase() && !short.split(' ').every((w) => isStop(w))) this.shortForm(base, short, 'SHORT');
    return base;
  }

  /** An identifier found by a pattern rule. */
  addId(type, raw) {
    const value = norm(raw);
    const key = `${type}|${(idKey[type] || ((v) => v.toLowerCase()))(value)}`;
    const base = this.ids.get(key);
    if (base) return this.variant(base, value, 'ALT');
    const existing = this.cloak.byValue.get(value.toLowerCase());
    if (existing) return existing;
    const token = this.cloak.register(this.cloak.nextToken(type), value);
    this.ids.set(key, token);
    return token;
  }

  /** Lift dates, money and provisions out of the way (or tag them). */
  protect(text) {
    const kept = [];
    let out = text;
    for (const k of KEEP) {
      out = out.replace(k.re, (m) => {
        if (this.options[k.option]) return `{{${this.addId(k.type, m)}}}`;
        kept.push(m);
        return SENTINEL(kept.length - 1);
      });
    }
    return { text: out, restore: (s) => s.replace(SENTINEL_RE, (c) => kept[c.codePointAt(0) - 0xf0000] ?? c) };
  }

  /**
   * Step 1 for one text: learn what is in it. Pattern rules first, then the
   * key (what is already known is blanked out), then the name rules.
   */
  learn(text) {
    const { text: safe } = this.protect(String(text || '').replace(TOKEN_RE, ' '));
    let rest = safe;
    const blank = (start, end) => { rest = rest.slice(0, start) + rest.slice(start, end).replace(/[^\n]/g, ' ') + rest.slice(end); };

    for (const span of findAddresses(rest).sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
      const value = rest.slice(span.start, span.end);
      if (!value.trim() || /^\s*$/.test(value)) continue;
      this.addId('ADDRESS', value.replace(/[,.\s]+$/, ''));
      blank(span.start, span.end);
    }
    for (const p of PATTERNS) {
      for (const m of [...rest.matchAll(p.re)]) {
        if (p.valid && !p.valid(m[0])) continue;
        if (!m[0].trim()) continue;
        this.addId(p.type, m[0]);
        blank(m.index, m.index + m[0].length);
      }
    }
    // Key search: hide what the map already knows, so the name rules only
    // look at what is left.
    rest = this.cloak.cloak(rest).replace(TOKEN_RE, (m) => ' '.repeat(m.length));
    return findNames(rest);
  }

  /** Register candidates from the whole folder: longest names first. */
  register(candidates) {
    const caps = (t) => (t === t.toUpperCase() ? 1 : 0);
    const order = candidates.slice().sort((a, b) => nameWords(b.text).length - nameWords(a.text).length || caps(a.text) - caps(b.text) || b.text.length - a.text.length);
    for (const c of order) {
      if (c.kind === 'COMPANY') this.addCompany(c.text); else this.addPerson(c.text, c.why);
    }
    this.linkCommonFirstNames();
  }

  /**
   * "Siti" for Siti Nurhaliza: a common first word is only used as a short
   * form when exactly one person in the matter starts with it.
   */
  linkCommonFirstNames() {
    const firsts = new Map();
    for (const e of this.cloak.entries) {
      if (!/^PERSON_\d+(?:\.ALT\d*)?$/.test(e.token)) continue;
      const first = e.value.split(' ')[0];
      const plain = first.toLowerCase().replace(/\.$/, '');
      if (first.length < 3 || !GENERIC_PARTS.has(plain) || MOHD.test(plain)) continue;
      if (!firsts.has(plain)) firsts.set(plain, { word: first, bases: new Set() });
      firsts.get(plain).bases.add(e.token.split('.')[0]);
    }
    for (const { word, bases } of firsts.values()) if (bases.size === 1) this.shortForm([...bases][0], word, 'FIRST');
  }

  /** Short names defined in brackets: Maju Jaya Sdn Bhd ("MJSB"). */
  learnDefinitions(text) {
    const cloaked = this.cloak.cloak(this.protect(String(text || '')).text);
    const re = /\{\{((?:PERSON|COMPANY)_\d+)[^}]*\}\}\s*(?:\([^()]{0,40}\)\s*)?\(\s*(?:hereinafter\s+(?:referred\s+to\s+as|called)\s+|selepas\s+ini\s+(?:dirujuk|disebut)\s+sebagai\s+|collectively\s+)?["“'‘]([^"”'’]{2,40})["”'’]\s*\)/gi;
    for (const m of cloaked.matchAll(re)) {
      const alias = norm(m[2]);
      if (ROLE_ALIAS.test(alias) || /\{\{/.test(alias) || alias.split(' ').every((w) => isStop(w))) continue;
      this.shortForm(m[1], alias, 'ALIAS');
    }
  }

  /** Step 2 for one text: replace everything known with tags. */
  apply(text) {
    const { text: safe, restore } = this.protect(String(text || ''));
    // Honours are lifted out before the key search, so "Tan Sri" is never
    // read as the surname Tan.
    const honours = [];
    const lifted = safe.replace(new RegExp(`(?<![\\p{L}])(?<!\\b(?:Jalan|Jln\\.?|Lorong|Persiaran|Lebuh|Lebuhraya|Taman|Bandar|Kampung|Bukit|Menara|Wisma|Bangunan|Stadium|Hospital|Sekolah|Universiti|Dataran|Medan)\\s+)((?:(?:${HONOUR_RE})\\.?[ \\t]+)+)(?=\\p{Lu})`, 'gu'), (m) => {
      honours.push(m);
      return `${HONOUR_MARK(honours.length - 1)} `;
    });
    let out = this.cloak.cloak(lifted);
    // An honour in front of a person's tag becomes part of the tag;
    // anywhere else it goes back as it was.
    out = out.replace(HONOUR_MARK_RE, (m, c, after, base) => (base ? `{{${this.titleFor(base, norm(honours[c.codePointAt(0) - 0x100000]))}}} ` : honours[c.codePointAt(0) - 0x100000]));
    return restore(out);
  }

  /** Words in cloaked text that still look like names. */
  unsure(cloaked, safeWords = []) {
    const safe = new Set(safeWords.map((w) => w.toLowerCase()));
    const { text } = this.protect(cloaked);
    const plain = text.replace(SENTINEL_RE, ' ').replace(TOKEN_RE, ' | ');
    const caps = new Map();
    for (const m of plain.matchAll(/(?<![\p{L}])\p{Lu}{2,}(?:[ ]\p{Lu}{2,}){1,4}(?![\p{L}])/gu)) {
      const words = m[0].split(' ').filter((w) => !isStop(w));
      if (words.length >= 2) caps.set(words.join(' '), (caps.get(words.join(' ')) || 0) + 1);
    }
    return [...findSuspects(text.replace(SENTINEL_RE, ' ')), ...[...caps].map(([t, count]) => ({ text: t, count }))]
      .map((s) => ({ ...s, text: s.text.split(/\s+/).filter((w) => !NOT_NAMES.has(w.toLowerCase())).join(' ') }))
      .filter((s) => s.text.length > 1 && !safe.has(s.text.toLowerCase()) && !s.text.split(' ').every((w) => isStop(w)));
  }

  /** The key: tag -> real value. Stays on this machine. */
  key() {
    return this.cloak.toJSON();
  }
}
