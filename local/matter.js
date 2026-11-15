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
import { documentUnit, sheetUnit, reportUnit, markerUnit, namesUnit, inspect, verdict } from './doublecheck.js';

const LOCK_NAME = 'matter.lock';
// The marker file says what state the exported copies are in.
export const MARKER_NAME = 'REVIEWED-AND-DOUBLE-CHECKED.txt';
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

// ---------------------------------------------------------------- for the double checker

/** Why export was refused. No real value: the file and line of the first findings; the words are on the Double check tab. */
function refusal(result) {
  const open = result.groups.flatMap((g) => g.places.filter((p) => !p.decided));
  const n = result.counts.undecided;
  const files = result.counts.filesFailing;
  const where = open.slice(0, 3).map((p) => `${p.unit} line ${p.line}`).join('; ');
  return `The double check found ${n} thing${n === 1 ? '' : 's'} still to decide in ${files} file${files === 1 ? '' : 's'} (${where}${open.length > 3 ? '; …' : ''}). Nothing was exported. Open the Double check tab: each finding shows the words, the file and the line, with "Hide it" and "It is fine".`;
}

/** The exact text found at each place of a finding. */
const surfaces = (group) => [...new Set(group.places.map((p) => p.excerpt.slice(p.mark[0], p.mark[1])).filter(Boolean))];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole words, exactly as written, outside tags, replaced by their tag. */
function replaceExact(text, list) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${list.map((h) => escapeRe(h.value)).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
  const tokenOf = new Map(list.map((h) => [h.value, h.token]));
  return String(text).split(/(\{\{[^{}]*\}\})/).map((part, i) => (i % 2 ? part : part.replace(re, (m) => `{{${tokenOf.get(m)}}}`))).join('');
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
    this.applyExactHides();
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
    this.applyExactHides();
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
      doubleCheck: this.checkBrief(),
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
    this.lastCheck = null; // one more file will be exported: the double check must read it
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
   * off, only files that were fully read (or checked by hand), and only once
   * the double check has passed on exactly what is written: every file
   * passes, or a person has decided every finding.
   */
  async export({ outDir, only = 'all' }) {
    if (!this.run) throw new Error('Cloak a folder first.');
    if (!this.review.complete) throw new Error('Nothing can be exported until the review is finished.');
    if (only === 'chronology' && !this.chronology?.confirmed) throw new Error('Confirm the chronology first.');
    outDir = path.resolve(outDir);
    if (inside(this.dir, outDir) || inside(outDir, this.dir)) throw new Error('The cloaked copies must not go into the matter folder. The key must never sit with the cloaked files.');
    await assertNotSynced(outDir, 'The folder for the cloaked copies', { source: this.run.location });
    // The double check runs again on what is about to be written. It is one condition of its own: any other
    // condition on export (a licence that allows test matters only, for example) is checked as well, not instead.
    const checked = await this.checkExport(only);
    if (!checked.result.passed) {
      const c = checked.result.counts;
      await this.log('export-refused', { reason: 'double check', still_to_decide: c.undecided, files: c.filesFailing });
      throw Object.assign(new Error(refusal(checked.result)), { code: 'DOUBLE_CHECK', counts: c });
    }
    const { plan, report, marker, result } = checked;
    const written = await writeOutput(outDir, [...plan.files, ...plan.extra], report, marker, MARKER_NAME, (f) => plan.extra.includes(f) || plan.allowed(f));
    // Counts only: never a value.
    await this.log('exported', { only, files_written: written.length, files_held_back: only === 'chronology' ? 0 : plan.files.filter((f) => f.cloaked && !plan.allowed(f)).length, double_checked: true, found: result.counts.places, marked_fine: result.counts.markedFine, hidden_in_double_check: this.checkState().hidden, test_matter: this.testMatter });
    return { outDir, written, heldBack: only === 'chronology' ? 0 : plan.files.filter((f) => !f.container && !plan.allowed(f)).length, doubleCheck: report.double_check };
  }

  // ------------------------------------------------------------ the double checker (feature 4)
  //
  // A second, independent check of everything an export would write. Its
  // findings hold real text: they stay in memory and on this screen. The
  // approvals ("It is fine") are kept in the encrypted matter with who and
  // when; the log gets counts only. Any change to the review takes the
  // sign-off away, and with it the double check and its approvals.

  /** The double check of the current review sign-off. A new sign-off starts it again. */
  checkState() {
    const signedOff = this.review.complete?.when || null;
    if (!this.review.doubleCheck || this.review.doubleCheck.forReview !== signedOff) this.review.doubleCheck = { forReview: signedOff, approvals: {}, hidden: 0, last: null };
    return this.review.doubleCheck;
  }

  /** What an export would write: the files, the confirmed chronology, the context sheet, and one unit per file for the checker. */
  exportPlan(only = 'all') {
    const files = this.run.files;
    const allowed = (f) => only !== 'chronology' && (f.status === 'cloaked' || (f.status === 'manual' && !!f.approved));
    // The confirmed chronology is its own document, cloaked like any other file.
    const extra = [];
    if (this.chronology?.confirmed && this.chronologyFile) extra.push(this.chronologyFile);
    const toWrite = [...files.filter(allowed), ...extra];
    // Strict: the context sheet for the AI goes with every export.
    if (this.matter.facts.on) extra.push({ out: '000-context-sheet.cloaked.txt', cloaked: contextSheet(this.matter, toWrite.filter((f) => f.cloaked), { version: VERSION }), status: 'cloaked', sheet: true });
    const written = [...files.filter((f) => allowed(f) && f.out && f.cloaked), ...extra.filter((f) => f.out && f.cloaked)];
    const units = written.map((f) => (f.sheet ? sheetUnit(f) : f === this.chronologyFile ? documentUnit(f, { title: 'Chronology (confirmed)', label: 'Chronology' }) : documentUnit(f)));
    return { only, files, allowed, extra, written, units };
  }

  /** cloak-report.json for an export, saying who reviewed it and who double-checked it. */
  exportReport(plan, result, when) {
    const state = this.checkState();
    const approvers = [...new Set(result.groups.flatMap((g) => g.places.filter((p) => p.decided).map((p) => p.decided.by)))];
    const double = {
      statement: `Double-checked by ${this.user} on ${formatDate(when)}.`,
      by: this.user,
      when,
      when_text: formatDate(when),
      files_checked: result.counts.files,
      found: result.counts.places,
      marked_fine_by_a_person: result.counts.markedFine,
      hidden_during_the_double_check: state.hidden,
      fine_marked_by: approvers,
      checks: ['key sweep', 'pattern sweep', 'leftover names', 'every part of every file', 'tags'],
      ai_used: false,
    };
    const note = `Reviewed by ${this.review.complete.by} on ${formatDate(this.review.complete.when)}. ${double.statement}`;
    const report = buildReport({ matter: this.matter, files: plan.files, total: this.run.total, user: this.user, seconds: this.run.seconds, cached: this.run.cached, source: this.run.source.cloaked, review: note });
    // What the double check hid by its exact text is hidden in what the report says about each file too (part names, reasons).
    const hides = (this.review.exactHides || []).filter((h) => this.matter.cloak.byToken.has(h.token)).sort((a, b) => b.value.length - a.value.length);
    if (hides.length) {
      for (const e of report.files) {
        e.name = replaceExact(e.name, hides);
        e.reasons = e.reasons.map((r) => replaceExact(r, hides));
        e.proof.could_not_be_read = e.proof.could_not_be_read.map((r) => replaceExact(r, hides));
        e.proof.parts_read = e.proof.parts_read.map((r) => replaceExact(r, hides));
      }
    }
    report.level = this.matter.options.level;
    if (this.matter.facts.on) report.facts = { dates_version: this.matter.facts.datesVersion, un_blurred: this.matter.facts.unblurred.map((u) => ({ kind: u.kind, by: u.by, when: u.when })) };
    // The person's own statement that the documents are made up. Cloak cannot tell.
    report.test_matter = this.testMatter;
    report.double_check = double;
    return report;
  }

  exportMarker(report) {
    const d = report.double_check;
    return `Cloak ${VERSION}\n\n${report.review.split(' Double-checked by ')[0]}\n${d.statement}\nChecked: ${d.files_checked} files. Found: ${d.found}. Marked as fine by a person: ${d.marked_fine_by_a_person}. Hidden during the double check: ${d.hidden_during_the_double_check}.\nMade-up test documents only: ${report.test_matter ? 'yes' : 'no'}.\nNo AI was used.\n`;
  }

  /**
   * Run the double check on what an export would write. The report and the
   * marker file are written last, with the counts, so they are read twice:
   * once to count, and again as they will be written.
   */
  async checkExport(only = 'all') {
    const state = this.checkState();
    const plan = this.exportPlan(only);
    const when = new Date().toISOString();
    const docs = inspect(this.matter, plan.units);
    const generated = (report, marker) => inspect(this.matter, [reportUnit(JSON.stringify(report, null, 2)), markerUnit(marker, MARKER_NAME), namesUnit([...plan.written.map((f) => f.out), 'cloak-report.json', MARKER_NAME])]);
    const options = { approvals: state.approvals };
    let report = this.exportReport(plan, verdict(this.matter, [docs], options), when);
    let result = verdict(this.matter, [docs, generated(report, this.exportMarker(report))], options);
    report = this.exportReport(plan, result, when);
    const marker = this.exportMarker(report);
    result = verdict(this.matter, [docs, generated(report, marker)], options);
    this.lastCheck = { result, when, by: this.user, only, forReview: state.forReview };
    state.last = { when, by: this.user, only, ...result.counts, passed: result.passed };
    await this.save();
    await this.log('double-check', { only, files_checked: result.counts.files, found: result.counts.places, distinct: result.counts.groups, still_to_decide: result.counts.undecided, marked_fine: result.counts.markedFine, passed: result.passed });
    return { plan, report, marker, result };
  }

  /** "Run the double check": everything an export of all files would write is checked. Nothing is written. */
  async doubleCheck({ only = 'all' } = {}) {
    if (!this.run) throw new Error('Cloak a folder first.');
    if (!this.review.complete) throw new Error('Finish the review first. The double check reads what would be exported.');
    await this.checkExport(only);
    return this.checkView();
  }

  /** The last double check as the screen shows it. Real text: it never leaves this machine. */
  checkView() {
    const last = this.lastCheck;
    if (!last || !this.review.complete || last.forReview !== this.checkState().forReview) return { ran: false };
    const r = last.result;
    const shown = (p) => ({ ...p, decided: p.decided && { ...p.decided, whenText: formatDate(p.decided.when) } });
    return {
      ran: true, passed: r.passed, only: last.only, by: last.by, whenText: formatDate(last.when), counts: r.counts, hidden: this.checkState().hidden,
      units: r.units,
      groups: r.groups.map((g) => ({ ...g, places: g.places.slice(0, 40).map(shown), more: Math.max(0, g.places.length - 40) })),
    };
  }

  /** For the finish bar: has the double check run on this sign-off, and what did it find. Counts only. */
  checkBrief() {
    if (!this.review.complete) return null;
    const view = this.checkView();
    return view.ran ? { ran: true, passed: view.passed, by: view.by, whenText: view.whenText, counts: view.counts, hidden: view.hidden } : { ran: false };
  }

  /**
   * A person decides one finding (everywhere it was found):
   *   fine  - it is not confidential; kept with who and when, for these places
   *   hide  - hide it like the review screen's "add" (kind: PERSON, COMPANY or
   *           OTHER for a possible name), cloak again and check again
   * Hiding keeps the review signed off unless it gives the review something
   * new to decide (a name joined to another, say): then the review must be
   * finished again, and the double check starts again.
   */
  async decideFinding({ key, decision, kind } = {}) {
    if (!this.run || !this.review.complete) throw new Error('Finish the review first.');
    if (!this.lastCheck || this.lastCheck.forReview !== this.checkState().forReview) await this.checkExport('all');
    const only = this.lastCheck.only;
    const group = this.lastCheck.result.groups.find((g) => g.key === key);
    if (!group) throw new Error('That finding is no longer there. Run the double check again.');
    const state = this.checkState();
    if (decision === 'fine') {
      const before = state.approvals[key];
      state.approvals[key] = { by: this.user, when: new Date().toISOString(), check: group.check, places: [...new Set([...(before?.places || []), ...group.places.map((p) => p.place)])] };
      await this.save();
      await this.log('double-check-fine', { check: group.check, places: group.places.length });
      await this.checkExport(only);
      return { check: this.checkView(), review: this.reviewData() };
    }
    if (decision !== 'hide') throw new Error('Choose "Hide it" or "It is fine".');
    if (!group.fixable) throw new Error(group.check === 'tag' ? 'A tag problem cannot be hidden. Remove the file, or mark it as fine if you are sure.' : 'This is the name of the person who reviewed or double-checked, which Cloak writes in the report. Mark it as fine, or have someone else do the export.');
    // What the review has waiting before the change: only something new reopens it.
    const waiting = () => { const d = this.reviewData(); return new Set([...d.unsure.map((u) => `u|${u.text}`), ...d.merges.map((m) => `m|${m.tag}`), ...d.shortForms.map((a) => `s|${a.tag}|${a.also}`)]); };
    const before = waiting();
    const isNew = () => [...waiting()].some((k) => !before.has(k));
    const how = this.hideFinding(group, kind);
    this.reapply();
    state.hidden += 1;
    let reopened = isNew();
    if (!reopened) {
      // If the same words still show (a name in lower case, for one), their exact text is hidden under the tag.
      await this.checkExport(only);
      const still = this.lastCheck.result.groups.find((g) => g.key === key && g.undecided);
      if (still && how.token) {
        for (const s of surfaces(still)) this.addExactHide(s, how.token);
        this.reapply();
        reopened = isNew();
      }
    }
    // Something new for the review to decide: it must be finished again, and the double check run again.
    if (reopened) this.review.complete = null;
    await this.save();
    await this.log('double-check-hide', { check: group.check, as: how.as, review_reopened: reopened });
    if (!reopened) await this.checkExport(only);
    return { check: this.checkView(), review: this.reviewData(), reopened };
  }

  /** Hide what one finding found, the way the review screen would. Returns the tag it now has, when that is known. */
  hideFinding(group, kind) {
    const m = this.matter;
    if (group.check === 'name') {
      const as = ['PERSON', 'COMPANY', 'OTHER'].includes(kind) ? kind : group.hideAs || 'PERSON';
      return { as, token: review.addTerm(m, group.value, as) };
    }
    if (group.check === 'pattern') return { as: group.type, token: m.addId(group.type, group.value) };
    if (group.check === 'fact') {
      // The new way of writing it becomes another form of the same fact ({{DATE_1.C}}).
      for (const s of surfaces(group)) m.facts.learn(s);
      return { as: group.fact, token: null };
    }
    // A value the key holds but the text shows anyway (in lower case, or a folder name): its exact text is hidden under its tag.
    for (const s of surfaces(group)) this.addExactHide(s, group.token);
    return { as: 'key value', token: group.token };
  }

  addExactHide(value, token) {
    const list = (this.review.exactHides ||= []);
    if (value && token && !list.some((h) => h.value === value && h.token === token)) list.push({ value, token, by: this.user, when: new Date().toISOString() });
  }

  /** Exact text the double check was told to hide where the key search does not reach it. Applied after every cloaking. */
  applyExactHides() {
    const list = (this.review.exactHides || []).filter((h) => this.matter.cloak.byToken.has(h.token)).sort((a, b) => b.value.length - a.value.length);
    if (!list.length) return;
    for (const f of [...(this.run?.files || []), ...(this.chronologyFile ? [this.chronologyFile] : [])]) {
      if (f.name) f.name = replaceExact(f.name, list);
      if (!f.cloaked) continue;
      f.cloaked = replaceExact(f.cloaked, list);
      f.tags = {};
      for (const t of f.cloaked.matchAll(/\{\{([A-Z][A-Z0-9_]*?)_(\d+)(?:\.[A-Z0-9_]+)?\}\}/g)) f.tags[`${t[1]}_${t[2]}`] = (f.tags[`${t[1]}_${t[2]}`] || 0) + 1;
    }
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
