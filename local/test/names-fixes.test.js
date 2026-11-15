import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Matter, findNames } from '../engine.js';
import { createMatter } from '../matter.js';
import { extractBuffer } from '../extract.js';

const require = createRequire(import.meta.url);
const { findSuspects } = require('../../public/cloak.js');

// Fixes to the name rules found by a code review. Every sentence and name is made up
// (and none comes from test/heldout/ or test/namesdev/).

function cloak(texts, options = {}) {
  const m = new Matter({ options: { level: 'standard', ...options } });
  const candidates = texts.flatMap((t) => m.learn(t));
  m.register(candidates);
  for (const t of texts) m.learnDefinitions(t);
  const out = texts.map((t) => m.apply(t));
  const baseOf = (value) => m.cloak.byValue.get(value.toLowerCase())?.split('.')[0];
  return { m, out, baseOf, unsure: out.map((o) => m.unsure(o).map((u) => u.text)) };
}
const FAST = { N: 2 ** 12, r: 8, p: 1 };
const TAG = /\{\{PERSON_\d+(?:\.[A-Z0-9]+)?\}\}/;

// ---------------------------------------------------------------- 19: all capitals

test('a one-word name in capitals is hidden or flagged, whatever the word', () => {
  // Names that are also on the ordinary-word list (Malay and Chinese names, English first names).
  let tried = 0;
  for (const word of ['Abu', 'Rahim', 'Gill', 'Loh', 'Chin', 'Teh', 'Mah', 'Wan', 'Mark', 'Will', 'Hope', 'Grace']) {
    const { m, out, unsure } = cloak([`Encik ${word} bin Osman (NRIC No. 720202-10-5888) signed the form.`, `Please pass the file to ${word.toUpperCase()}.\nYang benar,\n\n${word.toUpperCase()}\nPengurus`]);
    if (!m.cloak.byValue.has(word.toLowerCase())) continue; // the rules did not take it for a name here: nothing to hide
    tried++;
    const visible = [...out[1].matchAll(new RegExp(`(?<![\\p{L}])${word.toUpperCase()}(?![\\p{L}])`, 'gu'))].length;
    if (visible) assert.ok(unsure[1].includes(word.toUpperCase()), `${word.toUpperCase()} still shows in "${out[1]}" and is not flagged`);
  }
  assert.ok(tried >= 8, `only ${tried} of the words were tried`);
  // A name that is not an English word is the name when it stands alone in capitals.
  const { out } = cloak(['Mr Loh Kah Meng (NRIC No. 720202-10-5888) and Encik Rahim bin Osman signed.', 'Please pass the file to LOH.\nYang benar,\n\nRAHIM\nPengurus']);
  assert.match(out[1], /^Please pass the file to \{\{PERSON_\d+\.SURNAME\}\}\.$/m);
  assert.match(out[1], /^\{\{PERSON_\d+\.FIRST\}\}$/m);
});

test('a name that is also an English word, alone in capitals, is kept but flagged; a month in capitals is neither', () => {
  const { out, unsure } = cloak(['Mark Tan and May Wong signed.', 'Sent to MARK.\nDue in MAY 2026 and BY MAY.']);
  assert.match(out[1], /^Sent to MARK\.$/m);
  assert.ok(unsure[1].includes('MARK'));
  assert.ok(!unsure[1].includes('MAY'));
});

// ---------------------------------------------------------------- 20: chat labels in capitals

test('chat contact names in capitals are hidden whole, short words included', () => {
  const chat = [
    '05/06/2025, 09:01 - TEOH SIEW PING: Lori sampai pukul 3',
    '05/06/2025, 09:02 - NOOR AZLINA: baik',
    '05/06/2025, 09:05 - KOH AH BENG: ok',
    '05/06/2025, 09:06 - GAN BK: noted',
  ].join('\n');
  const { out, unsure } = cloak([chat]);
  for (const line of out[0].split('\n')) assert.match(line, /^05\/06\/2025, 09:0\d - \{\{PERSON_\d+\}\}: /, line);
  assert.deepEqual(unsure[0], []);
});

test('a short word in capitals after a name in a mixed-case label is still a department, not a name', () => {
  const chat = ['05/06/2025, 09:01 - Jeremy HQ: Lori sampai', '05/06/2025, 09:02 - Noor Azlina: baik', '05/06/2025, 09:03 - Jeremy HQ: ok'].join('\n');
  const { out } = cloak([chat]);
  assert.match(out[0], /- \{\{PERSON_\d+\}\} HQ: Lori/);
});

// ---------------------------------------------------------------- 21: Hide works on what the check flags

test('Hide on a word that is a known name but was kept as an ordinary word hides it as written', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-fix21-'));
  const src = path.join(root, 'docs');
  await mkdir(src);
  await writeFile(path.join(src, 'a.txt'), 'We act for Abu bin Hassan (NRIC No. 700101-10-5555).\n');
  await writeFile(path.join(src, 'b.txt'), 'Abu drove the lorry to the site.\nthe bill was wrong. bill handles the tenancy files.\n');
  const { session } = await createMatter({ testMatter: true, dir: path.join(root, 'matter'), password: 'fix 21 password', user: 'reviewer', kdf: FAST });
  await session.cloakFolder({ folder: src });
  const file = () => session.run.files.find((f) => f.rel.endsWith('b.txt'));
  assert.match(file().cloaked, /^Abu drove the lorry/m);
  assert.ok(session.reviewData().unsure.some((u) => u.text === 'Abu'));
  await session.reviewAction({ type: 'add', text: 'Abu', kind: 'PERSON' });
  assert.match(file().cloaked, /^\{\{PERSON_\d+(?:\.[A-Z0-9]+)?\}\} drove the lorry/m);
  assert.ok(!session.reviewData().unsure.some((u) => u.text === 'Abu'));
  // The same for a lowercase word.
  session.matter.addPerson('Bill Chandran', 'test');
  session.reapply();
  assert.ok(session.reviewData().unsure.some((u) => u.text === 'bill'));
  await session.reviewAction({ type: 'add', text: 'bill', kind: 'PERSON' });
  assert.doesNotMatch(file().cloaked, /\bbill\b/);
});

// ---------------------------------------------------------------- 22: ordinary English words as names

test('surnames that are everyday English words are not hidden in lowercase prose', () => {
  const people = 'Mr Son Kok Leong (NRIC No. 700101-10-5555), Ms Wee Mei Ling (NRIC No. 710202-10-5566) and Mr Sun Hock Seng (NRIC No. 720303-10-5577) signed.';
  const prose = 'The sun was low. His son saw the wee lorry and will sue the yam seller at the market.';
  const { out } = cloak([people, prose, 'Mr Son and Ms Wee came. SON KOK LEONG left.']);
  assert.equal(out[1], prose);
  assert.doesNotMatch(out[0], /\b(?:Son|Wee|Sun)\b/);
  assert.doesNotMatch(out[2], /\b(?:Son|Wee|SON)\b/);
});

// ---------------------------------------------------------------- 23: department mailboxes

test('a department mailbox in an email header is not a person', () => {
  const header = 'From: Legal <legal@bukitjaya-holdings.example>\nTo: Billing <billing@supplier.example>\nCc: Helpdesk <helpdesk@supplier.example>, Hannah <hannah@supplier.example>';
  const { out } = cloak([header, 'Our legal fees and billing statement are due. The helpdesk will take legal action unless you pay.']);
  assert.match(out[0], /^From: Legal </m);
  assert.match(out[0], /^To: Billing </m);
  assert.match(out[0], /Cc: Helpdesk <\{\{EMAIL_\d+\}\}>, \{\{PERSON_\d+\}\} </);
  assert.equal(out[1], 'Our legal fees and billing statement are due. The helpdesk will take legal action unless you pay.');
});

// ---------------------------------------------------------------- 24: informal titles before a job word

test('an informal title before a job or a label word does not make that word a person', () => {
  const marks = 'Abang Delivery sampai pukul 9. Pak Security tak bagi masuk. Kak Cleaner datang. Uncle Taxi tunggu. Kak Kantin ada. Status: Ibu Tunggal. Waris: Adik Beradik Si Mati. Ah OK. Kak Mala sampai.';
  const prose = 'tunggu delivery di pintu. the security gate. kerja cleaner. naik taxi. pemilik tunggal. si mati telah mati. kantin sekolah.';
  const { out } = cloak([marks, prose]);
  assert.equal(out[1], prose);
  assert.match(out[0], /Abang Delivery sampai/);
  assert.match(out[0], /Pak Security tak/);
  assert.match(out[0], /Status: Ibu Tunggal\. Waris: Adik Beradik Si Mati\./);
  assert.match(out[0], /Kak \{\{PERSON_\d+\}\} sampai\./);
});

// ---------------------------------------------------------------- 25: roles in brackets

test('a party role in brackets is not another name for the party', () => {
  const heading = 'ANTARA\nRohani binti Kassim (Waris)\nDAN\nTeo Boon Kiat (Beneficiary)\nAnita Das a/p Raj (Penerima)\nChin Mei Fong (Nominee) (Spouse)';
  const prose = 'Setiap waris mesti hadir. The beneficiary and the nominee agreed. Penerima hadir. Spouse consent is needed. SENARAI WARIS';
  const { out, m } = cloak([heading, prose]);
  assert.equal(out[1], prose);
  for (const role of ['Waris', 'Beneficiary', 'Penerima', 'Nominee', 'Spouse']) assert.match(out[0], new RegExp(`\\(${role}\\)`));
  assert.ok(!m.cloak.entries.some((e) => /\.ALIAS/.test(e.token)), 'no role became an alias');
});

test('a nickname in brackets after a person is still joined to that person', () => {
  const { baseOf } = cloak(['Paiman bin Sulong (Pai) signed the lease.']);
  assert.equal(baseOf('Pai'), baseOf('Paiman bin Sulong'));
});

// ---------------------------------------------------------------- 26: diaries are not chats

test('lines of a case diary or a call log are not read as chat messages', () => {
  const diary = '07/08/2025, 9.00 - Hearing: Court fixed trial for 9/10/2025.\n09/10/2025, 9.30 - Mention: adjourned\n10/10/2025, 14:15 - Incoming Call: from client\n11/10/2025, 10:00 - Filing: bundle sent';
  const letter = 'We refer to the hearing and the mention. Please note the incoming call and the filing of the bundle.';
  const { out } = cloak([diary, letter]);
  assert.equal(out[1], letter);
  assert.doesNotMatch(out[0], /\{\{PERSON/);
});

test('a short quotation of two chat lines still hides a speaker whose label has a name in it', () => {
  const { out } = cloak(['As the chat shows:\n[12/03/2025, 10:15:01] Kak Ros: Barang dah sampai\n[12/03/2025, 10:16:30] Encik Zainal: ok']);
  assert.doesNotMatch(out[0], /Ros|Zainal/);
});

// ---------------------------------------------------------------- 27: other one-word rules

test('forms of address, form-field fillers, religions and interjections are not people', () => {
  const marks = [
    'Hi Mate,', 'Salam Bro,', 'Hi Dude, noted.', 'Witness: Nil', 'Signed: Blank', 'Tiada saksi.', 'Hadir: Chairman, Bendahari',
    'The student is Buddhist.', 'Thereupon, the supervisor left.', 'Aduh, the cashier fell.', 'The plot known as Lot 88 was sold.', 'Dipanggil ke mahkamah semalam.',
  ].join('\n');
  const prose = 'my mate came. witness nil. a buddhist temple. thereupon. aduh sakit. a lot of the parking lot. tiada orang. the bendahari agreed. bro said so.';
  const { out } = cloak([marks, prose]);
  assert.equal(out[1], prose);
  assert.doesNotMatch(out[0], /\{\{PERSON/);
});

test('a name before ", the driver" must close the phrase, so a sentence adverb is not a name', () => {
  assert.deepEqual(findNames('Thereupon, the driver left. Alamak, the worker fell.').filter((c) => c.kind === 'PERSON'), []);
  assert.deepEqual(findNames('Joko, another worker, saw it. Ah Seng, the driver of the lorry, came.').filter((c) => c.kind === 'PERSON').map((c) => c.text).sort(), ['Ah Seng', 'Joko']);
});

// ---------------------------------------------------------------- 28: a title at the end of a line

test('a name on the line after a wrapped title is flagged, or hidden when it is a name from the lists', () => {
  for (const [text, name] of [['The deed was witnessed by Encik\nSaharudin on the same day.', 'Saharudin'], ['The deed was witnessed by Encik\r\nSaharudin on the same day.', 'Saharudin'], ['Please call Mr.\nKowalczyk tomorrow.', 'Kowalczyk']]) {
    assert.ok(findSuspects(text).some((s) => s.text === name), `${name} is not flagged in ${JSON.stringify(text)}`);
    const { out, unsure } = cloak([text]);
    assert.ok(!out[0].includes(name) || unsure[0].includes(name), `${name} is neither hidden nor flagged`);
  }
  // A name from the word lists is hidden.
  assert.match(cloak(['Signed in the presence of Encik\nRahmat at noon.']).out[0], /Encik\s+\{\{PERSON_\d+\}\} at noon\./);
  // A full stop after a whole-word title still ends the sentence.
  for (const text of ['Thank you Puan.\nCabinets done today.', 'Terima kasih Encik. Jubin baru.']) {
    assert.ok(!findSuspects(text).some((s) => /Cabinets|Jubin/.test(s.text)), text);
    assert.deepEqual(findNames(text).filter((c) => c.kind === 'PERSON'), [], text);
  }
});

// ---------------------------------------------------------------- 29: counts are the same on a second run

test('cloaking the same folder twice gives the same words counted and the same output', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-fix29-'));
  const src = path.join(root, 'docs');
  await mkdir(src);
  await writeFile(path.join(src, 'note.txt'), 'Our driver, Joko, was late on 12 March.\n');
  await writeFile(path.join(src, 'chat one.txt'), 'joko dah sampai\n');
  await writeFile(path.join(src, 'chat two.txt'), 'joko pergi kedai dulu\n');
  const { session } = await createMatter({ testMatter: true, dir: path.join(root, 'matter'), password: 'fix 29 password', user: 'reviewer', kdf: FAST });
  const outputs = () => session.run.files.map((f) => f.cloaked).join('\n---\n');
  await session.cloakFolder({ folder: src });
  const first = outputs();
  const counts = JSON.stringify([...session.matter.seen.lower]);
  assert.match(first, /\{\{PERSON_1\}\} dah sampai/);
  await session.cloakFolder({ folder: src });
  assert.equal(outputs(), first);
  assert.equal(JSON.stringify([...session.matter.seen.lower]), counts);
});

test('learning a text again with { count: false } does not count its words again', () => {
  const m = new Matter();
  m.learn('The said party said so.');
  const before = JSON.stringify([...m.seen.lower]);
  m.learn('The said party said so.', { count: false });
  assert.equal(JSON.stringify([...m.seen.lower]), before);
  m.learn('The said party said so.');
  assert.notEqual(JSON.stringify([...m.seen.lower]), before);
  m.resetSeen();
  assert.equal(m.seen.lower.size, 0);
});

// ---------------------------------------------------------------- 30: Windows line endings

test('text with Windows line endings is read as the same text with Unix line endings', async () => {
  const lf = 'WITNESS STATEMENT OF PARTO\n\nI was there.\n\nPlease send the receipts.\n\nRegards,\nAdlina\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  const read = await extractBuffer('note.txt', Buffer.from(crlf));
  assert.equal(read.parts[0].text, lf.trim());
  // Rules that work by lines give the same result on CRLF text, even if it did not come through the reader.
  assert.deepEqual(findNames(crlf), findNames(lf));
  const { out } = cloak([crlf]);
  assert.doesNotMatch(out[0], /PARTO|Adlina/);
  assert.equal(out[0], cloak([lf]).out[0]);
  assert.match(out[0], /OF \{\{PERSON_\d+\}\}\n/);
});

// ---------------------------------------------------------------- 31: Teh

test('"Teh" after Ah, Uncle or Aunty is the surname; after Mak or Pak it is still a birth-order word', () => {
  const { out } = cloak(['Uncle Teh sells kuih. Aunty Teh helps. Ah Teh closed early.']);
  assert.doesNotMatch(out[0], /Teh/);
  assert.deepEqual(findNames('Mak Teh and Pak Long came.').filter((c) => c.kind === 'PERSON'), []);
  assert.match(cloak(['Uncle Teh sells kuih.', 'minum teh tarik']).out[1], /^minum teh tarik$/);
});

// ---------------------------------------------------------------- 32 and 33: no catastrophic backtracking

const LONG = 50000;
const long = (unit) => unit.repeat(Math.ceil(LONG / unit.length));
function seconds(fn) {
  const t = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - t) / 1e9;
}

test('lines of 50,000 characters do not make the chat or title rules stall', () => {
  const cases = {
    'spaces after a chat time stamp': `12/03/2024, 10:15 - ${' '.repeat(LONG)}`,
    'tabs after a chat time stamp': `12/03/2024, 10:15 - ${'\t'.repeat(LONG)}`,
    'spaces after an iPhone time stamp': `[12/03/2024, 10:15:01] ${' '.repeat(LONG)}`,
    'a very long chat label': `12/03/2024, 10:15 - ${'a'.repeat(LONG)}`,
    'many chat heads': long('12/03/2024, 10:15 - aaaa '),
    'Mr repeated after Dear': `Dear ${long('Mr ')}1`,
    'Mr repeated after a role': `the driver, ${long('Mr ')}x`,
    'Mak Cik repeated': `Dear ${long('Mak Cik ')}1`,
    'Toh Puan repeated': `Dear ${long('Toh Puan ')}1`,
    'Dato Seri repeated': `Dear ${long("Dato' Seri ")}1`,
    'mixed titles': `Hello ${long('Encik Dr Puan Mr. Kak ')}x`,
    'wrapped titles': long('Encik\n'),
    'capitalised words with bin': long('Ahmad bin '),
  };
  for (const [name, text] of Object.entries(cases)) {
    assert.ok(text.length >= LONG, name);
    const found = seconds(() => findNames(text));
    assert.ok(found < 3, `findNames took ${found.toFixed(1)} s on ${name}`);
    const learned = seconds(() => new Matter({ options: { level: 'strict' } }).learn(text));
    assert.ok(learned < 3, `learn took ${learned.toFixed(1)} s on ${name}`);
    const suspects = seconds(() => findSuspects(text));
    assert.ok(suspects < 3, `findSuspects took ${suspects.toFixed(1)} s on ${name}`);
  }
});

test('long runs of letters and dots, and long runs of capitalised words, are read without a stall or an error', () => {
  for (const text of ['a'.repeat(LONG), '.'.repeat(LONG), long('Ahmad '), long('Mak Cik ')]) {
    const t = seconds(() => { new Matter({ options: { level: 'strict' } }).learn(text); findSuspects(text); });
    assert.ok(t < 3, `took ${t.toFixed(1)} s`);
  }
});

test('titles still read the same after the pattern was made unambiguous', () => {
  const { out } = cloak(['Dato\' Seri Lim Kok Wing met Toh Puan Sharifah Aminah and Mak Cik Senah. Pak Cik Dolah, Tan Sri Ong Hock Tee and Puan Sri Rose Lee came. Yang Berhormat Dr. Kavitha Nair spoke.']);
  assert.doesNotMatch(out[0], /Lim|Kok|Wing|Sharifah|Aminah|Senah|Dolah|Ong|Hock|Kavitha|Nair/);
  assert.match(out[0], /Mak Cik \{\{PERSON_\d+\}\}/);
  assert.match(out[0], /Pak Cik \{\{PERSON_\d+\}\}/);
  assert.match(out[0], TAG);
});
