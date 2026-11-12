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
