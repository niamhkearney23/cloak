// "Save a support file": a zip the person can send to their supplier
// themselves. Cloak never sends it anywhere and makes no network connection.
//
// What is in it:
//   README.txt          what the file is and what is in it, in plain words
//   support-info.json   the Cloak version, the operating system, the self-test
//                       result, and counts about the open matter (no name, no path)
//   matter-log.jsonl    the open matter's log: who did what and when, with
//                       counts. The log never holds real values.
//
// A second guard: before anything is written, every value the open matter's
// key holds is looked for in the support file, and any that is found is
// replaced by its tag. The README says how many were replaced (normally none).

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { writeZip } from './zip.js';
import { checkKeyFile, KEY_FILE_NAME } from './keyfile.js';
import { closeOcr, ocrImage } from './extract.js';
import { VERSION } from './version.js';
import { formatDate } from './dates.js';

const require = createRequire(import.meta.url);

// Shown on the About screen and in the support file. To be filled in before release.
export const SUPPORT_CONTACT = '[support contact to be added before release]';

// ------------------------------------------------------------- self-test

/** A small picture with known words, for the OCR check. Made in memory. */
function testPicture(text) {
  const { createCanvas } = require('@napi-rs/canvas');
  const c = createCanvas(1000, 220);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 1000, 220);
  g.fillStyle = '#000';
  g.font = '56px sans-serif';
  g.fillText(text, 40, 130);
  return c.toBuffer('image/png');
}

/** Error messages can carry file paths, and paths often carry client names: they are left out. */
const noPaths = (message, dir) => String(message || '')
  .split(dir || '\u0000').join('(the matter folder)')
  .replace(/'[^']*[\\/][^']*'/g, '(path not shown)')
  .replace(/(?:[A-Za-z]:\\|\\\\|\/)[^\s'"]*[\\/][^\s'"]*/g, '(path not shown)');

/**
 * Does the OCR engine start, and does the open matter's key open?
 * Each result: { check, ok (true, false, or null when not run), what }.
 */
export async function selfTest({ session = null, ocr = ocrImage, stopOcr = closeOcr } = {}) {
  const results = [];
  const started = Date.now();
  try {
    const r = await ocr(testPicture('CLOAK SELF TEST 2468'));
    const ok = /SELF\s*TEST/i.test(r.text) && /2468/.test(r.text);
    results.push({ check: 'OCR engine', ok, what: ok ? `It started and read the test picture correctly (confidence ${Math.round(r.confidence)}%, ${((Date.now() - started) / 1000).toFixed(1)} seconds).` : `It started but misread the test picture (it read "${String(r.text).trim().slice(0, 60)}"). Scanned pages may not be read well on this computer.` });
  } catch (err) {
    results.push({ check: 'OCR engine', ok: false, what: `It did not start: ${noPaths(err.message)}. Scanned pages and pictures cannot be read until this is fixed.` });
  } finally {
    await stopOcr().catch(() => {});
  }
  if (!session) {
    results.push({ check: 'Matter key', ok: null, what: 'Not checked: no matter was open. Open the matter first if the problem is with one matter.' });
    return results;
  }
  const keyFile = path.join(session.dir, KEY_FILE_NAME);
  try {
    const k = await checkKeyFile(keyFile, session.dataKey);
    results.push({ check: 'Matter key', ok: true, what: `It opened with this matter's key (${k.tags} tags; last saved by Cloak ${k.savedWith}).` });
  } catch (err) {
    results.push({ check: 'Matter key', ok: false, what: noPaths(err.message, session.dir) });
  }
  try {
    const b = await checkKeyFile(`${keyFile}.bak`, session.dataKey);
    results.push({ check: 'Backup of the matter key', ok: true, what: `matter.cloakkey.bak opened too (${b.tags} tags).` });
  } catch (err) {
    const none = /no matter key/i.test(err.message);
    results.push({ check: 'Backup of the matter key', ok: none ? null : false, what: none ? 'There is no backup yet: Cloak makes one the next time it saves the matter.' : noPaths(err.message, session.dir) });
  }
  return results;
}

// ------------------------------------------------------------- redaction

// Words and single punctuation marks. Spaces are skipped, so "Kemas  Jaya" matches "Kemas Jaya".
const TOKEN = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]/gu;
const tokens = (s) => [...String(s).matchAll(TOKEN)].map((m) => ({ t: m[0].toLowerCase(), i: m.index, end: m.index + m[0].length }));
// Honours and words that are part of many names: a key value that is only one of these is not looked for.
const TITLE_WORDS = new Set(['tan sri', 'dato', 'datuk', 'datin', 'tun', 'haji', 'hajah', 'encik', 'puan', 'cik', 'bin', 'binti', 'anak', 'mr', 'mrs', 'ms', 'dr', 'sri', 'seri']);

/**
 * The values to look for: every value in the matter's key (names, numbers,
 * addresses, dates, amounts, non-Latin passages), except honours, and numbers
 * of fewer than six digits with no letters (years and small numbers, which
 * would otherwise blank out the log's own times and counts).
 */
export function keyValues(matter) {
  const out = [];
  for (const e of matter?.cloak?.entries || []) {
    const value = String(e.value || '').trim();
    if (value.length < 3 || TITLE_WORDS.has(value.toLowerCase())) continue;
    if (!/\p{L}/u.test(value) && (value.match(/\p{N}/gu) || []).length < 6) continue;
    out.push({ value, token: e.token });
  }
  return out;
}

/** Replace every whole-word occurrence of a value (any letter case) with its tag. */
export function redactText(text, values) {
  if (!text || !values.length) return { text: String(text ?? ''), count: 0 };
  const byFirst = new Map();
  for (const v of values) {
    const tk = tokens(v.value).map((x) => x.t);
    if (!tk.length) continue;
    if (!byFirst.has(tk[0])) byFirst.set(tk[0], []);
    byFirst.get(tk[0]).push({ tk, token: v.token });
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.tk.length - a.tk.length);
  const toks = tokens(text);
  let out = '';
  let at = 0;
  let count = 0;
  for (let a = 0; a < toks.length; a++) {
    const list = byFirst.get(toks[a].t);
    if (!list) continue;
    const hit = list.find((c) => a + c.tk.length <= toks.length && c.tk.every((t, k) => toks[a + k].t === t));
    if (!hit) continue;
    out += `${text.slice(at, toks[a].i)}{{${hit.token}}}`;
    at = toks[a + hit.tk.length - 1].end;
    a += hit.tk.length - 1;
    count++;
  }
  return { text: out + text.slice(at), count };
}

/** The same for a JSON value: every string in it, at any depth. */
function redactJson(value, values, tally) {
  if (typeof value === 'string') { const r = redactText(value, values); tally.count += r.count; return r.text; }
  if (Array.isArray(value)) return value.map((v) => redactJson(v, values, tally));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [redactJson(k, values, tally), redactJson(v, values, tally)]));
  return value;
}

/** Each line of a log is JSON: its strings are checked one by one; a line that is not JSON is checked as text. */
export function redactLog(text, values) {
  const tally = { count: 0 };
  const lines = String(text || '').split('\n').map((line) => {
    if (!line.trim()) return line;
    try { return JSON.stringify(redactJson(JSON.parse(line), values, tally)); } catch { const r = redactText(line, values); tally.count += r.count; return r.text; }
  });
  return { text: lines.join('\n'), count: tally.count };
}

// ---------------------------------------------------------- the zip file

/** The computer and the app. No user names, computer names or paths. */
export function systemInfo(extra = {}) {
  const cpus = os.cpus();
  return {
    platform: process.platform,
    operating_system: `${os.type()} ${os.release()}`,
    operating_system_version: typeof os.version === 'function' ? os.version() : '',
    architecture: process.arch,
    processors: cpus.length,
    processor: cpus[0]?.model || '',
    memory_gb: Math.round(os.totalmem() / 1024 ** 3),
    node: process.versions.node,
    electron: process.versions.electron || null,
    chrome: process.versions.chrome || null,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...extra,
  };
}

/** Counts about the open matter. Its name and folder are left out: both often hold the client's name. */
function matterSummary(s) {
  return {
    matter_id: s.matterId,
    level: s.matter.options.level,
    test_matter: !!s.testMatter,
    opened_with: s.openedWith === 'recovery' ? 'recovery code' : 'password',
    files_known: Object.keys(s.files || {}).length,
    tags_in_key: s.matter.cloak.entries.length,
    review_finished: !!s.review?.complete,
    chronology_built: !!s.chronology,
  };
}

const readme = ({ made, session, test, replaced }) => `Cloak support file
==================

Made on ${made} by Cloak ${VERSION}.

Cloak did not send this file anywhere. It is saved only where you chose.
Look at it before you send it to anyone. To send it, attach it to an email yourself.
Support: ${SUPPORT_CONTACT}

What is in it
- support-info.json: the Cloak version, the operating system, the self-test
  result below, and counts about the open matter. No matter name, no folder
  paths, no client details.
${session ? `- matter-log.jsonl: the open matter's log. It records who did what and when,
  with counts. It never holds names, numbers or text from the documents. It
  does name the people who worked on the matter in Cloak (their full name and
  computer login), with the times.
` : '- No matter was open, so no matter log is included.\n'}
As a second guard, every value in the open matter's key was looked for in this
file and replaced by its tag (such as {{PERSON_1}}) wherever it was found.
Values replaced: ${replaced}.

What is not in it
- No documents, no cloaked copies, no restored drafts, no matter key, no cache.
- No password and no recovery code.

Self-test
${test.map((t) => `- ${t.check}: ${t.ok === true ? 'passed' : t.ok === false ? 'FAILED' : 'not run'}. ${t.what}`).join('\n')}
`;

/**
 * Build the support file. Returns the zip as a Buffer, the names of the files
 * in it, and how many values were replaced by tags.
 */
export async function supportFile({ session = null, test = [], system = systemInfo(), now = new Date() } = {}) {
  const values = session ? keyValues(session.matter) : [];
  const made = formatDate(now);
  let replaced = 0;
  const files = {};
  if (session) {
    const log = redactLog(await readFile(path.join(session.dir, 'log.jsonl'), 'utf8').catch(() => ''), values);
    files['matter-log.jsonl'] = log.text;
    replaced += log.count;
  }
  const tally = { count: 0 };
  const info = redactJson({ made, cloak_version: VERSION, system, self_test: test, matter: session ? matterSummary(session) : null }, values, tally);
  replaced += tally.count;
  files['support-info.json'] = `${JSON.stringify({ ...info, values_replaced_by_tags: replaced }, null, 2)}\n`;
  // The README is built from the checked self-test, and checked once more as a whole.
  const text = redactText(readme({ made, session, test: info.self_test, replaced }), values);
  // README first, so it is the first thing a person sees when they open the zip.
  const ordered = { 'README.txt': text.text, ...files };
  return { buffer: writeZip(ordered), names: Object.keys(ordered), replaced: replaced + text.count };
}

/** A file name for the support file: cloak-support-2026-11-15-0919.zip */
export function supportFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `cloak-support-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.zip`;
}
