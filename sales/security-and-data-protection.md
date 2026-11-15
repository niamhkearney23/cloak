# Cloak: security and data protection statement

A plain description of what Cloak does with a firm's documents, written so that a firm's partners and IT staff can check it. It describes Cloak version 0.1.0 as at 15 November 2026.

- **Cloak lowers the risk; it does not remove it.** It is rules and word lists, not an AI model, and it misses things (section 9).
- This statement makes no legal claims. Legal questions (PDPA, confidentiality, Bar guidance) are covered in `sales/compliance-notes.md`, a research memo written for review by a Malaysian advocate. It is not legal advice.
- Nothing here means Cloak is certified, approved or compliant. No regulator, court or Bar body has reviewed it.
- Scope: the Cloak **desktop program** only. The Cloak web app and email assistant in the same code base are separate and are not covered.

## 1. What Cloak does

Cloak hides client details in a folder of documents before the documents go to an AI tool.

1. The lawyer chooses a folder of documents. Cloak reads every file on the lawyer's own computer.
2. It replaces names, companies, ID numbers, addresses, phone numbers, emails, bank accounts, case numbers, land titles and vehicle plates with tags such as `{{PERSON_1}}` and `{{COMPANY_2}}`. The same person gets the same tag in every file, including other spellings and short forms.
3. In **Strict** mode (the default) it also blurs dates (`{{DATE_3}}`), amounts, reference numbers, listed places, project names, some job titles and court names, so the text is harder to tie to a real dispute. **Standard** mode hides identifiers only and keeps dates, amounts and legal provisions.
4. A person reviews what was hidden on a review screen. Nothing can be exported until every item is decided.
5. Cloak writes cloaked text copies to a folder the lawyer chooses. The lawyer gives them to an AI tool of the lawyer's choice. **Cloak does not send anything anywhere.**
6. When the AI's draft comes back, the lawyer pastes it into Cloak's **Restore a draft** screen. Cloak puts the real details back, on the same computer, and checks the draft.

## 2. What is built and what is in progress

| Part | State on 15 November 2026 |
|---|---|
| Cloak a folder (reading, OCR, tagging) | Built |
| The encrypted matter key, password and recovery code | Built |
| Review screen | Built |
| Strict mode (fact blurring), context sheet, chronology table, key sweep | Built |
| Restore a draft, with three plain-code checks on the draft | Built |
| **Double checker:** a second, independent check before export, with hand approval of each finding | In progress |
| Offline licence (a signed licence file, evaluation mode) | In progress |
| Signing-ready installers | In progress. Today's installers are **not code-signed**, so Windows shows a "publisher unknown" warning. |
| Sample matter, help screens | In progress |
| A redesign of the window | In progress |
| Local connector for AI tools, email support inside the app, offline AI read-through | Not built |

**Important limit today:** until the double checker is finished, Cloak exports cloaked copies only from matters ticked as "made-up test documents only". That tick is the person's own statement; Cloak cannot tell real documents from made-up ones.

## 3. The data flow

```
 THE FIRM'S COMPUTER (Cloak runs here; it makes no network connections)
 ------------------------------------------------------------------------
  Original documents          Cloak reads them. Originals are opened for
  (folder or synced drive)    reading only and never changed.
          |
          v
  Reading and OCR             In memory. OCR language data ships with the app.
          |
          v
  Matter key                  Tag -> real value, encrypted, on the firm's
  (matter folder)             own drive. Never written beside the copies.
          |
          v
  Review screen               A person decides every item. Nothing is
                              written out until the review is finished.
          |
          v
  Cloaked copies              Plain text files with tags, in a folder the
  (folder the lawyer picks)   lawyer chooses.
 ------------------------------------------------------------------------
          |
          |  The LAWYER (not Cloak) gives the cloaked copies to an AI tool
          v  of the lawyer's choice. That company receives the cloaked text.
  AI tool chosen by the lawyer
          |
          |  The lawyer brings the AI's draft back (paste, .txt, .md, .docx)
          v
 ------------------------------------------------------------------------
  Restore a draft             On the firm's computer: tags are replaced by
                              real values; three checks run; the restored
                              text is shown to copy or save.
```

**What the AI company receives:** only what the lawyer gives it. With Cloak, that is cloaked text. Cloaked text can still contain facts (Standard mode keeps dates and amounts), the shape of the dispute (who sued whom for what, in what order), and anything Cloak missed. The AI company's own terms (retention, use for training, server location) apply to what it receives. The firm should read those terms. Cloak does not choose or check the AI tool.

## 4. Where data lives

| Data | Where | Protected by |
|---|---|---|
| Original documents | Wherever the firm keeps them. Cloak only reads them. Synced folders (iManage Drive, OneDrive, Google Drive) are read-only sources; Cloak never writes into them. | The firm's own controls |
| Text read from the documents, and the cloaked text, during a run | Memory while the matter is open; the text read from each file is also kept in the encrypted cache (below) | Never written out in plain text before export |
| `matter.cloakkey` (every tag and its real value, and the review state) | The matter folder, on the firm's own drive | AES-256-GCM encryption (section 5) |
| `matter.cloakkey.bak` (the previous save) | Matter folder | Same encryption |
| `cache/` (what was read from each file, so unchanged files are not read or OCR'd again) | Matter folder | Encrypted with a key derived from the matter key; file names are keyed hashes that say nothing about the files |
| `log.jsonl` (who did what, when) | Matter folder | Plain text. Holds no real values (section 7). |
| `matter.lock` (who has the matter open) | Matter folder | Plain text: a name, computer name and time |
| Cloaked copies, `cloak-report.json`, the "reviewed, not double-checked" marker, context sheet, chronology | The export folder the lawyer chooses | Tags only. The report lists files by their cloaked names. |
| Restored drafts | Only where the lawyer saves or pastes them. "Copy" puts the text on the system clipboard like any copied text. | The firm's own controls |
| The user's full name (asked once, for sign-offs) | `profile.json` in the app's settings folder on that computer | Plain text |
| A remembered matter password (only if the user ticks "Remember on this computer") | `remembered.json` in the app's settings folder | The operating system's protected store (Windows DPAPI, macOS Keychain) |
| OCR language data (English, Malay, Chinese, Tamil) | Copied once from the app to a `cloak-ocr-lang` folder in the system temp folder | Language data only, no client content |

Rules Cloak enforces:

- The matter folder must be outside the documents folder and outside the export folder. Cloak refuses otherwise. The key never sits with the cloaked copies.
- The matter folder and the export folder may not be in a synced location (iManage Drive, OneDrive, Google Drive), because the sync app would upload them. Cloak recognises these from folder names, the folders the system reports as OneDrive and, on Windows, drive labels. This has been tested on made-up paths, not on a real iManage, OneDrive or Google Drive installation. A user can mark a folder as synced by hand.
- Files in a synced folder that are only placeholders (not yet downloaded) are listed, and are not opened unless the user agrees, because opening them makes the sync app download them.
- The test suite fails if any real value from the made-up test matter shows up in a cloaked file, a file name, the report, the log, or any temporary or cache location.

## 5. Encryption

Checkable in `keyfile.js`.

- **The key file** is encrypted with **AES-256-GCM** under a random 256-bit key made for each matter.
- That matter key is locked twice: once with a key derived from the **matter password** and once with a key derived from the **recovery code**. Either one opens the matter. Both use **scrypt** (N = 2^17, r = 8, p = 1), which costs about a third of a second and 128 MB of memory per guess, to slow down password guessing.
- **The password** must be at least 10 characters. It is never written to disk and never sent anywhere.
- **The recovery code** is 24 characters (about 120 bits of randomness), shown once when the matter is created, with a Print button. Keep it with the paper file or in the safe. It can be replaced; the old one then stops working.
- **No back door.** If both the password and the recovery code are lost, the key cannot be opened by anyone, including Lawgistics. The original documents are untouched, so the folder can be cloaked again under a new key, but drafts made with the old tags can no longer be restored automatically.
- **Tamper detection.** Any change to the key file, even one byte, is detected when it is opened. The file's header is bound to its contents, so it cannot be swapped with another matter's header.
- **The cache** is encrypted with AES-256-GCM under a key derived from the matter key (HKDF-SHA256).
- When a matter is closed, the matter key is overwritten in memory.

Limits, stated plainly:

- Anyone who gets a copy of the key file can try passwords against it offline for as long as they like. A long password is what protects it.
- While a matter is open, the key is in the computer's memory.
- Cloak does not encrypt the original documents, the export folder or restored drafts. Use the firm's normal device and drive encryption (BitLocker, FileVault) for those.
- One person can have a matter open at a time (a lock file). On a real shared network drive this works. In a synced folder it would not, which is one reason Cloak refuses synced folders for the matter. A lock left by a crash clears after 12 hours; a user can also take a lock over, which is logged.

## 6. The review and the checks before export

**The completeness rule.** Every part of every file is read, or the file is blocked and listed with the reason. A partly read file is never exported. This covers sub-folders, hidden files, zip archives, email attachments and embedded files; in Word, headers, footers, footnotes, comments, tracked changes (including deleted text), text boxes and document properties; in PDFs, every page, notes, form fields and attachments, with OCR for pages that have little or no text; in Excel, hidden sheets, rows and columns, comments, formulas and sheet names; file and folder names. `cloak-report.json` gives proof of reading for each file.

**The review screen.** Nothing is written anywhere until the review is finished.

- *Not sure:* words that might be names, each shown once with how many places and files. The reviewer hides each one or marks it fine.
- *Joined names:* forms the tool gave one tag. Confirm or split.
- *Everything replaced:* each term with its forms, places and files. "Don't hide" needs a confirmation (two for numbers found by a pattern).
- *Hidden facts* (Strict): blurred dates, amounts and other facts. Un-blurring one is recorded with the person's name and time.
- *Files:* each file's result. A file that needs a manual check (for example a page in a non-Latin script, or uncertain OCR) can be read and approved by a person; if non-Latin text is still showing, the person must type APPROVE. The approver's name and time are recorded.
- Any change after the review is finished, and any new file, means the review must be finished again.

**The key sweep** (Strict mode). Before anything is written, every value the key holds, and every blurred fact in any format, is looked for in the cloaked text, including the context sheet. Any hit stops the export and gives the file and paragraph. It does not replace the review: it can only find values the key already holds.

**Each export is marked** "Reviewed by [name] on [date]. NOT YET DOUBLE-CHECKED."

**The double checker (in progress)** will add a second, independent check before export, with each finding approved by hand. Until it is finished, export is limited to matters ticked as made-up test documents.

**Checks on a returned draft** (plain code, no AI, no network): (1) restore check: no tag left, none invented or damaged, no real value typed in by the AI; (2) source check: every date, amount, reference, place and name in the restored draft is found in the source documents; (3) arithmetic and timeline: day counts, totals and dates that run backwards. Each gives pass, warn or fail with the paragraph.

## 7. The log

`log.jsonl` in the matter folder records **who** (the person's full name and computer login), **when** (date and time) and **what**: matter created, opened (with password or recovery code), failed opening attempts, setup changed, folder cloaked (with counts and seconds), each review change (the kind of change and the tag, such as `PERSON_3`), files checked by hand (by file number), review completed, chronology changes, export (files written and held back), draft restored (tags restored and the check result), password changed, recovery code replaced, cache cleared, lock taken over, matter closed.

**It never records real values:** no names, numbers, document text or file names from the matter.

Limits: it is a plain text file. Anyone with access to the matter folder can read or edit it. It is a working record, not a tamper-proof audit trail. It does not record what the lawyer does with the cloaked copies outside Cloak.

## 8. The offline design, and how to check it

**What the code does** (checkable in `app/main.js` and `README.md`):

- The program's own code makes no network calls. OCR runs locally with language data shipped inside the app; it is never downloaded.
- The window can load only the app's own files. Every other request is refused (`webRequest.onBeforeRequest` cancels anything that is not a local file).
- Name lookups in the window's browser engine are switched off (`host-resolver-rules MAP * ~NOTFOUND`). Background networking, component updates, sync, pings, translation and similar browser features are switched off.
- Every permission request (camera, microphone, location, notifications) is refused. New windows and navigation away from the app are blocked.
- There is no auto-update and no usage reporting.
- In the current build the program files are installed as readable JavaScript (not packed into an archive), so IT can read these files in the installed program.

**How IT can check it themselves:**

1. **Block it and use it.** Add a firewall rule that blocks all outbound traffic for the Cloak program, then cloak and restore a made-up matter. Everything should work.
2. **Watch it.** Run a made-up matter while watching network connections: Windows Resource Monitor (Network tab) or a firewall log on Windows; Little Snitch, LuLu or `nettop` on a Mac. Cloak should open no connections.
3. **Air gap.** Install it on a computer with no network at all and run a full matter.
4. **Read the code.** See the files named above.

An IT deployment guide and a written test that shows nothing goes online are being prepared (in progress).

**What this does not cover:** the AI tool the lawyer uses (it is online by nature and outside Cloak); the operating system's own services (for example cloud-based antivirus scanning or backup software, which may upload files from the documents, matter or export folders); sync apps; and the system clipboard.

## 9. What Cloak cannot read and what it will miss

From `local/README.md`. This list is the honest core of this statement.

**Whole files it cannot read** (blocked and listed, never exported): old Word `.doc`, `.rtf`, old Excel `.xls`, PowerPoint, iPhone `.heic` photos, archives other than zip (rar, 7z, tar, gz), Outlook mailbox files (`.pst`, `.ost`), audio, video, any type not listed, and anything password-protected or damaged.

**Parts that block the whole file:** old-style embedded objects in Word or Excel, macros, EMF/WMF pictures, XFA forms in PDFs, an email attached inside an Outlook `.msg`, an Outlook email stored only as rich text, encrypted or signed-and-wrapped emails, `winmail.dat`.

**Parts that are not read and are left out of the copy:** email routing headers, the name in a PDF digital signature, PDF scripts, drawn stamps, barcodes and QR codes, a signature or a few handwritten words on a typed page, small or low-resolution text inside pictures, formatting.

**Read, but may be wrong:** OCR text (misread letters), the reading order of PDF pages in columns or tables, file names inside a zip not saved in UTF-8.

**Not tested yet:** Outlook `.msg` files and scanned Tamil pages, and cloud-only files in OneDrive or Google Drive.

**Names and details it will miss:**

- A name with no clue around it (no title, no bin/binti, a/l or a/p, no NRIC beside it, not in the name lists). It goes on the "not sure" list for a person to decide, if it looks like a name.
- One-word names and nicknames, unless they follow a title or match part of a full name found elsewhere in the folder.
- People described but not named ("the only cardiologist in Kuantan").
- Names in Chinese, Tamil or Jawi script: the file is blocked for a manual check.
- Words inside pictures on a typed page (stamps, letterheads, handwriting).
- Handwriting and poor scans (low-confidence OCR blocks the file).
- Places and organisations without a company ending (a town, a school, a government office), unless part of an address.
- Unusual number formats, and vehicle plates that are not three letters and digits unless a word like "vehicle" comes first.

**What Strict mode still lets through:** places not on its list and without a cue word; products, brands and vessel names; job titles other than the listed ones; unusual events and how something happened; relative dates ("last Friday"); amounts and dates written in words; anything OCR misread; and **the shape of the dispute**, which a person who knows the case may recognise even with every value blurred.

## 10. Measured figures, and their limits

None of these figures is a guarantee. They were measured on made-up documents.

**Speed** (one 4-core test machine):

- A large made-up matter (a 300-page scanned bundle, a 60-page agreement and a 5,000-row ledger) took **623 seconds** the first time. **543 seconds** of that was OCR of the scanned bundle, about **1.8 seconds a page**.
- Run again, unchanged files came from the encrypted cache: **64 seconds**.
- Reopening a matter: **0.5 seconds**.
- The 20-file made-up test matter finishes **inside 60 seconds**.
- Limits: one machine. Speed depends on the number of cores, the disk and the quality of scans. Large scans are slow the first time.

**Detection:**

- On a made-up matter written by the owner and never seen by the tool (22 files), **names were still visible in 13 of the 22 files** after cloaking: nicknames, single names, lowercase names in file notes, and a client name used in folder names.
- Several of those gaps have since been addressed. A further round of work is in progress. It has not been re-measured on a new unseen matter yet.
- On the team's own made-up matters the results are much better, but those matters were written by the people who wrote the rules, so they flatter the tool.
- This is why the review screen is compulsory and why the double checker is being built. **Every export must be read by a person.**

**Installers:** Windows about 178 MiB; Mac about 202 MiB. Currently not code-signed.

## 11. What the firm still needs to do

Cloak is one control among several. The firm remains responsible for:

- choosing the AI tool, reading its terms (retention, training, server location) and deciding whether to use it on a matter;
- reading every review screen properly and reading the cloaked copies before they leave the firm;
- strong matter passwords, and keeping recovery codes safe and separate from the key file;
- device and drive encryption, access control on matter folders, and backups of matter folders;
- keeping matter folders on a real shared drive, not a synced folder;
- checking every restored draft, as with any draft;
- its own legal obligations (see `sales/compliance-notes.md`, and take the firm's own advice).

Questions from a firm's IT team: [owner to add a contact name and email before sending].
