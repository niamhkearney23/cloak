// Measures how long a realistic matter takes. Run:  node test/speed.js
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeBigMatter } from './bigmatter.js';
import { createMatter, openMatter } from '../matter.js';
import { VERSION } from '../version.js';

const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-speed-'));
const docs = path.join(root, 'documents');
console.log(`Cloak ${VERSION}  |  ${os.cpus().length} cores (${os.cpus()[0].model.trim()})  |  ${Math.round(os.totalmem() / 1e9)} GB memory`);
const made = await makeBigMatter(docs);
for (const f of ['Bundle of documents (scanned).pdf', 'Sale and purchase agreement.pdf', 'Client ledger.xlsx']) console.log(`  ${f}: ${((await stat(path.join(docs, f))).size / 1e6).toFixed(1)} MB`);
console.log(`  (making the files took ${made.seconds.toFixed(0)} s and is not counted)\n`);

const { session } = await createMatter({ dir: path.join(root, 'matter'), password: 'speed test password', name: 'Speed test' });
const show = (label, run) => {
  const t = run.timing;
  console.log(`${label}: ${run.seconds.toFixed(1)} s   (reading + OCR ${t.reading_and_ocr.toFixed(1)} | finding names ${t.finding_names.toFixed(1)} | merging variants ${t.merging_variants.toFixed(1)} | cloaking + checking ${t.cloaking_and_checking.toFixed(1)})`);
  for (const f of run.files.filter((x) => !x.inside)) console.log(`    ${f.rel}: read in ${((f.readMs || 0) / 1000).toFixed(1)} s, ${f.proof.found} ${f.proof.unit}, ${f.proof.ocr.length} through OCR, ${f.proof.characters.toLocaleString()} characters, ${f.status}`);
  console.log(`    tags in the key: ${run.matter.key().entries.length.toLocaleString()}  |  memory in use: ${Math.round(process.memoryUsage().rss / 1e6)} MB`);
};
const first = await session.cloakFolder({ folder: docs });
show('First run (nothing cached)', first);
const t1 = Date.now();
const data = session.reviewData();
console.log(`    building the review screen's lists: ${((Date.now() - t1) / 1000).toFixed(1)} s (${data.terms.length.toLocaleString()} terms, ${data.unsure.length} not sure, ${data.merges.length} joined)`);
const second = await session.cloakFolder({ folder: docs });
show('Second run (unchanged files come from the cache)', second);
await session.close();
const t2 = Date.now();
const again = await openMatter({ dir: path.join(root, 'matter'), password: 'speed test password' });
console.log(`\nReopening the matter later: ${((Date.now() - t2) / 1000).toFixed(1)} s`);
await again.close();
