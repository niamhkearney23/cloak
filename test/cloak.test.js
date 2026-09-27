import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Cloak, findSuspects } = require('../public/cloak.js');

function sample() {
  const c = new Cloak();
  c.addPerson('PLAINTIFF', "Mary O'Neill", { address: '12 Main Street, Newry, BT34 1AB' });
  c.addOrganisation('DEFENDANT', 'Acme Haulage Limited', { address: 'Unit 4, Docks Road, Belfast' });
  c.addPerson('PERSON', 'Dr. Seán Ó Briain');
  c.addOrganisation('FIRM', 'Kearney & Co Solicitors', { token: 'PLAINTIFF_SOLICITORS', email: 'info@kearneyco.example' });
  return c;
}

test('cloaks full names, surnames, first names and company short names', () => {
  const c = sample();
  const out = c.cloak("Mary O'Neill was struck by a lorry owned by Acme Haulage. Ms O'Neill saw Dr Ó Briain. Mary went home.");
  assert.equal(out, '{{PLAINTIFF_1}} was struck by a lorry owned by {{DEFENDANT_1.SHORT}}. Ms {{PLAINTIFF_1.SURNAME}} saw Dr {{PERSON_1.SURNAME}}. {{PLAINTIFF_1.FIRST}} went home.');
  assert.doesNotMatch(out, /Mary|Neill|Acme|Briain/);
});

test('matches regardless of case in headings and curly apostrophes', () => {
  const c = sample();
  assert.equal(c.cloak('MARY O’NEILL v ACME HAULAGE LIMITED'), '{{PLAINTIFF_1}} v {{DEFENDANT_1}}');
});

test('does not cloak ordinary lowercase words that happen to be names', () => {
  const c = new Cloak();
  c.addPerson('PLAINTIFF', 'April May');
  assert.equal(c.cloak('The Plaintiff may return in april. April May did.'), 'The Plaintiff may return in april. {{PLAINTIFF_1}} did.');
});

test('does not match inside longer words', () => {
  const c = new Cloak();
  c.addPerson('PLAINTIFF', 'Tom Law');
  assert.equal(c.cloak('Lawrence and Tomas met Mr Law.'), 'Lawrence and Tomas met Mr {{PLAINTIFF_1.SURNAME}}.');
});

test('a full address wins over the postcode inside it', () => {
  const c = sample();
  assert.equal(c.cloak('address: 12 Main Street, Newry, BT34 1AB'), 'address: {{PLAINTIFF_1.ADDRESS}}');
  assert.equal(c.cloak('She lives at 12 Main Street.'), 'She lives at {{PLAINTIFF_1.ADDRESS_LINE1}}.');
});

test('suspects keep possessives and inner words', () => {
  const found = findSuspects("The case is in the King's Bench Division. The car was fixed at the Plaintiff's local Hare's Garage. It happened on Main Street, Newry.").map((s) => s.text);
  assert.ok(found.includes("Hare's Garage"), found.join('|'));
  assert.ok(!found.some((f) => /Bench|Division/.test(f)), found.join('|'));
  assert.ok(found.includes('Main Street, Newry') || found.includes('Main Street Newry') || found.includes('Main Street'), found.join('|'));
});

test('auto-detects emails, phones and identifiers', () => {
  const c = new Cloak();
  const out = c.cloak('Email john@example.com or call 028 9012 3456. PPSN 1234567T. Eircode D02 X285. Postcode BT1 5GS.');
  assert.doesNotMatch(out, /example\.com|9012|1234567T|X285|5GS/);
  const back = c.uncloak(out).text;
  assert.equal(back, 'Email john@example.com or call 028 9012 3456. PPSN 1234567T. Eircode D02 X285. Postcode BT1 5GS.');
});

test('does not treat dates and money as phone numbers', () => {
  const c = new Cloak();
  const text = 'On 3 March 2024 the Plaintiff lost £4,250 and 12/03/2024 was the date.';
  assert.equal(c.cloak(text), text);
});

test('same value always gets the same token', () => {
  const c = new Cloak();
  const a = c.cloak('Call a@b.com');
  const b = c.cloak('Also a@b.com');
  assert.equal(a, 'Call {{EMAIL_1}}');
  assert.equal(b, 'Also {{EMAIL_1}}');
});

test('round trip restores everything, including |UPPER', () => {
  const c = sample();
  const original = "Mary O'Neill of 12 Main Street, Newry, BT34 1AB sues Acme Haulage Limited. Contact info@kearneyco.example.";
  const cloaked = c.cloak(original);
  assert.equal(c.uncloak(cloaked).text, original);
  assert.equal(c.uncloak('{{PLAINTIFF_1|UPPER}}').text, "MARY O'NEILL");
  assert.equal(c.uncloak('{{ PLAINTIFF_1.SURNAME }}').text, "O'Neill");
});

test('reports tokens it does not know', () => {
  const c = sample();
  const r = c.uncloak('Signed {{WITNESS_9}}');
  assert.deepEqual(r.unknown, ['WITNESS_9']);
  assert.equal(r.text, 'Signed [WITNESS_9?]');
});

test('uncloak-only values are never matched in text', () => {
  const c = new Cloak();
  c.register('EXHIBIT_PREFIX', 'MO', { match: false });
  assert.equal(c.cloak('MO went to MO.'), 'MO went to MO.');
  assert.equal(c.uncloak('marked {{EXHIBIT_PREFIX}}1').text, 'marked MO1');
});

test('toJSON/fromJSON keeps the map and continues numbering', () => {
  const c = sample();
  c.cloak('x@y.com');
  const d = Cloak.fromJSON(JSON.parse(JSON.stringify(c.toJSON())));
  assert.equal(d.uncloak('{{PLAINTIFF_1}} {{EMAIL_1}}').text, "Mary O'Neill x@y.com");
  assert.equal(d.cloak('z@y.com'), '{{EMAIL_2}}');
});

test('existing tokens in input are left alone', () => {
  const c = sample();
  assert.equal(c.cloak('{{PLAINTIFF_1}} and Mary'), '{{PLAINTIFF_1}} and {{PLAINTIFF_1.FIRST}}');
});

test('findSuspects flags names that were not cloaked', () => {
  const c = sample();
  const cloaked = c.cloak("Mary O'Neill told the Court that Tom Kelly and Mr Brennan saw the accident on Main Street in March.");
  const found = findSuspects(cloaked).map((s) => s.text);
  assert.ok(found.includes('Tom Kelly'));
  assert.ok(found.includes('Brennan'));
  assert.ok(!found.includes('Court'));
  assert.ok(!found.includes('March'));
});

test('findSuspects ignores a single capitalised word at the start of a sentence', () => {
  assert.deepEqual(findSuspects('Subsequently the Plaintiff went home. Thereafter she rested.'), []);
});
