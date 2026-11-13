# Rules for working on Cloak

Read this at the start of every session. These are the owner's rules, in their words.

1. **Made-up test documents only.** Never read real client files.
2. **Nothing leaves the machine.** No online services of any kind.
3. **Stop after each feature and wait for me to test it.**
4. **Never tune the detector to a test set I supply.**
5. **Report misses honestly, including ones I have not asked about.**

## Open instructions (kept here so a long session cannot lose them)

Where the owner's own words are in this file or in the repository, they are quoted; where only a summary survived a context reset, it says so.

- **Order of work now (2026-11-13):** (a) the fix list on restore, cloaking, context sheet and chronology; (b) the restore-draft screen and the chronology screen in the window; (c) then wait for the owner's test results. No new features.
- **Client name:** do not special-case the folder name. Setup has "Who is the client?" and "Who are the other parties?"; every form of those names is hidden everywhere. Every company tagged also gets its short form tagged (the name without Sdn Bhd, Berhad, (M), Enterprise, Trading and similar) in text, file names and folder names. Words from folder and file names go on the "not sure" list.
- **Desktop tool** (`local/`): Electron, Windows first, one installer, one window, two buttons ("Cloak a folder", "Restore a draft"); keep tag endings (.SURNAME, .FIRST...); tags are written `{{TYPE_n}}`.
- **Features, in order:** 1 cloak a folder, 2 the key, 3 review screen, 4 double checker, 5 restore a draft, 6 local connector (MCP: list_matter_files, get_cloaked_file, get_cloaked_folder; cloaked text only; refuse unreviewed files), 7 email support inside the desktop app (Outlook read locally, no server), 8 internal check server (checks 1 to 3 first in the desktop app; check 4 is an offline AI read-through that only flags). Features 1 to 3, fact blurring (Strict), the context sheet, the chronology table and checks 1 to 3 exist. 4 to 8 are not built.
- **Completeness rule:** every part of every file read, or the file blocked; proof of reading per file; poor OCR and near-empty pages flagged; outputs rebuilt from text only; planted-name tests. Full text: the owner's message of 2026-11-12 (also in the session transcript).
- **Screenshot feedback 1 to 9** (non-Latin default action and typed confirmation; file names in the "File:" line; dates as "12 Nov 2026, 9:19 am"; full name on first run; "Don't hide" confirmation, twice for pattern rules; "Confirm all in this group"; Print button on the recovery code screen; speed matter of 300-page scan, 60-page agreement, 5,000-row sheet; unseen test documents) are built, except the speed run, which has not finished.
- **iManage, phase 1 (no API):** a synced folder (iManage Drive, OneDrive, Google Drive) is a read-only source; the matter, key, cache and cloaked output are never saved inside it; stub files are listed and asked about; the report records the source. **Phase 2 (iManage REST API sign-in): do not build until asked.**
- **Fact blurring, context sheet, chronology table, feature 8:** the owner's messages of 2026-11-12 (in the session transcript).
- **Not built, but asked for:** "Are these documents public?" question at setup; export limited to test matters until the double checker exists; free-text highlight and tag; the double checker (feature 4).
- **Website and email assistant:** nothing may leave the computer; the email assistant is paused unless `CLOAK_ASSISTANT_ENABLED=1`.

Lost in a context reset (only a summary survives): the owner's exact words for the double checker, for the later additions (one installer / list all libraries and confirm offline / key and forgotten-password explanation / miss rate split by language / folder mode of 20 to 50 files with a 60-second target / cloud-file phases), and for the three setup/export/"Don't hide" items listed under "Not built". If this file says something different from what the owner meant, the owner's words win.
