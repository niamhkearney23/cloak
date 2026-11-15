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
