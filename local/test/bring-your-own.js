// Tests the detector on documents it has never seen, and reports what it
// misses. It only MEASURES: it changes nothing, learns nothing, and no rule
// in Cloak has been written or adjusted to fit the documents it is run on.
//
//   node test/bring-your-own.js <folder of made-up documents> <planted.txt> [--out report.txt]
//
// planted.txt lists the real values you put into the documents, one per line:
//
//   PERSON: Aminah binti Yusof          <- a label, then the value
//   NRIC: 800505-14-5521
//   Hakim bin Daud                      <- no label is fine too
//   # lines starting with # are ignored
//
// For each value it says whether it was HIDDEN, FLAGGED (still visible but on
// the review screen's "not sure" list), PARTLY visible (some word of it shows),
// LEAKED (all of it shows with nothing flagged), or NOT FOUND (it is not in
// the text Cloak read, so the file was not read or the value is not there).
// The automatic result is measured before any review decision is made.

import { readFile, writeFile } from 'node:fs/promises';
import { cloakFolder } from '../run.js';
import { VERSION } from '../version.js';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outFile = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const [folder, plantedFile] = args;
if (!folder || !plantedFile) {
  console.error('Usage: node test/bring-your-own.js <folder> <planted.txt> [--out report.txt]');
  process.exit(2);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const whole = (v) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(norm(v)).replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu');

const planted = (await readFile(plantedFile, 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
  const m = /^([A-Za-z][A-Za-z _/-]{1,30}):\s+(.+)$/.exec(l);
  return m && !/^\d/.test(m[2].split(' ')[0]) || (m && /^[A-Z_ /-]+$/.test(m[1])) ? { label: m[1].trim().toUpperCase(), value: m[2].trim() } : { label: 'UNLABELLED', value: l };
});

const run = await cloakFolder({ folder, write: false });
const texts = run.files.filter((f) => f.cloaked).map((f) => ({ f, cloaked: f.cloaked, read: [f.rel, ...f.parts.map((p) => p.text)].join('\n') }));
const readAll = texts.map((t) => t.read).join('\n');

const rows = planted.map(({ label, value }) => {
  const re = whole(value);
  if (!re.test(readAll) && !re.test(readAll.replace(/[_-]/g, ' '))) return { label, value, result: 'NOT FOUND' };
  const hits = texts.filter((t) => re.test(t.cloaked));
  if (!hits.length) {
    const words = norm(value).split(' ').filter((w) => w.length >= 3 && /\p{L}/u.test(w));
    const partly = words.filter((w) => texts.some((t) => whole(w).test(t.cloaked)));
    return { label, value, result: partly.length && words.length > 1 ? `PARTLY visible (${partly.join(', ')})` : 'HIDDEN' };
  }
  const flagged = hits.some((t) => (t.f.unsure || []).some((u) => norm(u.text).toLowerCase().includes(norm(value).toLowerCase()) || norm(value).toLowerCase().includes(norm(u.text).toLowerCase())));
  return { label, value, result: flagged ? 'FLAGGED' : 'LEAKED', places: hits.length };
});

const lines = [`Cloak ${VERSION}: measurement on documents it had not seen`, `${run.files.length} files read; ${planted.length} planted values; automatic result before any review.`, ''];
const groups = [...new Set(rows.map((r) => r.label))];
lines.push('LABEL'.padEnd(18) + 'values  hidden  flagged  partly  leaked  not found');
for (const g of groups) {
  const r = rows.filter((x) => x.label === g);
  const n = (re) => r.filter((x) => re.test(x.result)).length;
  lines.push(g.padEnd(18) + [r.length, n(/^HIDDEN/), n(/^FLAGGED/), n(/^PARTLY/), n(/^LEAKED/), n(/^NOT FOUND/)].map((v) => String(v).padStart(6)).join('  ').padStart(0));
}
const all = (re) => rows.filter((x) => re.test(x.result)).length;
lines.push('ALL'.padEnd(18) + [rows.length, all(/^HIDDEN/), all(/^FLAGGED/), all(/^PARTLY/), all(/^LEAKED/), all(/^NOT FOUND/)].map((v) => String(v).padStart(6)).join('  '));
const bad = rows.filter((x) => !/^HIDDEN/.test(x.result));
if (bad.length) { lines.push('', 'NOT HIDDEN AUTOMATICALLY:'); for (const x of bad) lines.push(`  [${x.result}] ${x.label}: ${x.value}`); }
const blocked = run.files.filter((f) => !['cloaked', 'container'].includes(f.status));
if (blocked.length) { lines.push('', 'FILES THAT WERE BLOCKED:'); for (const f of blocked) lines.push(`  ${f.rel}: ${f.status} - ${f.reasons.join(' ')}`); }
lines.push('', 'LEAKED means everything of the value is visible and the review screen would not have flagged it.');
const text = lines.join('\n');
console.log(text);
if (outFile) await writeFile(outFile, text);
