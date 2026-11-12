# Cloak for the desktop (in progress)

Cloaks a whole folder of documents on this computer. Nothing is sent anywhere:
the code in this folder makes no network calls, and OCR runs locally with
language data that ships with the app.

Built so far: **feature 1, cloak a folder**, **feature 2, the key** and
**feature 3, the review screen**, in one app window. The double checker,
restore and the Claude connector come next. Until the double checker exists,
exported copies are marked **reviewed, not double-checked**. Until the review screen and double checker exist, treat every cloaked
copy as **not reviewed**.

## What it does

- Reads `.docx`, `.pdf`, `.xlsx`, `.txt`, `.eml`, `.msg`, `.jpg`, `.png`, `.tif`.
  Scanned PDF pages and pictures go through OCR; pages with a text layer do not.
- Replaces people, companies, NRIC and passport numbers, addresses, phones,
  emails, bank accounts, case numbers, land titles and vehicle plates with
  tags in the website's format: `{{PERSON_1}}`, `{{PERSON_1.SURNAME}}`,
  `{{COMPANY_2}}`, `{{NRIC_1}}`.
- One name map for the whole folder, so the same person or number gets the
  same tag number in every file, including other spellings and short forms.
- Dates, amounts and legal provisions are kept unless switched on.
- Writes cloaked copies as text files to a new folder. Originals are only
  ever opened for reading.

## The completeness rule

Every part of every file is read, or the file is blocked and listed with the
reason. A file that was only partly read is never exported.

- **Every file:** sub-folders, hidden files, files inside zip archives, email
  attachments, and files embedded in Word, Excel or PDF. Each is read as a
  file in its own right and listed separately.
- **Word:** body, tables, text boxes, headers, footers, footnotes, endnotes,
  comments and who wrote them, tracked changes (inserted and deleted text and
  who made them), embedded pictures (OCR), document properties, document
  variables, WordArt, form-control labels, bookmark names, links.
- **PDF:** every page; pages with little or no text layer and pages with
  pictures are also read as pictures (OCR); notes and their authors, form
  fields, bookmarks, attached files, document properties.
- **Excel:** every sheet including hidden ones, hidden rows and columns, cell
  comments and their authors, formulas, sheet names, defined names, page
  headers and footers, drop-down lists, text boxes, charts, stored pivot data,
  links to other workbooks, pictures (OCR), document properties.
- **Emails (.eml, .msg):** subject, sender, to, cc, bcc, reply-to, the whole
  body including quoted earlier emails and signatures, the formatted version
  where it says more than the plain one, and every attachment.
- **Pictures:** OCR on the whole picture, plus the details stored in it:
  GPS position, device, date, author, captions.
- **File and folder names.**

`cloak-report.json` gives proof of reading for each file: pages or sheets
found, pages or sheets read, characters extracted, which pages went through
OCR, and anything that could not be read.

| Result | Meaning |
|---|---|
| cloaked | every part was read; a cloaked text copy was written |
| needs manual check | a page in a non-Latin script, OCR that came out uncertain, or a page with marks but almost no text. Not written out. |
| partly read - blocked | some part could not be read. Not written out. |
| unreadable - blocked | nothing could be read. |

Cloaked copies are plain text rebuilt from what was read. The original is
never copied or edited.

## What it cannot read

**Whole files (blocked and listed):** old Word `.doc`, `.rtf`, old Excel
`.xls`, PowerPoint, iPhone `.heic` photos, archives other than zip (rar, 7z,
tar, gz), Outlook mailbox files (`.pst`, `.ost`), audio, video, and any type
not listed above. Anything password-protected or damaged.

**Parts that block the whole file:** objects embedded in Word or Excel in the
old OLE format, macros, EMF/WMF pictures, XFA forms in PDFs, an email attached
inside an Outlook `.msg`, an Outlook email whose body is stored only as rich
text, encrypted or signed-and-wrapped emails, `winmail.dat`.

**Parts that are not read and do not block the file.** They are not in the
cloaked copy, because the copy is built only from what was read:

- Email routing headers (the servers a message passed through, message IDs).
- The name in a digital signature on a PDF, PDF scripts, and stamps that are
  drawn rather than stored as a note.
- Barcodes and QR codes.
- A signature or a few handwritten words on an otherwise typed page. If OCR
  finds no word-like marks there, nothing flags them.
- Small or low-resolution text inside pictures that OCR does not pick up.
- Fonts, colours, layout and formatting.

**Read, but may be wrong:** OCR text (misread letters), the reading order of
PDF pages set in columns or tables, and file names inside a zip that were not
saved in UTF-8.

**Not tested yet:** Outlook `.msg` files and scanned Tamil pages (no test
file), and cloud-only files in OneDrive or Google Drive.

## The app and the review screen

```
npm install
npm run app          # open the window
npm run dist         # build the installer for this system
```

Installers for Windows and Mac are built by the "Desktop installer" workflow
on GitHub (Actions tab, Run workflow). They are not code-signed yet, so
Windows shows a "publisher unknown" warning.

The window has two buttons: **Cloak a folder** and **Restore a draft** (not
built yet). Cloaking goes: choose the documents, choose or create the matter,
watch the files being read, then review.

- **Nothing is written anywhere until the review is finished.** Cloaked text
  stays in memory. Export is refused until every item is decided.
- **Not sure:** each word once, with how many places and files. Hide it (as a
  person, a company or something else) or mark it fine.
- **Joined names:** forms the tool gave one tag. Confirm, or split one off.
  Forms that differ only in capitals, spacing or punctuation are not asked about.
- **Everything replaced:** each term once, with its other forms, places and
  files. "Don't hide" removes it everywhere and remembers that; "Same as…"
  merges two tags.
- **Files:** every file with its result, what was read, and why it is blocked
  if it is. A file that needs a manual check can be read and approved by a
  person; who approved it is recorded.
- Any change after the review is finished, and any new file, means it has to
  be finished again.
- A tag number is never reused, even after its tag is removed.

The window can load only its own files. Network requests are refused, name
lookups are switched off, and there is no auto-update.

## The key

Each matter has its own folder, kept on the firm's own drive:

| File | What it is |
|---|---|
| `matter.cloakkey` | the key: every tag and its real value, encrypted |
| `matter.cloakkey.bak` | the previous save, also encrypted |
| `cache/` | what was read from each file, encrypted with the matter key, so unchanged files are not read or put through OCR again |
| `log.jsonl` | who did what and when. No real values. |
| `matter.lock` | who has the matter open right now |

- **Encryption:** AES-256-GCM under a random key made for the matter. That key
  is locked twice, once by the matter password and once by the recovery code
  (both stretched with scrypt). Either one opens the matter.
- **The password** is chosen when the matter is created (10 characters or
  more). It is never written to disk and never sent anywhere.
- **The recovery code** is shown once when the matter is created. Print it and
  keep it with the paper file or in the safe.
- **If both are lost, the key cannot be opened. There is no back door.** The
  originals are untouched, so the folder can be cloaked again under a new key,
  but drafts made with the old tags can no longer be restored automatically.
- **Sharing:** a second lawyer opens the same matter folder and types the
  password. Only one person can have a matter open at a time.
- **Adding files** to a matter reuses the key: the same person keeps the same
  tag, and files keep their output numbers.
- The matter folder must be outside the documents folder and outside the
  cloaked folder. Cloak refuses otherwise.

Limits to know about:

- The one-at-a-time lock works on a shared network drive. In a folder synced
  by OneDrive or Google Drive, two people on two computers can both open the
  matter before the sync catches up, and one person's changes will end up in
  a "conflicted copy". Use a real shared drive for matter folders.
- A lock left behind by a crash clears itself after 12 hours.
- Anyone who gets a copy of the key file can try passwords against it for as
  long as they like. A long password is what protects it.
- While a matter is open, the key is in the computer's memory.

## Standard and Strict (fact blurring)

A matter is **Standard** (identifiers only: names, ID numbers, accounts, phones, addresses) or **Strict**, which is the default and also blurs distinctive facts, so the cloaked text cannot be tied to a real dispute. Strict blurs:

| What | Tag | Notes |
| --- | --- | --- |
| Dates | `{{DATE_n}}` | numbered in true time order across the whole matter; same date in different files = same tag |
| Amounts of money | `{{AMOUNT_n}}` | same amount = same tag in any format; `RM4.3 million` is the same tag as `RM 4,317,250.00` when exactly one amount fits |
| Contract, invoice, cheque, receipt, policy, claim numbers | `{{REF_n}}` | needs a cue word before the number |
| Towns, districts, islands (a list of about 70) and places after a cue word (Mukim, Pulau, Bandar, Taman, Bukit...) | `{{PLACE_n}}` | roads, buildings and street addresses are already `ADDRESS` |
| Project and development names ending in Residences, Heights, Towers, Park... | `{{PROJECT_n}}` | |
| Job titles that point to one person (Branch Manager, Finance Director, harbour master, pengarah urusan...) | `{{JOB_n}}` | plain "director" or "manager" is left |
| Court, judge and registry names | `{{COURT_n}}` | switch `courts` (on by default) |
| Percentages and shareholdings | `{{PERCENT_n}}` | switch `percentages` (off by default) |
| Property details | `{{LAND_n}}` | already hidden in Standard |

**Different ways of writing one fact** get one number and a letter: `{{DATE_1}}` is `3 Mac 2023`, `{{DATE_1.B}}` is `3 March 2023`, `{{DATE_1.C}}` is `03/07/2025`. This is so a restored draft shows each fact exactly as it was written. The cost: a draft that uses `{{DATE_1}}` in an English document restores a Malay month. Totals Cloak works out itself are written in the format of the first amount.

**Dates found**: `3 July 2025`, `3rd July 2025`, `July 3, 2025`, `21st day of July 2025`, `3hb Julai 2025`, `3 Mac 2025`, `03/07/2025`, `3-7-2025`, `3.7.25`, `2025-07-03`, `2025年7月3日`, `二零二五年七月三日`, `March 2024` and `Mac 2024` (month only, capital first letter), `5 June` (no year, numbered after all dated dates), and a year after a cue word (`in 2024`, `pada tahun 2024`). Numeric dates are read **day first**; when the month reading is also possible (03/07/2025) the date is flagged as ambiguous. **Not found**: a month with no year or day ("in March"), lowercase `mac 2024`, `mm/yyyy`, dates written in words ("the third of July"), Tamil, Arabic/Jawi and Thai dates, and a two-digit year with a hyphen.

**Relative and vague dates** ("last Friday", "within 14 days", "dalam masa tiga bulan", "end of June") are listed, never turned into a date, and stay visible in the cloaked text. They can carry a clue.

**Amounts found**: a currency sign or word with a number (`RM`, `MYR`, `S$`, `US$`, `$`, `€`, `£`, `ringgit`...), with `million`, `juta`, `ribu`, `k`; and bare numbers in a spreadsheet column called Amount, Paid, Balance, Total, Price, Jumlah, Harga... (taken as ringgit). **Not found**: amounts in words ("sixty thousand ringgit"), bare numbers in prose, and a bare number in a column with another name.

**Dates are renumbered when the set of dates changes.** Adding a file with a new date can change the numbers of later dates. `datesVersion` goes up each time and is in the report: a draft made before that must not be restored with the new key without a warning.

**What Strict still lets through.** Strict cannot see: places not on the list and without a cue word; products, brands and vessel names (not built); job titles other than the listed ones; unusual events and how something happened (free text, which is the lawyer's to judge: the highlight-and-tag tool on the review screen is not built yet); relative dates; amounts and dates written in words; anything in an image the OCR misread; names in Chinese, Tamil or Jawi script (flagged, or hidden whole as a passage); and the **shape** of the dispute: who sued whom for what and in what order, which a person who knows the case can recognise even with every value blurred. Strict lowers the chance of tying a text to a real dispute; it does not remove it.

**The review screen** lists blurred facts separately from names, with counts. A single fact can be un-blurred (`unblurFact`); the matter records who did it and when, and the report lists it. The key sweep (below) reads every file again before export.

## The context sheet

Every Strict export comes with `000-context-sheet.cloaked.txt`: the rules for working with tags, a cast list (role and relationships only), a date table (time order and gaps in days, no real dates), an amount table (which is larger, which adds up to which), and what kind of thing each tag is (bank, court, property...). It is made from the cloaked text and checked by the key sweep like any other file.

The cast list's roles are read from the wording next to each tag by rules (a direct description such as "TAG, the estate agent" or "the wife of the Plaintiff, TAG"). They are precise but incomplete: many people get no role. A reviewer can correct them (`matter.roles`). Job titles that Strict hides are not brought back in the sheet ("company officer").

## The key sweep

Before anything is exported the key is swept: every value the key holds (whole word, any letter case, names under four letters and honours like Tan Sri skipped) and every fact in **any format** is looked for in the cloaked text, with the paragraph number. Any hit stops the export. It cannot see inside a spreadsheet's amount column on its own (it needs the column name), and it does not replace the review.

## The chronology table

No AI. Every sentence that has a date, an amount or a named party becomes a row: date, text, people, source file and part. Sorted by date; undated rows come last. Rows about the same event are grouped (same day, and the same amount or mostly the same words, with a small English/Malay/Chinese list of event words: meeting, agreement, deposit, payment, letter...). Rows that read as the same event but give a different date or amount are flagged. A person can edit, merge, delete and add rows, then **confirm** the table; any change takes the confirmation away. The confirmed table is exported as its own cloaked document (`000-chronology.cloaked.txt`), saying it was confirmed by a named reviewer (the name and time are in the matter log, not in the file). "Send chronology only" is `export({ only: 'chronology' })`.

What it will miss or split: events whose rows use different words, languages with no entry in the word list, events described without a date, dates in words, relative dates ("14 days after the letter" is never worked out), and events that happened on the same day and read alike (they are joined). A conflict is only flagged when two rows are alike enough in wording. Measured results are in the session notes, not here, because they depend on the matter.

## Checks on a draft (feature 8, checks 1 to 3, in the desktop app)

`draftcheck.js`, plain code, no AI, no network: **1 restore check** (no tag left, none invented or damaged, no real value written in), **2 source check** (every date, amount, reference and place found in the sources; every name too), **3 arithmetic and timeline** (day counts between two dates, totals and balances, dates running backwards). Each gives pass, warn or fail and the paragraph of each issue. A "TOTAL NEEDED: AMOUNT_1 - AMOUNT_2" note is worked out locally and given its own tag. **Check 4 (the offline AI read-through) and the internal server are not built.**

## What it will miss

It is rules and word lists, not an AI model, and it is not perfect.

- **Names with no clue around them.** A name with no title, no bin/binti or
  a/l / a/p, no NRIC beside it and no word from the name lists is not hidden
  automatically. It is put on the "not sure" list for a person to decide.
  Measured on made-up names (`node test/miss-rate.js`): see the numbers there.
- **One-word names and nicknames** ("Bob", "Along") unless they follow a title
  or match part of a full name found elsewhere in the folder.
- **People described but not named** ("the only cardiologist in Kuantan").
- **Names in Chinese, Tamil or Jawi script.** The file is blocked for a manual check.
- **Words inside pictures on a typed page** (stamps, letterheads, handwriting).
  They are not read and are not in the cloaked copy.
- **Handwriting and poor scans.** Low-confidence OCR blocks the file.
- **Attachments inside emails.** They are not opened; save them into the folder.
- **Place names and organisations without a company ending** (a town, a
  school, a government office) are kept unless they are part of an address.
- **Unusual number formats** not covered by the patterns, and plates that are
  not three letters plus digits unless a word like "vehicle" comes first.

## Tests

```
npm install
npm test
```

All test documents are made up (`test/matter.js`). One test fails if any real
value from that matter shows up in a cloaked file, file name, report, log,
or any temp location.
