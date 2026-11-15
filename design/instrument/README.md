# Cloak · Instrument

A design direction for the Cloak desktop app. Design only: nothing here is wired to the app yet.

## The idea in five lines

1. Cloak is a precision instrument: neutral cool greys, one signal colour (ultramarine), and a strict grammar of 1px lines. Nothing decorates; everything measures.
2. A hidden value is always a black redaction bar with its code printed on it, so `{{PERSON_1}}` reads as "hidden" before it is read as text. The mark is the same idea: a bar between two brackets.
3. A matter is a signal path. The left rail shows the steps (done, current, not yet) and every file with a status light whose shape, not only its colour, says what happened.
4. Every screen ends in one decision. The finish bar names what still blocks it, links to each blocker, and carries the next action with its keyboard keys.
5. Counts, dates, paths and tags are set in mono like instrument readouts, so 1,284 terms and 214 files feel exact rather than overwhelming.

## Files

| File | Screen |
|---|---|
| `home.html` | Home: the two actions, a before/after sentence, the sample matter, Help, Your data, About, Licence, "Licensed to" in the top bar |
| `setup.html` | Cloak a folder: documents (iManage Drive note), creating a matter (Strict/Standard, password twice), the people, test-matter tick |
| `progress.html` | Reading the documents (extra, not asked for): count, bar, a row per file with OCR chip and spinner |
| `recovery.html` | The recovery code, shown once, with Print and the "I have written it down" tick (extra) |
| `review.html` | Review, Not sure tab, finish bar with blockers |
| `dialog.html` | Review, Everything replaced tab, with "Stop hiding this?" open (step 1 of 2) |
| `doublecheck.html` | Double check: per-file pass or fail, findings with part, line and excerpt, Hide it / It is fine with who and when |
| `chronology.html` | Chronology tab: missing-files warning, table with chips, two rows ticked to merge, hidden undated rows, Confirm card |
| `restore.html` | Restore a draft with a result: verdict, counts, three checks by paragraph, the restored text |
| `style.css` | Every style, both themes |
| `fonts/` | Four `.woff2` files and the two licences |
| `shots/` | Screenshots: `<screen>-light.png`, `<screen>-dark.png` at 1180x820, `<screen>-full.png` where the page scrolls, `review-narrow-light.png` and `restore-narrow-dark.png` at 860x600 |

Every page carries the app's CSP (plus `font-src 'self'`): no inline style attributes, no `<style>` blocks, no scripts, no network. The screenshots were taken with the CSP in force and no violation was reported. Icons are one inline SVG sprite per page (`<symbol>` + `<use>`); the mark is inline SVG.

## Tokens

All tokens are custom properties on `:root`; dark values sit under `@media (prefers-color-scheme: dark)`.

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | `#F3F4F6` | `#0B0D10` | top bar, rail, status bar |
| `--surface` | `#FFFFFF` | `#111418` | the work area |
| `--sunken` | `#F7F8FA` | `#0E1114` | wells, quiet panels, dialog foot |
| `--raised` | `#FFFFFF` | `#171B20` | dialogs |
| `--field` | `#FFFFFF` | `#0D1013` | text inputs |
| `--hover` / `--press` | `#F0F2F5` / `#E7EAEE` | `#181C21` / `#1F242A` | pointer states |
| `--line` | `#E4E7EC` | `#22272E` | structure hairline |
| `--line-2` | `#D4D9E0` | `#2E343C` | button outline, table-head rule |
| `--dash` | `#C2C8D1` | `#3C434D` | dashed "cut" lines |
| `--control` | `#838C9A` | `#646D79` | input and checkbox edge (3:1 or more) |
| `--text` | `#12151A` | `#E8EBEF` | primary text |
| `--text-2` | `#48505C` | `#B0B7C1` | secondary text |
| `--text-3` | `#666E7B` | `#8C94A0` | meta, labels (4.5:1 or more on every surface) |
| `--text-4` | `#8A93A1` | `#5E6672` | disabled and decoration only |
| `--ink` / `--on-ink` | `#0F1217` / `#F4F6F9` | `#E8EBEF` / `#0B0D10` | primary buttons (inverted in dark) |
| `--accent` | `#3446D1` | `#94A2FF` | focus ring, current step, selection, links |
| `--selected` | `#F1F3FE` | `#151A2E` | selected and cursor rows |
| `--tag-bg` / `--tag-fg` | `#0B0D11` / `#EEF1F5` | `#000000` / `#E8EBEF` | the redaction bar |
| `--tag-brace` | `#7F8896` | `#6F7884` | braces and endings on the bar |
| `--tag-edge` | `#0B0D11` | `#353C46` | hairline round the bar in dark |
| `--ok` / `--ok-bg` / `--ok-led` | `#126B43` / `#E9F5EF` / `#1E9A5E` | `#62D29B` / `#10241A` / `#3DBF7F` | passed, cloaked |
| `--warn` / `--warn-bg` / `--warn-led` | `#855000` / `#FFF4DC` / `#C27D00` | `#F2B648` / `#261E10` / `#E9A21F` | to do, needs a check |
| `--bad` / `--bad-bg` / `--bad-led` | `#AE2418` / `#FCEDEB` / `#D7382A` | `#FF8F84` / `#2B1615` / `#F0574A` | failed, blocked |
| `--info` / `--info-bg` | `#2F41C2` / `#EEF0FD` | `#A3AEFF` / `#161A32` | OCR, same event, synced-folder note |
| `--found` | `#FFE9B8` | `#4A3712` | the word being asked about, in its sentence |
| `--leak` | `#FDDCD7` | `#4D1F1B` | a detail the double check found |
| `--restored` | `#E3F2EA` | `#143223` | a real value put back into a draft |
| `--danger-fill` | `#D7382A` | `#C2372B` | the second "Yes, show it" |
| `--scrim` | `rgba(14,17,22,.44)` | `rgba(0,0,0,.62)` | behind dialogs |

Each status also has a `-line` (border) value; the home's primary action has its own `--act-*` set. Every text pair above was checked against WCAG AA (4.5:1 for text, 3:1 for control edges and status lights).

### Type

Instrument Sans for the interface, JetBrains Mono for tags, counts, dates, paths, file numbers and keycaps.

| Token | Size | Use |
|---|---|---|
| `--fs-11` | 11px | overlines (uppercase, +0.09em), table heads, keycaps |
| `--fs-12` | 12px | meta, chips, rail |
| `--fs-13` | 13px | tables, secondary copy, buttons |
| `--fs-14` | 14px | body (line height 1.45) |
| `--fs-16` | 16px | section and result titles |
| `--fs-22` | 22px | page titles (600, -0.02em) |
| `--fs-32` | 32px | the home headline only (600, -0.03em) |

Weights 400, 550 (buttons, tabs), 600 (titles). File names in the rail use width 94% from the variable width axis to fit more of a long name. Readout numbers are mono 22-28px.

### Space, radius, shadow

| Spacing | `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6` 24 · `--s-8` 32 · `--s-10` 40 · `--s-12` 48 · `--s-16` 64 (px). Optical half-steps (2, 6, 10, 14px) are written as literals. |
|---|---|
| Radius | `--r-1` 3px tags and keycaps · `--r-2` 5px buttons, inputs, chips · `--r-3` 8px panels, callouts · `--r-4` 12px dialogs and home actions |
| Shadow | `--sh-1` a 1px lift under the current step · `--sh-pop` hover on home actions · `--sh-dialog` dialogs · `--sh-bar` the finish bar lifting off the list. Lines do the rest. |
| Layout | top bar 48px, status bar 28px, rail 264px (232px under 1100px wide, a 60px strip of step numbers under 980px), page gutter 32px |

## Fonts and licences

| Font | Files | Licence | Source |
|---|---|---|---|
| Instrument Sans, variable (weight 400-700, width 75-100) | `instrument-sans-latin.woff2`, `instrument-sans-latin-ext.woff2` | SIL Open Font License 1.1, `fonts/LICENSE-InstrumentSans-OFL.txt`. Copyright 2022 The Instrument Sans Project Authors | npm `@fontsource-variable/instrument-sans` 5.3.0 |
| JetBrains Mono, variable (weight 100-800) | `jetbrains-mono-latin.woff2`, `jetbrains-mono-latin-ext.woff2` | SIL Open Font License 1.1, `fonts/LICENSE-JetBrainsMono-OFL.txt`. Copyright 2020 The JetBrains Mono Project Authors | npm `@fontsource-variable/jetbrains-mono` 5.3.0 |

Only latin and latin-ext are bundled (about 130 KB in all). Everything else falls through the stack to system fonts: Segoe UI (Windows, also Arabic/Jawi), Microsoft YaHei and PingFang SC (Chinese), Nirmala UI, Tamil MN and Tamil Sangam MN (Tamil), Geeza Pro (Arabic on Mac). Keycaps write `Ctrl`, `Enter`, `Esc` in words because the arrows and the return symbol are outside the bundled subsets.

## How the parts are designed

**Tags.** `<span class="tag"><span class="b">{{</span>PERSON_1<span class="x">.SURNAME</span><span class="b">}}</span></span>`. A black bar (3px radius) in both themes; in dark it gains a hairline so it reads against charcoal. JetBrains Mono 500 at 0.84em of the text around it, ligatures off so `{{` and `__` never join. The braces and the ending (`.SURNAME`, `.B`) are dimmed so the eye reads type and number first, but they stay in the text so the bar matches what the AI writes and copies cleanly. `.tag.fixed` (11.5px) is for tables; a tag never breaks across two lines. In Windows high-contrast mode the bar becomes CanvasText with a border. The app's `tags()` helper only needs to emit the markup above.

**Status chips and lights.** A light is never colour alone: passed is a circle, needs attention a triangle, failed or blocked a square, information a ring, not started a hollow ring, running a ring in the signal colour. Chips are 20px, 3px radius, a 1px border in the status line colour, a tinted fill and dark text (all AA). Short codes (OCR) are mono caps. Tab counts reuse the chip: grey for a count, amber with a triangle while there is work to do, a green tick when done.

**Tables.** No zebra stripes: a 1px line between rows, uppercase 10.5px heads with a stronger rule, sticky heads under the sticky tab bar. Numbers right-aligned in mono with tabular figures. The row with the keyboard cursor gets the selected fill, a 2px signal-colour edge and its keycaps; other rows keep quieter buttons, so a list of thousands does not shout. Long values wrap; file names in the rail end in an ellipsis with the full name as a tooltip.

**Finish bar.** Fixed under the list, lifted by a soft shadow. Its top edge is a 2px progress bar (decided of total), so the bar itself shows how far the review has come. Left: a light and a one-line state ("Before you can finish", "Review finished"), then each blocker as a small link with its count that jumps to the list it names. Right: the one next action with its keys; it stays visible but disabled while anything blocks it. After the review: "Export the chronology only (recommended)" as the primary and "Export all files" beside it.

**Rail.** Matter name and level, then the steps as a signal path (filled nodes with ticks for done, a signal-colour ring for the current step with its count, hollow numbers for the rest), then the files with lights and a filter. Under 980px it folds to a 60px strip of step nodes.

**Keyboard.** Keycaps on primary actions (`Ctrl Enter` to start, finish, check; `Ctrl N` and `Ctrl R` on home; `Enter` to hide a typed word; `Esc` in dialogs) and a key map above lists (`↑ ↓` move, `P C O` hide as person, company or other, `F` fine, `H` hide it). The visible focus ring is 2px signal colour with a 2px gap. Dialogs open with Cancel focused.

**Dialogs.** Icon tile, title, "Step 1 of 2" when a number or ID asks twice, the value laid out on a small specimen card (value, its tag and where it is, how it was found), the consequence in one sentence, Cancel and the action on a sunken foot.

## Notes for the build

- Keep the CSP; add `font-src 'self'`. Widths of bars come from `<progress>` values, never inline styles.
- `Ctrl R` is proposed for Restore a draft: remove Electron's default reload accelerator (the window is locked down anyway).
- Proposed here, not in the app today: the key map and row shortcuts; the file list in the rail; the parsed preview of client forms and parties on setup; "Real text / As exported" on the chronology; "Restored / With tags" on the restored draft; the step kicker over page titles. Each is optional.
- All names, firms, numbers and documents in the mock-ups are made up.
- Screenshots come from Chromium on Linux. On Windows the bundled fonts render the same, but Chinese and Tamil file names will use Microsoft YaHei and Nirmala UI instead of the Linux fallbacks seen in the shots.
