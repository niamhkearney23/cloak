// Accessibility audit (axe-core) of every mock screen in both themes. Work tool, not shipped.
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const DIR = '/home/user/cloak/design/nocturne';
const AXE = fs.readFileSync(path.join(DIR, '.work/pkgs/_axe/x/package/axe.min.js'), 'utf8');
const screens = (process.argv[2] || 'home,setup,progress,recovery,review,doublecheck,chronology,restore,dialog,viewer').split(',');
(async () => {
  const b = await chromium.launch();
  let total = 0;
  for (const s of screens) for (const theme of ['light', 'dark']) for (const [w, h] of [[1180, 820], [860, 600]]) {
    const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: theme, bypassCSP: true });
    const p = await c.newPage();
    await p.goto('file://' + path.join(DIR, s + '.html'));
    await p.evaluate(() => document.fonts.ready);
    await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ["incomplete"] });
      return res.incomplete.filter((v) => v.id === "color-contrast").map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => `${n.target.join(' ')} :: ${(n.any[0]?.message || n.failureSummary || '').slice(0, 140)}`) , count: v.nodes.length }));
    });
    for (const v of r) { total += v.count; console.log(`\n[${s} ${theme} ${w}x${h}] ${v.id} (${v.impact}) x${v.count}: ${v.help}\n  ` + v.nodes.join('\n  ')); }
    await c.close();
  }
  await b.close();
  console.log(`\nTotal violating nodes: ${total}`);
})();
