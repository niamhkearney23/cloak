# Cloak: pitch deck

12 slides for managing partners of Malaysian litigation and dispute resolution firms. Each slide has a headline, three bullets and a speaker note. Legal points are not argued on the slides: they point to our research memo, "Cloak: PDPA, confidentiality and Bar guidance", written for review by a Malaysian advocate (not legal advice). Figures are given with what they were measured on. Describes the current build of Cloak 0.1.0, an early version, as at 15 November 2026.

---

## Slide 1: Hide your client's details before documents go to an AI tool

- Cloak hides client details in a folder of documents before they go to an AI tool.
- It runs on your own computers. The key stays on your own drive.
- Cloak lowers the risk; it does not remove it.

**Speaker note:** Open with the one-sentence promise and the qualifier in the same breath: partners trust a vendor who states the limit first. Mention that the demo laptop's network is off and will stay off.

---

## Slide 2: Your lawyers want AI. Your documents are full of client details.

- Pleadings, affidavits, emails and ledgers name clients, opposing parties and witnesses, with NRIC numbers, addresses and accounts.
- Pasting them into an AI tool sends all of that to another company.
- The Malaysian Bar has issued guidance on generative AI, and the Chief Justice has said a court practice direction on AI is coming (see our research memo).

**Speaker note:** Don't argue the law. Say that guidance exists, that it raises confidentiality and data protection, and that our memo sets out the sources for their own adviser. Never say the Bar approves Cloak: it approves no product. Do say, if asked, that the Bar's Circular No 242/2025 discourages putting client-specific facts into any generative AI tool, that cloaked text can still carry such facts, and that the memo (sections 5.3 and 6.9) sets this out for the firm's adviser.

---

## Slide 3: Three steps, one window

- **Cloak a folder:** names, companies, IDs, addresses and accounts become tags like `{{PERSON_1}}`.
- **Review:** a named person decides every uncertain word, and a second check runs before anything is exported.
- **Export and restore:** give the cloaked copies to your AI tool; paste its draft back and Cloak puts the real details in.

**Speaker note:** The window has two buttons: "Cloak a folder" and "Restore a draft". The same person gets the same tag in every file and in the other spellings and short forms Cloak can link ("Mr Tan", "Tan Boon Huat"), so the AI's draft stays consistent. A nickname nobody explains can be missed, and joins are listed for a person to confirm.

---

## Slide 4: What stays with you, and what the AI company sees

- Stays on your computer: the originals (only ever read), the encrypted key, the review and the restored draft.
- Goes to the AI company: only the cloaked copies your lawyer chooses to give it.
- Cloak itself sends nothing anywhere: it has no network code and its window refuses web requests (watched on Linux; IT can confirm on Windows and Mac with a firewall rule).

**Speaker note:** Be precise: the AI company does receive the cloaked text. It sees tags in place of the names Cloak hid, but can still see the kind of dispute, and anything Cloak missed. Their terms on keeping data and training still matter, and the firm should read them.

---

## Slide 5: It reads every part of every file, or blocks the file, apart from a short list of exceptions

- Word headers, footers, comments and tracked changes (deleted text too); hidden Excel sheets; email attachments; file and folder names.
- Scanned pages go through OCR on your machine. English and Malay are read and cloaked; a Chinese or Tamil page is held for a person to check, because names in those scripts are not hidden (scanned Tamil not yet tested).
- A file with a part it cannot read (an old embedded object, a macro, a protected or damaged attachment) is blocked and listed with the reason. A page it cannot read reliably holds the file until a named person checks and approves it.

**Speaker note:** This is the "completeness rule". Hand redaction often misses tracked changes, comments and file names. Be open about the other side: old `.doc` files, PowerPoint and some formats are blocked rather than read (security statement, section 9). A few parts are not read and do not block the file; they are left out of the copy: email routing headers, the name in a PDF digital signature, drawn stamps, barcodes and QR codes, a signature or a few handwritten words on a typed page, and small or faint text inside pictures.

---

## Slide 6: A person decides, and the output is checked twice

- The "not sure" list shows each possible name once, with how many places and files.
- Before every export, the double checker reads everything that would be written. It looks again for the values in the key (dates and amounts in any format), for ID numbers, and for anything that still looks like a name.
- Nothing is exported until a named person has hidden each finding or marked it as fine. A name that neither check recognises still gets through.

**Speaker note:** Stress that the review is compulsory: no cloaked copy is written until every uncertain word is decided and the double check has passed. The encrypted key, an encrypted cache of what was read, and the log are kept in the matter folder from the start. Each export is marked with the names of the reviewer and the double-checker. The double checker uses rules and word lists, not AI: two-letter surnames such as Ng are caught only after a title, and three-letter ones such as Tan only when written with a capital.

---

## Slide 7: Strict mode blurs the facts too

- Dates, amounts, reference numbers, listed places, project names, some job titles and court names become tags.
- Dates are numbered in time order, and the context sheet shows which amount is larger and which adds up to which, so a draft can still follow the facts.
- The context sheet gives the AI each person's role where the wording states it (many get none), never a name.

**Speaker note:** Strict is the default. Be clear about what it cannot hide: the shape of the dispute (who sued whom, for what, in what order) can still be recognised by someone who knows the case. Standard mode hides identifiers only.

---

## Slide 8: The real details come back on your computer, checked

- Paste the AI's draft (or choose a `.txt`, `.md` or `.docx`) and Cloak restores the tags.
- Three rule-based checks: tags invented or damaged by the AI; dates, amounts and places that are not in the documents (when you point it at the documents folder); day counts, totals and timelines.
- Dates and titles come back in the language of the sentence: "3 March" in English, "3 Mac" in Malay.

**Speaker note:** The checks catch an AI that invents a person or changes a figure. They don't replace the lawyer reading the draft. No AI is used in the checks and nothing goes online.

---

## Slide 9: Security your IT team can check

- No internet needed: the window refuses every request that isn't a local file; no auto-update; IT can block it in the firewall and it still works.
- The key is encrypted with AES-256-GCM, opened by a password or a printed recovery code (a person can let Windows or macOS remember the password for their own login). There is no back door.
- A log records who did what and when, never a name or number from the documents (it does name the lawyers who used Cloak).

**Speaker note:** Offer the security statement to IT. Be open about the limits: anyone with a copy of the key file can try passwords offline, so long passwords matter; if a person ticks "Remember the password on this computer", anyone using their Windows or macOS login can open that matter without typing it; the log is plain text, not tamper-proof; installers are not code-signed yet (signing is set up but waits for certificates to be bought, and has never been run). Changing a matter password or replacing its recovery code (Matter settings) locks the old one out of the matter folder, not out of a copy of the key file someone already took.

---

## Slide 10: What it will miss (we measured it)

- A 22-file made-up matter, written outside the team that wrote the rules and never shown to the tool during development, run once on 12 November 2026 on an earlier version and counted by hand: people's names were still visible in 13 of the 22 files (nicknames, single names, lowercase names in file notes).
- Rewritten name rules, measured on a separate 15-file made-up matter written by our own team: 59 of 278 name places missed before, 6 after. Our own matters flatter the tool.
- That's why a person must review every export, and why the double checker looks again before every export.

**Speaker note:** Say this slide plainly; it earns trust. The 22-file result was not recorded in the project and has not been re-run; the second result is a best case because the same team wrote the matter and the rules. Do not offer a percentage that wasn't measured. Other known gaps: people described but not named, words inside pictures and handwriting, names in Chinese, Tamil or Jawi script (a file with five or more such characters is held for a manual check; a short name in an otherwise English file is not caught).

---

## Slide 11: Where we are today

- Built: cloaking, the encrypted key, the review screen, the double checker, Strict mode, the chronology table, restore with checks, a sample matter, help screens, a support file and an offline licence file.
- In progress: a redesigned window. Installers are set up for code signing but are unsigned: no certificates have been bought. Not built: a local connector for AI tools and Outlook email support inside the app.
- Speed on one 4-core test machine: our own 20-file made-up matter inside 60 seconds; a 300-page scanned bundle about 9 minutes, almost all OCR; unchanged files are not read again.

**Speaker note:** Be clear that exporting a real matter needs a licence file from Lawgistics. Without one, Cloak is an evaluation copy and exports only matters ticked as made-up test documents, and no licence can be issued until Lawgistics builds its own licence key into Cloak. Until then a pilot runs on made-up documents, which is also the fairest way for a firm to measure what Cloak misses.

---

## Slide 12: A 30-day pilot, measured by you

- Weeks 1 and 2 on the built-in sample matter and a made-up folder your own team writes; IT checks it works offline.
- You measure time saved, details still visible before and after review, and whether your lawyers would keep using it.
- Pricing options and a pilot letter are ready to discuss [owner to confirm the figures before quoting].

**Speaker note:** Close on the pilot, not the price. Lawgistics never receives the firm's documents during the pilot. Hand over the security statement, the FAQ and the research memo for the firm's adviser. Do not quote prices from the pricing and pilot document until the owner has approved them.
