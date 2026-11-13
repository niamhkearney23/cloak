// Put the real values back into a draft the AI wrote, and report what the AI did to the tags.
//
//   invented   - a tag that is not in the key (the AI made it up)
//   changed    - a tag that was damaged: braces lost, brackets instead, a different ending
//   dropped    - a tag that had to be in the draft (the lawyer listed it) and is not
//   totals     - "[TOTAL NEEDED: ...]" notes still standing (could not be worked out)
//   worked     - totals Cloak worked out itself from such notes, with the tag it gave them
//   real       - something in the draft that looks like a real value (a fact the key holds, written out in full)
//   notes      - drafting notes left in the draft ("[FOR THE LAWYER ...", "to be confirmed by the lawyer")
//   translated - forms put back in the language of their sentence (month names, job titles, court names)
//   kept       - forms that stayed in the other language: inside a quotation, or with no translation
//   mixed      - a date left in a different language from its sentence, outside a quotation
//
// A fact is put back as it was written, in the language of the sentence it lands in: an English
// sentence gets "3 March 2023", not "3 Mac 2023", and "managing director", not "pengarah urusan",
// unless the tag is inside a quotation. A number that was a bare cell in a spreadsheet is put back
// as an amount of money ("RM 0.00") when it lands in a sentence.

import { TOKEN_RE } from './engine.js';
import { findDates, sweepFacts } from './facts.js';
import { formLanguage, textLanguage, translateForm } from './translate.js';

const NOTE = /\[[^\]\n]*(?:for the lawyer|to be confirmed|to be inserted|to be completed|to be filled|\btbc\b|\btbd\b|lawyer to|to confirm|insert)[^\]\n]*\]|\(?\b(?:to be confirmed|to be inserted|to be completed)\b[^.\n]*(?:by the lawyer|by counsel)[^.\n]*\)?/gi;

const bareAsAmount = (value, currency) => `${currency === 'MYR' || !currency ? 'RM' : currency} ${Number(value.replace(/,/g, '')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function restoreDraft(matter, draft, { required = [] } = {}) {
  let text = String(draft || '');
  // "[TOTAL NEEDED: AMOUNT_1 - AMOUNT_2]": Cloak works the total out itself, gives it its own tag and puts it in the same format.
  const worked = [];
  text = text.replace(/\[TOTAL NEEDED:\s*([^\]]*)\]/g, (marker, expr) => {
    const parts = [...expr.replace(/[{}]/g, '').matchAll(/([+-]?)\s*(AMOUNT_\d+(?:\.[A-Z0-9_]+)?)/g)].map((m) => `${m[1] === '-' ? '-' : ''}${m[2]}`);
    if (!parts.length || !matter.facts.on) return marker;
    try {
      const tag = matter.facts.total(parts);
      matter.facts.syncInto(matter.cloak);
      worked.push({ marker, tag });
      return `{{${tag}}}`;
    } catch (err) {
      worked.push({ marker, error: err.message });
      return marker;
    }
  });
  const invented = new Set();
  const changed = [];
  const used = new Set();
  const translated = [];
  const kept = [];
  const byToken = matter.cloak.byToken;
  const info = new Map((matter.facts.on ? matter.facts.entries() : []).map((e) => [e.token, e]));
  // The draft with every tag blanked out: sentence ends and quotation marks are looked for here, so a dot inside a tag is not a full stop.
  const flat = text.replace(/\{\{[^}]*\}\}/g, (m) => ' '.repeat(m.length));
  const docLanguage = textLanguage(flat) || 'en';
  const sentenceAt = (offset) => {
    let a = offset;
    while (a > 0 && !/[.!?\n]/.test(flat[a - 1])) a--;
    let b = offset;
    while (b < flat.length && !/[.!?\n]/.test(flat[b])) b++;
    return { start: a, text: flat.slice(a, b) };
  };
  const restored = text.replace(TOKEN_RE, (m, token, mod, offset) => {
    used.add(token.split('.')[0]);
    let value = byToken.get(token);
    if (value === undefined) {
      // A real base with an ending that does not exist is a changed tag.
      if (byToken.has(token.split('.')[0])) changed.push({ found: m, why: 'the ending was changed', base: token.split('.')[0] });
      else invented.add(m);
      return m;
    }
    if (mod) return matter.cloak.uncloak(m).text;
    const e = info.get(token);
    if (!e) return value;
    const lineStart = flat.lastIndexOf('\n', offset) + 1;
    const lineEnd = flat.indexOf('\n', offset);
    if (e.kind === 'amount' && e.bare && !/\t/.test(text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd))) value = bareAsAmount(value, e.currency);
    if (['date', 'job', 'court'].includes(e.kind) && (e.lang === 'en' || e.lang === 'ms' || e.lang === 'zh')) {
      const sentence = sentenceAt(offset);
      const lang = textLanguage(sentence.text) || docLanguage;
      if (lang !== e.lang) {
        const quotes = (flat.slice(sentence.start, offset).match(/["“”]/g) || []).length;
        if (quotes % 2 === 1) kept.push({ token, why: 'inside a quotation' });
        else {
          const date = e.kind === 'date' ? findDates(value)[0] : null;
          const t = translateForm(e.kind, value, lang, date);
          if (t) { translated.push({ token, from: e.lang, to: lang }); value = t; } else kept.push({ token, why: `no ${lang === 'en' ? 'English' : 'Malay'} form is known, so it stays as written` });
        }
      }
    }
    return value;
  });
  // Tags with their braces lost or replaced: PERSON_1, [PERSON_1], {PERSON_1}, {{ person_1 }}.
  for (const m of text.matchAll(/(?<![{A-Za-z0-9_])(?:\[|\{|\(){1,2}\s*([A-Z]+(?:_[A-Z]+)*_\d+(?:\.[A-Z0-9_]+)?)\s*(?:\]|\}|\)){1,2}/g)) {
    if (/^\{\{.*\}\}$/.test(m[0])) continue;
    if (byToken.has(m[1])) changed.push({ found: m[0], why: 'the double braces were changed', base: m[1].split('.')[0] });
  }
  for (const m of text.matchAll(/(?<![{[(A-Za-z0-9_])((?:PERSON|COMPANY|DATE|AMOUNT|REF|ACCOUNT|NRIC|PASSPORT|PHONE|EMAIL|LAND|CASE|ADDRESS|PLACE|JOB|COURT|PROJECT)_\d+(?:\.[A-Z0-9_]+)?)(?![}\])A-Za-z0-9_])/g)) {
    if (byToken.has(m[1])) changed.push({ found: m[0], why: 'written without its braces', base: m[1].split('.')[0] });
  }
  const dropped = required.map((t) => t.split('.')[0]).filter((t) => !used.has(t));
  const totals = [...text.matchAll(/\[TOTAL NEEDED:[^\]]*\]/g)].map((m) => m[0]);
  const real = matter.facts.on ? sweepFacts(matter.facts, text.replace(TOKEN_RE, ' ')) : [];
  const notes = [...restored.matchAll(NOTE)].map((m) => ({ text: m[0].trim() }));
  // A date still in the other language from its sentence (and not in a quotation).
  const mixed = [];
  const restoredFlat = restored;
  const restoredLanguage = textLanguage(restoredFlat) || docLanguage;
  for (const d of findDates(restoredFlat)) {
    const lang = formLanguage('date', d.text);
    if (lang !== 'en' && lang !== 'ms') continue;
    let a = d.start;
    while (a > 0 && !/[.!?\n]/.test(restoredFlat[a - 1])) a--;
    let b = d.end;
    while (b < restoredFlat.length && !/[.!?\n]/.test(restoredFlat[b])) b++;
    const sentenceLang = textLanguage(restoredFlat.slice(a, b)) || restoredLanguage;
    const quotes = (restoredFlat.slice(a, d.start).match(/["“”]/g) || []).length;
    if (lang !== sentenceLang && quotes % 2 === 0) mixed.push({ text: d.text, language: lang });
  }
  return { text: restored, invented: [...invented], changed, dropped: [...new Set(dropped)], totals, worked, real, notes, translated, kept, mixed, clean: !invented.size && !changed.length && !dropped.length && !real.length };
}
