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
import { formatDate } from './dates.js';
import { NON_LATIN_CHARS } from './run.js';
import { assertNotSynced, locate } from './source.js';
import { Chronology } from './chronology.js';
import { contextSheet } from './context.js';
import { keySweep } from './doublecheck.js';

const LOCK_NAME = 'matter.lock';
export const APPROVE_WORD = 'APPROVE';
// A lock older than this is treated as left behind by a crash.
const STALE_LOCK_MS = 12 * 60 * 60 * 1000;

const inside = (child, parent) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

async function writeLog(dir, entry) {
  // `t` is for sorting; `when` is how a person reads it.
  await appendFile(path.join(dir, 'log.jsonl'), `${JSON.stringify({ t: new Date().toISOString(), when: formatDate(new Date()), cloak_version: VERSION, ...entry })}\n`, 'utf8');
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
        throw Object.assign(new Error(`${held.user} has this matter open on ${held.computer} (since ${formatDate(held.since)}). Only one person can work on a matter at a time.`), { code: 'LOCKED', heldBy: held });
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
    this.review = { complete: null, checked: {}, hideNonLatin: {}, ...contents.review };
    this.testMatter = !!contents.testMatter; // the person says this matter holds made-up test documents only
    this.sources = contents.sources || []; // where documents came from, kept in the encrypted key
    this.chronology = contents.chronology ? Chronology.fromJSON(contents.chronology) : null; // real text: it lives only in the encrypted key
    this.run = null; // the files of the current run, held in memory only
    this.matter = Matter.fromState(contents.state);
    this.crypto = cacheCrypto(dataKey);
    this.open = true;
  }

  contents() {
    return { name: this.name, created: this.created, state: this.matter.state(), files: this.files, nextNumber: this.nextNumber, review: this.review, sources: this.sources, testMatter: this.testMatter, chronology: this.chronology?.toJSON() };
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
   * What the person typed at setup: who the client is, who the other parties are,
   * and whether this matter holds made-up test documents only. The names are
   * kept in the encrypted key, never in the log.
   */
  async setSetup({ client, others, testMatter } = {}) {
    const m = this.matter;
    const next = { client: String(client ?? m.setup.client ?? ''), others: String(others ?? m.setup.others ?? '') };
    const changed = next.client !== m.setup.client || next.others !== m.setup.others;
    m.setup = next;
    if (testMatter !== undefined) this.testMatter = !!testMatter;
    if (changed) this.review.complete = null;
    await this.save();
    await this.log('setup-changed', { client_set: !!next.client.trim(), other_parties: next.others.split('\n').filter((l) => l.trim()).length, test_matter: this.testMatter });
  }

  /**
   * Cloak a folder into this matter. New files reuse the existing key.
   * Nothing is written out: the cloaked text stays in memory until the review
   * is signed off and the copies are exported.
   */
  async cloakFolder({ folder, manualSource = null, ...rest }) {
    folder = path.resolve(folder);
    if (inside(this.dir, folder)) throw new Error('Keep the matter folder (with the key) outside the documents folder.');
    // Is the folder in iManage Drive, OneDrive or Google Drive? It is then a
    // read-only source, and nothing of the matter may sit in that location.
    const location = await locate(folder, { manual: manualSource });
    await assertNotSynced(this.dir, 'The matter folder', { source: location });
    const before = JSON.stringify(this.matter.state().entries);
    const known = new Set(Object.keys(this.files));
    const source = this.describeSource(location);
    const run = await cloakFolder({ folder, user: this.user, matter: this.matter, session: this, write: false, source: source.cloaked, ...rest });
    run.location = location;
    run.source = source;
    this.run = run;
    this.sources.push({ when: run.report.when, by: this.user, kind: source.cloaked.kind, folder, workspace_path: location?.relative || null, how_recognised: location?.how || null });
    this.sources = this.sources.slice(-50);
    for (const f of run.files) {
      f.approved = f.fingerprint ? this.review.checked[f.fingerprint] : undefined;
      f.hideNonLatin = !!(f.fingerprint && this.review.hideNonLatin[f.fingerprint]);
      if (f.fingerprint && this.files[f.fingerprint]) Object.assign(this.files[f.fingerprint], { status: f.status, type: f.type, last_cloaked: run.report.when });
    }
    // New files or new terms mean the review has to be signed off again.
    const changed = before !== JSON.stringify(this.matter.state().entries) || run.files.some((f) => f.fingerprint && f.cloaked && !known.has(f.fingerprint));
    if (changed) this.review.complete = null;
    // Files the reviewer asked to have their non-Latin text hidden are cloaked again.
    for (const f of run.files) if (f.hideNonLatin) renderFile(this.matter, f);
    await this.save();
    await this.log('cloak-folder', { ...run.report.totals, seconds: run.seconds });
    return run;
  }

  /**
   * What the report says about where the documents came from. The workspace
   * path usually holds client and matter names, so the report carries it as
   * tags; the real path is kept in the encrypted key and shown in the app.
   */
  describeSource(location) {
    if (!location) return { cloaked: { kind: 'ordinary folder', read_only: true }, real: { kind: 'ordinary folder' } };
    const generic = /^(?:workspace|workspaces|documents|emails|email|correspondence|pleadings|folders?|my drive|shared drives|inbox|sent|drafts|attachments)$/i;
    const m = this.matter;
    const segments = location.relative ? location.relative.split('/') : [];
    const cloaked = segments.map((seg) => {
      if (generic.test(seg)) return seg;
      const have = m.cloak.entries.find((e) => /^PATH_\d+$/.test(e.token) && e.value === seg);
      const token = have?.token || m.cloak.register(m.cloak.nextToken('PATH'), seg, { match: false });
      m.kinds.set(token, 'source folder path');
      return `{{${token}}}`;
    });
    return {
      cloaked: {
        kind: `${location.label} folder`,
        read_only: true,
        recognised_from: location.how.replace(/"[^"]*"/, '"…"'),
        workspace_path: cloaked.join('/'),
        note: 'The real path is kept in the encrypted matter key.',
      },
      real: { kind: `${location.label} folder`, label: location.label, root: location.root, workspace_path: location.relative, how: location.how },
    };
  }

  /** Re-cloak every file in memory after the name map changed. */
  reapply() {
    if (!this.run) return;
    // Anything a person typed into the chronology (a new date, amount or name) is learned first, so it is hidden like everything else.
    this.chronologyFile = null;
    if (this.chronology) {
      const text = this.chronology.document({ forExport: true });
      this.matter.register(this.matter.learn(text));
    }
    this.matter.facts.finalize();
    this.matter.facts.syncInto(this.matter.cloak);
    for (const f of this.run.files) renderFile(this.matter, f);
    if (this.chronology) {
      this.chronology.setMissing(this.run.files);
      const cf = this.chronology.asFile();
      renderFile(this.matter, cf);
      cf.out = '000-chronology.cloaked.txt';
      this.chronologyFile = cf;
    }
  }

  /** What the review screen shows. Real values: this never leaves the machine. */
  reviewData() {
    const files = this.run?.files || [];
    // Words in the chronology that still look like names need a decision too.
    const data = review.reviewData(this.matter, this.chronologyFile ? [...files, this.chronologyFile] : files);
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
        nonLatinShowing: (f.cloaked?.match(NON_LATIN_CHARS) || []).length, nonLatinHidden: !!f.hideNonLatin,
        checkedBy: f.approved ? { ...f.approved, whenText: formatDate(f.approved.when) } : null, willExport: f.status === 'cloaked' || (f.status === 'manual' && !!f.approved),
      })),
      waitingForManualCheck: waiting.length,
      blockers,
      complete: this.review.complete && { ...this.review.complete, whenText: formatDate(this.review.complete.when) },
      source: this.run?.source?.real || null,
    };
  }

  /** One change from the review screen, applied across all files. */
  async reviewAction(action) {
    const m = this.matter;
    const done = {
      add: () => review.addTerm(m, action.text, action.kind),
      remove: () => {
        // "Don't hide" must be confirmed; twice for numbers and IDs found by a pattern rule.
        const term = this.reviewData().terms.find((t) => t.tag === action.tag.split('.')[0]);
        const needed = term?.patternRule ? 2 : 1;
        if ((action.confirmations || 0) < needed) throw Object.assign(new Error(`Confirm ${needed === 2 ? 'twice ' : ''}before this stops being hidden.`), { code: 'CONFIRM', needed });
        review.removeTerm(m, action.tag);
      },
      merge: () => review.mergeTags(m, action.from, action.into),
      split: () => review.splitForm(m, action.tag),
      confirmMerge: () => review.confirmMerge(m, action.tag),
      confirmGroup: () => review.confirmGroup(m, action.into),
      hideNonLatin: () => {
        const f = this.run?.files.find((x) => x.index === action.number);
        if (!f?.fingerprint) throw new Error('That file is not in this run.');
        f.hideNonLatin = true;
        this.review.hideNonLatin[f.fingerprint] = true;
      },
      confirmShortForm: () => review.confirmShortForm(m, action.tag, action.also),
      fine: () => review.markFine(m, action.text),
      // A person chose to leave one blurred fact visible; the matter records who.
      unblurFact: () => { if (!m.facts.on) throw new Error('This matter is not set to blur facts.'); m.facts.unblur(action.kind, action.key, this.user); },
      reblurFact: () => m.facts.reblur(action.kind, action.key),
    }[action.type];
    if (!done) throw new Error('Unknown review action.');
    done();
    this.review.complete = null;
    this.reapply();
    await this.save();
    // The log records what kind of change was made, never the value.
    await this.log('review-change', { change: action.type, tag: action.tag || action.into || undefined, file_number: action.number ? this.files[this.run.files.find((x) => x.index === action.number)?.fingerprint]?.number : undefined });
    return this.reviewData();
  }

  // ------------------------------------------------------------ chronology

  /** Build the first version of the chronology from every readable file of the run. */
  async buildChronology() {
    if (!this.run) throw new Error('Cloak a folder first.');
    this.chronology = Chronology.build({ files: this.run.files, matter: this.matter });
    this.review.complete = null;
    this.reapply();
    await this.save();
    await this.log('chronology-built', { rows: this.chronology.active().length });
    return this.chronologyView();
  }

  /** The chronology as the screen shows it. Real text: it never leaves this machine. */
  chronologyView({ undated = false } = {}) {
    const c = this.chronology;
    if (!c) return null;
    return { rows: c.table({ undated }), missing: c.missing, notUnderstood: c.notUnderstood().length, confirmed: c.confirmed && { ...c.confirmed, whenText: formatDate(c.confirmed.when) }, dated: c.dated().length, undated: c.undated().length, conflicts: c.active().filter((r) => r.conflict).length, removed: c.rows.filter((r) => r.removed).length };
  }

  /** One change to the chronology. The log records the kind of change and who made it, never the text. */
  async chronologyAction(action) {
    const c = this.chronology;
    if (!c) throw new Error('Build the chronology first.');
    const by = this.user;
    ({
      edit: () => c.edit(action.id, action.patch, by),
      merge: () => c.merge(action.ids, by),
      remove: () => c.remove(action.id, by),
      restore: () => c.restore(action.id, by),
      add: () => c.add(action.row, by),
      confirm: () => c.confirm(by),
    }[action.type] || (() => { throw new Error('Unknown chronology action.'); }))();
    if (action.type !== 'confirm') this.review.complete = null;
    this.reapply();
    await this.save();
    await this.log(`chronology-${action.type}`);
    return this.chronologyView();
  }

  /** A person has read a file that needed a manual check and accepts it. */
  async approveFile(number, { confirmation } = {}) {
    const f = this.run?.files.find((x) => x.index === number);
    if (!f) throw new Error('That file is not in this run.');
    if (f.status !== 'manual') throw new Error(f.status === 'cloaked' ? 'That file does not need a manual check.' : 'That file could not be fully read, so it cannot be approved. Fix the file and run again.');
    // Text in a script the tool cannot check is still showing: a tick is
    // not enough, the reviewer has to type the word.
    const showing = (f.cloaked?.match(NON_LATIN_CHARS) || []).length;
    if (showing && String(confirmation || '').trim().toUpperCase() !== APPROVE_WORD) {
      throw Object.assign(new Error(`This file still shows ${showing} character(s) of non-Latin text. Hide it, or type ${APPROVE_WORD} to approve the file as it is.`), { code: 'TYPE_TO_CONFIRM' });
    }
    f.approved = { by: this.user, when: new Date().toISOString(), reasons: f.reasons, nonLatinShowing: showing };
    this.review.checked[f.fingerprint] = f.approved;
    if (!f.out) f.out = `${String(this.numberFor(f.fingerprint)).padStart(3, '0')}-${f.type}.cloaked.txt`;
    await this.save();
    await this.log('file-checked-by-hand', { file_number: this.files[f.fingerprint].number, non_latin_text_showing: showing });
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
  async export({ outDir, only = 'all' }) {
    if (!this.run) throw new Error('Cloak a folder first.');
    if (!this.review.complete) throw new Error('Nothing can be exported until the review is finished.');
    // Until the double checker exists, only matters marked as made-up test documents can be exported.
    if (!this.testMatter) throw Object.assign(new Error('Export is limited to test matters until the double checker is built. If this matter holds made-up test documents only, tick that box on the setup screen.'), { code: 'TEST_MATTER_ONLY' });
    if (only === 'chronology' && !this.chronology?.confirmed) throw new Error('Confirm the chronology first.');
    outDir = path.resolve(outDir);
    if (inside(this.dir, outDir) || inside(outDir, this.dir)) throw new Error('The cloaked copies must not go into the matter folder. The key must never sit with the cloaked files.');
    await assertNotSynced(outDir, 'The folder for the cloaked copies', { source: this.run.location });
    const files = this.run.files;
    const allowed = (f) => only !== 'chronology' && (f.status === 'cloaked' || (f.status === 'manual' && !!f.approved));
    const strict = this.matter.facts.on;
    // The confirmed chronology is its own document, cloaked like any other file.
    const extra = [];
    if (this.chronology?.confirmed && this.chronologyFile) extra.push(this.chronologyFile);
    const toWrite = [...files.filter(allowed), ...extra];
    // Strict: the context sheet for the AI goes with every export.
    let sheet = null;
    if (strict) {
      sheet = { out: '000-context-sheet.cloaked.txt', cloaked: contextSheet(this.matter, toWrite.filter((f) => f.cloaked), { version: VERSION }), status: 'cloaked' };
      extra.push(sheet);
    }
    // The key sweep: nothing the key holds may appear in anything that is written, the context sheet included.
    if (strict) {
      const findings = [];
      for (const f of [...toWrite.filter((x) => x.cloaked), ...(sheet ? [sheet] : [])]) {
        // The context sheet gives each person's role, job titles included, as the owner asked; nothing else may show one.
        for (const h of keySweep(this.matter, f.cloaked, { allowKinds: f === sheet ? ['job'] : [] })) findings.push({ file: f.out, paragraph: h.paragraph, kind: h.kind });
      }
      if (findings.length) throw Object.assign(new Error(`The key sweep found a real value still showing in ${findings.length} place(s): ${findings.slice(0, 5).map((x) => `${x.file} paragraph ${x.paragraph}`).join('; ')}. Nothing was exported.`), { code: 'SWEEP_FAILED', findings });
    }
    const note = `Reviewed by ${this.review.complete.by} on ${formatDate(this.review.complete.when)}. NOT YET DOUBLE-CHECKED.`;
    const report = buildReport({ matter: this.matter, files, total: this.run.total, user: this.user, seconds: this.run.seconds, cached: this.run.cached, source: this.run.source.cloaked, review: note });
    report.level = this.matter.options.level;
    if (strict) report.facts = { dates_version: this.matter.facts.datesVersion, un_blurred: this.matter.facts.unblurred.map((u) => ({ kind: u.kind, by: u.by, when: u.when })) };
    const written = await writeOutput(outDir, [...files, ...extra], report, `Cloak ${VERSION}\n\n${note}\nThe double checker has not been run on these copies.\n`, 'REVIEWED-NOT-DOUBLE-CHECKED.txt', (f) => extra.includes(f) || allowed(f));
    await this.log('exported', { only, files_written: written.length, files_held_back: only === 'chronology' ? 0 : files.filter((f) => f.cloaked && !allowed(f)).length });
    return { outDir, written, heldBack: only === 'chronology' ? 0 : files.filter((f) => !f.container && !allowed(f)).length };
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
export async function createMatter({ dir, name = '', password, options = {}, user = os.userInfo().username, kdf, testMatter = false, client = '', others = '' }) {
  dir = path.resolve(dir);
  // The key must never be saved where a sync app would upload it.
  await assertNotSynced(dir, 'The matter folder');
  await mkdir(dir, { recursive: true });
  if ((await readdir(dir)).includes(KEY_FILE_NAME)) throw new Error('This folder already holds a matter. Open it instead.');
  const first = new Matter({ options: { level: 'strict', ...options } });
  first.setup = { client, others };
  const contents = { name, created: new Date().toISOString(), state: first.state(), files: {}, nextNumber: 1, testMatter: !!testMatter };
  const { recoveryCode, dataKey, matterId } = await createKeyFile(path.join(dir, KEY_FILE_NAME), { password, contents, ...(kdf ? { kdf } : {}) });
  await writeLog(dir, { by: user, action: 'matter-created', matter: matterId });
  await takeLock(dir, user);
  return { session: new Session({ dir, user, dataKey, contents, matterId, openedWith: 'password' }), recoveryCode };
}

/** Open an existing matter with its password or its recovery code. */
export async function openMatter({ dir, password, recoveryCode, user = os.userInfo().username, takeOver = false }) {
  dir = path.resolve(dir);
  await assertNotSynced(dir, 'This matter folder');
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
