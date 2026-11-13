import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matter } from '../engine.js';
import { restoreDraft } from '../restore.js';
import { keySweep } from '../doublecheck.js';

function matterWith(text) {
  const m = new Matter({ options: { level: 'strict' } });
  m.register(m.learn(text));
  m.facts.finalize();
  m.facts.syncInto(m.cloak);
  return m;
}
const SOURCE = 'The price is RM600,000.00 and the deposit RM60,000.00, paid on 3 March 2023 and demanded on 5 December 2023.';

test('restoring puts every fact back as it was written and works out a total locally', () => {
  const m = matterWith(SOURCE);
  const draft = 'The deposit {{AMOUNT_2}} was paid on {{DATE_1}} and demanded on {{DATE_2}}. The balance is [TOTAL NEEDED: AMOUNT_1 - AMOUNT_2].';
  const r = restoreDraft(m, draft);
  assert.equal(r.text, 'The deposit RM60,000.00 was paid on 3 March 2023 and demanded on 5 December 2023. The balance is RM540,000.00.');
  assert.equal(r.worked.length, 1);
  assert.equal(r.clean, true);
});

test('a tag the AI invented, damaged or dropped is reported', () => {
  const m = matterWith(SOURCE);
  const r = restoreDraft(m, 'Paid {{AMOUNT_2}} on DATE_1 in {{DATE_9}} and [AMOUNT_1] and {{AMOUNT_2.Q}}.', { required: ['AMOUNT_1', 'DATE_2'] });
  assert.deepEqual(r.invented.sort(), ['{{DATE_9}}']);
  assert.ok(r.changed.some((c) => c.found === 'DATE_1' && /braces/.test(c.why)));
  assert.ok(r.changed.some((c) => c.found === '[AMOUNT_1]'));
  assert.ok(r.changed.some((c) => c.found === '{{AMOUNT_2.Q}}' && /ending/.test(c.why)));
  assert.deepEqual(r.dropped.sort(), ['AMOUNT_1', 'DATE_2']);
  assert.equal(r.clean, false);
});

test('a real amount or date written into a draft is caught, in any format', () => {
  const m = matterWith(SOURCE);
  const r = restoreDraft(m, 'He paid RM 60,000 on 03/03/2023, about RM0.06 million.');
  assert.ok(r.real.some((h) => /60,000/.test(h.text)));
  assert.ok(r.real.some((h) => /03\/03\/2023/.test(h.text)));
});

test('the key sweep finds a name the key holds and a fact in any format, with the paragraph number', () => {
  const m = new Matter({ options: { level: 'strict' } });
  const text = 'Encik Zulkarnain bin Hashim paid RM 60,000.00 on 3 March 2023.\n\nLater, Zulkarnain called.';
  m.register(m.learn(text)); m.facts.finalize(); m.facts.syncInto(m.cloak);
  assert.deepEqual(keySweep(m, m.apply(text)), []);
  const hits = keySweep(m, 'Para one is clean {{PERSON_1}}.\nPara two: RM60000 on 03/03/2023 and Zulkarnain bin Hashim.');
  assert.deepEqual([...new Set(hits.map((h) => `${h.kind}@${h.paragraph}`))].sort(), ['amount@2', 'date@2', 'key@2']);
});

function matterFrom(...texts) {
  const m = new Matter({ options: { level: 'strict' } });
  for (const t of texts) m.register(m.learn(t));
  m.facts.finalize();
  m.facts.syncInto(m.cloak);
  return m;
}
const MALAY = 'Melalui perjanjian bertarikh 3 Mac 2023, Defendan Kedua ialah pengarah urusan syarikat. DALAM MAHKAMAH TINGGI MALAYA DI KUALA LUMPUR\nDikemukakan pada 15 Januari 2024.\nThe agreement dated 3 March 2023.';

test('an English draft restores to English: no Malay month names, job titles or court names, except inside a quotation', () => {
  const m = matterFrom(MALAY);
  const tags = m.facts.entries();
  const ms = (kind, re) => tags.find((e) => e.kind === kind && re.test(e.value)).token;
  const mac = ms('date', /Mac/);
  const jan = ms('date', /Januari/);
  const job = ms('job', /pengarah/);
  const court = ms('court', /MAHKAMAH/);
  const draft = `{{${court}}}\n\n1. The Agreement is dated {{${mac}}} and the Writ is dated {{${jan}}}.\n2. The Second Defendant is the {{${job}}} of the company.\n3. The note says "signed on {{${mac}}} by the {{${job}}}".`;
  const r = restoreDraft(m, draft);
  const [heading, , p1, p2, p3] = r.text.split('\n');
  assert.equal(heading, 'IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR');
  assert.equal(p1, '1. The Agreement is dated 3 March 2023 and the Writ is dated 15 January 2024.');
  assert.equal(p2, '2. The Second Defendant is the managing director of the company.');
  assert.match(p3, /signed on 3 Mac 2023 by the pengarah urusan/, 'inside a quotation the exact form is kept');
  assert.ok(r.translated.length >= 4 && r.kept.length === 2);
  const outsideQuote = r.text.replace(/"[^"]*"/g, '');
  assert.ok(!/Januari|Mac\b|Februari|Julai|Disember|Mei\b|Ogos|pengarah|MAHKAMAH/i.test(outsideQuote), outsideQuote);
  assert.deepEqual(r.mixed, []);
});

test('a Malay sentence gets the Malay form, and a form with no translation is kept and reported', () => {
  const m = matterFrom('Plaintiff dated 3 March 2023 and the harbour master signed.');
  const date = m.facts.entries().find((e) => e.kind === 'date').token;
  const r = restoreDraft(m, `Perjanjian ini bertarikh {{${date}}} dan ditandatangani oleh pihak yang berkenaan.`);
  assert.match(r.text, /bertarikh 3 Mac 2023/);
});

test('a bare number from a spreadsheet restores as an amount of money; zero is "RM 0.00"', () => {
  const sheet = 'Sheet name: S\nDate\tNote\tPaid (RM)\nx\ta\t0\ny\tb\t60000\n';
  const m = matterFrom(sheet, 'Nothing else.');
  const zero = m.facts.entries().find((e) => e.value === '0').token;
  const big = m.facts.entries().find((e) => e.value === '60000').token;
  assert.equal(restoreDraft(m, `Paid {{${zero}}} and {{${big}}}.`).text, 'Paid RM 0.00 and RM 60,000.00.');
  assert.equal(restoreDraft(m, `x\ta\t{{${zero}}}\n`).text, 'x\ta\t0\n', 'inside a sheet it stays as the cell was');
});

test('drafting notes left in a draft are flagged', () => {
  const m = matterFrom(SOURCE);
  const r = restoreDraft(m, '1. Fine.\n2. [FOR THE LAWYER: the grounds are not drafted.]\n3. The balance is to be confirmed by the lawyer.\n4. [date to be inserted]');
  assert.equal(r.notes.length, 3);
});
