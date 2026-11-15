import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMatter, openMatter } from '../matter.js';
import { Matter } from '../engine.js';
import { doubleCheck, documentUnit, inspect, keySweep, reportUnit, verdict } from '../doublecheck.js';
import { writeZip } from '../zip.js';
import { finishReview } from './helpers.js';
import { makeMatter, REAL_VALUES, REAL_EXACT } from './matter.js';

// Feature 4: the double checker. Every document here is made up.

const FAST = { N: 2 ** 12, r: 8, p: 1 };
const PASSWORD = 'double check test password';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (t) => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;

function word({ body, header, footer, comment, deleted, keywords }) {
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${para(body)}${deleted ? `<w:p><w:del w:author="Clerk"><w:r><w:delText>${esc(deleted)}</w:delText></w:r></w:del></w:p>` : ''}</w:body></w:document>`,
    'docProps/core.xml': `<cp:coreProperties xmlns:cp="x" xmlns:dc="y"><dc:title>Letter</dc:title>${keywords ? `<cp:keywords>${esc(keywords)}</cp:keywords>` : ''}</cp:coreProperties>`,
  };
  if (header) files['word/header1.xml'] = `<w:hdr ${W}>${para(header)}</w:hdr>`;
  if (footer) files['word/footer1.xml'] = `<w:ftr ${W}>${para(footer)}</w:ftr>`;
  if (comment) files['word/comments.xml'] = `<w:comments ${W}><w:comment w:author="Clerk">${para(comment)}</w:comment></w:comments>`;
  return writeZip(files);
}

function workbook({ sheet, rows, defined = [] }) {
  const strings = [];
  const cell = (v, r, c) => { strings.push(v); return `<c r="${String.fromCharCode(65 + c)}${r + 1}" t="s"><v>${strings.length - 1}</v></c>`; };
  return writeZip({
    'xl/workbook.xml': `<workbook><sheets><sheet name="${esc(sheet)}" sheetId="1"/></sheets><definedNames>${defined.map(([n, v]) => `<definedName name="${esc(n)}">${esc(v)}</definedName>`).join('')}</definedNames></workbook>`,
    'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, r, c)).join('')}</row>`).join('')}</sheetData></worksheet>`,
    'xl/sharedStrings.xml': `<sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`,
  });
}

const email = ['From: "ahmad" <sender@mail.example>', 'To: "Records Office" <office@firm.example>', 'Subject: notes from ahmad', 'Date: Mon, 4 Dec 2023 09:14:00 +0800', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="XYZ"', '',
  '--XYZ', 'Content-Type: text/plain; charset=utf-8', '', 'Please see the attached notes.', '--XYZ', 'Content-Type: text/plain; charset=utf-8', 'Content-Disposition: attachment; filename="notes for ahmad.txt"', '', 'Plain notes with nothing in them.', '--XYZ--', ''].join('\r\n');

// The plaintiff is in the key as "Ahmad". Every other file has "ahmad" in lower case in one hidden place, where the
// first pass leaves it (it only hides a capitalised name written in lower case when told to). The double check must
// find each one, and say which part of which file it is in.
const PLACES = {
  '01 Plaintiff.txt': 'Ahmad bin Ismail is the plaintiff. His NRIC is 800505-14-5521.\nThe agreement is dated 3 March 2023.',
  '02 Letter.docx': word({ body: 'The body of the letter says nothing more.', header: 'for ahmad', footer: 'file of ahmad', comment: 'check with ahmad first', deleted: 'ahmad said no', keywords: 'ahmad' }),
  '03 Payments.xlsx': workbook({ sheet: 'ahmad payments', rows: [['Item', 'Note'], ['Deposit', 'paid']], defined: [['ahmad_total', 'Payments!$B$2']] }),
  '04 Email.eml': email,
  '05 ahmad.txt': 'A note with nothing else in it.',
};

async function folder(files, name = 'documents') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-dc-'));
  const docs = path.join(root, name);
  await mkdir(docs, { recursive: true });
  for (const [rel, content] of Object.entries(files)) await writeFile(path.join(docs, rel), content);
  return { root, docs };
}

async function session(files, { user = 'checker-one', testMatter = false } = {}) {
  const { root, docs } = await folder(files);
  const { session: s } = await createMatter({ dir: path.join(root, 'matter'), password: PASSWORD, user, kdf: FAST, testMatter });
  await s.cloakFolder({ folder: docs });
  await finishReview(s);
  return { s, root, docs };
}

const places = (view) => view.groups.flatMap((g) => g.places.map((p) => ({ ...p, check: g.check, value: g.value, key: g.key })));

test('a value from the key left in any hidden place is found, with the file, the part and the line', async () => {
  const { s, root } = await session(PLACES);
  const view = await s.doubleCheck();
  assert.equal(view.passed, false);
  const found = places(view).filter((p) => p.check === 'key' && p.value === 'ahmad');
  const at = (title, part) => found.some((p) => p.title.startsWith(title) && (part instanceof RegExp ? part.test(p.part) : p.part === part) && p.line > 0 && /ahmad/.test(p.excerpt));
  assert.ok(at('02 Letter.docx', 'Header'), 'header');
  assert.ok(at('02 Letter.docx', 'Footer'), 'footer');
  assert.ok(at('02 Letter.docx', 'Comments'), 'comments');
  assert.ok(at('02 Letter.docx', 'Deleted text (tracked changes)'), 'tracked changes');
  assert.ok(at('02 Letter.docx', 'Document properties'), 'document properties');
  assert.ok(at('03 Payments.xlsx', /^Sheet: ahmad payments$/), 'sheet name');
  assert.ok(at('03 Payments.xlsx', 'Defined names'), 'defined names');
  assert.ok(at('04 Email.eml', 'Email'), 'email headers');
  assert.ok(at('04 Email.eml/notes for ahmad.txt', 'File name'), 'attachment name');
  assert.ok(at('05 ahmad.txt', 'File name'), 'file name ("File:" line)');
  assert.ok(found.some((p) => p.unit === 'cloak-report.json'), 'the report lists the file names too, and is checked');
  // Each file that has one fails; the one with none passes.
  const unit = (title) => view.units.find((u) => u.title === title);
  assert.equal(unit('01 Plaintiff.txt').status, 'pass');
  for (const t of ['02 Letter.docx', '03 Payments.xlsx', '04 Email.eml', '05 ahmad.txt']) assert.equal(unit(t).status, 'fail', t);
  // Nothing is written while anything is undecided, and the refusal names files and lines, not the words.
  const out = path.join(root, 'cloaked');
  await assert.rejects(s.export({ outDir: out }), (e) => e.code === 'DOUBLE_CHECK' && /still to decide/.test(e.message) && /line \d+/.test(e.message) && !/ahmad/i.test(e.message));
  await assert.rejects(stat(out));

  // "Hide it": the exact text is hidden under its tag everywhere it was found, and the check is run again.
  const key = view.groups.find((g) => g.check === 'key' && g.value === 'ahmad').key;
  const after = await s.decideFinding({ key, decision: 'hide' });
  assert.equal(after.reopened, false);
  assert.equal(after.check.passed, true, JSON.stringify(places(after.check).map((p) => [p.value, p.part])));
  const result = await s.export({ outDir: out });
  assert.ok(result.written.length >= 6);
  for (const n of await readdir(out)) assert.ok(!/ahmad/i.test(await readFile(path.join(out, n), 'utf8')), `ahmad is in ${n}`);
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  assert.equal(report.double_check.hidden_during_the_double_check, 1);
  assert.match(report.double_check.statement, /^Double-checked by checker-one on \d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (?:am|pm)\.$/);
  assert.equal(report.double_check.ai_used, false);
  await s.close();
});

test('planted leaks of each kind fail the check: a missed name, an NRIC in a footer, a date in another format, a name in a file name, a damaged tag, a tag not in the key, one value under two tags', async () => {
  const { s } = await session(PLACES);
  // Take the lower-case name out first so only the planted leaks remain.
  await s.decideFinding({ key: (await s.doubleCheck()).groups.find((g) => g.value === 'ahmad').key, decision: 'hide' });
  assert.equal((await s.doubleCheck()).passed, true);
  // Plant what a first pass might have missed straight into the copies that would be written.
  const f = s.run.files.find((x) => x.rel === '02 Letter.docx');
  const plant = (label, text) => { f.cloaked = f.cloaked.replace(`[${label}]\n`, `[${label}]\n${text}\n`); };
  plant('Body', 'Encik Zainal Abidin bin Kassim signed on behalf of the plaintiff.');
  plant('Footer', 'No. K/P 900101-14-5678');
  plant('Comments', 'Paid on 03.03.2023.');
  plant('Header', 'See {{PERSON_99}}, {{person_1}} and {{PERSON_1');
  f.cloaked = f.cloaked.replace(/^File: /, 'File: Zubaidah ');
  s.matter.cloak.register('PATH_9', 'Ahmad bin Ismail', { match: false });
  plant('Document properties', 'Folder: {{PATH_9}}');
  const view = await s.doubleCheck();
  assert.equal(view.passed, false);
  const all = places(view);
  const has = (check, re, part) => all.some((p) => p.check === check && re.test(p.value) && p.title === '02 Letter.docx' && p.part === part);
  assert.ok(has('name', /^Zainal Abidin bin Kassim$/, 'Body'), 'a missed name after a title');
  assert.ok(has('pattern', /^900101-14-5678$/, 'Footer'), 'an NRIC in a footer');
  assert.ok(has('fact', /^03\.03\.2023$/, 'Comments'), 'a date the key holds, written another way');
  assert.ok(has('name', /^Zubaidah$/, 'File name'), 'a name in the file name');
  assert.ok(has('tag', /^\{\{person_1\}\}$/, 'Header') && has('tag', /^\{\{PERSON_1$/, 'Header'), 'damaged tags');
  assert.ok(has('tag', /^\{\{PERSON_99\}\}$/, 'Header'), 'a tag that is not in the key');
  assert.ok(all.some((p) => p.check === 'tag' && /\{\{PATH_9\}\}/.test(p.value) && /\{\{PERSON_\d+\}\}/.test(p.value)), 'one real value under two different tags');
  // Every finding names the words and where they are.
  for (const p of all) assert.ok(p.unit && p.title && p.part && p.line >= 1 && p.excerpt, JSON.stringify(p));
  // The line is the line in the copy.
  const nric = all.find((p) => p.value === '900101-14-5678');
  assert.equal(f.cloaked.split('\n')[nric.line - 1], 'No. K/P 900101-14-5678');
  await s.close();
});

test('"Hide it" works for each kind: a possible name, a name in lower case, a date in another format and an identifier', async () => {
  const { s } = await session({ '01 Note.txt': 'Encik Ahmad bin Ismail paid RM 60,000.00 on 3 March 2023 to Maju Jaya Sdn Bhd.' });
  assert.equal((await s.doubleCheck()).passed, true);
  // The source text has things the first pass did not catch (cloaked again without learning, as after a change).
  const f = s.run.files[0];
  f.parts[0].text += '\nZubaidah binti Hamzah witnessed it on 03.03.2023. Later ahmad confirmed it.';
  s.reapply();
  f.cloaked = f.cloaked.replace('\n', '\nNRIC 900101-14-5678\n');
  let view = await s.doubleCheck();
  const group = (check, value) => view.groups.find((g) => g.check === check && g.value === value);
  assert.ok(group('name', 'Zubaidah binti Hamzah') && group('fact', '03.03.2023') && group('key', 'ahmad') && group('pattern', '900101-14-5678'), JSON.stringify(view.groups.map((g) => [g.check, g.value])));
  assert.equal(group('name', 'Zubaidah binti Hamzah').hideAs, 'PERSON');
  view = (await s.decideFinding({ key: group('pattern', '900101-14-5678').key, decision: 'hide' })).check;
  assert.ok(s.matter.cloak.entries.some((e) => e.value === '900101-14-5678'), 'the number is in the key now');
  view = (await s.decideFinding({ key: group('name', 'Zubaidah binti Hamzah').key, decision: 'hide', kind: 'PERSON' })).check;
  view = (await s.decideFinding({ key: group('fact', '03.03.2023').key, decision: 'hide' })).check;
  view = (await s.decideFinding({ key: group('key', 'ahmad').key, decision: 'hide' })).check;
  assert.equal(view.passed, true, JSON.stringify(view.groups.map((g) => [g.check, g.value])));
  assert.match(f.cloaked, /\{\{PERSON_\d+\}\} witnessed it on \{\{DATE_1\.[A-Z]\}\}\. Later \{\{PERSON_\d+\.FIRST\}\} confirmed it\./);
  assert.ok(s.reviewData().complete, 'hiding these gave the review nothing new to decide, so it stays signed off');
  await s.close();
});

test('hiding a name that joins one already in the key reopens the review, and the double check starts again', async () => {
  const { s, root } = await session({ '01 Note.txt': 'Encik Ahmad bin Ismail met the bank.' });
  const f = s.run.files[0];
  // A spelling one letter away from a person in the key: hiding it as a person joins it to them, which a reviewer must confirm.
  f.parts[0].text += '\nENCIK AHMED BIN ISMAIL was also there.';
  s.reapply();
  const view = await s.doubleCheck();
  const g = view.groups.find((x) => x.value === 'AHMED BIN ISMAIL');
  assert.ok(g, JSON.stringify(view.groups.map((x) => x.value)));
  const r = await s.decideFinding({ key: g.key, decision: 'hide', kind: 'PERSON' });
  assert.equal(r.reopened, true);
  assert.equal(r.review.complete, null);
  assert.ok(r.review.shortForms.length + r.review.merges.length > 0, 'the join is on the review screen to confirm');
  await assert.rejects(s.export({ outDir: path.join(root, 'out') }), /until the review is finished/);
  await finishReview(s);
  assert.equal((await s.doubleCheck()).passed, true);
  await s.close();
});

test('"It is fine" is kept in the encrypted matter with who and when; the log has counts only; any change to the review starts the double check again', async () => {
  const { s, root, docs } = await session({ '01 Note.txt': 'The client, Encik Ahmad bin Ismail, telephoned.\n\nZubaidah called back later.' }, { user: 'Siti Rahman (siti.r)' });
  let view = await s.doubleCheck();
  const g = view.groups.find((x) => x.value === 'Zubaidah');
  assert.ok(g, 'a name alone at the start of a sentence, which the review does not ask about');
  assert.equal(g.check, 'name');
  await assert.rejects(s.export({ outDir: path.join(root, 'out') }), (e) => e.code === 'DOUBLE_CHECK');
  view = (await s.decideFinding({ key: g.key, decision: 'fine' })).check;
  assert.equal(view.passed, true);
  const decided = view.groups.find((x) => x.key === g.key).places[0].decided;
  assert.equal(decided.by, 'Siti Rahman (siti.r)');
  assert.match(decided.whenText, /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2} (?:am|pm)$/);
  await s.export({ outDir: path.join(root, 'out') });
  const report = JSON.parse(await readFile(path.join(root, 'out', 'cloak-report.json'), 'utf8'));
  assert.equal(report.double_check.marked_fine_by_a_person, 1);
  assert.deepEqual(report.double_check.fine_marked_by, ['Siti Rahman (siti.r)']);
  assert.match(await readFile(path.join(root, 'out', 'REVIEWED-AND-DOUBLE-CHECKED.txt'), 'utf8'), /Reviewed by Siti Rahman \(siti\.r\) on .*\nDouble-checked by Siti Rahman \(siti\.r\) on .*\nChecked: \d+ files\. Found: 1\. Marked as fine by a person: 1\./);

  // Kept in the matter, encrypted: the next person who opens it sees the decision.
  await s.close();
  const key = await readFile(path.join(root, 'matter', 'matter.cloakkey'), 'utf8');
  assert.ok(!/Zubaidah/.test(key), 'the key file is encrypted');
  const log = await readFile(path.join(root, 'matter', 'log.jsonl'), 'utf8');
  assert.match(log, /"action":"double-check-fine","check":"name","places":1/);
  assert.match(log, /"action":"export-refused","reason":"double check","still_to_decide":1/);
  assert.ok(!/Zubaidah|Ahmad|Ismail/.test(log), 'no value in the log');
  const again = await openMatter({ dir: path.join(root, 'matter'), password: PASSWORD, user: 'second-lawyer' });
  await again.cloakFolder({ folder: docs });
  assert.ok(again.reviewData().complete, 'nothing changed, so the review is still signed off');
  assert.equal((await again.doubleCheck()).passed, true, 'the decision still applies');
  assert.equal(again.review.doubleCheck.approvals[g.key].by, 'Siti Rahman (siti.r)');

  // A change to the review takes the sign-off away; the next double check starts again and asks again.
  await again.reviewAction({ type: 'add', text: 'telephoned', kind: 'OTHER' });
  assert.equal(again.reviewData().doubleCheck, null);
  await finishReview(again);
  const fresh = await again.doubleCheck();
  assert.equal(fresh.passed, false);
  assert.equal(fresh.groups.find((x) => x.key === g.key).undecided, 1);
  await again.close();
});

test('once the double check passes, a matter that is not a test matter can be exported; the report says who double-checked and holds no real value', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-dc-big-'));
  const docs = path.join(root, 'documents');
  await makeMatter(docs);
  const { session: s } = await createMatter({ dir: path.join(root, 'matter'), password: PASSWORD, user: 'Reviewer Example (rex)', kdf: FAST });
  await s.setSetup({ client: 'Maju Jaya Sdn Bhd; MJSB', others: 'Hong Seng Trading' });
  await s.cloakFolder({ folder: docs });
  await finishReview(s);
  const view = await s.doubleCheck();
  assert.equal(view.passed, true, JSON.stringify(view.groups.map((g) => [g.check, g.value, g.places[0].unit, g.places[0].line])));
  assert.ok(view.units.length >= 20, 'every copy, the context sheet, the report, the marker and the file names');
  assert.ok(view.units.some((u) => u.id === '000-context-sheet.cloaked.txt') && view.units.some((u) => u.id === 'cloak-report.json') && view.units.some((u) => u.id === '(file names)'));
  assert.equal(s.testMatter, false);
  const out = path.join(root, 'cloaked');
  await s.export({ outDir: out });
  const names = await readdir(out);
  assert.ok(names.includes('REVIEWED-AND-DOUBLE-CHECKED.txt'));
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  assert.match(report.review, /^Reviewed by Reviewer Example \(rex\) on .*\. Double-checked by Reviewer Example \(rex\) on .*\.$/);
  assert.equal(report.test_matter, false);
  assert.equal(report.double_check.found, 0);
  for (const n of names) {
    const text = await readFile(path.join(out, n), 'utf8');
    for (const v of REAL_VALUES) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text), `${v} in ${n}`);
    for (const v of REAL_EXACT) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text), `${v} in ${n}`);
  }
  await s.close();
});

// ------------------------------------------------------------ the checks one by one

function matterOf(text, level = 'strict') {
  const m = new Matter({ options: { level } });
  m.register(m.learn(text));
  m.facts.finalize();
  m.facts.syncInto(m.cloak);
  return m;
}
const unitOf = (text) => ({ id: 'x.cloaked.txt', title: 'x', kind: 'document', text, parts: [{ line: 1, label: 'Text' }] });

test('key sweep: three-letter short forms are swept when written with a capital (or as part of a user name), not as ordinary words', () => {
  const m = matterOf('Mr Ong Kah Chuan met the client.');
  assert.ok(m.cloak.entries.some((e) => e.value === 'Ong'));
  assert.deepEqual(keySweep(m, m.apply('Mr Ong Kah Chuan met the client.')), []);
  assert.equal(keySweep(m, 'Later Ong called.').length, 1);
  assert.equal(keySweep(m, 'LATER ONG CALLED.').length, 1);
  assert.equal(keySweep(m, 'The song was long.').length, 0, 'inside a word, or a different word');
  assert.equal(keySweep(m, 'His login on the old system was ong.kc for years.').length, 1, 'lower case joined by a dot: a user name');
});

test('key sweep: an ordinary word wrongly taken for a name counts only when written the way the key has it, and each hit names the word', () => {
  const m = matterOf('Nothing here.');
  m.cloak.register('PERSON_9', 'Cabinets');
  m.cloak.register('PERSON_10', 'Notice'); // a word on the common-word lists
  assert.deepEqual(keySweep(m, 'The kitchen cabinets were delivered. KITCHEN CABINETS. Take notice. NOTICE.'), []);
  const hits = keySweep(m, 'He signed for the Cabinets order.');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].value, 'Cabinets');
  assert.equal(hits[0].paragraph, 1);
  // In the double check each is a finding a person can decide, with the word and its line, never a hard stop:
  // written as in the key it is a value from the key; written otherwise, a possible name.
  const v = doubleCheck(m, [unitOf('Line one.\nThe kitchen cabinets arrived. He signed for the Cabinets order. Take notice.')]);
  const g = (check, value) => v.groups.find((x) => x.check === check && x.value === value);
  assert.equal(g('key', 'Cabinets').places[0].line, 2);
  assert.match(g('name', 'cabinets').what, /\{\{PERSON_9\}\}, with other capitals\. Here it may be the ordinary word/);
  assert.ok(!v.groups.some((x) => /notice/i.test(x.value)), 'a common word in other capitals is not listed at all');
});

test('key sweep: names of four letters or more in any letter case, honours and facts in any format', () => {
  const m = matterOf('Encik Zulkarnain bin Hashim paid RM 60,000.00 on 3 March 2023. Tan Sri Lim Boon Keng attended.');
  assert.deepEqual(keySweep(m, m.apply('Encik Zulkarnain bin Hashim paid RM 60,000.00 on 3 March 2023. Tan Sri Lim Boon Keng attended.')), []);
  const kinds = keySweep(m, 'zulkarnain paid RM60000 on 03/03/2023.').map((h) => h.kind).sort();
  assert.deepEqual(kinds, ['amount', 'date', 'key']);
  assert.deepEqual(keySweep(m, 'A Tan Sri was there.'), [], '"Tan" in "Tan Sri" is the honour, not the surname');
});

test('the reviewer\'s own name in the report: sharing one name word with a party is not a finding; a full name the key holds is', () => {
  const m = matterOf('Siti Nurhaliza binti Abdullah and Aminah binti Yusof signed.');
  const report = (by) => JSON.stringify({ by, review: `Reviewed by ${by} on 1 Jan 2026, 9:00 am.`, files: [] }, null, 2);
  assert.equal(verdict(m, [inspect(m, [reportUnit(report('Siti Aminah (siti.a)'))])]).counts.places, 0);
  const v = verdict(m, [inspect(m, [reportUnit(report('Aminah binti Yusof (aminah)'))])]);
  assert.ok(v.counts.places >= 2);
  assert.equal(v.groups[0].fixable, false, 'hiding cannot change who did the work: it can only be marked as fine');
});

test('pattern sweep and leftover names are fresh: dates, amounts and provisions are not identifiers; titles, particles and the name lists are', () => {
  const m = matterOf('Nothing to learn here.', 'standard');
  const text = 'Paid RM 6,000 on 12-10-2024 under Order 14 rule 1 and Section 74.\nCall 012-345 6789 or write to x.y@mail.example.\nMadam Rohani and Kumar a/l Velu came. Siti Zainab stayed. Low prices. ZAINAB said so.';
  const v = doubleCheck(m, [unitOf(text)]);
  const values = v.groups.map((g) => `${g.check}:${g.value}`).sort();
  assert.deepEqual(values, ['name:Kumar a/l Velu', 'name:Rohani', 'name:Siti Zainab', 'name:ZAINAB', 'pattern:012-345 6789', 'pattern:x.y@mail.example'].sort());
});

test('the double check is quick on a big matter: thousands of key values against a long text', () => {
  const m = new Matter({ options: { level: 'standard' } });
  for (let i = 0; i < 3000; i++) m.cloak.register(`TERM_${i + 1}`, `Valuename${i} Partword${i}`);
  const lines = [];
  for (let i = 0; i < 20000; i++) lines.push(`Row ${i}\tsome ordinary words\tand more words here\t{{TERM_${(i % 3000) + 1}}}`);
  lines.push('A leak: Valuename2999 Partword2999.');
  const t0 = Date.now();
  const v = doubleCheck(m, [unitOf(lines.join('\n'))]);
  const ms = Date.now() - t0;
  assert.equal(v.groups.filter((g) => g.check === 'key').length, 1);
  assert.equal(v.groups.find((g) => g.check === 'key').places[0].line, 20001);
  assert.ok(ms < 15000, `took ${ms} ms`);
});

test('a copy is split into its parts for the locations, using the labels in the copy', () => {
  const f = { out: '001-docx.cloaked.txt', rel: 'a.docx', parts: [{ label: 'Body' }, { label: 'Header' }, { label: 'Sheet: Payments 2023' }], cloaked: 'File: a.docx\n\n[Body]\nline\n\n[Header]\nhead\n\n[Sheet: {{PERSON_1}} payments]\nrow\n' };
  const u = documentUnit(f);
  assert.deepEqual(u.parts.map((p) => [p.line, p.label]), [[1, 'File name'], [3, 'Body'], [6, 'Header'], [9, 'Sheet: {{PERSON_1}} payments']]);
});
