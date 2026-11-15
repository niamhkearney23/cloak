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

import { Facts } from './facts.js';
import { createRequire } from 'node:module';
import { CHINESE_SURNAMES, AMBIGUOUS, NAME_WORDS, GENERIC_PARTS, GENERIC_TITLES, HONOURS, NOT_NAMES, KIN_TITLES, BIRTH_ORDER, ORDINARY, AFTER_NAME, DETERMINERS, LABEL_WORDS, ROLE_NOUNS, PERSON_HEADERS } from './names.js';

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
// Informal titles (Kak, Pak, Uncle, Ah...): titles too, with extra care (names.js).
const KIN_RE = alt(KIN_TITLES);
const ALL_TITLES_RE = alt([...GENERIC_TITLES, ...HONOURS, ...KIN_TITLES]);
const KIN_START = new RegExp(`^(?:${KIN_RE})(?![\\p{L}])`, 'u');
// One-word titles. Not the words of two-word titles: "Tan" (Tan Sri) and "Toh" (Toh Puan) are common surnames.
const TITLE_WORDS = new Set([...GENERIC_TITLES, ...HONOURS, ...KIN_TITLES].filter((t) => !/\s/.test(t)).map((t) => t.toLowerCase().replace(/['’]/g, '')).filter((t) => t !== 'toh'));

const isStop = (w) => {
  const k = w.toLowerCase().replace(/['’]s$/, '').replace(/\.$/, '');
  return isCommonWord(k) || NOT_NAMES.has(k);
};
const isNameWord = (w) => NAME_WORDS.has(w.toLowerCase().replace(/\.$/, ''));
const plainWord = (w) => w.toLowerCase().replace(/['’]s$/, '').replace(/[.'’]+$/, '');
/** A word that can be a name on its own: capitalised or ALL CAPS, not a common or document word, not a title. */
const nameLike = (w) => /^\p{Lu}[\p{L}'’-]*$/u.test(w) && plainWord(w).length >= 2 && !TITLE_WORDS.has(plainWord(w)) && (!isStop(w) || isNameWord(w));
/**
 * The same, where the place itself says a name is there (a chat label, a
 * signature line, after a title): ordinary words that are also names
 * ("May", "Dan", "Grace") are accepted too.
 */
const strongNameLike = (w) => nameLike(w) || (/^\p{Lu}[\p{L}'’-]*$/u.test(w) && ORDINARY.has(plainWord(w)) && !TITLE_WORDS.has(plainWord(w)));
// Case-insensitive pattern for a fixed phrase, without making the name parts case-insensitive.
const ci = (s) => s.replace(/[A-Za-z]/g, (c) => `[${c.toUpperCase()}${c.toLowerCase()}]`).replace(/ /g, '\\s+');

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

// ---------------------------------------------- patterns that start with a look-behind
//
// "(?<=label)number" asks, at every character of a long text, whether a label
// stands just before it, which is slow (minutes on a big spreadsheet). The same
// pattern written forwards, "(label)(number)", finds the same things at once.
// This turns the one into the other.
function toForward(re) {
  const src = re.source;
  if (!src.startsWith('(?<=')) return re;
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { i++; continue; }
    if (inClass) { if (c === ']') inClass = false; continue; }
    if (c === '[') { inClass = true; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) {
      const rewritten = new RegExp(`(?<__pre>${src.slice(4, i)})(?<__val>${src.slice(i + 1)})`, re.flags);
      return Object.assign(rewritten, { forward: true });
    }
  }
  return re;
}
const forwardOf = (d) => { const re = toForward(d.re); return re.forward ? { ...d, re, forward: true } : d; };
const FORWARD_DETECTORS = DETECTORS.map(forwardOf);

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
      // Words before a dash, a closing bracket or a colon are not the address:
      // "Aminah binti Yusof (mother of the Plaintiff) - Taman Desa Jaya".
      let base0 = 0;
      for (const sep of body.matchAll(/\)\s*(?:[-\u2013\u2014]\s+)?|\s[-\u2013\u2014]\s+|:\s*/g)) base0 = sep.index + sep[0].length;
      const sub = body.slice(base0);
      // "…yang beralamat di No. 12" : keep only the part from the address word, when what follows really is an address.
      const cut = /\b(?:at|di|of|alamat|address(?:ed)?|beralamat di|residing at|located at|situated at)\s+(?=\S)/gi;
      const ADDRESS_START = /^(?:No\b|Unit\b|Lot\b|Blok\b|Block\b|Level\b|Tingkat\b|Suite\b|\d|[A-Z]-?\d|(?:Jalan|Jln|Lorong|Lrg|Persiaran|Lebuh|Lebuhraya|Taman|Tmn|Kampung|Kg|Bandar|Bukit|Menara|Wisma|Bangunan)\b)/i;
      let from = base0;
      for (const c of sub.matchAll(cut)) if (ADDRESS_START.test(sub.slice(c.index + c[0].length))) from = base0 + c.index + c[0].length;
      start = start - before.length + before.lastIndexOf(piece[1]) + piece[1].indexOf(body) + from;
      pieces++;
      if (from > 0) break;
    }
    if (pieces > 0) spans.push({ type: 'ADDRESS', start, end: m.index + m[0].length });
  }
  // Streets mentioned without a postcode: "at Jalan Tun Razak".
  const street = new RegExp(String.raw`\b(?:Jalan|Jln\.?|Lorong|Lrg\.?|Persiaran|Lebuh|Lebuhraya|Taman|Tmn\.?|Kampung|Kg\.?)\s+${W}(?:\s+${W}){0,3}(?:\s+\d+[A-Z]?(?:\/\d+[A-Z]?)?)?`, 'gu');
  // A house or unit number just before the street, even on the line above ("Unit 3-2,", "No. 12,", "27,"), belongs to the address.
  const LEAD = /(?:(?:No\.?|Unit|Lot|Blok|Block|Tingkat|Level|Lvl|Suite)\s*[\w\/-]+|\d+[A-Z]?(?:[-\/]\d+[A-Z]?)*)\s*,\s*$/i;
  for (const m of text.matchAll(street)) {
    const lead = LEAD.exec(text.slice(Math.max(0, m.index - 30), m.index));
    spans.push({ type: 'ADDRESS', start: m.index - (lead ? lead[0].length : 0), end: m.index + m[0].length });
  }
  return spans;
}

const LAND_TAIL = String.raw`(?:\s*,?\s*(?:Lot|PT|Plot)\s*(?:No\.?\s*)?\d[\w\/-]*)?(?:\s*,?\s*(?:Seksyen|Section)\s*\d+[A-Z]?)?(?:\s*,?\s*(?:Mukim|Bandar|Pekan|Daerah|District\s+of|Town\s+of|Tempat|Locality\s+of)\s+(?:of\s+)?\p{Lu}[\p{L}]*(?:\s+\p{Lu}[\p{L}]*){0,2})*`;
const RAW_PATTERNS = [
  { type: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // Where a photo was taken.
  { type: 'LOCATION', re: /(?<=GPS(?: location)?:\s*)-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+/gi },
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

const PATTERNS = RAW_PATTERNS.map(forwardOf);

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
const titleStrip = new RegExp(`^(?:(?:${TITLE_RE}|${KIN_RE})\\.?\\s+)+`, 'iu');

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
// Initials at the start of a firm's name: "K.S. Rao & Co", "J. A. Nathan & Partners".
const INITIALS = String.raw`(?<![\p{L}.])\p{Lu}\.(?:[ ]?\p{Lu}\.)*[ ]?`;
const COMPANY_RES = [
  new RegExp(String.raw`\b(?:Messrs\.?|Tetuan|M\/s) +((?:${INITIALS})?${W}(?:(?: *, *| +)(?:${W}|&|and|dan))*(?: +Co\.?)?)`, 'gu'),
  new RegExp(String.raw`((?:${INITIALS})?${W}(?: *, *${W}| +${W}){0,5} *(?:&|and|dan) *(?:Partners|PARTNERS|Co\.?|CO\.?|Associates|ASSOCIATES|Rakan-Rakan|RAKAN-RAKAN|Company|COMPANY))(?![\p{L}])`, 'gu'),
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

// Titles written as abbreviations, which may end in a dot ("Mr.", "Dr.",
// "En."). After a whole word a dot ends the sentence: "Thank you Puan.
// Cabinets done today." names nobody. A title and its name are always on one
// line.
const ABBREV_TITLES = ['Mr', 'Mrs', 'Ms', 'Mdm', 'Dr', 'Prof', 'En', 'Pn', 'Hj', 'Hjh', 'Ir', 'Ar', 'Ts', 'Insp', 'Sgt', 'Sjn', 'Kpl', 'Cpl', 'Supt', 'YB', 'YBhg', 'YM', 'YAB', 'Abg'];
const TITLE_TOKEN = String.raw`(?:(?:${alt(ABBREV_TITLES)})\.?|(?:${ALL_TITLES_RE}))`;
const TITLE_LEAD = new RegExp(`^(?:${TITLE_TOKEN}[ \\t]+)+`, 'u');
const GREETING_WORD = /^(?:hi|hello|hey|hai|dear|salam|assalamualaikum|thanks|thank|morning|ok|okay|noted|tq|thx|cc|attn|attention|to|for|from)$/i;
// Words after a heading that are not a name: "AFIDAVIT SOKONGAN" is a supporting affidavit.
const HEADING_WORDS = new Set('sokongan balasan jawapan tambahan lanjut penyampaian penyerahan pengesahan penyata service documents means verification support reply deceased undersigned'.split(' '));
// A word that ends like a verb or adverb ("Unfortunately", "Meeting") is not a one-word name.
const NOT_ONE_NAME = /(?:ly|ing|ed|tion|sion|ment|ness)$/i;
const stopish = (w) => isStop(w) || isStop(w.replace(/s$/i, '')) || LABEL_WORDS.has(plainWord(w)) || ROLE_NOUNS.has(plainWord(w));
/** The words of a name without the titles in front ("Kak Ros" -> ["Ros"]). */
const withoutTitles = (value) => norm(value.replace(TITLE_LEAD, '')).split(' ').filter(Boolean);
/** True when every word could be part of a name. `strong`: the place itself says a name is there. */
function looksLikeName(value, { strong = false, single = true } = {}) {
  const words = withoutTitles(value);
  if (!words.length || words.length > 6) return false;
  if (words.length === 1 && (!single || NOT_ONE_NAME.test(words[0]) && !isNameWord(words[0]) || /^\p{Lu}{1,3}$/u.test(words[0]))) return false;
  return words.every((w) => PARTICLE_WORD.test(w) || ((strong ? strongNameLike(w) : nameLike(w)) && !(stopish(w) && !isNameWord(w) && !(strong && ORDINARY.has(plainWord(w))))));
}

// Chat exports. WhatsApp on Android: "22/03/2025, 07:02 - Name: text"; on an
// iPhone: "[22/03/2025, 07:02:45] Name: text". The name is a person.
// The date may already have been set aside (a private-use character) before the name rules run.
const CHAT_DATE = String.raw`(?:\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|[\u{f0000}-\u{ffffd}])`;
const CHAT_TIME = String.raw`\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?:[   ]?[AaPp]\.?[   ]?[Mm]\.?)?`;
const CHAT_HEAD = String.raw`[ \t‎‏]*(?:\[${CHAT_DATE},?[ \t ]+${CHAT_TIME}\][ \t]*|${CHAT_DATE},?[ \t ]+${CHAT_TIME}[ \t]+[-–—][ \t]+)[~‎‏  \t]*`;
const CHAT_LINE = new RegExp(String.raw`^${CHAT_HEAD}([^:\n]{1,60}?)[ \t]*:[ \t]`, 'gmu');
export const CHAT_LABEL_BEFORE = new RegExp(String.raw`(?:^|\n)${CHAT_HEAD}$`, 'u');

const CLOSINGS = ['Best regards', 'Kind regards', 'Warm regards', 'Warmest regards', 'With best regards', 'Thanks and regards', 'Thanks & regards', 'Regards', 'Rgds', 'Brgds', 'Many thanks', 'Thank you', 'Thanks', 'Cheers', 'Best wishes', 'Best', 'Yours sincerely', 'Yours faithfully', 'Yours truly', 'Sincerely', 'Sekian, terima kasih', 'Sekian terima kasih', 'Terima kasih', 'Wassalam', 'Salam', 'Tq', 'Thx'];
const CLOSING_LINE = new RegExp(`^[ \\t>]*(?:${CLOSINGS.map(ci).join('|')})[ \\t]*[,.!]?[ \\t]*$`, 'u');
const ROLE_ALT = [...ROLE_NOUNS].sort((a, b) => b.length - a.length).map((r) => `[${r[0].toUpperCase()}${r[0]}]${escapeRe(r.slice(1))}`).join('|');
const PERSON_HEADER_SET = new Set(PERSON_HEADERS);
const NAME_RUN = String.raw`(?:${TITLE_TOKEN}[ \t]+)*${W}(?:[ \t]+(?:${W}|${PARTICLE})){0,5}`;

/** Collect people and companies named in one text. Returns [{kind, text}]. */
export function findNames(text) {
  const found = [];
  const add = (kind, value, why, extra = {}) => { value = norm(value).replace(/['’]s$/i, ''); if (value.length > 1) found.push({ kind, text: value, why, ...extra }); };
  const blank = (s) => s.replace(/[^\n]/g, ' ');

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

  // A first name that is also an ordinary word, followed by a surname from the
  // lists, is a name: "May Wong", "Dan Ong".
  const ordinaryFirst = (w, next) => ORDINARY.has(plainWord(w)) && /^\p{Lu}\p{Ll}/u.test(w) && next && isNameWord(next) && !AMBIGUOUS.has(next.toLowerCase());
  const trim = (input) => {
    const out = input.slice();
    while (out.length > 2 && !isNameWord(out[0]) && !GENERIC_PARTS.has(out[0].toLowerCase()) && isNameWord(out[1]) && !AMBIGUOUS.has(out[1].toLowerCase()) && /^\p{Lu}\p{Ll}/u.test(out[0]) && VERBISH.test(out[0])) out.shift();
    while (out.length && (isStop(out[0]) || PARTICLE_WORD.test(out[0])) && !isNameWord(out[0]) && !ordinaryFirst(out[0], out[1])) out.shift();
    while (out.length && (isStop(out[out.length - 1]) || PARTICLE_WORD.test(out[out.length - 1])) && !isNameWord(out[out.length - 1])) out.pop();
    return out;
  };

  // 0. Chat exports: the name before the colon is a person. What is a name and
  // what describes the person ("Kala Manager") is sorted out when the folder
  // is registered, once company names are known.
  rest = rest.replace(CHAT_LINE, (m, label) => {
    if (/\d{3}/.test(label) || !/\p{L}/u.test(label)) return m;
    add('PERSON', label, 'chat speaker', { chat: true });
    return m.slice(0, m.lastIndexOf(label)) + blank(label) + m.slice(m.lastIndexOf(label) + label.length);
  });

  // 1. Names with a particle: Ahmad bin Ismail, RAVI A/L MUTHU, Lim Ah Kow @ Ah Kau.
  const particle = new RegExp(String.raw`(?<![\p{L}])(${W}(?: +${W}){0,3}) +${PARTICLE} +(${W}(?: +${W}){0,3})(?: +${PARTICLE} +${W}(?: +${W}){0,2})?`, 'gu');
  rest = rest.replace(particle, (m) => {
    const words = trim(m.split(/\s+/));
    if (words.length < 3 || !words.some((w) => PARTICLE_WORD.test(w))) return m;
    add('PERSON', words.join(' '), 'particle');
    return m.replace(/[^\n]/g, ' ');
  });

  // 2. Names after a title: Dato' Sri Lim, Encik Ahmad, Dr. Kavitha Nair, and
  // the informal ones: Kak Ros, Pak Darsono, Uncle Mani, Ah Seng. The title and
  // the name are in the same sentence and on the same line.
  const titled = new RegExp(String.raw`(?<![\p{L}])((?:${TITLE_TOKEN} +)+)(${W}(?: +(?:${W}|${PARTICLE})){0,5})`, 'gu');
  rest = rest.replace(titled, (m, title, name, offset, whole) => {
    const kin = KIN_START.test(title);
    let words = name.split(/\s+/);
    if (kin) {
      // An informal title starts a name; it is not inside one ("Tan Ah Kow").
      const before = /([\p{L}'’-]+)[ \t]+$/u.exec(whole.slice(Math.max(0, offset - 40), offset));
      if (before && /^\p{Lu}/u.test(before[1]) && (isNameWord(before[1]) || GENERIC_PARTS.has(before[1].toLowerCase())) && !GREETING_WORD.test(before[1])) return m;
      // "Mak Long", "Pak Ngah": a birth-order word belongs to the title.
      while (words.length && BIRTH_ORDER.has(words[0].toLowerCase())) words.shift();
    }
    words = trim(words);
    if (!words.length || (kin && !strongNameLike(words[0]))) return m;
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

  // 3b2. Headings that name a person: "AFFIDAVIT OF RAVI A/L MUTHU", and one
  // name alone on the heading line: "WITNESS STATEMENT OF SUTARNO".
  const headed = new RegExp(String.raw`(?:AFFIDAVIT OF|AFIDAVIT|WITNESS STATEMENT OF|PERNYATAAN SAKSI|ESTATE OF|HARTA PUSAKA|IN THE MATTER OF|DALAM PERKARA|STATUTORY DECLARATION OF|AKUAN BERKANUN) +(\p{Lu}[\p{Lu}'’-]*(?: +(?:\p{Lu}[\p{Lu}'’-]*|${PARTICLE})){0,6})(?=[ \t]*(?:,|\(|$))`, 'gmu');
  rest = rest.replace(headed, (m, name, offset, whole) => {
    const words = trim(name.split(/\s+/));
    if (!words.length) return m;
    if (words.length === 1) {
      const lineEnd = /^[ \t]*(?:\n|$)/.test(whole.slice(offset + m.length));
      if (!lineEnd || words[0].length < 3 || HEADING_WORDS.has(words[0].toLowerCase()) || !looksLikeName(words[0], { strong: true })) return m;
    } else if (words.some((w) => isStop(w) && !isNameWord(w) && !PARTICLE_WORD.test(w))) return m;
    add('PERSON', words.join(' '), 'named in a heading');
    return m.replace(name, name.replace(/[^\n]/g, ' '));
  });

  // 3b3. People who say who they are: "My name is Sutarno", "Nama saya Ani",
  // "I, Sutarno (Passport No. ...)", "Saya, Ani,", "Hi this is Ani".
  const self = new RegExp(String.raw`(?:(?<![\p{L}])(?:[Mm]y name is|[Mm]y name's|[Nn]ama saya(?: ialah| adalah)?|[Ss]aya bernama|[Ss]aya dipanggil|[Pp]anggil saya|I am called|[Cc]all me)|(?<![\p{L}])(?:[Hh]i|[Hh]ello|[Hh]ai|[Ss]alam),? (?:this is|ini)|^[ \t]*(?:I|Saya),)[ \t]+(${NAME_RUN})`, 'gmu');
  rest = rest.replace(self, (m, name) => {
    const words = trim(name.split(/\s+/));
    if (!words.length || !looksLikeName(words.join(' '), { strong: true })) return m;
    add('PERSON', words.join(' '), 'says who they are');
    return m.slice(0, m.length - name.length) + blank(name);
  });

  // 3b4. Other names a person goes by: "(also known as Along)", "dikenali
  // sebagai Kak Mala", "everyone calls him Pai", "whom the staff call Uncle
  // Khoo", "a worker called Rubel", "seorang pencuci bernama Rubel". Each is
  // a person here; they are joined to the person they belong to once the
  // whole folder is known (learnDefinitions).
  const alias = new RegExp(String.raw`(?:(?<![\p{L}])(?:also |juga |lebih )?(?:known(?: in the family| to (?:everyone|all|us|them|the staff|his friends|her friends|the family))? as|a\.?k\.?a\.?|dikenali sebagai|dipanggil|nicknamed|alias)|(?<![\p{L}])(?:calls?|called) (?:him|her|me)|(?<![\p{L}])whom (?:[\p{Ll}'’]+ ){0,3}calls?|(?<![\p{L}])(?:[Aa]n?|[Tt]he|one|[Aa]nother|[Ss]eorang|a certain) (?:[\p{Ll}'’-]+ ){0,3}(?:called|named|bernama))[ \t]+["“'‘]?(${NAME_RUN})`, 'gu');
  rest = rest.replace(alias, (m, name) => {
    const words = trim(name.split(/\s+/));
    if (!words.length || !looksLikeName(words.join(' '), { strong: true })) return m;
    add('PERSON', words.join(' '), 'another name the text gives a person');
    return m.slice(0, m.length - name.length) + blank(name);
  });
  // "Everyone calls Paiman "Pai"": both are the same person.
  const calls = new RegExp(String.raw`(?<![\p{L}])(?:calls?|called)[ \t]+(${W}(?:[ \t]+${W}){0,2})[ \t]+["“'‘](${W}(?:[ \t]+${W}){0,2})["”'’]`, 'gu');
  rest = rest.replace(calls, (m, name, nick) => {
    if (!looksLikeName(name, { strong: true }) || !looksLikeName(nick, { strong: true })) return m;
    add('PERSON', name, 'another name the text gives a person');
    add('PERSON', nick, 'another name the text gives a person');
    return m.replace(name, blank(name)).replace(nick, blank(nick));
  });

  // 3b5. Greetings and sign-offs in letters, emails and messages: "Hi Daus,",
  // "Salam Aiman,", "Regards,\nMay", "Cheers, Dan".
  const greet = new RegExp(String.raw`(?:^|[\n"“(]|[.!?][ \t]+)[ \t>]*(?:${['Dear', 'Hi', 'Hello', 'Hey', 'Hai', 'Salam', 'Assalamualaikum', 'Good morning', 'Good afternoon', 'Morning'].map(ci).join('|')})[ \t]+((?:${TITLE_TOKEN}[ \t]+)*${W}(?:[ \t]+${W}){0,2})(?=[ \t]*(?:[,!:\-–—]|$))`, 'gmu');
  rest = rest.replace(greet, (m, name) => {
    if (!looksLikeName(name, { strong: true })) return m;
    add('PERSON', name, 'greeting');
    return m.slice(0, m.length - name.length) + blank(name);
  });
  {
    const lines = rest.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!CLOSING_LINE.test(lines[i])) continue;
      let j = i + 1;
      while (j < lines.length && j <= i + 3 && /^[ \t>]*$/.test(lines[j]) && lines[j].length < 2) j++;
      if (j >= lines.length || j > i + 3) continue;
      const name = norm(lines[j].replace(/^[ \t>]+/, '').replace(/[ \t]*[,.]?[ \t]*$/, ''));
      if (!name || /[\d@:]/.test(name) || !looksLikeName(name, { strong: true })) continue;
      add('PERSON', name, 'signs off');
      lines[j] = blank(lines[j]);
    }
    rest = lines.join('\n');
  }
  const signInline = new RegExp(String.raw`(?:^|[\s"“(])(?:${CLOSINGS.map(ci).join('|')}),[ \t]+(${W}(?:[ \t]+${W}){0,2})(?=[ \t]*(?:$|[(.]))`, 'gmu');
  rest = rest.replace(signInline, (m, name) => {
    if (!looksLikeName(name, { strong: true })) return m;
    add('PERSON', name, 'signs off');
    return m.slice(0, m.length - name.length) + blank(name);
  });

  // 3b6. Lists of the people at a meeting: "Present: Puan Mazlina, Jeremy (us); Kala (client)".
  {
    const lines = rest.split('\n');
    lines.forEach((line, i) => {
      const head = /^([ \t]*(?:[Pp]resent|[Aa]ttendees|[Aa]ttendance|[Ii]n attendance|[Aa]lso present|[Hh]adir|[Kk]ehadiran|[Pp]articipants)[ \t]*:)(.*)$/u.exec(line);
      if (!head) return;
      let body = head[2];
      for (const item of head[2].replace(/\([^)\n]*\)/g, ',').split(/[;,&]|\band\b|\bdan\b/)) {
        const name = norm(item);
        if (!name || !looksLikeName(name, { strong: true })) continue;
        add('PERSON', name, 'in a list of those present');
        body = body.replace(name, blank(name));
      }
      lines[i] = head[1] + body;
    });
    rest = lines.join('\n');
  }

  // 3b7. Spreadsheet columns of people: the cells under "Name", "Nama",
  // "Supervisor", "Certified by", "Received by"..., and the cell after a row
  // label such as "Prepared by".
  {
    const lines = rest.split('\n');
    let cols = null;
    const header = (c) => PERSON_HEADER_SET.has(norm(c).toLowerCase().replace(/[:.]+$/, ''));
    const take = (cells, k) => {
      const cell = norm(cells[k] || '');
      if (!cell || /[\d@]/.test(cell)) return;
      const name = norm(cell.replace(/(?:^|\s)\p{Lu}\.(?=\s|$)/gu, ' '));
      if (!looksLikeName(name, { strong: true })) return;
      add('PERSON', name, 'in a column of names');
      cells[k] = blank(cells[k]);
    };
    lines.forEach((line, i) => {
      if (!line.includes('\t')) { cols = null; return; }
      const cells = line.split('\t');
      const heads = cells.map(header);
      if (cols === null) {
        // The first row of a table is its header row when it names a column of people.
        cols = [];
        if (heads.some(Boolean) && cells.every((c) => !/\d/.test(c))) { cols = heads.map((h, k) => (h ? k : -1)).filter((k) => k >= 0); return; }
      }
      for (const k of cols) take(cells, k);
      heads.forEach((h, k) => { if (h) take(cells, k + 1); });
      lines[i] = cells.join('\t');
    });
    rest = lines.join('\n');
  }

  // 3b8. Legal letters introduce a person as "one X": "accepted by one Joko".
  const one = new RegExp(String.raw`(?<![\p{L}])one[ \t]+(${W}(?:[ \t]+(?:${W}|${PARTICLE})){0,3})(?=[ \t]*[,.;:)\n]|[ \t]+\p{Ll}|[ \t]*$)`, 'gu');
  rest = rest.replace(one, (m, name) => {
    const words = trim(name.split(/\s+/));
    if (!words.length || !looksLikeName(words.join(' '))) return m;
    add('PERSON', words.join(' '), 'introduced as "one" person');
    return m.slice(0, m.length - name.length) + blank(name);
  });

  // 3b9. A name next to the person's role: "the lorry driver, Ah Seng,",
  // "Our cook, Margono,", "Joko, another worker,", "Pembantu saya ialah
  // Sutinah", "The workers under me are Ani, Budi and Wati".
  const appos = new RegExp(String.raw`(?<![\p{L}])(?:[Tt]he|[Oo]ur|[Mm]y|[Hh]is|[Hh]er|[Tt]heir|[Yy]our|[Aa]n?|[Aa]nother|[Ss]eorang)[ \t]+(?:[\p{L}'’-]+[ \t]+){0,3}?(?:${ROLE_ALT})[ \t]*,[ \t]*(${NAME_RUN})(?=[ \t]*(?:[,.;)\n]|$))`, 'gu');
  const apposAfter = new RegExp(String.raw`(?<![\p{L}])(${W}(?:[ \t]+(?:${W}|${PARTICLE})){0,3})[ \t]*,[ \t]*(?:the|our|my|his|her|their|your|an?|another)[ \t]+(?:[\p{L}'’-]+[ \t]+){0,3}?(?:${ROLE_ALT})(?![\p{L}])`, 'gu');
  const NAME_LIST = String.raw`${W}(?:[ \t]+${W}){0,3}(?:[ \t]*,[ \t]*${W}(?:[ \t]+${W}){0,3})*(?:[ \t]*,?[ \t]+(?:and|dan|&)[ \t]+${W}(?:[ \t]+${W}){0,3})?`;
  const copula = new RegExp(String.raw`(?<![\p{L}])(?:${ROLE_ALT})(?:[ \t]+(?:saya|kami|dia|under me|under him|under her|in charge))?[ \t]+(?:is|was|are|were|ialah|adalah)[ \t]+(${NAME_LIST})`, 'gu');
  for (const re of [appos, apposAfter, copula]) {
    rest = rest.replace(re, (m, list) => {
      let out = m;
      for (const item of list.split(/[ \t]*,[ \t]*|[ \t]+(?:and|dan|&)[ \t]+/)) {
        const words = trim(item.split(/\s+/).filter(Boolean));
        if (!words.length || !looksLikeName(words.join(' '), { strong: true })) continue;
        add('PERSON', words.join(' '), 'named next to their role');
        out = out.replace(item, blank(item));
      }
      return out;
    });
  }

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
  // Document properties and reviewer names: "Author: Lim Mei Ling".
  for (const line of rest.matchAll(/^(?:Author|Last modified by|Reviewer|Note by|Comment by|Owner|Manager|Artist|creator|Signed by|Prepared by|Disediakan oleh):[ \t]*(.+)$/gim)) {
    const name = norm(line[1].replace(/<[^>]*>|\S+@\S+|["']/g, ''));
    const words = name.split(' ').filter(Boolean);
    if (words.length >= 1 && words.length <= 6 && words.every((w) => /^\p{Lu}/u.test(w) || PARTICLE_WORD.test(w)) && !words.every((w) => isStop(w) && !isNameWord(w))) add('PERSON', words.length === 1 ? `Mr ${name}` : name, 'named in the document details');
  }
  for (const line of rest.matchAll(/^Company:[ \t]*(.+)$/gim)) {
    const name = norm(line[1]);
    if (name.length > 2 && name.length < 80 && !name.split(' ').every((w) => isStop(w))) add('COMPANY', name, 'named in the document details');
  }
  for (const line of rest.matchAll(/^(?:From|Sender|To|Cc|Bcc|Daripada|Kepada|Sent by|Reply-To):[ \t]*(.+)$/gim)) {
    for (const piece of line[1].split(/[;,]/)) {
      const name = norm(piece.replace(/<[^>]*>|\S+@\S+|["']/g, '').replace(/\([^)]*\)/g, ' '));
      const words = name.split(' ').filter(Boolean);
      // One word is enough here: the display name of a sender is a person ("Bernice <...>").
      if (words.length === 1 ? looksLikeName(name, { strong: true }) : words.length <= 6 && words.every((w) => /^\p{Lu}/u.test(w) || PARTICLE_WORD.test(w)) && !words.some((w) => isStop(w) && !isNameWord(w))) add('PERSON', name, 'email header');
    }
  }
  // Form lines that name a person: "Nama: Ani", "Signed: Sutarno", "Tandatangan: Ani", "Witness: Ani".
  for (const line of rest.matchAll(/^[ \t]*(?:Name|Nama|Nama penuh|Full name|Signed|Sgd\.?|Signature|Tandatangan|Witness|Saksi|Contact person|Interviewed by|Interviewer|Note taken by|Noted by|Received by|Diterima oleh|Approved by|Disahkan oleh|Checked by|Certified by)[ \t]*:[ \t]*([^\n]+)$/gimu)) {
    const name = norm(line[1].replace(/\([^)\n]*\)/g, ' ').split(/,|\s[-–—]\s|\s{3,}/)[0]);
    if (name && looksLikeName(name, { strong: true })) add('PERSON', name, 'named on a form line');
  }
  // Action items in file notes: "Sharon to open a new file", "- Adlina to get the notice".
  const action = new RegExp(String.raw`(?:^|[.!?][ \t]+|\n)[ \t]*(?:[-•*][ \t]*|\d+[.)][ \t]*)?(${W})[ \t]+to[ \t]+\p{Ll}`, 'gu');
  rest = rest.replace(action, (m, name) => {
    if (!isNameWord(name) || AMBIGUOUS.has(name.toLowerCase())) return m;
    add('PERSON', name, 'given a task in a note');
    return m.replace(name, blank(name));
  });

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
        // "Mak Long", "Pak Ngah": a family title and a birth-order word, not a name.
        if (words.length === 2 && KIN_START.test(words[0]) && BIRTH_ORDER.has(words[1].toLowerCase())) return;
        if (words.some((w, i) => isStop(w) && !isNameWord(w) && !PARTICLE_WORD.test(w) && !(i === 0 && ordinaryFirst(w, words[1])))) return;
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

const NO_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
const SENTINEL = (i) => String.fromCodePoint(0xf0000 + i);
const SENTINEL_RE = /[\u{f0000}-\u{ffffd}]/gu;
const HONOUR_MARK = (i) => String.fromCodePoint(0x100000 + i);
const HONOUR_MARK_RE = /([\u{100000}-\u{10fffd}]) (?:(?=(\{\{(PERSON_\d+)[.}]))|)/gu;

// ------------------------------------------------ fast search for known values
//
// Cloak.cloak() tries every known value against the whole text, one after the
// other. That is fine for a few hundred values and far too slow for thousands.
// This does the same job in one pass: it finds every place any known value
// occurs, then accepts them longest value first, skipping any that overlap one
// already accepted. That is exactly what trying the values one by one does.
const WORD = /[\p{L}\p{N}_]/u;
const TOKENS = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;
const tokenKey = (t) => (WORD.test(t[0]) ? `w${t.toLowerCase()}` : /\s/.test(t[0]) ? ' ' : `p${t === '’' ? "'" : t}`);

function buildTrie(entries) {
  const root = { next: new Map(), ends: null };
  entries.forEach((e, order) => {
    if (e.match === false) return;
    let node = root;
    for (const m of e.value.matchAll(TOKENS)) {
      const key = tokenKey(m[0]);
      if (!node.next.has(key)) node.next.set(key, { next: new Map(), ends: null });
      node = node.next.get(key);
    }
    (node.ends ||= []).push({ token: e.token, value: e.value, lower: e.value === e.value.toLowerCase(), order, ...nameInfo(e) });
  });
  return root;
}

// How a known person or company may be matched when a file is cloaked:
// `ordinary`  a one-word name that is also an ordinary word (May, Grace, Kala)
// `lowerOk`   may be matched where it is written in lowercase ("joko", "ah seng")
function nameInfo(e) {
  if (!/^(?:PERSON|COMPANY)_/.test(e.token)) return { name: false };
  const words = e.value.split(/\s+/);
  const ordinary = words.length === 1 && ORDINARY.has(plainWord(e.value));
  return { name: true, ordinary, lowerOk: !ordinary && e.value.replace(/[\s.'’-]/g, '').length >= 3 };
}

/** The previous word, if it is a title: "kak ros", "uncle mani". */
function afterTitle(text, start) {
  const m = /([\p{L}'’]+)\.?[ \t]+$/u.exec(text.slice(Math.max(0, start - 20), start));
  return !!m && TITLE_WORDS.has(m[1].toLowerCase().replace(/['’]/g, ''));
}

/** Inside an email address or a web link: "kelvin.tay@example.com". */
function inLink(text, start, end) {
  const left = /\S*$/.exec(text.slice(Math.max(0, start - 80), start))[0];
  const right = /^\S*/.exec(text.slice(end, end + 80))[0];
  return /@|:\/\/|^www\./i.test(left + right);
}

const MONTH_NAMES = new Set(['may', 'june', 'april', 'august']);
const MONTH_PREP = new Set('of in by until till since before after early mid late from to during end bulan pada sejak hingga sehingga sebelum selepas'.split(' '));

/**
 * For a known one-word name that is also an ordinary word, written with a
 * capital or in capitals: does it read as the ordinary word here? Returns why
 * ('start' when it is at the start of a sentence and what follows does not
 * read as a name: "Mark the pallets", "May we remind you", "Grace Period"),
 * or null when it reads as the name.
 */
export function ordinaryUse(text, start, end) {
  const word = text.slice(start, end);
  const before = text.slice(Math.max(0, start - 80), start);
  const after = text.slice(end, end + 80);
  const pm = /([\p{L}\p{N}'’]+)([^\p{L}\p{N}]*)$/u.exec(before);
  const prev = pm && !/\n/.test(pm[2]) ? pm[1] : null;
  const gapBefore = prev ? pm[2] : '';
  const lowPrev = prev ? prev.toLowerCase().replace(/['’]/g, '') : '';
  const nm = /^([^\p{L}\p{N}\n]*)([\p{L}\p{N}'’-]+)?/u.exec(after);
  const gapAfter = nm[1];
  const next = nm[2] || null;
  const spaced = (gap) => /^[ \t]+$/.test(gap);
  if (prev && TITLE_WORDS.has(lowPrev) && /^[ \t.]*$/.test(gapBefore)) return null;
  if (CHAT_LABEL_BEFORE.test(before)) return null;
  if (word.length > 1 && word === word.toUpperCase()) {
    const caps = (w, gap) => w && spaced(gap) && w === w.toUpperCase() && /\p{L}/u.test(w) && !isStop(w);
    return caps(next, gapAfter) || caps(prev, gapBefore) ? null : 'capitals';
  }
  if (prev && spaced(gapBefore) && DETERMINERS.has(lowPrev)) return 'after a determiner';
  if (MONTH_NAMES.has(word.toLowerCase())) {
    if (next && /^\d/.test(next) && /^[ \t,]+$/.test(gapAfter)) return 'month';
    if (prev && spaced(gapBefore) && MONTH_PREP.has(lowPrev)) {
      const agent = /([\p{L}'’]+)[ \t]+by[ \t]+$/u.exec(before);
      if (lowPrev !== 'by' || !agent || !/(?:ed|en)$/i.test(agent[1])) return 'month';
    }
  }
  const atStart = !prev || /[.!?:;"“(•–—-][ \t]*$/.test(gapBefore);
  if (!atStart) return null;
  if (!next || !spaced(gapAfter)) return null;
  if (/^\p{Lu}/u.test(next)) return 'start';
  return AFTER_NAME.has(next.toLowerCase()) ? null : 'start';
}

// Words before a lowercase name that show it is a person: "ask kala", "met kala".
const LOWER_CUES = new Set('ask asked tell told call called cc met meet with inform informed tanya beritahu bagitahu suruh minta panggil jumpa from'.split(' '));

/** A lowercase ordinary word that is also a known name: do the words around it read as the person? */
function lowerNameContext(text, start, end) {
  const before = /([\p{L}'’]+)[ \t]+$/u.exec(text.slice(Math.max(0, start - 30), start));
  const after = /^[ \t]+([\p{L}'’]+)/u.exec(text.slice(end, end + 30));
  if (before && TITLE_WORDS.has(before[1].toLowerCase())) return true;
  if (before && (DETERMINERS.has(before[1].toLowerCase()) || /^-$/.test(text[start - 1] || ''))) return false;
  return !!((after && AFTER_NAME.has(after[1].toLowerCase())) || (before && LOWER_CUES.has(before[1].toLowerCase())));
}

/**
 * ctx: when a file is cloaked, known people and companies are also matched in
 * lowercase, and known names that are ordinary words only where they read as
 * a name. Without ctx this is exactly the one-by-one search of the website.
 */
function replaceKnown(text, root, ctx = null) {
  const spans = []; // text that must not be touched: tags already in the text
  for (const m of text.matchAll(TOKEN_RE)) spans.push([m.index, m.index + m[0].length]);
  const toks = [...text.matchAll(TOKENS)].map((m) => ({ s: m[0], i: m.index, key: tokenKey(m[0]) }));
  const found = [];
  for (let a = 0; a < toks.length; a++) {
    if (toks[a].key === ' ' || !root.next.has(toks[a].key)) continue;
    if (a === 0 ? false : toks[a].i > 0 && WORD.test(text[toks[a].i - 1])) continue;
    let node = root;
    for (let b = a; b < toks.length; b++) {
      node = node.next.get(toks[b].key);
      if (!node) break;
      if (!node.ends) continue;
      const end = toks[b].i + toks[b].s.length;
      if (end < text.length && WORD.test(text[end])) continue;
      const slice = text.slice(toks[a].i, end);
      for (const e of node.ends) {
        const ordinary = ctx && e.name && (e.ordinary || (!/\s/.test(e.value) && ctx.ordinaryHere(e.value)));
        if (!e.lower && slice === slice.toLowerCase()) {
          // "may" or "wood" in ordinary prose is not the surname May / Wood. A
          // name that is not an ordinary word is the person in any case
          // ("darsono", "ah seng"), and so is an ordinary one after a title ("kak ros").
          if (!ctx || !e.name) continue;
          if (ordinary ? !afterTitle(text, toks[a].i) : (!e.lowerOk || inLink(text, toks[a].i, end))) continue;
        } else if (ordinary && ordinaryUse(text, toks[a].i, end)) continue;
        found.push({ start: toks[a].i, end, e });
      }
    }
  }
  if (!found.length) return text;
  found.sort((x, y) => y.e.value.length - x.e.value.length || x.e.order - y.e.order || x.start - y.start);
  const taken = new Uint8Array(text.length);
  for (const [s0, e0] of spans) taken.fill(1, s0, e0);
  const keep = [];
  for (const f of found) {
    let free = true;
    for (let k = f.start; k < f.end; k++) if (taken[k]) { free = false; break; }
    if (!free) continue;
    taken.fill(1, f.start, f.end);
    keep.push(f);
  }
  keep.sort((x, y) => x.start - y.start);
  let out = '';
  let at = 0;
  for (const f of keep) { out += text.slice(at, f.start) + `{{${f.e.token}}}`; at = f.end; }
  return out + text.slice(at);
}

// Two- and three-letter words and abbreviations that are never taken for initials.
const COMMON_SHORT = new Set('OK NO RE PS CC BY TO OF AT IN ON MY US UK HQ PM AM QS DO ID IC HP GM MD HR IT PR NB AOB TBC TBA FYI ETA CEO CFO COO KL JB PG SG SDN BHD LLP PLT DR MR MS DAN AND THE FOR NOT ADA'.split(' '));
const INITIALS_PLACE = new RegExp(String.raw`(^|\n)([ \t]*)(\p{Lu}{2,3})(?=[ \t]*(?:\n|$))|((?:${['Attendance', 'Attended by', 'Note taken by', 'Noted by', 'Prepared by', 'Drafted by', 'Fee earner', 'Initials', 'Interviewed by', 'Recorded by', 'By'].map(ci).join('|')})[ \t]*:?[ \t]+)(\p{Lu}{2,3})(?![\p{L}])`, 'gu');

export { Cloak, TOKEN_RE, norm, isStop };

export class Matter {
  constructor({ options = {}, key = null } = {}) {
    // level: 'standard' hides identifiers only; 'strict' also blurs facts (dates,
    // amounts, references). In strict the facts layer owns dates and amounts.
    this.options = { dates: false, amounts: false, provisions: false, level: 'standard', percentages: false, ...options };
    if (this.options.level === 'strict') this.options.dates = this.options.amounts = false;
    this.facts = new Facts({ level: this.options.level, percentages: !!this.options.percentages });
    this.cloak = key ? Cloak.fromJSON(key) : new Cloak();
    this.people = new Map();     // personKey -> base tag
    this.companies = new Map();  // companyKey -> base tag
    this.ids = new Map();        // "TYPE|key" -> base tag
    this.merges = [];            // variants joined under one tag, for review
    this.ambiguous = [];         // short forms that fit more than one person
    this.kinds = new Map();      // base tag -> how it was found
    this.trie = null;            // fast search over the known values, rebuilt when they change
    this.wordIdx = null;         // person key words -> person keys (so a big matter is not compared name by name)
    this.coWordIdx = null;       // the same for companies
    this.keep = [];              // values a reviewer said are not confidential
    this.safeWords = [];         // "not sure" words a reviewer marked as fine
    this.setup = { client: '', others: '' }; // typed at setup
    this.roles = {};             // roles a reviewer wrote for the context sheet: tag -> { roles, relationships }
    this.seen = { files: 0, lower: new Map(), lowerFiles: new Map(), cap: new Map(), last: new Map() }; // how words are written in this folder (not saved)
  }

  /** Count how each word is written in one file: lowercase or capitalised. */
  countWords(text) {
    const s = this.seen;
    s.files++;
    for (const m of String(text || '').matchAll(/\p{L}{3,}/gu)) {
      const w = m[0];
      const low = w.toLowerCase();
      if (w === low) {
        s.lower.set(low, (s.lower.get(low) || 0) + 1);
        if (s.last.get(low) !== s.files) { s.last.set(low, s.files); s.lowerFiles.set(low, (s.lowerFiles.get(low) || 0) + 1); }
      } else if (/^\p{Lu}\p{Ll}/u.test(w)) s.cap.set(low, (s.cap.get(low) || 0) + 1);
    }
  }

  /**
   * A one-word name that is an ordinary word here: on the list in names.js, or
   * written in lowercase in at least three files of this folder and more often
   * than with a capital ("said" when someone is called Said).
   */
  ordinaryHere(word) {
    const low = plainWord(word);
    if (ORDINARY.has(low)) return true;
    const s = this.seen;
    return (s.lowerFiles.get(low) || 0) >= 3 && (s.lower.get(low) || 0) > (s.cap.get(low) || 0);
  }

  /**
   * The parties the person typed at setup: "Who is the client?" and "Who are
   * the other parties?". One party per line; forms of the same party are
   * separated by ";" ("Seri Kembara Logistics Sdn Bhd; Seri Kembara; Kembara").
   * Start a line with "person:" or "company:" to say which it is. Every form is
   * hidden everywhere, and the short forms of a company are added by the
   * company rules. Nothing is guessed from folder names.
   */
  addSetupParties(setup = this.setup) {
    const COMPANY = /\b(?:sdn|bhd|berhad|pte|ltd|llp|plc|inc|corp|plt|holdings?|enterprises?|trading|logistics|resources|industries|properties|development|services|bank|group|capital|partners|associates)\b|&/i;
    const PERSON = /\b(?:bin|binti|bt|bte|ibni|a\/l|a\/p|s\/o|d\/o|anak)\b|^(?:mr|mrs|ms|dr|encik|puan|cik|dato|datuk|datin|tan sri|tun|prof)\b/i;
    const lines = (text) => String(text || '').split(/\n/).map((l) => l.trim()).filter(Boolean);
    const added = [];
    for (const [text, why] of [[setup?.client, 'the client (typed at setup)'], [setup?.others, 'another party (typed at setup)']]) {
      for (const line of lines(text)) {
        const forced = /^(person|company)\s*:\s*(.*)$/i.exec(line);
        const forms = (forced ? forced[2] : line).split(';').map((f) => norm(f)).filter(Boolean);
        if (!forms.length) continue;
        const main = forms[0];
        const company = forced ? forced[1].toLowerCase() === 'company' : COMPANY.test(main) || (!PERSON.test(main) && !/\p{Script=Han}/u.test(main));
        let base = company ? this.addCompany(main) : this.addPerson(main, why);
        if (!base) continue;
        base = base.split('.')[0];
        for (const f of forms.slice(1)) if (!this.cloak.byValue.has(f.toLowerCase())) this.variant(base, f, 'ALT');
        // A company with no ending ("Seri Kembara") is often written by its last distinctive word alone ("Kembara").
        const words = main.split(/\s+/);
        const last = words[words.length - 1];
        if (company && words.length >= 2 && !COMPANY.test(main) && last.length >= 5 && !isStop(last) && !NOT_NAMES.has(last.toLowerCase()) && !this.cloak.byValue.has(last.toLowerCase())) this.shortForm(base, last, 'SHORT');
        this.kinds.set(base, why);
        added.push(base);
      }
    }
    return added;
  }

  /**
   * Known values replaced with tags, in one pass. With { context: true } (when
   * a file is cloaked) known people are also found in lowercase, and names that
   * are ordinary words only where they read as a name.
   */
  known(text, { context = false } = {}) {
    const entries = this.cloak.entries;
    if (!this.trie || this.trie.cloak !== this.cloak || this.trie.size !== entries.length) {
      this.trie = { root: buildTrie(entries), cloak: this.cloak, size: entries.length };
    }
    return replaceKnown(text, this.trie.root, context ? { ordinaryHere: (w) => this.ordinaryHere(w) } : null);
  }

  /** Known one-word people whose name is also an ordinary word, as one pattern. */
  ordinaryNames() {
    const entries = this.cloak.entries;
    if (!this.ordinaryCache || this.ordinaryCache.cloak !== this.cloak || this.ordinaryCache.size !== entries.length || this.ordinaryCache.files !== this.seen.files) {
      const values = [...new Set(entries.filter((e) => e.match !== false && /^PERSON_/.test(e.token) && !/\s/.test(e.value) && this.ordinaryHere(e.value)).map((e) => e.value.toLowerCase()))];
      this.ordinaryCache = { cloak: this.cloak, size: entries.length, files: this.seen.files, re: values.length ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${values.map(escapeRe).join('|')})(?![\\p{L}\\p{N}_])`, 'giu') : null };
    }
    return this.ordinaryCache.re;
  }

  // Which people (or companies) have a given word in their key. Built when
  // first needed and kept up to date; review changes reset it.
  wordIndex() {
    if (!this.wordIdx) {
      this.wordIdx = new Map();
      for (const k of this.people.keys()) for (const w of k.split(' ')) (this.wordIdx.get(w) || this.wordIdx.set(w, new Set()).get(w)).add(k);
    }
    return this.wordIdx;
  }
  coWordIndex() {
    if (!this.coWordIdx) {
      this.coWordIdx = new Map();
      for (const k of this.companies.keys()) for (const w of k.split(' ')) (this.coWordIdx.get(w) || this.coWordIdx.set(w, new Set()).get(w)).add(k);
    }
    return this.coWordIdx;
  }
  setPerson(key, base) {
    this.people.set(key, base);
    if (this.wordIdx) for (const w of key.split(' ')) (this.wordIdx.get(w) || this.wordIdx.set(w, new Set()).get(w)).add(key);
  }
  setCompany(key, base) {
    this.companies.set(key, base);
    if (this.coWordIdx) for (const w of key.split(' ')) (this.coWordIdx.get(w) || this.coWordIdx.set(w, new Set()).get(w)).add(key);
  }
  resetIndexes() { this.wordIdx = null; this.coWordIdx = null; }

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
    if (!base && key.includes(' ')) {
      // Already known as a form of someone ("Alvin Lee" given as another name for Lee Chee Keong).
      const known = this.cloak.byValue.get(name.toLowerCase());
      if (known && known.startsWith('PERSON_')) { base = known.split('.')[0]; this.setPerson(key, base); return base; }
    }
    if (!base) {
      // One word ("Encik Ahmad", "Mr Tan"): link to the one person who has it.
      if (!key.includes(' ')) {
        const existing = this.cloak.byValue.get(name.toLowerCase());
        if (existing) return existing.split('.')[0];
        const owners = [...(this.wordIndex().get(key) || [])].map((k) => this.people.get(k));
        if (owners.length === 1) base = owners[0];
        else if (owners.length > 1) { base = owners[0]; this.ambiguous.push({ token: base, also: owners[1], value_is_short_form: true }); }
        reason = 'short form';
      } else {
        // All its words belong to exactly one longer name: "David Wong" for
        // "David Wong Kah Fai".
        const mine = key.split(' ');
        const longer = [...new Set([...(this.wordIndex().get(mine[0]) || [])].filter((k) => { const theirs = k.split(' '); return theirs.length > mine.length && mine.every((w) => theirs.includes(w)); }).map((k) => this.people.get(k)))];
        if (longer.length === 1) { base = longer[0]; reason = 'short form of a longer name'; }
      }
      if (!base && key.includes(' ')) {
        // A near-identical spelling of a known full name. With thousands of
        // people only those sharing a word are compared.
        const allowed = key.length >= 16 ? 2 : key.length >= 9 ? 1 : 0;
        const words = key.split(' ');
        if (allowed) {
          const near = this.people.size < 400 ? this.people.keys() : new Set(words.flatMap((w) => [...(this.wordIndex().get(w) || [])]));
          for (const k of near) {
            if (k.split(' ').length !== words.length) continue;
            if (editDistance(k, key, allowed) <= allowed) { base = this.people.get(k); reason = 'spelling looks like the same person'; break; }
          }
        }
      }
    }

    if (base) {
      if (!this.cloak.byValue.has(name.toLowerCase())) {
        const token = this.variant(base, name, 'ALT');
        this.merges.push({ token, into: base, reason });
        this.setPerson(key, base);
        if (key.includes(' ')) this.personParts(base, words);
      }
    } else {
      base = this.cloak.nextToken('PERSON');
      this.cloak.register(base, name);
      this.setPerson(key, base);
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
    // The first word after the common starters (Mohd, Nur, Siti...) is the name
    // the person goes by: "Firdaus" in Mohd Firdaus bin Kamarul Ariffin.
    const firstReal = given.findIndex((w) => !GENERIC_PARTS.has(w.toLowerCase().replace(/\.$/, '')));
    given.forEach((w, i) => {
      const plain = w.toLowerCase().replace(/\.$/, '');
      if (GENERIC_PARTS.has(plain) || PARTICLE_WORD.test(w)) return;
      if (w.length < 3 && !CHINESE_SURNAMES.has(plain)) return;
      const last = i === given.length - 1 && given.length > 1;
      const chineseSurname = i === 0 && CHINESE_SURNAMES.has(plain);
      const goesBy = i === firstReal && (split !== -1 || firstReal > 0);
      this.shortForm(base, w, chineseSurname ? 'SURNAME' : goesBy || (i === 0 && !last) ? 'FIRST' : last ? 'SURNAME' : 'MIDDLE');
    });
  }

  /**
   * Fold one person's tag into another's: the text says they are the same
   * person ("Lee Chee Keong (also known as Alvin Lee)"). Listed on the review
   * screen with the other joined names, to confirm or split.
   */
  mergeInto(from, into, reason) {
    from = from.split('.')[0];
    into = into.split('.')[0];
    if (from === into || !/^PERSON_\d+$/.test(from) || !/^PERSON_\d+$/.test(into)) return null;
    const entries = this.cloak.toJSON().entries;
    if (!entries.some((e) => e.token === from) || !entries.some((e) => e.token === into)) return null;
    this.resetIndexes();
    const taken = new Set(entries.filter((e) => e.token.split('.')[0] !== from).map((e) => e.token));
    const free = (wanted) => { if (!taken.has(wanted)) return wanted; for (let n = 2; ; n++) if (!taken.has(`${wanted}${n}`)) return `${wanted}${n}`; };
    let mainToken = null;
    const renamed = entries.map((e) => {
      if (e.token.split('.')[0] !== from) return e;
      const name = free(`${into}.${e.token === from ? 'ALIAS' : e.token.slice(from.length + 1).replace(/\d+$/, '')}`);
      taken.add(name);
      if (e.token === from) mainToken = name;
      return { ...e, token: name };
    });
    const counters = new Map(this.cloak.counters);
    this.cloak = Cloak.fromJSON({ entries: renamed });
    for (const [k, n] of counters) if (n > (this.cloak.counters.get(k) || 0)) this.cloak.counters.set(k, n);
    for (const map of [this.people, this.companies, this.ids]) for (const [k, v] of [...map]) if (v.split('.')[0] === from) map.set(k, into);
    this.kinds.delete(from);
    this.merges = this.merges.filter((m) => (m.token || '').split('.')[0] !== from && m.into !== from);
    this.merges.push({ token: mainToken, into, reason });
    this.ambiguous = this.ambiguous.filter((a) => a.token.split('.')[0] !== from && a.also !== from);
    return mainToken;
  }

  /** Another name the text gives a person: a tag to fold in, or a word to add as a form of the person. */
  joinAlias(base, tag, text) {
    base = base.split('.')[0];
    if (tag) {
      // Only a person's own tag is folded in, never a part of someone else's name ("Alvin" of Alvin Tan).
      if (tag.split('.')[0] !== base && (!tag.includes('.') || /\.(?:ALIAS|ALT)\d*$/.test(tag))) this.mergeInto(tag, base, 'the text gives it as another name for the same person');
      return;
    }
    const value = norm(String(text || '').replace(TITLE_LEAD, ''));
    if (!value || !looksLikeName(value, { strong: true })) return;
    const existing = this.cloak.byValue.get(value.toLowerCase());
    if (existing) {
      if (existing.startsWith('PERSON_') && existing.split('.')[0] !== base && !existing.includes('.')) this.mergeInto(existing, base, 'the text gives it as another name for the same person');
      return;
    }
    this.shortForm(base, value, 'ALIAS');
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
      const allowed = key.length >= 16 ? 2 : key.length >= 9 ? 1 : 0;
      if (allowed) {
        const near = this.companies.size < 400 ? this.companies.keys() : new Set(key.split(' ').flatMap((w) => [...(this.coWordIndex().get(w) || [])]));
        for (const k of near) {
          if (editDistance(k, key, allowed) <= allowed) { base = this.companies.get(k); this.merges.push({ token: null, into: base, reason: 'spelling looks like the same company' }); break; }
        }
      }
    }
    if (base) {
      if (!this.cloak.byValue.has(name.toLowerCase())) {
        const token = this.variant(base, name, 'ALT');
        if (!this.merges.some((m) => m.into === base && m.token === null)) this.merges.push({ token, into: base, reason: 'same company written differently' });
      }
      this.setCompany(key, base);
      return base;
    }
    base = this.cloak.nextToken('COMPANY');
    this.cloak.register(base, name);
    this.setCompany(key, base);
    this.kinds.set(base, 'company rule');
    // The name without its endings, one ending at a time: "Maju Jaya Enterprise Sdn Bhd" gives
    // "Maju Jaya Enterprise" and "Maju Jaya". Each is matched as written, in text, file names and folder names.
    const ending = new RegExp(`[\\s,]+(?:\\((?:M|Malaysia|Asia)\\)\\s*)?${CO_END}\\.?$`, 'u');
    let current = name;
    for (let i = 0; i < 3; i++) {
      const next = norm(current.replace(ending, '').replace(/\s*\((?:M|Malaysia|Asia)\)\s*$/i, ''));
      if (!next || next.toLowerCase() === current.toLowerCase()) break;
      current = next;
      if (current.length >= 4 && !current.split(' ').every((w) => isStop(w))) this.shortForm(base, current, i === 0 ? 'SHORT' : `SHORT${i + 1}`);
    }
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
    // Values a reviewer took off the list stay as they are from then on.
    for (const value of this.keep.slice().sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(value).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}_])`, 'giu');
      out = out.replace(re, (m) => { kept.push(m); return SENTINEL(kept.length - 1); });
    }
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
    this.countWords(text);
    this.facts.learn(text);
    const { text: safe } = this.protect(String(text || '').replace(TOKEN_RE, ' '));
    let rest = safe;
    // Found values are blanked out so the name rules do not see them. All the
    // spans found by one rule are blanked together, in one pass over the text.
    const blank = (spans) => {
      if (!spans.length) return;
      spans.sort((x, y) => x[0] - y[0]);
      let out = '';
      let at = 0;
      for (const [start, end] of spans) {
        if (start < at) continue;
        out += rest.slice(at, start) + rest.slice(start, end).replace(/[^\n]/g, ' ');
        at = end;
      }
      rest = out + rest.slice(at);
    };

    const addresses = [];
    const claimed = new Uint8Array(rest.length);
    for (const span of findAddresses(rest).sort((x, y) => (y.end - y.start) - (x.end - x.start))) {
      // The longest address wins: a street already inside a full address is not tagged again.
      if (claimed.subarray(span.start, span.end).some(Boolean)) continue;
      const value = rest.slice(span.start, span.end);
      if (!value.trim() || /^\s*$/.test(value)) continue;
      this.addId('ADDRESS', value.replace(/[,.\s]+$/, ''));
      claimed.fill(1, span.start, span.end);
      addresses.push([span.start, span.end]);
    }
    blank(addresses);
    for (const p of PATTERNS) {
      const spans = [];
      for (const m of rest.matchAll(p.re)) {
        const value = p.forward ? m.groups.__val : m[0];
        const at = p.forward ? m.index + m.groups.__pre.length : m.index;
        if (p.valid && !p.valid(value)) continue;
        if (!value.trim()) continue;
        this.addId(p.type, value);
        spans.push([at, at + value.length]);
      }
      blank(spans);
    }
    // Key search: hide what the map already knows, so the name rules only
    // look at what is left.
    rest = this.cloak.cloak(this.known(rest), { skipKnown: true, detectors: FORWARD_DETECTORS }).replace(TOKEN_RE, (m) => ' '.repeat(m.length));
    return findNames(rest);
  }

  /** Register candidates from the whole folder: longest names first, chat names last. */
  register(candidates) {
    const caps = (t) => (t === t.toUpperCase() ? 1 : 0);
    const order = candidates.filter((c) => !c.chat).sort((a, b) => nameWords(b.text).length - nameWords(a.text).length || caps(a.text) - caps(b.text) || b.text.length - a.text.length);
    for (const c of order) {
      if (c.kind === 'COMPANY') this.addCompany(c.text); else this.addPerson(c.text, c.why);
    }
    for (const c of candidates.filter((x) => x.chat)) this.addChatName(c.text);
    this.linkCommonFirstNames();
  }

  /**
   * A chat contact name, as saved in a phone: "Kak Ros", "Kala Manager",
   * "Alvin Ombak Biru". Company names and words that describe the person
   * (Manager, Lorry, Admin, Dapur...) are left out; what is left is the name.
   */
  addChatName(label) {
    let words = norm(label.replace(/[^\p{L}\p{N}\s'’.\/&@-]/gu, ' ')).split(' ').filter(Boolean);
    if (!words.length || words.some((w) => /\d/.test(w) || w.includes('@'))) return null;
    if ((this.cloak.byValue.get(words.join(' ').toLowerCase()) || '').startsWith('COMPANY_')) return null;
    for (let i = 0; i < words.length; i++) {
      for (let j = words.length; j > i; j--) {
        if (j - i === words.length) continue;
        const token = this.cloak.byValue.get(words.slice(i, j).join(' ').toLowerCase());
        if (token && token.startsWith('COMPANY_')) { words.splice(i, j - i); i--; break; }
      }
    }
    const titles = [];
    while (words.length > 1 && TITLE_WORDS.has(plainWord(words[0]))) titles.push(words.shift());
    const many = words.length > 1;
    words = words.filter((w) => !(LABEL_WORDS.has(plainWord(w)) || ROLE_NOUNS.has(plainWord(w)) || (many && /^\p{Lu}{2,4}$/u.test(w)) || (isStop(w) && !isNameWord(w) && !ORDINARY.has(plainWord(w)))));
    if (!words.length || words.length > 4 || !words.every((w) => strongNameLike(w) || PARTICLE_WORD.test(w))) return null;
    return this.addPerson([...titles, ...words].join(' '), 'chat speaker');
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
    // The one-pass search gives the same result as cloak() (test/fast.test.js), much faster on big files.
    const cloaked = this.cloak.cloak(this.known(this.protect(String(text || '')).text), { skipKnown: true, detectors: FORWARD_DETECTORS });
    const re = /\{\{((?:PERSON|COMPANY)_\d+)[^}]*\}\}\s*(?:\([^()]{0,40}\)\s*)?\(\s*(?:hereinafter\s+(?:referred\s+to\s+as|called)\s+|selepas\s+ini\s+(?:dirujuk|disebut)\s+sebagai\s+|collectively\s+)?["“'‘]([^"”'’]{2,40})["”'’]\s*\)/gi;
    for (const m of cloaked.matchAll(re)) {
      const alias = norm(m[2]);
      const tag = /^\{\{(PERSON_\d+)[^}]*\}\}$/.exec(alias);
      if (tag && m[1].startsWith('PERSON_')) { this.joinAlias(m[1], tag[1]); continue; }
      if (ROLE_ALIAS.test(alias) || /\{\{/.test(alias) || alias.split(' ').every((w) => isStop(w))) continue;
      this.shortForm(m[1], alias, 'ALIAS');
    }
    this.learnAliases(cloaked);
  }

  /**
   * Other names the text gives a person, joined to that person's tag:
   *   "{{PERSON_1}} (also known as Alvin Lee)", "known in the family as Along"
   *   "My staff call me Kak Ros"        -> the person the statement is by
   *   "everyone calls him Pai", "whom the staff call Uncle Khoo"
   *                                     -> the last person named before it
   *   "{{PERSON_1}} (Pai)"              -> one name in brackets after a person
   *   "calls {{PERSON_1}} "Pai""
   */
  learnAliases(cloaked) {
    const TITLE = String.raw`(?:(?:${ALL_TITLES_RE})\.?[ \t]+|\{\{PERSON_\d+\.TITLE\d*\}\}[ \t]+)?`;
    const VALUE = String.raw`["“'‘]?${TITLE}(?:\{\{(PERSON_\d+(?:\.[A-Z0-9_]+)?)\}\}|(\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*){0,2}))`;
    const known = new RegExp(String.raw`\{\{(PERSON_\d+)[^}]*\}\}[^.!?\n{}]{0,40}?(?<![\p{L}])(?:also |juga |lebih )?(?:known(?: in the family| to [\p{Ll} ]{2,25})? as|a\.?k\.?a\.?|dikenali sebagai|dipanggil|nicknamed|alias)[ \t]+${VALUE}`, 'gu');
    for (const m of cloaked.matchAll(known)) this.joinAlias(m[1], m[2], m[3]);
    const self = new RegExp(String.raw`(?:^|\n)[ \t]*(?:I|Saya),[ \t]+(?:\{\{PERSON_\d+\.TITLE\d*\}\}[ \t]+)?(?:(?:${ALL_TITLES_RE})\.?[ \t]+)*\{\{(PERSON_\d+)|(?:[Mm]y name is|[Nn]ama saya(?: ialah| adalah)?)[ \t]+\{\{(PERSON_\d+)|(?:STATEMENT OF|AFFIDAVIT OF|AFIDAVIT|DECLARATION OF)[ \t]+(?:\{\{PERSON_\d+\.TITLE\d*\}\}[ \t]+)?(?:\p{Lu}+[ \t]+)?\{\{(PERSON_\d+)`, 'u').exec(cloaked);
    const selfTag = self && (self[1] || self[2] || self[3]);
    if (selfTag) for (const m of cloaked.matchAll(new RegExp(String.raw`(?<![\p{L}])(?:calls?|called|panggil) (?:me|saya)[ \t]+${VALUE}`, 'gu'))) this.joinAlias(selfTag, m[1], m[2]);
    for (const m of cloaked.matchAll(new RegExp(String.raw`(?<![\p{L}])(?:(?:calls?|called) (?:him|her)|whom (?:[\p{Ll}'’]+ ){0,3}calls?)[ \t]+${VALUE}`, 'gu'))) {
      const paragraph = cloaked.slice(0, m.index).split(/\n[ \t]*\n/).pop();
      const tags = [...paragraph.matchAll(/\{\{(PERSON_\d+)(?!\.TITLE)[^}]*\}\}/g)];
      if (tags.length) this.joinAlias(tags[tags.length - 1][1], m[1], m[2]);
    }
    for (const m of cloaked.matchAll(new RegExp(String.raw`\{\{(PERSON_\d+)[^}]*\}\}[ \t]*\([ \t]*(?:\{\{(PERSON_\d+(?:\.[A-Z0-9_]+)?)\}\}|(\p{Lu}[\p{L}'’-]*(?:[ \t]+\p{Lu}[\p{L}'’-]*){0,2}))[ \t]*\)`, 'gu'))) this.joinAlias(m[1], m[2], m[3]);
    for (const m of cloaked.matchAll(/(?:calls?|called)[ \t]+\{\{(PERSON_\d+)[^}]*\}\}[ \t]+["“'‘](?:\{\{(PERSON_\d+(?:\.[A-Z0-9_]+)?)\}\}|([^"”'’{}\n]{2,40}))["”'’]/gu)) this.joinAlias(m[1], m[2], m[3]);
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
    // Chinese, Japanese and Thai are written without spaces between words,
    // so a term in those scripts is matched wherever it appears.
    let spaced = lifted;
    for (const e of this.cloak.entries.filter((x) => x.match !== false && NO_SPACES.test(x.value)).sort((x, y) => y.value.length - x.value.length)) spaced = spaced.split(e.value).join(`{{${e.token}}}`);
    let out = this.cloak.cloak(this.known(this.hideInitials(spaced), { context: true }), { skipKnown: true, detectors: FORWARD_DETECTORS });
    // An honour in front of a person's tag becomes part of the tag;
    // anywhere else it goes back as it was.
    out = out.replace(HONOUR_MARK_RE, (m, c, after, base) => (base ? `{{${this.titleFor(base, norm(honours[c.codePointAt(0) - 0x100000]))}}} ` : honours[c.codePointAt(0) - 0x100000]));
    return this.facts.apply(restore(out));
  }

  /**
   * Words in a cloaked file or folder name. Every one that is not an ordinary
   * document word goes on the "not sure" list, because names often sit in them.
   */
  unsureFromNames(cloakedName, safeWords = []) {
    const DOC_WORDS = new Set('writ statement claim affidavit affirmation letter demand reply reminder email note notes bundle documents document agreement sale purchase defence counterclaim defense notice judgment judgement search company profile board resolution memo schedule payment invoice receipt statement bank confirmation witness exhibit exhibits annex annexes scanned photo copy draft final version page pages file files folder client docs correspondence pleadings court order orders submission submissions written chronology internal test matter chat export slip transfer aging summary prepared guarantee guarantor demand attendance telephone call cheque'.split(' '));
    const safe = new Set([...safeWords, ...this.safeWords, ...this.keep].map((w) => w.toLowerCase()));
    const out = [];
    for (const w of String(cloakedName).replace(TOKEN_RE, ' ').match(/\p{L}[\p{L}'-]{2,}/gu) || []) {
      const low = w.toLowerCase();
      if (safe.has(low) || DOC_WORDS.has(low) || isStop(w) || NOT_NAMES.has(low) || out.some((o) => o.text === w)) continue;
      out.push({ text: w, count: 1, fromName: true });
    }
    return out;
  }

  /** Words in cloaked text that still look like names. */
  unsure(cloaked, safeWords = []) {
    const safe = new Set([...safeWords, ...this.safeWords].map((w) => w.toLowerCase()));
    const { text } = this.protect(cloaked);
    const plain = text.replace(SENTINEL_RE, ' ').replace(TOKEN_RE, ' | ');
    const caps = new Map();
    for (const m of plain.matchAll(/(?<![\p{L}])\p{Lu}{2,}(?:[ ]\p{Lu}{2,}){1,4}(?![\p{L}])/gu)) {
      const words = m[0].split(' ').filter((w) => !isStop(w));
      if (words.length >= 2) caps.set(words.join(' '), (caps.get(words.join(' ')) || 0) + 1);
    }
    const list = [...findSuspects(text.replace(SENTINEL_RE, ' ')), ...[...caps].map(([t, count]) => ({ text: t, count }))]
      .map((s) => ({ ...s, text: s.text.split(/\s+/).filter((w) => !NOT_NAMES.has(w.toLowerCase())).join(' ') }))
      .filter((s) => s.text.length > 1 && !safe.has(s.text.toLowerCase()) && !s.text.split(/[ -]/).every((w) => isStop(w)))
      // A title left in front of a tag ("Kak {{PERSON_1}}") is not a name.
      .filter((s) => !s.text.split(/\s+/).every((w) => TITLE_WORDS.has(plainWord(w))));
    // A known name that is also an ordinary word, left as it is where it may be
    // the ordinary word: "may said the cheque is ready", "Mark the pallets".
    const ordinary = this.ordinaryNames();
    if (ordinary) {
      const counts = new Map();
      for (const m of plain.matchAll(ordinary)) {
        const end = m.index + m[0].length;
        const lower = m[0] === m[0].toLowerCase();
        if (lower ? lowerNameContext(plain, m.index, end) : ordinaryUse(plain, m.index, end) === 'start') counts.set(m[0], (counts.get(m[0]) || 0) + 1);
      }
      for (const [t, count] of counts) if (!safe.has(t.toLowerCase()) && !list.some((s) => s.text === t)) list.push({ text: t, count });
    }
    // A first name from the name lists at the start of a sentence ("Sharon to
    // open a new file") is not caught by the check for capitals mid-sentence.
    const starts = new Map();
    for (const m of plain.matchAll(/(?:^|[.!?:;][ \t]+|\n[ \t]*(?:[-•*][ \t]*)?)(\p{Lu}\p{Ll}+)(?=[ \t]+\p{Ll})/gu)) {
      if (isNameWord(m[1]) && !AMBIGUOUS.has(m[1].toLowerCase()) && !isStop(m[1])) starts.set(m[1], (starts.get(m[1]) || 0) + 1);
    }
    for (const [t, count] of starts) if (!safe.has(t.toLowerCase()) && !list.some((s) => s.text === t)) list.push({ text: t, count });
    return list;
  }

  /** Initials of known people (two or three letters, only when one person has them): "JN" for Jeremy Ng. */
  initialsIndex() {
    const entries = this.cloak.entries;
    if (this.initialsCache && this.initialsCache.cloak === this.cloak && this.initialsCache.size === entries.length) return this.initialsCache.map;
    const map = new Map();
    const clash = new Set();
    for (const e of entries) {
      if (!/^PERSON_\d+$/.test(e.token)) continue;
      const words = nameWords(e.value).filter((w) => !PARTICLE_WORD.test(w) && /^\p{Lu}/u.test(w));
      for (const ws of [words, words.filter((w) => !GENERIC_PARTS.has(w.toLowerCase()))]) {
        if (ws.length < 2 || ws.length > 3) continue;
        const ini = ws.map((w) => w[0].toUpperCase()).join('');
        if (COMMON_SHORT.has(ini)) continue;
        if (map.has(ini) && map.get(ini) !== e.token) clash.add(ini); else map.set(ini, e.token);
      }
    }
    for (const c of clash) map.delete(c);
    this.initialsCache = { cloak: this.cloak, size: entries.length, map };
    return map;
  }

  /**
   * Initials in the places a file note signs them: a line with nothing else,
   * or after "Attendance:", "Note taken by", "Prepared by"... Elsewhere two or
   * three capitals are left alone ("DO", "QS").
   */
  hideInitials(text) {
    const index = this.initialsIndex();
    if (!index.size) return text;
    return text.replace(INITIALS_PLACE, (m, lineStart, spaces, alone, label, after) => {
      const value = alone || after;
      const base = index.get(value);
      if (!base) return m;
      let token = this.cloak.entries.find((e) => e.token.startsWith(`${base}.INITIALS`) && e.value === value)?.token;
      if (!token) {
        token = `${base}.INITIALS`;
        for (let n = 2; this.cloak.byToken.has(token); n++) token = `${base}.INITIALS${n}`;
        this.cloak.register(token, value, { match: false });
      }
      return alone ? `${lineStart}${spaces}{{${token}}}` : `${label}{{${token}}}`;
    });
  }

  /** The key: tag -> real value. Stays on this machine. */
  key() {
    return this.cloak.toJSON();
  }

  /** Everything needed to carry on with this matter later (goes in the encrypted key file). */
  state() {
    return {
      options: this.options,
      entries: this.cloak.toJSON().entries,
      people: [...this.people],
      companies: [...this.companies],
      ids: [...this.ids],
      kinds: [...this.kinds],
      merges: this.merges,
      ambiguous: this.ambiguous,
      // Numbers are never reused, even after a tag is removed: an old draft
      // must not restore to a different person.
      counters: [...this.cloak.counters],
      keep: this.keep,
      safeWords: this.safeWords,
      facts: this.facts.state(),
      roles: this.roles,
      setup: this.setup,
    };
  }

  static fromState(state, options) {
    const m = new Matter({ options: { ...state.options, ...options }, key: { entries: state.entries } });
    m.people = new Map(state.people);
    m.companies = new Map(state.companies);
    m.resetIndexes();
    m.ids = new Map(state.ids);
    m.kinds = new Map(state.kinds);
    m.merges = state.merges || [];
    m.ambiguous = state.ambiguous || [];
    for (const [prefix, n] of state.counters || []) if (n > (m.cloak.counters.get(prefix) || 0)) m.cloak.counters.set(prefix, n);
    m.keep = state.keep || [];
    m.safeWords = state.safeWords || [];
    if (state.facts) m.facts = Facts.fromState(state.facts);
    m.roles = state.roles || {};
    m.setup = state.setup || { client: '', others: '' };
    return m;
  }
}
