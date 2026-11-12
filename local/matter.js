// A matter folder: one encrypted key shared by everyone on the matter.
//
//   <matter folder>/
//     matter.cloakkey      the encrypted key (tag -> real value, and the
//                          matter's review state)
//     matter.cloakkey.bak  the previous save, also encrypted
//     matter.lock          who has the matter open right now
//     cache/               what was read from each file, encrypted with the
//                          matter key, so unchanged files are not re-read
//     log.jsonl            who did what and when. No real values.
//
// The folder belongs on the firm's own drive, outside the documents folder
// and outside the cloaked folder. A second lawyer opens the same folder and
// types the matter password. Only one person can have it open at a time.

import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Matter } from './engine.js';
import { KEY_FILE_NAME, cacheCrypto, createKeyFile, openKeyFile, replaceRecoveryCode, saveKeyFile, setPassword } from './keyfile.js';
import { cloakFolder } from './run.js';
import { VERSION } from './version.js';

const LOCK_NAME = 'matter.lock';
// A lock older than this is treated as left behind by a crash.
const STALE_LOCK_MS = 12 * 60 * 60 * 1000;

const inside = (child, parent) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

async function writeLog(dir, entry) {
  await appendFile(path.join(dir, 'log.jsonl'), `${JSON.stringify({ t: new Date().toISOString(), cloak_version: VERSION, ...entry })}\n`, 'utf8');
}

async function takeLock(dir, user, { takeOver = false } = {}) {
  const file = path.join(dir, LOCK_NAME);
  const mine = { user, computer: os.hostname(), since: new Date().toISOString(), pid: process.pid };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await writeFile(file, JSON.stringify(mine), { flag: 'wx' });
      return mine;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      const held = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
      const stale = !held.since || Date.now() - Date.parse(held.since) > STALE_LOCK_MS;
      if (!stale && !takeOver) {
        throw Object.assign(new Error(`${held.user} has this matter open on ${held.computer} (since ${held.since}). Only one person can work on a matter at a time.`), { code: 'LOCKED', heldBy: held });
      }
      await writeLog(dir, { by: user, action: stale ? 'stale-lock-cleared' : 'lock-taken-over', from: held.user || 'unknown' });
      await rm(file, { force: true });
    }
  }
  throw new Error('Could not lock the matter.');
}

class Session {
  constructor({ dir, user, dataKey, contents, matterId, openedWith }) {
    Object.assign(this, { dir, user, dataKey, matterId, openedWith });
    this.keyFile = path.join(dir, KEY_FILE_NAME);
    this.name = contents.name;
    this.created = contents.created;
    this.files = contents.files || {};       // fingerprint of a file -> its number and status
    this.nextNumber = contents.nextNumber || 1;
    this.matter = Matter.fromState(contents.state);
    this.crypto = cacheCrypto(dataKey);
    this.open = true;
  }

  contents() {
    return { name: this.name, created: this.created, state: this.matter.state(), files: this.files, nextNumber: this.nextNumber };
  }

  log(action, details = {}) {
    return writeLog(this.dir, { by: this.user, action, ...details });
  }

  async save() {
    await saveKeyFile(this.keyFile, this.dataKey, this.contents());
  }

  /** The same file always gets the same output number in this matter. */
  numberFor(fingerprint) {
    if (!this.files[fingerprint]) this.files[fingerprint] = { number: this.nextNumber++, first_cloaked: new Date().toISOString(), by: this.user };
    return this.files[fingerprint].number;
  }

  // What was read from a file, kept encrypted so an unchanged file is not
  // read (or put through OCR) again.
  cache = {
    get: async (fileHash) => {
      try {
        const entry = this.crypto.decrypt(await readFile(path.join(this.dir, 'cache', `${this.crypto.name(fileHash)}.enc`)));
        return entry.reader === VERSION ? entry.results : null;
      } catch {
        return null;
      }
    },
    put: async (fileHash, results) => {
      await mkdir(path.join(this.dir, 'cache'), { recursive: true });
      await writeFile(path.join(this.dir, 'cache', `${this.crypto.name(fileHash)}.enc`), this.crypto.encrypt({ reader: VERSION, results }), { mode: 0o600 });
    },
  };

  /** Cloak a folder into this matter. New files reuse the existing key. */
  async cloakFolder({ folder, outDir, ...rest }) {
    folder = path.resolve(folder);
    outDir = path.resolve(outDir);
    if (inside(this.dir, folder)) throw new Error('Keep the matter folder (with the key) outside the documents folder.');
    if (inside(this.dir, outDir) || inside(outDir, this.dir)) throw new Error('The cloaked copies must not go into the matter folder. The key must never sit with the cloaked files.');
    const run = await cloakFolder({ folder, outDir, user: this.user, matter: this.matter, session: this, ...rest });
    for (const f of run.files) if (f.fingerprint && this.files[f.fingerprint]) Object.assign(this.files[f.fingerprint], { status: f.status, type: f.type, last_cloaked: run.report.when });
    await this.save();
    await this.log('cloak-folder', { ...run.report.totals, seconds: run.seconds });
    return run;
  }

  async changePassword(newPassword) {
    await setPassword(this.keyFile, this.dataKey, newPassword);
    await this.log('password-changed');
  }

  /** Returns a new recovery code; the old one stops working. */
  async newRecoveryCode() {
    const code = await replaceRecoveryCode(this.keyFile, this.dataKey);
    await this.log('recovery-code-replaced');
    return code;
  }

  /** Remove everything cached for this matter. */
  async clearCache() {
    await rm(path.join(this.dir, 'cache'), { recursive: true, force: true });
    await this.log('cache-cleared');
  }

  async close() {
    if (!this.open) return;
    this.open = false;
    await this.save();
    await this.log('closed');
    await rm(path.join(this.dir, LOCK_NAME), { force: true });
    this.dataKey.fill(0);
  }
}

/**
 * Start a new matter. Returns the open session and the recovery code, which
 * is shown once: print it and keep it with the matter file or in the safe.
 */
export async function createMatter({ dir, name = '', password, options = {}, user = os.userInfo().username, kdf }) {
  dir = path.resolve(dir);
  await mkdir(dir, { recursive: true });
  if ((await readdir(dir)).includes(KEY_FILE_NAME)) throw new Error('This folder already holds a matter. Open it instead.');
  const contents = { name, created: new Date().toISOString(), state: new Matter({ options }).state(), files: {}, nextNumber: 1 };
  const { recoveryCode, dataKey, matterId } = await createKeyFile(path.join(dir, KEY_FILE_NAME), { password, contents, ...(kdf ? { kdf } : {}) });
  await writeLog(dir, { by: user, action: 'matter-created', matter: matterId });
  await takeLock(dir, user);
  return { session: new Session({ dir, user, dataKey, contents, matterId, openedWith: 'password' }), recoveryCode };
}

/** Open an existing matter with its password or its recovery code. */
export async function openMatter({ dir, password, recoveryCode, user = os.userInfo().username, takeOver = false }) {
  dir = path.resolve(dir);
  await stat(path.join(dir, KEY_FILE_NAME)).catch(() => { throw new Error('There is no matter key in this folder.'); });
  let opened;
  try {
    opened = await openKeyFile(path.join(dir, KEY_FILE_NAME), { password, recoveryCode });
  } catch (err) {
    if (err.code === 'WRONG_SECRET') await writeLog(dir, { by: user, action: 'open-failed', with: recoveryCode ? 'recovery code' : 'password' });
    throw err;
  }
  await takeLock(dir, user, { takeOver });
  await writeLog(dir, { by: user, action: 'opened', with: opened.openedWith === 'recovery' ? 'recovery code' : 'password' });
  return new Session({ dir, user, ...opened });
}
