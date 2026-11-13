// Makes the Strict export (with context sheet and confirmed chronology) of the made-up matter.
// Run: node test/strict-demo.js <folder>
import { mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeMatter } from './matter.js';
import { finishReview } from './helpers.js';
import { createMatter } from '../matter.js';

const outRoot = path.resolve(process.argv[2]);
await mkdir(outRoot, { recursive: true });
const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-strict-'));
const docs = path.join(root, 'documents');
await makeMatter(docs);
await cp(docs, path.join(outRoot, 'REAL-files'), { recursive: true });
const { session } = await createMatter({ testMatter: true, dir: path.join(root, 'matter'), password: 'a long test password', name: 'Made-up matter', user: 'demo', kdf: { N: 2 ** 12, r: 8, p: 1 } });
await session.cloakFolder({ folder: docs });
await finishReview(session);
await session.buildChronology();
await finishReview(session);
await session.chronologyAction({ type: 'confirm' });
const all = await session.export({ outDir: path.join(outRoot, 'strict-export') });
const only = await session.export({ outDir: path.join(outRoot, 'chronology-only-export'), only: 'chronology' });
console.log('all:', all.written.join(', '));
console.log('chronology only:', only.written.join(', '));
await writeFile(path.join(outRoot, 'key.json'), JSON.stringify(session.matter.state(), null, 1));
await session.close();
process.exit(0);
