// The context sheet that goes with every Strict export.
//
// It tells the AI what the tags mean without telling it any real value:
//   - the rules for working with tags,
//   - a cast list (who is a party, a witness, an agent, and how they relate),
//   - a date table (time order and gaps in days),
//   - an amount table (which is larger, which adds up to which),
//   - what kind of thing each tag is (bank, court, property, vessel...).
//
// It is built from the cloaked text and the key, and then checked like any
// other file. The roles are read from the wording next to each tag by simple
// rules: they are a starting point, and a reviewer can correct each one.

import { TOKEN_RE } from './engine.js';

const baseOf = (t) => t.split('.')[0];
const typeOf = (t) => baseOf(t).replace(/_\d+$/, '');

export const AI_RULES = [
  'All documents here are cloaked. Tags like {{PERSON_1}}, {{AMOUNT_2}}, {{DATE_3}} and {{PLACE_1}} stand for real values you must not know.',
  '- Keep every tag exactly as written. Never rename, merge, guess or drop one.',
  '- Date tags are numbered in time order. Use that order. Do not invent real dates.',
  '- Do not calculate with amount tags. If a total is needed, write [TOTAL NEEDED: AMOUNT_1 + AMOUNT_2] for the lawyer.',
  '- If you see what looks like a real name, amount, date or place, stop and say so.',
];

const ROLE_WORDS = [
  ['plaintiff', /\b(?:plaintiff|plaintif|claimant)\b/i], ['defendant', /\b(?:defendants?|defendan(?:-defendan)?)\b/i], ['applicant', /\b(?:applicant|pemohon)\b/i], ['respondent', /\b(?:respondent|responden)\b/i],
  ['managing director', /\b(?:managing director|pengarah urusan)\b/i], ['finance director', /\bfinance director\b/i], ['director', /\b(?:director|pengarah)\b/i],
  ['estate agent', /\b(?:estate agent|property agent|ejen hartanah)\b/i], ['agent', /\b(?:agent|ejen)\b/i],
  ['branch manager', /\bbranch manager\b/i], ['sales manager', /\bsales manager\b/i], ['manager', /\bmanager\b/i],
  ['solicitor', /\b(?:solicitors?|advocates?|peguamcara|peguam|partner)\b/i], ['commissioner for oaths', /\b(?:commissioner for oaths|pesuruhjaya sumpah)\b/i],
  ['witness', /\b(?:witness|saksi)\b/i], ['wife', /\b(?:wife|isteri)\b/i], ['husband', /\b(?:husband|suami)\b/i], ['mother', /\b(?:mother|ibu)\b/i], ['friend', /\bfriend\b/i],
  ['deponent', /\b(?:deponent|saya)\b(?=[^.]*\bberikrar|\bdo solemnly)/i],
];

/**
 * Roles and relationships next to each person or company tag, read from the
 * cloaked text: the words between a tag and the tags on either side of it, on
 * the same line.
 */
export function castList(matter, files) {
  const roles = new Map();
  const relations = new Map();
  const filesOf = new Map();
  const note = (map, tag, value) => map.set(tag, [...new Set([...(map.get(tag) || []), value])]);
  const REL = /\b(wife|husband|mother|father|friend|director|finance director|managing director|manager|agent|solicitor|employee|partner|isteri|suami)\s+(?:of|at|for|to|kepada)\s+(?:the (plaintiff|defendant|first defendant|second defendant)|\{\{((?:PERSON|COMPANY)_\d+))/i;
  for (const f of files) {
    if (!f.cloaked) continue;
    const seen = new Set();
    for (const line of f.cloaked.split(/\n/)) {
      const found = [...line.matchAll(TOKEN_RE)].filter((m) => /^(?:PERSON|COMPANY)_/.test(baseOf(m[1])));
      for (const [i, m] of found.entries()) {
        const tag = baseOf(m[1]);
        if (!seen.has(tag)) { seen.add(tag); filesOf.set(tag, (filesOf.get(tag) || 0) + 1); }
        const end = m.index + m[0].length;
        const prev = found[i - 1];
        const next = found[i + 1];
        // Words after this tag, up to the next person or company tag or the end of the sentence.
        // Only a direct description counts: "TAG, the finance director" / "TAG (the Plaintiff)" / "TAG ... PLAINTIFF" after the tag,
        // "the estate agent, Mr TAG" / "Defendan Kedua, Dato' Sri TAG" before it. Words that merely sit nearby ("told my husband") do not.
        let after = line.slice(end, next ? next.index : line.length).slice(0, 70).split(/(?<=[.;])\s/)[0];
        let before = line.slice(prev ? prev.index + prev[0].length : 0, m.index).slice(-45).split(/(?<=[.;])\s/).pop();
        // "the wife of the Plaintiff, TAG": the person named is the Plaintiff, not the wife.
        const appos = /(?:wife|husband|mother|father|friend|director|manager|agent|isteri|suami)\s+of\s+(?:the\s+(plaintiff|defendant|first defendant|second defendant)|\{\{[^}]*\}\})\s*,\s*(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Encik|Puan|Cik|Dato'?|Datuk)?\s*$/i.exec(before);
        if (appos) { if (appos[1]) note(roles, tag, appos[1].toLowerCase().replace(/^(first|second) /, '')); before = ''; }
        const forCompany = new Set(['plaintiff', 'defendant', 'applicant', 'respondent', 'solicitor']);
        const afterHead = /^\s*(?:[,(]|\.\.\.|\bis\b|\bwas\b|\bas\b|\bialah\b|\bsebagai\b)\s*(?:the |a |an |my |our |his |her )?[^,.;{}]{0,28}?(?=\b)/i.exec(after);
        const afterText = afterHead ? after.slice(0, afterHead[0].length + 12) : '';
        const beforeHead = /(?:[\p{L}]+\s+[\p{L}]+,\s*|the\s+|a\s+|an\s+|\bis\b\s+)?(?:[\p{L} ]{0,22})(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Encik|Puan|Cik|Dato'?|Datuk|Tan Sri|Dato' Sri|Datin)?\s*$/iu.exec(before);
        const beforeText = beforeHead ? beforeHead[0] : '';
        for (const [role, re] of ROLE_WORDS) {
          if (!tag.startsWith('PERSON_') && !forCompany.has(role)) continue;
          if (re.test(afterText) || re.test(beforeText)) note(roles, tag, role);
        }
        const rel = REL.exec(`${afterText} `) || REL.exec(`${beforeText} `);
        if (rel) note(relations, tag, `${rel[1].toLowerCase()} of ${rel[2] ? `the ${rel[2].toLowerCase()}` : `{{${rel[3]}}}`}`);
      }
    }
  }
  // Job titles that point to one person are hidden in the documents ({{JOB_n}}), so the sheet does not bring them back.
  const generic = (r) => (['managing director', 'finance director', 'director', 'branch manager', 'sales manager', 'manager'].includes(r) ? 'company officer' : r);
  const override = matter.roles || {};
  const list = [];
  for (const e of matter.cloak.entries.filter((x) => !x.token.includes('.') && /^(?:PERSON|COMPANY)_/.test(x.token))) {
    const tag = e.token;
    // Specific roles replace the general ones that contain them (director inside managing director).
    const mine = [...new Set((roles.get(tag) || []).map(generic))];
    const clean = mine.filter((r) => !mine.some((o) => o !== r && o.includes(r)));
    list.push({ tag, kind: typeOf(tag) === 'PERSON' ? 'person' : 'company', roles: override[tag]?.roles ?? clean, relationships: override[tag]?.relationships ?? (relations.get(tag) || []), files: filesOf.get(tag) || 0, edited: !!override[tag] });
  }
  return list.sort((a, b) => a.kind.localeCompare(b.kind) || Number(a.tag.match(/\d+$/)[0]) - Number(b.tag.match(/\d+$/)[0]));
}

const COMPANY_CLASSES = [['bank', /\b(?:bank|maybank|cimb|rhb|ambank|public bank|hong leong)\b/i], ['court', /\b(?:court|mahkamah|registry)\b/i], ['law firm', /\b(?:tetuan|messrs|& partners|advocates|peguam)\b/i], ['government body', /\b(?:jabatan|lembaga|suruhanjaya|kementerian|ministry|authority)\b/i], ['developer', /\b(?:development|developer|pemaju|properties|holdings)\b/i]];
const TYPE_WORDS = { ACCOUNT: 'bank account number', NRIC: 'national identity number', MY_IC: 'national identity number', PASSPORT: 'passport number', PHONE: 'telephone number', EMAIL: 'email address', ADDRESS: 'street address', POSTCODE: 'postcode', LAND: 'property title or lot', CASE: 'court case number', CASE_NO: 'court case number', VEHICLE: 'vehicle registration', COMPANY_NO: 'company registration number', TAX_NO: 'tax number', ID_NUMBER: 'reference or identity number', PASSAGE: 'passage in a non-Latin script, hidden whole', LOCATION: 'place where a photo was taken', TERM: 'a term the reviewer chose to hide', DATE: 'date', AMOUNT: 'amount of money', REF: 'contract, invoice, cheque or reference number', PERCENT: 'percentage', PATH: 'folder name in the source location', UEN: 'company registration number' };

/** What kind of thing each tag is. */
export function tagTypes(matter) {
  const rows = [];
  for (const e of matter.cloak.entries) {
    if (e.token.includes('.')) continue;
    const type = typeOf(e.token);
    let what = TYPE_WORDS[type] || type.toLowerCase().replace(/_/g, ' ');
    if (type === 'PERSON') what = 'person';
    if (type === 'COMPANY') {
      const hit = COMPANY_CLASSES.find(([, re]) => re.test(e.value));
      what = hit ? `company (${hit[0]})` : 'company';
    }
    rows.push({ tag: e.token, what });
  }
  const numeric = (t) => Number(t.match(/\d+$/)[0]);
  return rows.sort((a, b) => typeOf(a.tag).localeCompare(typeOf(b.tag)) || numeric(a.tag) - numeric(b.tag));
}

/** The whole context sheet, as text. Contains no real value. */
export function contextSheet(matter, files, { version = '' } = {}) {
  const cast = castList(matter, files);
  const out = ['CONTEXT SHEET FOR THE AI', version ? `Cloak ${version}` : '', '', 'RULES', ...AI_RULES, ''];
  out.push('CAST LIST (people and companies: role and relationships only; read automatically from the wording, so check it)');
  for (const c of cast) out.push(`- {{${c.tag}}} (${c.kind}${c.roles.length ? `; ${c.roles.join(', ')}` : ''}${c.relationships.length ? `; ${c.relationships.join('; ')}` : ''}) appears in ${c.files} file${c.files === 1 ? '' : 's'}`);
  out.push('');
  if (matter.facts.on) {
    const dates = matter.facts.dateTable();
    out.push('DATE TABLE (date tags are in time order; gaps are in days from the date before; no real dates)');
    for (const d of dates) out.push(`- {{${d.tag}}}${d.gap_days === null ? '' : `: ${d.gap_days} day${d.gap_days === 1 ? '' : 's'} after the one before`}${d.note ? ` (${d.note})` : ''}`);
    out.push('', 'AMOUNT TABLE (comparisons only; no real figures)');
    const amounts = matter.facts.amountTable();
    for (const r of amounts.ranking) if (r.largest_to_smallest.length) out.push(`- largest to smallest${r.currency_group ? ` (${r.currency_group})` : ''}: ${r.largest_to_smallest.map((t) => `{{${t}}}`).join(' > ')}`);
    for (const s of amounts.sums) out.push(`- ${s.replace(/(AMOUNT_\d+)/g, '{{$1}}')}`);
    if (!amounts.sums.length) out.push('- no amount is the sum of two others');
    out.push('');
  }
  out.push('WHAT EACH TAG IS');
  for (const t of tagTypes(matter)) out.push(`- {{${t.tag}}}: ${t.what}`);
  return `${out.filter((l, i) => l !== '' || out[i - 1] !== '').join('\n')}\n`;
}
