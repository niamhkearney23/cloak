# Cloak: pitch deck

12 slides for managing partners of Malaysian disputes firms. Each slide has a headline, three bullets and a speaker note. Legal points are not argued on the slides: they point to `compliance-notes.md`, a research memo written for review by a Malaysian advocate (not legal advice). Figures are given with what they were measured on.

---

## Slide 1: Use AI on disputes work without handing over your client's details

- Cloak hides client details in a folder of documents before they go to an AI tool.
- It runs on your own computers. The key stays on your own drive.
- Cloak lowers the risk; it does not remove it.

**Speaker note:** Open with the one-sentence promise and the honest qualifier in the same breath. Partners trust a vendor who states the limit first. Mention that the demo laptop's network is off and will stay off.

---

## Slide 2: Your lawyers want AI. Your documents are full of client details.

- Pleadings, affidavits, emails and ledgers name clients, opposing parties and witnesses, with NRIC numbers, addresses and accounts.
- Pasting them into an AI tool sends all of that to another company.
- The Malaysian Bar has issued guidance on generative AI, and the courts have announced a practice direction (see our research memo).

**Speaker note:** Don't argue the law. Say that guidance exists, that it raises confidentiality and data protection, and that our memo sets out the sources for their own adviser. Never say the Bar approves Cloak: it approves no product.

---

## Slide 3: Four steps, one window

- **Cloak a folder:** names, companies, IDs, addresses and accounts become tags like `{{PERSON_1}}`.
- **Review:** a named person decides every uncertain word before anything leaves.
- **Export and restore:** give the cloaked copies to your AI tool; paste its draft back and Cloak puts the real details in.

**Speaker note:** The window has two buttons: "Cloak a folder" and "Restore a draft". The same person gets the same tag in every file and every spelling ("Mr Tan", "Tan Boon Huat"), so the AI's draft stays consistent.

---

## Slide 4: What stays with you, and what the AI company sees

- Stays on your computer: the originals (only ever read), the encrypted key, the review and the restored draft.
- Goes to the AI company: only the cloaked copies your lawyer chooses to give it.
- Cloak itself sends nothing anywhere and makes no network connections.

**Speaker note:** Be precise: the AI company does receive the cloaked text. It sees tags, not names, but can still see the kind of dispute, and anything Cloak missed. Their terms on keeping data and training still matter, and the firm should read them.

---

## Slide 5: It reads every part of every file, or blocks the file

- Word headers, footers, comments and tracked changes (deleted text too); hidden Excel sheets; email attachments; file and folder names.
- Scanned pages go through OCR on your machine (English, Malay, Chinese, Tamil).
- A file it cannot read completely is blocked and listed with the reason. It is never half-exported.

**Speaker note:** This is the "completeness rule". Hand redaction often misses tracked changes, comments and file names. Be honest about the other side: old `.doc` files, PowerPoint and some formats are blocked rather than read (security statement, section 9).

---

## Slide 6: A person decides, and the output is swept

- The "not sure" list shows each possible name once, with how many places and files.
- Before export, Cloak looks for every value in the key, in any format. One hit stops the export.
- Coming next: the double checker, a second independent check with hand approval of each finding (in progress).

**Speaker note:** Stress that the review is compulsory: nothing is written anywhere until every item is decided. Each export is marked with the reviewer's name. The double checker is being built; until it is finished, export works only on matters ticked as made-up test documents.

---

## Slide 7: Strict mode blurs the facts too

- Dates, amounts, reference numbers, listed places, project names, some job titles and court names become tags.
- Dates are numbered in time order, and the context sheet shows which amount is larger and which adds up to which, so a draft can still follow the facts.
- A context sheet tells the AI who is who by role, never by name.

**Speaker note:** Strict is the default. Be clear about what it cannot hide: the shape of the dispute (who sued whom, for what, in what order) can still be recognised by someone who knows the case. Standard mode hides identifiers only.

---

## Slide 8: The real details come back on your computer, checked

- Paste the AI's draft (or choose a `.txt`, `.md` or `.docx`) and Cloak restores every tag.
- Three plain-code checks: tags invented or damaged by the AI; every date, amount and name found in the documents; day counts, totals and timelines.
- Dates and titles come back in the language of the sentence: "3 March" in English, "3 Mac" in Malay.

**Speaker note:** The checks catch an AI that invents a person or changes a figure. They don't replace the lawyer reading the draft. No AI is used in the checks and nothing goes online.

---

## Slide 9: Security your IT team can check

- No internet needed: the window refuses every request that isn't a local file; no auto-update; IT can block it in the firewall and it still works.
- The key is encrypted with AES-256-GCM, opened by a password or a printed recovery code. There is no back door.
- A log records who did what and when, never a real name or number.

**Speaker note:** Offer the security statement to IT. Be honest: anyone with a copy of the key file can try passwords offline, so long passwords matter; the log is plain text, not tamper-proof; installers are not code-signed yet (signing-ready installers are in progress).

---

## Slide 10: What it will miss (we measured it)

- On a made-up matter of 22 files it had never seen, names were still visible in 13 of the 22 files after cloaking: nicknames, single names, lowercase names in file notes.
- Several of those gaps have been fixed since; more work is under way. Our own test matters score better, but they flatter the tool.
- That's why a person must review every export, and why we're building the double checker.

**Speaker note:** Say this slide plainly; it earns trust. Do not offer a percentage that wasn't measured. Other known gaps: people described but not named, words inside pictures and handwriting, names in Chinese, Tamil or Jawi script (the file is held for a manual check).

---

## Slide 11: Where we are today

- Built: cloaking, the encrypted key, the review screen, Strict mode, the chronology table and restore with checks.
- In progress: the double checker, an offline licence, signed installers, a sample matter and help screens, a redesigned window.
- Speed on a 4-core test machine: a 20-file made-up matter inside 60 seconds; a large made-up matter (300-page scan, 60-page agreement, 5,000-row ledger) 623 seconds the first time, 543 of them OCR (about 1.8 seconds a page), and 64 seconds from the cache.

**Speaker note:** Be clear that real-matter export opens when the double checker is finished. Until then a pilot runs on made-up documents, which is also the fairest way for a firm to measure what Cloak misses.

---

## Slide 12: A 30-day pilot, measured by you

- Weeks 1 and 2 on our sample matter and a made-up folder your own team writes; IT checks it works offline.
- You measure time saved, details still visible before and after review, and whether your lawyers would keep using it.
- Pricing options and a pilot letter are ready to discuss [owner to confirm the figures before quoting].

**Speaker note:** Close on the pilot, not the price. Lawgistics never receives the firm's documents during the pilot. Hand over the security statement, the FAQ and the research memo for the firm's adviser. Do not quote prices from `pricing-and-pilot.md` until the owner has approved them.
