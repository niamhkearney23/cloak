import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMatter } from './matter.js';
import { createMatter, openMatter } from '../matter.js';

// Fixes found in review, checked in the real window. Made-up data only.
// On Linux this needs a display:  xvfb-run -a node --test test/window-fixes.test.js

const require = createRequire(import.meta.url);
const local = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const noDisplay = process.platform === 'linux' && !process.env.DISPLAY;
const FAST = { N: 2 ** 12, r: 8, p: 1 };
const PASSWORD = 'a long test password';

async function launch(root, picks, extraEnv = {}) {
  const { _electron: electron } = require('playwright-core');
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [local, '--no-sandbox'],
    env: { ...process.env, CLOAK_TEST_PICKS: JSON.stringify(picks), CLOAK_TEST_USER_DATA: path.join(root, 'userdata'), ...extraEnv },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('#full-name');
  await page.fill('#full-name', 'Reviewer Example');
  await page.click('#save-name');
  await page.waitForSelector('#go-cloak');
  return { app, page, errors };
}

test('Home does nothing while the restore screen is still reading the documents folder, and the matter still opens afterwards', { skip: noDisplay && 'no display (run under xvfb-run)', timeout: 120000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-win-restore-'));
  const docs = path.join(root, 'documents');
  const dir = path.join(root, 'matter');
  await makeMatter(docs);
  const made = await createMatter({ testMatter: true, dir, password: PASSWORD, user: 'tester', kdf: FAST });
  await made.session.close();
  const { app, page, errors } = await launch(root, [dir, docs]);
  try {
    await page.click('#go-restore');
    await page.click('#pick-matter');
    await page.fill('#m-secret', PASSWORD);
    await page.click('#m-open');
    await page.waitForSelector('#draft');
    await page.click('#pick-docs');
    await page.waitForSelector('#docs-path');
    await page.fill('#draft', 'No tags in this draft.');
    await page.click('#do-restore');
    // While it says Checking, Home and Done wait.
    await page.click('#bar-home');
    await page.click('#restore-back');
    assert.equal(await page.locator('.overlay').count(), 0, 'no "close the matter" question while the folder is being read');
    assert.equal(await page.locator('#go-cloak').count(), 0, 'still on the restore screen');
    await page.waitForSelector('#restore-report', { timeout: 90000 });
    await page.click('#bar-home');
    await page.click('#yes');
    await page.waitForSelector('#go-cloak');
    // The key file was not sealed under a wrong key: the matter opens with its password.
    const again = await openMatter({ dir, password: PASSWORD, user: 'tester' });
    await again.close();
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
  }
});
