# The double checker (feature 4)

The double checker is a second, separate check of everything that is about to
be exported. It runs after the review is finished and before anything is
written. It is the safety net for what the first pass missed.

It uses rules and word lists. **No AI is used.** The optional warning from a
local AI model, mentioned in the owner's plan, is not built.

## When it runs

- From the **Run the double check** button in the review screen's finish bar,
  once the review is finished.
- **Every time someone exports.** Export runs it again on exactly what is about
  to be written. If anything is left to decide, nothing is written, and the
  Double check tab opens.

## What it reads

Every file that the export would write, as it would be written:

- each cloaked copy, including its first line (`File: …`, the file name);
- the context sheet (`000-context-sheet.cloaked.txt`, Strict matters);
- the confirmed chronology (`000-chronology.cloaked.txt`);
- the names the exported files will have;
- `cloak-report.json`;
- the marker file (`REVIEWED-AND-DOUBLE-CHECKED.txt`).

It checks what would be written, not the original documents. Anything the
first pass could not read (small text inside pictures, signatures, barcodes)
is not in the copies, so the double check cannot see it either.

## The five checks

1. **Key sweep.** Every value the matter's key holds must not appear outside a
   tag: names and all their forms, ID numbers, addresses, emails, phones, and
   the folder names of a synced source (PATH). Every blurred fact (date,
   amount, reference, place, project, job title, court) is looked for by
   meaning, in **any format**: `RM4,317,250` is found when the key holds
   `RM 4,317,250.00`, and `03.03.2023` when it holds `3 March 2023`.
   - Names of four letters or more are found in any letter case (`ahmad` for
     `Ahmad`).
   - Three-letter short forms (`Ong`, `Lim`, `Tan`) are found when written
     with a capital, or in lower case as part of a user name (`ong.kc`).
     Three-letter values that are ordinary words are not swept.
   - A key value that is an ordinary word (on Cloak's common-word lists)
     counts only when written the way the key has it, and not at the start of
     a sentence. A single word that is not in the name lists (say "Cabinets",
     taken for a name by mistake) is listed as a **possible name** when it is
     written with other capitals.
   - Honours on their own (Dato', Sri, Tengku, Raja, Syed, Sharifah...) are not
     swept. "Tan" and "Toh" are swept as surnames, except in "Tan Sri" and
     "Toh Puan".
2. **Pattern sweep.** The identifier patterns are run again, afresh: MyKad and
   NRIC numbers, passports, phones, emails, bank and card numbers, case
   numbers, land titles, vehicle plates, postcode and town, company numbers,
   tax numbers, labelled ID numbers. Dates, amounts and legal provisions
   ("Order 14", "Seksyen 74") are not identifiers, as in the first pass.
3. **Leftover names.** An independent look for anything that still looks like
   a name:
   - words after a title: Encik, Puan, Cik, Tuan, Mr, Mrs, Ms, Dr, Dato',
     Datuk, Datin, Tan Sri, Puan Sri, Madam, Haji, Cikgu, Ustaz and more, and
     the first pass's informal titles (Kak, Abang, Pak, Mak, Uncle, Aunty,
     Adik, Ibu, Bu, Ah...). As in the first pass, an informal title stays in
     the text ("Ah {{PERSON_2}}" is fine), it starts a name but is not inside
     one ("Tan Ah Kow" is one name), and a birth-order word after it belongs to
     the title ("Pak Ngah");
   - names with bin, binti, a/l, a/p, s/o, d/o, anak, and half a name next to a
     tag (`{{PERSON_1}} bin Ismail`);
   - words in Cloak's name lists (Malay, Chinese, Indian and English names),
     including a name alone at the start of a sentence or in capitals, which
     the review's "not sure" list does not ask about;
   - in the copies, capitalised words that are not ordinary words and that no
     one has marked as fine.
4. **Hidden places.** Every part of every file is checked, and each finding
   says which part it is in: the file name, the body, a header, a footer,
   footnotes, comments, tracked changes, document properties, a sheet name,
   defined names, email headers, the name of an attachment, the report's entry
   for a file. Tests plant a missed value in each of these places.
5. **Tags.** Every tag must be well formed (`{{TYPE_1}}` or `{{TYPE_1.ENDING}}`)
   and in the matter's key. Damaged tags (`{{person_1}}`, `{{PERSON_1`, a tag
   name without braces) are found. One real value must never sit under two
   different tags (for names, ID numbers and other values; facts and honours
   are left out, because the same figure can be two facts and many people are
   Dato' Sri).

## What a person sees

The Double check tab shows:

- the findings first, each with the words found (the real value, shown on this
  screen only), what kind of finding it is, and every place: file, part, line
  and a short excerpt;
- then each file with **Passed** or **Failed** and how many findings it has.

For each finding there are two buttons:

- **Hide it.** The words are hidden the way the review screen's "add" does it
  (as a person, a company or something else for a possible name; as a number
  of its own kind; as another form of the same fact; for a value the key
  already holds but that still shows, its exact text is hidden under its tag).
  Every file is cloaked again and checked again.
- **It is fine.** After a deliberate yes, the decision is kept in the
  encrypted matter with who made it (full name and computer login) and when.
  It covers the places the person saw. If the same words turn up in a new place
  later, they are asked about again.

Hiding cannot change the names of the people who reviewed and checked, or the
firm named on the licence, which Cloak writes in the report, or the context
sheet and the list of file names, which Cloak writes from tags and numbers.
Those can only be marked as fine. (If the firm on the licence is also a party
in the documents, its name in the report is a finding to mark as fine, even
when the licence has only one word of that party's name.)

If hiding something gives the review something new to decide (a name joined to
another person, say), the review must be finished again, and the double check
starts again.

## What is recorded

- **The encrypted matter key:** each "It is fine" with who and when, and how
  many findings were hidden.
- **The log (`log.jsonl`):** counts only, never a value: each run, each
  decision (which kind of check, how many places), each refused export.
- **`cloak-report.json`:** "Reviewed by … on …. Double-checked by … on …", how
  many files were checked, what was found, how many were marked fine by a
  person, how many were hidden during the double check, who marked findings as
  fine, that no AI was used, and whether the matter was ticked as made-up test
  documents.
- **The marker file** is now `REVIEWED-AND-DOUBLE-CHECKED.txt`, with the same
  statement and counts. (It was `REVIEWED-NOT-DOUBLE-CHECKED.txt`.)

## The export gate

The double check no longer cares whether a matter is made-up: once it has
passed (every file passes, or every finding was decided by a person), the
export may go ahead for any matter. The "made-up test documents only" tick is
kept and recorded in the report.

The licence is a separate condition, checked as well as the double check, not
instead of it (see `licence.md`): with no licence, Cloak is an evaluation copy
and exports test matters only (`EVALUATION_TEST_MATTERS_ONLY`). So a real
matter needs both a licence and a passed double check.

**Any later change to the review** (an added term, a "Don't hide", a merge, a
chronology edit, a new file) takes the review sign-off away. When the review is
finished again, the double check starts again, and its earlier decisions no
longer apply.

## What it will miss

It is a second look with rules and word lists, not a different kind of reader.
It is not perfect.

- **The same blind spots as the first pass, where it uses the same lists.** A
  name with no title, no bin/binti, not in the name lists and not capitalised
  (a nickname in a chat message, say) is missed by both. Names in Chinese,
  Tamil or Jawi script are not read for names; those files need the manual
  check on the review screen.
- **Decisions people made are respected.** Words a reviewer marked "It's fine"
  on the review screen are not raised again by the name look, and values a
  reviewer chose to stop hiding ("Don't hide", confirmed twice for numbers) are
  not raised by any check. If the reviewer was wrong, the double check does not
  overrule them. (The key sweep still looks for every value the key holds.)
- **Two-letter surnames** (Ng, Ho, Oh) are not swept on their own; a title
  before them ("Mr Ng") is caught.
- **Ordinary words** taken for names count only when written as in the key.
  A real name that is also an ordinary word (Rose, May, Grace) in lower case is
  taken to be the ordinary word.
- **Places and public bodies:** a name word after Jalan, Masjid, Sekolah,
  Hospital, Universiti and similar, or before Town, Road, Hall and similar, is
  taken to be part of a place, not a person.
- **The reviewer's own name in the report:** a one-word form shared with a
  party ("Siti", "Tan") is not counted, because many people share these. A
  full name the key holds is. (The licensee line is not treated this way: one
  word counts there.)
- **Amounts in a spreadsheet** are found only in a column whose header says it
  is an amount, as in the first pass. Amounts and dates written in words are
  not found.
- **"It is fine" is a person's statement.** Cloak cannot tell whether it is
  right.
- **Not tested** on real client documents (never used), on large real matters,
  or with the 300-page speed matter. On made-up text it checks 20,000 lines
  against 3,000 key values in about a second.
- **After export** the written files are not read back from disk; the check is
  on the text in memory, which is exactly what is written.

## Where it is

- `doublecheck.js`: the five checks (`inspect`, `verdict`, `doubleCheck`), and
  `keySweep`, the key sweep on its own.
- `matter.js`, the double checker section: `doubleCheck()`, `decideFinding()`,
  `checkExport()`, and the gate in `export()`.
- `app/app.js`: the finish bar and the Double check tab. `app/main.js`:
  `doubleCheck`, `doubleCheckView`, `decideFinding`.
- Tests: `test/doublecheck.test.js`, and the window test `test/app.test.js`.
