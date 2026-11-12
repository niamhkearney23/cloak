// Measures how often automatic name detection misses a name.
//
// 100 made-up names per group, each dropped into one of five kinds of
// sentence, each tested on a fresh matter so nothing learned from one name
// helps another. A name counts as MISSED if any word of it is still readable
// in the cloaked text. "Flagged" means it was not hidden but did land on the
// "not sure" list a person reviews.
//
// Run:  node test/miss-rate.js

import { Matter } from '../engine.js';

const pick = (list, i) => list[i % list.length];

const MALAY_M = ['Hairul Azreen', 'Khairy', 'Shahrizal', 'Nazmi', 'Fikri', 'Danial', 'Irfan', 'Aiman', 'Hakimi', 'Izzat', 'Afiq', 'Syahir', 'Rosman', 'Jamaluddin', 'Kamaruddin', 'Norazman', 'Zainol', 'Fadhil', 'Ikhwan', 'Mohd Shahril', 'Muhammad Haziq', 'Ahmad Zaki', 'Abdul Malik', 'Nik Nazmi', 'Tengku Adnan', 'Che Zakaria', 'Wan Azlan', 'Megat Iskandar', 'Syed Naquib', 'Md Nor'];
const MALAY_F = ['Nurul Huda', 'Siti Hajar', 'Noraishah', 'Farhana', 'Syafiqah', 'Wan Azizah', 'Nor Hidayah', 'Nur Syazana', 'Rosmah', 'Zaiton', 'Marlina', 'Suhana', 'Juliana', 'Hasmah', 'Normala', 'Sharifah Aini', 'Puteri Balqis', 'Che Rohana', 'Fazura', 'Ezlynn'];
const MALAY_FATHER = ['Rahman', 'Ibrahim', 'Yusof', 'Osman', 'Salleh', 'Hamid', 'Daud', 'Jusoh', 'Mat Isa', 'Awang', 'Che Mat', 'Samsudin', 'Baharom', 'Kassim', 'Ngah', 'Deraman', 'Sidek', 'Tahir', 'Wahab', 'Zain', 'Abu Bakar', 'Mohd Noor', 'Haji Ali'];

const CHINESE_SUR = ['Tan', 'Lim', 'Lee', 'Wong', 'Ng', 'Chan', 'Chong', 'Teoh', 'Khaw', 'Loo', 'Yeoh', 'Ooi', 'Kuan', 'Phoon', 'Hiew', 'Liong', 'Tiong', 'Wee', 'Sia', 'Kok', 'Leow', 'Chooi', 'Gan', 'Yap', 'Foo', 'Kiu', 'Bong', 'Lau', 'Choo', 'Hee'];
const CHINESE_GIVEN = ['Ah Kow', 'Boon Keat', 'Chee Seng', 'Wei Ming', 'Jia Hui', 'Mei Fong', 'Siew Ling', 'Kok Leong', 'Yee Ling', 'Soo Kim', 'Hock Seng', 'Li Na', 'Xin Yi', 'Zhi Hao', 'Kar Mun', 'Swee Lan', 'Poh Choo', 'Eng Huat', 'Chun Hoe', 'Pei Shan', 'Guan Eng', 'Kit Siang', 'Wai Kit'];
const CHINESE_ENG = ['Jason', 'Vivian', 'Kelvin', 'Adeline', 'Desmond', 'Eunice', 'Alvin', 'Jocelyn', 'Darren', 'Cheryl'];

const INDIAN_M = ['Ravi', 'Suresh', 'Kumaran', 'Thinesh', 'Prakash', 'Logeswaran', 'Dhanabalan', 'Ganesan', 'Jeevan', 'Nanthakumar', 'Tamilselvan', 'Uthaya', 'Vigneswaran', 'Harpreet', 'Sivarajan', 'Mogan', 'Kesavan', 'Darshan', 'Yuvaraj', 'Baskaran'];
const INDIAN_F = ['Yogeswari', 'Kavitha', 'Shalini', 'Vimala', 'Pushpavathi', 'Sangeetha', 'Thanaletchumi', 'Jayanthi', 'Malathi', 'Revathi', 'Sarojini', 'Indrani', 'Komathi', 'Navaneetha', 'Bhavani'];
const INDIAN_FATHER = ['Muthu', 'Subramaniam', 'Krishnan', 'Ramasamy', 'Perumal', 'Arumugam', 'Govindasamy', 'Balakrishnan', 'Maniam', 'Sinnasamy', 'Kandiah', 'Nadarajah', 'Rajoo', 'Veerappan', 'Munusamy', 'Thangavelu', 'Chelliah', 'Ponniah', 'Letchumanan', 'Singh', 'Appadurai', 'Sockalingam', 'Kaur'];

const ENGLISH_FIRST = ['Oliver', 'Charlotte', 'Declan', 'Fiona', 'Graham', 'Imogen', 'Callum', 'Bronwyn', 'Rupert', 'Saoirse', 'Hamish', 'Georgina', 'Lachlan', 'Tamsin', 'Angus', 'Philippa', 'Dermot', 'Harriet', 'Giles', 'Rosalind', 'Michael', 'Sarah', 'Peter', 'Emma', 'Tobias'];
const ENGLISH_LAST = ['Whitfield', "O'Connor", 'Fitzgerald', 'Baker', 'Hughes', 'Pemberton', 'Sinclair', 'MacDonald', 'Ashworth', 'Greenwood', 'Davies', 'Kowalski', 'Abernathy', 'Holloway', 'Blackwood', 'Carmichael', 'Dunleavy', 'Ellison', 'Fairbairn', 'Gallagher', 'Mason', 'Wood', 'Hill'];

function names(group, n = 100) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const j = i * 7 + Math.floor(i / 5);
    if (group === 'Malay (with bin / binti)' || group === 'Malay (no bin / binti)') {
      const female = i % 3 === 0;
      const given = female ? pick(MALAY_F, i) : pick(MALAY_M, i);
      out.push(group.includes('with') ? `${given} ${female ? 'binti' : 'bin'} ${pick(MALAY_FATHER, j)}` : `${given} ${pick(MALAY_FATHER, j)}`);
    } else if (group === 'Chinese') {
      out.push(i % 5 === 4 ? `${pick(CHINESE_ENG, i)} ${pick(CHINESE_SUR, j)}` : `${pick(CHINESE_SUR, j)} ${pick(CHINESE_GIVEN, i)}`);
    } else if (group === 'Indian (with a/l / a/p)' || group === 'Indian (no a/l / a/p)') {
      const female = i % 3 === 0;
      const given = female ? pick(INDIAN_F, i) : pick(INDIAN_M, i);
      out.push(group.includes('with') ? `${given} ${female ? 'a/p' : 'a/l'} ${pick(INDIAN_FATHER, j)}` : `${given} ${pick(INDIAN_FATHER, j)}`);
    } else out.push(`${pick(ENGLISH_FIRST, i)} ${pick(ENGLISH_LAST, j)}`);
  }
  return out;
}

// Several wordings per kind of sentence, so the result does not depend on
// one lucky phrase.
const v = (list) => (n, i) => list[Math.floor(i / 5) % list.length](n);
export const CONTEXTS = [
  ['after a title', v([(n) => `On that day Mr ${n} attended the office.`, (n) => `Pada hari itu Encik ${n} hadir di pejabat tersebut.`, (n) => `I spoke to Puan ${n} twice.`, (n) => `The car belongs to Dr ${n}.`])],
  ['next to an NRIC', v([(n) => `The agreement was signed by ${n} (NRIC No. 900101-10-5555) in the presence of a witness.`, (n) => `Saya, ${n} (No. K/P: 900101-10-5555), berikrar seperti berikut.`])],
  ['plain, mid-sentence', v([(n) => `The cheque was collected by ${n} on Monday.`, (n) => `Cek itu telah diambil oleh ${n} pada hari Isnin.`, (n) => `I have known ${n} since 2015.`, (n) => `Pembayaran itu hanya melibatkan ${n} sahaja.`, (n) => `Outside the shop, ${n} was waiting in a car.`, (n) => `The house where ${n} lives was sold.`])],
  ['capitals in a heading', v([(n) => `ANTARA\n\n${n.toUpperCase()}                    ... PLAINTIF\n\nDAN`, (n) => `AFFIDAVIT OF ${n.toUpperCase()}\n\nI state as follows.`, (n) => `IN THE ESTATE OF ${n.toUpperCase()}, DECEASED`])],
  ['plain, start of sentence', v([(n) => `${n} told the Plaintiff that the deposit would be refunded.`, (n) => `${n} is my neighbour.`, (n) => `${n} tidak hadir pada hari tersebut.`, (n) => `${n} then left the room without a word.`])],
];

const SKIP = /^(?:bin|binti|a\/l|a\/p|mohd|muhammad|md|abdul|nur|nurul|nor|siti|wan|nik|che|tengku|syed|megat|puteri|sharifah|haji|mat|abu|ah)$/i;

export function testName(name, contextIndex, i = 0) {
  const text = CONTEXTS[contextIndex][1](name, i);
  const m = new Matter();
  m.register(m.learn(text));
  const out = m.apply(text);
  const words = name.split(/\s+/).filter((w) => w.length >= 3 && !SKIP.test(w));
  const left = words.filter((w) => new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(out.replace(/\{\{[^}]+\}\}/g, ' ')));
  if (!left.length) return 'hidden';
  const flagged = m.unsure(out).some((u) => left.some((w) => u.text.toLowerCase().includes(w.toLowerCase())));
  return flagged ? 'flagged' : 'missed';
}

export const GROUPS = ['Malay (with bin / binti)', 'Malay (no bin / binti)', 'Chinese', 'Indian (with a/l / a/p)', 'Indian (no a/l / a/p)', 'English'];

export function measure() {
  const rows = [];
  for (const group of GROUPS) {
    const row = { group, total: 0, hidden: 0, flagged: 0, missed: 0, byContext: CONTEXTS.map(() => ({ total: 0, notHidden: 0 })), examples: [] };
    names(group).forEach((name, i) => {
      const c = i % CONTEXTS.length;
      const result = testName(name, c, i);
      row.total++;
      row[result]++;
      row.byContext[c].total++;
      if (result !== 'hidden') { row.byContext[c].notHidden++; if (row.examples.length < 6) row.examples.push(`${name} [${CONTEXTS[c][0]}: ${result}]`); }
    });
    rows.push(row);
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const r of measure()) {
    console.log(`\n${r.group}: ${r.total} names. Hidden ${r.hidden}. Not hidden ${r.total - r.hidden} (flagged for review ${r.flagged}, missed silently ${r.missed}).`);
    console.log('  by sentence type: ' + r.byContext.map((c, i) => `${CONTEXTS[i][0]} ${c.notHidden}/${c.total}`).join('; '));
    if (r.examples.length) console.log('  e.g. ' + r.examples.join(' | '));
  }
}
