// Measures the name rules on a made-up matter whose real names and ordinary
// word traps are all marked in its generator (test/heldout/, test/namesdev/).
//
// Each matter is cloaked the way the app does it (a new Strict matter, every
// file read, the whole folder learned, then every file cloaked). Then, for each
// file, what was read is lined up with the cloaked copy word by word, so every
// marked occurrence can be judged on its own:
//
//   hidden    every word of the name is gone from the cloaked copy
//   flagged   a word of it is still there, but it is on the "not sure" list
//             a reviewer must decide (exactly as written, in the same file)
//   partly    some words were hidden, others are still readable and not flagged
//             (the words before or after a hidden name)
//   missed    still readable and not flagged: a silent miss
//
// and every trap as kept, kept but flagged, over-hidden (replaced by a name
// tag) or blurred as a fact (a date or other Strict tag, not a name rule).
// Anything else hidden as a person or company where no real name is marked is
// listed as other over-hiding.
//
//   node test/names-measure.js namesdev [--setup] [--details] [--json]
//   node test/names-measure.js heldout  [--setup] [--details] [--json]   (only before and after)

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cloakFolder, nameText } from '../run.js';
import { Matter } from '../engine.js';
import { CATEGORIES, matcher } from './names-marks.js';

const TOKENS = /\{\{[^{}]*\}\}|[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;
const NAME_TAG = /\{\{(?:PERSON|COMPANY|TERM)_\d+/;
const TITLE_WORDS = new Set('encik en puan pn cik tuan kak abang abg adik pak mak uncle aunty auntie madam mdm mr mrs ms miss dr ah ibu bu mbak mas hajah haji hj hjh dato datuk datin tan sri seri tun toh yb ybhg ir prof ustaz ustazah cikgu sir dear hi hello salam'.split(' '));
const SKIP_WORD = /^(?:bin|binti|bt\.?|bte\.?|b\.|a\/l|a\/p|s\/o|d\/o|anak|&|and|dan|co\.?|sdn|bhd\.?|pte|ltd\.?|berhad|partners)$/i;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lines up a text with its cloaked copy. Cloaking only replaces spans with
 * tags, so the longest common run of tokens is what stayed. Returns which
 * characters of the source stayed, and each replaced stretch with what
 * replaced it.
 */
export function align(src, out) {
  const a = [...src.matchAll(TOKENS)].map((m) => ({ s: m[0], i: m.index }));
  const b = [...out.matchAll(TOKENS)].map((m) => m[0]);
  let p = 0;
  while (p < a.length && p < b.length && a[p].s === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q].s === b[b.length - 1 - q]) q++;
  const n = a.length - p - q;
  const m = b.length - p - q;
  const W = m + 1;
  const dp = new Uint32Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) dp[i * W + j] = a[p + i].s === b[p + j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
  }
  const pairs = [];
  for (let k = 0; k < p; k++) pairs.push([k, k]);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[p + i].s === b[p + j]) { pairs.push([p + i, p + j]); i++; j++; } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++; else j++;
  }
  for (let k = 0; k < q; k++) pairs.push([a.length - q + k, b.length - q + k]);
  const kept = new Uint8Array(src.length);
  const regions = [];
  let ai = 0;
  let bj = 0;
  for (const [x, y] of [...pairs, [a.length, b.length]]) {
    if (x > ai) {
      const start = a[ai].i;
      const end = x < a.length ? a[x].i : src.length;
      regions.push({ start, end, repl: b.slice(bj, y).join('') });
    }
    if (x < a.length) kept.fill(1, a[x].i, a[x].i + a[x].s.length);
    ai = x + 1;
    bj = y + 1;
  }
  return { kept, regions };
}

/** Rebuilds a file's cloaked copy from its parts, as renderFile does, so each part can be lined up on its own. */
function cloakedPieces(matter, f) {
  const plainLabel = (part) => f.parts.length === 1 && !part.ocr && /^(?:Text|Body|Email|Page 1)$/.test(part.label);
  const outs = f.parts.map((part) => matter.apply(part.text));
  const body = f.parts.map((part, i) => (plainLabel(part) ? '' : `[${matter.apply(part.label)}]\n`) + outs[i]).join('\n\n');
  if (`File: ${f.name}.${f.type}\n\n${body}\n` !== f.cloaked) throw new Error(`Could not rebuild the cloaked copy of ${f.rel}`);
  return [f.name, ...outs];
}

const wordsOf = (text) => [...text.matchAll(/[^\s]+/g)].map((m) => ({ w: m[0].replace(/[,.;:'’"()]+$/u, ''), at: m.index }));

/**
 * Cloaks the matter made by `make(dir)` and judges every marked occurrence.
 * Returns { occurrences, traps, other, files }.
 */
export async function measureMatter(make, { setup = null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-names-measure-'));
  try {
    const docs = path.join(root, 'documents');
    const gen = await make(docs);
    const matter = new Matter({ options: { level: 'strict' } });
    if (setup) matter.setup = setup;
    const run = await cloakFolder({ folder: docs, outDir: path.join(root, 'out'), matter, write: false, user: 'measure' });
    const find = matcher(gen.listed);
    const occurrences = [];
    const traps = [];
    const other = [];
    for (const f of run.files) {
      const g = gen.files.find((x) => x.rel === f.rel);
      if (!g) throw new Error(`The generator does not know ${f.rel}`);
      if (f.status !== 'cloaked') {
        for (const o of g.occ) (o.kind === 'real' ? occurrences : traps).push({ ...o, file: f.rel, result: 'file blocked' });
        continue;
      }
      const src = [nameText(f), ...f.parts.map((part) => part.text)];
      const out = cloakedPieces(matter, f);
      const hits = src.flatMap((text, k) => find(text).map((h) => ({ ...h, k })));
      const seen = hits.map((h) => h.text.toLowerCase()).join(' | ');
      const want = g.occ.map((o) => o.value.toLowerCase()).join(' | ');
      if (seen !== want) throw new Error(`What was read from ${f.rel} does not line up with its marks:\n  read:   ${seen}\n  marked: ${want}`);
      const al = src.map((text, k) => align(text, out[k]));
      const unsure = (f.unsure || []).map((u) => u.text);
      const flaggedWord = (w) => unsure.some((u) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])`, 'u').test(u));
      const context = (h) => src[h.k].slice(Math.max(0, h.at - 30), h.at + h.text.length + 30).replace(/\s+/g, ' ');
      g.occ.forEach((o, idx) => {
        const h = hits[idx];
        const { kept, regions } = al[h.k];
        const keptAt = (start, len) => kept.subarray(start, start + len).some(Boolean);
        if (o.kind === 'trap') {
          const allKept = kept.subarray(h.at, h.at + h.text.length).every(Boolean);
          let result = allKept ? (flaggedWord(h.text) ? 'kept, flagged' : 'kept') : 'over-hidden';
          if (!allKept) {
            const by = regions.filter((r) => r.start < h.at + h.text.length && r.end > h.at).map((r) => r.repl).join(' ');
            if (!NAME_TAG.test(by)) result = 'blurred as a fact';
          }
          traps.push({ ...o, file: f.rel, result, context: context(h) });
          return;
        }
        const words = wordsOf(h.text).filter((x) => x.w && !SKIP_WORD.test(x.w));
        const left = words.filter((x) => keptAt(h.at + x.at, x.w.length));
        let result = 'hidden';
        if (left.length) result = left.every((x) => flaggedWord(x.w)) ? 'flagged' : left.length < words.length ? 'partly' : 'missed';
        occurrences.push({ ...o, file: f.rel, result, left: left.map((x) => x.w), context: context(h) });
      });
      // Hidden as a name where nothing real is marked.
      src.forEach((text, k) => {
        const real = hits.filter((h, i) => h.k === k && g.occ[i].kind === 'real').map((h) => [h.at, h.at + h.text.length]);
        const trap = hits.filter((h, i) => h.k === k && g.occ[i].kind === 'trap').map((h) => [h.at, h.at + h.text.length]);
        for (const r of al[k].regions) {
          if (!NAME_TAG.test(r.repl)) continue;
          if (trap.some(([s, e]) => s < r.end && e > r.start)) continue;
          const extra = [...text.slice(r.start, r.end).matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu)]
            .map((m) => ({ w: m[0].replace(/[.'’]+$/u, ''), s: r.start + m.index, e: r.start + m.index + m[0].length }))
            .filter((x) => !real.some(([s, e]) => s < x.e && e > x.s) && !TITLE_WORDS.has(x.w.toLowerCase()));
          if (!extra.length) continue;
          const touches = real.some(([s, e]) => s < r.end && e > r.start);
          other.push({ file: f.rel, text: text.slice(r.start, r.end), words: extra.map((x) => x.w), kind: touches ? 'hidden with a real name' : 'no real name there', repl: r.repl });
        }
      });
    }
    return { occurrences, traps, other, files: run.files.length, statuses: run.files.map((f) => f.status) };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export function summarise({ occurrences, traps, other }) {
  const cats = {};
  for (const o of occurrences) {
    const c = (cats[o.cat] ||= { total: 0, hidden: 0, flagged: 0, partly: 0, missed: 0, blocked: 0 });
    c.total++;
    if (o.result === 'file blocked') c.blocked++; else c[o.result]++;
  }
  const all = Object.values(cats).reduce((s, c) => { for (const k of Object.keys(c)) s[k] = (s[k] || 0) + c[k]; return s; }, {});
  const words = {};
  for (const t of traps) {
    const w = (words[t.value] ||= { total: 0, kept: 0, 'kept, flagged': 0, 'over-hidden': 0, 'blurred as a fact': 0, 'file blocked': 0 });
    w.total++;
    w[t.result]++;
  }
  const trapAll = Object.values(words).reduce((s, c) => { for (const k of Object.keys(c)) s[k] = (s[k] || 0) + c[k]; return s; }, {});
  return { cats, all, words, trapAll, other: { noRealName: other.filter((x) => x.kind === 'no real name there').length, withRealName: other.filter((x) => x.kind === 'hidden with a real name').length } };
}

export function printSummary(s, title) {
  const pad = (v, n) => String(v).padStart(n);
  const lines = [title, '', `${'Names'.padEnd(40)} total hidden flagged partly missed`];
  for (const [cat, c] of Object.entries(s.cats).sort((x, y) => Object.keys(CATEGORIES).indexOf(x[0]) - Object.keys(CATEGORIES).indexOf(y[0]))) {
    lines.push(`${CATEGORIES[cat].padEnd(40)} ${pad(c.total, 5)} ${pad(c.hidden, 6)} ${pad(c.flagged, 7)} ${pad(c.partly, 6)} ${pad(c.missed, 6)}${c.blocked ? `  (${c.blocked} in blocked files)` : ''}`);
  }
  lines.push(`${'All names'.padEnd(40)} ${pad(s.all.total, 5)} ${pad(s.all.hidden, 6)} ${pad(s.all.flagged, 7)} ${pad(s.all.partly, 6)} ${pad(s.all.missed, 6)}`);
  lines.push('', `${'Ordinary words (traps)'.padEnd(26)} total kept kept+flagged over-hidden blurred-as-fact`);
  for (const [w, c] of Object.entries(s.words)) lines.push(`${w.padEnd(26)} ${pad(c.total, 5)} ${pad(c.kept, 4)} ${pad(c['kept, flagged'], 12)} ${pad(c['over-hidden'], 11)} ${pad(c['blurred as a fact'], 15)}`);
  lines.push(`${'All traps'.padEnd(26)} ${pad(s.trapAll.total, 5)} ${pad(s.trapAll.kept, 4)} ${pad(s.trapAll['kept, flagged'], 12)} ${pad(s.trapAll['over-hidden'], 11)} ${pad(s.trapAll['blurred as a fact'], 15)}`);
  lines.push('', `Other over-hiding: ${s.other.noRealName} stretch(es) hidden as a name where no real name is; ${s.other.withRealName} where ordinary words were hidden together with a real name.`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = process.argv[2];
  const flags = new Set(process.argv.slice(3));
  const mod = which === 'heldout' ? await import('./heldout/make.js') : which === 'namesdev' ? await import('./namesdev/make.js') : null;
  if (!mod) { console.error('Usage: node test/names-measure.js namesdev|heldout [--setup] [--details] [--json]'); process.exit(2); }
  const make = mod.makeHeldout || mod.makeNamesdev;
  const result = await measureMatter(make, { setup: flags.has('--setup') ? mod.SETUP : null });
  const s = summarise(result);
  if (flags.has('--json')) console.log(JSON.stringify({ summary: s, ...(flags.has('--details') ? result : {}) }, null, 2));
  else {
    console.log(printSummary(s, `${which}: ${result.files} files, setup ${flags.has('--setup') ? 'typed (client and other side)' : 'not typed'}.`));
    if (flags.has('--details')) {
      console.log('\nNot hidden:');
      for (const o of result.occurrences.filter((x) => x.result !== 'hidden')) console.log(`  [${o.result}] ${CATEGORIES[o.cat]}: "${o.value}" in ${o.file}: …${o.context}…`);
      console.log('\nTraps not simply kept:');
      for (const t of result.traps.filter((x) => x.result !== 'kept')) console.log(`  [${t.result}] "${t.value}" in ${t.file}: …${t.context}…`);
      console.log('\nOther over-hiding:');
      for (const x of result.other) console.log(`  [${x.kind}] "${x.text.replace(/\s+/g, ' ')}" -> ${x.repl} (${x.file}; words: ${x.words.join(', ')})`);
    }
  }
}
