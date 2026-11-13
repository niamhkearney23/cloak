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

test('rows are grouped only when they are the same day, the same kind of event, and share a person or an amount', () => {
  const { chrono } = build([
    file('01 En.txt', 'Encik Hashim bin Daud attended the meeting on 3 March 2023.'),
    file('02 Ms.txt', 'Pada 3 Mac 2023 saya bertemu dengan Encik Hashim bin Daud.'),
    file('03 Other.txt', 'Encik Hashim bin Daud paid the rent on 3 March 2023.'),
    file('04 Same day only.txt', 'The roof was inspected on 3 March 2023.'),
  ]);
  const g = new Map(chrono.dated().map((r) => [r.sources[0].file, r.group]));
  assert.ok(g.get('01 En.txt') && g.get('01 En.txt') === g.get('02 Ms.txt'), 'same day, same kind (meeting), same person');
  assert.equal(g.get('03 Other.txt'), null, 'same day and person but a different kind of event (payment)');
  assert.equal(g.get('04 Same day only.txt'), null, 'never on the date alone');
});

test('the same day and kind with different amounts is a possible conflict, not a group', () => {
  const { chrono } = build([
    file('01 A.txt', 'Encik Hashim bin Daud paid the deposit of RM 5,000.00 on 1 June 2025.'),
    file('02 B.txt', 'Encik Hashim bin Daud paid the deposit of RM 6,000.00 on 1 June 2025.'),
  ]);
  const rows = chrono.dated();
  assert.ok(rows.every((r) => !r.group && r.conflict && /different amounts/.test(r.conflict.why.join())));
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
  const { session } = await createMatter({ testMatter: true, dir: path.join(root, 'matter'), password: 'a long test password', user: 'lawyer', kdf: FAST });
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

test('a chat message is one row, however many full stops it has', () => {
  const { chrono } = build([file('08 Chat.txt', '[03/03/2025, 06:12] Apis: Kak Sya, chiller 3 alarm since 7pm. temp -6. call dan.\n[03/03/2025, 06:13] Raji: ok.')]);
  assert.deepEqual(chrono.dated().map((r) => r.text), ['[03/03/2025, 06:12] Apis: Kak Sya, chiller 3 alarm since 7pm. temp -6. call dan.', '[03/03/2025, 06:13] Raji: ok.']);
});

test('dates with no year, date ranges and dates Cloak cannot read in Tamil or Jawi are all listed', () => {
  const { chrono } = build([file('01 A.txt', 'The cheque was returned by 28/5.\nThe inspection was on 2 and 3 March 2025.\nதிருமதி ராஜேஸ்வரி 2025 மே 23 அன்று உறுதிப்படுத்தினார்.\nڤوان نور عائشة تله مڠهانتر سورت ڤد 2 جون 2025.')]);
  const dated = chrono.dated();
  assert.ok(dated.some((r) => r.date.precision === 'dm' && r.date.text === '28/5'));
  assert.ok(dated.some((r) => r.date.precision === 'range' && /2 and 3 March 2025/.test(r.date.text)));
  const lost = chrono.notUnderstood();
  assert.equal(lost.length, 2);
  assert.ok(lost.every((r) => r.dateNote === 'date not understood'));
  assert.match(chrono.document(), /DATE NOT UNDERSTOOD \(read these by hand\)/);
});

test('files that were not read or are held back are listed at the top, with the warning, and their events are not used', () => {
  const ok = file('01 Read.txt', 'Signed on 3 March 2023.');
  const blocked = { rel: '02 Scan.pdf', type: 'pdf', status: 'unreadable', parts: [], reasons: ['Password protected.'] };
  const held = { ...file('03 Notice.txt', 'Dihantar pada 4 Mac 2023.'), status: 'manual', reasons: ['Needs a manual check.'] };
  const { chrono } = build([ok, blocked, held]);
  assert.deepEqual(chrono.missing.map((m) => m.file).sort(), ['02 Scan.pdf', '03 Notice.txt']);
  const text = chrono.document();
  assert.ok(text.indexOf('FILES NOT READ OR HELD BACK') < text.indexOf('Signed on'));
  assert.match(text, /Events in these files are missing from this chronology\./);
  assert.ok(!/Dihantar/.test(text), 'a held-back file contributes no rows');
  assert.equal(chrono.dated().length, 1);
});

test('rows with no date are hidden by default; the count says how many', () => {
  const { chrono } = build([file('01 A.txt', 'Signed on 3 March 2023.\nEncik Hashim bin Daud called.\nEncik Hashim bin Daud wrote.')]);
  assert.equal(chrono.table().length, 1);
  assert.equal(chrono.table({ undated: true }).length, 3);
  assert.match(chrono.document(), /2 more rows have no date and are not listed here\./);
  assert.ok(!/called/.test(chrono.document()));
  assert.match(chrono.document({ undated: true }), /called/);
});

test('a sheet with two tables is read with each table\'s own header', () => {
  const sheet = 'Sheet name: S\nDate\tPayee\tNote\n3 March 2023\tX\ty\nInvoice\tNote\tPaid (RM)\nINV1\tok\t250.50\n';
  const { chrono } = build([file('11 Sheet.xlsx', sheet, 'Sheet: S')]);
  const rows = chrono.active().map((r) => r.text);
  assert.ok(rows.some((r) => /Payee: X/.test(r)));
  assert.ok(rows.some((r) => /Paid \(RM\): RM250\.50/.test(r)));
});
