import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matter } from '../engine.js';
import { arithmeticCheck, checkDraft, restoreCheck, sourceCheck } from '../draftcheck.js';

const SOURCE = 'Ahmad bin Ismail bought land from Maju Jaya Sdn Bhd for RM600,000.00 on 3 March 2023 and paid a deposit of RM60,000.00 on 3 March 2023. The letter of demand is dated 5 December 2023. The writ is dated 15 January 2024.';
function matterWith(text) {
  const m = new Matter({ options: { level: 'strict' } });
  m.register(m.learn(text));
  m.facts.finalize();
  m.facts.syncInto(m.cloak);
  return m;
}

test('check 1: a clean draft passes; an invented tag and a real date written in fail, with the paragraph', () => {
  const m = matterWith(SOURCE);
  assert.equal(restoreCheck(m, '1. {{AMOUNT_2}} was paid on {{DATE_1}}.').result, 'pass');
  const bad = restoreCheck(m, '1. Fine.\n2. {{DATE_9}} then 3 March 2023.');
  assert.equal(bad.result, 'fail');
  assert.deepEqual(bad.issues.map((i) => i.paragraph), [2, 2]);
  assert.equal(restoreCheck(m, 'Heading line\n1. Fine.\n   (a) {{DATE_9}}').issues[0].paragraph, 1, 'a continuation line belongs to its numbered paragraph');
});

test('check 2: a date, amount or name that is in no source file is listed with its paragraph', () => {
  const m = matterWith(SOURCE);
  const sources = [SOURCE];
  assert.equal(sourceCheck(m, '1. Ahmad bin Ismail paid RM60,000.00 on 3 March 2023.', sources).result, 'pass');
  const r = sourceCheck(m, '1. Ahmad bin Ismail paid RM60,000.00 on 3 March 2023.\n2. He then paid RM75,000.00 on 9 April 2023. Rosli bin Karim witnessed it.', sources);
  assert.equal(r.result, 'fail');
  assert.ok(r.issues.some((i) => i.paragraph === 2 && /amount "RM75,000.00"/.test(i.what)));
  assert.ok(r.issues.some((i) => i.paragraph === 2 && /date "9 April 2023"/.test(i.what)));
  assert.ok(r.issues.some((i) => i.paragraph === 2 && /Rosli bin Karim/.test(i.what)));
  assert.ok(!r.issues.some((i) => i.paragraph === 1));
});

test('check 3: day counts and totals are recalculated; backwards dates are flagged', () => {
  assert.equal(arithmeticCheck('1. The writ is dated 15 January 2024, 41 days after the demand of 5 December 2023.').result, 'pass');
  const wrong = arithmeticCheck('1. The writ is dated 15 January 2024, 40 days after the demand of 5 December 2023.');
  assert.equal(wrong.result, 'fail');
  assert.match(wrong.issues[0].what, /41 days apart/);
  assert.equal(arithmeticCheck('1. The price is RM600,000.00, the deposit RM60,000.00 and the balance RM540,000.00.').result, 'pass');
  assert.equal(arithmeticCheck('1. The price is RM600,000.00, the deposit RM60,000.00 and the balance RM530,000.00.').result, 'fail');
  const back = arithmeticCheck('1. On 5 December 2023 he called.\n2. On 3 March 2023 he wrote.');
  assert.equal(back.result, 'warn');
  assert.equal(back.issues[0].paragraph, 2);
  assert.equal(arithmeticCheck('1. 41 days after the demand.').result, 'warn');
  // A deadline is not a count between two dates.
  assert.equal(arithmeticCheck('1. The sum was paid on 3 March 2023 and the letter of 5 December 2023 gave 14 days to pay.').result, 'pass');
});

test('all three checks together, with a total Cloak worked out itself', () => {
  const m = matterWith(SOURCE);
  const r = checkDraft({ matter: m, sources: [SOURCE], draft: '1. The price {{AMOUNT_1}}, the deposit {{AMOUNT_2}}; the balance is [TOTAL NEEDED: AMOUNT_1 - AMOUNT_2].' });
  assert.equal(r.result, 'pass', JSON.stringify(r.checks.map((c) => c.issues)));
  assert.match(r.restored, /balance is RM540,000\.00/);
});
