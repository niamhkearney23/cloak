// Checks on a draft the AI wrote, run on this computer with plain code. No AI, no network.
//
//   1. Restore check     no tag left, none invented or damaged, no real value written in by the AI
//   2. Source check      every date, amount, reference and place in the restored draft is found in the
//                        source files; every name too. Anything not found is listed with its paragraph number.
//   3. Arithmetic and timeline
//                        day counts between two dates, totals and balances are recalculated; dates that run
//                        backwards in the numbered paragraphs are flagged.
//
// Each check gives pass, warn or fail and the exact place of each issue (paragraph number and the words).
// The local AI read-through (check 4) is not part of this file: it needs the internal check server.

import { findNames } from './engine.js';
import { Facts, findAmounts, findDates, findRefs } from './facts.js';
import { restoreDraft } from './restore.js';

// Places are given as the affidavit's own paragraph number when there is one ("paragraph 12"), else the line.
function paragraphsOf(text) {
  let current = null;
  return String(text).split(/\n/).map((t, i) => {
    const m = /^\s*(\d+)\.\s/.exec(t);
    if (m) current = Number(m[1]);
    return { n: m ? current : current ?? `line ${i + 1}`, line: i + 1, text: t };
  }).filter((p) => p.text.trim());
}
const squash = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function verdict(issues) {
  if (issues.some((i) => i.level === 'fail')) return 'fail';
  return issues.length ? 'warn' : 'pass';
}

/** Check 1. */
export function restoreCheck(matter, draft, { required = [] } = {}) {
  const r = restoreDraft(matter, draft, { required });
  const where = (needle) => paragraphsOf(draft).find((p) => p.text.includes(needle))?.n ?? null;
  const issues = [
    ...r.invented.map((t) => ({ level: 'fail', paragraph: where(t), what: `${t} is not a tag in this matter (the AI made it up)` })),
    ...r.changed.map((c) => ({ level: 'fail', paragraph: where(c.found), what: `${c.found}: ${c.why}` })),
    ...r.dropped.map((t) => ({ level: 'fail', paragraph: null, what: `${t} was required and is missing` })),
    ...r.real.map((h) => ({ level: 'fail', paragraph: where(h.text), what: `"${h.text}" is a real ${h.kind} written into the draft` })),
    ...r.totals.map((t) => ({ level: 'warn', paragraph: where(t), what: `${t} could not be worked out` })),
  ];
  return { name: 'Restore check', result: verdict(issues), issues, restored: r.text, worked: r.worked };
}

/** Check 2. `sources` is the real text of every source file. */
export function sourceCheck(matter, restoredDraft, sources) {
  const all = sources.join('\n');
  const probe = new Facts({ level: 'strict', percentages: true });
  const inSources = new Set(probe.find(all).map((f) => `${f.kind}|${f.key}`));
  // Totals Cloak worked out itself are not in the sources: they are its own calculation.
  for (const t of matter.facts.computed) inSources.add(`amount|${t.currency}|${t.cents}`);
  const flatSources = squash(all);
  const issues = [];
  for (const p of paragraphsOf(restoredDraft)) {
    for (const f of probe.find(p.text)) {
      if (!inSources.has(`${f.kind}|${f.key}`) && !(f.kind === 'amount' && f.rounded)) issues.push({ level: 'fail', paragraph: p.n, what: `${f.kind} "${f.text}" is not in any source file` });
    }
    // Names: a name in the draft that no source file contains.
    for (const name of findNames(p.text).map((n) => n.value || n.text || n).filter((n) => typeof n === 'string')) {
      if (name.length > 3 && !flatSources.includes(squash(name))) issues.push({ level: 'warn', paragraph: p.n, what: `the name "${name}" is not in any source file` });
    }
  }
  return { name: 'Source check', result: verdict(issues), issues };
}

// "41 days after", not "within 14 days": only a count between two events can be checked against two dates.
const DAYS = /(\d+)\s+days?\s+(?:after|before|from|later|earlier|apart|since)\b/i;
const SUM_WORDS = /\b(?:total|balance|sum|remaining|outstanding|baki|jumlah)\b/i;

/** Check 3. */
export function arithmeticCheck(restoredDraft) {
  const issues = [];
  let last = null;
  for (const p of paragraphsOf(restoredDraft)) {
    const dates = findDates(p.text).filter((d) => d.precision === 'day');
    const days = DAYS.exec(p.text);
    // A day count between two dates in the same sentence.
    if (days && dates.length >= 2) {
      const actual = Math.abs(dates[1].sort - dates[0].sort);
      if (actual !== Number(days[1])) issues.push({ level: 'fail', paragraph: p.n, what: `"${days[0]}" but the two dates are ${actual} days apart` });
    } else if (days && dates.length < 2) {
      issues.push({ level: 'warn', paragraph: p.n, what: `"${days[0]}" cannot be checked here: the sentence has fewer than two dates` });
    }
    // A total or balance: some sum or difference of the other amounts must give it.
    const amounts = findAmounts(p.text).filter((a) => !a.rounded);
    if (SUM_WORDS.test(p.text) && amounts.length >= 3) {
      const [target, ...rest] = [amounts[amounts.length - 1], ...amounts.slice(0, -1)];
      const ok = rest.some((a, i) => rest.some((b, j) => j > i && (a.cents + b.cents === target.cents || Math.abs(a.cents - b.cents) === target.cents)));
      if (!ok) issues.push({ level: 'fail', paragraph: p.n, what: `"${target.text}" is not the total or difference of the other amounts in the paragraph` });
    }
    // Dates should not run backwards from one numbered paragraph to the next.
    if (dates.length && /^\s*\d+\./.test(p.text)) {
      const first = dates[0];
      if (last && first.sort < last.date.sort) issues.push({ level: 'warn', paragraph: p.n, what: `"${first.text}" is earlier than "${last.date.text}" in paragraph ${last.n}` });
      last = { n: p.n, date: first };
    }
    for (const r of findRefs(p.text)) void r;
  }
  return { name: 'Arithmetic and timeline', result: verdict(issues), issues };
}

/** Checks 1 to 3 on one draft. */
export function checkDraft({ matter, draft, sources, required = [] }) {
  const restore = restoreCheck(matter, draft, { required });
  const source = sourceCheck(matter, restore.restored, sources);
  const arithmetic = arithmeticCheck(restore.restored);
  const checks = [restore, source, arithmetic];
  return { checks, result: verdict(checks.flatMap((c) => c.issues)), restored: restore.restored };
}
