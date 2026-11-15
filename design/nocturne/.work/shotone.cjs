const { chromium } = require('playwright');
(async () => { const [file, out, theme, w, h] = process.argv.slice(2); const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: +w || 1000, height: +h || 360 }, colorScheme: theme || 'dark' }); const p = await c.newPage();
p.on('console', (m) => console.log('console:', m.text()));
await p.goto('file://' + file); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200); await p.screenshot({ path: out }); await b.close(); })();
