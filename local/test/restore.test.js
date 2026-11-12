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
