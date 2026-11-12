// What a person can do on the review screen, and what the screen shows.
//
// Every change is applied to the shared name map, so it takes effect in every
// file of the matter at once.

import { Cloak, Matter, TOKEN_RE, norm, personKey, companyKey } from './engine.js';

const baseOf = (token) => token.split('.')[0];
const typeOf = (token) => baseOf(token).replace(/_\d+$/, '');

/** Replace the map's entries, keeping the counters so numbers are never reused. */
function rebuild(matter, entries) {
  const counters = new Map(matter.cloak.counters);
  matter.cloak = Cloak.fromJSON({ entries });
  for (const [k, n] of counters) if (n > (matter.cloak.counters.get(k) || 0)) matter.cloak.counters.set(k, n);
}

function freeName(taken, wanted) {
  if (!taken.has(wanted)) return wanted;
  for (let n = 2; ; n++) if (!taken.has(`${wanted}${n}`)) return `${wanted}${n}`;
}

/** Hide a term the tool missed. kind: PERSON, COMPANY or OTHER. */
export function addTerm(matter, text, kind = 'OTHER') {
  const value = norm(text);
  if (value.length < 2) throw new Error('Type the word or name to hide.');
  if (TOKEN_RE.test(value)) { TOKEN_RE.lastIndex = 0; throw new Error('That is already a tag.'); }
  TOKEN_RE.lastIndex = 0;
  // Taking a word back off the "leave as it is" lists.
  matter.keep = matter.keep.filter((k) => k.toLowerCase() !== value.toLowerCase());
  matter.safeWords = matter.safeWords.filter((k) => k.toLowerCase() !== value.toLowerCase());
  const existing = matter.cloak.byValue.get(value.toLowerCase());
  if (existing) return existing;
  let token;
  if (kind === 'PERSON') { token = matter.addPerson(value, 'added in review'); matter.linkCommonFirstNames(); }
  else if (kind === 'COMPANY') token = matter.addCompany(value);
  else token = matter.cloak.register(matter.cloak.nextToken('TERM'), value);
  matter.kinds.set(baseOf(token), 'added in review');
  return token;
}

/**
 * Stop hiding something that is not confidential. A whole tag (PERSON_3) or
 * one form of it (PERSON_3.SURNAME). The value is remembered so it is not
 * picked up again on the next run.
 */
export function removeTerm(matter, token) {
  const whole = !token.includes('.');
  const gone = matter.cloak.entries.filter((e) => (whole ? baseOf(e.token) === token : e.token === token));
  if (!gone.length) throw new Error('That tag is not in this matter.');
  for (const e of gone) if (e.match !== false && !matter.keep.some((k) => k.toLowerCase() === e.value.toLowerCase())) matter.keep.push(e.value);
  rebuild(matter, matter.cloak.toJSON().entries.filter((e) => !gone.some((g) => g.token === e.token)));
  if (whole) {
    for (const map of [matter.people, matter.companies, matter.ids]) for (const [k, v] of [...map]) if (baseOf(v) === token) map.delete(k);
    matter.kinds.delete(token);
  }
  matter.merges = matter.merges.filter((m) => !gone.some((g) => g.token === m.token) && m.into !== (whole ? token : null));
  matter.ambiguous = matter.ambiguous.filter((a) => !gone.some((g) => g.token === a.token) && !(whole && (a.also === token || baseOf(a.token) === token)));
}

/** Two tags are the same person or company: fold `from` into `into`. */
export function mergeTags(matter, from, into) {
  from = baseOf(from);
  into = baseOf(into);
  if (from === into) throw new Error('Those are already the same tag.');
  const entries = matter.cloak.toJSON().entries;
  if (!entries.some((e) => e.token === from) || !entries.some((e) => e.token === into)) throw new Error('That tag is not in this matter.');
  const taken = new Set(entries.filter((e) => baseOf(e.token) !== from).map((e) => e.token));
  let mainToken = null;
  const renamed = entries.map((e) => {
    if (baseOf(e.token) !== from) return e;
    const ending = e.token === from ? 'ALT' : e.token.slice(from.length + 1).replace(/\d+$/, '');
    const name = freeName(taken, `${into}.${ending}`);
    taken.add(name);
    if (e.token === from) mainToken = name;
    return { ...e, token: name };
  });
  rebuild(matter, renamed);
  for (const map of [matter.people, matter.companies, matter.ids]) for (const [k, v] of [...map]) if (baseOf(v) === from) map.set(k, into);
  matter.kinds.delete(from);
  matter.merges = matter.merges.filter((m) => baseOf(m.token || '') !== from && m.into !== from);
  matter.merges.push({ token: mainToken, into, reason: 'merged by a reviewer', confirmed: true });
  matter.ambiguous = matter.ambiguous.filter((a) => !((baseOf(a.token) === from && a.also === into) || (baseOf(a.token) === into && a.also === from)));
  return mainToken;
}

/** A form that was joined to a tag is really someone else: give it its own tag. */
export function splitForm(matter, token) {
  if (!token.includes('.')) throw new Error('Pick one form of the name to split off.');
  const entries = matter.cloak.toJSON().entries;
  const entry = entries.find((e) => e.token === token);
  if (!entry) throw new Error('That tag is not in this matter.');
  const type = typeOf(token);
  const fresh = matter.cloak.nextToken(type);
  rebuild(matter, entries.map((e) => (e.token === token ? { ...e, token: fresh } : e)));
  // Remember it under its own key so the next run does not join them again.
  if (type === 'PERSON') matter.people.set(personKey(entry.value), fresh);
  else if (type === 'COMPANY') matter.companies.set(companyKey(entry.value), fresh);
  else for (const [k, v] of [...matter.ids]) if (v === baseOf(token) && k.startsWith(`${type}|`) && k.toLowerCase().includes(entry.value.toLowerCase().replace(/\W/g, ''))) matter.ids.delete(k);
  matter.kinds.set(fresh, 'split off by a reviewer');
  matter.merges = matter.merges.filter((m) => m.token !== token);
  matter.splits = [...(matter.splits || []), { value: entry.value, from: baseOf(token), to: fresh }];
  return fresh;
}

/** A join the tool made is right. */
export function confirmMerge(matter, token) {
  const m = matter.merges.find((x) => x.token === token);
  if (m) m.confirmed = true;
}

/** A short form that could be two people is tagged correctly. */
export function confirmShortForm(matter, token, also) {
  const a = matter.ambiguous.find((x) => x.token === token && x.also === also);
  if (a) a.confirmed = true;
}

/** A "not sure" word is not a name. */
export function markFine(matter, word) {
  const value = norm(word);
  if (value && !matter.safeWords.some((w) => w.toLowerCase() === value.toLowerCase())) matter.safeWords.push(value);
}

/** Everything the review screen shows, computed from the current cloaked files. */
export function reviewData(matter, files) {
  const entries = matter.cloak.toJSON().entries;
  const valueOf = new Map(entries.map((e) => [e.token, e.value]));

  // Where each tag appears: places and files.
  const places = new Map();
  const inFiles = new Map();
  for (const f of files) {
    if (!f.cloaked) continue;
    const seen = new Set();
    for (const m of f.cloaked.matchAll(TOKEN_RE)) {
      places.set(m[1], (places.get(m[1]) || 0) + 1);
      for (const key of [m[1], baseOf(m[1])]) {
        if (seen.has(key)) continue;
        seen.add(key);
        inFiles.set(key, (inFiles.get(key) || 0) + 1);
      }
    }
  }

  const terms = new Map();
  for (const e of entries) {
    const base = baseOf(e.token);
    if (!terms.has(base)) terms.set(base, { tag: base, type: typeOf(base), value: valueOf.get(base) ?? e.value, how: matter.kinds.get(base) || 'pattern rule', forms: [], places: 0, files: inFiles.get(base) || 0 });
    const t = terms.get(base);
    const n = places.get(e.token) || 0;
    t.forms.push({ tag: e.token, value: e.value, places: n, files: inFiles.get(e.token) || 0 });
    t.places += n;
  }

  // Each "not sure" word once, with where it appears.
  const unsure = new Map();
  for (const f of files) {
    for (const u of f.unsure || []) {
      if (!unsure.has(u.text)) unsure.set(u.text, { text: u.text, places: 0, files: 0, examples: [] });
      const item = unsure.get(u.text);
      item.places += u.count;
      item.files++;
      if (item.examples.length < 2) {
        const i = f.cloaked.indexOf(u.text);
        if (i >= 0) item.examples.push(`…${f.cloaked.slice(Math.max(0, i - 50), i + u.text.length + 50).replace(/\s+/g, ' ')}…`);
      }
    }
  }

  // Two forms that differ only in capitals, spacing, punctuation or the way
  // bin / binti is abbreviated are plainly the same: no need to ask.
  const plain = (v) => String(v || '').toLowerCase().replace(/\b(?:binti|bt|bte)\b\.?/g, 'binti').replace(/\bb\.|\bbin\b/g, 'bin').replace(/[^\p{L}\p{N}]/gu, '');
  const merges = matter.merges.filter((m) => m.token && !m.confirmed && valueOf.has(m.token) && plain(valueOf.get(m.token)) !== plain(valueOf.get(m.into))).map((m) => ({ tag: m.token, value: valueOf.get(m.token), into: m.into, intoValue: valueOf.get(m.into), reason: m.reason }));
  const shortForms = matter.ambiguous.filter((a) => !a.confirmed && valueOf.has(a.token) && valueOf.has(a.also)).map((a) => ({ tag: a.token, value: valueOf.get(a.token), belongsTo: baseOf(a.token), belongsToValue: valueOf.get(baseOf(a.token)), also: a.also, alsoValue: valueOf.get(a.also) }));

  return {
    terms: [...terms.values()].sort((a, b) => a.type.localeCompare(b.type) || Number(a.tag.match(/\d+$/)[0]) - Number(b.tag.match(/\d+$/)[0])),
    unsure: [...unsure.values()].sort((a, b) => b.places - a.places || a.text.localeCompare(b.text)),
    merges,
    shortForms,
    kept: matter.keep,
    fine: matter.safeWords,
  };
}

export { Matter };
