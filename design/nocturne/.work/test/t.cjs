const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 700, height: 220 } });
await p.goto('file://' + process.argv[2]); await p.waitForTimeout(300); await p.screenshot({ path: process.argv[3] }); await b.close(); })();
