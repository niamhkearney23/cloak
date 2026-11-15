# Cloak · Nocturne

A design direction for the Cloak desktop window. It's dark first, with a light mode built to the same standard. Plain HTML and one stylesheet, ready for the locked-down Electron window.

## The idea in five lines

1. **Night, not darkness.** Graphite surfaces are layered like lacquered panels. Light and soft shadow separate them, not ruled lines.
2. **One warm light.** Champagne gold belongs to Cloak itself: the mark, the one main action on a screen, and the lettering on every hidden detail.
3. **Lamps that need you.** Amber ("ember") marks anything that still needs a decision. When the review is done, those lamps go out and the screen turns quiet and green.
4. **Sealed tags.** Every `{{TAG}}` is a small black-lacquer seal with gilt lettering. It reads as "hidden" at a glance, in any list, in both themes.
5. **Editorial calm.** Titles and big figures are set in a high-contrast display serif, the working text in a compact grotesk. Numbers that need to line up use tabular figures.

## Screens

| File | Screen | Shots (1180 × 820; `-full` when the page scrolls) |
|---|---|---|
| `home.html` | Home: Cloak a folder, Restore a draft, sample matter, Help, Your data, About, Licence, "Licensed to" in the bar | `home-light`, `home-dark` |
| `setup.html` | Cloak a folder: documents (OneDrive note), matter (create: name, Strict/Standard, password twice; the open variants are described under it), people, test tick, Start | `setup-*`, `setup-*-full` |
| `progress.html` | Cloaking: a row per file, OCR chips, spinner, "12 of 20 files read" | `progress-*`, `progress-*-full` |
| `recovery.html` | Recovery code: shown once, Print, the "written down" tick | `recovery-*` |
| `review.html` | Review, **Not sure** tab, finish bar showing the blockers | `review-*`, `review-*-full`, `review-narrow-light` (860 × 600) |
| `chronology.html` | Review, Chronology tab: missing-files warning, chips, two rows ticked to merge, undated rows behind a count, Confirm card | `chronology-*`, `chronology-*-full` |
| `doublecheck.html` | Double check: files pass or fail, findings with file, part, line and excerpt; Hide it / It is fine; decisions with who and when; export locked | `doublecheck-*`, `doublecheck-*-full` |
| `restore.html` | Restore a draft with a result: verdict, three counts, three checks with issues by paragraph, the restored text with Copy and Save as | `restore-*`, `restore-*-full`, `restore-narrow-dark` (860 × 600) |
| `dialog.html` | Review (Everything replaced) with **Stop hiding this?** open, step 1 of 2 for an ID number | `dialog-*` |
| `viewer.html` | Extra: the manual-check file viewer with non-Latin text and the typed APPROVE | `viewer-*` |

All content is made up: the firm "Cempaka Wong & Partners", the matter "Seri Kembara v Teratai Jaya", every person, NRIC, account and amount.

## Tokens

All tokens are CSS custom properties on `:root`. Dark values sit in `@media (prefers-color-scheme: dark)`.

### Colour

| Role | Token | Light | Dark |
|---|---|---|---|
| Canvas | `--bg` | `#F2F0EB` ivory, white glow at top | `#0E1014` graphite, faint champagne and moon glows at top |
| Card | `--surface-1` | `#FFFFFF` | `#15181E` |
| Raised control | `--surface-2` | `#FFFFFF` | `#1D2128` |
| Dialog, dock | `--surface-3` | `#FFFFFF` | `#1F232B` |
| Track (segmented control, path) | `--sunken` | `#EAE7E0` | `#0B0D10` |
| Reading well (excerpts, restored draft) | `--inset-bg` | `#F7F5F0` | `#101318` |
| Text input | `--well` | `#FFFFFF` | `#0D0F13` |
| Hairline / strong hairline | `--hairline` / `--hairline-strong` | `rgba(24,22,16,.085)` / `.14` | `rgba(255,255,255,.065)` / `.11` |
| Input and checkbox border (≥ 3:1) | `--control-border` | `#7E8189` | `#5F6673` |
| Text | `--text` | `#16171B` | `#ECEDF0` |
| Secondary text | `--text-2` | `#4F525A` | `#AEB3BD` |
| Tertiary text | `--text-3` | `#64676F` | `#8F96A2` |
| Accent (links, indicators, focus) | `--gold` | `#85652A` bronze | `#E3C78F` champagne |
| Accent, stronger | `--gold-strong` | `#6B501E` | `#F0DBAE` |
| Accent wash | `--gold-wash` | `rgba(160,124,58,.11)` | `rgba(227,199,143,.10)` |
| Main action background | `--cta-bg` | black lacquer `#2B2C32 → #16171B` | champagne `#EFD9AB → #DCBD82` |
| Main action text | `--cta-ink` | `#F7F1E3` | `#1A1509` |
| Secondary button | `--btn-bg` / `--btn-ink` | `#FFFFFF` / `#24262B` | `#21252D` / `#E6E8EC` |
| Needs you (to do, warnings, manual check) | `--ember` / `--ember-wash` | `#94480C` / `#FBEEDD` | `#F3B36C` / `rgba(243,170,90,.13)` |
| Done (cloaked, passed, finished) | `--jade` / `--jade-wash` | `#1B6B45` / `#E3F1E9` | `#8AD5AB` / `rgba(110,200,150,.12)` |
| Blocked (failed, conflict, not understood) | `--rose` / `--rose-wash` | `#A02330` / `#FBE7E7` | `#FF9E9B` / `rgba(255,120,115,.13)` |
| Information (OCR, archive, same event) | `--moon` / `--moon-wash` | `#2A5085` / `#E7EDF7` | `#AFC3E8` / `rgba(150,180,235,.12)` |
| Tag seal | `--tag-bg` | `#17181C` | `#07080A`, with a champagne ring at 17% |
| Tag lettering | `--tag-ink` | `#EBD5A4` | `#E3C78F` |
| Tag braces and endings | `--tag-brace` | `rgba(235,213,164,.6)` | `rgba(227,199,143,.6)` |
| Mark tile, mark bar | `--mark-tile`, `--mark-bar` | `#2E2F35 → #111215`, `#F3E1B8 → #D4B272` | `#2B3039 → #161920`, same bar |
| Focus ring | `--focus` | `#85652A` | `#E3C78F` |
| Dialog backdrop | `--scrim` | `rgba(30,27,22,.36)` + 2.5 px blur | `rgba(4,5,7,.62)` + 2.5 px blur |

Measured contrast, light / dark: body text 17.9 / 15.2; secondary text 7.8 / 8.5; tertiary text on the canvas 5.0 / 6.4; accent text on cards 5.4 / 10.9; main-action text 14.6 / 11.3; chips 5.6 to 6.9 / 7.5 to 8.3; tag lettering 12.3 / 12.2; tag braces ≥ 4.5 in both themes; input borders 3.4 to 3.9 / 3.1 to 3.3; focus ring 4.7 / 11.6.

### Type

| Token | Size / line height | Face | Use |
|---|---|---|---|
| `--fs-hero` | 64 / 1.06 | Cloak Display 400 | "Cloak" on Home |
| `--fs-h1` | 38 / 1.06 | Cloak Display 420 | Screen titles |
| dialog title | 28 / 1.12 | Cloak Display 440 | Dialogs |
| `--fs-h2` | 25 / 1.15 (setup steps 24, finding values 23) | Cloak Display 450 | Card and step titles, finding values |
| big figures | 27 to 46 | Cloak Display 400 to 430 | Counts, "12 of 20", the verdict |
| lede | 15 / 1.55 | Cloak Sans 400 | The sentence under a title |
| `--fs-title` | 16 / 1.32 | Cloak Sans 600 | Section titles |
| `--fs-body` | 14 / 1.55 | Cloak Sans 400 | Everything else |
| `--fs-sm` | 13 / 1.5 | Cloak Sans | Table cells, examples, help text |
| `--fs-xs` | 12 | Cloak Sans | Captions, meta, chips (11.5, weight 650) |
| `--fs-micro` | 11, capitals, tracking .13em | Cloak Sans 650 | Eyebrows, column heads, the flow |
| tag | 0.8 em of its text | Cloak Mono 500 | `{{TAGS}}` |

### Space, radii, shadows, motion

- **Space** (4 px grid): `--sp-1…10` = 4, 8, 12, 16, 20, 24, 32, 40, 56, 72. `--gutter` (side padding of the scrolling area) is 32, and 24 under 1040 px.
- **Radii:** `--r-xs` 5 (tags), `--r-sm` 8 (small buttons), `--r-md` 11 (buttons, inputs, messages), `--r-lg` 16 (cards), `--r-xl` 22 (dialogs, Home choices), `--r-pill` 999 (chips, counts). The mark uses a continuous-corner squircle.
- **Shadows**, light (warm, with a 1 px ring in place of a border):
  - `--shadow-1` (controls): `0 0 0 1px rgba(24,22,16,.07), 0 1px 2px rgba(24,22,16,.06)`
  - `--shadow-2` (cards): adds `0 16px 36px -18px rgba(48,38,18,.2)`
  - `--shadow-3` (dock): `0 18px 44px -14px rgba(48,38,18,.3)` plus ring
  - `--shadow-4` (dialogs): `0 44px 100px -24px rgba(30,24,10,.42)` plus ring
- **Shadows**, dark: the same four steps. Each has a 1 px inner top highlight (`inset 0 1px 0 rgba(255,255,255,.04 to .07)`) and deep black falloff (`0 20px 40px -20px rgba(0,0,0,.75)` up to `0 50px 110px -20px rgba(0,0,0,.85)`).
- **Wells:** `--inset-well` and `--inset` make inner shadows for sunken areas.
- **Motion:** `--dur` 140 ms, `--ease` `cubic-bezier(.2,.7,.2,1)`, used for colour and shadow only. Under `prefers-reduced-motion` every transition and animation drops to 1 ms and the spinner stops (it stays visible as a ring).

## Fonts (bundled in `fonts/`, all SIL Open Font License 1.1)

| CSS name | Typeface | Files | Source | Licence file |
|---|---|---|---|---|
| Cloak Display | Noto Serif Display, variable weight, roman and italic | latin + latin-ext (473 KB) | `@fontsource-variable/noto-serif-display` 5.3.0 | `LICENSE-NotoSerifDisplay-OFL.txt` |
| Cloak Sans | Hanken Grotesk, variable weight, roman and italic | latin + latin-ext (110 KB) | `@fontsource-variable/hanken-grotesk` 5.3.0 | `LICENSE-HankenGrotesk-OFL.txt` |
| Cloak Mono | DM Mono 400 and 500 | latin + latin-ext (49 KB) | `@fontsource/dm-mono` 5.3.0 | `LICENSE-DMMono-OFL.txt` |

- **Source.** Fetched from the npm registry with `npm pack`, each into its own empty folder; only the `.woff2` files and the licences were copied.
- **Coverage.** `unicode-range` loads latin-ext only when a page needs it. The fonts have tabular figures by default.
- **Fallbacks.** Each stack continues with system faces:
  - Windows: Segoe UI Variable, Segoe UI (also covers Jawi/Arabic), Microsoft YaHei (Chinese), Nirmala UI (Tamil).
  - Mac: the system font, PingFang SC, Tamil MN, Geeza Pro.
  - Last: Noto Sans SC, Noto Sans Tamil and Noto Sans Arabic, then the generic family.
- **Why these faces.** None is used by the other two directions in `design/`.
- **CSP.** The app needs `font-src 'self'` added to its policy. Every page here carries exactly that policy, and it is enforced when the pages are opened.

## How the key pieces are designed

### Tags
- **Look.** A black-lacquer seal: radius 5, a faint top sheen, gilt lettering in Cloak Mono 500 at 0.8 em. The seal looks the same in both themes, because the black bar is the redaction. In dark mode it is a shade deeper than the surface, with a thin champagne ring so it lifts off the graphite.
- **Dimmed parts.** Braces and endings (`.SURNAME`, `.B`, `.FIRST`) are at 60%, so the type and number read first. The full text is still there for copying.
- **No colour coding.** Tags are never coloured by type. One uniform seal is what makes "hidden" instant in a list of thousands.
- **Markup.** `<span class="tag"><span class="b">{{</span>PERSON_1<span class="f">.SURNAME</span><span class="b">}}</span></span>`. The app's current `<span class="tag">{{PERSON_1}}</span>` also works, just without the dimming. In `app.js`, `tags()` can split with `/\{\{([A-Z_]+?_\d+)((?:\.[A-Z0-9]+)*)\}\}/`.
- **Larger seals.** Dialogs show a larger seal (13 px) next to the real value in a "reveal" well: tag → value → "31 places in 9 files".

### Status chips
- **Shape.** A 22 px pill in 11.5 px / 650 type, always with a glyph and words, so colour is never the only signal. Glyphs are `data:` SVG masks in the CSS, so the app's markup does not change.
- **Families:**
  - **Jade**, done: Cloaked, Passed, Review finished, Marked fine.
  - **Ember**, needs you: Needs manual check, Warnings, no year.
  - **Rose**, blocked: Partly read – blocked, Unreadable – blocked, Failed, possible conflict, date not understood.
  - **Moon**, information: OCR, Archive opened, same event.
  - **Neutral:** range, and the name of the check that found something.
- **Classes.** The app's classes (`cloaked`, `manual`, `partial`, `unreadable`, `ocr`, `container`) work unchanged. `pass`, `warn`, `fail`, `info`, `same`, `conflict` and `quiet` are added.
- **Counts on tabs.** Tabs that still have work show an ember pill with a small lit dot ("lamp"). A finished list shows a jade check.

### Tables
- **Rows.** No grid lines: hairline rows, a hover tint and generous padding (13 px).
- **Headers.** Sticky caps headers, 11 px with .1 em tracking, on the card colour.
- **Numbers.** Counts are right-aligned with tabular figures.
- **Cards.** Tables sit in flush cards, so long lists keep soft depth without borders.
- **Chronology.** Bold dates with their chips underneath; the event in full text colour; people and source muted. Ticked rows get a gold wash and a 2 px gold edge. Edit and Delete are icon buttons with accessible names. Rows with no date sit behind a count and a button.
- **Long names.** Long Malay company names wrap anywhere. File names mixing scripts are bidi-isolated, so Jawi or Tamil never scrambles the line.
- **Not sure.** This list is a set of cards rather than a table: each card has the word, its examples (tags inline, the word itself lit in ember), a places/files count, a "Hide as Person | Company | Other" segmented control and "It's fine".

### The finish bar
- **Shape.** A dock that floats just above the bottom of the scrolling area: radius 18, `--surface-3` at 90% with blur, and `--shadow-3`. A gradient underlay fades the list out beneath it, so no rows peek around its edges.
- **Left side.** A lamp (ember while something is left, jade when everything is decided) and the status words. "Before you can finish:" lists each blocker as a link to the tab that holds the work.
- **Right side.** The single main action. Disabled, it is flat with a lock icon and stays legible. After the review: "Export the chronology only (recommended)" is the main action, with "Export all files…" beside it.
- **Other screens.** The same dock carries "Start cloaking" on Setup and the locked export on Double check: "3 places still to decide. Export unlocks when every file passes, or every finding is decided."

### Other conventions
- **Main action.** One per view (`btn primary`): black lacquer in light, champagne in dark.
- **Button weights.** "Tonal" (gold wash) is for positive secondary actions such as "Hide it in every file", "Hide it" and "Confirm the chronology". `danger-soft` is for the first "Yes, stop hiding it"; `danger-fill` is for the second, "Are you sure?". Cancel is focused by default.
- **Flow.** A five-step flow (Set up · Read · Review · Double check · Export) sits beside each title, so people always know where they are.
- **Focus.** A 2 px champagne/bronze ring, offset 2 to 3 px. Inputs turn their border gold and add a 3 px wash.
- **Mark.** A lacquer squircle with three lines of text, one name sealed under a metallic gold bar. It refines the old dark square with a white bar. The wordmark is "Cloak" in Cloak Display beside it, with "BY LAWGISTICS" in small capitals.

## Window sizes

- **1180 × 820.** Two or three Not sure cards and two chronology rows are visible above the dock.
- **Under 1040 px wide:**
  - The setup rail and the double-check file column fold away.
  - Not sure actions move under each card.
  - Restore stacks, with the **result above the draft**.
  - The bar drops "by Lawgistics", the version and the Home/Help labels (the labels stay for screen readers).
- **Under 680 px tall** (the 860 × 600 minimum): the flow, the lede and the column heads hide, so the first item stays visible.
- **No overflow.** The shooting script fails if any page gets wider than the window. None does.

## Checks that were run

- **Content-Security-Policy.** Every page carries `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'` and was rendered with it enforced. The browser console was empty: no refused style, font or image.
- **Markup.** No `style=` attributes, no `<style>` or `<script>` elements, no URL outside the folder, no duplicate ids.
- **Accessibility.** axe-core 4.10.2, WCAG 2.0/2.1/2.2 A and AA rules, on all 10 screens × 2 themes × 2 window sizes: **0 violations**. The items axe could not decide automatically are text over the faint canvas glow; the token contrast figures above cover them.
- **Keyboard.** Every control is a real `button`, `input`, `select` or `label`. The progress screen's scrolling area takes focus, because it has no buttons.

## Notes for the implementation phase

- **Class names.** The stylesheet keeps the app's own class names: `bar`, `brand`, `mark`, `by`, `bar-right`, `licence-bar`, `bar-link`, `version`, `foot`, `narrow`, `wide`, `home`, `choices`, `choice`, `try-sample`, `help-links`, `card`, `field`, `row`, `path`, `check`, `btn`, `link`, `msg`, `tip`, `code`, `chip`, `tag`, `tabs`, `tab`, `n`, `todo`, `addbar`, `finish`, `spinner`, `filetext`, `overlay`, `dialog`, `narrow-dialog`, `more`, `print-only`, `no-print`.
- **New pieces to build:** `page-head` with `flow`, the Not sure card list, `seg`, `choice-cards`, setup `step-card` and `rail`, double check `dc-grid` / `fgroup` / `places`, restore `counts` / `checks` / `issues` / `reader`, dialog `reveal` and `steps-pill`.
- **Double check data.** The layout follows the data that `doublecheck.js` `verdict()` returns today: findings grouped by value, each place with file, part, line and excerpt, `decided: {by, when}`, `fixable` ("can only be marked as fine"), and per-file pass or fail.
- **Optional engine changes the design would use:**
  - blockers as a list with the tab each belongs to;
  - the restore step returning the ranges it put back (for the gilt wash in the restored text) and paragraph numbers (already used by the checks);
  - `tags()` producing the brace and ending spans.
  - Without these, everything still works with plain text.
- **`index.html`.** Add `<meta name="color-scheme" content="dark light">` and `font-src 'self'`, and link `style.css` in place of `app.css`.
- **Screens not drawn.** Help, Your data, About, Licence, the name screen and the sample-matter screens are not drawn. They are built from the same parts: `card`, `field`, `msg`, tables, `btn`.

## Re-shooting

`node tools/shoot.cjs` (or `node tools/shoot.cjs review restore`) writes every shot to `shots/` with Playwright. It keeps each page's CSP on, prints any console message, and fails if a page overflows sideways.

The shots in this folder were rendered on Linux. Noto Sans SC, Noto Sans Tamil and Noto Sans Arabic were made available to the system font lookup through `FONTCONFIG_FILE`, standing in for Microsoft YaHei, Nirmala UI and Segoe UI. Windows ClearType renders Hanken Grotesk slightly differently at 13 to 14 px, so check one screen on a real Windows machine at the firm's usual display scaling before signing off.
