import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMatter, REAL_VALUES, REAL_EXACT } from './matter.js';
import { VERSION } from '../version.js';
import { SAMPLE_INFO, SAMPLE_REAL, SAMPLE_REAL_EXACT, SAMPLE_FACTS, sampleDecision } from './sample-matter.js';
import { readZip } from '../zip.js';

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

// A new lawyer's first run, with no one to help: tips, the help screens, the
// sample matter from the home screen to a reviewed export, a support file,
// and restoring a draft. Made-up documents only.
test('first run: tips, help screens, the sample matter from the home screen to an export, a support file and a restore', { skip: noDisplay && 'no display (run under xvfb-run)', timeout: 180000 }, async () => {
  const { _electron: electron } = require('playwright-core');
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-firstrun-'));
  const documents = path.join(root, 'Documents');
  const supportDir = path.join(root, 'support');
  await mkdir(documents);
  await mkdir(supportDir);
  const sample = path.join(documents, 'Cloak sample matter');
  const out = path.join(sample, 'Cloaked copies');
  const leaks = (text) => [
    ...[...SAMPLE_REAL, ...SAMPLE_FACTS].filter((v) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text)),
    ...SAMPLE_REAL_EXACT.filter((v) => new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text)),
  ];
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [local, '--no-sandbox'],
    // Folder choosers, in order: where to export, where to save the support file, the matter to restore with.
    env: { ...process.env, CLOAK_TEST_PICKS: JSON.stringify([out, supportDir, path.join(sample, 'Matter key')]), CLOAK_TEST_USER_DATA: path.join(root, 'userdata'), CLOAK_TEST_DOCUMENTS: documents },
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForSelector('#full-name');
    await page.fill('#full-name', 'Reviewer Example');
    await page.click('#save-name');
    await page.waitForSelector('#go-cloak');

    // The home screen says what it is for, once. Closing the tip is remembered.
    assert.match(await page.textContent('#tip-home'), /Start here/);
    await page.click('[data-tip-close="home"]');
    assert.equal(await page.locator('#tip-home').count(), 0);
    await page.reload();
    await page.waitForSelector('#go-cloak');
    assert.equal(await page.locator('#tip-home').count(), 0, 'a closed tip stays closed');
    assert.equal(await page.locator('.choice').count(), 2, 'still the two main buttons');

    // Help, from the top bar: how Cloak works, your data, about.
    await page.click('#bar-help');
    await page.waitForSelector('.help-overlay');
    const how = await page.textContent('#help-body');
    for (const part of [/Cloak\./, /Review\./, /Double check\./, /Export\./, /AI tool/, /Restore\./, /Strict \(the default\)/, /Standard/, /What Cloak cannot see/, /not perfect/, /Jawi/]) assert.match(how, part);
    await page.click('.help-overlay [data-help="data"]');
    await page.waitForFunction(() => /Nothing leaves this computer/.test(document.getElementById('help-body')?.textContent || ''));
    const data = await page.textContent('#help-body');
    for (const part of [/matter\.cloakkey/, /Encrypted/, /cache/, /log\.jsonl/, /Not encrypted/, /no back door/i]) assert.match(data, part);
    assert.ok(data.includes(path.join(root, 'userdata')), 'it shows where Cloak keeps its own files');
    await page.click('.help-overlay [data-help="about"]');
    await page.waitForSelector('#about-version');
    assert.equal(await page.textContent('#about-version'), VERSION);
    assert.match(await page.textContent('#help-body'), /THIRD-PARTY-NOTICES\.txt/);
    assert.match(await page.textContent('#help-body'), /Support/);
    await page.keyboard.press('Escape');
    await page.waitForSelector('.help-overlay', { state: 'detached' });
    // ...and from the home screen.
    await page.click('.help-links [data-help="data"]');
    await page.waitForSelector('.help-overlay [data-help="data"][aria-selected="true"]');
    await page.click('#help-close');
    await page.waitForSelector('.help-overlay', { state: 'detached' });

    // Try a sample matter: it goes into Documents unless another place is chosen.
    await page.click('#go-sample');
    await page.waitForSelector('#sample-pw');
    assert.equal(await page.textContent('#sample-path'), sample);
    await page.fill('#sample-pw', 'a sample password');
    await page.fill('#sample-pw2', 'a different password');
    await page.click('#sample-create');
    await page.waitForSelector('.msg.bad');
    assert.match(await page.textContent('.msg.bad'), /do not match/);
    await page.fill('#sample-pw', 'a sample password');
    await page.fill('#sample-pw2', 'a sample password');
    await page.click('#sample-create');
    await page.waitForSelector('#recovery-code');
    assert.match(await page.textContent('#recovery-code'), /^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/);
    assert.equal(await page.textContent('#sample-folder'), sample);
    assert.equal((await readdir(path.join(sample, 'Documents'))).length, 9, 'nine files and the Correspondence folder');
    await page.click('#sample-continue');

    // The normal setup screen, filled in: the documents, the open matter, the parties, a test matter.
    await page.waitForSelector('#sample-note-setup');
    assert.equal(await page.textContent('#folder-path'), path.join(sample, 'Documents'));
    assert.equal(await page.inputValue('#client-name'), SAMPLE_INFO.client);
    assert.equal(await page.inputValue('#other-parties'), SAMPLE_INFO.others);
    assert.equal(await page.isChecked('#test-matter'), true);
    assert.match(await page.textContent('#keep-note'), /Strict/);
    await page.click('#start');
    await page.waitForSelector('.tabs', { timeout: 120000 });
    assert.equal(await page.locator('#sample-note-review').count(), 1);

    // All ten files; the scanned receipt went through OCR; the chat with a Chinese line waits for a manual check.
    await page.click('[data-tab="files"]');
    assert.equal(await page.locator('#panel tbody tr').count(), 10);
    assert.equal(await page.locator('#panel .chip.ocr').count(), 1);
    assert.equal(await page.locator('#panel tr:has(.chip.manual)').count(), 1);
    assert.equal(await page.locator('#panel .chip.unreadable, #panel .chip.partial').count(), 0);

    // The Not sure list, decided as a careful reviewer would: names and address words hidden, the rest fine.
    await page.click('[data-tab="unsure"]');
    for (let n = await page.locator('[data-fine]').count(), guard = 0; n > 0 && guard < 40; n = await page.locator('[data-fine]').count(), guard++) {
      const word = (await page.locator('#panel tbody tr:first-child td b').textContent()).trim();
      const kind = sampleDecision(word);
      await page.locator(kind ? `#panel tbody tr:first-child [data-hide][data-kind="${kind}"]` : '#panel tbody tr:first-child [data-fine]').click();
      await page.waitForFunction(([before, first]) => document.querySelectorAll('[data-fine]').length < before || document.querySelector('#panel tbody tr td b')?.textContent.trim() !== first, [n, word], { timeout: 15000 });
    }
    await page.click('[data-tab="joined"]');
    for (let n = await page.locator('[data-same], [data-short-ok], [data-group]').count(); n > 0; n = await page.locator('[data-same], [data-short-ok], [data-group]').count()) {
      await page.locator('[data-same], [data-short-ok], [data-group]').first().click();
      await page.waitForFunction((before) => document.querySelectorAll('[data-same], [data-short-ok], [data-group]').length < before, n, { timeout: 15000 });
    }
    // The manual check: hide the Chinese passage, read, tick, approve.
    await page.click('[data-tab="files"]');
    await page.click('[data-check]');
    await page.waitForSelector('.dialog');
    await page.click('#hide-nl');
    await page.waitForSelector('#checked');
    await page.check('#checked');
    await page.click('#approve');
    await page.waitForSelector('.dialog', { state: 'detached' });

    await page.click('#finish');
    await page.waitForSelector('#export');
    await page.click('#export');
    await page.waitForSelector('#exported');
    const copies = (await readdir(out)).filter((n) => n.endsWith('.cloaked.txt'));
    assert.equal(copies.length, 11, 'ten files and the context sheet');
    assert.match(await page.textContent('#exported'), /11 cloaked copies written/);
    for (const n of await readdir(out)) assert.deepEqual(leaks(await readFile(path.join(out, n), 'utf8')), [], `a real value in ${n}`);

    // A support file, saved where the person chooses; nothing from the matter's documents in it.
    await page.click('#bar-help');
    await page.click('.help-overlay [data-help="about"]');
    await page.waitForSelector('#save-support');
    assert.match(await page.textContent('#help-body'), /The open matter's log will be included/);
    await page.click('#save-support');
    await page.waitForSelector('#support-saved', { timeout: 60000 });
    assert.match(await page.textContent('#support-saved'), /Cloak has not sent it anywhere/);
    assert.match(await page.textContent('#self-test'), /OCR engine\s*Passed/);
    assert.match(await page.textContent('#self-test'), /Matter key\s*Passed/);
    const zips = (await readdir(supportDir)).filter((n) => /^cloak-support-.*\.zip$/.test(n));
    assert.equal(zips.length, 1);
    const zip = readZip(await readFile(path.join(supportDir, zips[0])));
    assert.deepEqual(zip.names, ['README.txt', 'matter-log.jsonl', 'support-info.json']);
    const inZip = zip.names.map((n) => zip.text(n)).join('\n');
    assert.deepEqual(leaks(inZip), []);
    assert.ok(!inZip.includes(root), 'no folder paths in the support file');
    await page.click('#help-close');

    // Home, then restore a draft made from one of the cloaked copies.
    await page.click('#bar-home');
    await page.click('#yes');
    await page.waitForSelector('#go-restore');
    await page.click('#go-restore');
    await page.click('#pick-matter');
    await page.fill('#m-secret', 'a wrong password');
    await page.click('#m-open');
    await page.waitForSelector('.msg.bad');
    assert.match(await page.textContent('.msg.bad'), /password is not right\. Check that Caps Lock is off/);
    await page.fill('#m-secret', 'a sample password');
    await page.click('#m-open');
    await page.waitForSelector('#sample-note-draft');
    const letter = await readFile(path.join(out, copies.find((n) => n.endsWith('-docx.cloaked.txt'))), 'utf8');
    const person = letter.match(/\{\{PERSON_\d+\}\}/)[0];
    await page.fill('#draft', `${person} has instructed us to issue the claim.`);
    await page.click('#do-restore');
    await page.waitForSelector('#restore-report');
    const restored = await page.textContent('#restored-text');
    assert.ok(!restored.includes(person), 'the tag was put back');
    assert.ok(leaks(restored).length > 0, 'the real name is back in the restored draft');
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
