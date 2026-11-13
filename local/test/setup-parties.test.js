import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Matter } from '../engine.js';
import { cloakFolder } from '../run.js';
import { createMatter } from '../matter.js';
import { removeTerm } from '../review.js';

const FAST = { N: 2 ** 12, r: 8, p: 1 };

async function folder() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-setup-'));
  const dir = path.join(root, 'Matter - Seri Kembara v Bintang Timur');
  await mkdir(path.join(dir, 'Pleadings'), { recursive: true });
  await writeFile(path.join(dir, '01 Claim.txt'), 'Seri Kembara Logistics Sdn Bhd supplied cold storage. Kembara was paid late. Seri Kembara wrote twice. The defendant, Bintang Timur Cold Chain (M) Sdn Bhd, disputes it.');
  await writeFile(path.join(dir, 'Pleadings', '02 Reply.txt'), 'Our client is Seri Kembara.');
  return { root, dir };
}

test('nothing is guessed from the folder name: with no setup, "Seri Kembara" alone is not hidden', async () => {
  const { root, dir } = await folder();
  const run = await cloakFolder({ folder: dir, outDir: path.join(root, 'o'), options: {}, user: 't', matter: new Matter({ options: { level: 'strict' } }), write: false });
  assert.ok(run.files.some((f) => /Kembara/.test(`${f.name}\n${f.cloaked}`)));
});

test('the client and other parties typed at setup are hidden in every form, file and folder names included', async () => {
  const { root, dir } = await folder();
  const matter = new Matter({ options: { level: 'strict' } });
  matter.setup = { client: 'Seri Kembara Logistics Sdn Bhd; Seri Kembara; Kembara', others: 'Bintang Timur Cold Chain (M) Sdn Bhd\nperson: Hafiz bin Rahman' };
  const run = await cloakFolder({ folder: dir, outDir: path.join(root, 'o'), options: {}, user: 't', matter, write: false });
  for (const f of run.files) assert.ok(!/Kembara|Bintang|Timur|Hafiz/.test(`${f.name}\n${f.cloaked}`), `${f.rel}\n${f.name}\n${f.cloaked}`);
  const kinds = [...matter.kinds.values()];
  assert.ok(kinds.includes('the client (typed at setup)') && kinds.includes('another party (typed at setup)'));
});

test('every company also gets its short form with each ending taken off, in text and in file names', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-short-'));
  const dir = path.join(root, 'Maju Jaya Trading');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, '01 Maju Jaya Trading Letter.txt'), 'Maju Jaya Trading Enterprise Sdn Bhd wrote. Later Maju Jaya Trading Enterprise and Maju Jaya Trading and Maju Jaya replied.');
  const matter = new Matter({ options: { level: 'strict' } });
  const run = await cloakFolder({ folder: dir, outDir: path.join(root, 'o'), options: {}, user: 't', matter, write: false });
  assert.ok(!/Maju|Jaya/.test(`${run.files[0].name}\n${run.files[0].cloaked}`), run.files[0].cloaked);
  const tokens = matter.cloak.entries.map((e) => e.token);
  assert.ok(tokens.some((t) => /\.SHORT$/.test(t)) && tokens.some((t) => /\.SHORT2$/.test(t)));
});

test('words from file and folder names go on the "not sure" list; ordinary document words do not', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-names-'));
  const dir = path.join(root, 'Bundle');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, '01 Affidavit Mawar Teguh.txt'), 'Nothing of note here.');
  const run = await cloakFolder({ folder: dir, outDir: path.join(root, 'o'), options: {}, user: 't', matter: new Matter({ options: { level: 'strict' } }), write: false });
  const words = run.files[0].unsure.map((u) => u.text);
  assert.ok(words.includes('Mawar') && words.includes('Teguh'), words.join());
  assert.ok(!words.includes('Affidavit') && !words.includes('Bundle') || words.includes('Bundle') === false);
});

test('"Don\'t hide" belongs to one matter: another matter still hides the same word', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-keep-'));
  const docs = path.join(root, 'documents');
  await mkdir(docs, { recursive: true });
  await writeFile(path.join(docs, '01 Note.txt'), 'Encik Hashim bin Daud met Maju Jaya Sdn Bhd.');
  const a = (await createMatter({ testMatter: true, dir: path.join(root, 'a'), password: 'a long test password', user: 'x', kdf: FAST })).session;
  const b = (await createMatter({ testMatter: true, dir: path.join(root, 'b'), password: 'a long test password', user: 'x', kdf: FAST })).session;
  await a.cloakFolder({ folder: docs });
  const token = a.matter.cloak.entries.find((e) => /^COMPANY_\d+$/.test(e.token)).token;
  removeTerm(a.matter, token);
  assert.ok(a.matter.keep.some((k) => /Maju Jaya/.test(k)));
  assert.deepEqual(b.matter.keep, []);
  const runB = await b.cloakFolder({ folder: docs });
  assert.ok(!/Maju Jaya/.test(runB.files[0].cloaked));
  await a.close(); await b.close();
});
