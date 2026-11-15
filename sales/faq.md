# Cloak: questions and answers

For managing partners, IT and risk or compliance staff at Malaysian disputes firms. Answers describe Cloak version 0.1.0 as at 15 November 2026.

Three rules for anyone using this page to sell:

1. **Never say Cloak is perfect, compliant, certified or approved.** It is none of those. Say: **"Cloak lowers the risk; it does not remove it."**
2. **Never give legal advice.** For legal questions, point to `sales/compliance-notes.md`, a research memo written for review by a Malaysian advocate (it is not legal advice), and suggest the firm takes its own advice.
3. **Never quote a figure as a guarantee.** Give the figure, what it was measured on, and its limits.

The technical detail behind these answers is in `sales/security-and-data-protection.md`.

---

## Hard questions (objection handling)

### "Is this allowed under the PDPA?"

**What to say:** "We can't tell you that. We're not your lawyers, and whether a particular use of AI is allowed is a question for your firm and its advisers. What we can do is show you exactly what Cloak does, and give you our research memo, which sets out the PDPA provisions and Bar Council guidance that may apply, with sources, written for review by a Malaysian advocate. Cloak is designed to reduce what leaves your firm. It does not decide for you whether to use AI."

**Then:** hand over `compliance-notes.md`. Point to its short answer (section 2) and its questions for the reviewing advocate (section 9).

**Do not say:** "Cloak makes you PDPA compliant", "the data is anonymised so the PDPA doesn't apply", or "the Bar allows it".

### "What if it misses a name?"

**What to say:** "It will, sometimes. We measured it honestly. On a made-up matter of 22 files written by our owner and never seen by the tool, names were still visible in 13 of the 22 files after cloaking: nicknames, single names, lowercase names in file notes, a client name used in folder names. Several of those gaps have been fixed since and more work is under way, but no rule-based tool catches everything. That is why Cloak makes a person review every hidden term and every 'not sure' word before anything can be exported, why it sweeps the output for every value in the key before export, and why we are building a second, independent check (the double checker). Your lawyer should still read the cloaked copies before they go anywhere."

**Then:** show the "Not sure" list and the key sweep in the demo. Show the list of what it will miss (security statement, section 9).

**If pressed for a percentage:** do not invent one. Give the 13 of 22 figure and say it was measured before the latest fixes and has not been re-measured on a new unseen matter yet.

### "Does any data go to the AI company?"

**What to say:** "Cloak itself sends nothing to anyone. It makes no network connections. Your lawyer chooses an AI tool and gives it the cloaked copies. So yes, the AI company receives the cloaked text: tags instead of names and numbers, and in Strict mode tags instead of dates, amounts and other facts. It can still see what kind of dispute it is, and anything Cloak missed. What that company does with the text depends on its own terms, so check whether it keeps the text or uses it for training, and where its servers are."

### "Does any data go to Lawgistics?"

**What to say:** "No. Cloak runs on your computers and the matter key stays on your drive. We never receive your documents, keys or cloaked copies. If you need support, we will ask for screenshots or files from a made-up matter, never a real one."

### "What happens if we lose the password?"

**What to say:** "Each matter has a password and a recovery code. The code is shown once when the matter is created, with a Print button: keep it with the paper file or in the safe. If the password is lost, the recovery code opens the matter. If both are lost, nobody can open the key, including us. There is no back door. Your original documents are untouched, so you can cloak the folder again under a new key, but drafts the AI wrote with the old tags can no longer be restored automatically."

**Be honest about a current gap:** changing a matter's password and replacing its recovery code are built into the program's core but are not yet on a screen.

### "We'll just tell our people not to use AI."

**What to say:** "That's a fair choice and Cloak doesn't change it. If your lawyers are already using AI tools, or you want them to, Cloak gives you a controlled way: hide client details first, have a named person review, keep a record, and put the details back on your own computer."

### "We already have an enterprise AI tool with good privacy terms."

**What to say:** "Good: that matters, and you should keep it. Cloak works alongside it. Good terms control what the AI company may do with your text. Cloak reduces what is in the text in the first place."

### "Our staff can redact by hand."

**What to say:** "They can. Cloak is faster and more consistent across a whole folder: the same person gets the same tag in every file and every spelling, and it reads parts people often miss, like tracked changes, comments, headers, hidden sheets and file names. And it puts the real details back into the draft afterwards, which hand redaction does not."

### "Our clients would never agree to AI being used on their matters."

**What to say:** "Then don't use AI on those matters. Whether to tell clients and ask for consent is your firm's decision. Our research memo lists it as a question for your adviser."

---

## For managing partners

**What is Cloak, in one sentence?**
A desktop program that hides client details in a folder of documents before they go to an AI tool, keeps the key encrypted on your own drive, and puts the real details back into the AI's draft afterwards.

**Can we use it on real matters today?**
Not for export yet. Until the double checker is finished (in progress), Cloak exports cloaked copies only from matters ticked as "made-up test documents only". You can try every step on made-up or sample documents now.

**Which AI tools does it work with?**
Any tool that accepts text or files. Cloak does not connect to any AI tool. The lawyer gives the cloaked copies to the tool and brings the draft back.

**Will the AI's drafts still make sense with tags in them?**
Tags are built to keep their meaning (`{{PERSON_1.SURNAME}}`, `{{DATE_3}}`), and in Strict mode Cloak adds a context sheet that tells the AI who is who (roles only) and how dates and amounts relate (order, gaps, totals). The quality of the draft depends on the AI tool; we have not measured it.

**How long does it take?**
On a 4-core test machine, the 20-file made-up test matter finishes inside 60 seconds. A large made-up matter (300-page scanned bundle, 60-page agreement, 5,000-row ledger) took 623 seconds the first time, most of it OCR of the scan (about 1.8 seconds a page), and 64 seconds when run again from the encrypted cache. Your times will differ.

**Does it handle Bahasa Malaysia, Chinese and Tamil documents?**
It reads Malay dates and month names (for example "3hb Julai 2025", "3 Mac 2023"), Malay job titles and Malay name patterns (bin, binti, a/l, a/p). OCR covers English, Malay, Chinese and Tamil. Names written in Chinese, Tamil or Jawi script are not tagged automatically: the file is held for a manual check. Scanned Tamil pages have not been tested yet.

**Who has to use it, and how much training?**
The lawyer or clerk who prepares documents for the AI, and a reviewer. The window has two buttons: "Cloak a folder" and "Restore a draft". We have not measured training time; our estimate is a first session of about an hour with a made-up matter. Help screens and a sample matter are in progress.

**Does the Bar Council allow this?**
The Bar Council has issued guidance on generative AI and on cloud services. It does not endorse or approve any product, including Cloak. What the guidance says, with sources, is in our research memo (section 5.3). Read it with your adviser.

**What about the courts' rules on AI?**
The Chief Justice announced on 28 October 2026 that a practice direction on AI use in legal proceedings would be issued within weeks. We had not seen it as at 15 November 2026. Check it when it is issued.

**What does it cost?**
See `sales/pricing-and-pilot.md`. Prices there are suggestions for the owner to decide.

## For IT

**Does it need the internet?**
No. The program's code makes no network calls; its window refuses every request that is not for a local file; name lookups in its browser engine are switched off; there is no auto-update and no usage reporting. OCR language data ships inside the program.

**How can we check that ourselves?**
Block the program in your firewall and run a made-up matter: it should work. Or watch its connections (Resource Monitor on Windows; Little Snitch, LuLu or `nettop` on a Mac) while it runs. Or install it on a machine with no network. In the current build the program files are installed as readable JavaScript, so you can read the code that sets these rules. An IT deployment guide and a written offline test are in progress.

**What does it install?**
A Windows installer of about 178 MiB that installs for the current user, and a Mac disk image of about 202 MiB. Both are currently **not code-signed**, so Windows shows a "publisher unknown" warning and some antivirus tools may be cautious. Signing-ready installers are in progress.

**How is it licensed?**
An offline licence (a signed licence file, with an evaluation mode) is in progress. It is designed to work without contacting any server.

**How are updates delivered?**
By a new installer, which you install yourselves. There is no automatic update.

**Where does it keep data?**
In a matter folder you choose on your own drive: the encrypted key, an encrypted cache, a log and a lock file. Cloaked copies go to an export folder you choose. Settings (the user's full name, and a remembered password only if the user asks) are kept in the program's settings folder on that computer. Full table: security statement, section 4.

**Can the matter folder be on our shared drive, OneDrive or iManage?**
On a real shared network drive, yes. Not in a synced folder (OneDrive, Google Drive, iManage Drive): Cloak refuses, because the sync app would upload the key. Documents can be read from a synced folder, which Cloak treats as read-only. This detection has been tested on made-up paths only, not on a real iManage installation.

**What encryption does it use?**
AES-256-GCM for the key and the cache. The matter key is unlocked by a password (at least 10 characters) or a recovery code, both stretched with scrypt (about a third of a second and 128 MB of memory per guess). Any change to the key file is detected. There is no back door.

**Is there an audit log?**
Yes, `log.jsonl` in the matter folder: who, when and what, never real values. It is plain text and not tamper-proof.

**Can two lawyers work on one matter?**
Yes, one at a time. A second lawyer opens the same matter folder with the password. A lock file shows who has it open; taking a lock over is logged.

**What does it run on, and what are the minimum requirements?**
Windows first, and Mac. Minimum requirements have not been set yet. Our speed figures come from a 4-core test machine.

**What third-party software is inside?**
Open-source components including Electron (the window), tesseract.js (OCR), pdf.js (PDF reading) and msgreader (Outlook files). A full list of third-party licences is being prepared (in progress).

**Is Lawgistics certified (ISO 27001, SOC 2)?**
No. Lawgistics does not receive or hold your documents, but we hold no security certification and do not claim one.

## For risk and compliance

**Does Cloak make us PDPA compliant?**
No product can do that, and we don't claim it. Cloak is one measure that reduces what leaves the firm. The legal questions are set out in our research memo for your adviser.

**Is cloaked text still personal data?**
Our research memo discusses this (section 6.1). In short, it treats the question as unresolved and suggests firms do not rely on "it is no longer personal data". Take your own advice.

**What if a real name goes to the AI by mistake?**
Treat it under your firm's incident procedure. Cloak's log shows who reviewed and exported the copies and when. Whether anything must be reported is a legal question; our memo covers the breach notification rules (section 6.6) for your adviser.

**What records does Cloak keep that help us show oversight?**
The log (who reviewed, approved, exported and restored, and when), the report in each export (what was read from each file and what was blocked) and a marker in each export naming the reviewer. They do not record what the lawyer does in the AI tool.

**What happens when a lawyer leaves the firm?**
Today, matter passwords are shared by the people on the matter. Changing a matter's password is built into the program's core but is not yet on a screen. Until it is, plan matter passwords with this in mind.

**How do we delete a matter?**
Delete the matter folder (the key, cache and log) according to your retention policy. Without the key, cloaked copies cannot be turned back into real names by Cloak. Cloak never changes or deletes the original documents.

**Can we see the code?**
In the current build the program files are installed as readable JavaScript, so your IT team can read them. [Owner to decide whether to offer a guided code review.]

**Should we tell our insurer?**
That is for your firm. Some firms check new technology with their professional indemnity insurer.
