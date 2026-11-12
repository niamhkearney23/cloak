# Cloak for the desktop (in progress)

Cloaks a whole folder of documents on this computer. Nothing is sent anywhere:
the code in this folder makes no network calls, and OCR runs locally with
language data that ships with the app.

Built so far: **feature 1, cloak a folder** (the engine, with no window yet).
The key, review screen, double checker, restore and the Claude connector come
next. Until the review screen and double checker exist, treat every cloaked
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
