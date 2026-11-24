import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
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
    // The edit leaves two names the first pass does not hide and the review does not ask about: each stands alone
    // after a colon. The double check finds both (below).
    await page.locator('[data-edit]').first().click();
    await page.fill('#fd-text', 'Edited by the reviewer. Copy to: Rohani (accounts). Prepared for: Zubaidah.');
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

    // The double check, from the finish bar: every file that would be written, each with pass or fail.
    assert.match(await page.textContent('#check-state'), /Next: the double check/);
    await page.click('#run-check');
    await page.waitForSelector('#check-findings');
    assert.ok(await page.locator('#check-files li').count() >= 20, 'every file that would be written is listed');
    assert.equal(await page.locator('#check-files li:has(.stamp.fail)').count(), 1, 'only the chronology fails');
    assert.match(await page.textContent('#check-files li:has(.stamp.fail)'), /000-chronology\.cloaked\.txt/);
    const finding = (text) => page.locator('#check-findings .finding', { has: page.locator('.value > b', { hasText: new RegExp(`^${text}$`) }) });
    assert.match(await finding('Rohani').textContent(), /Possible name.*Chronology \(confirmed\) · Chronology · line \d+/s, 'the word, the file and the line are shown');
    assert.match(await finding('Zubaidah').textContent(), /Possible name/);
    assert.match(await page.textContent('#check-state'), /Double check: 2 to decide/);
    // Hide one: it is added as a person, hidden under its tag and checked again.
    assert.equal(await finding('Rohani').locator('[data-dc-kind]').inputValue(), 'PERSON');
    await finding('Rohani').locator('[data-dc-hide]').click();
    await page.waitForFunction(() => !/\bRohani\b/.test(document.getElementById('check-findings')?.textContent || ''));
    // The other is fine: a person decides, after a deliberate yes.
    await finding('Zubaidah').locator('[data-dc-fine]').click();
    await page.click('#yes');
    await page.waitForSelector('#check-summary .chip.cloaked');
    assert.match(await finding('Zubaidah').textContent(), /Marked fine.*Reviewer Example/s);
    assert.match(await page.textContent('#check-state'), /Double check passed/);

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
    const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
    assert.match(report.review, /^Reviewed by Reviewer Example .* Double-checked by Reviewer Example /);
    assert.equal(report.double_check.marked_fine_by_a_person, 1);
    assert.equal(report.double_check.hidden_during_the_double_check, 1);
    assert.ok(names.includes('REVIEWED-AND-DOUBLE-CHECKED.txt'));
    assert.match(await page.textContent('#exported'), /Double-checked by Reviewer Example/);
    // The log has the decisions as counts, never the words.
    const log = await readFile(path.join(matter, 'log.jsonl'), 'utf8');
    assert.match(log, /"action":"double-check-hide"/);
    assert.match(log, /"action":"double-check-fine","check":"name","places":1/);
    assert.ok(!/Zubaidah|Rohani|Ahmad/.test(log), 'no value in the log');
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
  // The app resolves links on purpose (macOS /var -> /private/var, Windows 8.3 names such as RUNNER~1).
  const sample = path.join(await realpath(documents), 'Cloak sample matter');
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
      const word = (await page.locator('#panel .decide-row .word b').first().textContent()).trim();
      const kind = sampleDecision(word);
      await page.locator(kind ? `#panel .decide-row [data-hide][data-kind="${kind}"]` : '#panel .decide-row [data-fine]').first().click();
      await page.waitForFunction(([before, first]) => document.querySelectorAll('[data-fine]').length < before || document.querySelector('#panel .decide-row .word b')?.textContent.trim() !== first, [n, word], { timeout: 15000 });
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
  if (contact.length) {
    // Diagnostic: say exactly what each of these events is (source type, address, host, port, params).
    const srcTypes = Object.fromEntries(Object.entries(log.constants.logSourceType).map(([name, n]) => [n, name]));
    const phases = Object.fromEntries(Object.entries(log.constants.logEventPhase || {}).map(([name, n]) => [n, name]));
    const hot = new Set(log.events.filter((e) => /^(HOST_RESOLVER_MANAGER_REQUEST|SOCKET_ALIVE|UDP_CONNECT|TCP_CONNECT|SSL_CONNECT|URL_REQUEST_START_JOB|CONNECT_JOB|QUIC_SESSION)$/.test(names[e.type])).map((e) => e.source.id));
    console.log('NETLOG-DIAG events of the sources that contain a contact event (id source-type event-type phase params):');
    for (const e of log.events.filter((x) => hot.has(x.source.id))) console.log(`NETLOG-DIAG ${e.source.id} ${srcTypes[e.source.type]} ${names[e.type]} ${phases[e.phase] || e.phase} ${JSON.stringify(e.params || {})}`);
  }
  assert.deepEqual(contact, [], `network activity in Chromium's log: ${[...new Set(contact)].join(', ')} ${[...new Set(urls)].join(' ')}`);
});

// Matter settings, driven like a person would on a made-up matter: a new
// password when a lawyer leaves, a new recovery code, an empty cache, and
// opening with the recovery code when the password is lost.
// The "remember the password" part needs the system's protected store. On
// Linux that means a keyring, for example:
//   dbus-run-session -- sh -c 'echo -n test | gnome-keyring-daemon --unlock --components=secrets; XDG_CURRENT_DESKTOP=GNOME xvfb-run -a npm run test:app'
// Without one, that part is skipped and the test says so.
test('matter settings: a new password, a new recovery code and an empty cache, from the window', { skip: noDisplay && 'no display (run under xvfb-run)', timeout: 180000 }, async () => {
  const { _electron: electron } = require('playwright-core');
  const { openMatter } = await import('../matter.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-settings-app-'));
  const docs = path.join(root, 'documents');
  const matter = path.join(root, 'matter');
  const userData = path.join(root, 'userdata');
  await mkdir(docs);
  await mkdir(matter);
  await writeFile(path.join(docs, '01 Letter.txt'), 'Dear Sirs,\n\nWe act for Encik Ahmad bin Ismail (NRIC 800505-14-5521) in his claim against Maju Jaya Sdn Bhd.\n');
  await writeFile(path.join(docs, '02 File note.txt'), 'Spoke to Tan Boon Huat (012-987 6543) about the site at Jalan Ampang.\n');
  const P = ['first made-up password', 'second made-up password', 'third made-up password', 'fourth made-up password', 'fifth made-up password'];
  const codes = [];
  const me = `Reviewer Example (${os.userInfo().username})`;
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [local, '--no-sandbox'],
    // Folder choosers, in order: the documents, the matter folder.
    env: { ...process.env, CLOAK_TEST_PICKS: JSON.stringify([docs, matter]), CLOAK_TEST_USER_DATA: userData },
  });
  let canRemember = false;
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Waits until the element says this (a message from an earlier try may still be showing).
    const shows = (sel, re) => page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent || ''), [sel, re.source], { timeout: 30000 });
    const typeTwice = async (a, b = a) => { await page.fill('#s-pw', a); await page.fill('#s-pw2', b); await page.click('#s-change'); };
    const goHome = async () => { await page.click('#bar-home'); await page.click('#yes'); await page.waitForSelector('#go-restore'); };
    // A short window, like a 1366 x 768 laptop: the window hides some of each screen's header at this height.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1180, 640));
    await page.waitForSelector('#full-name');
    await page.fill('#full-name', 'Reviewer Example');
    await page.click('#save-name');
    await page.waitForSelector('#go-cloak');
    canRemember = (await page.evaluate(() => window.cloak.call('info', {}))).ok.canRemember;
    assert.equal(await page.isVisible('#bar-settings'), false, 'no matter is open yet');

    // A new matter, as usual.
    await page.click('#go-cloak');
    await page.click('#pick-folder');
    await page.waitForSelector('#folder-path');
    await page.click('#pick-matter');
    await page.waitForSelector('#m-create');
    await page.fill('#m-name', 'Made-up settings matter');
    await page.fill('#m-pw', P[0]);
    await page.fill('#m-pw2', P[0]);
    await page.click('#m-create');
    await page.waitForSelector('#recovery-code');
    codes.push((await page.textContent('#recovery-code')).trim());
    await page.check('#wrote');
    await page.click('#continue');

    // Matter settings, from the bar beside the matter's name, on the setup screen.
    await page.click('#bar-settings');
    await page.waitForSelector('#matter-settings');
    assert.equal(await page.isVisible('#bar-settings'), false, 'not offered on the settings screen itself');
    assert.equal(await page.textContent('#matter-name'), 'Made-up settings matter');
    assert.match(await page.textContent('label[for="s-pw"]'), /10 characters or more/);
    // Plain messages for each mistake, and nothing changes.
    await typeTwice('a long new password', 'a long new pasword');
    await shows('.msg.bad', /The two passwords do not match/);
    await typeTwice('short');
    await shows('.msg.bad', /at least 10 characters/);
    await typeTwice(P[0]);
    await shows('.msg.bad', /already has/);
    // A lawyer has left: a new password.
    await typeTwice(P[1]);
    await shows('#settings-done', /The password has been changed\. The old password no longer opens this matter\./);
    assert.equal(await page.inputValue('#s-pw'), '', 'the password boxes are emptied');

    // A new recovery code: asked first, then shown once with the Print button.
    await page.click('#s-recovery');
    await page.waitForSelector('.overlay #yes');
    assert.match(await page.textContent('.overlay'), /The old code stops working straight away/);
    await page.click('#yes');
    await page.waitForSelector('#old-code-gone');
    assert.match(await page.textContent('h1'), /Write down the new recovery code/);
    assert.match(await page.textContent('#old-code-gone'), /The old recovery code no longer works/);
    codes.push((await page.textContent('#recovery-code')).trim());
    assert.match(codes[1], /^[0-9A-Z]{4}(-[0-9A-Z]{4}){5}$/);
    assert.notEqual(codes[1], codes[0]);
    assert.equal(await page.locator('#print').count(), 1, 'the same Print button as when the matter was made');
    assert.equal(await page.isDisabled('#continue'), true, 'must confirm the new code was written down');
    await page.check('#wrote');
    await page.click('#continue');
    await shows('#settings-done', /The recovery code has been replaced/);
    await page.click('#s-back');
    await page.waitForSelector('#start');

    // Cloak the folder, then clear the cache from the review screen.
    await page.fill('#client-name', 'Maju Jaya Sdn Bhd');
    await page.check('#test-matter');
    await page.click('#start');
    await page.waitForSelector('.tabs', { timeout: 120000 });
    assert.ok((await readdir(path.join(matter, 'cache'))).length > 0, 'the run filled the cache');
    await page.click('#bar-settings');
    await page.waitForSelector('#matter-settings');
    await page.click('#s-cache');
    await page.waitForSelector('.overlay #yes');
    assert.match(await page.textContent('.overlay'), /every file is read again/);
    await page.click('#yes');
    await shows('#settings-done', /The cache has been cleared/);
    await assert.rejects(stat(path.join(matter, 'cache')), 'the cache folder is gone');
    await page.click('#s-back');
    await page.waitForSelector('.tabs');

    // The old password and the old recovery code no longer open the matter.
    await goHome();
    await page.click('#go-restore');
    await page.waitForSelector('#m-secret');
    await page.fill('#m-secret', P[0]);
    await page.click('#m-open');
    await shows('.msg.bad', /That password is not right/);
    await page.click('#m-switch');
    await page.fill('#m-secret', codes[0]);
    await page.click('#m-open');
    await shows('.msg.bad', /That recovery code is not right/);
    // The password is lost: the new recovery code opens the matter, and Cloak asks for a new password first.
    await page.fill('#m-secret', codes[1]);
    await page.click('#m-open');
    await page.waitForSelector('#recovered-note');
    assert.match(await page.textContent('#recovered-note'), /You opened this matter with the recovery code/);
    assert.equal((await page.textContent('#s-back')).trim(), 'Continue');
    await typeTwice(P[2]);
    await shows('#settings-done', /The password has been changed/);
    assert.equal(await page.locator('#recovered-note').count(), 0);
    await page.click('#s-back');
    await page.waitForSelector('#draft');

    if (canRemember) {
      // "Remember the password on this computer", then a new password: the remembered one is updated.
      await goHome();
      await page.click('#go-restore');
      await page.fill('#m-secret', P[2]);
      await page.check('#m-remember');
      await page.click('#m-open');
      await page.waitForSelector('#draft');
      await page.click('#bar-settings');
      await page.waitForSelector('#matter-settings');
      await typeTwice(P[3]);
      await shows('#settings-done', /The password remembered on this computer has been updated/);
      await page.click('#s-back');
      await page.waitForSelector('#draft');
      await goHome();
      await page.click('#go-restore');
      await page.click('#m-open-remembered');
      await page.waitForSelector('#draft');
      await goHome();
      // Another lawyer changes the password on their own computer. The one remembered here no longer works:
      // Cloak says so, forgets it, and asks for the new one.
      const other = await openMatter({ dir: matter, password: P[3], user: 'Another Lawyer (other)' });
      await other.changePassword(P[4]);
      await other.close();
      await page.click('#go-restore');
      await page.click('#m-open-remembered');
      await shows('.msg.bad', /The password remembered on this computer no longer opens this matter\. Someone may have changed it/);
      assert.equal(await page.locator('#m-open-remembered').count(), 0, 'it is forgotten');
      await page.fill('#m-secret', P[4]);
      await page.click('#m-open');
      await page.waitForSelector('#draft');
    } else {
      console.log('      this computer cannot keep a password (no protected store): the "remember" part was not run');
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
  await new Promise((r) => setTimeout(r, 800)); // the window's helper processes let go of their files

  // The log: who did what, never a password or a recovery code.
  const lines = (await readFile(path.join(matter, 'log.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  const done = (action) => lines.filter((l) => l.action === action).map((l) => l.by);
  assert.deepEqual(done('password-changed'), canRemember ? [me, me, me, 'Another Lawyer (other)'] : [me, me]);
  assert.deepEqual(done('recovery-code-replaced'), [me]);
  assert.deepEqual(done('cache-cleared'), [me]);
  assert.ok(lines.some((l) => l.action === 'opened' && l.with === 'recovery code' && l.by === me));
  // No password or recovery code in plain text, in the matter folder or in Cloak's own folder on this computer.
  // Regular files only (Chromium's one-window lock is a socket and symlinks).
  const walk = async (dir, out = []) => { for (const e of await readdir(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) await walk(f, out); else if (e.isFile()) out.push(f); } return out; };
  const secrets = [...P, ...codes, ...codes.map((c) => c.replace(/-/g, ''))].map((s) => s.toLowerCase());
  for (const f of [...(await walk(matter)), ...(await walk(userData))]) {
    // On Windows a file the window's engine still holds open cannot be read; Cloak's own files are closed at once.
    const data = await readFile(f).catch((err) => (['EBUSY', 'EPERM'].includes(err.code) && !/(?:profile|remembered)\.json$|log\.jsonl$|\.cloakkey/.test(f) ? null : Promise.reject(err)));
    if (!data) continue;
    const raw = data.toString('latin1').toLowerCase();
    for (const s of secrets) assert.ok(!raw.includes(s), `a password or recovery code in ${path.relative(root, f)}`);
  }
});
