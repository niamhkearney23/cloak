// Where a folder lives: an ordinary folder, or inside a synced location
// (iManage Drive, OneDrive, Google Drive).
//
// Rules that follow from it:
//   - A synced folder is a READ-ONLY source. Cloak never creates, renames,
//     moves or changes anything in it.
//   - The matter folder, the key, the cache and the cloaked copies are never
//     saved inside a synced location: the sync app would upload them (and for
//     the key, that is exactly what must never happen).
//   - Files that are only stubs (not downloaded yet) are listed and never
//     opened without asking, because opening one makes the sync app download it.
//
// What this module can and cannot know, plainly:
//   - It recognises a synced location from the NAMES in its path (a folder
//     called "OneDrive - Firm", "GoogleDrive-name", "My Drive", "iManage Drive"),
//     from the OneDrive folders the system reports, and, on Windows, from the
//     drive's volume label. It has been tested on made-up paths only.
//   - It has NOT been tested against a real iManage Drive, OneDrive or Google
//     Drive. If a folder is not recognised, the person can say so in the app
//     ("This folder is on iManage Drive") and it is then treated the same way.

import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const KINDS = {
  imanage: 'iManage Drive',
  onedrive: 'OneDrive',
  googledrive: 'Google Drive',
};

// A path component that marks the root of a synced location.
const COMPONENT_RULES = [
  ['imanage', /imanage/i],
  ['onedrive', /^onedrive(?:\s*-\s*.+|-.+)?$/i],
  ['googledrive', /^(?:google\s*drive|googledrive(?:-.+)?|my drive|shared drives)$/i],
];
// A drive's volume label (Windows), for mapped drives such as "I:".
const LABEL_RULES = [['imanage', /imanage/i], ['googledrive', /google\s*drive/i], ['onedrive', /onedrive/i]];

const styleOf = (platform) => (platform === 'win32' ? path.win32 : path.posix);
const same = (a, b, platform) => (platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);

/** Is `child` the same as, or inside, `parent`? */
export function isInside(child, parent, platform = process.platform) {
  const P = styleOf(platform);
  const rel = P.relative(P.resolve(parent), P.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !P.isAbsolute(rel));
}

/** The volume label of a Windows drive ("iManage Drive"), or '' if unknown. */
export function windowsVolumeLabel(root) {
  return new Promise((resolve) => {
    execFile('cmd.exe', ['/c', 'vol', root.replace(/[\\/]+$/, '')], { windowsHide: true, timeout: 4000 }, (err, out) => {
      if (err) return resolve('');
      const m = /Volume in drive \w is (.+)/i.exec(String(out));
      resolve(m ? m[1].trim() : '');
    });
  });
}

/**
 * Work out whether a path is inside a synced location.
 * Returns null for an ordinary folder, otherwise
 * { kind, label, root, relative, how } where `root` is the top of the synced
 * location and `relative` is the path inside it (for iManage Drive, the
 * workspace path).
 */
export async function locate(target, { platform = process.platform, env = process.env, volumeLabel = windowsVolumeLabel, manual = null, resolveLinks = true } = {}) {
  const P = styleOf(platform);
  let full = P.resolve(target);
  if (resolveLinks) {
    // A shortcut or symbolic link must not hide where a folder really is.
    try { full = await realpath(full); } catch { /* does not exist yet */ }
  }
  const parsed = P.parse(full);
  const parts = full.slice(parsed.root.length).split(P.sep).filter(Boolean);
  const result = (kind, rootParts, how, root) => {
    const rootPath = root ?? P.join(parsed.root, ...rootParts);
    return { kind, label: KINDS[kind], root: rootPath, relative: P.relative(rootPath, full).split(P.sep).filter(Boolean).join('/'), how };
  };

  // 1. The person said so.
  if (manual && KINDS[manual]) {
    const root = platform === 'win32' ? parsed.root : (parts[0] === 'Volumes' && parts[1] ? P.join(parsed.root, 'Volumes', parts[1]) : full);
    return result(manual, [], 'marked by the person', root);
  }
  // 2. A folder the system reports as OneDrive.
  for (const key of ['OneDrive', 'OneDriveCommercial', 'OneDriveConsumer']) {
    const v = env[key];
    if (v && isInside(full, v, platform)) return result('onedrive', [], `the system's ${key} folder`, P.resolve(v));
  }
  // 3. A telling name in the path.
  for (let i = 0; i < parts.length; i++) {
    for (const [kind, re] of COMPONENT_RULES) if (re.test(parts[i])) return result(kind, parts.slice(0, i + 1), `a folder named "${parts[i]}"`);
  }
  // 4. A mapped drive whose label gives it away (Windows).
  if (platform === 'win32' && /^[A-Za-z]:\\$/.test(parsed.root)) {
    const label = await volumeLabel(parsed.root);
    for (const [kind, re] of LABEL_RULES) if (label && re.test(label)) return result(kind, [], `the drive is labelled "${label}"`, parsed.root);
  }
  return null;
}

export const syncMessage = (where, what, loc) => `${what} is inside ${loc.label} (${loc.root}). Cloak will not save the matter folder, key, cache or cloaked copies in a synced folder, because the sync app would upload them. Choose a folder outside ${loc.label}, on this computer or a normal network drive.`;

/**
 * Refuse a place to save things if it is inside any synced location, or
 * inside the synced location the source folder came from.
 */
export async function assertNotSynced(target, what, { source = null, ...options } = {}) {
  const here = await locate(target, options);
  if (here) throw Object.assign(new Error(syncMessage(here, what, here)), { code: 'SYNC_LOCATION', location: here });
  if (source && isInside(target, source.root, options.platform || process.platform)) {
    throw Object.assign(new Error(syncMessage(source, what, source)), { code: 'SYNC_LOCATION', location: source });
  }
}

// ------------------------------------------------------------------ stubs

const WIN_STUB = 0x1000 | 0x40000 | 0x400000; // OFFLINE | RECALL_ON_OPEN | RECALL_ON_DATA_ACCESS
const MAC_DATALESS = 0x40000000; // SF_DATALESS

/** Lines of "<attribute number>|<full path>" from PowerShell -> the stub paths. */
export function parseWindowsListing(text) {
  const stubs = [];
  for (const line of String(text).split(/\r?\n/)) {
    const i = line.indexOf('|');
    if (i < 1) continue;
    const attrs = Number(line.slice(0, i));
    if (Number.isFinite(attrs) && (attrs & WIN_STUB) !== 0) stubs.push(line.slice(i + 1));
  }
  return stubs;
}
/** Lines of "<flags>|<path>" from macOS stat -> the stub paths. */
export function parseMacListing(text) {
  const stubs = [];
  for (const line of String(text).split('\n')) {
    const i = line.indexOf('|');
    if (i < 1) continue;
    const flags = Number(line.slice(0, i));
    if (Number.isFinite(flags) && (flags & MAC_DATALESS) !== 0) stubs.push(line.slice(i + 1));
  }
  return stubs;
}

const run = (cmd, args, options = {}) => new Promise((resolve, reject) => execFile(cmd, args, { maxBuffer: 256 * 1024 * 1024, windowsHide: true, timeout: 120000, ...options }, (err, out) => (err ? reject(err) : resolve(String(out)))));

/**
 * Which of these files are stubs: listed in the folder but not downloaded to
 * this computer. Looking at them does not download them; opening them does.
 * `detect` can be replaced (tests do).
 */
export async function findStubs(folder, files, { platform = process.platform, detect = null } = {}) {
  if (detect) return new Set(await detect(folder, files));
  const stubs = new Set();
  try {
    if (platform === 'win32') {
      const quoted = folder.replace(/'/g, "''");
      const script = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-ChildItem -LiteralPath '${quoted}' -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object { '{0}|{1}' -f [int]$_.Attributes, $_.FullName }`;
      for (const f of parseWindowsListing(await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]))) stubs.add(path.win32.normalize(f).toLowerCase());
      return new Set(files.filter((f) => stubs.has(path.win32.normalize(f).toLowerCase())));
    }
    if (platform === 'darwin') {
      for (const f of parseMacListing(await run('find', [folder, '-type', 'f', '-exec', 'stat', '-f', '%f|%N', '{}', '+']))) stubs.add(f);
      return new Set(files.filter((f) => stubs.has(f)));
    }
  } catch {
    // The listing failed: fall back to looking at each file's size on disk.
  }
  for (const f of files) {
    const s = await stat(f).catch(() => null);
    // A file with a size but nothing stored for it (blocks = 0) is a stub or sparse.
    if (s && s.size > 0 && s.blocks === 0) stubs.add(f);
  }
  return stubs;
}

export { same as _same, os as _os };
