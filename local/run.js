// Cloaks a whole folder. Originals are only ever opened for reading; cloaked
// copies go to a new folder as plain text rebuilt from what was read.
//
// Every file is read, including hidden files, files in sub-folders, files
// inside zip archives and files attached to emails or embedded in documents.
// A file is exported only if every part of it was read. Anything else is
// listed with the reason and blocked.
//
// Two passes, so a short form in one file ("Mr Tan") gets the tag of the full
// name that only appears in another ("Tan Boon Huat"):
//   pass 1  read every file (in parallel) and learn what is in the folder
//   pass 2  write a cloaked copy of each fully read file with the shared map

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Matter } from './engine.js';
import { VERSION } from './version.js';

const TAG = /\{\{([A-Z][A-Z0-9_]*?)_(\d+)(?:\.[A-Z0-9_]+)?(?:\|[A-Z]+)?\}\}/g;

async function walk(dir, skip, out = []) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (path.resolve(full) === skip) continue;
    if (entry.isDirectory()) await walk(full, skip, out);
    else out.push(full); // every file, hidden ones included
  }
  return out;
}

/**
 * True for a file that sits in a synced cloud folder (OneDrive, Google Drive)
 * but has not been downloaded to this computer yet. Opening such a file makes
 * the sync app download it, so the user is asked first.
 * Windows: the "offline" attribute. Mac: a file with a size but no blocks.
 */
export async function isCloudOnly(file) {
  const s = await stat(file);
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      execFile('attrib', [file], { windowsHide: true }, (err, out) => resolve(!err && /^[A-Z ]*O[A-Z ]*\s/.test(String(out).slice(0, 20))));
    });
  }
  return s.size > 0 && s.blocks === 0;
}

function pool(size) {
  const workers = Array.from({ length: size }, () => new Worker(new URL('./extract-worker.js', import.meta.url)));
  const waiting = new Map();
  const idle = [...workers];
  const queue = [];
  let seq = 0;
  const next = () => {
    while (idle.length && queue.length) {
      const w = idle.pop();
      const job = queue.shift();
      waiting.set(job.id, { ...job, w });
      w.postMessage({ id: job.id, file: job.file, rel: job.rel });
    }
  };
  const failed = (rel, message) => [{ status: 'unreadable', type: 'unknown', parts: [], reasons: [`The file could not be opened (${message}).`], notes: [], rel, inside: null, proof: { unit: 'parts', found: 0, read: 0, characters: 0, ocr: [], unread: [] } }];
  for (const w of workers) {
    w.on('message', (msg) => {
      const job = waiting.get(msg.id);
      waiting.delete(msg.id);
      idle.push(w);
      job.resolve({ results: msg.results, ms: msg.ms });
      next();
    });
    // A crashed reader must not lose a file: it is reported as unreadable.
    w.on('error', (err) => {
      for (const [id, job] of waiting) if (job.w === w) { waiting.delete(id); job.resolve({ results: failed(job.rel, err.message), ms: 0 }); }
    });
  }
  return {
    run: (file, rel) => new Promise((resolve) => { queue.push({ id: ++seq, file, rel, resolve }); next(); }),
    close: () => Promise.all(workers.map((w) => new Promise((resolve) => { w.once('exit', resolve); w.postMessage({ type: 'close' }); }))),
  };
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

const STATUS_WORDS = { cloaked: 'cloaked', manual: 'needs manual check', partial: 'partly read - blocked', unreadable: 'unreadable - blocked', container: 'opened (its files are listed separately)' };

/**
 * @param folder      the folder to cloak (read only)
 * @param outDir      where cloaked copies go (must be outside `folder`, or a
 *                    sub-folder that is then left out of the run)
 * @param options     { dates, amounts, provisions } - all off by default
 * @param onProgress  called with { file, index, total, stage, ocr } per file
 * @param onCloudOnly called with the list of not-yet-downloaded files; return
 *                    true to download and include them
 */
export async function cloakFolder({ folder, outDir, options = {}, user = os.userInfo().username, onProgress = () => {}, onCloudOnly = async () => false, logFile, matter = new Matter({ options }), session = null, concurrency }) {
  const started = Date.now();
  folder = path.resolve(folder);
  outDir = path.resolve(outDir);
  if (outDir === folder) throw new Error('The cloaked copies must go to a different folder from the originals.');
  const onDisk = (await walk(folder, outDir)).map((full, i) => ({ index: i + 1, full, rel: path.relative(folder, full).split(path.sep).join('/') }));
  const total = onDisk.length;
  const tell = (f, stage, extra = {}) => onProgress({ index: f.index, total, file: f.rel, stage, ...extra });

  // Files still in the cloud: ask before anything is downloaded.
  const cloud = [];
  for (const f of onDisk) if (await isCloudOnly(f.full)) cloud.push(f);
  const refused = new Set(cloud.length && !(await onCloudOnly(cloud.map((f) => f.rel))) ? cloud : []);

  // Pass 1: read in parallel. One file on disk can turn into several files
  // (a zip, an email with attachments).
  const todo = onDisk.filter((f) => !refused.has(f));
  const size = Math.max(1, Math.min(concurrency || os.availableParallelism() - 1, 6, todo.length));
  const readers = todo.length ? pool(size) : null;
  const trees = new Map();
  for (const f of refused) trees.set(f, [{ status: 'unreadable', type: path.extname(f.full).slice(1), parts: [], reasons: ['Not downloaded from the cloud yet. Download it (or allow Cloak to) and run again.'], notes: [], rel: f.rel, inside: null, proof: { unit: 'parts', found: 0, read: 0, characters: 0, ocr: [], unread: [] } }]);
  await Promise.all(todo.map(async (f) => {
    tell(f, 'reading');
    // With a matter open, an unchanged file is taken from the encrypted
    // cache instead of being read (and put through OCR) again.
    let results = null;
    let ms = 0;
    if (session) {
      f.hash = sha256(await readFile(f.full).catch(() => Buffer.alloc(0)));
      results = await session.cache.get(f.hash);
      if (results) { f.fromCache = true; results.forEach((r) => { r.rel = f.rel + r.rel.slice(results[0].rel.length); }); }
    }
    if (!results) {
      ({ results, ms } = await readers.run(f.full, f.rel));
      if (session && f.hash) await session.cache.put(f.hash, results);
    }
    results[0].readMs = ms;
    trees.set(f, results);
    tell(f, 'read', { ocr: results.some((r) => r.proof.ocr.length > 0), status: results[0].status });
  }));
  if (readers) await readers.close();

  const files = onDisk.flatMap((f) => trees.get(f).map((r) => ({ ...r, disk: f })));
  files.forEach((f, i) => {
    f.index = i + 1;
    f.ocrPages = f.proof.ocr;
    // A stable fingerprint: the file's contents, plus where it sits inside
    // its parent for attachments and zip entries.
    if (f.disk.hash) f.fingerprint = sha256(`${f.disk.hash}|${f.rel.slice(f.disk.rel.length)}`);
  });

  // Learn the whole folder before cloaking any of it. File and folder names
  // are part of what is learned and cloaked ("Affidavit_Ahmad_bin_Ismail").
  const readable = files.filter((f) => f.parts.length);
  const nameText = (f) => f.rel.replace(/\.[A-Za-z0-9]{1,5}(?=\/|$)/g, '').replace(/[_/\\]+/g, ' ');
  const whole = (f) => [nameText(f), ...f.parts.map((p) => p.text)].join('\n\n');
  const candidates = [];
  for (const f of readable) candidates.push(...matter.learn(whole(f)));
  for (const f of files) if (!f.parts.length) candidates.push(...matter.learn(nameText(f)));
  matter.register(candidates);
  for (const f of readable) matter.learnDefinitions(whole(f));

  // Pass 2: write the cloaked copies.
  await mkdir(outDir, { recursive: true });
  const width = String(files.length).length;
  for (const f of files) {
    f.name = matter.apply(nameText(f));
    if (f.container) f.status = f.status === 'ok' ? 'container' : f.status;
    if (!f.parts.length) continue;
    const plainLabel = (p) => f.parts.length === 1 && !p.ocr && /^(?:Text|Body|Email|Page 1)$/.test(p.label);
    // Labels can carry names too (a sheet called after a client).
    const body = f.parts.map((p) => (plainLabel(p) ? '' : `[${matter.apply(p.label)}]\n`) + matter.apply(p.text)).join('\n\n');
    const text = `File: ${f.name}.${f.type}\n\n${body}\n`;
    f.cloaked = text;
    f.unsure = matter.unsure(text);
    f.tags = {};
    for (const m of text.matchAll(TAG)) f.tags[`${m[1]}_${m[2]}`] = (f.tags[`${m[1]}_${m[2]}`] || 0) + 1;
    // Only a fully read file is written out. Anything partly read, or
    // waiting for a manual check, stays in memory for the review screen.
    if (f.status === 'ok') {
      // In a matter a file keeps its number from run to run.
      f.out = session && f.fingerprint ? `${String(session.numberFor(f.fingerprint)).padStart(3, '0')}-${f.type}.cloaked.txt` : `${String(f.index).padStart(width, '0')}-${f.type}.cloaked.txt`;
      await writeFile(path.join(outDir, f.out), text, 'utf8');
      f.status = 'cloaked';
    }
    if (!f.inside) tell(f.disk, 'cloaked', { ocr: f.proof.ocr.length > 0, status: f.status });
  }

  const seconds = (Date.now() - started) / 1000;
  const count = (s) => files.filter((f) => f.status === s).length;
  const byType = {};
  for (const f of files) for (const [tag, n] of Object.entries(f.tags || {})) { const t = tag.replace(/_\d+$/, ''); byType[t] = (byType[t] || 0) + n; }
  const report = {
    cloak_version: VERSION,
    when: new Date().toISOString(),
    by: user,
    options: matter.options,
    seconds,
    review: 'NOT REVIEWED. These copies have not been through the review screen or the double checker.',
    totals: { files_on_disk: total, files_including_those_inside_others: files.length, cloaked: count('cloaked'), needs_manual_check: count('manual'), partly_read_blocked: count('partial'), unreadable_blocked: count('unreadable'), archives_opened: count('container'), ocr_files: files.filter((f) => f.proof.ocr.length).length, taken_from_cache: onDisk.filter((f) => f.fromCache).length, replaced: byType },
    // Real file names can contain client names, so files are listed by
    // their cloaked name only. "proof" shows what was found and what was read.
    files: files.map((f) => ({
      number: f.index,
      output: f.out || null,
      name: f.parts.length || f.container ? `${f.name}.${f.type}` : `(file ${f.index}: name not shown because the file was not read)`,
      found_inside: f.inside,
      status: STATUS_WORDS[f.status],
      taken_from_cache: !!f.disk.fromCache,
      type: f.type,
      proof: { [`${f.proof.unit}_found`]: f.proof.found, [`${f.proof.unit}_read`]: f.proof.read, characters_extracted: f.proof.characters, went_through_ocr: f.proof.ocr, could_not_be_read: f.proof.unread, parts_read: (f.proof.parts || []).map((p) => `${matter.apply(p.part)}: ${p.characters} characters`) },
      reasons: f.reasons,
      tags: f.tags || {},
      not_sure_count: f.unsure?.length || 0,
    })),
  };
  // Reasons can quote the name of an attachment: cloak them like any text.
  // In the report the name itself is left out, since it may not be cloaked.
  const safe = (r) => matter.apply(r.replace(/"[^"]*"/g, '(a file inside it)').replace(/: [^:]*\.$/, (m) => (/could not be read: /.test(r) ? ': (part name hidden).' : m)));
  for (const f of report.files) {
    f.reasons = f.reasons.map(safe);
    f.proof.could_not_be_read = f.proof.could_not_be_read.map(safe);
  }
  await writeFile(path.join(outDir, 'cloak-report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(path.join(outDir, 'NOT-REVIEWED.txt'), `Cloak ${VERSION}\n\nThese cloaked copies have NOT been reviewed or double-checked.\nDo not send them to any AI tool yet.\n`, 'utf8');

  // The log says what was done, when and by whom. No real values, and the
  // folder is recorded as a fingerprint, not a path.
  if (logFile) {
    await mkdir(path.dirname(logFile), { recursive: true });
    await appendFile(logFile, `${JSON.stringify({ t: report.when, cloak_version: VERSION, by: user, action: 'cloak-folder', folder: sha256(folder).slice(0, 16), ...report.totals, seconds })}\n`, 'utf8');
  }

  return { matter, files, report, seconds, outDir };
}

export { sha256 };
