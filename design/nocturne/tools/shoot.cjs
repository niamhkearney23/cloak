// Screenshots of the Nocturne mock screens, light and dark, with Playwright.
//   node tools/shoot.cjs                 every screen
//   node tools/shoot.cjs review restore  only these
// Shots go to shots/. The page's own Content-Security-Policy stays on, and any
// console message (a CSP refusal, a missing font) is printed so it can be fixed.
// On Linux, set FONTCONFIG_FILE to a config that adds Noto Sans SC / Tamil /
// Arabic, standing in for Microsoft YaHei, Nirmala UI and Segoe UI on Windows.
const path = require('path');
const { chromium } = require('playwright');

const DIR = path.resolve(__dirname, '..');
const SCREENS = ['home', 'setup', 'progress', 'recovery', 'review', 'doublecheck', 'chronology', 'restore', 'dialog', 'viewer'];
const NARROW = [['review', 'light'], ['restore', 'dark']];
const want = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  const shot = async (screen, theme, width, height, suffix, full) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('console', (m) => problems.push(`${screen}/${theme}: console ${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`${screen}/${theme}: error: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`${screen}/${theme}: failed: ${r.url()}`));
    const file = path.join(DIR, screen + '.html');
    await page.goto('file://' + file);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const out = path.join(DIR, 'shots', `${screen}${suffix}-${theme}.png`);
    await page.screenshot({ path: out });
    let wrote = [out];
    if (full) {
      const extra = await page.evaluate(() => { const m = document.querySelector('main'); return m ? m.scrollHeight - m.clientHeight : 0; });
      if (extra > 4) {
        await page.setViewportSize({ width, height: height + extra });
        await page.waitForTimeout(100);
        const fullOut = path.join(DIR, 'shots', `${screen}-${theme}-full.png`);
        await page.screenshot({ path: fullOut });
        wrote.push(fullOut);
      }
    }
    // Overflow check: anything wider than the window.
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 0) problems.push(`${screen}/${theme} ${width}x${height}: page is ${wide}px wider than the window`);
    await context.close();
    console.log('shot', wrote.map((w) => path.basename(w)).join(', '));
  };
  const fs = require('fs');
  for (const s of SCREENS) {
    if (want.length && !want.includes(s)) continue;
    if (!fs.existsSync(path.join(DIR, s + '.html'))) continue;
    for (const theme of ['light', 'dark']) await shot(s, theme, 1180, 820, '', true);
  }
  for (const [s, theme] of NARROW) {
    if (want.length && !want.includes(s)) continue;
    await shot(s, theme, 860, 600, '-narrow', false);
  }
  await browser.close();
  if (problems.length) { console.log('\nPROBLEMS:\n' + problems.join('\n')); process.exitCode = 1; }
})();
