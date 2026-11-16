// Renders every screen at 860x600, both themes. Reports: horizontal overflow, clipped/overflowing elements,
// text contrast per element (computed), tiny text, CSP violations, console errors, fonts loaded.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path');
const dir = path.resolve(__dirname, '..');
const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
const W = +process.env.W || 860, H = +process.env.H || 600;
const parseC = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: W, height: H }, colorScheme: theme });
    for (const p of pages) {
      const page = await ctx.newPage();
      const msgs = [];
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) msgs.push(m.text()); });
      page.on('pageerror', (e) => msgs.push('pageerror ' + e.message));
      page.on('requestfailed', (r) => msgs.push('reqfail ' + r.url()));
      await page.goto('file://' + path.join(dir, p));
      await page.evaluate(() => document.fonts.ready);
      const res = await page.evaluate(() => {
        const R = { overflowX: document.documentElement.scrollWidth - innerWidth, bodyScrollW: document.body.scrollWidth - innerWidth, clipped: [], small: [], contrast: [], mainScroll: null, finishVisible: null, rowsAbove: null };
        const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const q = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: q[0], g: q[1], b: q[2], a: q[3] ?? 1 }; };
        const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255 }; if (!stack.length || stack[stack.length - 1].a < 1) base = parse(getComputedStyle(document.body).backgroundColor) || base; for (let i = stack.length - 1; i >= 0; i--) { const c = stack[i]; base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) }; } return base; };
        const lum = (c) => { const f = [c.r, c.g, c.b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
        const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const sel = (el) => { let s = el.tagName.toLowerCase(); if (el.id) s += '#' + el.id; if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        while (walker.nextNode()) {
          const n = walker.currentNode; const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || seen.has(el)) continue;
          const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue; if (el.closest('.sprite,.sr-only,[hidden]')) continue;
          const rect = el.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
          seen.add(el);
          const fs = parseFloat(cs.fontSize); const fg = parse(cs.color); const bg = bgOf(el);
          if (fs < 12) R.small.push(sel(el) + ' ' + fs + 'px "' + t.slice(0, 30) + '"');
          let fgc = fg; if (fg.a < 1) fgc = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
          const ratio = cr(fgc, bg); const bold = parseInt(cs.fontWeight) >= 700; const large = fs >= 24 || (fs >= 18.66 && bold);
          const dis = el.closest(':disabled,[disabled],[aria-disabled=true]');
          if (ratio < (large ? 3 : 4.5)) R.contrast.push({ el: sel(el), text: t.slice(0, 40), ratio: +ratio.toFixed(2), fs, disabled: !!dis });
        }
        // clipped text: element with overflow hidden/clip whose scrollWidth > clientWidth, or any element whose right edge is past the viewport
        document.querySelectorAll('body *').forEach((el) => { const cs = getComputedStyle(el); if (cs.display === 'none') return; const r = el.getBoundingClientRect(); if (!r.width) return;
          if (el.matches('.vh, main') ) return; if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.textContent.trim()) R.clipped.push('clip-x ' + sel(el) + ' ' + el.scrollWidth + '>' + el.clientWidth + ' "' + el.textContent.trim().slice(0, 30) + '"');
          if (r.right > innerWidth + 1 && !el.closest('.sprite') && cs.position !== 'fixed') R.clipped.push('past-right ' + sel(el) + ' right=' + Math.round(r.right));
          if (r.left < -1 && !el.closest('.sprite,.skip')) R.clipped.push('past-left ' + sel(el) + ' left=' + Math.round(r.left));
        });
        // finish bar
        const f = document.querySelector('.finish'); if (f) { const r = f.getBoundingClientRect(); R.finishVisible = { top: Math.round(r.top), h: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight }; }
        const rows = [...document.querySelectorAll('.decide-row, #panel tbody tr, .dc-files li, .finding')]; if (f && rows.length) { const ft = f.getBoundingClientRect().top; R.rowsAbove = rows.filter((x) => { const r = x.getBoundingClientRect(); return r.bottom <= ft && r.top >= 0; }).length; }
        const m = document.querySelector('main'); if (m) R.mainScroll = m.scrollHeight - m.clientHeight;
        const dlg = document.querySelector('.dialog'); if (dlg) { const r = dlg.getBoundingClientRect(); R.dialog = { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, fits: r.bottom <= innerHeight && r.top >= 0, scrollable: getComputedStyle(dlg).overflowY }; }
        return R;
      });
      res.msgs = msgs;
      (out[p] ||= {})[theme] = res;
      await page.close();
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(__dirname, `audit-${W}x${H}.json`), JSON.stringify(out, null, 1));
  for (const [p, t] of Object.entries(out)) for (const [th, r] of Object.entries(t)) {
    const issues = [];
    if (r.overflowX > 0) issues.push('page-x-overflow ' + r.overflowX);
    if (r.clipped.length) issues.push('clipped: ' + [...new Set(r.clipped)].slice(0, 6).join(' | '));
    if (r.small.length) issues.push('small: ' + r.small.slice(0, 3).join(' | '));
    const c = r.contrast.filter((x) => !x.disabled); if (c.length) issues.push('contrast: ' + c.slice(0, 8).map((x) => `${x.el} "${x.text}" ${x.ratio}`).join(' | '));
    if (r.msgs.length) issues.push('console: ' + r.msgs.slice(0, 3).join(' | '));
    if (r.dialog && !r.dialog.fits) issues.push('dialog does not fit ' + JSON.stringify(r.dialog));
    if (r.finishVisible && (r.finishVisible.bottom > r.finishVisible.vh + 1)) issues.push('finish bar off-screen ' + JSON.stringify(r.finishVisible));
    if (issues.length) console.log(`[${th}] ${p}\n   ` + issues.join('\n   '));
  }
})();
