import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Matter, partiesInFolderName } from '../engine.js';
import { cloakFolder } from '../run.js';

test('a folder name written "X v Y" names both parties; other folder names name no one', () => {
  assert.deepEqual(partiesInFolderName('Test matter - Seri Kembara v Bintang Timur'), ['Seri Kembara', 'Bintang Timur']);
  assert.deepEqual(partiesInFolderName('Ahmad bin Ismail vs Maju Jaya Sdn Bhd & Anor (2024)'), ['Ahmad bin Ismail', 'Maju Jaya Sdn Bhd']);
  assert.deepEqual(partiesInFolderName('Pelita lwn Rakan Niaga - Pleadings'), ['Pelita', 'Rakan Niaga']);
  assert.deepEqual(partiesInFolderName('Client docs - Aisyah'), []);
  assert.deepEqual(partiesInFolderName('Correspondence'), []);
  assert.deepEqual(partiesInFolderName('the v the'), []);
});

test('the client named only in the folder name is hidden everywhere, file names included', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-parties-'));
  const dir = path.join(root, 'Matter - Seri Kembara v Bintang Timur');
  await mkdir(path.join(dir, 'Pleadings'), { recursive: true });
  await writeFile(path.join(dir, '01 Claim.txt'), 'Seri Kembara supplied cold storage. Kembara was paid late. The defendant, Bintang Timur, disputes it.');
  await writeFile(path.join(dir, 'Pleadings', '02 Reply.txt'), 'Our client is Seri Kembara.');
  const matter = new Matter({ options: { level: 'strict' } });
  const run = await cloakFolder({ folder: dir, outDir: path.join(root, 'out'), options: {}, user: 't', matter, write: false });
  for (const f of run.files) {
    assert.ok(!/Kembara|Seri Kembara|Bintang|Timur/.test(`${f.name}\n${f.cloaked}`), `${f.rel}: ${f.name}\n${f.cloaked}`);
  }
  assert.equal(matter.kinds.get(matter.cloak.entries.find((e) => e.value === 'Seri Kembara').token.split('.')[0]), 'named in the folder name');
});
