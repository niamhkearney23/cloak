const { chromium } = require('/opt/node-tools/node_modules/playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const bad = [];
 p.on('requestfailed', r => bad.push(r.url()));
 for (const f of ['home.html','review-unsure.html','review-chrono.html','restore-result.html']) { await p.goto('file://' + path.resolve(__dirname, '..', f)); await p.evaluate(() => document.fonts.ready);
  console.log(f, await p.evaluate(() => [...document.fonts].map(x => x.family + ' ' + x.style + ' ' + x.weight + ' ' + x.status).filter(s => /loaded/.test(s)).join('; ')));}
 console.log('failed requests', bad); await b.close(); })();
