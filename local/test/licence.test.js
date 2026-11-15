import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertLicenceAllowsExport, checkLicence, findLicence, issueLicence, keyFingerprint, licenceBlock, licenceForReport, licenceView, DEVELOPMENT_KEY_FINGERPRINT } from '../licence.js';
import { LICENCE_PUBLIC_KEY } from '../licence-key.js';
import { createMatter } from '../matter.js';
import { checkDraft } from '../draftcheck.js';
import { finishReview } from './helpers.js';

// Every firm, key and licence here is made up for the test.
const local = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tool = path.join(local, 'tools', 'licence.mjs');
const FAST = { N: 2 ** 12, r: 8, p: 1 };
const vendor = generateKeyPairSync('ed25519');
const stranger = generateKeyPairSync('ed25519');
const day = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
const NOW = day(2026, 11, 20);
const issue = (extra = {}) => issueLicence({ privateKey: vendor.privateKey, firm: 'Made-up Advocates & Solicitors', seats: 10, issued: '2026-11-15', expires: '2027-11-14', id: 'CL-TEST-0001', ...extra });
const check = (text, extra = {}) => checkLicence(text, { publicKey: vendor.publicKey, today: NOW, ...extra });

// Change the signed details but keep the old signature, as someone editing the file would.
function editDetails(text, change) {
  const lines = text.split('\n');
  const a = lines.indexOf('Data:');
  const b = lines.indexOf('Signature:');
  const details = JSON.parse(Buffer.from(lines.slice(a + 1, b).join(''), 'base64url').toString('utf8'));
  change(details);
  const data = Buffer.from(JSON.stringify(details)).toString('base64url').match(/.{1,64}/g);
  return [...lines.slice(0, a + 1), ...data, ...lines.slice(b)].join('\n');
}

test('a licence signed with the vendor key is valid and gives its details', () => {
  const text = issue();
  assert.match(text, /^-----BEGIN CLOAK LICENCE-----\nProduct: Cloak\nLicensed to: Made-up Advocates & Solicitors\nSeats: 10\nIssued: 15 Nov 2026\nExpires: 14 Nov 2027\nLicence ID: CL-TEST-0001\n/);
  const r = check(text);
  assert.equal(r.status, 'valid');
  assert.deepEqual(r.licence, { id: 'CL-TEST-0001', firm: 'Made-up Advocates & Solicitors', seats: 10, issued: '2026-11-15', expires: '2027-11-14', key: keyFingerprint(vendor.publicKey) });
  assert.equal(r.daysLeft, 359);
  const v = licenceView(r, NOW);
  assert.equal(v.licensed, true);
  assert.equal(v.expires, '14 Nov 2027');
  assert.equal(v.seats, 10);
});

test('a licence changed after it was issued is refused', () => {
  const text = issue();
  // The signed details: more seats, a later end, another firm.
  for (const change of [(d) => { d.seats = 500; }, (d) => { d.expires = '2099-12-31'; }, (d) => { d.firm = 'Another Firm'; }]) {
    const r = check(editDetails(text, change));
    assert.equal(r.status, 'invalid');
    assert.equal(r.code, 'CHANGED');
  }
  // The signature itself.
  const sig = text.split('\n').indexOf('Signature:') + 1;
  const lines = text.split('\n');
  lines[sig] = (lines[sig][0] === 'A' ? 'B' : 'A') + lines[sig].slice(1);
  assert.equal(check(lines.join('\n')).code, 'CHANGED');
  // Only the readable lines at the top.
  assert.equal(check(text.replace('Seats: 10', 'Seats: 100')).code, 'CHANGED');
  assert.match(check(text.replace('Expires: 14 Nov 2027', 'Expires: 14 Nov 2037')).reason, /"Expires" line/);
  assert.equal(check(text.replace('Licensed to: Made-up Advocates', 'Licensed to: Other Advocates')).code, 'CHANGED');
});

test('an expired licence is refused; the last day still counts', () => {
  const ended = check(issue({ issued: '2025-11-01', expires: '2026-11-19' }));
  assert.equal(ended.status, 'expired');
  assert.equal(ended.code, 'EXPIRED');
  assert.match(ended.reason, /ended on 19 Nov 2026/);
  assert.equal(ended.licence.firm, 'Made-up Advocates & Solicitors', 'an ended licence still says whose it was');
  const lastDay = check(issue({ issued: '2025-11-01', expires: '2026-11-20' }));
  assert.equal(lastDay.status, 'valid');
  assert.equal(lastDay.daysLeft, 0);
  assert.equal(licenceView(ended, NOW).licensed, false);
  assert.equal(licenceView(ended, NOW).status, 'expired');
});

test('a licence signed with another key is refused, and the key built into Cloak refuses a stranger\'s licence', () => {
  const other = issueLicence({ privateKey: stranger.privateKey, firm: 'Made-up Firm', seats: 1, issued: '2026-11-15', expires: '2027-11-14' });
  assert.equal(check(other).code, 'OTHER_KEY');
  assert.match(check(other).reason, /different copy of Cloak/);
  // No publicKey given: the key built into the app is used.
  const r = checkLicence(other, { today: NOW });
  assert.equal(r.status, 'invalid');
  assert.equal(r.code, 'OTHER_KEY');
  assert.equal(checkLicence(issue(), { today: NOW }).status, 'invalid');
});

test('the built-in key is an Ed25519 public key, and the development key is recognised', () => {
  assert.match(LICENCE_PUBLIC_KEY, /^-----BEGIN PUBLIC KEY-----/);
  assert.doesNotMatch(LICENCE_PUBLIC_KEY, /PRIVATE/);
  assert.match(keyFingerprint(LICENCE_PUBLIC_KEY), /^[0-9A-F]{16}$/);
  // The development key (its private half was thrown away, so nothing in the repository can sign for it).
  const developmentKey = '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAodiWCn8QCY4qI0MFZjfF4jDmQezuyXrpfKGAzKCTGh0=\n-----END PUBLIC KEY-----\n';
  assert.equal(keyFingerprint(developmentKey), DEVELOPMENT_KEY_FINGERPRINT);
});

test('text that is not a licence is refused', () => {
  for (const text of ['', 'hello', '-----BEGIN CLOAK LICENCE-----\nData:\nabc\n', `-----BEGIN CLOAK LICENCE-----\nData:\n${'A'.repeat(20000)}\nSignature:\nAAAA\n-----END CLOAK LICENCE-----`, '-----BEGIN CLOAK LICENCE-----\nData:\n%%%\nSignature:\n***\n-----END CLOAK LICENCE-----']) {
    const r = check(text);
    assert.equal(r.status, 'invalid');
    assert.equal(r.code, 'NOT_A_LICENCE', JSON.stringify(text.slice(0, 40)));
  }
  assert.equal(check(null).code, 'NOT_A_LICENCE');
});

test('a licence still checks after email quoting, Windows line ends, extra spaces and re-wrapping', () => {
  const text = issue();
  const lines = text.trim().split('\n');
  const a = lines.indexOf('Data:');
  const b = lines.indexOf('Signature:');
  const rewrapped = [...lines.slice(0, a + 1), ...lines.slice(a + 1, b).join('').match(/.{1,40}/g), ...lines.slice(b)];
  const mangled = `Dear Sir,\r\n\r\nPlease find the licence below.\r\n\r\n${rewrapped.map((l) => `>  ${l}   `).join('\r\n')}\r\n\r\nRegards`;
  assert.equal(check(mangled).status, 'valid');
  const block = licenceBlock(mangled);
  assert.match(block, /^-----BEGIN CLOAK LICENCE-----\n/);
  assert.doesNotMatch(block, /Dear Sir|>|\r/);
  assert.equal(check(block).status, 'valid');
});

test('a licence is not issued with impossible details', () => {
  assert.throws(() => issue({ seats: 0 }), /seats/);
  assert.throws(() => issue({ seats: 2.5 }), /seats/);
  assert.throws(() => issue({ expires: '2027-02-30' }), /real dates/);
  assert.throws(() => issue({ expires: '14/11/2027' }), /real dates/);
  assert.throws(() => issue({ expires: '2026-01-01' }), /end before it was issued/);
  assert.throws(() => issue({ firm: '   ' }), /name the firm/);
  assert.throws(() => issue({ id: 'bad id!' }), /licence ID/);
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  assert.throws(() => issueLicence({ privateKey: ec.privateKey, firm: 'X Firm', seats: 1, issued: '2026-11-15', expires: '2027-11-14' }), /Ed25519/);
});

test('the person\'s own licence is used first, then the one IT put on the computer; problems are reported', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-licence-find-'));
  const own = path.join(dir, 'user', 'licence.txt');
  const shared = path.join(dir, 'machine', 'licence.txt');
  const files = [{ file: own, where: 'user' }, { file: shared, where: 'computer' }];
  assert.equal((await findLicence({ files, publicKey: vendor.publicKey, today: NOW })).status, 'none');
  await mkdir(path.dirname(own), { recursive: true });
  await mkdir(path.dirname(shared), { recursive: true });
  await writeFile(own, issue({ issued: '2025-01-01', expires: '2025-12-31' }));
  let r = await findLicence({ files, publicKey: vendor.publicKey, today: NOW });
  assert.equal(r.status, 'expired');
  assert.equal(r.where, 'user');
  await writeFile(shared, issue({ id: 'CL-TEST-SHARED' }));
  r = await findLicence({ files, publicKey: vendor.publicKey, today: NOW });
  assert.equal(r.status, 'valid');
  assert.equal(r.where, 'computer');
  assert.equal(r.licence.id, 'CL-TEST-SHARED');
});

test('an evaluation copy exports test matters only, whatever else has passed', () => {
  const valid = check(issue());
  const ended = check(issue({ issued: '2025-11-01', expires: '2026-11-19' }));
  const refused = (licence, today = NOW) => assert.throws(() => assertLicenceAllowsExport({ licence, testMatter: false, today }), (e) => e.code === 'EVALUATION_TEST_MATTERS_ONLY' && /evaluation copy/.test(e.message));
  refused(undefined);
  refused(null);
  refused(ended);
  refused(check(issue().replace('Seats: 10', 'Seats: 99')));
  refused({ status: 'none' });
  // A licence that was running when it was loaded but has ended since.
  refused(valid, day(2027, 11, 15));
  assert.doesNotThrow(() => assertLicenceAllowsExport({ licence: valid, testMatter: false, today: NOW }));
  assert.doesNotThrow(() => assertLicenceAllowsExport({ licence: undefined, testMatter: true, today: NOW }));
  assert.deepEqual(licenceForReport(valid, NOW), { licensed_to: 'Made-up Advocates & Solicitors', licence_id: 'CL-TEST-0001', licence_ends: '2027-11-14' });
  assert.equal(licenceForReport(ended, NOW).evaluation_copy, true);
});

async function matterWithDocuments({ testMatter }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-licence-matter-'));
  const docs = path.join(root, 'documents');
  await mkdir(docs, { recursive: true });
  await writeFile(path.join(docs, '01 Note.txt'), 'Encik Hashim bin Daud met Seri Kembara Logistics Sdn Bhd on 3 March 2023.');
  const { session } = await createMatter({ testMatter, dir: path.join(root, 'matter'), password: 'a long test password', user: 'tester', kdf: FAST });
  await session.cloakFolder({ folder: docs });
  await finishReview(session);
  return { root, session };
}

test('without a licence: a test matter exports, the report says "evaluation copy", and restoring works', async () => {
  const { root, session } = await matterWithDocuments({ testMatter: true });
  const out = path.join(root, 'out');
  await session.export({ outDir: out });
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  assert.equal(report.licence.evaluation_copy, true);
  const person = session.matter.cloak.entries.find((e) => /^PERSON_\d+$/.test(e.token)).token;
  const r = checkDraft({ matter: session.matter, draft: `{{${person}}} signed the letter.`, sources: null });
  assert.match(r.restored, /Hashim bin Daud signed the letter\./);
  await session.close();
});

test('without a licence: a matter that is not a test matter is never exported, but its drafts still restore', async () => {
  const { root, session } = await matterWithDocuments({ testMatter: false });
  const out = path.join(root, 'out');
  await assert.rejects(session.export({ outDir: out }), (e) => ['TEST_MATTER_ONLY', 'EVALUATION_TEST_MATTERS_ONLY'].includes(e.code));
  assert.equal(existsSync(out), false, 'nothing was written');
  // An ended licence does not help either.
  session.licence = check(issue({ issued: '2025-11-01', expires: '2026-11-19' }));
  await assert.rejects(session.export({ outDir: out }));
  assert.equal(existsSync(out), false);
  const person = session.matter.cloak.entries.find((e) => /^PERSON_\d+$/.test(e.token)).token;
  const r = checkDraft({ matter: session.matter, draft: `1. {{${person}}} appeared.`, sources: null });
  assert.match(r.restored, /Hashim bin Daud appeared\./);
  await session.close();
});

test('with a licence, the export report carries the licensee and the licence ID', async () => {
  const { root, session } = await matterWithDocuments({ testMatter: true });
  session.licence = checkLicence(issue({ issued: '2026-01-01', expires: '2099-12-31' }), { publicKey: vendor.publicKey });
  await session.export({ outDir: path.join(root, 'out') });
  const report = JSON.parse(await readFile(path.join(root, 'out', 'cloak-report.json'), 'utf8'));
  assert.deepEqual(report.licence, { licensed_to: 'Made-up Advocates & Solicitors', licence_id: 'CL-TEST-0001', licence_ends: '2099-12-31' });
  await session.close();
});

// ------------------------------------------------------------- the vendor's tool

const run = (args, env = {}) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', env: { ...process.env, CLOAK_LICENCE_PASSPHRASE: '', ...env } });

test('the licence tool makes a key pair outside the repository, issues a licence and checks it', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-vendor-keys-'));
  let r = run(['keygen', dir]);
  assert.equal(r.status, 0, r.stderr);
  const priv = path.join(dir, 'cloak-licence-private.pem');
  const pub = path.join(dir, 'cloak-licence-public.pem');
  assert.match(await readFile(priv, 'utf8'), /BEGIN PRIVATE KEY/);
  if (process.platform !== 'win32') assert.equal(statSync(priv).mode & 0o777, 0o600);
  // It never overwrites a key.
  assert.notEqual(run(['keygen', dir]).status, 0);
  const lic = path.join(dir, 'firm.licence.txt');
  r = run(['issue', '--key', priv, '--firm', 'Made-up Law Chambers', '--seats', '3', '--issued', '2026-11-15', '--expires', '2099-11-14', '--out', lic]);
  assert.equal(r.status, 0, r.stderr);
  r = run(['check', lic, '--key', pub]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Licensed to: Made-up Law Chambers[\s\S]*Result: valid/);
  // The key built into Cloak does not accept it.
  assert.notEqual(run(['check', lic]).status, 0);
  // use-key writes a module that accepts it; a private key is refused.
  const keyModule = path.join(dir, 'licence-key.js');
  assert.notEqual(run(['use-key', priv, '--to', keyModule]).status, 0);
  assert.equal(existsSync(keyModule), false);
  r = run(['use-key', pub, '--to', keyModule]);
  assert.equal(r.status, 0, r.stderr);
  const { LICENCE_PUBLIC_KEY: written } = await import(pathToFileURL(keyModule).href);
  assert.equal(checkLicence(await readFile(lic, 'utf8'), { publicKey: written }).status, 'valid');
});

test('the licence tool refuses to put a private key inside a git repository', async () => {
  const before = await readdir(path.join(local, 'test'));
  const r = run(['keygen', path.join(local, 'test')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /inside the git repository/);
  assert.deepEqual(await readdir(path.join(local, 'test')), before);
});

test('the licence tool can keep the private key encrypted', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-vendor-keys-'));
  assert.equal(run(['keygen', dir], { CLOAK_LICENCE_PASSPHRASE: 'made-up passphrase for the test' }).status, 0);
  const priv = path.join(dir, 'cloak-licence-private.pem');
  assert.match(await readFile(priv, 'utf8'), /ENCRYPTED PRIVATE KEY/);
  const args = ['issue', '--key', priv, '--firm', 'Made-up Firm', '--seats', '1', '--expires', '2099-01-01'];
  const without = run(args);
  assert.notEqual(without.status, 0);
  assert.match(without.stderr, /CLOAK_LICENCE_PASSPHRASE/);
  const withIt = run(args, { CLOAK_LICENCE_PASSPHRASE: 'made-up passphrase for the test' });
  assert.equal(withIt.status, 0, withIt.stderr);
  assert.match(withIt.stdout, /BEGIN CLOAK LICENCE/);
});

// An installed copy never honours the CLOAK_TEST_* licence settings, however its program file is named.
test('test licence settings are honoured only for the source folder run by Electron, never for an installed copy', async () => {
  const { testHooksAllowed } = await import('../app/testhooks.js');
  const source = { isPackaged: false, defaultApp: true, appPath: local, resourcesPath: path.join(local, 'node_modules', 'electron', 'dist', 'resources'), release: false };
  assert.equal(testHooksAllowed(source), true, 'electron <source folder>, as the tests start it');
  // The installed program (resources/app inside the install folder), under its own name.
  const installed = { isPackaged: true, defaultApp: undefined, appPath: '/opt/Cloak/resources/app', resourcesPath: '/opt/Cloak/resources', release: true };
  assert.equal(testHooksAllowed(installed), false);
  // The same program file renamed to electron.exe: Electron then says isPackaged is false.
  assert.equal(testHooksAllowed({ ...installed, isPackaged: false }), false, 'renamed program file');
  // Stock Electron started on the installed app folder: defaultApp is true, isPackaged false.
  const stock = { isPackaged: false, defaultApp: true, appPath: '/opt/Cloak/resources/app', resourcesPath: '/opt/Cloak/resources', release: true };
  assert.equal(testHooksAllowed(stock), false, 'release mark in package.json');
  assert.equal(testHooksAllowed({ ...stock, release: false }), false, 'app folder inside the resources folder');
  assert.equal(testHooksAllowed({ ...source, release: undefined }), false, 'package.json unreadable');
  assert.equal(testHooksAllowed({ ...source, defaultApp: false }), false);
  // The build writes the mark; the source tree does not carry it.
  const pkg = JSON.parse(await readFile(path.join(local, 'package.json'), 'utf8'));
  assert.equal(pkg.build.extraMetadata.cloakRelease, true);
  assert.equal(pkg.cloakRelease, undefined);
});

test('a licence inside a long email thread (over 16 KB) still checks; only the licence block itself is limited', () => {
  const thread = (n) => `${'On Mon, a colleague wrote: > Please keep this message confidential. This email is for the named reader only.\n'.repeat(n)}`;
  const text = `${thread(100)}\n> ${issue().trim().split('\n').join('\n> ')}\n\n${thread(100)}`;
  assert.ok(text.length > 16 * 1024 && text.length < 64 * 1024);
  assert.equal(check(text).status, 'valid');
  assert.equal(check(text.replace(/\n/g, '\r\n')).status, 'valid');
  const block = licenceBlock(text);
  assert.ok(block.length < 2000);
  assert.equal(check(block).status, 'valid');
  // Far beyond anything an email holds: still refused, with the usual message.
  assert.equal(check(`${text}\n${'x'.repeat(1024 * 1024)}`).code, 'NOT_A_LICENCE');
});
