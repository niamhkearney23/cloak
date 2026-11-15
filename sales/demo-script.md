# Cloak: 10-minute demo script

For a managing partner, with IT or risk staff in the room if possible. **Made-up documents only, always.** The demo computer should hold no real client files at all.

## Before the demo (allow 30 minutes the day before)

1. **Use a demo computer with no client files on it.** Install Cloak from the latest installer. Windows will warn "publisher unknown" because the installer is not code-signed yet; say so if anyone sees it.
2. **Get a made-up matter.**
   - Preferred: the Cloak sample matter (in progress; use it once it ships).
   - Until then: the 20-file made-up test matter. From the `local` folder of the Cloak source, run `node test/strict-demo.js <folder>`. The made-up documents are written to `<folder>/REAL-files` (the name means "before cloaking"; every person, company, number and address in them is invented). Copy that folder to the demo computer as `Demo documents`.
   - If you write your own demo files, invent every detail and use obviously fictional names. Never base them on a real matter.
3. **Add one honest test.** Add a short made-up file note to the demo folder, for example a `.txt` file saying "spoke to bob again about the deposit, he will send the receipts" (a lowercase single first name, the kind of thing Cloak has missed before). Run Cloak on the folder once to see what your build does with it. If it is caught, show that. If it is not, use it as the honest example in step 4.
4. **Prepare an AI draft.** Export cloaked copies from a practice run. Give them to your own AI tool (cloaked, made-up text only) and ask for a short letter of demand. Save the draft as `AI draft.txt`. Then, by hand, add one tag that does not exist (for example `{{PERSON_99}}`) so the checks have something to find.
5. **Turn the network off** (Wi-Fi off or cable out) before the meeting, and leave it off for the whole demo.
6. **Close everything else:** email, chat, notifications. Set the screen to a large font.
7. Bring printed copies of `security-and-data-protection.md`, `faq.md` and `compliance-notes.md`.

## The demo

### 0:00 to 1:00: Why we are here

> "Your lawyers want to use AI tools on disputes work. The documents are full of client details, and those details shouldn't leave the firm. Cloak hides them first, on your own computer, keeps the key on your own drive, and puts the details back into the AI's draft afterwards.
>
> One thing up front: Cloak lowers the risk; it does not remove it. I'll show you where it falls short too.
>
> And notice: this laptop's network is off. Everything you're about to see runs without it."

Point to the network icon.

### 1:00 to 2:00: Set up the matter

1. Click **Cloak a folder**. Under **1. The documents**, click **Choose folder…** and pick `Demo documents`.
   > "The folder is only read. Nothing in it is ever changed."
2. Under **2. The matter**, click **Choose matter folder…** and pick a new, empty folder (outside the documents folder). Type a matter password (at least 10 characters). Under **How much to hide**, keep **Strict** (recommended). Click **Create matter**.
   > "Strict hides names and numbers and also blurs dates, amounts and other facts, so the text is harder to tie to a real dispute."
3. The **recovery code** appears. Point to **Print this page**.
   > "This code is shown once. If the password is lost, this opens the matter. If both are lost, nobody can open it, including us. There's no back door. Your originals are never touched, so you can always start again."
4. Type the client and the other parties from the made-up matter into **Who is the client?** and **Who are the other parties?**.
   > "Every form of these names is hidden everywhere, including file and folder names."
5. Tick **This matter holds made-up test documents only**.
   > "Honest point: today, export only works on matters ticked as made-up. Real-matter export opens when our second check, the double checker, is finished. It's being built now."

### 2:00 to 3:30: Cloak the folder

1. Click **Start cloaking**. Let them watch the files being read.
2. While it runs:
   > "It reads every part of every file: Word headers and footers, comments, tracked changes including deleted text, hidden Excel sheets, email attachments, file names, and scanned pages through OCR. If any part of a file can't be read, the whole file is blocked and listed. It is never half-exported."
3. When it finishes, point to the totals: files cloaked, files needing a manual check, files blocked, with reasons.

### 3:30 to 6:00: The review (the most important part)

1. **Not sure:** words that might be names, each once, with how many places and files.
   > "The tool asks rather than guesses. A person decides each one: hide it as a person, a company or something else, or mark it fine."
   Hide one. Mark one fine.
2. **Joined names:** forms the tool gave one tag ("Mr Tan", "Tan Boon Huat", "TBH").
   > "Same person, same tag, in every file. If it's actually two people, split it."
3. **Everything replaced:** pick a person. Show their other forms and the files they appear in. Click **Don't hide** and show the confirmation, then cancel.
   > "Un-hiding needs a confirmation, twice for ID numbers."
4. **Hidden facts:** show dates and amounts replaced by `{{DATE_n}}` and `{{AMOUNT_n}}`, numbered in time order.
5. **Files:** click a file, **View cloaked text**. Show tags in place of names.
6. **The honest moment.** Open your file note from preparation step 3.
   > "This is why there's a review. On a made-up matter of 22 files it had never seen, names were still visible in 13 of them after cloaking: nicknames, single names, lowercase names in file notes. We've fixed several of those since, but rules never catch everything. Your reviewer reads it; the double checker, a second independent check, is being built."
   If the note shows the name, use **Hide it in every file**.

### 6:00 to 7:00: Finish and export

1. Click **Finish review**, then **Export cloaked copies…** and choose an export folder.
   > "Before anything is written, Cloak sweeps the output for every value in the key, in any format. One hit and nothing is exported."
2. Open the export folder. Show:
   - the numbered cloaked text files;
   - `000-context-sheet.cloaked.txt` (roles, date order, which amount adds up to which, with no real values);
   - `cloak-report.json` (what was read from each file);
   - `REVIEWED-NOT-DOUBLE-CHECKED.txt` (who reviewed, and when).
   > "These files are what your lawyer gives to the AI tool of their choice. Cloak doesn't send them anywhere. The AI company sees tags, not names. It can still see what kind of dispute it is, so read its terms on keeping data and training."

### 7:00 to 8:30: Restore the AI's draft

1. Back on the home screen, click **Restore a draft**. Open the matter with its password, then **Choose a file…** and pick `AI draft.txt`.
2. Click **Choose the documents folder…** and pick `Demo documents` (this turns on the source check), then **Check and restore**.
3. Show the report:
   - tags put back;
   - the made-up `{{PERSON_99}}` flagged as not in the key;
   - the three checks: restore check, source check (every date, amount and name is found in the documents), arithmetic and timeline.
   > "The real details only come back here, on your computer. And dates come back in the language of the sentence: '3 March' in English, '3 Mac' in Malay."
4. Click **Copy** or **Save as…**.

### 8:30 to 9:30: Why IT can trust it

1. Point to the network icon again: still off.
   > "No internet needed at any point. Your IT can prove it: block Cloak in the firewall and run a matter, or watch its connections. It makes none."
2. Open `log.jsonl` in the matter folder in a text editor.
   > "Who did what, and when: created, opened, reviewed, exported, restored. Never a real name or number."
3. Mention: the key is encrypted with AES-256-GCM and never saved beside the cloaked copies or in OneDrive or Google Drive.

### 9:30 to 10:00: Close

> "So: Cloak hides client details before documents go to AI, makes a named person review them, keeps a record, and puts the details back on your own computer. It lowers the risk; it does not remove it.
>
> What's built today: cloaking, the encrypted key, the review, Strict mode and restore. Being built now: the double checker, an offline licence, signed installers, a sample matter and help screens.
>
> I'd like to propose a 30-day pilot on made-up documents your own team writes, so you can measure what it catches and what it misses. Here's our security statement, our FAQ and our research memo on the PDPA and Bar guidance, which is written for your own adviser to review. It isn't legal advice."

Hand over the papers. Offer the pilot letter (`pricing-and-pilot.md`, section 4).

## If they ask…

| Question | Where the answer is |
|---|---|
| "Is this allowed under the PDPA?" | `faq.md`, first hard question. Do not answer the legal question yourself. |
| "What if it misses a name?" | `faq.md`. Use the 13 of 22 figure and its limits. |
| "Does any data go to the AI company?" | `faq.md`. Yes, the cloaked text, sent by the lawyer, not by Cloak. |
| "What if we lose the password?" | `faq.md`. Recovery code; no back door. |
| "How fast is it?" | `faq.md`: 20-file matter inside 60 seconds; large made-up matter 623 s first time, 64 s from cache, on a 4-core test machine. |
| "Does the Bar allow it?" | Bar guidance exists and approves no product; see `compliance-notes.md`, section 5.3. |

## Never say

- "Perfect", "100%", "guaranteed", "compliant", "certified", "approved by the Bar" or "PDPA-proof".
- "The AI never sees anything": it sees the cloaked text.
- "It's anonymised": a key exists, and the shape of the dispute remains.
- Any figure without what it was measured on.
