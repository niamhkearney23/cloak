const { chromium } = require('/opt/node-tools/node_modules/playwright'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 860, height: 600 } });
 await p.goto('file://' + path.resolve(__dirname, '../review-unsure.html'));
 console.log(await p.evaluate(() => [...document.querySelectorAll('button.link')].filter(e => e.getBoundingClientRect().right > innerWidth).map(e => e.outerHTML.slice(0, 160) + ' parent:' + e.parentElement.className + ' ' + Math.round(e.getBoundingClientRect().left) + '-' + Math.round(e.getBoundingClientRect().right))));
 await p.goto('file://' + path.resolve(__dirname, '../dialog-fine.html'));
 console.log(await p.evaluate(() => { const m = document.querySelector('main'); const w = []; m.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.right > 880) w.push(e.tagName + '.' + e.className + ' ' + Math.round(r.right)); }); return [getComputedStyle(m).overflowX, m.inert, w.slice(0, 5)]; }));
 await b.close(); })();
