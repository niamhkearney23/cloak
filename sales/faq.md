# Cloak: questions and answers

For managing partners, IT and risk or compliance staff at Malaysian litigation and dispute resolution firms. Answers describe the current build of Cloak 0.1.0, an early version, as at 15 November 2026. Cloak lowers the risk; it does not remove it.

Cloak has been tested only on made-up documents. No firm has used it on real matters yet. Legal questions are covered in our research memo, "Cloak: PDPA, confidentiality and Bar guidance", which is written for review by a Malaysian advocate and is not legal advice. The technical detail behind these answers is in our security and data protection statement.

---

## Common questions

### "Is this allowed under the PDPA?"

We can't tell you that. We're not your lawyers, and whether a particular use of AI is allowed is a question for your firm and its advisers. Our research memo sets out the PDPA provisions and Bar Council guidance that may apply, with sources, for a Malaysian advocate to review. Cloak is designed to reduce what leaves your firm. It does not decide for you whether to use AI, and it does not make any use of AI compliant, certified or approved.

### "What if it misses a name?"

It will, sometimes. Two measurements, both on made-up documents, both small:

- On a made-up matter of 22 files, supplied by the Cloak owner and not by the team that wrote the detection rules, people's names were still visible in 13 of the 22 files after cloaking (nicknames, single names, lowercase names in file notes), and the client's name showed in the file-name line of every output. That was run once, on 12 November 2026, on an earlier version (before Cloak asked for the client's name at setup, before the new name rules and before the double checker), and counted by hand. It has not been run again, and the result is not recorded in the project's own documents.
- The name rules were then rewritten and measured on a separate made-up matter of 15 files, written first and kept apart while the rules were developed. Before the new rules, 59 of 278 places where a real name appeared were left readable and not flagged. After them, 6 were, and 1 more was only partly hidden. The same team wrote that matter and the rules, so it is a best case, not a miss rate for real documents.

No rule-based tool catches everything. That is why Cloak will not export until a named reviewer has decided every "not sure" word, every joined name and every short form that could be two people, and signed off the review. The list of everything hidden is on screen to check, but Cloak does not make anyone open it. Before every export a second check, the double checker, reads everything about to be written again and a person must decide each finding. It also uses rules and word lists, so it shares some of the first pass's blind spots. Your lawyer should still read the cloaked copies before they go anywhere.

If you want a percentage: there isn't a reliable one. Give the two results above, say what they were measured on, and run the pilot on your own made-up documents.

### "Does any data go to the AI company?"

Cloak itself sends nothing to anyone: it has no network code and its window refuses web requests (watched on Linux; IT can confirm on Windows and Mac with a firewall rule). Your lawyer chooses an AI tool and gives it the cloaked copies. So yes, the AI company receives the cloaked text: tags instead of the names and numbers Cloak found, and in Strict mode tags instead of dates, amounts and other facts. It can still see what kind of dispute it is, and anything Cloak missed. What that company does with the text depends on its own terms, so check whether it keeps the text or uses it for training, and where its servers are.

### "Does any data go to Lawgistics?"

Cloak runs on your computers and the matter key stays on your drive. We never receive your documents, keys or cloaked copies through Cloak. If something goes wrong, Cloak can save a support file (Help, then About, then "Save a support file") that you check and send yourselves. It holds the Cloak version, system details (operating system, processor, memory, time zone), a self-test, counts about the open matter, and that matter's log. The log names the people at your firm who worked on the matter (full name and computer login) and what they did, but holds no document text and no client details; any value from the matter's key found in the file is replaced by its tag. If a fault only shows up on a real matter, do not send us the real documents; send the support file and describe the fault. Anything more, we ask for from a made-up matter.

### "What happens if we lose the password?"

Each matter has a password and a recovery code. The code is shown once when the matter is created, with a Print button: keep it with the paper file or in the safe. If the password is lost, the recovery code opens the matter. If both are lost, nobody can open the key, including us. There is no back door. Your original documents are untouched, so you can cloak the folder again under a new key, but drafts the AI wrote with the old tags can no longer be restored automatically.

A matter opened with its recovery code goes straight to Matter settings, which asks for a new password. The password can be changed there at any time, and the recovery code replaced: the new code is shown once, with the same Print button, and the old one stops working.

### "We'll just tell our people not to use AI."

That's a fair choice and Cloak doesn't change it. If your lawyers are already using AI tools, or you want them to, Cloak gives you a controlled way: hide client details first, have a named person review, keep a record, and put the details back on your own computer.

### "We already have an enterprise AI tool with good privacy terms."

Good: that matters, and you should keep it. Cloak works alongside it. Good terms control what the AI company may do with your text. Cloak reduces what is in the text in the first place.

### "Our staff can redact by hand."

They can. Cloak is faster and more consistent across a whole folder: the same person gets the same tag in every file, including the other spellings and short forms Cloak can link (a reviewer confirms the joins), and it reads parts people often miss, like tracked changes, comments, headers, hidden sheets and file names. And it puts the real details back into the draft afterwards, which hand redaction does not.

### "Our clients would never agree to AI being used on their matters."

Then don't use AI on those matters. Whether to tell clients and ask for consent is your firm's decision. Our research memo lists it as a question for your adviser.

---

## For managing partners

**What is Cloak, in one sentence?**
A desktop program that hides client details in a folder of documents before they go to an AI tool, keeps the key encrypted on your own drive, and puts the real details back into the AI's draft afterwards.

**Who is behind it?**
Lawgistics makes Cloak. Cloak has been tested only on made-up documents, and no firm uses it on real matters yet.

**Can we use it on real matters today?**
Not yet. Every copy of Cloak today is an evaluation copy: it works fully, but exports cloaked copies only from matters ticked as "made-up test documents only". A real matter needs a Cloak licence from us, and the double check must also pass. We have not made the licence key yet and have not set a date. You can try every step on the built-in sample matter now.

**What if we stop paying, or Lawgistics closes?**
The licence is a signed file that Cloak checks on the computer, with no server and no activation. When a licence ends, Cloak becomes an evaluation copy again: nothing is deleted, and you can still open matters, review, and restore drafts. What stops is exporting cloaked copies from real matters. A licence runs until its end date; there is no way for us to switch one off early.

**Which AI tools does it work with?**
Any tool that accepts text or files. Cloak does not connect to any AI tool (a local connector for AI tools is not built). The lawyer gives the cloaked copies to the tool and brings the draft back.

**Will the AI's drafts still make sense with tags in them?**
Tags are built to keep their meaning (`{{PERSON_1.SURNAME}}`, `{{DATE_3}}`). In Strict mode Cloak adds a context sheet that gives the AI each person's role where it can read one from the wording beside the tag (many people get none, and the sheet tells the AI to check it) and how dates and amounts relate (order, gaps, totals). The quality of the draft depends on the AI tool; we have not measured it.

**Do we get a Word document back?**
Cloaked copies are plain text files. A returned draft can be pasted in, or chosen as a .txt, .md or .docx file. The restored draft is shown as text to copy or to save as a .txt file, so paste it into your own Word template.

**What is the chronology table?**
A table of dated events drawn from the documents by rules (no AI): date, text, people, source file. A reviewer can edit, merge, delete and add rows and then confirms it, and it is exported as its own cloaked file.

**What if documents are added after the copies went to the AI?**
Date tags are numbered in time order across the matter, so adding a file with a new date can renumber later date tags. The report records that the dates changed. Cloak does not yet warn you when you restore a draft made before such a change, so cloak again after adding documents and ask the AI to work from the new copies.

**How long does it take?**
On one 4-core test machine, a 300-page scanned bundle took about 9 minutes, almost all of it OCR, and a 5,000-row spreadsheet added about a minute. Our own 20-file made-up matter finishes inside 60 seconds. Unchanged files are not read again, so a second run is much quicker. A fuller speed run on a large matter has not been finished. Your times will differ. How long the review takes per matter has not been measured; the pilot measures reviewer minutes per matter.

**Does it handle Bahasa Malaysia, Chinese and Tamil documents?**
It reads Malay dates and month names (for example "3hb Julai 2025", "3 Mac 2023"), Malay job titles and Malay name patterns (bin, binti, a/l, a/p). Scanned pages are read by OCR in English and Malay; Chinese and Tamil OCR runs only as a second pass when the first comes out poor, and a Chinese or Tamil page is held for a person to check. Names written in Chinese, Tamil or Jawi script are not tagged automatically. A file with five or more such characters is held for a manual check; with fewer (for example a two- or three-character Chinese name in an English file) the file is not held and the name stays visible. Scanned Tamil pages have not been tested yet.

**Who has to use it, and how much training?**
The lawyer or clerk who prepares documents for the AI, and a reviewer. The window has two buttons: "Cloak a folder" and "Restore a draft". We have not measured training time; our estimate is a first session of about an hour. Help screens (How Cloak works, Your data, About) and a built-in sample matter of ten made-up documents (Home, then "Try a sample matter") are built.

**Does the Bar Council allow this?**
The Bar Council has issued guidance on generative AI and on cloud services. It does not endorse or approve any product, including Cloak. Its Circular No 242/2025 discourages putting client-specific facts into any generative AI tool, and cloaked text can still carry such facts, so a firm could read that circular as discouraging the very use Cloak is built for. What the guidance says, with sources, is in our research memo (sections 5.3 and 6.9). Read it with your adviser.

**What about the courts' rules on AI?**
The Chief Justice said on 28 October 2026 that a practice direction on AI use in legal proceedings would be issued within weeks. We had not seen one issued as at 15 November 2026. Check it when it is issued.

**What does it cost?**
Prices have not been set. Ask us for the current proposal.

## For IT

**Does it need the internet?**
No. The program's code makes no network calls; its window refuses every request that is not for a local file; name lookups in its browser engine are switched off; there is no auto-update and no usage reporting. OCR language data ships inside the program.

**How can we check that ourselves?**
Block the program in your firewall and run a made-up matter: it should work. Or watch its connections (Resource Monitor on Windows; Little Snitch, LuLu or `nettop` on a Mac) while it runs. Or install it on a machine with no network. The program files are installed as readable JavaScript, so you can read the code that sets these rules. We have an IT deployment guide and a written offline note that lists every part that runs and what keeps it off the network. The automated network tests run on Linux, so check Windows and Mac with the steps above.

**What does it install, and how do we roll it out?**
A Windows installer (NSIS) and a Mac disk image, about 0.5 GB once installed. On Windows the installer asks "anyone who uses this computer" or "only for me"; from the command line, `"Cloak Setup 0.1.0.exe" /S` installs silently for the current user and `/S /allusers` (run elevated, for example from Intune or Configuration Manager) installs for everyone, into `%LOCALAPPDATA%\Programs\Cloak` or `C:\Program Files\Cloak`. Upgrading means running the new installer the same way. The guide gives uninstall commands and a detection rule. These options are the installer tool's standard ones and have not yet been tried on a Windows computer. Both installers are currently **not code-signed**: Windows shows an "Unknown publisher" warning, a firm's security tools (AppLocker, Defender rules and similar) may block them outright, and macOS will not open the app until someone chooses Open Anyway in System Settings. The installer build is set up for signing but has never run with a certificate, and the certificates have not been bought.

**What does it run on, and what are the minimum requirements?**
Windows 10 or 11, 64-bit, and Apple Silicon Macs (M1 or later); there is no Intel Mac build yet. Suggested minimum: 4 cores, 8 GB of memory and an SSD with 2 GB free (8 cores and 16 GB for large scanned bundles).

**How is it licensed?**
Cloak checks a signed licence file on the computer, with no server and no activation. Add it on the home screen (Licence), or have IT put one licence file on a computer for every user (`%ProgramData%\Cloak\licence.txt`; Mac `/Library/Application Support/Cloak/licence.txt`). Without a licence, or after one has ended, Cloak is an evaluation copy: everything works, but cloaked copies can be exported only from matters ticked as made-up test documents, and restoring drafts always works. Seats are shown, not counted. We have not made the licence key yet, so every copy today is an evaluation copy.

**How are updates delivered?**
By a new installer, which you install yourselves. There is no automatic update. Cloak is built on Electron 33, so security fixes to its browser engine reach you only in a new installer.

**Where does it keep data, and what does uninstalling leave behind?**
In a matter folder you choose on your own drive: the encrypted key, an encrypted cache, a log and a lock file. Cloaked copies go to an export folder you choose. Settings (the user's full name, a remembered password only if the user asks, and the licence if the user added it) are kept in the program's settings folder on that computer (Windows `%APPDATA%\cloak-desktop`; Mac `~/Library/Application Support/cloak-desktop`), and OCR language data in a `cloak-ocr-lang` folder in the temp folder. Uninstalling leaves those and never touches matter folders or exported copies. Full table: security statement, section 4; removal steps: IT guide.

**Can the matter folder be on our shared drive, OneDrive or iManage?**
On a real shared network drive, yes. Not in a synced folder that Cloak recognises: OneDrive, Google Drive or iManage Drive, found from folder names in the path, the OneDrive folders Windows reports, or the drive's label. Cloak refuses those, because the sync app would upload the key. It does not recognise other sync apps (Dropbox, Box, or iCloud, including a Mac's Documents folder when iCloud syncs it) or, on Windows, SharePoint libraries synced into a folder named after the firm, so keep matter folders out of every synced folder. Documents can be read from a synced folder, which Cloak treats as read-only. This detection has been tested on made-up paths only, not on a real iManage, OneDrive or Google Drive installation.

**What encryption does it use?**
AES-256-GCM for the key and the cache. The matter key is unlocked by a password (at least 10 characters) or a recovery code, both stretched with scrypt (about a third of a second and 128 MB of memory per guess). Any change to the encrypted contents is detected when the matter is opened (the file's plain labels, such as its date, are not checked, and an older copy of the same key file still opens). There is no back door.

**Is there an audit log?**
Yes, `log.jsonl` in the matter folder: who (full name and computer login), when and what, never a name or number from the documents. It is plain text and not tamper-proof.

**Can we set firm-wide rules?**
Not today. Each person chooses Strict or Standard for each matter and whether to tick "Remember the password on this computer"; IT cannot force Strict mode or switch off remembering, and the minimum password length (10 characters) is fixed in Cloak. IT can control who can reach matter folders and can install one licence for everyone on a computer.

**Which file types does it read, and how do we get Outlook email into it?**
`.docx`, `.pdf`, `.xlsx`, `.txt`, `.eml`, `.msg`, `.jpg`, `.png`, `.tif`, and zip archives. Old `.doc`, `.xls`, `.rtf`, PowerPoint and Outlook mailbox files (`.pst`, `.ost`) are blocked and listed. To use Outlook email, save the messages as `.eml` or `.msg` into the folder; `.msg` is not yet tested, and Outlook support inside the app is not built.

**Can two lawyers work on one matter?**
Yes, one at a time. A second lawyer opens the same matter folder with the password. A lock file shows who has it open; taking a lock over is logged.

**What third-party software is inside?**
Open-source components including Electron (the window), tesseract.js (OCR) and pdf.js (PDF reading). The full list of third-party licences, `THIRD-PARTY-NOTICES.txt`, ships with the installer, and the About screen says where it is.

**Is Lawgistics certified (ISO 27001, SOC 2)?**
No. Lawgistics does not receive or hold your documents, but we hold no security certification and do not claim one.

## For risk and compliance

**Has an advocate reviewed the research memo?**
No advocate's review has been recorded. The memo is written for review by a Malaysian advocate and solicitor, and its points have been read in extracts and summaries, not checked at the pinpoint against the full official texts. Its section 8 lists the status of each point.

**Does Cloak make us PDPA compliant?**
No product can do that, and we don't claim it. Cloak is one measure that reduces what leaves the firm. The legal questions are set out in our research memo for your adviser.

**Is cloaked text still personal data?**
Our research memo discusses this (section 6.1). In short, it concludes that cloaked text is probably still personal data in the firm's hands, because the firm holds the key, and that whether it is personal data in the AI provider's hands is an open question that no Malaysian source found answers. It suggests firms do not rely on "it is no longer personal data". Take your own advice.

**What is the double checker?**
Rules and word lists, with no AI and no network. Before every export it reads everything that would be written and runs five checks: the values the key holds, ID-number patterns again, leftover name-like words, every part of every file written (headers, footers, comments, file names and so on), and the tags. Each finding holds the export until a person hides it or marks it "It is fine", and Cloak records who decided. It has gaps, listed in the security statement (section 6).

**What if a real name goes to the AI by mistake?**
Treat it under your firm's incident procedure. Cloak's log shows who reviewed and exported the copies and when. Whether anything must be reported is a legal question; our memo covers the breach notification rules (section 6.6) for your adviser.

**What records does Cloak keep that help us show oversight?**
The log (who reviewed, approved, exported and restored, and when), the report in each export (what was read from each file, what was blocked, and who reviewed and double-checked) and a marker in each export naming the reviewer and the double-checker. They do not record what the lawyer does in the AI tool.

**What happens when a lawyer leaves the firm?**
Matter passwords are shared by the people on the matter, and the recovery code opens a matter too. Open each matter they worked on, change its password in Matter settings, and replace the recovery code there if they knew it. The old password and code stop opening the key file in the matter folder at once (its backup copy included), and a password remembered on another computer stops working too. Neither locks out someone who kept a copy of the key file: that copy still opens with the old password or code. So also remove their access to the matter folders. If they may have taken a copy and must not see what is added later, cloak the folder again as a new matter under a new password and keep the old matter folder locked away with your own access controls; drafts made under the old matter can then be restored only by opening the old matter.

**How do we delete a matter?**
Delete the matter folder (the key, cache and log) according to your retention policy, and delete the export folder and any restored drafts. If someone ticked "Remember the password on this computer", open the matter's screen on that computer and press "Forget it" first. Without the key, cloaked copies cannot be turned back into real names by Cloak. Cloak never changes or deletes the original documents.

**Can we see the code?**
The program files are installed as readable JavaScript, so your IT team can read them.

**Should we tell our insurer?**
That is for your firm. Some firms check new technology with their professional indemnity insurer.
