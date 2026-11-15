// "Try a sample matter": the made-up documents that ship with Cloak are
// copied into a new folder, and a test matter is created for them, with the
// client and the other parties already filled in.
//
//   <place chosen, by default Documents>/Cloak sample matter/
//     Documents/        the ten made-up files (only ever read)
//     Matter key/       the matter: encrypted key, cache, log
//     Cloaked copies/   empty; a place to export to
//
// A new folder is made every time ("Cloak sample matter 2" if the name is
// taken). Nothing that already exists is written into or removed. A synced
// place (OneDrive, Google Drive, iManage Drive) is refused, as for any matter.

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatter } from './matter.js';
import { checkPassword } from './keyfile.js';
import { assertNotSynced } from './source.js';

/** Where the sample ships: app/sample/documents and app/sample/sample.json. */
export const SAMPLE_DIR = fileURLToPath(new URL('./app/sample/', import.meta.url));
export const SAMPLE_FOLDER_NAME = 'Cloak sample matter';

/** The sample's name, the parties to fill in and the list of files. */
export async function sampleInfo() {
  return JSON.parse(await readFile(path.join(SAMPLE_DIR, 'sample.json'), 'utf8'));
}

const exists = (p) => stat(p).then(() => true, () => false);

/** The first free name in `parent`: "Cloak sample matter", then "Cloak sample matter 2", ... */
export async function freeSampleFolder(parent) {
  for (let n = 1; n < 1000; n++) {
    const folder = path.join(path.resolve(parent), n === 1 ? SAMPLE_FOLDER_NAME : `${SAMPLE_FOLDER_NAME} ${n}`);
    if (!(await exists(folder))) return folder;
  }
  throw new Error('There are already too many sample matters in that place. Delete the old "Cloak sample matter" folders, or choose another place.');
}

/**
 * Where the sample would go if made in `parent`, and the reason Cloak would
 * refuse, if it would. Nothing is created.
 */
export async function planSample(parent) {
  const folder = await freeSampleFolder(parent);
  try {
    await assertNotSynced(folder, 'The folder for the sample matter');
    return { folder, refused: null };
  } catch (err) {
    if (err.code !== 'SYNC_LOCATION') throw err;
    return { folder, refused: err.message };
  }
}

async function copyFolder(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    // Contents only: the copies are ordinary files the person can open, move or delete.
    if (entry.isDirectory()) await copyFolder(src, dest);
    else await writeFile(dest, await readFile(src));
  }
}

/**
 * Make the sample folder and its test matter. Returns the open session and
 * the recovery code (shown once), plus where everything went.
 */
export async function createSampleMatter({ parent, password, user = os.userInfo().username, kdf }) {
  // A password that would be refused is refused before anything is copied.
  checkPassword(password);
  const info = await sampleInfo();
  const folder = await freeSampleFolder(parent);
  await assertNotSynced(folder, 'The folder for the sample matter');
  await mkdir(path.dirname(folder), { recursive: true });
  await mkdir(folder); // fails if the folder appeared in the meantime: nothing of anyone else's is touched
  const docs = path.join(folder, 'Documents');
  const matterDir = path.join(folder, 'Matter key');
  const outDir = path.join(folder, 'Cloaked copies');
  try {
    await copyFolder(path.join(SAMPLE_DIR, 'documents'), docs);
    await mkdir(outDir);
    const made = await createMatter({ dir: matterDir, name: info.name, password, user, options: { level: info.level || 'strict' }, testMatter: true, client: info.client, others: info.others, ...(kdf ? { kdf } : {}) });
    await made.session.log('sample-matter-created', { files: info.files.length });
    return { session: made.session, recoveryCode: made.recoveryCode, folder, docs, matterDir, outDir, info };
  } catch (err) {
    // Only the folder made a moment ago by this call is removed.
    await rm(folder, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
