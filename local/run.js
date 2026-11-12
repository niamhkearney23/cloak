// Cloaks a whole folder. Originals are only ever opened for reading; cloaked
// copies go to a new folder as plain text.
//
// Two passes, so a short form in one file ("Mr Tan") gets the tag of the full
// name that only appears in another ("Tan Boon Huat"):
//   pass 1  read every file (in parallel) and learn what is in the folder
//   pass 2  write a cloaked copy of each file with the shared name map

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Matter } from './engine.js';
import { VERSION } from './version.js';

const SYSTEM_FILE = /^(?:~\$.*|\..*|Thumbs\.db|desktop\.ini|.*\.tmp|.*\.lnk)$/i;
const TAG = /\{\{([A-Z][A-Z0-9_]*?)_(\d+)(?:\.[A-Z0-9_]+)?(?:\|[A-Z]+)?\}\}/g;

async function walk(dir, skip, out = []) {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (path.resolve(full) === skip) continue;
    if (entry.isDirectory()) await walk(full, skip, out);
    else if (entry.isFile()) out.push(full);
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
      w.postMessage({ id: job.id, file: job.file });
    }
  };
  for (const w of workers) {
    w.on('message', (msg) => {
      const job = waiting.get(msg.id);
      waiting.delete(msg.id);
      idle.push(w);
      job.resolve({ ...msg.result, ms: msg.ms });
      next();
    });
    w.on('error', (err) => {
      // A crashed reader must not lose a file: it is reported as unreadable.
      for (const [id, job] of waiting) if (job.w === w) { waiting.delete(id); job.resolve({ status: 'unreadable', type: 'unknown', parts: [], reasons: [`The file could not be opened (${err.message}).`], notes: [], pages: 0, ocrPages: [], ocrImages: 0, ms: 0 }); }
    });
  }
  return {
    run: (file) => new Promise((resolve) => { queue.push({ id: ++seq, file, resolve }); next(); }),
    close: () => Promise.all(workers.map((w) => new Promise((resolve) => { w.once('exit', resolve); w.postMessage({ type: 'close' }); }))),
  };
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/**
 * @param folder      the folder to cloak (read only)
 * @param outDir      where cloaked copies go (must be outside `folder`, or a
 *                    sub-folder that is then left out of the run)
 * @param options     { dates, amounts, provisions } - all off by default
 * @param onProgress  called with { file, index, total, stage, ocr } per file
 * @param onCloudOnly called with the list of not-yet-downloaded files; return
 *                    true to download and include them
 */
export async function cloakFolder({ folder, outDir, options = {}, user = os.userInfo().username, onProgress = () => {}, onCloudOnly = async () => false, logFile, matter = new Matter({ options }), concurrency }) {
  const started = Date.now();
  folder = path.resolve(folder);
  outDir = path.resolve(outDir);
  if (outDir === folder) throw new Error('The cloaked copies must go to a different folder from the originals.');
  const all = await walk(folder, outDir);

  const files = all.map((full, i) => ({ index: i + 1, full, rel: path.relative(folder, full), status: 'waiting', reasons: [], notes: [], ocrPages: [], ocrImages: 0, pages: 0 }));
  const total = files.length;
  const tell = (f, stage) => onProgress({ index: f.index, total, file: f.rel, stage, ocr: f.ocrPages.length > 0 || f.ocrImages > 0, status: f.status });

  // Files still in the cloud: ask before anything is downloaded.
  const cloud = [];
  for (const f of files) {
    if (SYSTEM_FILE.test(path.basename(f.full))) { f.status = 'ignored'; f.reasons.push('System or temporary file.'); continue; }
    if (await isCloudOnly(f.full)) cloud.push(f);
  }
  if (cloud.length && !(await onCloudOnly(cloud.map((f) => f.rel)))) {
    for (const f of cloud) { f.status = 'unreadable'; f.reasons.push('Not downloaded from the cloud yet. Download it (or allow Cloak to) and run again.'); }
  }

  // Pass 1: read in parallel.
  const todo = files.filter((f) => f.status === 'waiting');
  const size = Math.max(1, Math.min(concurrency || os.availableParallelism() - 1, 6, todo.length));
  const readers = todo.length ? pool(size) : null;
  await Promise.all(todo.map(async (f) => {
    tell(f, 'reading');
    const r = await readers.run(f.full);
    Object.assign(f, { type: r.type, parts: r.parts, pages: r.pages, ocrPages: r.ocrPages, ocrImages: r.ocrImages, readMs: r.ms });
    f.status = r.status === 'ok' ? 'read' : r.status;
    f.reasons.push(...r.reasons);
    f.notes.push(...r.notes);
    tell(f, 'read');
  }));
  if (readers) await readers.close();

  // Learn the whole folder before cloaking any of it. File and folder names
  // are part of what is learned and cloaked ("Affidavit_Ahmad_bin_Ismail").
  const readable = files.filter((f) => f.parts?.length);
  const nameText = (f) => f.rel.replace(/\.[^.\\/]+$/, '').replace(/[_\\/]+/g, ' ');
  const whole = (f) => [nameText(f), ...f.parts.map((p) => p.text)].join('\n\n');
  const candidates = [];
  for (const f of readable) candidates.push(...matter.learn(whole(f)));
  matter.register(candidates);
  for (const f of readable) matter.learnDefinitions(whole(f));

  // Pass 2: write the cloaked copies.
  await mkdir(outDir, { recursive: true });
  const width = String(total).length;
  for (const f of readable) {
    const plainLabel = (p) => f.parts.length === 1 && !p.ocr && /^(?:Text|Body|Email|Page 1)$/.test(p.label);
    const body = f.parts.map((p) => (plainLabel(p) ? '' : `[${p.label}]\n`) + matter.apply(p.text)).join('\n\n');
    const text = `File: ${matter.apply(nameText(f))}.${f.type}\n\n${body}\n`;
    f.cloaked = text;
    f.unsure = matter.unsure(text);
    f.tags = {};
    for (const m of text.matchAll(TAG)) f.tags[`${m[1]}_${m[2]}`] = (f.tags[`${m[1]}_${m[2]}`] || 0) + 1;
    // A file that needs a manual check is never written out as if it were
    // clean. Its cloaked text stays in memory for the review screen only.
    if (f.status === 'read') {
      f.out = `${String(f.index).padStart(width, '0')}-${f.type}.cloaked.txt`;
      await writeFile(path.join(outDir, f.out), text, 'utf8');
      f.status = 'cloaked';
    }
    tell(f, 'cloaked');
  }

  const seconds = (Date.now() - started) / 1000;
  const byType = {};
  for (const f of readable) for (const [tag, n] of Object.entries(f.tags)) { const t = tag.replace(/_\d+$/, ''); byType[t] = (byType[t] || 0) + n; }
  const report = {
    cloak_version: VERSION,
    when: new Date().toISOString(),
    by: user,
    options: matter.options,
    seconds,
    review: 'NOT REVIEWED. These copies have not been through the review screen or the double checker.',
    totals: { files: total, cloaked: files.filter((f) => f.status === 'cloaked').length, needs_manual_check: files.filter((f) => f.status === 'manual').length, unreadable: files.filter((f) => f.status === 'unreadable').length, ignored: files.filter((f) => f.status === 'ignored').length, ocr_files: files.filter((f) => f.ocrPages.length || f.ocrImages).length, replaced: byType },
    // Real file names can contain client names, so files are listed by
    // their cloaked name only.
    files: files.map((f) => ({ output: f.out || null, name: f.parts?.length ? `${matter.apply(nameText(f))}.${f.type}` : `(file ${f.index}, not read)`, status: f.status, type: f.type || path.extname(f.full).slice(1).toLowerCase(), pages: f.pages, ocr_pages: f.ocrPages, ocr_pictures: f.ocrImages, reasons: f.reasons, notes: f.notes, tags: f.tags || {}, not_sure_count: f.unsure?.length || 0 })),
  };
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
