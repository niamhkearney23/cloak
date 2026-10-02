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

test('Malaysian and Singapore identifiers are hidden and restored', () => {
  const samples = {
    MY_IC: ['900101-14-5678', '900101 14 5678', '900101145678', 'A1234567', 'RF123456'],
    SG_NRIC: ['S1234567D', 'G7654321K', 'SXXXX567D'],
    PASSPORT: ['A12345678', 'E1234567A'],
    COMPANY_NO: ['202001012345', '1234567-X', 'JM0123456-X', 'LLP0012345-LGN'],
    UEN: ['201912345K', '53123456A', 'T08LL1234A'],
    TAX_NO: ['IG12345678090', 'SG 1234567890', 'W10-1808-31000123'],
    CASE_NO: ['WA-22NCvC-123-01/2024', 'W-02(NCVC)(W)-1234-07/2023', 'HC/OC 123/2024'],
    VEHICLE: ['SBA 1234 A'],
    CARD: ['4111 1111 1111 1111'],
    PHONE: ['012-345 6789', '+60 3-2123 4567', '9123 4567', '+65 6123 4567'],
  };
  for (const [type, values] of Object.entries(samples)) {
    for (const v of values) {
      const c = new Cloak();
      const text = `Details: ${v}.`;
      const out = c.cloak(text);
      assert.match(out, new RegExp(`^Details: \\{\\{${type}_1\\}\\}\\.$`), `${v} -> ${out}`);
      assert.equal(c.uncloak(out).text, text);
    }
  }
});

test('labelled numbers are hidden whatever their format', () => {
  const c = new Cloak();
  const out = c.cloak('Account No. 5141 2345 6789, policy no: POL/2023/88812, EPF No. 12345678, Ref: KCL/LIT/2024/015, Geran 12345 Lot 678, vehicle registration no. PJB 4567, police report no. IP/2024/1234.');
  assert.doesNotMatch(out, /5141|88812|12345678|KCL|12345|678|PJB|IP\/2024/);
  assert.match(out, /Account No\. \{\{ID_NUMBER_1\}\}/);
});

test('postcodes in Malaysian and Singapore addresses are hidden', () => {
  const c = new Cloak();
  assert.equal(c.cloak('12 Jalan Ampang, 50450 Kuala Lumpur.'), '12 Jalan Ampang, {{POSTCODE_1}} Kuala Lumpur.');
  assert.equal(c.cloak('10 Orchard Road, Singapore 238823'), '10 Orchard Road, Singapore {{POSTCODE_2}}');
});

test('amounts, years, rules and legislation are left alone', () => {
  const c = new Cloak();
  const text = 'He lost RM 25,000.00, RM5000, RM 123456789 and S$5000 in 2023 under Order 18 rule 19 of the Rules of Court 2012 (ROC 2012), section 3(1)(a) of the Civil Law Act 1956, paragraph 12. He paid 12000 dollars.';
  assert.equal(c.cloak(text), text);
});

test('Malay, Chinese and Indian names: titles, bin/binti, a/l and Sdn Bhd', () => {
  const c = new Cloak();
  c.addPerson('PLAINTIFF', 'Tan Sri Tan Ah Kow');
  c.addPerson('DEFENDANT', 'Siti binti Abdullah');
  c.addPerson('PERSON', 'Ravi a/l Muthu');
  c.addOrganisation('DEFENDANT', 'Syarikat Maju Sdn. Bhd.');
  const out = c.cloak('Mr Tan, Puan Siti, Encik Ravi, Abdullah, Muthu and Syarikat Maju met Tan Ah Kow.');
  assert.doesNotMatch(out, /Tan|Siti|Ravi|Abdullah|Muthu|Maju/);
  assert.equal(c.uncloak(out).text, 'Mr Tan, Puan Siti, Encik Ravi, Abdullah, Muthu and Syarikat Maju met Tan Ah Kow.');
});

test('a party ID number typed in the form is hidden even in an odd format', () => {
  const c = new Cloak();
  c.addPerson('PLAINTIFF', 'Lim Mei Ling', { idNo: 'XY-99-AB' });
  assert.equal(c.cloak('Lim Mei Ling (XY-99-AB)'), '{{PLAINTIFF_1}} ({{PLAINTIFF_1.ID_NO}})');
});

test('findSuspects knows Malay titles and place words', () => {
  const found = findSuspects('The Plaintiff met Encik Razak at Jalan Ampang, Kuala Lumpur. Madam Lim Siew Ling attended the Sessions Court.').map((s) => s.text);
  assert.ok(found.includes('Razak'));
  assert.ok(found.includes('Lim Siew Ling'));
  assert.ok(!found.some((f) => /Kuala|Sessions|Jalan/.test(f)), found.join('|'));
});

test('three-part names: each part is hidden on its own', () => {
  const c = new Cloak();
  c.addPerson('ME', 'Mathew Thomas Philip', { token: 'ME' });
  const out = c.cloak('Dear Mr Philip, or Mr Thomas, or Mathew. MATHEW THOMAS PHILIP.');
  assert.equal(out, 'Dear Mr {{ME.SURNAME}}, or Mr {{ME.MIDDLE}}, or {{ME.FIRST}}. {{ME}}.');
  assert.equal(c.uncloak(out).text, 'Dear Mr Philip, or Mr Thomas, or Mathew. Mathew Thomas Philip.');
  const s = new Cloak();
  s.addPerson('PLAINTIFF', 'Siti Nurhaliza binti Abdullah');
  assert.equal(s.cloak('Nurhaliza said'), '{{PLAINTIFF_1.MIDDLE}} said');
});
