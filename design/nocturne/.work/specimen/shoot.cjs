const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const m of (process.argv[2]||'dark,light').split(',')) {
    const c = await b.newContext({ viewport: { width: 1500, height: 1000 }, colorScheme: m });
    const p = await c.newPage();
    await p.goto('file:///home/user/cloak/design/nocturne/.work/specimen/' + m + (process.argv[3]||'') + '.html');
    await p.waitForTimeout(400);
    await p.screenshot({ path: '/home/user/cloak/design/nocturne/.work/specimen/' + m + (process.argv[3]||'') + '.png', fullPage: true });
  }
  await b.close();
})();
