// Critic: at 860x600 (both themes) find elements outside the viewport on the right, dialogs taller than the window, tall finish bars, scroll-only overflow.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'index.html');
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 860, height: 600 }, colorScheme: scheme }); const p = await ctx.newPage();
    for (const f of pages) {
      await p.goto('file://' + path.join(root, f)); await p.evaluate(() => document.fonts.ready);
      const r = await p.evaluate(() => {
        const out = { right: [], dialog: null, finish: null, docScrollH: document.documentElement.scrollHeight, mainScroll: null, leftover: [] };
        const vw = innerWidth;
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          if (el.classList.contains('vh')) continue;
          let scroller = false; for (let e = el.parentElement; e; e = e.parentElement) { const s = getComputedStyle(e); if (/(auto|scroll|hidden)/.test(s.overflowX) && e !== document.body && e !== document.documentElement) { scroller = true; break; } }
          if (!scroller && r.right > vw + 1) out.right.push(el.tagName + '.' + el.className.toString().slice(0, 30) + ' right=' + Math.round(r.right));
        }
        const d = document.querySelector('.dialog'); if (d) { const r = d.getBoundingClientRect(); out.dialog = { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), sh: d.scrollHeight, ch: d.clientHeight, ov: getComputedStyle(d).overflowY }; }
        const fb = document.querySelector('.finish'); if (fb) { const r = fb.getBoundingClientRect(); out.finish = { h: Math.round(r.height), bottom: Math.round(r.bottom) }; }
        const m = document.querySelector('main'); if (m) out.mainScroll = { sh: m.scrollHeight, ch: m.clientHeight, sw: m.scrollWidth, cw: m.clientWidth };
        return out;
      });
      const issues = [];
      if (r.right.length) issues.push('RIGHT ' + r.right.slice(0, 3).join('; '));
      if (r.dialog && (r.dialog.bottom > 600 || r.dialog.top < 0)) issues.push('DIALOG ' + JSON.stringify(r.dialog));
      if (r.dialog && r.dialog.sh > r.dialog.ch + 1 && !/auto|scroll/.test(r.dialog.ov)) issues.push('DIALOG-CLIPPED ' + JSON.stringify(r.dialog));
      if (r.finish && r.finish.h > 56) issues.push('FINISH h=' + r.finish.h);
      if (r.mainScroll && r.mainScroll.sw > r.mainScroll.cw + 1) issues.push('MAIN-HSCROLL ' + JSON.stringify(r.mainScroll));
      if (issues.length) console.log(scheme, f, issues.join(' | '));
    }
    await ctx.close();
  }
  await b.close(); console.log('done');
})();
