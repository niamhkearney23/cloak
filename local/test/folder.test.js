import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMatter, REAL_VALUES, REAL_EXACT } from './matter.js';
import { cloakFolder } from '../run.js';
import { Matter } from '../engine.js';
import { VERSION } from '../version.js';
import { measure } from './miss-rate.js';

// Everything here uses the made-up 20-file matter in matter.js.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Real values found in a piece of text (whole words). */
function realValuesIn(text) {
  const found = [];
  for (const v of REAL_VALUES) if (new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) found.push(v);
  for (const v of REAL_EXACT) if (new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text)) found.push(v);
  return found;
}

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out); else out.push(full);
  }
  return out;
}
const hashFile = async (f) => createHash('sha256').update(await readFile(f)).digest('hex');

let root, src, out, logFile, run, hashesBefore, tmpBefore;
const progress = [];

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'cloak-test-'));
  src = path.join(root, 'matter');
  out = path.join(root, 'cloaked');
  logFile = path.join(root, 'state', 'cloak-log.jsonl');
  await makeMatter(src);
  hashesBefore = Object.fromEntries(await Promise.all((await walk(src)).map(async (f) => [f, await hashFile(f)])));
  tmpBefore = new Set(await readdir(os.tmpdir()));
  run = await cloakFolder({ folder: src, outDir: out, logFile, user: 'test-user', onProgress: (p) => progress.push(p) });
});

test('no real value appears in any cloaked file, file name, report or log', async () => {
  const files = await walk(out);
  assert.ok(files.length >= 15);
  for (const f of [...files, logFile]) {
    assert.deepEqual(realValuesIn(path.basename(f)), [], `real value in the file name ${path.basename(f)}`);
    assert.deepEqual(realValuesIn(await readFile(f, 'utf8')), [], `real value inside ${path.basename(f)}`);
  }
});

test('the leak check itself works: it finds a real value when one is there', () => {
  assert.deepEqual(realValuesIn('Signed by {{PERSON_1}} and Mr Tan.'), ['Tan']);
  assert.deepEqual(realValuesIn('IC 800505-14-5521'), ['800505-14-5521']);
});

test('originals are never changed', async () => {
  const after = await walk(src);
  assert.equal(after.length, Object.keys(hashesBefore).length);
  for (const f of after) assert.equal(await hashFile(f), hashesBefore[f], `${path.basename(f)} was modified`);
});

test('every file is accounted for: cloaked, needs a manual check, or unreadable', () => {
  const by = (n) => run.files.find((f) => f.rel.startsWith(n));
  assert.equal(run.files.length, 20);
  assert.equal(run.report.totals.cloaked + run.report.totals.needs_manual_check + run.report.totals.partly_read_blocked + run.report.totals.unreadable_blocked, 20);
  assert.equal(by('18 Old memo').status, 'unreadable');
  assert.match(by('18 Old memo').reasons[0], /\.doc/);
  assert.equal(by('19 Photo').status, 'unreadable');
  assert.match(by('19 Photo').reasons[0], /heic/);
  for (const n of ['01', '05', '06', '09', '10', '11']) assert.equal(by(n).status, 'cloaked', n);
});

test('a page in Chinese is held for a manual check and never written out', async () => {
  const f = run.files.find((x) => x.rel.startsWith('17'));
  assert.equal(f.status, 'manual');
  assert.match(f.reasons[0], /non-Latin/);
  assert.equal(f.out, undefined);
  for (const o of await walk(out)) assert.doesNotMatch(await readFile(o, 'utf8'), /\p{Script=Han}/u);
});

test('scanned files go through OCR and are marked; text files do not', () => {
  const scanned = run.files.find((f) => f.rel.startsWith('09'));
  const picture = run.files.find((f) => f.rel.startsWith('10'));
  assert.deepEqual(scanned.ocrPages, [1]);
  assert.deepEqual(picture.ocrPages, [1]);
  assert.match(scanned.cloaked, /\[Page 1 \(scanned\)\]/);
  assert.match(scanned.cloaked, /SALE AND PURCHASE AGREEMENT/);
  assert.deepEqual(run.files.find((f) => f.rel.startsWith('05')).ocrPages, []);
  assert.equal(run.report.totals.ocr_files, 2);
  assert.ok(progress.some((p) => p.stage === 'cloaked' && p.ocr && p.file.startsWith('09')));
  assert.equal(progress.filter((p) => p.stage === 'cloaked').length, 18);
});

test('one person has one tag number in every file, whatever the spelling', () => {
  const entries = run.matter.key().entries;
  const baseOf = (value) => entries.find((e) => e.value.toLowerCase() === value.toLowerCase())?.token.split('.')[0];
  const ahmad = baseOf('Ahmad bin Ismail');
  assert.ok(ahmad);
  for (const v of ['Ahmad Ismail', 'Ahmad b. Ismail', 'Ahmad']) assert.equal(baseOf(v), ahmad, v);
  const tan = baseOf('Tan Boon Huat');
  for (const v of ['Boon Huat', 'Tan']) assert.equal(baseOf(v), tan, v);
  assert.equal(baseOf('Mohamad Faizal Hassan'), baseOf('Muhammad Faizal bin Hassan'));
  assert.equal(baseOf('Wong Kah Fai'), baseOf('David Wong Kah Fai'));
  assert.equal(baseOf('Lim Mei-Ling'), baseOf('Lim Mei Ling'));
  assert.equal(baseOf('Maju Jaya (M) Sdn Bhd'), baseOf('Maju Jaya Sdn. Bhd.'));
  assert.equal(baseOf('MJSB'), baseOf('Maju Jaya'));
  assert.equal(baseOf('800505145521'), baseOf('800505-14-5521'));
  assert.equal(baseOf('0129876543'), baseOf('012-987 6543'));
  assert.equal(baseOf('5141-2345-6789'), baseOf('5141 2345 6789'));

  // The made-up matter has 13 people and 7 companies.
  const bases = new Set(entries.map((e) => e.token.split('.')[0]));
  assert.equal([...bases].filter((b) => b.startsWith('PERSON_')).length, 13);
  assert.equal([...bases].filter((b) => b.startsWith('COMPANY_') && !b.startsWith('COMPANY_NO')).length, 7);

  for (const n of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '15', 'Correspondence']) {
    const f = run.files.find((x) => x.rel.startsWith(n));
    assert.match(f.cloaked, new RegExp(`\\{\\{${ahmad}[.}]`), `Ahmad's tag is missing from ${f.rel}`);
  }
  // Merged variants are kept for the review screen to confirm or split.
  assert.ok(run.matter.merges.length >= 8);
});

test('tags keep the website format and its endings', () => {
  const text = run.files.map((f) => f.cloaked || '').join('\n');
  assert.match(text, /\{\{PERSON_\d+\}\}/);
  assert.match(text, /\{\{PERSON_\d+\.SURNAME\}\}/);
  assert.match(text, /\{\{PERSON_\d+\.TITLE\d*\}\} \{\{PERSON_\d+\}\}/);
  assert.match(text, /\{\{COMPANY_\d+\.SHORT\}\}/);
  assert.doesNotMatch(text, /\[(?:PERSON|COMPANY|NRIC)_\d+\]/);
  for (const type of ['NRIC', 'PASSPORT', 'ADDRESS', 'PHONE', 'EMAIL', 'ACCOUNT', 'CASE', 'LAND', 'VEHICLE']) assert.match(text, new RegExp(`\\{\\{${type}_\\d+`), type);
});

test('dates, amounts and legal provisions are kept unless switched on', () => {
  const text = 'On 3 March 2023 (03/03/2023) the Plaintiff paid RM 60,000.00 under Section 74 of the Contracts Act 1950 and Order 14 rule 1.';
  const keep = new Matter();
  keep.register(keep.learn(text));
  assert.equal(keep.apply(text), text);
  const hide = new Matter({ options: { dates: true, amounts: true, provisions: true } });
  hide.register(hide.learn(text));
  const out2 = hide.apply(text);
  assert.doesNotMatch(out2, /March|60,000|Section 74|1950|Order 14/);
  assert.match(out2, /\{\{DATE_1\}\}.*\{\{AMOUNT_1\}\}.*\{\{PROVISION_\d\}\}/);
});

test('hidden places in Word files are cloaked too: header, footer, footnote, comment, tracked changes', () => {
  const f = run.files.find((x) => x.rel.startsWith('01'));
  for (const label of ['Header', 'Footer', 'Footnotes', 'Comments', 'Deleted text (tracked changes)']) assert.match(f.cloaked, new RegExp(`\\[${escapeRe(label)}\\]`), label);
  assert.match(f.cloaked, /\[Deleted text \(tracked changes\)\]\nPlaintif juga menuntut daripada \{\{COMPANY_\d+\}\}/);
  // Document properties (author, title) are left out of the copy entirely.
  assert.doesNotMatch(f.cloaked, /creator|coreProperties/);
});

test('spreadsheets and emails are read', () => {
  const sheet = run.files.find((x) => x.rel.startsWith('11'));
  assert.match(sheet.cloaked, /Sheet: Payments/);
  assert.match(sheet.cloaked, /\{\{ACCOUNT_\d+\}\}\t60000/);
  const email = run.files.find((x) => x.rel.startsWith('06'));
  assert.match(email.cloaked, /From: "\{\{PERSON_\d+[^}]*\}\}" <\{\{EMAIL_\d+\}\}>/);
  assert.match(email.cloaked, /My wife \{\{PERSON_\d+\.FIRST\d*\}\} can confirm/);
});

test('nothing real is left in temp or cache locations', async () => {
  const suspects = [];
  for (const name of await readdir(os.tmpdir())) {
    if (tmpBefore.has(name) && name !== 'cloak-ocr-lang') continue;
    const full = path.join(os.tmpdir(), name);
    if (full === root) continue;
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    suspects.push(...(s.isDirectory() ? await walk(full) : [full]));
  }
  // Inside this test's own folder only the originals may hold real values.
  suspects.push(...(await walk(root)).filter((f) => !f.startsWith(src + path.sep)));
  for (const f of suspects) {
    // The OCR engine's own language data (shipped with the app) is the only
    // thing allowed in its folder. Anything else there is checked.
    if (path.dirname(f) === path.join(os.tmpdir(), 'cloak-ocr-lang')) {
      assert.match(path.basename(f), /^[a-z_]+\.traineddata(?:\.gz)?$/, `unexpected file in the OCR data folder: ${f}`);
      continue;
    }
    const text = (await readFile(f)).toString('latin1');
    assert.deepEqual(realValuesIn(text), [], `real value left in ${f}`);
  }
});

test('the log says who, when and what, with no real values and no folder path', async () => {
  const entry = JSON.parse((await readFile(logFile, 'utf8')).trim().split('\n').pop());
  assert.equal(entry.by, 'test-user');
  assert.equal(entry.action, 'cloak-folder');
  assert.equal(entry.cloak_version, VERSION);
  assert.equal(entry.files_on_disk, 20);
  assert.ok(!JSON.stringify(entry).includes(src));
  assert.ok(Date.parse(entry.t) > 0);
});

test('the version number is in the report', async () => {
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  assert.equal(report.cloak_version, VERSION);
  assert.match(report.review, /NOT REVIEWED/);
  assert.equal(report.files.length, 20);
  assert.match(await readFile(path.join(out, 'NOT-REVIEWED.txt'), 'utf8'), new RegExp(escapeRe(VERSION)));
});

test('speed: the 20-file matter finishes well inside 60 seconds', () => {
  console.log(`      20-file matter: ${run.seconds.toFixed(1)} seconds (${run.report.totals.ocr_files} files through OCR)`);
  assert.ok(run.seconds < 60, `took ${run.seconds}s`);
});

test('the desktop code makes no network calls', async () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const sources = (await readdir(path.join(dir, '..'))).filter((f) => f.endsWith('.js'));
  assert.ok(sources.includes('engine.js'));
  for (const f of sources) {
    const code = await readFile(path.join(dir, '..', f), 'utf8');
    assert.doesNotMatch(code, /from 'node:(?:http|https|net|tls|dgram|dns)'|require\('(?:node:)?(?:http|https|net|tls)'\)|\bfetch\(|XMLHttpRequest|WebSocket/, `${f} uses the network`);
  }
});

test('name detection: nothing is missed silently, and the hit rate does not get worse', () => {
  const rows = Object.fromEntries(measure().map((r) => [r.group, r]));
  for (const r of Object.values(rows)) {
    console.log(`      ${r.group}: hidden ${r.hidden}/100, flagged for review ${r.flagged}, missed silently ${r.missed}`);
    assert.equal(r.missed, 0, `${r.group}: a name was neither hidden nor flagged`);
  }
  assert.ok(rows['Malay (with bin / binti)'].hidden >= 98);
  assert.ok(rows['Indian (with a/l / a/p)'].hidden >= 98);
  assert.ok(rows.Chinese.hidden >= 95);
  assert.ok(rows['Malay (no bin / binti)'].hidden >= 85);
  assert.ok(rows['Indian (no a/l / a/p)'].hidden >= 83);
  assert.ok(rows.English.hidden >= 77);
});
