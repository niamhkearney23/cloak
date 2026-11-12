import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Chronology, sentences } from '../chronology.js';
import { Matter } from '../engine.js';
import { createMatter } from '../matter.js';
import { makeMatter, REAL_VALUES, REAL_EXACT } from './matter.js';
import { finishReview } from './helpers.js';

const FAST = { N: 2 ** 12, r: 8, p: 1 };
const file = (rel, text, label = 'Text') => ({ rel, type: 'txt', status: 'ok', parts: [{ label, text }] });

function build(files) {
  const matter = new Matter({ options: { level: 'strict' } });
  for (const f of files) matter.register(matter.learn(f.parts.map((p) => p.text).join('\n')));
  matter.facts.finalize();
  matter.facts.syncInto(matter.cloak);
  return { matter, chrono: Chronology.build({ files, matter }) };
}

test('sentences are split at full stops and lines, but not after Mr., Sdn. Bhd., No. or an initial', () => {
  assert.deepEqual(sentences('Mr. Tan met Maju Jaya Sdn. Bhd. at No. 12 Jalan Ampang on 3 March 2023. He left.\nR. Ahmad signed.'), [
    'Mr. Tan met Maju Jaya Sdn. Bhd. at No. 12 Jalan Ampang on 3 March 2023.', 'He left.', 'R. Ahmad signed.']);
  assert.deepEqual(sentences('1. Plaintiff paid RM 600,000.00. Dato\' Sri Tan refused.'), ['1. Plaintiff paid RM 600,000.00.', "Dato' Sri Tan refused."]);
});

test('every sentence with a date, an amount or a named party is a row; the rest are not', () => {
  const { chrono } = build([file('01 Note.txt', 'The weather was fine.\nOn 3 March 2023 Ahmad bin Ismail paid RM60,000.00.\nThe cheque was returned.\nWe spoke to Tan Boon Huat about it.')]);
  const rows = chrono.active();
  assert.equal(rows.length, 2);
  assert.equal(chrono.dated().length, 1);
  assert.equal(chrono.dated()[0].date.key, '2023-03-03');
  assert.deepEqual(chrono.dated()[0].amounts.map((a) => a.key), ['MYR|6000000']);
  assert.ok(chrono.dated()[0].people.some((p) => /Ahmad/.test(p)));
  assert.equal(chrono.undated().length, 1, 'a named party with no date is listed as not dated');
});

test('rows are sorted by date, whatever order the files come in', () => {
  const { chrono } = build([file('02 B.txt', 'Paid on 9 September 2025.'), file('01 A.txt', 'Signed on 3 March 2023.'), file('03 C.txt', 'Demanded on 5 December 2023.')]);
  assert.deepEqual(chrono.dated().map((r) => r.date.key), ['2023-03-03', '2023-12-05', '2025-09-09']);
});

test('rows about the same event are grouped, across English, Malay and Chinese wording', () => {
  const { chrono } = build([
    file('01 En.txt', 'I was present at the meeting on 3 March 2023.'),
    file('02 Ms.txt', 'Pada 3 Mac 2023 saya bertemu dengan Encik Hashim.'),
    file('03 Cn.txt', '二零二三年三月三日会议在吉隆坡举行。'),
    file('04 Other.txt', 'The cheque was dishonoured on 3 March 2023.'),
  ]);
  const groups = new Map();
  for (const r of chrono.dated()) groups.set(r.sources[0].file, r.group);
  assert.equal(groups.get('01 En.txt'), groups.get('02 Ms.txt'));
  assert.equal(groups.get('01 En.txt'), groups.get('03 Cn.txt'));
  assert.notEqual(groups.get('01 En.txt'), groups.get('04 Other.txt'));
});

test('two rows that read as the same event but give a different date or amount are flagged', () => {
  const { chrono } = build([
    file('01 A.txt', 'The defendant guaranteed all sums due from the company on 14 March 2025.'),
    file('02 B.txt', 'The defendant guaranteed all sums due from the company on 24 March 2025.'),
    file('03 C.txt', 'The tenant paid the deposit for the premises on 1 June 2025 of RM 5,000.00.'),
    file('04 D.txt', 'The tenant paid the deposit for the premises on 1 June 2025 of RM 6,000.00.'),
    file('05 E.txt', 'The landlord inspected the roof on 2 July 2025.'),
  ]);
  const flagged = chrono.dated().filter((r) => r.conflict);
  assert.equal(flagged.length, 4);
  assert.ok(flagged.some((r) => /different dates/.test(r.conflict.why.join())));
  assert.ok(flagged.some((r) => /different amounts/.test(r.conflict.why.join())));
  assert.ok(!chrono.dated().find((r) => r.sources[0].file === '05 E.txt').conflict);
});

test('relative dates are listed with the row, never turned into a date', () => {
  const { chrono } = build([file('01 A.txt', 'Pay within 14 days of the letter dated 5 December 2023.\nHe will call Ahmad bin Ismail last Friday.')]);
  const row = chrono.active().find((r) => r.relative.length && r.date);
  assert.deepEqual(row.relative, ['within 14 days of']);
  assert.equal(row.date.key, '2023-12-05');
  const undated = chrono.undated().find((r) => r.relative.includes('last Friday'));
  assert.ok(undated, 'a relative date alone leaves the row undated');
});

test('a person can edit, merge, delete and add rows; any change takes the confirmation away; the history holds no text', () => {
  const { chrono } = build([file('01 A.txt', 'Signed on 3 March 2023.\nPaid on 3 March 2023.\nDemanded on 5 December 2023.')]);
  const [a, b, c] = chrono.dated();
  chrono.confirm('Reviewer');
  assert.equal(chrono.confirmed.by, 'Reviewer');
  chrono.edit(c.id, { dateText: '6 December 2023' }, 'Reviewer');
  assert.equal(chrono.confirmed, null, 'an edit takes the confirmation away');
  assert.equal(chrono.get(c.id).date.key, '2023-12-06');
  assert.throws(() => chrono.edit(c.id, { dateText: 'next spring' }), /not a date/);
  const merged = chrono.merge([a.id, b.id], 'Reviewer');
  assert.equal(chrono.rows.filter((r) => !r.removed).length, 2);
  assert.match(chrono.get(merged).text, /Signed.*\/.*Paid/);
  chrono.remove(c.id, 'Reviewer');
  assert.equal(chrono.dated().length, 1);
  const added = chrono.add({ dateText: '20 January 2024', text: 'Client telephoned the firm.', source: "client's instructions" }, 'Reviewer');
  assert.equal(chrono.dated().length, 2);
  chrono.confirm('Reviewer');
  assert.match(chrono.document(), /Confirmed by Reviewer on/);
  assert.match(chrono.document(), /Client telephoned the firm/);
  assert.ok(chrono.history.every((h) => !('text' in h)));
  assert.ok(chrono.history.some((h) => h.action === 'add' && h.row === added));
  assert.throws(() => chrono.confirm(''), /Say who/);
});

test('in a matter: build, confirm, and export the chronology alone; it is cloaked like any other file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-chrono-'));
  const docs = path.join(root, 'documents');
  await makeMatter(docs);
  const { session } = await createMatter({ dir: path.join(root, 'matter'), password: 'a long test password', user: 'lawyer', kdf: FAST });
  await session.cloakFolder({ folder: docs });
  await finishReview(session);
  await assert.rejects(session.export({ outDir: path.join(root, 'o0'), only: 'chronology' }), /Confirm the chronology first/);
  const view = await session.buildChronology();
  assert.ok(view.dated >= 20 && view.undated > 0);
  // Building the chronology puts its words on the review screen too: the review is signed again.
  await assert.rejects(session.export({ outDir: path.join(root, 'o0'), only: 'chronology' }), /review is finished/);
  await finishReview(session);
  await assert.rejects(session.export({ outDir: path.join(root, 'o0'), only: 'chronology' }), /Confirm the chronology first/);
  const confirmed = await session.chronologyAction({ type: 'confirm' });
  assert.equal(confirmed.confirmed.by, 'lawyer');
  const out = path.join(root, 'chronology-only');
  const result = await session.export({ outDir: out, only: 'chronology' });
  assert.deepEqual(result.written.sort(), ['000-chronology.cloaked.txt', '000-context-sheet.cloaked.txt']);
  assert.deepEqual((await readdir(out)).filter((n) => n.endsWith('.cloaked.txt')).sort(), result.written.sort());
  const text = await readFile(path.join(out, '000-chronology.cloaked.txt'), 'utf8');
  assert.match(text, /Confirmed by a named reviewer/);
  assert.ok(!/lawyer/.test(text), 'the confirmer is not named in the exported copy');
  assert.match(text, /\{\{DATE_\d+/);
  for (const v of REAL_VALUES) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu').test(text), `${v} in the chronology`);
  for (const v of REAL_EXACT) assert.ok(!new RegExp(`(?<![\\p{L}\\p{N}])${v}(?![\\p{L}\\p{N}])`, 'u').test(text), `${v} in the chronology`);
  assert.ok(!/March 2023|December 2023|RM ?60,000|Kuala Lumpur/.test(text), 'no real date, amount or place');
  // The log says what was done and by whom, never the text.
  const log = await readFile(path.join(root, 'matter', 'log.jsonl'), 'utf8');
  assert.match(log, /"action":"chronology-built"/);
  assert.match(log, /"action":"chronology-confirm"/);
  await session.close();
});
