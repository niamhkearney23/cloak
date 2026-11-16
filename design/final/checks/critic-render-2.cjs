// Critic sweep: rendered text contrast, overflow, clipping, CSP-ish violations, at 860x600 and 1180x820, both schemes.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html') && f !== 'index.html');
function inPage() {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const k = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e); let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) bg = over(c, bg); } return bg; };
  const out = { low: [], clipped: [], hoverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, tiny: [] };
  const seen = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const t = w.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    let fg = parse(cs.color); const bg = bgOf(el); fg = over(fg, bg);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const large = size >= 24 || (size >= 18.66 && bold);
    const ratio = cr(fg, bg); const min = large ? 3 : 4.5;
    const op = parseFloat(cs.opacity);
    if (ratio < min) out.low.push({ t: t.textContent.trim().slice(0, 40), cls: el.className.toString().slice(0, 40), tag: el.tagName, ratio: +ratio.toFixed(2), size });
    if (size < 12) out.tiny.push({ t: t.textContent.trim().slice(0, 30), size });
    // clipping
    for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e);
      if ((s.overflowX !== 'visible' || s.overflowY !== 'visible') && e !== document.documentElement) {
        const er = e.getBoundingClientRect(); const tr = r;
        if (e.scrollWidth > e.clientWidth + 1 && s.overflowX !== 'auto' && s.overflowX !== 'scroll') out.clipped.push({ t: t.textContent.trim().slice(0, 30), cls: e.className.toString().slice(0, 30), sw: e.scrollWidth, cw: e.clientWidth });
        break; } }
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.clipped.push({ t: t.textContent.trim().slice(0, 30), ellipsis: true });
  }
  return out;
}
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [vw, vh] of [[860, 600], [1180, 820]]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme }); const p = await ctx.newPage();
    const csp = []; p.on('console', m => { if (/Content Security|Refused/i.test(m.text())) csp.push(m.text().slice(0, 120)); });
    const failed = []; p.on('requestfailed', r => failed.push(r.url()));
    for (const f of pages) { await p.goto('file://' + path.join(root, f)); await p.evaluate(() => document.fonts.ready);
      const r = await p.evaluate(inPage); r.failed = failed.splice(0);
      if (r.low.length || r.clipped.length || r.hoverflow > 0 || r.tiny.length || r.failed.length) (res[`${vw}-${scheme}`] ||= {})[f] = r; }
    await ctx.close();
  }
  fs.writeFileSync(path.join(__dirname, 'critic-render-2.json'), JSON.stringify(res, null, 1));
  for (const k in res) { console.log('==', k, Object.keys(res[k]).length, 'pages with issues');
    for (const f in res[k]) { const r = res[k][f]; console.log(f, 'low', r.low.length, 'clip', r.clipped.length, 'hov', r.hoverflow, 'tiny', r.tiny.length, 'failed', r.failed.length);
      r.low.slice(0, 3).forEach(x => console.log('   LOW', JSON.stringify(x))); r.clipped.slice(0, 3).forEach(x => console.log('   CLIP', JSON.stringify(x))); } }
  await b.close();
})();
