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
import { buildReport, cloakFolder, renderFile, writeOutput } from './run.js';
import * as review from './review.js';
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
    // Review state: who signed the review off, and files a person checked by hand.
    this.review = contents.review || { complete: null, checked: {} };
    this.run = null; // the files of the current run, held in memory only
    this.matter = Matter.fromState(contents.state);
    this.crypto = cacheCrypto(dataKey);
    this.open = true;
  }

  contents() {
    return { name: this.name, created: this.created, state: this.matter.state(), files: this.files, nextNumber: this.nextNumber, review: this.review };
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

  /**
   * Cloak a folder into this matter. New files reuse the existing key.
   * Nothing is written out: the cloaked text stays in memory until the review
   * is signed off and the copies are exported.
   */
  async cloakFolder({ folder, ...rest }) {
    folder = path.resolve(folder);
    if (inside(this.dir, folder)) throw new Error('Keep the matter folder (with the key) outside the documents folder.');
    const before = JSON.stringify(this.matter.state().entries);
    const known = new Set(Object.keys(this.files));
    const run = await cloakFolder({ folder, user: this.user, matter: this.matter, session: this, write: false, ...rest });
    this.run = run;
    for (const f of run.files) {
      f.approved = f.fingerprint ? this.review.checked[f.fingerprint] : undefined;
      if (f.fingerprint && this.files[f.fingerprint]) Object.assign(this.files[f.fingerprint], { status: f.status, type: f.type, last_cloaked: run.report.when });
    }
    // New files or new terms mean the review has to be signed off again.
    const changed = before !== JSON.stringify(this.matter.state().entries) || run.files.some((f) => f.fingerprint && f.cloaked && !known.has(f.fingerprint));
    if (changed) this.review.complete = null;
    this.reapply();
    await this.save();
    await this.log('cloak-folder', { ...run.report.totals, seconds: run.seconds });
    return run;
  }

  /** Re-cloak every file in memory after the name map changed. */
  reapply() {
    if (!this.run) return;
    for (const f of this.run.files) renderFile(this.matter, f);
  }

  /** What the review screen shows. Real values: this never leaves the machine. */
  reviewData() {
    const files = this.run?.files || [];
    const data = review.reviewData(this.matter, files);
    const waiting = files.filter((f) => f.status === 'manual' && !f.approved);
    const blockers = [];
    if (data.unsure.length) blockers.push(`${data.unsure.length} word(s) the tool is not sure about still need a decision.`);
    if (data.merges.length) blockers.push(`${data.merges.length} joined name(s) need to be confirmed or split.`);
    if (data.shortForms.length) blockers.push(`${data.shortForms.length} short form(s) that could be two people need to be confirmed.`);
    return {
      ...data,
      files: files.map((f) => ({
        number: f.index, name: f.rel, inside: f.inside, type: f.type, status: f.status, output: f.out || null,
        reasons: f.reasons, ocr: f.proof.ocr, fromCache: !!f.disk?.fromCache, characters: f.proof.characters,
        found: f.proof.found, read: f.proof.read, unit: f.proof.unit, notSure: f.unsure?.length || 0,
        checkedBy: f.approved || null, willExport: f.status === 'cloaked' || (f.status === 'manual' && !!f.approved),
      })),
      waitingForManualCheck: waiting.length,
      blockers,
      complete: this.review.complete,
    };
  }

  /** One change from the review screen, applied across all files. */
  async reviewAction(action) {
    const m = this.matter;
    const done = {
      add: () => review.addTerm(m, action.text, action.kind),
      remove: () => review.removeTerm(m, action.tag),
      merge: () => review.mergeTags(m, action.from, action.into),
      split: () => review.splitForm(m, action.tag),
      confirmMerge: () => review.confirmMerge(m, action.tag),
      confirmShortForm: () => review.confirmShortForm(m, action.tag, action.also),
      fine: () => review.markFine(m, action.text),
    }[action.type];
    if (!done) throw new Error('Unknown review action.');
    done();
    this.review.complete = null;
    this.reapply();
    await this.save();
    // The log records what kind of change was made, never the value.
    await this.log('review-change', { change: action.type, tag: action.tag || action.into || undefined });
    return this.reviewData();
  }

  /** A person has read a file that needed a manual check and accepts it. */
  async approveFile(number) {
    const f = this.run?.files.find((x) => x.index === number);
    if (!f) throw new Error('That file is not in this run.');
    if (f.status !== 'manual') throw new Error(f.status === 'cloaked' ? 'That file does not need a manual check.' : 'That file could not be fully read, so it cannot be approved. Fix the file and run again.');
    f.approved = { by: this.user, when: new Date().toISOString(), reasons: f.reasons };
    this.review.checked[f.fingerprint] = f.approved;
    if (!f.out) f.out = `${String(this.numberFor(f.fingerprint)).padStart(3, '0')}-${f.type}.cloaked.txt`;
    await this.save();
    await this.log('file-checked-by-hand', { file_number: this.files[f.fingerprint].number });
    return this.reviewData();
  }

  /** Sign the review off. Refused while anything is still undecided. */
  async completeReview() {
    const data = this.reviewData();
    if (!this.run) throw new Error('Cloak a folder first.');
    if (data.blockers.length) throw new Error(`The review is not finished. ${data.blockers.join(' ')}`);
    this.review.complete = { by: this.user, when: new Date().toISOString() };
    await this.save();
    await this.log('review-completed', { terms: data.terms.length, files: data.files.length });
    return this.reviewData();
  }

  /**
   * Write the cloaked copies to a folder. Only after the review is signed
   * off, and only files that were fully read (or checked by hand).
   */
  async export({ outDir }) {
    if (!this.run) throw new Error('Cloak a folder first.');
    if (!this.review.complete) throw new Error('Nothing can be exported until the review is finished.');
    outDir = path.resolve(outDir);
    if (inside(this.dir, outDir) || inside(outDir, this.dir)) throw new Error('The cloaked copies must not go into the matter folder. The key must never sit with the cloaked files.');
    const files = this.run.files;
    const allowed = (f) => f.status === 'cloaked' || (f.status === 'manual' && !!f.approved);
    const note = `Reviewed by ${this.review.complete.by} on ${this.review.complete.when}. NOT YET DOUBLE-CHECKED.`;
    const report = buildReport({ matter: this.matter, files, total: this.run.total, user: this.user, seconds: this.run.seconds, cached: this.run.cached, review: note });
    const written = await writeOutput(outDir, files, report, `Cloak ${VERSION}\n\n${note}\nThe double checker has not been run on these copies.\n`, 'REVIEWED-NOT-DOUBLE-CHECKED.txt', allowed);
    await this.log('exported', { files_written: written.length, files_held_back: files.filter((f) => f.cloaked && !allowed(f)).length });
    return { outDir, written, heldBack: files.filter((f) => !f.container && !allowed(f)).length };
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
