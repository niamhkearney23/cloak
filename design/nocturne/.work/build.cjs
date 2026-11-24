// Writes the mock pages into the design folder.
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, '..');
const pages = { ...require('./pages-review.cjs') };
for (const f of ['pages-other.cjs']) { try { Object.assign(pages, require('./' + f)); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } }
const only = process.argv.slice(2);
for (const [name, fn] of Object.entries(pages)) {
  if (only.length && !only.includes(name)) continue;
  fs.writeFileSync(path.join(OUT, name + '.html'), fn());
  console.log('wrote', name + '.html');
}
