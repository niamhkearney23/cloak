import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMatter, REAL_VALUES, REAL_EXACT } from './matter.js';
import { VERSION } from '../version.js';

// The real app window, driven like a person would: create a matter, cloak the
// made-up folder, review, approve, finish, export.
// On Linux this needs a display:  xvfb-run -a npm run test:app

const require = createRequire(import.meta.url);
const local = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const noDisplay = process.platform === 'linux' && !process.env.DISPLAY;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('the app: one window, from folder to reviewed export', { skip: noDisplay && 'no display (run under xvfb-run)', timeout: 180000 }, async () => {
  const { _electron: electron } = require('playwright-core');
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-app-'));
  const docs = path.join(root, 'documents');
  const matter = path.join(root, 'matter');
  const out = path.join(root, 'cloaked');
  const out2 = path.join(root, 'chronology-only');
  const out3 = path.join(root, 'saved-draft');
  await makeMatter(docs);
  await mkdir(matter);
  await mkdir(out2);
  await mkdir(out3);
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [local, '--no-sandbox'],
    env: { ...process.env, CLOAK_TEST_PICKS: JSON.stringify([docs, matter, out2, out, matter, out3]), CLOAK_TEST_USER_DATA: path.join(root, 'userdata') },
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // First run: the app asks for the person's full name before anything else.
    await page.waitForSelector('#full-name');
    await page.click('#save-name').catch(() => {});
    await page.fill('#full-name', 'Reviewer Example');
    await page.click('#save-name');
    await page.waitForSelector('#go-cloak');

    // The version is in the window title and on the page; two buttons on the home screen.
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()), `Cloak ${VERSION}`);
    assert.equal(await page.textContent('#version'), `Version ${VERSION}`);
    assert.equal(await page.locator('.choice').count(), 2);

    // The window cannot reach the network.
    assert.match(await page.evaluate(() => fetch('https://example.com').then(() => 'reached', () => 'blocked')), /blocked/);

    await page.click('#go-cloak');
    await page.click('#pick-folder');
    await page.waitForSelector('#folder-path');
    assert.equal(await page.isDisabled('#start'), true, 'cannot start without a matter');
    await page.click('#pick-matter');
    await page.waitForSelector('#m-create');

    // A short password is refused.
    await page.fill('#m-pw', 'short');
    await page.fill('#m-pw2', 'short');
    await page.click('#m-create');
    await page.waitForSelector('.msg.bad');
    assert.match(await page.textContent('.msg.bad'), /at least 10 characters/);

    await page.fill('#m-name', 'Made-up matter');
    await page.fill('#m-pw', 'a long test password');
    await page.fill('#m-pw2', 'a long test password');
    await page.click('#m-create');
    await page.waitForSelector('#recovery-code');
    assert.match(await page.textContent('#recovery-code'), /^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/);
    assert.equal(await page.isDisabled('#continue'), true, 'must confirm the recovery code was written down');
    await page.check('#wrote');
    await page.click('#continue');

    // Setup: who the client is, who the other parties are, and that these are made-up test documents.
    assert.equal(await page.locator('#client-name').count(), 1);
    await page.fill('#client-name', 'Maju Jaya Sdn Bhd; MJSB');
    await page.fill('#other-parties', 'Hong Seng Trading');
    await page.check('#test-matter');
    await page.click('#start');
    // Progress is shown per file while it runs.
    await page.waitForSelector('#progress tr');
    await page.waitForSelector('.tabs', { timeout: 120000 });

    // Files: all 20 listed, OCR files marked, blocked ones explained.
    await page.click('[data-tab="files"]');
    assert.equal(await page.locator('#panel tbody tr').count(), 20);
    assert.equal(await page.locator('#panel .chip.ocr').count(), 2);
    assert.equal(await page.locator('#panel .chip.unreadable').count(), 2);
    assert.equal(await page.locator('#panel tr:has(.chip.manual)').count(), 1);

    // Nothing can be exported yet, and nothing has been written.
    assert.equal(await page.locator('#export').count(), 0);
    await assert.rejects(stat(out));

    // Everything replaced: each term once, with counts.
    await page.click('[data-tab="terms"]');
    assert.equal(await page.locator('#panel tbody tr td b', { hasText: /^Ahmad bin Ismail$/ }).count(), 1);

    // Add a missed term from the box at the top.
    await page.fill('#add-text', 'Gombak');
    await page.selectOption('#add-kind', 'OTHER');
    await page.click('#add-go');
    await page.waitForSelector('#panel td b:text-is("Gombak")');

    // The chronology screen: build it, read the warning about files not read, edit, merge, add, delete and confirm.
    await page.click('[data-tab="chrono"]');
    await page.click('#chrono-build');
    await page.waitForSelector('#chrono-table');
    assert.match(await page.textContent('#chrono-missing'), /Events in these files are missing from this chronology/);
    const datedRows = await page.locator('#chrono-table tbody tr').count();
    assert.ok(datedRows > 10);
    assert.match(await page.textContent('#toggle-undated'), /Show the \d+ rows with no date/, 'rows with no date are hidden, with a count and a button');
    await page.click('#toggle-undated');
    await page.waitForFunction((n) => document.querySelectorAll('#chrono-table tbody tr').length > n, datedRows);
    await page.click('#toggle-undated');
    await page.waitForFunction((n) => document.querySelectorAll('#chrono-table tbody tr').length === n, datedRows);
    await page.locator('[data-edit]').first().click();
    await page.fill('#fd-text', 'Edited by the reviewer.');
    await page.click('#fd-yes');
    await page.waitForSelector('#chrono-table td:has-text("Edited by the reviewer.")');
    await page.locator('[data-pick]').nth(1).check();
    await page.locator('[data-pick]').nth(2).check();
    await page.click('#chrono-merge');
    await page.waitForFunction((n) => document.querySelectorAll('#chrono-table tbody tr').length === n - 1, datedRows);
    await page.click('#chrono-add');
    await page.fill('#fd-date', '20 January 2024');
    await page.fill('#fd-text', 'Client telephoned the firm.');
    await page.click('#fd-yes');
    await page.waitForSelector('#chrono-table td:has-text("Client telephoned the firm.")');
    await page.locator('[data-delete]').last().click();
    await page.click('#yes');
    await page.waitForFunction((n) => document.querySelectorAll('#chrono-table tbody tr').length === n - 1, datedRows);
    await page.click('#chrono-confirm-go');
    await page.waitForSelector('#chrono-confirm .chip.cloaked');

    // The facts tab: blurred dates and amounts are listed apart from the names.
    await page.click('[data-tab="facts"]');
    assert.ok(await page.locator('#panel .tag', { hasText: /DATE_1/ }).count() > 0);

    // Decide everything that is waiting.
    await page.click('[data-tab="unsure"]');
    const clickAll = async (sel) => {
      for (let n = await page.locator(sel).count(); n > 0; n = await page.locator(sel).count()) {
        await page.locator(sel).first().click();
        await page.waitForFunction(([q, before]) => document.querySelectorAll(q).length < before, [sel, n], { timeout: 10000 });
      }
    };
    await clickAll('[data-fine]');
    await page.click('[data-tab="joined"]');
    assert.ok(await page.locator('[data-same]').count() > 0, 'joined names are listed for confirmation');
    await clickAll('[data-same], [data-short-ok]');

    // A file that needs a manual check: read it, tick the box, approve.
    await page.click('[data-tab="files"]');
    await page.click('[data-check]');
    await page.waitForSelector('.dialog');
    // Non-Latin text is showing: the safe choice (hide it) is the default, and approving it as it is needs the typed word.
    assert.equal(await page.isDisabled('#approve'), true);
    await page.click('#hide-nl');
    await page.waitForSelector('#checked');
    assert.equal(await page.isDisabled('#approve'), true);
    await page.check('#checked');
    await page.click('#approve');
    await page.waitForSelector('.dialog', { state: 'detached' });

    await page.click('#finish');
    await page.waitForSelector('#export-chrono');
    // The recommended export: the confirmed chronology alone (with the context sheet).
    await page.click('#export-chrono');
    await page.waitForSelector('#exported');
    assert.match(await page.textContent('#exported'), /2 cloaked copies written/);
    assert.deepEqual((await readdir(out2)).filter((n) => n.endsWith('.cloaked.txt')).sort(), ['000-chronology.cloaked.txt', '000-context-sheet.cloaked.txt']);
    await page.click('#export');
    await page.waitForFunction(() => /20 cloaked copies written/.test(document.getElementById('exported')?.textContent || ''));
    assert.match(await page.textContent('#exported'), /2 files were held back/);

    // What was exported holds no real value.
    const names = await readdir(out);
    assert.equal(names.filter((n) => n.endsWith('.cloaked.txt')).length, 20);
    for (const n of names) {
      const text = await readFile(path.join(out, n), 'utf8');
      for (const v of REAL_VALUES) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text), `${v} in ${n}`);
      for (const v of REAL_EXACT) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text), `${v} in ${n}`);
      assert.ok(!/Gombak/.test(text));
    }
    assert.match(JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8')).review, /^Reviewed by /);
    assert.deepEqual(errors, []);
    assert.ok(await stat(path.join(matter, 'matter.lock')), 'the matter is locked while the window is open');

    // Restore a draft: open the matter again, paste a draft with tags, see the report and the restored text.
    await page.reload();
    await page.waitForSelector('#go-restore');
    await page.click('#go-restore');
    await page.click('#pick-matter');
    await page.fill('#m-secret', 'a long test password');
    await page.click('#m-open');
    await page.waitForSelector('#draft');
    const person = (await readFile(path.join(out, '001-docx.cloaked.txt'), 'utf8')).match(/\{\{PERSON_\d+\}\}/)[0];
    await page.fill('#draft', `1. ${person} signed.\n2. {{PERSON_999}} appeared.\n3. [FOR THE LAWYER: grounds to follow]`);
    await page.click('#do-restore');
    await page.waitForSelector('#restore-report');
    assert.match(await page.textContent('#restore-overall'), /Failed/);
    assert.match(await page.textContent('#restore-report'), /Tag-like text that is not in the key/);
    assert.match(await page.textContent('#restore-report'), /drafting note left in the draft/);
    const restored = await page.textContent('#restored-text');
    assert.ok(!restored.includes(person), 'the tag was put back');
    assert.ok(restored.includes('{{PERSON_999}}'), 'a tag that is not in the key is left as it is');
    await page.click('#save-restored');
    await new Promise((r) => setTimeout(r, 400));
    assert.match(await readFile(path.join(out3, 'restored-draft.txt'), 'utf8'), /signed/);
  } finally {
    await app.close();
  }
  // Closing the window closes the matter for the next person.
  await new Promise((r) => setTimeout(r, 800));
  await assert.rejects(stat(path.join(matter, 'matter.lock')));
});

// The Licence screen, driven like a person would. The licences are made up and
// signed with a key made for this test; only a copy run from the source folder
// may be given such a key. Chromium's own network log is recorded and every
// Node thread carries the tripwire (test/net-tripwire.cjs), to show that the
// window and the licence check reach nothing outside the computer.
test('the licence screen: evaluation copy, refused licences, a licence from a file, nothing sent anywhere', { skip: noDisplay && 'no display (run under xvfb-run)', timeout: 120000 }, async () => {
  const { _electron: electron } = require('playwright-core');
  const { writeFile } = await import('node:fs/promises');
  const { generateKeyPairSync } = await import('node:crypto');
  const { issueLicence } = await import('../licence.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-app-licence-'));
  const userData = path.join(root, 'userdata');
  await mkdir(userData, { recursive: true });
  await writeFile(path.join(userData, 'profile.json'), JSON.stringify({ fullName: 'Reviewer Example' }));
  const vendor = generateKeyPairSync('ed25519');
  const stranger = generateKeyPairSync('ed25519');
  const licence = (privateKey, extra = {}) => issueLicence({ privateKey, firm: 'Made-up Law Chambers', seats: 5, issued: '2026-01-05', expires: '2099-12-31', id: 'CL-TEST-WINDOW', ...extra });
  const licenceFile = path.join(root, 'made-up.licence.txt');
  await writeFile(licenceFile, licence(vendor.privateKey));
  const netLog = path.join(root, 'netlog.json');
  const tripwire = path.join(root, 'tripwire.log');
  await writeFile(tripwire, '');
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [local, '--no-sandbox', `--log-net-log=${netLog}`],
    env: {
      ...process.env,
      CLOAK_TEST_USER_DATA: userData,
      CLOAK_TEST_PICKS: JSON.stringify([licenceFile]),
      CLOAK_TEST_LICENCE_KEY: vendor.publicKey.export({ type: 'spki', format: 'pem' }),
      CLOAK_NET_TRIPWIRE: tripwire,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${JSON.stringify(path.join(local, 'test', 'net-tripwire.cjs'))}`.trim(),
    },
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForSelector('#go-licence');
    await page.waitForFunction(() => document.getElementById('licence-bar')?.textContent === 'Evaluation copy');
    await page.click('#go-licence');
    await page.waitForSelector('#licence-status');
    assert.match(await page.textContent('#licence-status'), /Evaluation copy[\s\S]*made-up test documents[\s\S]*Restoring drafts always works/);
    assert.equal(await page.locator('.msg.warn', { hasText: 'development licence key' }).count(), 0, 'a test key is not the development key');

    // Refused: changed after issue, signed with another key, ended, not a licence at all.
    const refused = async (text, pattern) => {
      await page.fill('#licence-text', text);
      await page.click('#licence-use');
      await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('.msg.bad')?.textContent || ''), pattern.source);
      assert.match(await page.textContent('#licence-status'), /Evaluation copy/);
    };
    await refused(licence(vendor.privateKey).replace('Seats: 5', 'Seats: 50'), /has been changed since it was issued/);
    await refused(licence(stranger.privateKey), /different copy of Cloak/);
    await refused(licence(vendor.privateKey, { issued: '2020-01-01', expires: '2020-12-31' }), /ended on 31 Dec 2020/);
    await refused('hello', /not a Cloak licence/);
    assert.equal(await page.textContent('#licence-bar'), 'Evaluation copy');
    await assert.rejects(stat(path.join(userData, 'licence.txt')), 'a refused licence is not saved');

    // A good licence, chosen as a file.
    await page.click('#licence-file');
    await page.waitForSelector('#licence-status h2:has-text("Licensed to Made-up Law Chambers")');
    const status = await page.textContent('#licence-status');
    assert.match(status, /Licence ID: CL-TEST-WINDOW/);
    assert.match(status, /Seats: 5 \(for your records: Cloak does not count or limit seats\)/);
    assert.match(status, /Ends: 31 Dec 2099/);
    assert.match(await page.textContent('.msg.ok'), /Licence added/);
    assert.equal(await page.textContent('#licence-bar'), 'Licensed to Made-up Law Chambers');
    assert.match(await readFile(path.join(userData, 'licence.txt'), 'utf8'), /^-----BEGIN CLOAK LICENCE-----\n[\s\S]*-----END CLOAK LICENCE-----\n$/);

    // It is still there after the window reloads.
    await page.reload();
    await page.waitForFunction(() => document.getElementById('licence-bar')?.textContent === 'Licensed to Made-up Law Chambers');

    // Removing it makes this an evaluation copy again.
    await page.click('#go-licence');
    await page.click('#licence-remove');
    await page.click('#yes');
    await page.waitForSelector('#licence-status h2:has-text("Evaluation copy")');
    assert.equal(await page.textContent('#licence-bar'), 'Evaluation copy');
    await assert.rejects(stat(path.join(userData, 'licence.txt')));

    // A request from the window is refused before it reaches the network (it shows up in the network log below).
    assert.equal(await page.evaluate(() => fetch('https://example.com/').then(() => 'reached', () => 'blocked')), 'blocked');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }

  // Node side: no thread of the app tried to reach the network.
  assert.equal(await readFile(tripwire, 'utf8'), '', 'a Node thread tried to use the network');
  // Chromium side: the network log was recorded, and holds no web request, name
  // lookup, socket or connection of any kind. (The window's own refused request
  // never reaches the network stack, so it is not in this log at all.)
  const log = JSON.parse(await readFile(netLog, 'utf8'));
  const names = Object.fromEntries(Object.entries(log.constants.logEventTypes).map(([name, n]) => [n, name]));
  assert.ok(log.events.length > 0, 'the network log was recorded');
  const contact = log.events.map((e) => names[e.type]).filter((n) => /^(URL_REQUEST_START_JOB|HOST_RESOLVER_MANAGER_REQUEST|SOCKET_ALIVE|TCP_CONNECT|UDP_CONNECT|SSL_CONNECT|QUIC_SESSION|CONNECT_JOB)$/.test(n));
  const urls = log.events.map((e) => e.params?.url).filter(Boolean);
  assert.deepEqual(contact, [], `network activity in Chromium's log: ${[...new Set(contact)].join(', ')} ${[...new Set(urls)].join(' ')}`);
});
