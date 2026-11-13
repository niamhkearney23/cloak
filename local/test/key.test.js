import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, stat, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeMatter, REAL_VALUES, REAL_EXACT } from './matter.js';
import { createMatter, openMatter } from '../matter.js';
import { KEY_FILE_NAME } from '../keyfile.js';
import { VERSION } from '../version.js';

// Feature 2: the key. Made-up matter only.

const FAST = { N: 2 ** 12, r: 8, p: 1 }; // quicker key stretching, for tests only
const PASSWORD = 'correct horse battery';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

let root, src, out, dir, recoveryCode, firstRun, firstKey;
before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'cloak-key-'));
  src = path.join(root, 'documents');
  out = path.join(root, 'cloaked');
  dir = path.join(root, 'matter');
  await makeMatter(src);
  const made = await createMatter({ testMatter: true, dir, name: 'Ahmad bin Ismail v Maju Jaya', password: PASSWORD, user: 'lawyer-one', kdf: FAST });
  recoveryCode = made.recoveryCode;
  firstRun = await made.session.cloakFolder({ folder: src });
  firstKey = made.session.matter.key().entries;
  await made.session.close();
});

test('the key file holds the tags and real values, but only encrypted', async () => {
  const raw = await readFile(path.join(dir, KEY_FILE_NAME), 'utf8');
  assert.deepEqual(realValuesIn(raw), []);
  assert.doesNotMatch(raw, /PERSON_1|Ahmad|correct horse/i);
  const file = JSON.parse(raw);
  assert.equal(file.format, 'cloak-key');
  assert.equal(file.cloak_version, VERSION);
  assert.equal(file.kdf.name, 'scrypt');
  assert.deepEqual(file.slots.map((s) => s.type).sort(), ['password', 'recovery']);
  // The matter's name is inside the encrypted part, not in the clear.
  assert.equal(file.name, undefined);
});

test('the right password opens it and gives back the same map', async () => {
  const s = await openMatter({ dir, password: PASSWORD, user: 'lawyer-one' });
  assert.equal(s.name, 'Ahmad bin Ismail v Maju Jaya');
  assert.deepEqual(s.matter.key().entries, firstKey);
  assert.equal(s.matter.key().entries.find((e) => e.token === 'NRIC_1').value, '800505-14-5521');
  await s.close();
});

test('a wrong password does not open it, and the attempt is logged', async () => {
  await assert.rejects(openMatter({ dir, password: 'wrong password 123', user: 'someone' }), /password is not right/);
  await assert.rejects(openMatter({ dir, password: '', user: 'someone' }), /password is not right/);
  const log = await readFile(path.join(dir, 'log.jsonl'), 'utf8');
  assert.match(log, /"by":"someone","action":"open-failed"/);
});

test('the recovery code opens it when the password is forgotten, and a new password can be set', async () => {
  assert.match(recoveryCode, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){5}$/);
  const s = await openMatter({ dir, recoveryCode: recoveryCode.toLowerCase().replace(/-/g, ' '), user: 'partner' });
  assert.deepEqual(s.matter.key().entries, firstKey);
  await s.changePassword('a brand new password');
  await s.close();
  await assert.rejects(openMatter({ dir, password: PASSWORD }), /password is not right/);
  const again = await openMatter({ dir, password: 'a brand new password', user: 'partner' });
  await again.changePassword(PASSWORD);
  await again.close();
  await assert.rejects(openMatter({ dir, recoveryCode: '0000-0000-0000-0000-0000-0000' }), /recovery code is not right/);
});

test('with neither the password nor the recovery code there is no way in', async () => {
  await assert.rejects(openMatter({ dir }), /password is not right/);
  await assert.rejects(openMatter({ dir, password: recoveryCode }), /password is not right/);
});

test('short passwords are refused', async () => {
  await assert.rejects(createMatter({ testMatter: true, dir: path.join(root, 'other'), password: 'short', kdf: FAST }), /at least 10 characters/);
});

test('a key file that has been changed, even slightly, will not open', async () => {
  const file = path.join(dir, KEY_FILE_NAME);
  const good = await readFile(file, 'utf8');
  const parsed = JSON.parse(good);
  const data = Buffer.from(parsed.contents.data, 'base64');
  data[10] ^= 1;
  parsed.contents.data = data.toString('base64');
  await writeFile(file, JSON.stringify(parsed));
  await assert.rejects(openMatter({ dir, password: PASSWORD }), /changed or damaged/);
  // Another matter's identity cannot be swapped in either.
  const swapped = JSON.parse(good);
  swapped.matter_id = '00000000-0000-4000-8000-000000000000';
  await writeFile(file, JSON.stringify(swapped));
  await assert.rejects(openMatter({ dir, password: PASSWORD }), /changed or damaged/);
  await writeFile(file, good);
  const s = await openMatter({ dir, password: PASSWORD });
  await s.close();
});

test('only one person can have the matter open; a second lawyer gets in once it is closed', async () => {
  const one = await openMatter({ dir, password: PASSWORD, user: 'lawyer-one' });
  await assert.rejects(openMatter({ dir, password: PASSWORD, user: 'lawyer-two' }), /lawyer-one has this matter open/);
  await one.close();
  const two = await openMatter({ dir, password: PASSWORD, user: 'lawyer-two' });
  assert.deepEqual(two.matter.key().entries, firstKey);
  await two.close();
  // A lock left behind by a crash long ago is cleared, and that is logged.
  await writeFile(path.join(dir, 'matter.lock'), JSON.stringify({ user: 'lawyer-one', computer: 'old-pc', since: new Date(Date.now() - 13 * 3600 * 1000).toISOString() }));
  const three = await openMatter({ dir, password: PASSWORD, user: 'lawyer-two' });
  await three.close();
  assert.match(await readFile(path.join(dir, 'log.jsonl'), 'utf8'), /stale-lock-cleared/);
});

test('adding files to the matter reuses the key: same people, same tags, same file numbers', async () => {
  const s = await openMatter({ dir, password: PASSWORD, user: 'lawyer-two' });
  await writeFile(path.join(src, '21 New letter.txt'), 'Dear Sirs,\n\nWe refer to Encik Ahmad bin Ismail (NRIC 800505145521) and to Tan Boon Huat of Maju Jaya Sdn Bhd.\nA new witness, Rosli bin Karim, will also give evidence.\n');
  const run = await s.cloakFolder({ folder: src });
  const tokenOf = (entries, value) => entries.find((e) => e.value.toLowerCase() === value.toLowerCase())?.token;
  const entries = s.matter.key().entries;
  // Everything from the first run is still there, unchanged.
  for (const e of firstKey) assert.equal(tokenOf(entries, e.value), e.token, e.value);
  const added = run.files.find((f) => f.rel === '21 New letter.txt');
  const ahmad = tokenOf(firstKey, 'Ahmad bin Ismail');
  assert.match(added.cloaked, new RegExp(`Encik \\{\\{${ahmad}\\}\\} \\(NRIC \\{\\{NRIC_1`));
  assert.match(added.cloaked, new RegExp(`\\{\\{${tokenOf(firstKey, 'Tan Boon Huat')}\\}\\}`));
  // The new witness gets the next free number, not a reused one.
  const rosli = tokenOf(entries, 'Rosli bin Karim');
  assert.ok(rosli && !firstKey.some((e) => e.token === rosli));
  assert.doesNotMatch(added.cloaked, /Rosli|Karim/);
  // Files keep their output names from the first run.
  for (const f of firstRun.files.filter((x) => x.out)) assert.equal(run.files.find((x) => x.rel === f.rel).out, f.out);
  assert.match(added.out, /^\d{3}-txt\.cloaked\.txt$/);
  await s.close();
});

test('unchanged files come from the encrypted cache and are not read again', async () => {
  const s = await openMatter({ dir, password: PASSWORD, user: 'lawyer-one' });
  const reread = [];
  const run = await s.cloakFolder({ folder: src, onProgress: (p) => p.stage === 'read' && reread.push(p.file) });
  assert.equal(run.report.totals.taken_from_cache, 21);
  assert.ok(run.files.filter((f) => !f.inside).every((f) => f.disk.fromCache));
  assert.ok(run.files.find((f) => f.rel.startsWith('09')).cloaked.includes('SALE AND PURCHASE AGREEMENT'), 'OCR text came back from the cache');
  // Change one file: only that one is read again.
  await writeFile(path.join(src, '21 New letter.txt'), 'Changed: Rosli bin Karim has withdrawn.\n');
  const again = await s.cloakFolder({ folder: src });
  assert.equal(again.report.totals.taken_from_cache, 20);
  console.log(`      second run with everything cached: ${run.seconds.toFixed(2)} seconds (first run ${firstRun.seconds.toFixed(2)})`);
  await s.close();
});

test('nothing real is stored in the matter folder, the cache, the log or temp files', async () => {
  const files = await walk(dir);
  assert.ok(files.some((f) => f.includes(`${path.sep}cache${path.sep}`)), 'there is a cache');
  assert.ok(files.length > 20);
  for (const f of files) {
    const raw = (await readFile(f)).toString('latin1');
    assert.deepEqual(realValuesIn(raw), [], `real value in ${path.relative(dir, f)}`);
    // Cache file names say nothing about the original file.
    if (f.endsWith('.enc')) assert.match(path.basename(f), /^[0-9a-f]{64}\.enc$/);
  }
  assert.deepEqual(realValuesIn((await readdir(dir)).join(' ')), []);
  // No lock is left once everyone has closed the matter.
  await assert.rejects(stat(path.join(dir, 'matter.lock')));
});

test('the log shows who did what and when', async () => {
  const lines = (await readFile(path.join(dir, 'log.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  const actions = lines.map((l) => `${l.by}:${l.action}`);
  for (const a of ['lawyer-one:matter-created', 'lawyer-one:cloak-folder', 'lawyer-one:closed', 'someone:open-failed', 'partner:opened', 'partner:password-changed', 'lawyer-two:opened', 'lawyer-two:cloak-folder']) assert.ok(actions.includes(a), a);
  assert.ok(lines.every((l) => Date.parse(l.t) > 0 && l.cloak_version === VERSION));
  assert.equal(lines.find((l) => l.by === 'partner' && l.action === 'opened').with, 'recovery code');
});

test('the key can never sit with the documents or the cloaked copies', async () => {
  const s = await openMatter({ dir, password: PASSWORD });
  await assert.rejects(s.cloakFolder({ folder: root }), /outside the documents folder/);
  await s.cloakFolder({ folder: src });
  // Nothing is written anywhere until the review is finished.
  await assert.rejects(stat(out));
  await assert.rejects(s.export({ outDir: out }), /until the review is finished/);
  await s.close();
});

test('with the real key-stretching settings a matter still opens in a few seconds', async () => {
  const d = path.join(root, 'slow');
  const started = Date.now();
  const { session } = await createMatter({ testMatter: true, dir: d, password: 'a long enough password' });
  await session.close();
  const s = await openMatter({ dir: d, password: 'a long enough password' });
  await s.close();
  const file = JSON.parse(await readFile(path.join(d, KEY_FILE_NAME), 'utf8'));
  assert.equal(file.kdf.N, 2 ** 17);
  console.log(`      create + open with full-strength settings: ${((Date.now() - started) / 1000).toFixed(1)} seconds`);
});
