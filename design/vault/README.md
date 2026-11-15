# Cloak by Lawgistics · "Vault"

A design direction for the Cloak desktop app. Static HTML and one stylesheet. Nothing here is wired to the engine yet; every name, firm, amount, number and document in it is made up (the NRIC number uses an impossible date, 13/99, on purpose).

## The idea in five lines

1. Trust made visible: every screen answers four questions at a glance. What is hidden? What needs my decision? What is blocked? What will leave this computer?
2. A hidden value is a redaction bar that still shows its label. It is the one solid block in the interface, so `{{PERSON_1}}` reads as "hidden" before it is read as text.
3. Colour is never decoration. Amber means *needs your decision*, red means *blocked*, green means *checked*, blue means *will leave this computer* (and nothing else). Everything else is ink on "vault steel", a grey with the faintest green in it.
4. The step rail (Read, Review, Double check, Export) runs down the left. A dashed blue line sits before Export: above it, everything stays on this computer. The same dashed line reappears wherever something is about to leave.
5. Every decision is signed with a name and a time, and the finish bar at the foot of each screen is the door: it says what still blocks it and, once open, exactly what goes out.

## What is here

| File | Screen | Shots in `shots/` |
|---|---|---|
| `home.html` | Home: Cloak a folder, Restore a draft, Try a sample matter, How Cloak works / Your data / About / Licence, signed-in name, "Licensed to" in the top bar, and what stays and what leaves | `home-light.png`, `home-dark.png` |
| `setup.html` | Cloak a folder: 1 documents (read only, iManage Drive note), 2 matter (create: name, Strict or Standard, password twice), 3 people (client, other parties, made-up tick), Start | `setup-light.png`, `setup-dark.png`, `setup-full.png` |
| `review.html` | Review, Not sure tab, add-a-word bar, tabs with to-do counts, finish bar with blockers | `review-light.png`, `review-dark.png`, `review-full.png`, `review-narrow-light.png` (860 x 600) |
| `dialog.html` | Review, Everything replaced tab, with "Stop hiding this?" open (question 1 of 2, an NRIC number) | `dialog-light.png`, `dialog-dark.png` |
| `doublecheck.html` | Double check: pass or fail per file, each finding with part, line and excerpt, Hide it / It is fine, decided findings signed with who and when, export locked | `doublecheck-light.png`, `doublecheck-dark.png`, `doublecheck-full.png` |
| `chronology.html` | Chronology tab: missing-files warning, Date / What happened / People / Source, chips (same event, possible conflict, no year, date not understood, range), two rows ticked to merge, Add a row, Edit, Delete, rows with no date behind a count, Confirm card | `chronology-light.png`, `chronology-dark.png`, `chronology-full.png` |
| `restore.html` | Restore a draft with a result: Warnings (on a Passed / Warnings / Failed scale), the three counts, three checks with issues by paragraph, the restored draft with Copy and Save as | `restore-light.png`, `restore-dark.png`, `restore-full.png`, `restore-narrow-dark.png` (860 x 600) |
| `setup-open.html` | Extra: the setup screen when the folder already holds a matter (password, remember it, recovery code), source in OneDrive | `setup-open-light.png`, `setup-open-dark.png`, `setup-open-full.png` |
| `progress.html` | Extra: cloaking progress, a row per file with OCR chip and spinner, "128 of 214 files read" | `progress-light.png`, `progress-dark.png`, `progress-full.png` |
| `recovery.html` | Extra: the recovery code, shown once, Print, the tick, Continue | `recovery-light.png`, `recovery-dark.png` |
| `export.html` | Extra, a proposal: the Export step with the door open. What leaves (chronology only, recommended, or all files) and what stays (key, originals, cache and log, held-back files), side by side | `export-light.png`, `export-dark.png`, `export-full.png` |
| `style.css` | Every rule, both themes | |
| `fonts/` | Four `.woff2` files and two licences | |

All shots are 1180 x 820 at device scale 1 unless named `-narrow-` (860 x 600). `-full.png` is the whole scrolling sheet.

### Constraints met

- Each page carries the app's Content-Security-Policy with `font-src 'self'` added: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'`. No `style` attributes, no `<style>` blocks, no scripts at all. I checked that the policy is really enforced (an inline style added to a test copy was refused) and that no page logs a violation.
- Icons are one inline SVG sprite per page (`<symbol>` + `<use href="#i-…">`), drawn with `currentColor`. The mark is inline SVG. No icon font, no images.
- Light and dark follow `prefers-color-scheme`; `prefers-reduced-motion` turns off every transition and the spinner (it becomes a still ring).
- Every text element on every page, in both themes, was measured against its real background by script: all pass WCAG AA (4.5:1, or 3:1 for large text). Input edges are 3.3:1 (light) and 3.4:1 (dark). Focus is a 2px ink ring with a halo, shown on Cancel in the dialog shots.
- Real buttons, labels for every field, `role="tablist"` on tabs, `aria-current="step"` in the rail, `role="alertdialog"` and `aria-modal` on the dialog, with the page behind marked `inert`.
- No horizontal scroll at 1180 x 820 or 860 x 600 (checked by script).

## Tokens

All tokens are CSS custom properties on `:root`, redefined under `@media (prefers-color-scheme: dark)`.

### Colour

Contrast figures are against `--sheet` unless another pair is named.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--chrome` | top bar and rail | `#E7EAE6` | `#0A0E0D` |
| `--sheet` | the workspace | `#FBFBFA` | `#111615` |
| `--surface` | cards, rows, inputs | `#FFFFFF` | `#171D1B` |
| `--sunken` | wells, table heads, quiet fills | `#F2F4F1` | `#0D1211` |
| `--hover` / `--selected` | row hover / ticked row | `#EFF2EE` / `#E8EDE9` | `#1A211F` / `#1E2724` |
| `--line` / `--line-soft` | hairlines | `#DCE1DC` / `#E9ECE8` | `#252D2A` / `#1D2422` |
| `--line-strong` | button edges, empty nodes | `#B4BCB6` | `#3C4742` |
| `--control-line` | input edges (3.3:1 / 3.4:1 on surface) | `#848F89` | `#66726D` |
| `--ink` | headings, key text (17.6:1 / 16.3:1) | `#101715` | `#EEF3F0` |
| `--text` | body (13.9:1 / 13.2:1) | `#232C28` | `#D5DDD9` |
| `--text-2` | secondary (7.3:1 / 8.4:1) | `#4C5752` | `#A7B2AD` |
| `--text-3` | tertiary, never below 4.5:1 (5.4:1 / 6.3:1) | `#5F6A65` | `#8E9A95` |
| `--primary` / `--on-primary` | primary action (16.7:1 / 15.5:1) | `#15201C` / `#FFFFFF` | `#E4EBE7` / `#0D1311` |
| `--focus` | focus ring | `#101715` | `#EEF3F0` |
| `--tag-bg` / `--tag-fg` | **hidden**: the bar and its label (13.8:1 / 12.1:1) | `#17221E` / `#E6EEE9` | `#C8D3CD` / `#0D1412` |
| `--tag-brace` / `--tag-sub` | dimmed `{{ }}` (5.7:1 / 4.7:1) and the `.SURNAME` suffix | `#8A9C94` / `#B9C7C0` | `#4B5A54` / `#35433D` |
| `--decide` / `--decide-bg` | **needs a decision** (6.3:1 / 9.3:1) | `#7E4D00` / `#FBF0D9` | `#F0C26A` / `#2D2310` |
| `--decide-line` / `--decide-solid` | edges / dots and markers | `#EBCB8E` / `#B97606` | `#5E4A21` / `#E0A63C` |
| `--block` / `--block-bg` | **blocked, held back, failed** (6.4:1 / 8.1:1) | `#A0271D` / `#FBEAE7` | `#FF9D92` / `#341815` |
| `--block-line` / `--block-solid` | edges / icons and strips | `#EDBAB3` / `#C2382C` | `#6C322B` / `#E85A4C` |
| `--ok` / `--ok-bg` | **checked, passed** (6.2:1 / 9.1:1) | `#1A6439` / `#E3F1E7` | `#88D6A4` / `#11281A` |
| `--ok-line` / `--ok-solid` | edges / icons and strips | `#ABD4BA` / `#2B8650` | `#2A5B3C` / `#45AE6D` |
| `--out` / `--out-bg` | **will leave this computer** (6.6:1 / 8.8:1) | `#1D4DB0` / `#E9EFFB` | `#A4BFFF` / `#152039` |
| `--out-line` / `--out-solid` | the dashed boundary / the export button | `#B5C7EF` / `#2453C2` | `#304B86` / `#7FA0F5` |
| `--on-out` | text on the export button (6.8:1 / 7.3:1) | `#FFFFFF` | `#0A1226` |
| `--restored-bg` / `--restored-line` | a value put back into a draft | `#E9F0EB` / `#86A897` | `#19251F` / `#4F7462` |
| `--slab` | the "Cloak a folder" card on Home | `#121B18` | `#25322D` to `#1A2420` (gradient) |
| `--scrim` | behind a dialog | `rgba(14,20,18,.46)` | `rgba(0,0,0,.62)` |

### Type

Geist for everything people read; Geist Mono for anything that must be exact: tags, paths, recovery codes, line numbers and the excerpts in findings. Numbers that line up use tabular figures.

| Token | Use | Size / line | Weight | Tracking |
|---|---|---|---|---|
| `--fs-display` | Home headline (32px in short windows) | 40 / 43 | 640 | -0.035em |
| `--fs-h1` | screen title | 26 / 31 | 640 | -0.025em |
| `--fs-h2` | section and card titles | 17 / 23 | 620 | -0.012em |
| `--fs-h3` | small headings | 14.5 / 20 | 620 | 0 |
| `--fs-body` | body, buttons, table cells | 14 / 21 (13.5 in tables) | 400, 560 on buttons | 0 |
| `--fs-small` | notes, hints, meta | 12.5 / 18 | 400 | 0 |
| `--fs-micro` | column heads, rail labels, captions | 11, uppercase | 600 | +0.08em |
| `--fs-tag` | tags (Geist Mono) | 12 / 1 | 520 | +0.01em |

### Space, radii, shadows, layout

| Spacing | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-7` 32 · `--s-8` 40 · `--s-9` 48 · `--s-10` 64 (px) |
|---|---|
| Radii | `--r-xs` 3 tags · `--r-sm` 6 small controls · `--r-md` 8 buttons and inputs · `--r-lg` 12 cards, lists, the finish bar · `--r-xl` 16 dialogs and Home cards · `--r-pill` 999 chips and counts |
| `--sh-1` (rest) | light `0 1px 2px rgba(16,24,20,.05)` · dark `0 1px 2px rgba(0,0,0,.45)` |
| `--sh-2` (floating: finish bar, primary card) | light `0 1px 2px rgba(16,24,20,.06), 0 10px 28px -8px rgba(16,24,20,.16)` · dark `0 1px 2px rgba(0,0,0,.5), 0 12px 30px -8px rgba(0,0,0,.7)` |
| `--sh-3` (dialog) | light `0 2px 8px rgba(16,24,20,.08), 0 30px 70px -14px rgba(16,24,20,.36)` · dark `0 4px 14px rgba(0,0,0,.5), 0 34px 90px -12px rgba(0,0,0,.8)` |
| Layout | top bar 52px · rail 232px, 76px at 1040px wide and below · the sheet sits 8px in from the window with a 14px radius · content padding 32px (18px narrow) · the sheet scrolls, the top bar and rail do not |

## Fonts and licences

| Family | Used for | Licence | Source |
|---|---|---|---|
| Geist (variable, weight 100 to 900) | all interface text | SIL Open Font License 1.1, © 2024 The Geist Project Authors | npm `@fontsource-variable/geist` 5.3.0 |
| Geist Mono (variable, weight 100 to 900) | tags, paths, codes, excerpts | SIL Open Font License 1.1, © 2024 The Geist Project Authors | npm `@fontsource-variable/geist-mono` 5.3.0 |

Only the latin and latin-ext files are bundled (`fonts/*.woff2`, 84 KB in all), each with its `unicode-range`, plus `fonts/LICENSE-Geist-OFL.txt` and `fonts/LICENSE-GeistMono-OFL.txt`. Fallbacks, in order: Segoe UI Variable and Segoe UI (Windows, which also cover Jawi/Arabic), system-ui, then Microsoft YaHei and PingFang SC for Chinese, Nirmala UI and Tamil MN / Tamil Sangam MN for Tamil, Geeza Pro for Arabic on a Mac. The mono stack falls back to Cascadia Mono, Consolas, SF Mono and Menlo, then the same script fonts.

## How the parts are designed

### Tags: redaction bars that keep their label

```html
<span class="tag"><span class="b">{{</span>PERSON_1<span class="s">.SURNAME</span><span class="b">}}</span></span>
```

- A solid bar with 3px corners, a hairline darker bottom edge and very faint diagonal hatching, like redaction tape. It never wraps.
- The label is Geist Mono 12px at 13.8:1, so `PERSON_1` and `NRIC_1` are read exactly. The braces are dimmed and the suffix is lighter, so `{{DATE_3.B}}` reads "date 3, second form" and `{{PERSON_1.SURNAME}}` reads "person 1, surname" at a glance.
- Copying a tag copies the exact text, braces included.
- In dark mode the bar turns pale with a dark label (12.1:1): the page colour inside out, so it still reads as "covered". On the dark Home card the bars are pale too.
- `tag-lg` is the 14px version used in the dialog. In app.js the existing `tags()` function only needs to emit the three spans.
- Related marks: a value put back into a draft gets a soft tint and a 1px underline (`.restored`); a word waiting for a decision gets an amber highlight with a 2px underline (`mark.q`); a real value showing where it should not gets the red version (`mark.leak`).

### Status chips and counts

Colour, an icon shape and a word always travel together, so no state depends on colour alone.

| State | Look | Used for |
|---|---|---|
| Needs a decision | amber chip, ring-with-dot icon or a dot | Not sure, 1 to decide, possible conflict, no year, date not understood, needs a manual check |
| Blocked | red chip, slashed circle | held back, cannot be read, key value showing |
| Failed | red chip, crossed circle | a file in the double check with findings |
| Checked | green chip, check | passed, every finding decided, every tag put back |
| Will leave | blue chip or text, arrow out of a box | on export, recommended export, the boundary |
| Neutral | grey chip | OCR, range, same event A, file counts |
| Matter settings | outline chip (Strict), dashed chip (Test documents) | the rail and the matter card |

Tab counts are neutral pills; a list that must be worked through shows an amber pill with a dot, and when it is empty the count is replaced by a green check. File types are small mono badges (`PDF`, `DOCX`, `MSG`) next to the file number, so 300 files in four scripts stay scannable.

### Tables and lists

- Column heads are 11px uppercase on a sunken band; rows are separated by hairlines; numbers are tabular and right-aligned.
- Long company names wrap rather than truncate wherever the name is the information (People, Real value). Long file names truncate with an ellipsis only in the progress list, where the full name is on the Files tab.
- A ticked row (merge) gets the selected tint and an ink bar on its left edge; the row a dialog is acting on gets a red bar.
- The Not sure tab is a list of decisions, not a table: the word and where it appears on one line, the decision on the right ("Hide as Person | Company | Other" as one joined control, then "It's fine"), and the context excerpt across the full width underneath with the word highlighted.
- Large lists say so plainly: "Showing 300 of 1,284, most places first", with search beside it.
- Findings in the double check are grouped by file, with a red strip for a failed file and a green strip once every finding is decided. Each finding shows its part and line in mono on the left. A decided finding carries a signed stamp: the decision, the name, the time and Undo.

### The finish bar: the door

A floating bar fixed to the foot of the sheet on every working screen. A 4px strip on its left edge and the icon tile tell the state before a word is read.

| State | Strip and icon | Text | Action |
|---|---|---|---|
| Blocked | amber, lock | "Before you can finish", then each blocker as a link to its tab, with an amber dot | Finish review, disabled, with a lock |
| Ready | green, check | "Everything is decided" | Finish review |
| Double check open | amber, lock | "Export opens when every finding is decided", findings left per file | both export buttons, disabled; the blue one keeps a dashed blue outline so its meaning stays visible |
| Door open | blue, arrow out | "Ready to leave this computer", what exactly goes | "Export the chronology only (recommended)" in blue, "Export all files…" beside it |

On the review screens an "On export" manifest sits behind a dashed blue line, the same line as the boundary in the rail: how many files will leave, and how many are held back (in red).

### The rail

Read, Review, Double check, then the dashed blue boundary "Leaves this computer", then Export with an arrow-out node (dashed until it opens, solid blue when it does). A done step is a filled ink node with a check; the current step has a ring and a soft halo; each step has a one-line note ("214 of 214 files", "16 to decide" in amber, "Ready to finish" in green). At 1040px and below it folds to a 76px column with short labels and an amber count badge on the current node. The restore flow uses the same rail with its own steps. At the foot: "On this computer only. Nothing is sent anywhere."

### Notes, tips and the dialog

- Notes use the same four meanings: neutral for reassurance (the iManage Drive and OneDrive notes), amber for "this needs you", red for blocked, blue for leaving. First-run tips are white with a small "Tip" badge and a "Got it" button.
- "Stop hiding this?" shows the change itself: the tag, an arrow, and the real value "shown as written", then the blue note "It will leave this computer". Numbers and IDs show "Question 1 of 2". Cancel is focused by default. The page behind is dimmed, not blurred, so the row being changed stays recognisable.

## Proposals beyond today's app

These are design suggestions, not features the engine has yet: the "Real details / As it will be exported" switch on the chronology; the Export step screen with its leaves-and-stays manifest (today Export goes straight to a folder picker); the amber count badge on the compact rail; restored values marked inside the restored draft; the Passed / Warnings / Failed scale on the restore result.

## What I could not check

- The screenshots were taken with Chromium on Linux. Geist's rendering under Windows ClearType has not been seen, and the Chinese and Tamil file names in the shots use the Linux fallback fonts (WenQuanYi Zen Hei, FreeSans), not Microsoft YaHei or Nirmala UI. No Jawi text appears in the shots.
- Contrast was measured by script on every text element, not with a screen reader or by a person with low vision.
- The pages were built with a small generator script kept outside this folder; the HTML files here are the deliverable and can be edited directly.
