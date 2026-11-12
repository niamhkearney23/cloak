import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMatter, openMatter } from '../matter.js';

// Feature 3: the review. A small made-up matter with one of each problem:
// a missed name, a wrongly hidden term, one person under two tags, and two
// people wrongly joined under one.

const FAST = { N: 2 ** 12, r: 8, p: 1 };
const PASSWORD = 'review test password';
const FILES = {
  'letter one.txt': 'Dear Sirs,\n\nWe act for Abdul Rahim bin Osman. Our client met Bobby at the Pavilion Kuala Lumpur shopping centre.\nThe cheque was drawn on Hong Seng Trading and handed to Tan Ah Kow.\n',
  'letter two.txt': 'Note of call.\n\nAlong confirmed the meeting. Bobby was there too, and so was Tan Ah Kaw, the brother of the payee.\nHong Seng Trading is the well-known hardware shop.\n',
  'statement.txt': 'I, Abdul Rahim bin Osman, state that Bobby is known to me. My family call me Along.\n',
  'chinese note.txt': '收据\n\n订金已由陈文华先生收讫。\n\nReceipt for the deposit.\n',
  'old.doc': 'old word bytes',
};

let root, src, dir, session;
const texts = () => session.run.files.filter((f) => f.cloaked).map((f) => f.cloaked).join('\n');
const tagOf = (value) => session.matter.key().entries.find((e) => e.value.toLowerCase() === value.toLowerCase())?.token;

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'cloak-review-'));
  src = path.join(root, 'documents');
  dir = path.join(root, 'matter');
  await mkdir(src, { recursive: true });
  for (const [name, text] of Object.entries(FILES)) await writeFile(path.join(src, name), text);
  ({ session } = await createMatter({ dir, password: PASSWORD, user: 'reviewer-one', kdf: FAST }));
  await session.cloakFolder({ folder: src });
});

test('each term is listed once, with how many places and files it appears in', () => {
  const data = session.reviewData();
  const rahim = data.terms.find((t) => t.value === 'Abdul Rahim bin Osman');
  assert.ok(rahim);
  assert.equal(data.terms.filter((t) => t.value === 'Abdul Rahim bin Osman').length, 1);
  assert.equal(rahim.type, 'PERSON');
  assert.ok(rahim.places >= 2);
  assert.equal(rahim.files, 2);
  const shop = data.terms.find((t) => t.value === 'Hong Seng Trading');
  assert.equal(shop.files, 2);
  assert.ok(shop.forms.every((f) => typeof f.places === 'number'));
  // The missed name is on the "not sure" list, once, with its count.
  const bobby = data.unsure.find((u) => u.text === 'Bobby');
  assert.equal(data.unsure.filter((u) => u.text === 'Bobby').length, 1);
  assert.ok(bobby.places >= 2);
  assert.ok(bobby.files >= 2);
  assert.ok(bobby.examples[0].includes('Bobby'));
});

test('files are listed with their status, and nothing is written yet', async () => {
  const data = session.reviewData();
  const by = (n) => data.files.find((f) => f.name === n);
  assert.equal(by('letter one.txt').status, 'cloaked');
  assert.equal(by('chinese note.txt').status, 'manual');
  assert.equal(by('old.doc').status, 'unreadable');
  assert.match(by('old.doc').reasons[0], /\.doc/);
  assert.equal(by('old.doc').willExport, false);
  assert.equal(data.waitingForManualCheck, 1);
  await assert.rejects(stat(path.join(root, 'cloaked')));
});

test('nothing can be exported, and the review cannot be signed off, while items are undecided', async () => {
  await assert.rejects(session.export({ outDir: path.join(root, 'cloaked') }), /until the review is finished/);
  await assert.rejects(session.completeReview(), /not finished/);
  assert.ok(session.reviewData().blockers.length >= 1);
});

test('add a missed term: it is hidden in every file', async () => {
  assert.match(texts(), /Bobby/);
  const data = await session.reviewAction({ type: 'add', text: 'Bobby', kind: 'PERSON' });
  assert.doesNotMatch(texts(), /Bobby/);
  const tag = tagOf('Bobby');
  assert.match(tag, /^PERSON_\d+$/);
  assert.equal(data.terms.find((t) => t.tag === tag).files, 3);
  assert.equal(data.terms.find((t) => t.tag === tag).how, 'added in review');
  assert.ok(!data.unsure.some((u) => u.text === 'Bobby'));
});

test('remove a wrong term: it is shown again in every file, and stays that way on the next run', async () => {
  const tag = tagOf('Hong Seng Trading');
  assert.doesNotMatch(texts(), /Hong Seng/);
  const data = await session.reviewAction({ type: 'remove', tag });
  assert.equal((texts().match(/Hong Seng Trading/g) || []).length, 2);
  assert.ok(!data.terms.some((t) => t.tag === tag));
  assert.ok(data.kept.includes('Hong Seng Trading'));
  await session.cloakFolder({ folder: src });
  assert.equal((texts().match(/Hong Seng Trading/g) || []).length, 2);
  assert.equal(tagOf('Hong Seng Trading'), undefined);
});

test('a removed tag number is never given to someone else', async () => {
  const before = session.matter.key().entries.map((e) => e.token);
  await session.reviewAction({ type: 'add', text: 'Syarikat Baru Maju Sdn Bhd', kind: 'COMPANY' });
  const fresh = tagOf('Syarikat Baru Maju Sdn Bhd');
  assert.ok(!before.includes(fresh));
  assert.notEqual(fresh, 'COMPANY_1');
});

test('merge two tags that are the same person: one tag number in every file', async () => {
  // "Along" is the client's family nickname. The tool cannot know that: the
  // reviewer hides it, then joins it to the client's tag.
  const full = tagOf('Abdul Rahim bin Osman');
  await session.reviewAction({ type: 'add', text: 'Along', kind: 'PERSON' });
  const nick = tagOf('Along');
  assert.notEqual(nick, full);
  assert.equal(session.reviewData().terms.find((t) => t.tag === full).files, 2);
  const data = await session.reviewAction({ type: 'merge', from: nick, into: full });
  assert.ok(!data.terms.some((t) => t.tag === nick));
  assert.equal(data.terms.find((t) => t.tag === full).files, 3);
  assert.doesNotMatch(texts(), new RegExp(`\\{\\{${nick}[.}]`));
  assert.doesNotMatch(texts(), /Along/);
  assert.match(session.run.files.find((f) => f.rel === 'letter two.txt').cloaked, new RegExp(`^\\{\\{${full}\\.ALT\\d*\\}\\} confirmed the meeting`, 'm'));
});

test('split a wrong join: the second person gets their own tag, and keeps it on the next run', async () => {
  const data0 = session.reviewData();
  const joined = data0.merges.find((m) => /Tan Ah Ka?w/.test(m.value));
  assert.ok(joined, 'the two similar names were expected to be joined and listed for confirmation');
  assert.match(joined.reason, /spelling/);
  const base = joined.into;
  const data = await session.reviewAction({ type: 'split', tag: joined.tag });
  const kow = tagOf('Tan Ah Kow');
  const kaw = tagOf('Tan Ah Kaw');
  assert.notEqual(kow.split('.')[0], kaw.split('.')[0]);
  assert.ok(!data.merges.some((m) => m.tag === joined.tag));
  await session.cloakFolder({ folder: src });
  assert.equal(tagOf('Tan Ah Kaw'), kaw);
  assert.equal(tagOf('Tan Ah Kow').split('.')[0], base);
  assert.doesNotMatch(texts(), /Ah Kow|Ah Kaw/);
});

test('mark a "not sure" word as fine: it stops being asked about', async () => {
  let data = session.reviewData();
  for (const u of data.unsure) data = await session.reviewAction({ type: 'fine', text: u.text });
  assert.equal(data.unsure.length, 0);
  await session.cloakFolder({ folder: src });
  assert.equal(session.reviewData().unsure.length, 0);
});

test('a file that needs a manual check is only exported after a person approves it; an unreadable one never is', async () => {
  const data = session.reviewData();
  const chinese = data.files.find((f) => f.name === 'chinese note.txt');
  const old = data.files.find((f) => f.name === 'old.doc');
  await assert.rejects(session.approveFile(old.number), /could not be fully read/);
  // The reviewer hides the Chinese name by hand, then approves the file.
  await session.reviewAction({ type: 'add', text: '陈文华', kind: 'PERSON' });
  const after = await session.approveFile(chinese.number);
  const row = after.files.find((f) => f.name === 'chinese note.txt');
  assert.equal(row.checkedBy.by, 'reviewer-one');
  assert.equal(row.willExport, true);
});

test('once everything is decided the review can be signed off, and only then exported', async () => {
  let data = session.reviewData();
  for (const m of data.merges) data = await session.reviewAction({ type: 'confirmMerge', tag: m.tag });
  for (const a of data.shortForms) data = await session.reviewAction({ type: 'confirmShortForm', tag: a.tag, also: a.also });
  for (const u of data.unsure) data = await session.reviewAction({ type: 'fine', text: u.text });
  assert.deepEqual(data.blockers, []);
  data = await session.completeReview();
  assert.equal(data.complete.by, 'reviewer-one');

  const out = path.join(root, 'cloaked');
  await assert.rejects(session.export({ outDir: path.join(dir, 'x') }), /must not go into the matter folder/);
  const result = await session.export({ outDir: out });
  assert.equal(result.written.length, 4);
  assert.equal(result.heldBack, 1);
  const names = await readdir(out);
  assert.ok(names.includes('REVIEWED-NOT-DOUBLE-CHECKED.txt'));
  const all = (await Promise.all(names.map((n) => readFile(path.join(out, n), 'utf8')))).join('\n');
  for (const w of ['Bobby', 'Rahim', 'Osman', 'Along', 'Ah Kow', 'Ah Kaw', '陈文华']) assert.ok(!all.includes(w), `${w} is in the exported files: …${all.slice(Math.max(0, all.indexOf(w) - 80), all.indexOf(w) + 40)}…`);
  assert.match(all, /Hong Seng Trading/);
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  assert.match(report.review, /Reviewed by reviewer-one/);
  assert.equal(report.files.find((f) => f.checked_by_hand).checked_by_hand.by, 'reviewer-one');
});

test('any change after sign-off means the review must be signed off again', async () => {
  assert.ok(session.reviewData().complete);
  await session.reviewAction({ type: 'add', text: 'Pavilion', kind: 'OTHER' });
  assert.equal(session.reviewData().complete, null);
  await assert.rejects(session.export({ outDir: path.join(root, 'cloaked2') }), /until the review is finished/);
  await writeFile(path.join(src, 'new file.txt'), 'A new file about Abdul Rahim bin Osman.\n');
  await session.completeReview();
  await session.cloakFolder({ folder: src });
  assert.equal(session.reviewData().complete, null, 'a new file reopens the review');
});

test('review decisions are kept in the matter for the next lawyer, and logged without real values', async () => {
  await session.close();
  const again = await openMatter({ dir, password: PASSWORD, user: 'reviewer-two' });
  await again.cloakFolder({ folder: src });
  const data = again.reviewData();
  assert.ok(data.kept.includes('Hong Seng Trading'));
  assert.ok(data.terms.some((t) => t.value === 'Bobby'));
  assert.equal(data.files.find((f) => f.name === 'chinese note.txt').checkedBy.by, 'reviewer-one');
  const log = await readFile(path.join(dir, 'log.jsonl'), 'utf8');
  assert.match(log, /"action":"review-change","change":"add"/);
  assert.match(log, /"action":"review-completed"/);
  assert.match(log, /"action":"file-checked-by-hand"/);
  assert.match(log, /"action":"exported","files_written":4/);
  assert.doesNotMatch(log, /Bobby|Rahim|Osman|Along|Hong Seng|Tan Ah|Pavilion/);
  await again.close();
});
