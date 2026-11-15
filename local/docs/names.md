# How Cloak finds names, and what it still misses

Cloak finds people with rules and word lists, on this computer. It does not
use an AI model and it is not perfect. Measured results are in
`names-measurement.md`; this page says what the rules do and where they fail.

Every rule below works the same way: a name found in one file is hidden in
every file of the matter, under one tag, in any form it was found in.

## What is found

**Full names (as before).** Names with bin, binti, a/l, a/p, s/o, d/o or @;
names after a title (Encik, Puan, Dato' Sri, Dr...); names next to an NRIC or
passport number; party lines in court headings; capitalised runs that contain
a name from the lists in `names.js`.

**Chat exports.** In a WhatsApp export, the name before the colon is a person:
`22/03/2025, 07:02 - Kak Ros: ...` (Android) and `[22/03/2025, 07:02:45] Firdaus
Kamarul: ...` (iPhone), with 12- or 24-hour times. A contact name often has
words that describe the person: "Kala Manager", "Mani Lorry", "Alvin Ombak
Biru". The describing words (Manager, Lorry, Admin, Dapur, Nursery...) and
company names already known are left as they are; the rest is the name. An
unsaved number is hidden as a phone number.

**Titles before one name.** The formal titles, and the informal ones used in
Malaysian and Singapore notes and chats: Kak, Kakak, Abang, Abg, Adik, Dik,
Pak, Mak, Mak Cik, Pak Cik, Uncle, Aunty, Ibu, Bu, Mbak, and the Chinese "Ah"
("Ah Seng"). The title stays visible ("Kak {{PERSON_1}}"). Three limits keep this
safe:

- A title only claims a name **in the same sentence and on the same line**.
  A dot may follow an abbreviation ("Mr.", "Dr.", "En.", "Hj."), but after a
  whole word it ends the sentence: "Thank you Puan. Cabinets done today."
  names nobody.
- An informal title starts a name; it is not part of one: "Tan Ah Kow" is one
  person.
- A birth-order word after a family title is part of the title: "Mak Long",
  "Pak Ngah" name nobody on their own.

**People who say who they are.** "My name is Sutarno", "Nama saya Ani",
"I, Sutarno (Passport No. ...)", "Saya, Ani,", "Hi this is Rubel".

**One name alone on a heading line.** "WITNESS STATEMENT OF SUTARNO",
"AFIDAVIT MARGONO". Words that are not names ("AFIDAVIT SOKONGAN") are left.

**Other names a person goes by.** "(also known as Benny Khoo)", "known in the
family as Angah", "juga dikenali sebagai Kak Mala", "calls me Kala", "everyone
calls him Gono", "whom the staff call Uncle Khoo", "calls Sukirman "Kirman"",
a nickname in brackets after a name, and a quoted short name in brackets.
Each is joined to the person it belongs to and gets that person's tag. Joins
the tool makes this way are listed on the review screen under **Joined
names**, to confirm or split.

**Letters, emails and forms.** Greetings ("Hi Bernice,", "Salam Aiman,",
"Dear Puan Normala,") and sign-offs (the name line after Regards, Thanks,
Cheers, Yours sincerely, Terima kasih, Salam...; or "Thanks, Ray" on one line).
"Dear Sirs", "Hi all", "Hi Team", "Salam Aidilfitri" name nobody. A one-word
display name in an email header ("Bernice <...>"). Form lines: "Nama:",
"Name:", "Signed:", "Tandatangan:", "Witness:", "Received by:"...

**File notes and spreadsheets.** Lists of those present ("Present: Puan
Mazlina, Jeremy (us); Kala (client)"); tasks ("Sharon to open a new file",
when the name is in the name lists); the initials of a known person where a
note signs them ("Attendance: JN", or "JN" alone on the last line), but not
elsewhere; spreadsheet columns of people (cells under Name, Nama, Supervisor,
Penyelia, Certified by, Received by, Approved by...) and the cell after a row
label such as "Prepared by".

**A name next to a role.** "one Rubel" (legal letters); "the lorry driver,
Ah Seng,", "Our cook, Margono,", "Joko, another worker,", "Pembantu saya ialah
Sutinah", "The workers under me are Ani, Budi and Wati". Only roles a company
cannot have count (driver, cook, clerk, wife, foreman...); "our client, Seri
Kembara" may be a company and is left to the company rules.

**Firms with initials.** "K.S. Rao & Co" is one company; the initials are not
left behind.

**The name a person goes by.** In "Mohd Firdaus bin Kamarul Ariffin" the
first name is Firdaus, so "Encik Firdaus" becomes "Encik {{PERSON_1.FIRST}}".

## Lowercase, and names that are ordinary words

**Known names are also found in lowercase**: "ask darsono", "ah seng used the
old DO", "ombak biru QS". A name inside an email address is left to the email
rule.

**Names that are also ordinary English or Malay words** (Grace, Hope, Faith,
Joy, Rose, May, Will, Mark, Bill, Ray, Sunny, Dan, Long, Indah, Intan, Ros,
Kala, Mala, Zahir, Hakim, Hari...; the list is `ORDINARY` in `names.js`) are
handled with care:

- In lowercase they are **never hidden** as ordinary words: "grace period",
  "a joy", "dan", "bunga ros", "pemandangan indah", "kadang-kala" stay.
  After a title they are a name and are hidden: "kak ros".
- Where a lowercase one reads as the person ("may said the cheque is ready",
  "bill handles the files", "met kala and angah") it goes on the **"not sure"**
  list instead of being hidden.
- With a capital, at the start of a sentence, they are only hidden when what
  follows reads as a name: "May is preparing it" is hidden, "May we remind
  you", "Mark the pallets", "Grace period over already" and '"Grace Period"
  means' are kept and put on the "not sure" list. After "the" or "a" ("the
  Bill of Quantities") and as a month ("by the end of May") they are kept. A
  word alone in capitals ("DAN" in a court heading) is kept.
- A known one-word name that this matter writes in lowercase in three or more
  files, more often than with a capital, is treated the same way, so a person
  called Said or Page does not make every "said" or "page" disappear.

## What it still misses or gets wrong

These are known and measured. None of them is fixed by the rules above.

- **A nickname nobody explains that is also an ordinary word.** "Will" for
  William Teo, when no document says so ("Will has asked me"): not hidden and
  not flagged. English short forms (William → Will or Bill, Robert → Bob,
  Elizabeth → Liz) are not linked to full names.
- **A lowercase ordinary-word name in a place that does not read as a name**
  ("by hakim", "he mentioned that may from accounts called"): silent miss.
- **The "not sure" list cannot hide one place.** If a reviewer chooses to
  hide a flagged word such as "may", "bill" or "Abu", the word written
  exactly like that is hidden in every place in the matter, ordinary uses
  included (the same word written another way is judged on its own). The tool to
  hide one highlighted place is not built. For now, leave such a word as it
  is and correct the cloaked copy by hand, or edit the source.
- **More reading on the "not sure" list.** Ordinary words that may be names
  are now flagged where they could be the person; on the held-out matter
  this rose from 2 to 10 of 74 ordinary-word places.
- **The last word of a name that is an ordinary Malay word** can be left
  visible: "Azura binti Mat Saman" leaves "Saman" (a summons).
- **A single name with no clue at all**: no title, role, list, heading, chat
  label, signature or other mention ("Joko said so" when Joko appears
  nowhere else). Flagged if capitalised in mid-sentence; missed if in
  lowercase, or at the start of a sentence and not in the name lists.
- **Over-hiding that remains.** A sentence that starts with a verb before a
  name ("Ask Firdaus whether...") can be learned as one name, "Ask Firdaus";
  because known names are now found in lowercase, the word "ask" was then
  hidden elsewhere in that matter. A town after "to" ("to Pasir Gudang") can
  be hidden as a person. An address line right under a company name can be
  hidden with the company, under the company's tag.
- **Chat contacts saved as a role or a relationship** ("Boss", "Mak",
  "Hubby") are not names, so the person behind them is not hidden there.
- **File and folder names** in ordinary capitals ("Witness statement of
  Darsono") only put the words on the "not sure" list; nothing is guessed
  from them, as before.
- **Joins can be wrong.** A nickname is joined to the last person named before
  "calls him"; check the Joined names list.
- **Names in Chinese, Tamil or Jawi script**: the file is held for a manual
  check, as before.
- The word lists (`ORDINARY`, `KIN_TITLES`, `LABEL_WORDS`, `ROLE_NOUNS`,
  `PERSON_HEADERS`, `NOT_NAMES` in `names.js`) are incomplete by nature. A
  name that is an ordinary word not on the list, written in lowercase in only
  one or two files, can still hide that word.

## Tests

`test/names.test.js` has one test per rule, on made-up names. The development
matter is `test/namesdev/`; the held-out matter, measured only before and
after, is `test/heldout/` (`node test/names-measure.js heldout`).
