# Cloak by Lawgistics: "Chambers"

A design direction for the Cloak desktop app. Static HTML and one stylesheet; nothing here is wired to the engine yet.

## The idea in five lines

1. Cloak should read like a well-set legal opinion: warm paper, deep ink, hairline rules, generous margins, and nothing that shouts.
2. The client's words (excerpts, previews, the restored draft) are set in a serif; the tool's own words are set in a precise sans. You can always tell which is which.
3. A tag is a redaction bar with a label on it: the page colour turned inside out, so `{{PERSON_1}}` reads as "hidden" before it is read at all.
4. One accent, signature blue (the blue of a wet-ink signature on an original), is kept for focus, links, selection and restored values. Actions are in ink.
5. Verdicts are stamps, every decision carries a name and a time, and the next step is always in one sticky bar at the foot of the window.

## What is here

| File | Screen | Shots (`shots/`) |
|---|---|---|
| `home.html` | Home: the two actions, sample matter, Help / Your data / About / Licence, signed-in name, "Licensed to" in the top bar | `home-light.png`, `home-dark.png` |
| `setup.html` | Cloak a folder: 1 documents (with the OneDrive note), 2 matter (create: name, Strict or Standard, password twice), 3 people | `setup-light.png`, `setup-dark.png`, `setup-full.png` |
| `recovery.html` | Recovery code, shown once, Print, the tick, Continue | `recovery-light.png`, `recovery-dark.png` |
| `progress.html` | Cloaking progress: one row per file, OCR stamp, spinner, "128 of 214 files read" | `progress-light.png`, `progress-dark.png`, `progress-full.png` |
| `review.html` | Review, Not sure tab, finish bar with blockers | `review-light.png`, `review-dark.png`, `review-full.png`, `review-narrow-light.png` (860 x 600) |
| `dialog.html` | Review, Everything replaced tab, "Stop hiding this?" (step 1 of 2, for an NRIC number) | `dialog-light.png`, `dialog-dark.png` |
| `chronology.html` | Review, Chronology tab: missing-files warning, chips, two rows ticked to merge, confirm card; finish bar in its "everything is decided" state | `chronology-light.png`, `chronology-dark.png`, `chronology-full.png` |
| `doublecheck.html` | Double check: pass or fail per file, findings with part, line and excerpt, "Hide it" / "It is fine", a decided finding with who and when, export locked until all are decided | `doublecheck-light.png`, `doublecheck-dark.png`, `doublecheck-full.png` |
| `restore.html` | Restore a draft, with a result: Warnings, counts, three checks with issues by paragraph, the restored draft with Copy and Save as | `restore-light.png`, `restore-dark.png`, `restore-full.png`, `restore-narrow-dark.png` (860 x 600) |

`style.css` holds every rule. `fonts/` holds the woff2 files and their licences. All names, firms, amounts, ID numbers and documents are made up (the NRIC number uses an impossible date on purpose).

Constraints met: no inline `style` attributes, no `<style>` blocks, no scripts at all, icons as inline SVG symbols, fonts bundled. Each page carries the app's Content-Security-Policy with `font-src 'self'` added; the pages were rendered under it with no violations. Light and dark follow `prefers-color-scheme`.

## Tokens

### Colour

| Token | Used for | Light | Dark |
|---|---|---|---|
| `--paper` | window background | `#F6F4EE` | `#111318` |
| `--sheet` | raised surfaces: tables, cards, dialogs, document page | `#FDFCF8` | `#171A20` |
| `--well` | sunken fills: path boxes, specimen, disabled buttons | `#EFECE4` | `#0C0E12` |
| `--hover` | row and button hover | `#F1EEE6` | `#1C2027` |
| `--ink` | headings, primary buttons, selected tab | `#161A22` | `#F3EFE6` |
| `--ink-2` | primary button hover | `#2B303B` | `#FFFFFF` |
| `--on-ink` | text on ink | `#F6F4EE` | `#111318` |
| `--text` | body text | `#262A33` | `#DAD6CD` |
| `--muted` | secondary text, labels | `#5B606B` | `#A3A6AD` |
| `--placeholder` | input placeholders | `#6F737C` | `#8E929A` |
| `--faint` | decoration only (quote marks, separators), disabled text | `#84888F` | `#737780` |
| `--rule` | hairlines | `#E3DED3` | `#262A32` |
| `--rule-strong` | table header rule, input sides | `#D3CDBF` | `#343944` |
| `--control` | control boundaries (3:1): input bottom edge, checkboxes, secondary buttons | `#8B8578` | `#6C7280` |
| `--accent` | signature blue: links, focus ring, selection | `#2F3D99` | `#A9B3F3` |
| `--accent-strong` | link hover | `#252F7D` | `#C4CAF7` |
| `--accent-soft` / `--accent-line` | info notes, picked rows, OCR stamp | `#E8EAF6` / `#BCC2E6` | `#1D2240` / `#3B4482` |
| `--ok` / `-soft` / `-line` | passed, done, cloaked | `#2B6B3F` / `#E3EEE2` / `#B7D2BA` | `#8BCB9C` / `#14251A` / `#2D5137` |
| `--warn` / `-soft` / `-line` | to do, warnings, blockers | `#8A5300` / `#F8ECD3` / `#E4C489` | `#EBC275` / `#2A2112` / `#5E4721` |
| `--bad` / `-soft` / `-line` | failed, blocked, conflicts, "Don't hide" | `#A3291F` / `#F7E2DD` / `#E3B1A8` | `#F2A194` / `#2F1A18` / `#65342E` |
| `--highlight` / `-line` | a word to decide, inside a quotation | `#F5E1A4` / `#C08F22` | `#4A3C14` / `#CFA84C` |
| `--tag-bg` / `--tag-fg` / `--tag-dim` | the tag bar, its label, its braces and suffix | `#161A22` / `#F4F1E9` / `#959AA6` | `#E9E4D8` / `#14171D` / `#5E626C` |
| `--restored` / `-line` | a value put back by Restore | `#E9EBF7` / `#8E98D6` | `#1F2443` / `#5A65B5` |
| `--scrim` | behind dialogs | `rgba(17,20,27,.46)` | `rgba(3,4,6,.66)` |
| `--mark-tablet` / `--mark-bar` | the mark | `#161A22` / `#F6F4EE` | `#F3EFE6` / `#111318` |

Measured contrast (WCAG 2.x): body text 13.1:1 light and 12.8:1 dark; muted text at least 5.3:1 light and 6.7:1 dark on every surface it sits on; placeholder 4.6:1 and 5.6:1; status text on its tint 5.4 to 5.8:1 light and 8.0 to 9.4:1 dark; tag label 15.4:1 and 14.2:1, tag braces 6.2:1 and 4.8:1; control boundaries 3.3 to 3.9:1; focus ring 8.5:1 and 9.2:1.

### Type

| Token | Family | Size / line | Weight | Used for |
|---|---|---|---|---|
| `--type-display` | Cloak Serif (Newsreader, opsz 72) | 54 / 1.04 | 400 | home headline |
| `--type-h1` | Cloak Serif | 34 / 1.12 | 420 | screen titles |
| `--type-h2` | Cloak Serif | 23 / 1.25 | 480 | section and dialog titles (dialog 27) |
| `--type-h3` | Cloak Serif | 18 / 1.3 | 560 | card titles ("Result", "Confirm the chronology") |
| `--type-lead` | Cloak Sans (Instrument Sans) | 16 / 1.55 | 400 | standfirst under a title |
| `--type-body` | Cloak Sans | 14.5 / 1.55 | 400 | interface text |
| `--type-small` | Cloak Sans | 13 / 1.45 | 400 | hints, sources, metadata |
| `--type-label` | Cloak Sans, capitals, tracking .085em | 11.5 / 1.3 | 620 | labels, table headers, stepper |
| `--type-read` | Cloak Serif | 15.5 / 1.68 | 400 | document page (restored draft) |
| `--type-quote` | Cloak Serif | 15 / 1.5 | 400 | excerpts, chronology events |
| tags | Cloak Mono (IBM Plex Mono) | 0.8em of the line | 500 | `{{TYPE_n}}` |

Figures are tabular wherever numbers line up (counts, dates, line numbers) and lining in the document page, so amounts read cleanly.

### Space, radius, shadow

| | Tokens |
|---|---|
| Space (4px base) | `--sp-1` 4, `--sp-2` 8, `--sp-3` 12, `--sp-4` 16, `--sp-5` 24, `--sp-6` 32, `--sp-7` 48, `--sp-8` 64, `--sp-9` 96; page gutter `--gutter` 40 (28 below 1060px, 24 below 960px) |
| Radius | `--r-xs` 3 (tags, stamps, chips), `--r-sm` 6 (buttons, inputs), `--r-md` 10 (sheets, notes), `--r-lg` 14 (home plates, dialogs); the document page uses 4, like cut paper |
| Shadow | `--sh-1` hairline lift for sheets; `--sh-2` lifted card and document page; `--sh-3` dialog; `--sh-bar` upward shade above the sticky bars; `--sh-plate` the ink plate on Home. Dark mode uses the same names with black shadows. |

Content column: 1040px (review, double check, restore), 940px (setup, home), 860px (recovery). The page itself scrolls; the top bar and the finish bar are sticky, so nothing is trapped in an inner scroll box.

## Fonts

| Face | Role | Files | Licence |
|---|---|---|---|
| Newsreader, by Production Type | headings and document text | `newsreader-latin-opsz-normal.woff2`, `-italic`, and the `latin-ext` pair (variable: weight 200 to 800, optical size 6 to 72) | SIL Open Font License 1.1, `fonts/LICENSE-Newsreader-OFL.txt` |
| Instrument Sans, by Instrument | interface | `instrument-sans-latin-wght-normal.woff2` and `latin-ext` (variable: weight 400 to 700) | SIL Open Font License 1.1, `fonts/LICENSE-InstrumentSans-OFL.txt` |
| IBM Plex Mono, by IBM | tags, paths, the recovery code | `ibm-plex-mono-latin-400/500-normal.woff2` and `latin-ext` | SIL Open Font License 1.1, `fonts/LICENSE-IBMPlexMono-OFL.txt` |

Taken from the npm registry (`@fontsource-variable/newsreader` 5.3.0, `@fontsource-variable/instrument-sans` 5.3.0, `@fontsource/ibm-plex-mono` 5.3.0); 568 KB in all. The faces are declared as "Cloak Serif", "Cloak Sans" and "Cloak Mono", so an installed copy of a font is never picked up by accident, and swapping a face is a change to one `@font-face` block.

Fallbacks: Georgia / Segoe UI / Consolas first, then Chinese (Microsoft YaHei, PingFang SC, Noto Sans SC), Tamil (Nirmala UI, Tamil MN, Tamil Sangam MN, Noto Sans Tamil) and Jawi/Arabic (Segoe UI, Geeza Pro, Noto Naskh Arabic). The progress and chronology screens show Chinese, Tamil and Jawi file names falling back cleanly (rendered here with the Linux stand-ins, since YaHei, Nirmala UI and Segoe UI are Windows fonts).

## How the pieces are designed

### Tags

- A tag is an inline bar, never a pill: 3px corners, mono capitals at 0.8em of the surrounding text, 500 weight, slight tracking, no line break inside.
- The bar is the page colour inverted: ink with paper type in light mode, paper with ink type in dark mode. That one rule makes a tag read as "covered" in both themes, in serif excerpts, in sans tables and in lists of tags.
- The braces and the form suffix are dimmed (`.tag__b`, `.tag__f`), so the eye lands on the type and number: `{{` **PERSON_1** `.FIRST}}`. The full text stays in the DOM, so copying a tag copies `{{PERSON_1.FIRST}}` exactly.
- Markup: `<span class="tag"><span class="tag__b">{{</span>DATE_3<span class="tag__f">.B</span><span class="tag__b">}}</span></span>`. In the app this is a two-line change to the existing `tags()` helper.
- Related marks: a word the reviewer must decide on is highlighted like a marker pen (`mark`); a value put back by Restore gets a light blue wash (`.restored`) so every one can be checked by eye; a value a check questions gets a wavy amber underline (`.flagged`). Copy and Save as give plain text without any of these.

### Status: stamps and chips

- **Stamps** are verdicts, set like a rubber stamp on a file: small capitals, 1px border, tinted ground, an icon, 3px corners. `PASS`, `FAIL`, `PASSED`, `WARNINGS`, `TO DECIDE`, `HIDDEN`, `OCR`, `STRICT`, `FOLDER NAME`. Large stamps head a result (`2 TO DECIDE`, `WARNINGS`).
- **Chips** are notes in sentence case with a leading dot: `same event A` (blue, square dot, for a group), `possible conflict: the amounts differ` (red), `no year` (amber), `date not understood` (red), `range` (neutral).
- Colour is never the only signal: every stamp has a word and most have an icon, and a date Cloak could not read is also underlined.
- Green means done or passed, amber means something is waiting for a person, red means blocked, failed or in conflict, blue means information. The accent is blue too, so blue never asks for action.

### Tables

- No vertical lines and no zebra stripes: hairline rules between rows, a stronger rule under the header, small-capital header labels.
- Headers stick under the top bar while a long list scrolls; counts are right-aligned in tabular figures; row hover is a faint paper tint and picked rows take the accent wash.
- The first column carries the thing itself (the word, the tag, the date) in the strongest type; quotations from documents sit under it in the serif with their source line ("06 WhatsApp export - site team.txt, line 1,204") in small sans.
- Row actions sit at the right, quiet until needed. On Not sure, "Hide as" leads a three-way segmented group (Person, Company, Other) and "It's fine" stands apart; nothing in a row is pre-chosen.
- Long lists show the first 300 rows with a footer line ("Showing 300 of 1,284. Use the search box, or show them all"). In tables, long file and company names wrap rather than being cut; only the top bar, the restore summary strip and the double-check file list (two lines) shorten them.

### The finish bar

- A sticky bar at the foot of the window on Review, Double check and Setup (where it is the action bar). It spans the window, sits on the sheet colour with an upward shade, and lines up with the content column.
- Left: a state label in small capitals with a dot, amber "Before you can finish" or green "Everything is decided". Blockers follow as short amber buttons, count first ("**14** words not sure", "**6** joined names", "**2** short forms"), each jumping to its tab. The engine's full sentences become the buttons' accessible names.
- Right: one primary action, "Finish review", disabled while anything blocks it; on Double check it is "Export all files" and "Export the chronology only" (marked recommended, and the primary one), both locked until every finding is decided.
- Disabled buttons drop to a well colour with faint text, so they cannot be mistaken for live ones, and the bar's text says why.
- With the double checker in the flow, "Finish review" leads to the Double check screen, and the two export buttons live in that screen's bar rather than in the review bar.

### Other parts

- **Mark and wordmark.** The small mark (top bar, under 28px) refines the current one: the same dark rounded square, with the bar set left like a covered word in a line of text, square-ended like redaction tape. The large mark (recovery sheet, About, installer) adds two faint text lines around the bar: a page with one line hidden. The wordmark is "Cloak" in Newsreader at 520 weight with "by Lawgistics" in small capitals after a hairline. Both are inline SVG and invert in dark mode.
- **Stepper.** Set up, Read, Review, Double check, Export, across the top of every cloak screen; done steps take a green tick, the current one an ink disc.
- **Dialogs.** Paper sheet over a dimmed, slightly blurred window; the page behind is `inert` and does not scroll. "Stop hiding this?" shows the value as a specimen (kind, value, tag, places and files, how it was found), what will happen in three lines, and a two-pip step marker because numbers and IDs are asked twice. Cancel has the focus; the second step uses the red button.
- **Document page.** The restored draft is set like a page: centred small-capital title, italic subtitle, paragraph numbers in the margin. Paragraphs with an issue get an amber margin mark, and the issue list on the right links to them by paragraph.
- **Fields.** A field has light sides and a darker bottom edge (the control colour, 3:1), like a line to write on; focus adds the accent ring. Passwords show their rules met as they are typed.
- **Notes.** Info (blue), warning (amber), error (red) and done (green) share one shape: tinted ground, hairline border, icon in the margin, a bold first line.

## Behaviour and accessibility

- Keyboard focus is a 2px signature-blue ring with a 2px offset on every control (fields take a blue border and a soft blue ring instead); the dialog opens with Cancel focused (`autofocus`). A skip link leads to the content.
- Real buttons, labels, fieldsets and legends throughout; tabs use `role="tab"` and `aria-selected`; "to do" counts carry hidden text for screen readers.
- 1180 x 820 and 860 x 600 both checked: no horizontal scroll at either size. Below 960px the top bar keeps the firm name and the offline icon, form margins stack, the add bar shortens its label, and restore puts the result above the draft. Below 700px tall, titles tighten and secondary metadata hides so the first rows of a list stay in view.
- `prefers-reduced-motion`: transitions and hover lifts are switched off and the spinner becomes a still half ring.
- `forced-colors` (Windows high contrast): tags, buttons, stamps and notes get system-colour borders; highlights use the system Mark colours.
- Print: the top bar and sticky bars are hidden; the recovery sheet prints with a plain border.

## Notes for building it

- Add `font-src 'self'` to the CSP in `index.html`, ship `fonts/` beside the stylesheet.
- Class names map closely to today's `app.css`: `.btn.primary` becomes `.btn--primary`, `.chip.cloaked` / `.manual` / `.partial` become `.stamp--ok` / `--warn` / `--bad`, `.msg.warn` becomes `.note--warn`, `.card` becomes `.sheet`, `.tab.todo` becomes `.tab--todo`.
- `main` no longer scrolls on its own; the document does, and the top bar is `position: sticky`. Table headers stick at `top: 54px`, the top bar's height.
- Blockers are easier to draw as data (`{ count, label, tab }`) than as sentences.
- Dates and times are written as "15 Nov 2026, 3:42 pm", as the app already does.
