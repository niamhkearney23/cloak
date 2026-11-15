# The first run

What a new lawyer sees the first time they open Cloak, and how it is built.
The aim: someone can try Cloak in a few minutes without anyone helping.

## What the person sees

1. **Their full name** (as before). It goes next to their sign-offs and in the log.
2. **The home screen**, with a short tip saying what the two buttons are for,
   a **Try a sample matter** card, and links to **How Cloak works**, **Your
   data** and **About**. The top bar has **Home** and **Help** on every screen.
3. **Try a sample matter**: Cloak shows where it will put the sample
   (`Documents/Cloak sample matter` by default) and asks for a password
   typed twice. **Choose another place…** picks a different parent folder.
4. **The sample matter is ready**: the folder, what is in it, and the
   recovery code, with a note that a real matter's code must be kept.
5. **The normal setup screen, filled in**: documents, the open matter, the
   client and other parties, and the test-matter tick. A note says so.
6. **Cloaking and the normal review**, with a note on what to do in the sample.
7. After exporting, **Home** (it asks before closing the matter) and
   **Restore a draft** to see real details put back.

Each main screen (home, setup, review, restore) shows a short tip until the
person presses **Got it**. Closed tips are remembered in the window's own
storage (Cloak's folder on this computer). **Help → How Cloak works → Show the
first-time tips again** brings them back.

## The sample matter

Ten made-up documents about a home renovation dispute in Puchong, Selangor:
a text PDF agreement, an Excel payment schedule, a scanned receipt (picture
only, read by OCR), a WhatsApp export with one line in Chinese, an email with a
quoted reply, two Word letters with a header and footer, a Word witness
statement with a footnote, a comment and a tracked deletion, a text file
note, and a sub-folder with a PDF letter and a Word reply. Every person,
company, number and address is invented; email domains end in `.example`.

The Word and Excel files are proper Office files, so the person can open the
originals and compare them with the cloaked copies. They were checked by
opening them in LibreOffice; they have **not** been opened in Microsoft Word
or Excel.

The sample is created as a **Strict**, **test** matter, with the client and
the other parties filled in from `app/sample/sample.json`:

```
<chosen place>/Cloak sample matter/      ("... 2", "... 3" if the name is taken)
  Documents/        the ten files (only read)
  Matter key/       matter.cloakkey, cache, log.jsonl
  Cloaked copies/   empty; export here
```

A new folder is made every time; nothing that exists is written into or
removed. If something fails half-way, only the folder made a moment before is
removed. A synced place (OneDrive, Google Drive, iManage Drive) is refused with
the usual message, before anything is copied. Many firm laptops keep Documents
in OneDrive: the person then sees the refusal and chooses another place. A
password shorter than 10 characters is refused before anything is copied.
While the sample matter is open, folder choosers start in the sample folder.

### What the review shows on the sample (measured with this branch's engine)

About 5 seconds to read. 9 files cloaked, 1 needs a manual check (the
WhatsApp chat, because of the Chinese line, which holds a name in Chinese
script Cloak cannot see). 1 joined name to confirm. 11 words on **Not
sure**: 3 are real (`Azman`, a tiler named with no title; `Cempaka` and
`CEMPAKA INDAH`, the client's street), 8 are ordinary words (`Ah`, `Paid`,
`Fri`, `Sorry`, `WhatsApp`, `neighbour`, `Renovation`, `Contact Project`).
After a careful review (hide the 3, mark the rest fine, hide the Chinese
passage, approve) the export holds none of the listed real values, dates,
amounts or towns. These numbers will change when the name rules change.

The sample does not show: a blocked file, a Standard matter, or the
chronology (the person can build it from the Chronology tab).

### Rebuilding it

The content is in `test/sample-matter.js`. After changing it:

```
node test/make-sample.js     # rewrites app/sample/
```

and commit `app/sample/`. A test fails if the shipped files differ from the
script (the scanned page is drawn with the computer's fonts, so it is only
checked to be a PDF), or if a value listed as real is not in the sample.
`package.json` already packages `app/**`, so the installer carries the files.

## Help screens

**How Cloak works**: the six steps (cloak, review, double check, export, AI,
restore), Strict and Standard, and what Cloak cannot see, taken from the
README's limits. **Your data**: what is kept where, what is encrypted and what
is not (the log, the lock file, cloaked copies, restored drafts and
`profile.json` are not), the real paths on this computer, and what Cloak
cannot protect. **About**: version, support contact, where
`THIRD-PARTY-NOTICES.txt` is, the system, and **Save a support file**.

To update when other work lands:

- **Double check**: the paragraph in `helpHow()` (app/app.js) says it is not
  built yet. Change it when the double checker is merged.
- **Support contact**: `SUPPORT_CONTACT` in `support.js` is a placeholder
  (`[support contact to be added before release]`). It shows on About and
  in every support file.
- **THIRD-PARTY-NOTICES.txt**: About looks next to `Cloak.exe`, in the
  `resources` folder, and in the app folder. Until the installer carries the
  file, About says "That file is not in this copy of Cloak".

## Support file

**Help → About → Save a support file…** asks where to save, then writes a zip:

- `README.txt`: what it is, that Cloak did not send it, what is and is not in it, the self-test.
- `support-info.json`: Cloak version, operating system, processor and memory,
  time zone, the self-test, and counts about the open matter (id, level,
  test matter or not, number of files and tags). No matter name, no paths.
- `matter-log.jsonl`: the open matter's log, if a matter is open.

Self-test: the OCR engine reads a picture of known words made in memory, and
the open matter's key (and its backup) is opened with the matter's own key.
Error text from the self-test has file paths removed.

Second guard: every value in the open matter's key (names, numbers,
addresses, dates, amounts, non-Latin passages) is looked for in the whole
zip, whole words and any letter case, and replaced by its tag. The README
says how many were replaced; it should always be 0. Not looked for: values
under 3 characters, honours, and numbers of fewer than 6 digits with no
letters (they would blank out the log's own times and counts).

What it does contain that is personal: the log names the people who worked on
the matter in Cloak (full name and computer login). The README says so.

Cloak never sends the file. There is no network code in it; it is written
only to the place the person chose.

## Plain-language errors

Messages in `app/main.js`, `matter.js` and `app/app.js` now say what happened
and what to do next. Error codes, meanings and every phrase a test matches
are unchanged, so no test needed new wording. Wrong passwords and recovery
codes, and a failed key sweep, get their next step in the window, keyed by
the error code (`NEXT_STEP` in app.js). A draft file that cannot be read now
says so; before, the box was left empty without a word.

Not changed: messages inside `export()` in matter.js (the double checker is
changing that function), and messages from `keyfile.js`, `source.js`,
`review.js`, `chronology.js` and `extract.js`, which were outside this work.

## Tests

- `test/firstrun.test.js`: the shipped sample matches its script; a sample
  matter is made in a new folder as a test matter with its parties; synced
  places and short passwords are refused before anything is copied; the
  support file after a whole run (cloak, review, export, restore) holds the
  version, system, self-test and log and **no real value from the sample
  matter**, and needed no replacements; a real value planted in the log is
  replaced by its tag.
- `test/app.test.js`, second test: tips (and that a closed one stays
  closed), help from the bar and the home screen, the sample from the home
  screen through review and export (no real value in the copies), a support
  file (no real value, no paths), Home, a wrong password message, and
  restoring a draft. `CLOAK_TEST_DOCUMENTS` sets the Documents folder for tests.

## Problems found while making the sample (not fixed here)

- **A false name can block every export.** "thank you Puan. Cabinets done"
  made `Cabinets` a person: the title rule reached across the full stop.
  Cloaking only replaces `Cabinets` with a capital, but the key sweep before
  export matches any letter case, so the ordinary word "cabinets" elsewhere
  stopped the export, and the message does not say which word. The sample was
  reworded to avoid it; real documents will still hit it. The window now
  tells the person how to find and fix it, but the rule itself needs fixing
  (name rules or the sweep).
- On the scanned receipt, OCR joined two lines and the address rule took
  "3/2, Taman Cempaka Indah Paid" as the address, so "No. 18, Jalan Cempaka"
  was left showing until the reviewer hid `Cempaka` from the Not sure list.
- A street name in a capitalised heading, and a one-word name with no
  title, are not hidden automatically (both go on Not sure).
- Over-hiding: a company (`Bina Kukuh Services`) hidden as a person, a
  spreadsheet amount (`45000`) as a postcode, comment initials (`FA`) as a person.
- The README's "What it will miss" says email attachments are not opened.
  They are (the completeness section says so too); the line is out of date.
