import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matter, findNames } from '../engine.js';

// The name rules, one by one, on short made-up texts. Every name is invented.
// (The held-out matter in test/heldout/ is never used here.)

function cloak(texts, options = {}) {
  const m = new Matter({ options: { level: 'standard', ...options } });
  const candidates = texts.flatMap((t) => m.learn(t));
  m.register(candidates);
  for (const t of texts) m.learnDefinitions(t);
  const out = texts.map((t) => m.apply(t));
  const baseOf = (value) => m.cloak.byValue.get(value.toLowerCase())?.split('.')[0];
  return { m, out, candidates, baseOf, unsure: out.map((o) => m.unsure(o).map((u) => u.text)) };
}
const people = (text) => findNames(text).filter((c) => c.kind === 'PERSON').map((c) => c.text);

test('a title only claims a name in the same sentence and on the same line', () => {
  for (const text of ['Thank you Puan. Cabinets done today.', 'Terima kasih Encik. Jubin baru minggu depan.', 'Please call Madam. Delivery is late.', 'Noted, Puan\nCabinets done today.']) {
    assert.deepEqual(people(text), [], text);
    const { out, unsure } = cloak([text]);
    assert.equal(out[0], text);
    assert.ok(!unsure[0].some((u) => /Cabinets|Jubin|Delivery/.test(u)), `${text}: ${unsure[0]}`);
  }
  // Abbreviations still take their dot.
  const { out } = cloak(['Dr. Kavitha Nair and Mr. Lim Ah Kow came. En. Zulhilmi too.']);
  assert.doesNotMatch(out[0], /Kavitha|Nair|Lim|Kow|Zulhilmi/);
  assert.match(out[0], /^Dr\. \{\{PERSON_\d+\}\} and Mr\. \{\{PERSON_\d+\}\} came\. En\. \{\{PERSON_\d+\}\} too\.$/);
});

test('chat speakers are people; words that describe them and company names stay as they are', () => {
  const chat = [
    '02/03/24, 8:05 pm - Kak Mala: Esok buka pukul 11',
    '02/03/24, 8:07 pm - Kala Manager: Ok kak',
    '02/03/24, 8:09 pm - Gono Dapur: Saya masuk',
    '02/03/24, 8:30 pm - +60 12-778 9012: Hi',
    '[1/3/24, 10:05:40] Benny Hock Lee Reno: Noted',
    '[21/03/2025, 18:25:41] Siew Lan: ok',
  ].join('\n');
  const { out } = cloak(['Hock Lee Reno Sdn Bhd sent the invoice.', chat]);
  const lines = out[1].split('\n');
  assert.match(lines[0], / - Kak \{\{PERSON_\d+\}\}: Esok/);
  assert.match(lines[1], / - \{\{PERSON_\d+\}\} Manager: Ok kak/);
  assert.match(lines[2], / - \{\{PERSON_\d+\}\} Dapur: Saya masuk/);
  assert.match(lines[3], / - \{\{PHONE_\d+\}\}: Hi/);
  assert.match(lines[4], /\] \{\{PERSON_\d+\}\} \{\{COMPANY_\d+\.SHORT\}\}: Noted/);
  assert.match(lines[5], /\] \{\{PERSON_\d+\}\}: ok/);
});

test('informal titles before one name: Kak, Pak, Uncle, Ah, Mak Cik; never inside a name', () => {
  const { out, baseOf } = cloak(['Kak Mala told Pak Kirman. Uncle Khoo and Ah Wah came. Mak Cik Senah cooked. Tan Ah Kow paid. Mak Long was there. The Ibu Pejabat is closed.']);
  assert.match(out[0], /^Kak \{\{PERSON_\d+\}\} told Pak \{\{PERSON_\d+\}\}\. Uncle \{\{PERSON_\d+\}\} and Ah \{\{PERSON_\d+\}\} came\. Mak Cik \{\{PERSON_\d+\}\} cooked\. \{\{PERSON_\d+\}\} paid\./);
  for (const v of ['Mala', 'Kirman', 'Khoo', 'Wah', 'Senah', 'Tan Ah Kow']) assert.ok(baseOf(v), v);
  assert.doesNotMatch(out[0], /Mala|Kirman|Khoo|Wah|Senah|Ah Kow/);
  assert.match(out[0], /Mak Long was there\. The Ibu Pejabat is closed\./);
  assert.equal(baseOf('Ah Kow'), baseOf('Tan Ah Kow'));
});

test('people who say who they are, and one name alone on a heading line', () => {
  const { out } = cloak(['AFIDAVIT SUTARJO\n\nSaya, Sutarjo (No. Pasport: B1234567), berikrar. Nama saya Sutarjo.', 'My name is Ponirah. Hi this is Rubel, from the contractor.', 'AFIDAVIT SOKONGAN\n\nI, Wagiyo (Passport No. C7654321), state as follows:']);
  assert.doesNotMatch(out.join('\n'), /Sutarjo|SUTARJO|Ponirah|Rubel|Wagiyo/);
  assert.match(out[2], /^AFIDAVIT SOKONGAN$/m);
});

test('other names a person goes by are joined to that person, and listed for review', () => {
  const { m, out, baseOf } = cloak([
    'Puan Normala binti Jaafar (juga dikenali sebagai Kak Mala) ialah pengarah.',
    'Mr Khoo Teik Choon (also known as Benny Khoo) owns the shop.',
    'I, Kalaivani a/p Rajendran, of George Town, say:\n1. Everyone at the restaurant calls me Kala.',
    'Our cook, Margono, is careful. Everyone calls him Gono.',
    'Everyone calls Sukirman "Kirman".',
  ]);
  assert.equal(baseOf('Mala'), baseOf('Normala binti Jaafar'));
  assert.equal(baseOf('Benny Khoo'), baseOf('Khoo Teik Choon'));
  assert.equal(baseOf('Kala'), baseOf('Kalaivani a/p Rajendran'));
  assert.equal(baseOf('Gono'), baseOf('Margono'));
  assert.equal(baseOf('Kirman'), baseOf('Sukirman'));
  assert.doesNotMatch(out.join('\n'), /Mala|Benny|Kala\b|Gono|Kirman/);
  assert.ok(m.merges.some((x) => /another name for the same person/.test(x.reason)), 'joins made from the text are listed for review');
});

test('greetings and sign-offs name the writer and the reader; "Dear Sirs" names nobody', () => {
  const texts = ['Hi Bernice,\n\nPlease send the receipts.\n\nThank you,\nAdlina', 'Salam Aiman,\nMotor sudah ditukar.\nTerima kasih,\nKok Wah', 'Dear Sirs,\n\nHi all,\nNoted. Thanks, Ray\n\nRegards,\nAccounts Department', 'Salam Aidilfitri,\nSalam Hari Raya,\nHi Team,'];
  const { out } = cloak(texts);
  assert.doesNotMatch(out.join('\n'), /Bernice|Adlina|Aiman|Kok Wah|Ray\b/);
  assert.match(out[2], /^Dear Sirs,$/m);
  assert.match(out[2], /^Hi all,$/m);
  assert.match(out[2], /^Accounts Department$/m);
  assert.equal(out[3], texts[3]);
});

test('"one X", a name next to a person-only role, lists of those present, columns of names, tasks and form lines', () => {
  const { out, candidates } = cloak([
    'The exhaust was installed by one Rubel on the instructions of the manager.',
    "The contractor's foreman, Ah Wah, came daily. Joko, another worker, saw it. Pembantu saya ialah Sutinah dan seorang pencuci.",
    'Present: Puan Mazlina, Jeremy (us); Kala (client)',
    'Sheet name: Pekerja\nBil\tNama\tJawatan\tPenyelia\n1\tMARGONO\tTukang masak\tKak Mala\nPrepared by\tBernice T.\t\t',
    'Farah to get the notice. Sharon to open a new file.\nTandatangan: Margono',
    'Our client is Seri Kembara. Unfortunately, the driver left. The lorry was driven by one Indonesian worker.',
  ]);
  assert.doesNotMatch(out.slice(0, 5).join('\n'), /Rubel|Wah|Joko|Sutinah|Mazlina|Jeremy|Kala\b|MARGONO|Margono|Mala|Bernice|Farah|Sharon/);
  // A company can be a client; a sentence adverb is not a name.
  assert.ok(!candidates.some((c) => c.kind === 'PERSON' && /Kembara|Unfortunately|Indonesian/.test(c.text)));
  assert.match(out[5], /Seri Kembara\. Unfortunately, the driver left\. The lorry was driven by one Indonesian worker\./);
});

test('known names are also hidden in lowercase, except names that are ordinary words', () => {
  const { out, unsure } = cloak([
    'Our cook, Margono, met Mr Bill Chandran and Kak Mala. Email kelvin.tay@hockleereno.example to Kelvin Tay.',
    'ask margono. the bill was wrong. bill handles the tenancy files. kak mala agreed. mala chicken is cancelled. kelvin will call.',
  ]);
  assert.match(out[1], /^ask \{\{PERSON_\d+\}\}\. the bill was wrong\. bill handles the tenancy files\. kak \{\{PERSON_\d+\}\} agreed\. mala chicken is cancelled\. \{\{PERSON_\d+\.FIRST\}\} will call\.$/);
  assert.ok(unsure[1].includes('bill'), 'a lowercase ordinary-word name that reads as the person is flagged');
  assert.match(out[0], /Email \{\{EMAIL_\d+\}\} to/);
});

test('a known name that is an ordinary word is kept where it reads as the ordinary word, and flagged', () => {
  const people = 'Mark Tan, May Wong, Grace Lim and Dan Ong signed. Mark, May, Grace and Dan agreed.';
  const { out, unsure } = cloak([people, 'Mark the pallets. Mark said so.\nMay we remind you. May is preparing it. It is due by the end of May.\n"Grace Period" means 14 days.\nDAN\nDan siapa sign? Cheers, Dan']);
  const o = out[1];
  assert.match(o, /^Mark the pallets\. \{\{PERSON_\d+\.FIRST\}\} said so\.$/m);
  assert.match(o, /^May we remind you\. \{\{PERSON_\d+\.FIRST\}\} is preparing it\. It is due by the end of May\.$/m);
  assert.match(o, /^"Grace Period" means 14 days\.$/m);
  assert.match(o, /^DAN$/m);
  assert.match(o, /^Dan siapa sign\? Cheers, \{\{PERSON_\d+\.FIRST\}\}$/m);
  for (const w of ['Mark', 'May', 'Grace', 'Dan']) assert.ok(unsure[1].includes(w), `${w} is on the not-sure list`);
});

test('after Mohd, Nur or Siti the next word is the first name', () => {
  const { m } = cloak(['Mohd Firdaus bin Kamarul Ariffin and Nur Aina Syafiqah binti Hashim signed.']);
  assert.match(m.cloak.byValue.get('firdaus'), /^PERSON_\d+\.FIRST$/);
  assert.match(m.cloak.byValue.get('aina'), /^PERSON_\d+\.FIRST$/);
});

test('initials of a known person are hidden where a note signs them, and nowhere else', () => {
  const { out } = cloak(['From: "Jeremy Ng" <jeremy@example.com>', 'FILE NOTE\nAttendance: JN\n\nThe JN ledger was checked.\n\nJN']);
  assert.match(out[1], /^Attendance: \{\{PERSON_\d+\.INITIALS\}\}$/m);
  assert.match(out[1], /^\{\{PERSON_\d+\.INITIALS\}\}$/m);
  assert.match(out[1], /The JN ledger was checked\./);
});

test('a firm whose name starts with initials is one company', () => {
  const { out } = cloak(['Messrs K.S. Rao & Co act for the landlord. K.S. Rao & Co wrote again.']);
  assert.doesNotMatch(out[0], /K\.S\.|Rao/);
});

test('a one-word name written in lowercase in many files is an ordinary word in that matter', () => {
  const { out } = cloak(['Mr Kenny Gate (NRIC No. 800101-10-5555) owns the lot.', 'The gate was locked. kenny called.', 'Open the gate at 9.', 'The main gate is broken.']);
  assert.match(out[1], /^The gate was locked\. \{\{PERSON_\d+\.FIRST\}\} called\.$/);
  assert.match(out[2], /^Open the gate at 9\.$/);
  assert.doesNotMatch(out[0], /Kenny|Gate/);
});
