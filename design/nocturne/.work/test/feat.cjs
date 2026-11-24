const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(500);
const r = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('span')].map(s => [s.id, s.getBoundingClientRect().width.toFixed(2)])));
console.log(r); await b.close(); })();
