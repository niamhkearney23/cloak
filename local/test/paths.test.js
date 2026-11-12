import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createMatter } from '../matter.js';
import { finishReview } from './helpers.js';

// Names in file names and folder names are cloaked: in the exported copies'
// names, in the "File:" line at the top of each cloaked text, and in the report.

const FAST = { N: 2 ** 12, r: 8, p: 1 };
const NAMES = ['Haziq', 'Sulong', 'Zaleha', 'Musa', 'Kamal', 'Zainal', 'Maju Jaya', 'Nurul'];

test('names inside file names and folder names are cloaked in every exported copy', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-paths-'));
  const docs = path.join(root, 'documents');
  const put = async (rel, body) => { await mkdir(path.dirname(path.join(docs, rel)), { recursive: true }); await writeFile(path.join(docs, rel), body); };
  // The bodies hold no names at all: the names are only in the file and folder names.
  await put('Client Haziq bin Sulong/Statement of Zaleha binti Musa.txt', 'This statement is made in support of the application.\n');
  await put('Client Haziq bin Sulong/Annexes/Letter to Kamal bin Zainal.txt', 'Please find enclosed the documents requested.\n');
  await put('Maju Jaya Sdn Bhd - Dispute/Meeting notes.txt', 'Notes of the meeting. Nothing else was said.\n');
  await put('Affidavit_Nurul_Huda_binti_Zainal.txt', 'Sworn in the usual form.\n');

  const { session } = await createMatter({ dir: path.join(root, 'matter'), password: 'a long enough password', kdf: FAST });
  await session.cloakFolder({ folder: docs });
  await finishReview(session);
  const out = path.join(root, 'cloaked');
  await session.export({ outDir: out });
  await session.close();

  const names = (await readdir(out)).sort();
  const copies = names.filter((n) => n.endsWith('.cloaked.txt'));
  assert.equal(copies.length, 4);
  // The exported file names are numbers: nothing of the original names.
  for (const n of copies) assert.match(n, /^\d{3}-txt\.cloaked\.txt$/);

  const listing = [];
  for (const n of names) {
    const text = await readFile(path.join(out, n), 'utf8');
    for (const name of NAMES) assert.ok(!text.toLowerCase().includes(name.toLowerCase()), `${name} is in ${n}`);
    if (n.endsWith('.cloaked.txt')) {
      const first = text.split('\n')[0];
      // The "File:" line shows the (cloaked) name of the original, with tags in place of the names.
      assert.match(first, /^File: .*\{\{[A-Z_]+\d+(?:\.[A-Z0-9]+)?\}\}.*\.txt$/, `File line of ${n}: ${first}`);
      listing.push(`${n}   ${first}`);
    }
  }
  assert.equal(listing.length, 4);
  // The first line is restorable: with the key it reads as the original name.
  const first = (await readFile(path.join(out, copies[0]), 'utf8')).split('\n')[0].replace(/^File: /, '').replace(/\.txt$/, '');
  assert.match(session.matter.cloak.uncloak(first).text, /Client Haziq bin Sulong|Affidavit Nurul|Maju Jaya|Annexes/);
  const report = JSON.parse(await readFile(path.join(out, 'cloak-report.json'), 'utf8'));
  for (const f of report.files) assert.doesNotMatch(f.name, /Haziq|Sulong|Zaleha|Musa|Kamal|Zainal|Maju|Nurul/);
});
