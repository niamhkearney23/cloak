import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSampleMatter, planSample, SAMPLE_DIR } from '../sample.js';
import { keyValues, redactText, selfTest, supportFile } from '../support.js';
import { checkDraft } from '../draftcheck.js';
import { readZip } from '../zip.js';
import { VERSION } from '../version.js';
import { SAMPLE_INFO, SAMPLE_REAL, SAMPLE_REAL_EXACT, SAMPLE_FACTS, RECEIPT_LINES, sampleDocuments, finishSampleReview } from './sample-matter.js';

// The first-run experience: the sample matter that ships with Cloak, and the
// support file. Made-up documents only.

const FAST = { N: 2 ** 12, r: 8, p: 1 }; // quicker key stretching, for tests only
const PASSWORD = 'a sample password';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exists = (p) => stat(p).then(() => true, () => false);
function realValuesIn(text) {
  const found = [];
  for (const v of [...SAMPLE_REAL, ...SAMPLE_FACTS]) if (new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text)) found.push(v);
  for (const v of SAMPLE_REAL_EXACT) if (new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text)) found.push(v);
  return found;
}
async function listFiles(dir, base = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await listFiles(full, base, out); else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

test('the sample that ships is the one the script writes, and every listed real value is in it', async () => {
  const info = JSON.parse(await readFile(path.join(SAMPLE_DIR, 'sample.json'), 'utf8'));
  assert.equal(info.name, SAMPLE_INFO.name);
  assert.equal(info.client, SAMPLE_INFO.client);
  assert.equal(info.others, SAMPLE_INFO.others);
  const docs = sampleDocuments();
  assert.deepEqual(await listFiles(path.join(SAMPLE_DIR, 'documents')), Object.keys(docs).sort());
  assert.ok(Object.keys(docs).length >= 8 && Object.keys(docs).length <= 12);
  for (const [rel, content] of Object.entries(docs)) {
    const shipped = await readFile(path.join(SAMPLE_DIR, 'documents', ...rel.split('/')));
    // The scanned page is a picture drawn with this computer's fonts; everything else is byte for byte.
    if (/scanned/.test(rel)) assert.equal(shipped.subarray(0, 5).toString(), '%PDF-');
    else assert.ok(shipped.equals(Buffer.isBuffer(content) ? content : Buffer.from(content)), `${rel} differs from test/sample-matter.js: run node test/make-sample.js`);
  }
  // So the leak checks below mean something: each real value really is in the sample.
  const raw = [...Object.values(docs).map((c) => (Buffer.isBuffer(c) ? c.toString('utf8') : c)), ...RECEIPT_LINES].join('\n');
  for (const v of [...SAMPLE_REAL, ...SAMPLE_FACTS]) assert.ok(raw.toLowerCase().includes(v.toLowerCase()), `${v} is not in the sample`);
  for (const v of SAMPLE_REAL_EXACT) assert.ok(new RegExp(`\\b${v}\\b`).test(raw), `${v} is not in the sample`);
});

test('a sample matter: a new folder with the documents, the matter and a place for the copies; a test matter with the parties filled in', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-sample-'));
  const made = await createSampleMatter({ parent: root, password: PASSWORD, user: 'Tester (t)', kdf: FAST });
  try {
    assert.equal(made.folder, path.join(await realpath(root), 'Cloak sample matter')); // the sample resolves links on purpose
    assert.deepEqual(await listFiles(made.docs), Object.keys(sampleDocuments()).sort());
    assert.ok(await exists(path.join(made.matterDir, 'matter.cloakkey')));
    assert.deepEqual(await readdir(made.outDir), []);
    assert.match(made.recoveryCode, /^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/);
    const s = made.session;
    assert.equal(s.testMatter, true, 'marked as a test matter');
    assert.equal(s.name, SAMPLE_INFO.name);
    assert.equal(s.matter.options.level, 'strict');
    assert.deepEqual(s.matter.setup, { client: SAMPLE_INFO.client, others: SAMPLE_INFO.others });
    const log = await readFile(path.join(made.matterDir, 'log.jsonl'), 'utf8');
    assert.match(log, /"action":"matter-created"/);
    assert.match(log, /"action":"sample-matter-created"/);
  } finally {
    await made.session.close();
  }
  // A second sample never writes into the first one.
  const again = await createSampleMatter({ parent: root, password: PASSWORD, user: 'Tester (t)', kdf: FAST });
  assert.equal(again.folder, path.join(await realpath(root), 'Cloak sample matter 2'));
  await again.session.close();
});

test('the sample is refused in a synced folder, and a short password is refused before anything is copied', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-sample-'));
  const synced = path.join(root, 'OneDrive - Example Firm', 'Documents');
  await mkdir(synced, { recursive: true });
  const plan = await planSample(synced);
  assert.match(plan.refused, /OneDrive/);
  assert.match(plan.refused, /Choose a folder outside OneDrive/);
  await assert.rejects(createSampleMatter({ parent: synced, password: PASSWORD, kdf: FAST }), (e) => e.code === 'SYNC_LOCATION');
  assert.deepEqual(await readdir(synced), [], 'nothing was created in the synced folder');
  const plain = path.join(root, 'plain');
  await mkdir(plain);
  assert.equal((await planSample(plain)).refused, null);
  await assert.rejects(createSampleMatter({ parent: plain, password: 'short', kdf: FAST }), /at least 10 characters/);
  assert.deepEqual(await readdir(plain), [], 'nothing was copied');
});

test('the support file holds the version, the system, the self-test and the matter log, and no real value from the sample matter', { timeout: 180000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-support-'));
  const made = await createSampleMatter({ parent: root, password: PASSWORD, user: 'Tester (t)', kdf: FAST });
  const s = made.session;
  try {
    // The whole first run: cloak, review, export, restore a draft.
    await s.cloakFolder({ folder: made.docs });
    await finishSampleReview(s);
    const exported = await s.export({ outDir: made.outDir });
    assert.equal(exported.written.filter((n) => n !== '000-context-sheet.cloaked.txt').length, 10, 'all ten sample files are exported after the review');
    for (const n of await readdir(made.outDir)) assert.deepEqual(realValuesIn(await readFile(path.join(made.outDir, n), 'utf8')), [], n);
    const person = (await readFile(path.join(made.outDir, exported.written[1]), 'utf8')).match(/\{\{PERSON_\d+\}\}/)[0];
    const restored = checkDraft({ matter: s.matter, draft: `${person} paid the deposit.`, sources: null });
    await s.log('draft-restored', { tags_restored: restored.report.tagsRestored, result: restored.result });

    const test = await selfTest({ session: s });
    const zip = await supportFile({ session: s, test });
    const files = readZip(zip.buffer);
    assert.deepEqual(files.names, ['README.txt', 'matter-log.jsonl', 'support-info.json']);
    const info = JSON.parse(files.text('support-info.json'));
    assert.equal(info.cloak_version, VERSION);
    assert.equal(info.system.platform, process.platform);
    assert.equal(info.matter.test_matter, true);
    assert.equal(info.self_test.find((t) => t.check === 'OCR engine').ok, true, JSON.stringify(info.self_test));
    assert.equal(info.self_test.find((t) => t.check === 'Matter key').ok, true, JSON.stringify(info.self_test));
    const readme = files.text('README.txt');
    assert.match(readme, /Cloak did not send this file anywhere/);
    const log = files.text('matter-log.jsonl');
    for (const action of ['matter-created', 'sample-matter-created', 'cloak-folder', 'review-completed', 'exported', 'draft-restored']) assert.match(log, new RegExp(`"action":"${action}"`));

    // No real value anywhere in the zip: not the listed ones, not anything the matter key holds.
    const whole = files.names.map((n) => files.text(n)).join('\n');
    assert.deepEqual(realValuesIn(whole), []);
    assert.equal(redactText(whole, keyValues(s.matter)).count, 0, 'a value from the matter key is in the support file');
    assert.ok(!whole.includes(made.folder) && !whole.includes(root), 'no folder paths');
    assert.ok(!whole.includes(SAMPLE_INFO.name), 'no matter name');
    // The log itself never held a real value: the second guard had nothing to replace.
    assert.equal(zip.replaced, 0);
    assert.match(readme, /Values replaced: 0\./);
  } finally {
    await s.close();
  }
});

test('the support file: a real value that gets into the log is replaced by its tag before it is saved', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-support-'));
  const made = await createSampleMatter({ parent: root, password: PASSWORD, user: 'Tester (t)', kdf: FAST });
  const s = made.session;
  try {
    s.matter.addSetupParties();
    await s.log('planted-for-the-test', { note: 'Called Nurul Huda binti Rahmat and Mr Lee Chee Keong of Kemas Jaya Renovation Sdn Bhd.' });
    const zip = await supportFile({ session: s, test: await selfTest({ session: null, ocr: async () => ({ text: 'CLOAK SELF TEST 2468', confidence: 95 }) }) });
    const files = readZip(zip.buffer);
    const log = files.text('matter-log.jsonl');
    assert.ok(zip.replaced >= 3, `replaced ${zip.replaced}`);
    assert.doesNotMatch(log, /Nurul|Huda|Rahmat|Chee Keong|Kemas/i);
    assert.match(log, /Called \{\{PERSON_\d+[^}]*\}\} and (?:Mr )?\{\{PERSON_\d+[^}]*\}\}.* of \{\{COMPANY_\d+[^}]*\}\}\./);
    assert.match(files.text('README.txt'), new RegExp(`Values replaced: ${zip.replaced}\\.`));
    // With no matter open, the key check is said to be not run.
    assert.match(files.text('support-info.json'), /Not checked: no matter was open/);
  } finally {
    await s.close();
  }
});
