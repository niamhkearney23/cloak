// The key sweep: read cloaked text again and look for anything the key holds.
//
// For names and numbers: the exact value, whole word, any letter case.
// For facts (dates, amounts, references): the same meaning in ANY format, so
// RM4,317,250 is found even if the key holds RM 4,317,250.00.
// Returns where each hit is: paragraph number and a short cloaked excerpt.

import { TOKEN_RE } from './engine.js';
import { sweepFacts } from './facts.js';

// Titles that are also surnames or parts of names: a key value that is only one of these is not swept.
const TITLE_WORDS = new Set(['tan', 'sri', 'seri', 'dato', 'datuk', 'datin', 'tun', 'haji', 'hajah', 'raja', 'tengku', 'syed', 'sharifah', 'encik', 'puan', 'cik', 'bin', 'binti', 'anak']);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function keySweep(matter, text) {
  const hits = [];
  const paragraphs = String(text).split(/\n\s*\n|\n/);
  const factTokens = new Set(['DATE', 'AMOUNT', 'REF', 'PERCENT']);
  const values = matter.cloak.entries.filter((e) => !factTokens.has(e.token.replace(/_\d+.*$/, '')) && e.value.length >= 4 && !TITLE_WORDS.has(e.value.toLowerCase()) && e.match !== false).map((e) => e.value).sort((a, b) => b.length - a.length);
  const keepFine = new Set(matter.keep.map((k) => k.toLowerCase()));
  const tagless = (p) => p.replace(TOKEN_RE, ' ').replace(/\{\{[^}]*\}\}/g, ' ');
  let n = 0;
  for (const p of paragraphs) {
    if (!p.trim()) continue;
    n++;
    const plain = tagless(p);
    for (const v of values) {
      if (keepFine.has(v.toLowerCase())) continue;
      const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(v).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}_])`, 'iu');
      if (re.test(plain)) hits.push({ kind: 'key', paragraph: n, excerpt: p.slice(0, 80).replace(/\s+/g, ' ') });
    }
    if (matter.facts.on) for (const h of sweepFacts(matter.facts, plain)) hits.push({ kind: h.kind, paragraph: n, approximate: !!h.approximate, excerpt: p.slice(0, 80).replace(/\s+/g, ' ') });
  }
  return hits;
}
