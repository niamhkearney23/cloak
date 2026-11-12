// Put the real values back into a draft the AI wrote, and report what the AI did to the tags.
//
//   invented  - a tag that is not in the key (the AI made it up)
//   changed   - a tag that was damaged: braces lost, brackets instead, a different ending
//   dropped   - a tag that had to be in the draft (the lawyer listed it) and is not
//   totals    - "[TOTAL NEEDED: ...]" notes still standing (could not be worked out)
//   worked    - totals Cloak worked out itself from such notes, with the tag it gave them
//   real      - something in the draft that looks like a real value (a fact the key holds, written out in full)
//
// Every fact is put back exactly as it was written in the original: the same
// date format, the same currency format.

import { TOKEN_RE } from './engine.js';
import { sweepFacts } from './facts.js';

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
  const byToken = matter.cloak.byToken;
  const restored = text.replace(TOKEN_RE, (m, token, mod) => {
    used.add(token.split('.')[0]);
    const value = byToken.get(token);
    if (value === undefined) {
      // A real base with an ending that does not exist is a changed tag.
      if (byToken.has(token.split('.')[0])) changed.push({ found: m, why: 'the ending was changed', base: token.split('.')[0] });
      else invented.add(m);
      return m;
    }
    return mod ? matter.cloak.uncloak(m).text : value;
  });
  // Tags with their braces lost or replaced: PERSON_1, [PERSON_1], {PERSON_1}, {{ person_1 }}.
  for (const m of text.matchAll(/(?<![{A-Za-z0-9_])(?:\[|\{|\(){1,2}\s*([A-Z]+(?:_[A-Z]+)*_\d+(?:\.[A-Z0-9_]+)?)\s*(?:\]|\}|\)){1,2}/g)) {
    if (/^\{\{.*\}\}$/.test(m[0])) continue;
    if (byToken.has(m[1])) changed.push({ found: m[0], why: 'the double braces were changed', base: m[1].split('.')[0] });
  }
  for (const m of text.matchAll(/(?<![{[(A-Za-z0-9_])((?:PERSON|COMPANY|DATE|AMOUNT|REF|ACCOUNT|NRIC|PASSPORT|PHONE|EMAIL|LAND|CASE|ADDRESS)_\d+(?:\.[A-Z0-9_]+)?)(?![}\])A-Za-z0-9_])/g)) {
    if (byToken.has(m[1])) changed.push({ found: m[0], why: 'written without its braces', base: m[1].split('.')[0] });
  }
  const dropped = required.map((t) => t.split('.')[0]).filter((t) => !used.has(t));
  const totals = [...text.matchAll(/\[TOTAL NEEDED:[^\]]*\]/g)].map((m) => m[0]);
  const real = matter.facts.on ? sweepFacts(matter.facts, text.replace(TOKEN_RE, ' ')) : [];
  return { text: restored, invented: [...invented], changed, dropped: [...new Set(dropped)], totals, worked, real, clean: !invented.size && !changed.length && !dropped.length && !real.length };
}
