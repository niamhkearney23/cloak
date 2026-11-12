// Builds the chronology for the made-up 20-file matter, prints the table, and
// measures it against a hand-made list of the real events in those files.
// Run: node test/chronology-demo.js <output folder>
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeMatter } from './matter.js';
import { cloakFolder } from '../run.js';
import { Matter } from '../engine.js';
import { Chronology } from '../chronology.js';

const outDir = process.argv[2] || (await mkdtemp(path.join(os.tmpdir(), 'cloak-chrono-')));
await mkdir(outDir, { recursive: true });
const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-chrono-src-'));
await makeMatter(path.join(root, 'documents'));
const matter = new Matter({ options: { level: 'strict' } });
const run = await cloakFolder({ folder: path.join(root, 'documents'), outDir: path.join(root, 'out'), options: {}, user: 'demo', matter, write: false });
const chrono = Chronology.build({ files: run.files, matter });

// ---- the real events, written by hand from reading the 20 files
const num = (r) => Number((r.sources[0].file.match(/(\d+)/) || [])[1]);
const on = (key) => (r) => r.date?.key === key;
const TRUTH = [
  ['T1 Sale and purchase agreement made, 3 Mar 2023', (r) => on('2023-03-03')(r) && /agreement|perjanjian|sale and purchase|Geran|Lot 1234/i.test(r.text) && !/deposit|paid|transfer|sum of/i.test(r.text)],
  ['T2 Meeting at the developer\'s office, 3 Mar 2023', (r) => on('2023-03-03')(r) && /meeting|bertemu|present|hadir|Meeting note/i.test(r.text) && !/deposit|paid|transfer/i.test(r.text)],
  ['T3 Deposit of RM60,000 paid, 3 Mar 2023', (r) => on('2023-03-03')(r) && (/deposit|paid|transfer|60000|60,000|订金/i.test(r.text) || r.amounts.some((a) => /6000000$/.test(a.key)))],
  ['T4 Bank manager\'s letter, 10 Mar 2023', on('2023-03-10')],
  ['T5 Payment schedule line, 1 Jun 2023', on('2023-06-01')],
  ['T6 Email Ahmad to lawyer, 4 Dec 2023', on('2023-12-04')],
  ['T7 Letter of demand, 5 Dec 2023', on('2023-12-05')],
  ['T8 Email lawyer to bank, 6 Dec 2023', on('2023-12-06')],
  ['T9 Bank confirmation, 8 Dec 2023', on('2023-12-08')],
  ['T10 File note, 11 Dec 2023', on('2023-12-11')],
  ['T11 Reply from developer, 12 Dec 2023', on('2023-12-12')],
  ['T12 Reminder letter, 20 Dec 2023', on('2023-12-20')],
  ['T13 Writ and claim, 15 Jan 2024', on('2024-01-15')],
  ['T14 Affidavit sworn, 20 Jan 2024', on('2024-01-20')],
  ['T15 Defence, 20 Feb 2024', on('2024-02-20')],
  ['T16 Notice of related suit, 1 Mar 2024', on('2024-03-01')],
];
const dated = chrono.dated();
const assigned = new Map(TRUTH.map(([name]) => [name, []]));
const unexplained = [];
for (const r of dated) {
  const hit = TRUTH.find(([, test]) => test(r));
  if (hit) assigned.get(hit[0]).push(r); else unexplained.push(r);
}
let missed = 0, splitExtra = 0, mergedWrong = 0;
const lines = [];
for (const [name, rows] of assigned) {
  const groups = new Set(rows.map((r) => r.group || r.id));
  if (!rows.length) missed++;
  if (groups.size > 1) splitExtra += groups.size - 1;
  lines.push(`${rows.length ? 'found ' : 'MISSED'}  ${name}: ${rows.length} row(s) in ${groups.size} group(s)`);
}
const owner = new Map();
for (const [name, rows] of assigned) for (const r of rows) owner.set(r.id, name);
const byGroup = new Map();
for (const r of dated) if (r.group) byGroup.set(r.group, [...(byGroup.get(r.group) || []), r]);
for (const rows of byGroup.values()) if (new Set(rows.map((r) => owner.get(r.id)).filter(Boolean)).size > 1) mergedWrong++;

const table = chrono.table({ undated: false });
const fmt = (t) => `${t.date.padEnd(17)} ${t.group ? `[${t.group}] ` : '      '}${t.event.slice(0, 150)}${t.event.length > 150 ? '…' : ''}\n${' '.repeat(24)}people: ${t.people.join('; ') || '-'} | source: ${t.source.join('; ')}${t.conflict ? `\n${' '.repeat(24)}POSSIBLE CONFLICT: ${t.conflict.why.join('; ')}` : ''}`;
const report = [
  `Chronology of the made-up 20-file matter (${run.files.length} files on disk)`,
  `${chrono.active().length} rows: ${dated.length} dated, ${chrono.undated().length} not dated. ${new Set(dated.filter((r) => r.group).map((r) => r.group)).size} groups of rows about the same event. ${dated.filter((r) => r.conflict).length} rows flagged as possible conflicts.`,
  '', 'MEASURED AGAINST THE 16 REAL DATED EVENTS (written by hand from the files)', ...lines,
  `Real events with no row at all: ${missed} of ${TRUTH.length}`,
  `Real events split into more than one group: ${splitExtra} extra group(s)`,
  `Groups that join two different real events: ${mergedWrong}`,
  `Dated rows that match none of the 16 events (to be read by hand): ${unexplained.length}`,
  '', 'THE TABLE (dated rows, in time order)', '', ...table.map(fmt),
  '', 'DATED ROWS THAT MATCH NONE OF THE 16 EVENTS', '', ...unexplained.map((r) => `${r.date.text}  ${r.text.slice(0, 160)}  [${r.sources[0].file}]`),
].join('\n');
await writeFile(path.join(outDir, 'chronology-table.txt'), report);
await writeFile(path.join(outDir, 'chronology-undated.txt'), chrono.undated().map((r) => `${r.text.slice(0, 200)}  [${r.sources[0].file}] people: ${r.people.join('; ')}`).join('\n'));
console.log(report);
process.exit(0);
