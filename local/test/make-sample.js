// Writes the sample matter into app/sample/ so the installer carries it.
// Run once after changing test/sample-matter.js, then commit app/sample/:
//
//   node test/make-sample.js

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSample } from './sample-matter.js';

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'sample');
await rm(target, { recursive: true, force: true });
const files = await writeSample(target);
console.log(`Wrote ${files.length} made-up documents to ${target}`);
