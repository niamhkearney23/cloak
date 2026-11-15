const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1180, height: 820 }, colorScheme: 'dark' });
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(300);
  const r = await p.evaluate((sel) => [...document.querySelectorAll(sel)].slice(0, 8).map((e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName}.${e.className} y=${b.y.toFixed(0)} h=${b.height.toFixed(0)} x=${b.x.toFixed(0)} w=${b.width.toFixed(0)} disp=${cs.display} shadow=${cs.boxShadow.slice(0,60)}`; }), process.argv[3]);
  console.log(r.join('\n')); await b.close();
})();
