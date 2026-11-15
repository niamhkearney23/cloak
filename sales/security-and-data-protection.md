# Cloak: security and data protection statement

A plain description of what Cloak does with a firm's documents, written so that a firm's partners and IT staff can check it. It describes the current build of Cloak 0.1.0, an early version, as at 15 November 2026. Builds made before 15 November 2026 carry the same number, 0.1.0, and had a fault in reading some scanned PDF pages (see section 9); ask for the build date of any installer you are given.

- **Cloak lowers the risk; it does not remove it.** It is rules and word lists, not an AI model, and it misses things (section 9).
- This statement makes no legal claims. Legal questions (PDPA, confidentiality, Bar guidance) are covered in the research memo "Cloak: PDPA, confidentiality and Bar guidance", written for review by a Malaysian advocate. It is not legal advice.
- Nothing here means Cloak is certified, approved or compliant. No regulator, court or Bar body has reviewed it.
- Scope: the Cloak **desktop program** only. The Cloak web app and email assistant in the same code base are separate and are not covered. The installer carries two files from the web app (`public/cloak.js`, the detection rules, and its `package.json`) and nothing else from either. `cloak.js` has no network calls; a comment at its top about a "drafting service" describes the web app and does not apply to the desktop program.

## 1. What Cloak does

Cloak hides client details in a folder of documents before the documents go to an AI tool.

1. The lawyer chooses a folder of documents. Cloak reads the files in it, on the lawyer's own computer.
2. It replaces names, companies, ID numbers, addresses, phone numbers, emails, bank accounts, case numbers, land titles and vehicle plates with tags such as `{{PERSON_1}}` and `{{COMPANY_2}}`. The same person gets the same tag in every file, including other spellings and short forms.
3. In **Strict** mode (the default) it also blurs dates (`{{DATE_3}}`), amounts, reference numbers, listed places, project names, some job titles and court names, so the text is harder to tie to a real dispute. **Standard** mode hides identifiers only and keeps dates, amounts and legal provisions.
4. A person reviews what was hidden on a review screen. Nothing is exported until the review is finished and the double check (section 6) has passed, with a person deciding each finding.
5. Cloak writes cloaked text copies to a folder the lawyer chooses. The lawyer gives them to an AI tool of the lawyer's choice. **Cloak does not send anything anywhere.**
6. When the AI's draft comes back, the lawyer pastes it into Cloak's **Restore a draft** screen. Cloak puts the real details back, on the same computer, and checks the draft.

## 2. What is built and what is in progress

| Part | State on 15 November 2026 |
|---|---|
| Cloak a folder (reading, OCR, tagging) | Built |
| The encrypted matter key, password and recovery code | Built |
| Review screen | Built |
| Strict mode (fact blurring), context sheet, chronology table | Built |
| **Double checker:** five rule-based checks on everything that would be exported; a person decides each finding | Built |
| Restore a draft, with three rule-based checks on the draft | Built (the source check needs the documents folder) |
| Offline licence (a signed licence file, checked on the computer) | Built. The vendor's licence key has not been made yet, so **every copy today is an evaluation copy** (see below). |
| Sample matter, help screens, local support file | Built |
| IT deployment guide, third-party licence notices, tests that show Cloak makes no network connection | Built |
| Signing-ready installers | Built, but never tried with a certificate. Certificates have not been bought, so today's installers are **not code-signed** and Windows shows a "publisher unknown" warning. |
| Screens to change a matter password or replace the recovery code | Not built. The functions exist in the program's core; no screen calls them. |
| A redesign of the window | In progress |
| Local connector for AI tools, Outlook email support inside the app, offline AI read-through | Not built |

**Important limit today:** every copy of Cloak is an evaluation copy until the vendor's licence key is made and a licence is issued to the firm. An evaluation copy exports cloaked copies only from matters ticked as "made-up test documents only". That tick is the person's own statement; Cloak cannot tell real documents from made-up ones. A licensed copy can export from any matter once the review is finished and the double check has passed. Restoring a draft works with or without a licence.

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
  Review screen               A person decides each item. No cloaked
                              copy is written until the review is done.
          |
          v
  Double check                Five rule-based checks; a person decides
                              each finding before anything is written.
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
| Text read from the documents, and the cloaked text, during a run | Memory while the matter is open; the text read from each file is also kept in the encrypted cache (below) | Not written to disk in plain text; the cloaked copies written at export are the only plain-text output |
| `matter.cloakkey` (every tag and its real value, and the review state) | The matter folder, on the firm's own drive | AES-256-GCM encryption (section 5) |
| `matter.cloakkey.bak` (the previous save) | Matter folder | Same encryption |
| `cache/` (what was read from each file, so unchanged files are not read or OCR'd again) | Matter folder | Encrypted with a key derived from the matter key; file names are keyed hashes that say nothing about the files |
| `log.jsonl` (who did what, when) | Matter folder | Plain text. Holds no real values (section 7). |
| `matter.lock` (who has the matter open) | Matter folder | Plain text: a name, computer name and time |
| Cloaked copies, `cloak-report.json`, the `REVIEWED-AND-DOUBLE-CHECKED.txt` marker, context sheet, chronology | The export folder the lawyer chooses | Tags in place of the details Cloak found; anything it missed stays (section 9). The report and marker also give the full name and computer login of the reviewer, the double-checker and anyone who marked a finding as fine or checked a file by hand, and the report names the firm on the licence and the licence ID. Give the AI tool the cloaked copies only, not the report or marker. The report lists files by their cloaked names. |
| Restored drafts | Only where the lawyer saves or pastes them. "Copy" puts the text on the system clipboard like any copied text. | The firm's own controls |
| The user's full name (asked once, for sign-offs) | `profile.json` in the app's settings folder on that computer (Windows `%APPDATA%\cloak-desktop`; Mac `~/Library/Application Support/cloak-desktop`) | Plain text |
| A remembered matter password (only if the user ticks "Remember the password on this computer") | `remembered.json` in the app's settings folder | The operating system's protected store (Windows DPAPI, macOS Keychain) |
| OCR language data (English, Malay, Chinese, Tamil) | Copied once from the app to a `cloak-ocr-lang` folder in the system temp folder (Windows `%TEMP%`; Mac `$TMPDIR`) | Language data only, no client content |

Rules Cloak enforces:

- The matter folder must be outside the documents folder and outside the export folder. Cloak refuses otherwise. The key never sits with the cloaked copies.
- The matter folder and the export folder may not be in a synced location (iManage Drive, OneDrive, Google Drive), because the sync app would upload them. Cloak recognises these from folder names, the folders the system reports as OneDrive and, on Windows, drive labels. Other sync apps (for example Dropbox or iCloud Drive) are not recognised unless the user marks the folder as synced by hand. This has been tested on made-up paths, not on a real iManage, OneDrive or Google Drive installation.
- Files in a synced folder that are only placeholders (not yet downloaded) are listed, and are not opened unless the user agrees, because opening them makes the sync app download them.
- The test suite fails if any real value from the made-up test matter shows up in a cloaked file, a file name, the report, the log, or any temporary or cache location.
- Uninstalling Cloak leaves the settings folder and any licence in place, and never touches matter folders or exported copies. IT's guide lists what to delete to remove everything.

## 5. Encryption

Checkable in `keyfile.js` in the installed program folder.

- **The key file** is encrypted with **AES-256-GCM** under a random 256-bit key made for each matter.
- That matter key is locked twice: once with a key derived from the **matter password** and once with a key derived from the **recovery code**. Either one opens the matter. Both use **scrypt** (N = 2^17, r = 8, p = 1), which costs about a third of a second and 128 MB of memory per guess, to slow down password guessing.
- **The password** must be at least 10 characters. It is never written into the key file and never sent anywhere. If the user ticks "Remember the password on this computer", it is saved on that computer, locked by the operating system's protected store (section 4).
- **The recovery code** is 24 characters (about 120 bits of randomness), shown once when the matter is created, with a Print button. Keep it with the paper file or in the safe. There is no screen yet to replace it or to change the matter password (the functions exist in the program's core, but nothing in the window calls them), so a matter's password and recovery code stay as they were made. If a person who knew a matter's password leaves the firm, the only step today is to cloak the folder again as a new matter under a new password and keep the old matter folder locked away with the firm's own access controls. Drafts made under the old matter can then be restored only by opening the old matter.
- **No back door.** If both the password and the recovery code are lost, the key cannot be opened by anyone, including Lawgistics. The original documents are untouched, so the folder can be cloaked again under a new key, but drafts made with the old tags can no longer be restored automatically.
- **Tamper detection.** Any change to the encrypted contents, or to the matter's identity in the file's header, stops the file from opening, so it cannot be swapped with another matter's header. A change to the password or recovery-code part stops that one from opening the file (Cloak then reports a wrong password or code). The other header fields (Cloak version, dates, a note) hold no client data and are not checked.
- **The cache** is encrypted with AES-256-GCM under a key derived from the matter key (HKDF-SHA256).
- When a matter is closed, the matter key is overwritten in memory.

Limits:

- Anyone who gets a copy of the key file can try passwords against it offline for as long as they like. A long password is what protects it.
- While a matter is open, the key is in the computer's memory.
- Cloak does not encrypt the original documents, the export folder or restored drafts. Use the firm's normal device and drive encryption (BitLocker, FileVault) for those.
- One person can have a matter open at a time (a lock file). On a real shared network drive this works. In a synced folder it would not, which is one reason Cloak refuses synced folders for the matter. A lock left by a crash clears after 12 hours; a user can also take a lock over, which is logged.

## 6. The review and the checks before export

**The completeness rule.** Every part of every file that Cloak supports is read, or the file is blocked and listed with the reason; a file with a part Cloak could not open is never exported. The exceptions are the parts listed in section 9 under "Parts that are not read" (for example barcodes, drawn stamps and a few handwritten words on a typed page): they are left out of the cloaked copy and do not block the file. The rule covers sub-folders, hidden files, zip archives, email attachments and embedded files; in Word, headers, footers, footnotes, comments, tracked changes (including deleted text), text boxes and document properties; in PDFs, every page, notes, form fields and attachments, with OCR for pages that have little or no text; in Excel, hidden sheets, rows and columns, comments, formulas and sheet names; file and folder names. `cloak-report.json` gives proof of reading for each file.

**The review screen.** No cloaked copy is written until the review is finished.

- *Not sure:* words that might be names, each shown once with how many places and files. The reviewer hides each one or marks it fine.
- *Joined names:* forms the tool gave one tag. Confirm or split.
- *Everything replaced:* each term with its forms, places and files. "Don't hide" needs a confirmation (two for numbers found by a pattern).
- *Hidden facts* (Strict): blurred dates, amounts and other facts. Un-blurring one is recorded with the person's name and time.
- *Files:* each file's result. A file that needs a manual check (for example a page in a non-Latin script, or uncertain OCR) can be read and approved by a person; if non-Latin text is still showing, the person must type APPROVE. The approver's name and time are recorded.
- Any change after the review is finished, and any new file, means the review must be finished again.

**The double checker.** After the review is finished, and again at every export of any matter (Strict or Standard), Cloak runs five checks on everything that would be written: the cloaked copies and their file names, the context sheet, the chronology, the report and the marker file. They use rules and word lists. No AI is used, and nothing goes over a network.

1. *Key sweep:* every value the matter's key holds (names in all their forms, ID numbers, addresses, emails, phones) must not appear outside a tag. In Strict mode the blurred facts (dates, amounts, references, places, projects, job titles, courts) are also looked for by meaning, in any format Cloak knows (`RM4,317,250` is found when the key holds `RM 4,317,250.00`).
2. *Pattern sweep:* the ID-number, phone, email, bank, case, land title and vehicle patterns are run again from scratch.
3. *Leftover names:* anything that still looks like a name (words after a title, names with bin, binti, a/l or a/p, words on Cloak's name lists, capitalised words that are not ordinary words).
4. *Hidden places:* every part of every file written is checked, and each finding says which part it is in: file name, body, header, footer, footnotes, comments, tracked changes, document properties, sheet names, email headers, attachment names.
5. *Tags:* every tag must be well formed and in the key, and one real value must not sit under two different tags.

Each finding holds the export until a person either hides it or marks it "It is fine". Cloak records that person's full name, computer login and time. The double check does not replace the review.

It has gaps, because it works by rules and word lists and looks at what would be written, not at the originals: anything the first pass could not read (small text in pictures, signatures, barcodes) is not in the copies, so the double check cannot see it either. It does not look on their own for names of one or two letters (such as Ng or Ho), honours on their own (Tan Sri, Dato'), three-letter forms such as Lee or Ali unless written with a capital, names that are also everyday words unless written as in the key, values a reviewer chose to show, or amounts and dates written in words. Names in Chinese, Tamil or Jawi script are not read for names. "It is fine" is a person's statement, and Cloak cannot tell whether it is right.

**Each export is marked** with `REVIEWED-AND-DOUBLE-CHECKED.txt` (and the same in the report): "Reviewed by [name] on [date]. Double-checked by [name] on [date]."

**The licence is a separate condition.** An evaluation copy (no licence, or one that has ended) exports only from matters ticked as made-up test documents, whatever the double check says. A real matter needs both a licence and a passed double check.

**Checks on a returned draft** (rule-based, no AI, no network): (1) restore check: no tag left, none invented or damaged, and, in Strict mode, no blurred fact the key holds (a date, amount, reference, place, project, job title or court) written out in full by the AI (names, ID numbers, phone numbers and addresses typed in by the AI are not looked for); (2) source check, run only when the lawyer chooses the documents folder: dates, amounts (except rounded ones), references, places, project names, job titles and courts in the restored draft that are not in the source documents fail, and names Cloak recognises (four characters or more) that are not in them get a warning; (3) arithmetic and timeline: day counts, totals and dates that run backwards. Each gives pass, warn or fail with the paragraph.

## 7. The log

`log.jsonl` in the matter folder records **who** (the person's full name and computer login), **when** (date and time) and **what**: matter created, opened (with password or recovery code), failed opening attempts, setup changed, folder cloaked (with counts and seconds), each review change (the kind of change and the tag, such as `PERSON_3`), files checked by hand (by file number), review completed, double-check runs and each decision on a finding (which kind of check and how many places), chronology changes, export (files written and held back, and exports refused by the double check), draft restored (tags restored and the check result), lock taken over, matter closed. (Changing a password, replacing the recovery code and clearing the cache would also be logged, but there is no screen for them yet.)

**It never records a name, number, document text or file name from the documents.** It does record the firm's own people (full name and computer login).

Limits: it is a plain text file. Anyone with access to the matter folder can read or edit it. It is a working record, not a tamper-proof audit trail. It does not record what the lawyer does with the cloaked copies outside Cloak.

## 8. The offline design, and how to check it

**What the code does** (checkable in `app/main.js` in the installed program folder; the IT guide and offline note below describe it in more detail):

- The program's own code makes no network calls. OCR runs locally with language data shipped inside the app; it is never downloaded.
- The window can load only the app's own files. Every other request is refused (`webRequest.onBeforeRequest` cancels anything that is not a local file).
- Name lookups in the window's browser engine are switched off (`host-resolver-rules MAP * ~NOTFOUND`). Background networking, component updates, sync, pings, translation and similar browser features are switched off.
- Every permission request (camera, microphone, location, notifications) is refused. New windows and navigation away from the app are blocked.
- There is no auto-update and no usage reporting. Cloak never sends crash reports and does not start the browser engine's crash reporter. If it crashes, Windows or macOS may record a crash report of their own and, depending on the computer's settings, send it; IT can turn that off (the IT guide says how).
- The window is built on Electron 33. With no auto-update, security fixes to its browser engine reach a firm only as a new installer.
- In the current build the program files are installed as readable JavaScript (not packed into an archive), so IT can read these files in the installed program. The same fact means that anyone who can write to the program folder (on a per-user install, the user's own account) could change the program, and Cloak would not notice.

**How IT can check it themselves:**

1. **Block it and use it.** Add a firewall rule that blocks all outbound traffic for the Cloak program, then cloak and restore a made-up matter. Everything should work.
2. **Watch it.** Run a made-up matter while watching network connections: Windows Resource Monitor (Network tab) or a firewall log on Windows; Little Snitch, LuLu or `nettop` on a Mac. Cloak should open no connections.
3. **Air gap.** Install it on a computer with no network at all and run a full matter.
4. **Read the code.** See the files named above.

An IT deployment guide (silent install and uninstall, where data is kept, how to remove everything, hardware) and a written offline note (every part that runs, and what keeps it off the network) are available from us. The automated tests run a whole cloak of a made-up matter with every network function booby-trapped and record no attempt, and run the window with Chromium's network log on and find no connection. They run on Linux; on Windows and Mac, use the checks above.

**What this does not cover:** the AI tool the lawyer uses (it is online by nature and outside Cloak); the operating system's own services (for example cloud-based antivirus scanning or backup software, which may upload files from the documents, matter or export folders); sync apps; and the system clipboard. Restored drafts carry real names, so on computers that restore drafts, turn off Windows clipboard history and sync across devices.

## 9. What Cloak cannot read and what it will miss

From the Cloak desktop README (not installed with the program). This is the most important list in this statement.

**What it reads:** `.docx`, `.pdf`, `.xlsx`, `.txt`, `.eml`, `.msg`, `.jpg`, `.png`, `.tif`, and zip archives. To use Outlook email, save the messages as `.eml` or `.msg` into the folder; `.msg` is not yet tested.

**Whole files it cannot read** (blocked and listed, never exported): old Word `.doc`, `.rtf`, old Excel `.xls`, PowerPoint, iPhone `.heic` photos, archives other than zip (rar, 7z, tar, gz), Outlook mailbox files (`.pst`, `.ost`), audio, video, any type not listed, and anything password-protected or damaged.

**Parts that block the whole file:** old-style embedded objects in Word or Excel, macros, EMF/WMF pictures, XFA forms in PDFs, an email attached inside an Outlook `.msg`, an Outlook email stored only as rich text, encrypted or signed-and-wrapped emails, `winmail.dat`.

**Parts that are not read and are left out of the copy:** email routing headers, the name in a PDF digital signature, PDF scripts, drawn stamps, barcodes and QR codes, a signature or a few handwritten words on a typed page, small or low-resolution text inside pictures, formatting.

**Read, but may be wrong:** OCR text (misread letters), the reading order of PDF pages in columns or tables, file names inside a zip not saved in UTF-8.

**Not tested yet:** Outlook `.msg` files and scanned Tamil pages, and cloud-only files in OneDrive or Google Drive. **Earlier builds:** builds of 0.1.0 made before 15 November 2026 could read some scanned PDF pages (fax, JBIG2 and JPEG 2000 pictures) and Chinese text in some PDF fonts as blank pages, without a warning. The current build reads them.

**Names and details it will miss:**

- A name with no clue around it (no title, no bin/binti, a/l or a/p, no NRIC beside it, not in the name lists). It goes on the "not sure" list for a person to decide, if it looks like a name.
- One-word names and nicknames, unless they follow a title or match part of a full name found elsewhere in the folder.
- People described but not named ("the only cardiologist in Kuantan").
- Names in Chinese, Tamil or Jawi script. A file whose text has five or more such characters is held for a manual check. With fewer (for example a two- or three-character Chinese name in an English or Malay file) the file is not held and the name stays visible: the Files tab shows "N non-Latin characters showing" with a "Hide all non-Latin text" button, but nothing makes the reviewer act on it, it is not on the "Not sure" list, and the double check does not flag it.
- Words inside pictures on a typed page (stamps, letterheads, handwriting).
- Handwriting and poor scans (low-confidence OCR blocks the file).
- Places and organisations without a company ending (a town, a school, a government office), unless part of an address.
- Unusual number formats, and vehicle plates that are not three letters and digits unless a word like "vehicle" comes first.

**What Strict mode still lets through:** places not on its list and without a cue word; products, brands and vessel names; job titles other than the listed ones; unusual events and how something happened; relative dates ("last Friday"); amounts and dates written in words; anything OCR misread; and **the shape of the dispute**, which a person who knows the case may recognise even with every value blurred.

## 10. Measured figures, and their limits

None of these figures is a guarantee. They were measured on made-up documents.

**Speed** (one trial on a 4-core test machine, from the IT guide; not a benchmark):

- A 300-page scanned bundle took about 9 minutes, almost all of it OCR. A 5,000-row spreadsheet added about a minute to a run. Peak memory was about 1.2 GB.
- Files that have not changed are not read again (Cloak keeps an encrypted copy of what it read), so a second run on the same folder is much quicker.
- Our own 20-file made-up test matter finishes inside 60 seconds (an automated test checks this).
- Limits: one machine. Speed depends on the number of cores, the disk and the quality of scans. Large scans are slow the first time. A fuller speed run on a large matter has not been finished.

**Detection** (all on made-up documents; none of this is a guarantee):

- The name rules were measured on a made-up matter of 15 files (a landscaping subcontract dispute in Johor) that our own team wrote and kept apart while the latest rules were written. Before the latest rules, 59 of 278 places where a real name appeared were still readable and not flagged. After them, 6 were, and 1 more was only partly hidden (a surname taken for an ordinary word). Five more were left on the "Not sure" list for a person to decide.
- The six misses were a nickname used on its own ("Will", four times) and two lowercase names in informal notes. Nicknames overall: 12 of 16 hidden, 4 still missed. English short forms (William and Will) are not handled.
- In 4 places an ordinary word or a place was still hidden as if it were a person (for example "ask"). Ordinary words such as "mark" and "may" landed on the "Not sure" list in 10 of 74 places, up from 2, so a reviewer has more to decide.
- On full names in five kinds of sentence, made-up names only: Malay with bin or binti, Chinese, and Indian with a/l or a/p were all hidden; Malay without bin or binti, 90% hidden and 10% flagged; Indian without a/l or a/p, 88% hidden and 12% flagged; English, 82% hidden and 18% flagged. No silent miss in any group. "Flagged" helps only if a reviewer acts on it.
- The same team wrote this matter and the rules and knew what kinds of name it held, so real documents will do worse. One small matter is not a miss rate.
- This is why the review screen and the double check are compulsory, and why a person must read each export before it leaves the firm.

**Installers:** about 0.5 GB installed (the IT guide gives the sizes). Currently not code-signed.

## 11. What the firm still needs to do

Cloak is one control among several. The firm remains responsible for:

- choosing the AI tool, reading its terms (retention, training, server location) and deciding whether to use it on a matter;
- reading each review screen properly and reading the cloaked copies before they leave the firm;
- strong matter passwords, and keeping recovery codes safe and separate from the key file;
- device and drive encryption, access control on matter folders, and backups of matter folders;
- keeping matter folders on a real shared drive, not a synced folder;
- checking each restored draft, as with any draft, and keeping restored drafts off the clipboard history (turn off Windows clipboard history and sync on computers that restore drafts);
- its own legal obligations (see the research memo, and take the firm's own advice).

Questions from a firm's IT team: [owner to add a contact name and email before sending].
