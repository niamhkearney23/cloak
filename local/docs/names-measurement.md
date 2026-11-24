# Missed names: how the name rules were measured

All documents used here are made up. The owner's own test set was not read or
used.

## The protocol

1. **A held-out matter was written first** (`test/heldout/make.js`, committed
   as `14f8de6` before any change to the name rules). It is 15 made-up files
   about a landscaping subcontract dispute in Johor: two Word pleadings and
   letters, a witness statement as text, two WhatsApp exports (Android and
   iPhone formats), three informal file notes, three emails, two
   spreadsheets and a PDF letter. Its story, names and style differ from
   `test/matter.js`.
2. Every real name in it is marked in the generator, and so is every
   ordinary word that must stay readable ("traps"). A check refuses to write
   the files if any listed string appears anywhere without a mark, so the
   marks are the full list of real values. The lists are exported as
   `REAL_VALUES` (105 values, 278 places) and `TRAPS` (27 words, 74 places).
3. **The rules were developed against a different made-up matter**
   (`test/namesdev/`), never against the held-out matter.
4. The held-out matter is measured twice only: once before any change (below)
   and once at the end, with no change made after seeing the final result.

## How a result is judged

`node test/names-measure.js heldout` cloaks the matter the way the app does
(a new Strict matter, every file read, the whole folder learned first, then
each file cloaked), then lines up what was read from each file with its
cloaked copy word by word. Each marked place is judged on its own:

| Result | Meaning |
|---|---|
| hidden | every word of the name is gone from the cloaked copy |
| flagged | a word of it is still there, but that word (as written, in that file) is on the "not sure" list a reviewer must decide |
| partly | some words were hidden, others are still readable and not flagged (the words before or after a hidden name) |
| missed | still readable and not flagged: a silent miss |

A trap is **kept**, **kept but flagged** (it costs the reviewer a decision),
**over-hidden** (replaced by a person or company tag) or **blurred as a fact**
(a date or other Strict tag, which is not a name rule). Anything else hidden
as a person or company where no real name is marked is counted as **other
over-hiding**. Titles (Encik, Kak, Pak, Mr, Ah...) and name particles (bin,
a/l...) may stay visible and are not counted.

A lowercase name counts as flagged only if the lowercase word itself is on
the list: a reviewer who hides "Joko" does not hide "joko".

## Before: the engine as it was (detector code of commit `1c9717c`)

Held-out matter, 15 files. The result was the same with the setup screen
left empty and with the client and the other side typed in.

| Names | total | hidden | flagged | partly | missed |
|---|---:|---:|---:|---:|---:|
| Malay full name | 14 | 13 | 0 | 1 | 0 |
| Chinese full name | 19 | 15 | 1 | 0 | 3 |
| Indian full name | 3 | 3 | 0 | 0 | 0 |
| English or other full name | 5 | 4 | 1 | 0 | 0 |
| Indonesian / Javanese single name | 36 | 0 | 26 | 0 | 10 |
| Nickname | 16 | 5 | 6 | 0 | 5 |
| First name or short form used alone | 31 | 25 | 3 | 0 | 3 |
| Title + single name | 38 | 21 | 16 | 0 | 1 |
| Chat speaker label | 32 | 14 | 14 | 0 | 4 |
| Email greeting or sign-off name | 7 | 4 | 1 | 0 | 2 |
| Lowercase name in informal text | 26 | 0 | 0 | 0 | 26 |
| Initials | 2 | 0 | 0 | 0 | 2 |
| Name inside an email address | 6 | 6 | 0 | 0 | 0 |
| Company | 43 | 38 | 0 | 2 | 3 |
| **All** | **278** | **148** | **68** | **3** | **59** |

| Traps (ordinary words) | total | kept | kept, flagged | over-hidden | blurred as a fact |
|---|---:|---:|---:|---:|---:|
| grace / Grace | 9 | 7 | 0 | **2** | 0 |
| Mark / mark | 3 | 1 | 0 | **2** | 0 |
| May / may | 10 | 4 | 0 | 0 | 6 (the month, in dates) |
| will / Will | 15 | 15 | 0 | 0 | 0 |
| dan / Dan / DAN | 6 | 6 | 0 | 0 | 0 |
| rose, ros | 8 | 8 | 0 | 0 | 0 |
| long / Long | 4 | 4 | 0 | 0 | 0 |
| hope / Hope, faith, joy | 9 | 9 | 0 | 0 | 0 |
| indah, selamat / Selamat, mak, boss | 7 | 7 | 0 | 0 | 0 |
| Bill / bill, Pierre | 3 | 1 | 2 | 0 | 0 |
| **All traps** | **74** | **62** | **2** | **4** | **6** |

Other over-hiding: 1 stretch hidden as a name where no real name is, and 3
stretches where ordinary words were hidden together with a real name.

In short: before the change, 59 of 278 name places (21%) were silent misses
and 3 more were partly hidden. Every lowercase name was missed silently, and
so were a third of the single Indonesian names, a third of the nicknames and
both sets of initials. Four ordinary words were over-hidden ("Grace" in
"Grace Period" and "Grace period", "Mark" in "Mark the pallets", twice),
because "Grace" and "Mark" were also people in the matter.

### Miss rate on made-up names (`node test/miss-rate.js`), before

| Group | hidden | flagged | missed silently |
|---|---:|---:|---:|
| Malay (with bin / binti) | 100 | 0 | 0 |
| Malay (no bin / binti) | 90 | 10 | 0 |
| Chinese | 100 | 0 | 0 |
| Indian (with a/l / a/p) | 100 | 0 | 0 |
| Indian (no a/l / a/p) | 88 | 12 | 0 |
| English | 82 | 18 | 0 |

## After: the new name rules (detector code of commit `2e3878a`)

Measured once, after the last change to the rules. Nothing was changed after
this result was seen. Same matter, same method. The result was again the same
with the setup screen empty and with the client and the other side typed in.

| Names | total | hidden | flagged | partly | missed |
|---|---:|---:|---:|---:|---:|
| Malay full name | 14 | 13 (13) | 0 (0) | 1 (1) | 0 (0) |
| Chinese full name | 19 | 19 (15) | 0 (1) | 0 (0) | 0 (3) |
| Indian full name | 3 | 3 (3) | 0 (0) | 0 (0) | 0 (0) |
| English or other full name | 5 | 4 (4) | 1 (1) | 0 (0) | 0 (0) |
| Indonesian / Javanese single name | 36 | 36 (0) | 0 (26) | 0 (0) | 0 (10) |
| Nickname | 16 | 12 (5) | 0 (6) | 0 (0) | **4** (5) |
| First name or short form used alone | 31 | 30 (25) | 1 (3) | 0 (0) | 0 (3) |
| Title + single name | 38 | 38 (21) | 0 (16) | 0 (0) | 0 (1) |
| Chat speaker label | 32 | 32 (14) | 0 (14) | 0 (0) | 0 (4) |
| Email greeting or sign-off name | 7 | 7 (4) | 0 (1) | 0 (0) | 0 (2) |
| Lowercase name in informal text | 26 | 21 (0) | 3 (0) | 0 (0) | **2** (26) |
| Initials | 2 | 2 (0) | 0 (0) | 0 (0) | 0 (2) |
| Name inside an email address | 6 | 6 (6) | 0 (0) | 0 (0) | 0 (0) |
| Company | 43 | 43 (38) | 0 (0) | 0 (2) | 0 (3) |
| **All** | **278** | **266** (148) | **5** (68) | **1** (3) | **6** (59) |

Before-numbers in brackets.

| Traps (ordinary words) | total | kept | kept, flagged | over-hidden | blurred as a fact |
|---|---:|---:|---:|---:|---:|
| grace / Grace | 9 | 7 | 2 | **0** (2) | 0 |
| Mark / mark | 3 | 1 | 2 | **0** (2) | 0 |
| May / may | 10 | 3 | 1 | 0 | 6 (the month, in dates) |
| will / Will | 15 | 15 | 0 | 0 | 0 |
| dan / Dan / DAN | 6 | 4 | 2 | 0 | 0 |
| rose, ros | 8 | 8 | 0 | 0 | 0 |
| long / Long | 4 | 4 | 0 | 0 | 0 |
| hope / Hope, faith, joy | 9 | 9 | 0 | 0 | 0 |
| indah, selamat / Selamat, mak, boss | 7 | 6 | 1 | 0 | 0 |
| Bill / bill, Pierre | 3 | 1 | 2 | 0 | 0 |
| **All traps** | **74** | **58** (62) | **10** (2) | **0** (4) | **6** (6) |

### What is still wrong in the held-out matter, every case

Silent misses (6):

- **"Will"**, William Teo's nickname, four times ("check with Will", "Will
  (their contracts manager)", "Will has asked me", "Will to remeasure palms").
  No document ties "Will" to William Teo, and "will" is an ordinary word, so no
  rule learns it and capitalised ordinary words are not put on the "not sure"
  list. English short forms (William → Will, Robert → Bob...) are not built.
- **"hakim"** in "by hakim" (the pupil's name in lowercase). "hakim" also means
  judge, so in lowercase it is only flagged where the words around it read as
  a name, and "by hakim" does not.
- **"may"** in "he mentioned that may from ombak biru accounts called". It
  would be flagged in "may from", but "that" before it is also a determiner,
  which stops the flag.

Partly hidden (1): **"Azura binti Mat Saman"** under "Yours faithfully":
"Saman" (a summons, in Malay) is taken for an ordinary word and left visible.
This was already so before.

Flagged, not hidden (5): "indah", "mark" and "may" in lowercase in chats
("indah tolong ambil gambar", "mark says", "may said"), and "Joy" and
"Joy Santos" in a file note, which no rule recognises.

Over-hiding of ordinary words or places (4 stretches; before: 4):

- **New, caused by this work:** the word "ask" was hidden in a file note ("ask
  kak ros for the DO originals"). An older rule had learned "Ask Firdaus" as
  one person from the sentence "Ask Firdaus whether Indah can give evidence";
  because known names are now also found in lowercase, "ask" was then hidden.
  Not fixed: it was seen in the final measurement. The fix is to drop a verb
  at the start of a two-word run in that older rule and never to match a
  known first name that is a common verb in lowercase.
- Already there before: "Ask Firdaus" hidden as one name (the word "Ask"
  with it); the town "Pasir Gudang" hidden as a person after "to"; an address
  line hidden together with the company name above it (hidden either way,
  but under the company's tag).
- Fixed: "Kebun Hijau Team" (a WhatsApp group in a file name) was hidden as a
  person.

Cost to the reviewer: ordinary words that land on the "not sure" list went
from 2 to 10 places out of 74.

### Miss rate on made-up names, after

Unchanged: Malay with bin / binti 100 hidden; Malay without 90 hidden, 10
flagged; Chinese 100; Indian with a/l / a/p 100; Indian without 88 hidden, 12
flagged; English 82 hidden, 18 flagged; no silent miss in any group. These are
full names in five kinds of sentence, which the new rules do not target.

### The development matter (`test/namesdev/`), for comparison

13 files, 154 marked name places, 34 trap places. The rules were developed
against this matter, so it is not a fair test; it is shown so the held-out
result can be compared with it.

| | hidden | flagged | partly | missed | traps over-hidden | other over-hiding |
|---|---:|---:|---:|---:|---:|---:|
| Original engine | 82 | 47 | 0 | 25 | 2 | 3 |
| New rules | 146 | 8 | 0 | 0 | 0 | 0 |

The two traps the original engine over-hid are the reported case "Thank you
Puan. Cabinets done today." and the same with "Encik.".

## How far to trust these numbers

- **The same agent wrote the held-out matter, the development matter and the
  rules.** The held-out matter was written and committed first, and its
  results were not looked at while the rules were developed, but its author
  knew what kinds of name it contained. The held-out result is therefore
  better than a test written by someone else would give. The owner's own test
  set is the real check.
- One small matter of 15 files is not a statistic. The counts show which kinds
  of name are handled, not a miss rate for real bundles.
- "Flagged" only helps if a reviewer acts on the "not sure" list, and a
  lowercase ordinary word on that list cannot be hidden in one place only
  (see `names.md`).
- The made-up names avoid real people and real disputes; real documents have
  more variety (spellings, OCR errors, mixed scripts) than either matter.

## After the review fixes (names items 19 to 33)

Same method, same matters, no change to `test/heldout/` or its marks, run before and after the fixes. Names table of the held-out matter: identical (266 hidden, 5 flagged, 1 partly, 6 missed of 278). Traps: 58 kept and 10 flagged before; 57 kept and 11 flagged after. The one change is "DAN" alone in capitals (a heading): it was kept silently and is now kept and flagged, because an all-capitals ordinary word that is a known name must be hidden or flagged, never silently left (cost: one more decision for a reviewer). Over-hiding of ordinary words: 0 before, 0 after. Development matter: no change. Miss rate on made-up names: no change.

Not done on purpose: lowercase matching was not switched off for one-word names learned by context rules, because that would bring back silent misses of lowercase names such as "joko"; the rules were narrowed instead.
