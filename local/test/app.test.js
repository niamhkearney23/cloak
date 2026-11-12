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
  await makeMatter(docs);
  await mkdir(matter);
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [local, '--no-sandbox'],
    env: { ...process.env, CLOAK_TEST_PICKS: JSON.stringify([docs, matter, out]), CLOAK_TEST_USER_DATA: path.join(root, 'userdata') },
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
    await page.waitForSelector('#export');
    await page.click('#export');
    await page.waitForSelector('#exported');
    assert.match(await page.textContent('#exported'), /19 cloaked copies written/);
    assert.match(await page.textContent('#exported'), /2 files were held back/);

    // What was exported holds no real value.
    const names = await readdir(out);
    assert.equal(names.filter((n) => n.endsWith('.cloaked.txt')).length, 19);
    for (const n of names) {
      const text = await readFile(path.join(out, n), 'utf8');
      for (const v of REAL_VALUES) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, 'iu').test(text), `${v} in ${n}`);
      for (const v of REAL_EXACT) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text), `${v} in ${n}`);
      assert.ok(!/Gombak/.test(text));
    }
    assert.match(JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8')).review, /^Reviewed by /);
    assert.deepEqual(errors, []);
    assert.ok(await stat(path.join(matter, 'matter.lock')), 'the matter is locked while the window is open');
  } finally {
    await app.close();
  }
  // Closing the window closes the matter for the next person.
  await new Promise((r) => setTimeout(r, 800));
  await assert.rejects(stat(path.join(matter, 'matter.lock')));
});
