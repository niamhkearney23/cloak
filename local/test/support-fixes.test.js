import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeMatter } from './matter.js';
import { createMatter, openMatter } from '../matter.js';
import { redactLog, selfTest, noPaths, supportFile } from '../support.js';
import { readZip } from '../zip.js';

// Fixes found in review (support and sample areas). Made-up data only.
const FAST = { N: 2 ** 12, r: 8, p: 1 };
const PASSWORD = 'a long test password';
const exists = (p) => stat(p).then(() => true, () => false);

test('the support file leaves Cloak\'s own times and words alone, and every count agrees', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-log-'));
  const lines = [
    { t: '2026-11-15T05:58:00.000Z', when: '15 Nov 2026, 1:58 pm', by: 'Reviewer Example (rex)', action: 'review-change', change: 'confirm', tag: 'DATE_1' },
    { t: '2026-11-15T05:59:00.000Z', by: 'Kemas Jaya', action: 'closed', note: 'a real name by mistake' },
  ];
  await writeFile(path.join(dir, 'log.jsonl'), `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  const session = {
    dir, matterId: 'm1', openedWith: 'password', testMatter: true, files: {}, review: null, chronology: null,
    matter: { options: { level: 'strict' }, cloak: { entries: [{ value: '15 Nov 2026', token: 'DATE_1' }, { value: 'Action', token: 'COMPANY_1' }, { value: 'Kemas Jaya', token: 'COMPANY_2' }] } },
  };
  const now = new Date(2026, 10, 15, 13, 58);
  const zip = await supportFile({ session, test: [], now });
  const files = readZip(zip.buffer);
  const log = files.text('matter-log.jsonl').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(log[0].when, '15 Nov 2026, 1:58 pm', 'its own time is kept');
  assert.equal(log[0].action, 'review-change', 'its own words are kept');
  assert.ok('action' in log[0] && !Object.keys(log[0]).some((k) => k.includes('{{')));
  assert.equal(log[1].by, '{{COMPANY_2}}', 'a client value in a free-text field is still replaced');
  const info = JSON.parse(files.text('support-info.json'));
  assert.equal(info.made, '15 Nov 2026, 1:58 pm');
  assert.equal(zip.replaced, 1);
  assert.equal(info.values_replaced_by_tags, 1);
  assert.match(files.text('README.txt'), /Made on 15 Nov 2026, 1:58 pm by Cloak/);
  assert.match(files.text('README.txt'), /Values replaced: 1\./);
});

test('the self-test writes its result even if the OCR engine never answers', async () => {
  const never = new Promise(() => {});
  const r = await selfTest({ ocr: () => never, stopOcr: () => never, ocrWaitMs: 100 });
  assert.equal(r[0].check, 'OCR engine');
  assert.equal(r[0].ok, false);
  assert.match(r[0].what, /did not answer within 0 seconds|did not answer within \d+ seconds/);
  assert.equal(r.length, 2);
});

test('the self-test keeps the reason when the OCR engine fails with a plain string', async () => {
  const r = await selfTest({ ocr: () => Promise.reject('Error: Error attempting to read image.'), stopOcr: async () => {} });
  assert.equal(r[0].ok, false);
  assert.match(r[0].what, /Error attempting to read image/);
  assert.doesNotMatch(r[0].what, /did not start/);
  // and a late failure after the wait is not an uncaught error
  const late = await selfTest({ ocr: () => new Promise((_, no) => setTimeout(() => no('late'), 150)), stopOcr: async () => {}, ocrWaitMs: 50 });
  assert.match(late[0].what, /did not answer/);
  await new Promise((ok) => setTimeout(ok, 250));
});

test('paths in self-test errors go to the end of the line, profile names with spaces or apostrophes included', () => {
  const win = "Cannot find module 'x'\nRequire stack:\n- C:\\Users\\Siti Aminah\\AppData\\Local\\Programs\\Cloak\\resources\\app\\extract.js";
  const out = noPaths(win);
  assert.doesNotMatch(out, /Siti|Aminah|AppData|extract\.js/);
  assert.match(out, /Require stack:\n- \(path not shown\)/);
  const apos = "ENOENT: no such file or directory, open 'C:\\Users\\Ja'afar Hamid\\AppData\\Local\\Temp\\cloak-ocr-lang\\eng.traineddata.gz'";
  assert.doesNotMatch(noPaths(apos), /afar|Hamid|Temp/);
  const unc = 'failed \\\\server\\share\\Some Client\\x.txt';
  assert.doesNotMatch(noPaths(unc), /Client|server/);
  assert.equal(noPaths('took 1.2 seconds, 3/4 done'), 'took 1.2 seconds, 3/4 done');
  assert.equal(noPaths(undefined), '');
});

test('the support file guard indexes the key values once, not once per string', () => {
  const values = Array.from({ length: 21000 }, (_, i) => ({ value: `Person${i} Example${i}`, token: `PERSON_${i}` }));
  const log = Array.from({ length: 300 }, (_, i) => JSON.stringify({ t: '2026-11-15T01:00:00Z', by: 'x', action: 'review-change', n: i, note: 'Person5 Example5 saw it' })).join('\n');
  const started = Date.now();
  const r = redactLog(log, values);
  assert.equal(r.count, 300);
  assert.match(r.text, /\{\{PERSON_5\}\} saw it/);
  assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`);
});

test('a save that finishes after the matter is closed is refused, so the key file is never sealed with a zeroed key', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-closed-'));
  const docs = path.join(root, 'documents');
  const dir = path.join(root, 'matter');
  await makeMatter(docs);
  const { session } = await createMatter({ testMatter: true, dir, password: PASSWORD, user: 'tester', kdf: FAST });
  // The folder is still being read when the person closes the matter.
  const reading = session.cloakFolder({ folder: docs });
  await session.close();
  await reading.catch(() => {});
  assert.equal(await exists(path.join(dir, 'matter.lock')), false, 'lock removed');
  await assert.rejects(() => session.save(), /closed/);
  const again = await openMatter({ dir, password: PASSWORD, user: "tester" });
  assert.ok(again, 'the matter still opens with its password');
  await again.close();
});

test('closing while saves are still running does not leave the lock behind', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-closing-'));
  const dir = path.join(root, 'matter');
  const { session } = await createMatter({ testMatter: true, dir, password: PASSWORD, user: 'tester', kdf: FAST });
  await Promise.all([session.save(), session.save(), session.save(), session.close(), session.close()]);
  assert.equal(await exists(path.join(dir, 'matter.lock')), false, 'lock removed');
  const again = await openMatter({ dir, password: PASSWORD, user: "tester" });
  await again.close();
});
