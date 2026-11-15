# Cloak: 10-minute demo script

For a managing partner, with IT or risk staff in the room if possible. **Made-up documents only, always.** The demo computer should hold no real client files at all. Every copy of Cloak today is an evaluation copy, which exports only matters ticked as made-up test documents, so the demo cannot export a real matter in any case.

Three rules for whoever gives the demo:

1. **Never say Cloak is perfect, compliant, certified or approved.** Say: **"Cloak lowers the risk; it does not remove it."**
2. **Never give legal advice.** For legal questions, hand over the research memo (written for review by a Malaysian advocate; not legal advice) and suggest the firm takes its own advice.
3. **Never quote a figure as a guarantee.** Give the figure, what it was measured on, and its limits.

## Before the demo (allow 30 minutes the day before)

1. **Use a demo computer with no client files on it.** Install Cloak from the latest installer. Windows will warn "Unknown publisher" (and a Mac will ask for Open Anyway in System Settings) because the installer is not code-signed yet; say so if anyone sees it.
2. **Get a made-up matter.**
   - Preferred: the built-in sample matter. On the home screen, click **Try a sample matter** (Home, then Try a sample matter), choose a place and type a password twice. It makes ten made-up documents about a home renovation dispute, set up as a Strict test matter with the client and the other parties filled in. Its own screens replace steps 1 to 5 of "1:00 to 2:00" below, and its recovery code screen has no Print button.
   - Or: the 20-file made-up test matter. From the `local` folder of the Cloak source, run `node test/strict-demo.js <folder>`. The made-up documents are written to `<folder>/REAL-files` (the name means "before cloaking"; every person, company, number and address in them is invented). Copy that folder to the demo computer as `Demo documents`.
   - If you write your own demo files, invent every detail and use obviously fictional names. Never base them on a real matter.
3. **Add one more test.** Add a short made-up file note to the demo folder (for the sample matter, its `Documents` folder), for example a `.txt` file saying "spoke to bob again about the deposit, he will send the receipts" (a lowercase single first name, the kind of thing Cloak has missed before). Run Cloak on the folder once to see what your build does with it. If it is caught, show that. If it is not, use it as the example of a miss in "3:30 to 6:00".
4. **Prepare an AI draft.** Export cloaked copies from a practice run. Give them to your own AI tool (cloaked, made-up text only) and ask for a short letter of demand. Save the draft as `AI draft.txt`. Then, by hand, add one tag that does not exist (for example `{{PERSON_99}}`) so the checks have something to find. You will say in the demo that you added it.
5. **Turn the network off** (Wi-Fi off or cable out) before the meeting, and leave it off for the whole demo.
6. **Close everything else:** email, chat, notifications. Set the screen to a large font.
7. Bring printed copies of the security and data protection statement, the questions and answers, and the research memo.

## The demo

### 0:00 to 1:00: Why we are here

> "Your lawyers want to use AI tools on disputes work. The documents are full of client details, and those details shouldn't leave the firm. Cloak hides them first, on your own computer, keeps the key on your own drive, and puts the details back into the AI's draft afterwards.
>
> One thing up front: Cloak lowers the risk; it does not remove it. I'll show you where it falls short too.
>
> And notice: this laptop's network is off. Everything you're about to see runs without it."

Point to the network icon.

### 1:00 to 2:00: Set up the matter

**With the sample matter:** click **Try a sample matter** on the home screen, accept the place offered (or choose another; a OneDrive, Google Drive or iManage Drive folder is refused) and type a password of at least 10 characters twice.

1. The matter is created as a **Strict** test matter. The **recovery code** appears.
   > "This code is shown once. If the password is lost, this opens the matter. If both are lost, nobody can open it, including us. There's no back door. Your originals are never touched, so you can cloak them again under a new key, but drafts made with the old tags can't be restored automatically."
2. The setup screen opens already filled in: the documents, the matter, the client and the other parties, and the test-matter tick.
   > "Strict hides names and numbers and also blurs dates, amounts and other facts, so the text is harder to tie to a real dispute. Every form you type for the client and the other parties is hidden throughout the folder, including file and folder names, so type each way a name is written. One exception: a one-word form that is also an ordinary word, like Grace, is hidden only where it reads as a name, so check those on the review screen."
3. Point to the ticked box **This matter holds made-up test documents only**.
   > "Today every copy is an evaluation copy: it exports only matters ticked as made-up. A real matter needs a licence from us, and the double check must pass as well. We haven't made the licence key yet."

**With the 20-file test matter instead:**

1. Click **Cloak a folder**. Under **1. The documents**, click **Choose folder…** and pick `Demo documents`.
   > "The folder is only read. Nothing in it is ever changed."
2. Under **2. The matter**, click **Choose matter folder…** and pick a new, empty folder (outside the documents folder). Type a matter password (at least 10 characters). Under **How much to hide**, keep **Strict** (recommended). Click **Create matter**.
3. The **recovery code** appears. Point to **Print this page** and say the same as above.
4. Type the client and the other parties from the made-up matter into **Who is the client?** and **Who are the other parties?** and say the same as above about the forms typed.
5. Tick **This matter holds made-up test documents only** and say the same as above about evaluation copies.

### 2:00 to 3:30: Cloak the folder

1. Click **Start cloaking**. Let them watch the files being read.
2. While it runs:
   > "It reads the text in every part of the files it supports: Word headers and footers, comments, tracked changes including deleted text, hidden Excel sheets, email attachments, file names, and scanned pages through OCR. If a part it should read can't be read, the whole file is blocked and listed. A few things are never read and don't block the file. They are simply left out of the cloaked copy: for example email routing headers, the name in a PDF's digital signature, PDF scripts, barcodes and QR codes, drawn stamps, a signature or a few handwritten words on a typed page, and small text in pictures that OCR misses."
3. When it finishes, point to the totals: files cloaked, files needing a manual check, files blocked, with reasons. On the sample matter, one file (a chat with a line in Chinese) needs a manual check.

### 3:30 to 6:00: The review (the most important part)

1. **Not sure:** words that might be names, each once, with how many places and files.
   > "The tool asks rather than guesses. A person decides each one: hide it as a person, a company or something else, or mark it fine."
   Hide one. Mark one fine.
2. **Joined names:** forms the tool gave one tag ("Mr Tan", "Tan Boon Huat", "TBH").
   > "Same person, same tag, in every file. If it's actually two people, split it."
3. **Everything replaced:** pick a person. Show their other forms and the files they appear in. Click **Don't hide** and show the confirmation, then cancel.
   > "Un-hiding needs a confirmation, twice for ID numbers."
4. **Hidden facts:** show dates replaced by `{{DATE_n}}`, numbered in time order, and amounts replaced by `{{AMOUNT_n}}`.
5. **Files:** click a file, **View cloaked text**. Show tags in place of names.
6. **Where it falls short.** Open your file note from preparation step 3. Say first: "This matter was written by our team, so it shows Cloak at its best. The fairer figures are these."
   > "This is why there's a review. On a made-up matter of 22 files, written outside the team that wrote the rules, names were still visible in 13 of them after cloaking (run once on 12 November 2026, an earlier version, counted by hand). We then rewrote the name rules and measured them on a separate made-up matter of 15 files that our own team wrote: 59 of 278 name places were missed silently before, 6 after: a nickname used on its own, and lowercase names in informal notes. One more name was only partly hidden. Our team knew what kinds of names it held, so real documents will do worse, and rules never catch everything. Your reviewer reads it, and the double checker looks again before export, but it uses rules too."
   If the note shows the name, use **Hide it in every file**.

### 6:00 to 7:00: Finish and export

1. Click **Finish review**, then **Run the double check**. Show the **Double check** tab: each finding shows the words found and where, with **Hide it** and **It is fine**. If the practice run produced no findings, say so. Then click **Export cloaked copies…** and choose an export folder.
   > "Before anything is written, the double checker reads everything the export would write. It looks again for what the key holds, for ID-number patterns and for words that still look like names. It works by rules, so it has gaps: two-letter names like Ng are not looked for on their own, and dates and amounts are found only in formats it knows. Any hit stops the export until a person hides it or marks it fine, and Cloak records who decided."
2. Open the export folder. Show:
   - the numbered cloaked text files;
   - `000-context-sheet.cloaked.txt` (roles, including people's job titles where it reads them, date order, which amount adds up to which; no names, real dates or real amounts);
   - `cloak-report.json` (what was read from each file);
   - `REVIEWED-AND-DOUBLE-CHECKED.txt` (who reviewed and who double-checked, and when).
   > "These cloaked files are what your lawyer gives to the AI tool of their choice, not the report or the marker file, which carry staff names. Cloak doesn't send anything anywhere. The AI company sees tags in place of the names Cloak hid. A name that Cloak, the double check and your reviewer all miss goes to it as written. It can still see what kind of dispute it is, so read its terms on keeping data and training."

### 7:00 to 8:30: Restore the AI's draft

1. Back on the home screen, click **Restore a draft**. Open the matter with its password, then **Choose a file…** and pick `AI draft.txt`.
2. Click **Choose the documents folder…** and pick `Demo documents` (this turns on the source check), then **Check and restore**.
3. Show the report:
   - tags put back;
   - the made-up `{{PERSON_99}}` flagged as not in the key;
   - the three checks: restore check, source check (dates, amounts, references and places that are not in the documents are flagged, and names Cloak recognises get a warning; it runs only because you chose the documents folder), arithmetic and timeline.
   > "I added this tag by hand to show the check."
   > "The real details only come back here, on your computer. And dates come back in the language of the sentence: '3 March' in English, '3 Mac' in Malay."
4. Click **Copy** or **Save as…**.

### 8:30 to 9:30: Why IT can trust it

1. Point to the network icon again: still off.
   > "No internet needed at any point. Your IT can prove it: block Cloak in the firewall and run a matter, or watch its connections. It makes none."
2. Open `log.jsonl` in the matter folder in a text editor.
   > "Who did what, and when: created, opened, reviewed, exported, restored. It names your staff who did each step, never a client's name or a number from the documents."
3. Mention: the key is encrypted with AES-256-GCM, never saved beside the cloaked copies, and Cloak refuses to save it in a folder it recognises as OneDrive, Google Drive or iManage Drive (so far tested on made-up folder paths only). Offer the IT deployment guide and the offline note.

### 9:30 to 10:00: Close

> "So: Cloak hides client details before documents go to AI, makes a named person review them, keeps a record, and puts the details back on your own computer. It lowers the risk; it does not remove it.
>
> What's built today: cloaking, the encrypted key, the review, the double checker, Strict mode, restore, a sample matter, help screens and an offline licence. The installers are ready to be code-signed once we buy the certificates; until then Windows shows 'Unknown publisher'. Not built yet: a local connector for AI tools, email support inside the app, and screens to change a matter password or replace a recovery code. Exporting a real matter needs a licence from us, and we haven't made the licence key yet.
>
> I'd like to propose a 30-day pilot, starting on made-up documents your own team writes, so you can measure what it catches and what it misses. Here's our security statement, our FAQ and our research memo on the PDPA and Bar guidance, which is written for your own adviser to review. It isn't legal advice."

Hand over the papers. Offer the pilot letter (pricing and pilot document, section 4).

## If they ask…

| Question | Where the answer is |
|---|---|
| "Is this allowed under the PDPA?" | The questions and answers, first question. Do not answer the legal question yourself. |
| "What if it misses a name?" | The questions and answers. Give both measured results and their limits (22-file matter, 13 files; 15-file matter, 59 to 6 of 278 name places). |
| "Does any data go to the AI company?" | The questions and answers. Yes, the cloaked text, sent by the lawyer, not by Cloak. |
| "What if we lose the password?" | The questions and answers. Recovery code; no back door. |
| "How fast is it?" | The questions and answers: our own 20-file matter inside 60 seconds; a 300-page scanned bundle about 9 minutes, on one 4-core test machine. |
| "Does the Bar allow it?" | Bar guidance exists and approves no product; its Circular No 242/2025 discourages client-specific facts in any generative AI tool. See the research memo, sections 5.3 and 6.9. |

## Never say

- "Perfect", "100%", "guaranteed", "compliant", "certified", "approved by the Bar" or "PDPA-proof".
- Anything that gives legal advice, or that says Cloak makes a firm's use of AI consistent with Bar guidance.
- "The AI never sees anything": it sees the cloaked text.
- "It's anonymised": a key exists, and the shape of the dispute remains.
- Any figure without what it was measured on.
