const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
const msgs = []; p.on('console', (m) => msgs.push(m.text()));
await p.goto('file:///home/user/cloak/design/nocturne/review.html'); await p.evaluate(() => document.fonts.ready);
const r = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.style} ${f.weight}`));
const csp = await p.evaluate(() => document.querySelector('meta[http-equiv]').content);
console.log('loaded:', [...new Set(r)].join(' | ')); console.log('CSP:', csp); console.log('console:', msgs.length ? msgs : 'none'); await b.close(); })();
