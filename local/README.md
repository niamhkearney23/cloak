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

## What happens to each file

| File | Result |
|---|---|
| docx, pdf, xlsx, txt, eml, msg, jpg, png, tif | cloaked |
| a page in Chinese, Tamil, Jawi or another non-Latin script | **needs manual check**, not written out |
| OCR that came out too uncertain | **needs manual check**, not written out |
| .doc, .rtf, .xls, .heic, password-protected, damaged, unknown types | **unreadable**, listed with the reason |

Nothing is skipped silently: `cloak-report.json` lists every file.

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
