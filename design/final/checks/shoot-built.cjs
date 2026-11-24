// Drives the real Cloak window (Electron, via playwright-core) through the made-up sample matter and
// saves a screenshot of each main screen and dialog, in light and dark, at 1180x820 and 860x600:
//   design/final/built/<page>-<theme>.png and narrow-<page>-<theme>.png   (same names as design/final/shots)
// It also records horizontal overflow and whether the bundled fonts loaded: built/report.json.
// Only made-up data is used. Nothing is sent anywhere.
//
//   xvfb-run -a -s "-screen 0 1400x1000x24" node design/final/checks/shoot-built.cjs [only-page ...]
const path = require('path');
const fs = require('fs');
const os = require('os');
const local = path.resolve(__dirname, '..', '..', '..', 'local');
const { _electron: electron } = require(path.join(local, 'node_modules', 'playwright-core'));
const electronPath = require(path.join(local, 'node_modules', 'electron'));
const out = path.resolve(__dirname, '..', 'built');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cloak-shots-'));
  const documents = path.join(root, 'Documents');
  fs.mkdirSync(documents, { recursive: true });
  const sample = path.join(documents, 'Cloak sample matter');
  const newMatter = path.join(root, 'new-matter');
  fs.mkdirSync(newMatter);
  const picks = [path.join(sample, 'Cloaked copies'), path.join(sample, 'Matter key'), path.join(sample, 'Documents'), newMatter];
  const app = await electron.launch({
    executablePath: electronPath,
    args: [local, '--no-sandbox'],
    env: { ...process.env, CLOAK_TEST_PICKS: JSON.stringify(picks), CLOAK_TEST_USER_DATA: path.join(root, 'userdata'), CLOAK_TEST_DOCUMENTS: documents },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const report = { shots: [], overflow: [], errors, fonts: null };

  const setTheme = async (t) => { await app.evaluate(({ nativeTheme }, theme) => { nativeTheme.themeSource = theme; }, t); await page.emulateMedia({ colorScheme: t }); };
  const setSize = (w, h) => app.evaluate(({ BrowserWindow }, [a, b]) => { BrowserWindow.getAllWindows()[0].setContentSize(a, b); }, [w, h]);
  async function shoot(name) {
    if (only.length && !only.includes(name)) return;
    for (const theme of ['light', 'dark']) {
      await setTheme(theme);
      for (const [w, h, prefix] of [[1180, 820, ''], [860, 600, 'narrow-']]) {
        await setSize(w, h);
        await page.waitForTimeout(300);
        await page.evaluate(() => document.fonts.ready);
        const m = await page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, mw: document.getElementById('main').scrollWidth, mc: document.getElementById('main').clientWidth }));
        if (m.sw > m.iw + 1 || m.mw > m.mc + 1) report.overflow.push({ name, theme, size: `${m.iw}x${m.ih}`, scrollWidth: m.sw, innerWidth: m.iw, mainScroll: m.mw, mainClient: m.mc });
        await page.screenshot({ path: path.join(out, `${prefix}${name}-${theme}.png`) });
        report.shots.push(`${prefix}${name}-${theme} (${m.iw}x${m.ih})`);
      }
    }
    await setTheme('light');
    await setSize(1180, 820);
    await page.waitForTimeout(150);
  }
  const wait = (sel, timeout = 60000) => page.waitForSelector(sel, { timeout });
  const closeDialog = async (sel = '#no') => { await page.click(sel); await page.waitForSelector('.overlay', { state: 'detached' }); };

  try {
    // First run.
    await wait('#full-name');
    await shoot('name');
    await page.fill('#full-name', 'Siti Aminah binti Yusof');
    await page.click('#save-name');
    await wait('#go-cloak');
    await shoot('home-first-run');
    await page.click('[data-tip-close="home"]');
    await shoot('home');

    // The sample matter.
    await page.click('#go-sample');
    await wait('#sample-pw');
    await shoot('sample');
    await page.fill('#sample-pw', 'a sample password');
    await page.fill('#sample-pw2', 'a sample password');
    await page.click('#sample-create');
    await wait('#recovery-code');
    await shoot('sample-ready');
    await page.click('#sample-continue');
    await wait('#sample-note-setup');
    await shoot('setup-sample');
    await page.click('#start');
    await page.waitForFunction(() => document.querySelectorAll('#progress tr').length >= 4 && document.querySelector('#progress tr.is-active'), null, { timeout: 60000 }).catch(() => {});
    await shoot('progress');
    await wait('.tabs', 180000);

    // Review.
    await shoot('review-unsure-sample');
    await page.click('[data-tab="terms"]');
    await shoot('review-terms');
    // The two questions for a number found by a pattern.
    const pattern = page.locator('[data-remove].danger').first();
    if (await pattern.count()) {
      await pattern.click();
      await wait('.dialog-steps');
      await shoot('dialog-confirm');
      await page.click('#yes');
      await page.waitForFunction(() => /Are you sure/.test(document.querySelector('.overlay h2')?.textContent || ''));
      await shoot('dialog-confirm-id');
      await closeDialog();
    }
    if (await page.locator('[data-tab="facts"]').count()) { await page.click('[data-tab="facts"]'); await shoot('review-facts'); }
    await page.click('[data-tab="joined"]');
    await shoot('review-joined');
    await page.click('[data-tab="files"]');
    await shoot('review-files');
    await page.click('[data-tab="chrono"]');
    await shoot('review-chrono-empty');
    await page.click('#chrono-build');
    await wait('#chrono-table');
    await shoot('review-chrono');
    await page.locator('[data-delete]').first().click();
    await wait('.overlay');
    await shoot('dialog-delete-row');
    await closeDialog();
    await page.locator('[data-edit]').first().click();
    await wait('#fd-no');
    await shoot('dialog-form');
    await closeDialog('#fd-no');

    // Decide the Not sure list the way the tests do, then the joined names.
    await page.click('[data-tab="unsure"]');
    const people = /nurul|huda|rahmat|lee|chee|keong|suresh|ramasamy|faris|abdul|latif|gan|wei|ming|azman|farah|aziz|rajan|ong|tan/i;
    for (let n = await page.locator('[data-fine]').count(), guard = 0; n > 0 && guard < 60; n = await page.locator('[data-fine]').count(), guard++) {
      const word = (await page.locator('#panel .decide-row .word b').first().textContent()).trim();
      const kind = people.test(word) ? 'PERSON' : /kemas|jaya|kjr/i.test(word) ? 'COMPANY' : null;
      await page.locator(kind ? `#panel .decide-row [data-hide][data-kind="${kind}"]` : '#panel .decide-row [data-fine]').first().click();
      await page.waitForFunction(([before, first]) => document.querySelectorAll('[data-fine]').length < before || document.querySelector('#panel .decide-row .word b')?.textContent.trim() !== first, [n, word], { timeout: 15000 });
    }
    await page.click('[data-tab="joined"]');
    for (let n = await page.locator('[data-same], [data-short-ok], [data-group]').count(); n > 0; n = await page.locator('[data-same], [data-short-ok], [data-group]').count()) {
      await page.locator('[data-same], [data-short-ok], [data-group]').first().click();
      await page.waitForFunction((before) => document.querySelectorAll('[data-same], [data-short-ok], [data-group]').length < before, n, { timeout: 15000 });
    }
    await page.click('[data-tab="unsure"]');
    await shoot('review-ready');

    // The file that needs a manual check: the safe choice first, then the read-and-tick form.
    await page.click('[data-tab="files"]');
    await page.locator('[data-check]').first().click();
    await wait('#hide-nl');
    await shoot('dialog-typed');
    await page.click('#hide-nl');
    await wait('#checked');
    await shoot('dialog-viewer');
    await page.check('#checked');
    await page.click('#approve');
    await page.waitForSelector('.overlay', { state: 'detached' });
    await shoot('review-files-checked');
    await page.click('#finish');
    await wait('#run-check');
    await shoot('review-reviewed');
    await page.click('#bar-home');
    await wait('.overlay');
    await shoot('dialog-home');
    await closeDialog();

    // The double check.
    await page.click('#run-check');
    await wait('#check-summary');
    const findings = await page.locator('[data-dc-fine]').count();
    await shoot(findings ? 'doublecheck' : 'doublecheck-passed');
    if (findings) {
      await page.locator('[data-dc-fine]').first().click();
      await wait('.overlay');
      await shoot('dialog-fine');
      await page.click('#yes');
      await page.waitForSelector('.overlay', { state: 'detached' });
      for (let guard = 0; guard < 40; guard++) {
        await page.waitForTimeout(500);
        if (!(await page.locator('[data-dc-fine]').count())) break;
        await page.locator('[data-dc-fine]').first().click();
        await page.click('#yes');
        await page.waitForSelector('.overlay', { state: 'detached' });
      }
      await shoot('doublecheck-passed');
    }
    await page.click('#export');
    await wait('#exported');
    await shoot('review-exported');

    // Restore a draft.
    await page.click('#bar-home');
    await wait('.overlay');
    await page.click('#yes');
    await wait('#go-restore');
    await page.click('#go-restore');
    await wait('#pick-matter');
    await shoot('restore-start');
    await page.click('#pick-matter');
    await wait('#m-secret');
    await shoot('setup-existing-password');
    await page.fill('#m-secret', 'a sample password');
    await page.click('#m-open');
    await wait('#draft');
    await shoot('restore-empty');
    const cloaked = fs.readdirSync(picks[0]).filter((n) => n.endsWith('.cloaked.txt') && !/context|chronology/.test(n)).sort();
    const tagsOf = (n) => [...new Set(fs.readFileSync(path.join(picks[0], n), 'utf8').match(/\{\{[A-Z]+_\d+\}\}/g) || [])];
    const tags = cloaked.flatMap(tagsOf).filter((t, i, a) => a.indexOf(t) === i);
    const pick = (re) => tags.find((t) => re.test(t)) || tags[0];
    const p1 = pick(/PERSON/), c1 = pick(/COMPANY/), d1 = pick(/DATE/), a1 = pick(/AMOUNT/);
    const draft = (extra) => [`1. Our client, ${c1}, instructs us to demand payment from ${p1}.`, `2. By an agreement dated ${d1}, the sum of ${a1} was agreed.`, `3. Please call ${p1} before the end of the week.`, ...extra].join('\n');
    await page.fill('#draft', draft(['4. [FOR THE LAWYER: grounds to follow]']));
    await page.click('#do-restore');
    await wait('#restore-report');
    await shoot('restore-result');
    await page.click('#change-draft');
    await wait('#draft');
    await page.fill('#draft', draft(['4. {{PERSON_999}} appeared at the site.', '5. The total of 3 parts RM 100.00 + RM 200.00 + RM 300.00 is RM 700.00.']));
    await page.click('#do-restore');
    await wait('#restore-report');
    await shoot('restore-failed');
    await page.click('#change-draft');
    await wait('#draft');
    await page.fill('#draft', '1. {{PERSON_901}} and {{COMPANY_902}} agreed on {{DATE_903}}.\n2. The amount was {{AMOUNT_904}}.');
    await page.click('#do-restore');
    await wait('#restore-report');
    await shoot('restore-key-mismatch');
    await page.click('#restore-back');
    await wait('.overlay');
    await shoot('dialog-finish-draft');
    await page.click('#yes');
    await wait('#go-cloak');

    // Help, licence.
    await page.click('#bar-help');
    await wait('.help-overlay');
    await shoot('help-how');
    await page.click('.help-overlay [data-help="data"]');
    await page.waitForFunction(() => /Nothing leaves this computer/.test(document.getElementById('help-body')?.textContent || ''));
    await shoot('help-data');
    await page.click('.help-overlay [data-help="about"]');
    await wait('#save-support');
    await shoot('help-about');
    await page.click('#help-close');
    await page.click('#go-licence');
    await wait('#licence-status');
    await shoot('licence-eval');
    await page.click('#licence-back');
    await wait('#go-cloak');

    // A new matter: setup, then the recovery code.
    await page.click('#go-cloak');
    await wait('#pick-folder');
    await shoot('setup-empty');
    await page.click('#pick-folder');
    await wait('#folder-path');
    await page.click('#pick-matter');
    await wait('#m-create');
    await page.fill('#m-name', 'Kemas Jaya renovation dispute');
    await page.fill('#m-pw', 'correct horse battery');
    await page.fill('#m-pw2', 'correct horse batter');
    await page.click('#m-create');
    await wait('.msg.bad');
    await shoot('setup-error');
    await page.fill('#m-pw', 'correct horse battery');
    await page.fill('#m-pw2', 'correct horse battery');
    await shoot('setup-new');
    await page.click('#m-create');
    await wait('#recovery-code');
    await shoot('recovery');
    await page.check('#wrote');
    await page.click('#continue');
    await wait('#start');
    await shoot('setup-existing');
    // A second run, on a real (not sample) matter, to see the first-run tip on the review screen.
    await page.click('#start');
    await wait('.tabs', 180000);
    await shoot('review-tip');

    report.fonts = await page.evaluate(async () => { await document.fonts.ready; return { loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style} ${f.weight}`), notLoaded: [...document.fonts].filter((f) => f.status !== 'loaded').map((f) => `${f.family} ${f.style} ${f.weight} (${f.status})`), checks: ['15px "Cloak Sans"', '15px "Cloak Serif"', '15px "Cloak Mono"'].map((f) => `${f}: ${document.fonts.check(f)}`) }; });
  } catch (err) {
    report.failed = String(err.stack || err);
    await page.screenshot({ path: path.join(out, 'FAILED.png') }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await app.close().catch(() => {});
  }
  console.log(JSON.stringify({ shots: report.shots.length, overflow: report.overflow, errors, fonts: report.fonts, failed: report.failed }, null, 2));
})();
