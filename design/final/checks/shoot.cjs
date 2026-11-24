// Renders every screen: shots/<page>-<theme>.png (1180x820), shots/narrow-<page>-<theme>.png (860x600),
// and shots-2x/<page>-<theme>.png (2360x1640) for the key screens listed in KEY2X.
// Run from anywhere: node design/final/checks/shoot.cjs   (the file is .cjs because package.json sets type module)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..');
const shots = path.join(dir, 'shots'), shots2 = path.join(dir, 'shots-2x');
fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(shots2, { recursive: true });
const KEY2X = ['home', 'review-unsure', 'review-chrono', 'doublecheck', 'restore-result', 'restore-failed', 'licence-expired', 'help-support', 'setup-stubs', 'review-files-blocked', 'dialog-viewer-scripts'];
const pages = fs.readdirSync(dir).filter((x) => x.endsWith('.html') && x !== 'index.html').map((x) => x.replace('.html', ''));
const only = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    const jobs = [['', 1180, 820, 1, shots], ['narrow-', 860, 600, 1, shots]];
    for (const [prefix, w, h, dsf, out] of jobs) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, deviceScaleFactor: dsf });
      for (const f of pages) { if (only.length && !only.includes(f)) continue;
        const p = await ctx.newPage(); await p.goto('file://' + path.join(dir, f + '.html')); await p.evaluate(() => document.fonts.ready);
        await p.screenshot({ path: path.join(out, prefix + f + '-' + theme + '.png') }); await p.close(); }
      await ctx.close();
    }
    const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, colorScheme: theme, deviceScaleFactor: 2 });
    for (const f of KEY2X) { if (only.length && !only.includes(f)) continue;
      const p = await ctx.newPage(); await p.goto('file://' + path.join(dir, f + '.html')); await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(shots2, f + '-' + theme + '.png') }); await p.close(); }
    await ctx.close();
  }
  await b.close();
})();
