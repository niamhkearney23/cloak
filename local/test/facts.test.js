import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Facts, findDates, findAmounts, findRelative, sweepFacts } from '../facts.js';

const require = createRequire(import.meta.url);
const { Cloak, TOKEN_RE } = require('../../public/cloak.js');

const A = 'The sum of RM 4,317,250.00 was due on 3 July 2025.';
const B = 'Tuntutan RM4.3 million pada 03/07/2025.';
const C = 'Bayaran RM4,317,250 dibuat pada 3hb Julai 2025 (3rd July 2025, July 3, 2025, 2025-07-03).';
const D = '二零二五年七月三日 and 2025年7月3日.';

function run(texts, options) {
  const f = new Facts(options);
  for (const t of texts) f.learn(t);
  f.finalize();
  return { f, out: texts.map((t) => f.apply(t)) };
}

test('the same amount and date, written five ways, get the same tags: one number, a letter for each way of writing it', () => {
  const { out } = run([A, B, C, D]);
  const text = out.join('\n');
  // Every date form is DATE_1 (the only exact date), every amount form AMOUNT_1.
  const bases = [...text.matchAll(TOKEN_RE)].map((m) => m[1].split('.')[0]);
  assert.deepEqual([...new Set(bases)].sort(), ['AMOUNT_1', 'DATE_1']);
  assert.ok(!/July|Julai|4,317|million|2025/.test(text), text);
  // Each different way of writing has its own ending.
  const tokens = [...new Set([...text.matchAll(TOKEN_RE)].map((m) => m[1]))];
  assert.ok(tokens.includes('DATE_1') && tokens.includes('DATE_1.B') && tokens.includes('DATE_1.C'));
  assert.ok(tokens.includes('AMOUNT_1') && tokens.includes('AMOUNT_1.B') && tokens.includes('AMOUNT_1.C'));
});

test('the rounded form RM4.3 million is the same amount as RM 4,317,250.00 when only one amount fits', () => {
  const { f } = run([A, B]);
  assert.equal(f.list().filter((r) => r.kind === 'amount').length, 1);
  // A rounded figure that fits no exact amount keeps a tag of its own.
  const lone = run(['RM9.9 million was offered.', A]);
  assert.equal(lone.f.list().filter((r) => r.kind === 'amount').length, 2);
});

test('restoring puts back exactly what was written, in the format it was written', () => {
  const texts = [A, B, C, D];
  const { f, out } = run(texts);
  const cloak = new Cloak();
  f.syncInto(cloak);
  out.forEach((o, i) => assert.equal(cloak.uncloak(o).text, texts[i]));
});

test('date tags are numbered in true time order across the whole matter, whatever order the files come in', () => {
  const later = 'Paid on 9 September 2025.';
  const middle = 'Signed on 3 March 2023 and demanded on 5 December 2023.';
  const first = 'Born 1 January 1980.';
  const { f, out } = run([later, middle, first]);
  assert.equal(f.apply('1 January 1980'), '{{DATE_1}}');
  assert.equal(f.apply('3 March 2023'), '{{DATE_2}}');
  assert.equal(f.apply('5 December 2023'), '{{DATE_3}}');
  assert.equal(f.apply('9 September 2025'), '{{DATE_4}}');
  assert.equal(out[0], 'Paid on {{DATE_4}}.');
});

test('the gap table has day counts and no real dates', () => {
  const { f } = run(['3 March 2023, 5 December 2023, 20 December 2023, March 2024, 5 June']);
  const table = f.dateTable();
  assert.deepEqual(table.map((r) => [r.tag, r.gap_days]), [['DATE_1', null], ['DATE_2', 277], ['DATE_3', 15], ['DATE_4', 72], ['DATE_5', null]]);
  assert.match(table[3].note, /approximate|month only/);
  assert.match(table[4].note, /year not stated/);
  assert.ok(!/2023|2024|March|December/.test(JSON.stringify(table)));
});

test('dates in other places are found, and look-alikes are not', () => {
  const dates = (t) => findDates(t).map((d) => [d.text, d.key]);
  assert.deepEqual(dates('on 21st day of July 2025'), [['21st day of July 2025', '2025-07-21']]);
  assert.deepEqual(dates('pada 14.3.2025'), [['14.3.2025', '2025-03-14']]);
  assert.deepEqual(dates('Mac 2024'), [['Mac 2024', '2024-03']]);
  assert.deepEqual(dates('in 2024 the plaintiff'), [['2024', '2024']]);
  assert.deepEqual(dates('the Akta Kontrak 1950 and Section 74'), []);
  assert.deepEqual(dates('Suit WA-22NCvC-123-01/2024 IC 800505-14-5521 Tel 03-2161 8899 account 5141 2345 6789'), []);
  assert.deepEqual(dates('31/02/2025'), [], 'a day that does not exist is not a date');
  assert.equal(findDates('03/07/2025')[0].ambiguous, true, 'day first is assumed, and flagged when the other reading is possible');
  assert.equal(findDates('14/07/2025')[0].ambiguous, false);
});

test('amounts: currency signs and words, thousands and millions; bare numbers are not amounts', () => {
  const amounts = (t) => findAmounts(t).map((a) => [a.currency, a.cents]);
  assert.deepEqual(amounts('RM60,000 and RM 60,000.00 and MYR60000'), [['MYR', 6000000], ['MYR', 6000000], ['MYR', 6000000]]);
  assert.deepEqual(amounts('RM1.5 juta'), [['MYR', 150000000]]);
  assert.deepEqual(amounts('S$2,500 and US$1m'), [['SGD', 250000], ['USD', 100000000]]);
  assert.deepEqual(amounts('60,000 ringgit'), [['MYR', 6000000]]);
  assert.deepEqual(amounts('Cheque 663801 for 986400'), []);
});

test('relative and vague dates are listed and never turned into dates', () => {
  const found = findRelative('He called yesterday, again within 14 days, and last Friday. Dalam masa tiga bulan. At the end of June.').map((r) => r.text);
  assert.deepEqual(found, ['yesterday', 'within 14 days', 'last Friday', 'Dalam masa tiga bulan', 'the end of June']);
  assert.deepEqual(findDates('within 14 days of the demand'), []);
});

test('the key sweep finds a real fact in any format, and ignores tags', () => {
  const { f } = run([A]);
  assert.deepEqual(sweepFacts(f, 'Paid {{AMOUNT_1}} on {{DATE_1}}.'), []);
  const hits = sweepFacts(f, 'It was RM4,317,250 on 03/07/2025 and about RM4.3 million.');
  assert.deepEqual(hits.map((h) => h.text), ['RM4,317,250', '03/07/2025', 'RM4.3 million']);
});

test('a fact a person un-blurs stays visible, and it is recorded who did it', () => {
  const { f } = run([A]);
  f.unblur('date', '2025-07-03', 'Reviewer');
  assert.equal(f.apply('3 July 2025 and RM 4,317,250.00'), '3 July 2025 and {{AMOUNT_1}}');
  assert.equal(f.unblurred[0].by, 'Reviewer');
  assert.ok(f.unblurred[0].when);
});

test('a total is worked out by Cloak and has a tag of its own', () => {
  const { f } = run(['RM 100.00 and RM 250.50']);
  const t = f.total(['AMOUNT_1', 'AMOUNT_2']);
  assert.equal(t, 'AMOUNT_3');
  const cloak = new Cloak();
  f.syncInto(cloak);
  assert.equal(cloak.uncloak('{{AMOUNT_3}}').text, 'RM 350.50');
  assert.ok(f.amountTable().sums.some((s) => /AMOUNT_1 \+ AMOUNT_2 = AMOUNT_3/.test(s)));
});

test('places, projects, job titles and courts are found; ordinary words are not', async () => {
  const { findPlaces, findProjects, findJobs, findCourts, findSheetAmounts } = await import('../facts.js');
  assert.deepEqual(findPlaces('at Pulau Indah, Klang and Daerah Gombak').map((x) => x.text), ['Pulau Indah', 'Klang', 'Daerah Gombak']);
  assert.deepEqual(findPlaces('The plaintiff lives in a town. Orchid and Bukit are words.').map((x) => x.text), []);
  assert.deepEqual(findProjects('the Bintang Residences project').map((x) => x.text), ['Bintang Residences']);
  assert.deepEqual(findJobs('signed by the Branch Manager; the harbour master; a director and a manager').map((x) => x.text), ['the Branch Manager', 'the harbour master']);
  assert.deepEqual(findCourts('IN THE HIGH COURT OF MALAYA AT SHAH ALAM before MARLINA SULONG JC').map((x) => x.text.trim()).sort(), ['IN THE HIGH COURT OF MALAYA AT SHAH ALAM', 'MARLINA SULONG JC']);
  // A bare number is an amount only in a column that says so.
  assert.deepEqual(findSheetAmounts('Date\tAmount (RM)\tNote\n3 March\t60000\tx\n1 June\t0\ty\nInvoice\tnone\t12345').map((x) => x.text), ['60000']);
});

test('a number in a spreadsheet amount column is the same fact as the amount written with RM elsewhere', () => {
  const sheet = 'Date\tAmount (RM)\tPayee\n3 March 2023\t60000\tX\n';
  const { f, out } = run(['Paid RM60,000.00 on 3 March 2023.', sheet]);
  assert.match(out[1], /\{\{DATE_1\.?[A-Z]*\}\}\t\{\{AMOUNT_1\.[A-Z]\}\}\tX/);
  assert.equal(f.list().filter((r) => r.kind === 'amount').length, 1);
});

test('a total is written the way the first amount was written, and can be a difference', () => {
  const { f } = run(['The price is RM600,000.00 and the deposit RM60,000.00.']);
  const t = f.total(['AMOUNT_1', '-AMOUNT_2']);
  const cloak = new Cloak();
  f.syncInto(cloak);
  assert.equal(cloak.uncloak(`{{${t}}}`).text, 'RM540,000.00');
});
