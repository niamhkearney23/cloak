# Cloak design system (final)

Base: "Chambers" (highest combined score, 31.5), with ideas grafted from Vault, Instrument and Nocturne, and every weakness the judges raised fixed. Open `index.html` to see all 48 screens. Screenshots: `shots/` (1180x820, light and dark, plus `narrow-*` at 860x600) and `shots-2x/`.

Files: `style.css` (the only stylesheet; drop-in candidate for `local/app/app.css`), `fonts/` (558 KB of woff2 plus three OFL licences), one HTML page per screen, `docs.css` (index page only).

## Five principles

1. **Two voices.** The client's words (excerpts, chronology events, the restored draft, file text, the matter name) are set in a serif (Newsreader). The tool's own words, figures and controls are set in a sans (Instrument Sans). Mono is used only for tags, paths and codes. You always know whose words you are reading. Figures are never set in a display serif.
2. **Hidden reads as hidden.** A tag is a redaction bar: an ink bar with the label printed on it (a paper bar in dark mode), braces and endings dimmer. A put-back value is the opposite: a quiet blue underline. Copying a tag copies the exact `{{PERSON_1.FIRST}}`.
3. **One colour, one meaning.** Ink does the work. Amber means it needs you. Green means done, or stays on this computer. Red means blocked, failed or stop. Blue is only focus, links and put-back values. What will leave the computer is never a colour: it is a dashed rule and an arrow-out icon, in the same grammar everywhere (finish bar, dialogs, home, export sheet). Colour is never the only signal: every state has a shape and a word.
4. **Say what happens next.** The finish bar always names what is left (blockers are buttons that jump to the work), what will leave ("On export: 212 files leave, 2 held back"), and why a button is locked (a lock icon and a reason, never just dimming). Every decision is recorded under a name and a time, and says so.
5. **Compact, calm, exact.** One column, one sticky bar at the foot, hairlines, small radii, no card inside a card, no gradients or glows. At 860x600 at least three review rows stay visible above the finish bar. Both themes are designed as equals.

## Tokens

All tokens are CSS custom properties on `:root`; dark values are in `@media (prefers-color-scheme: dark)`. Colours (light / dark):

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | #F6F4EE | #111318 | page background |
| `--sheet` | #FDFCF8 | #181B22 | cards, tables, fields, dialogs |
| `--well` | #EFECE4 | #0D0F13 | table heads, insets, disabled controls |
| `--hover` | #F1EEE6 | #1E222A | row and button hover |
| `--ink` | #161A22 | #F3EFE6 | headings, primary buttons, tag bar (light) |
| `--on-ink` | #F6F4EE | #111318 | text on ink |
| `--text` | #262A33 | #DAD6CD | body text |
| `--muted` | #565B66 | #A5A8B0 | secondary text |
| `--placeholder` | #6B6F78 | #8E929A | placeholder text |
| `--rule` | #E3DED3 | #262A32 | hairlines |
| `--rule-strong` | #CFC9BB | #3A3F4B | table heads, dividers |
| `--control` | #85806F | #727886 | borders of fields, buttons, checkboxes (3:1) |
| `--accent` | #2F3D99 | #AEB8F5 | focus ring, links, restored values only |
| `--accent-soft` | #E8EAF6 | #1F2445 | tips, OCR chips, restored wash |
| `--accent-line` | #BCC2E6 | #3E4888 | accent borders |
| `--ok` | #2B6B3F | #8FCEA0 | done, stays on this computer |
| `--ok-soft` | #E3EEE2 | #14271B | done background |
| `--ok-line` | #B1CFB4 | #2F5539 | done border |
| `--warn` | #7F4C00 | #EDC47A | needs you (to do, read this) |
| `--warn-soft` | #F8ECD3 | #2A2112 | to do background |
| `--warn-line` | #E0BE80 | #664C22 | to do border |
| `--bad` | #A3291F | #F4A596 | blocked, failed, stop |
| `--bad-soft` | #F7E2DD | #301B18 | blocked background |
| `--bad-line` | #E3B1A8 | #6B372F | blocked border |
| `--danger-fill` | #A3291F | #F4A596 | the one red button (Yes, show it) |
| `--on-danger` | #FFFFFF | #2A0F0B | text on the red button |
| `--highlight` | #F3DD9C | #54431A | the word to decide in a quotation |
| `--highlight-line` | #B98716 | #D6B055 | its underline |
| `--tag-bg` | #161A22 | #E9E4D8 | tag bar |
| `--tag-fg` | #F4F1E9 | #14171D | tag label |
| `--tag-dim` | #9EA3AF | #565A64 | braces and endings on a tag |
| `--restored` | #E6E9F7 | #20264A | put-back values in a restored draft |
| `--restored-line` | #7F8BD0 | #5F6BBB | their underline |
| `--focus` | #2F3D99 | #AEB8F5 | focus ring |

Type: `--font-serif` Newsreader, `--font-sans` Instrument Sans, `--font-mono` IBM Plex Mono. Scale: display 42, h1 30, h2 20, h3 15.5, body 15, small 13.5, micro 12.5 (nothing smaller; the stamp is 12). Space: 4, 8, 12, 16, 24, 32, 48, 64. Radii: 3, 6, 10, 14 (buttons 8). Gutter 32 (24 below 1000px). Fallback stacks cover Microsoft YaHei and PingFang SC (Chinese), Nirmala UI and Tamil MN (Tamil), Segoe UI and Geeza Pro (Jawi/Arabic).

## Components (do and don't)

| Component | Classes | Do | Don't |
|---|---|---|---|
| Buttons | `.btn`, `.primary`, `.small`, `.quiet`, `.danger`, `.danger-fill`, `.link` | One `.primary` per view. Put a lock icon and the reason beside a locked button. | Don't use red except for "Yes, show it". Don't dim a locked button without a reason. |
| Fields | `.field`, `input`, `select`, `textarea`, `.check`, `.hint`, `.pair` | A visible label for each field. Borders are 3:1. | Don't use placeholders as labels (the add-a-word bar hides its label only below 1000px, and keeps `aria-label`). |
| Cards | `.card`, `.card.slim`, `.card.bare` | Hairline, small radius. | Don't put a card in a card. |
| Chips | `.chip` + `cloaked`/`pass`, `manual`/`todo`, `partial`/`unreadable`/`fail`, `ocr`, `container`, `group`, `kind` | The shape comes from CSS (tick, filled triangle, filled square, eye, box). | Don't invent new colours for states. |
| Stamps | `.stamp` + `pass`/`warn`/`fail`/`plain`, `.sm`, `.lg` | For a verdict on a file or a check, and the matter level. | Don't use for counts. |
| Tags | `.tag` (+ `.b` for dim parts), `.tag.off` | Keep the text in the DOM. 12.5px minimum. | Don't wrap tags in extra colour. |
| Marks | `mark`, `.found`, `.restored`, `.flagged`, `.nonlatin` | Yellow = decide, red wavy = double-check finding, blue = put back, amber wavy = flagged. | Don't mix them in one sentence unless the screen is Restore. |
| Tabs | `.tabs`, `.tab` (`.todo`, `.done`), `.n` | Amber count = to do; tick = done. | Don't hide a to-do count. |
| Tables | `table`, `td.num`, `td.act`, `tr.sub`, `.reason` | Names wrap (`overflow-wrap:anywhere`). Counts are tabular. | Don't truncate a file or company name in a cell. |
| Decision rows | `.decide`, `.decide-row`, `.seg`, `.seg-label`, `.fine` | "Hide as" label, three actions that hide, then a separate "It's fine". | Don't use unlabelled or unbordered segments. |
| Finish bar | `.finish` + `is-blocked`/`is-ready`/`is-done`/`is-exported`, `.many`, `.finish-lead`, `.blockers .blocker`, `.leaves` | Blockers are buttons. Show what leaves. | Don't grow past one line at 860px. |
| Stepper | `.stepper` | Mark done, current and counts. | Don't collapse to bare numbers. |
| Dialogs | `.overlay`, `.dialog`, `.narrow-dialog`, `.dialog-steps`, `.ledger`, `.callout`, `.consequences`, `.more`, `.typed` | Cancel first and focused. Put "It will leave this computer" in a callout. Safe action large; risky action behind a disclosure and a typed word. Set `main.inert` while open. | Don't give "Yes" the focus. |
| Messages | `.msg` + `ok`/`warn`/`bad`/`info` | Plain words, then what to do. | Don't show a code. |
| Progress | `progress`, `.spinner`, `.bigcount`, `.progress-table` | Set bar width with `value`/`max`, not `style`. | Don't use inline styles (the CSP blocks them). |
| Recovery code | `.code`, `.code-meta`, `.print-sheet-head` | Large mono, dashed border, print view in black on white. | |
| Double check | `.dc-stats`, `.dc-layout`, `.dc-files`, `.finding`, `.place`, `.receipt`, `.show-real` | Group by word; show part and line; record who and when; offer Undo. | Don't give "It is fine" a single-key shortcut without Undo. |
| Chronology | `#chrono-table`, `.chrono-bar`, `.confirm-card` | Chips for same event, conflict, no year, not understood, range. | |
| Restore | `.matter-strip`, `.verdict`, `.restore-grid`, `.docpage`, `.checks`, `.check-card`, `.issues` | Verdict in words first, then counts, then the draft with paragraph numbers beside the issues. | Don't present the verdict as a toggle. |
| Home | `.home-grid`, `.specimen`, `.choices .choice`, `.flow`, `.try-sample`, `.signed` | Explain the product, then the two actions, then the privacy facts. | |

## Mapping from current classes

| app.js class | Now | Change |
|---|---|---|
| `.bar`, `.brand`, `.mark`, `.by`, `.bar-right`, `.version`, `.licence-bar`, `.bar-link` | same | Restyled. New: `.bar-matter`, `.offline`, `.bar-sep`. |
| `main`, `.foot` | same | `main` scrolls; `.foot` is hidden below 700px height. |
| `.narrow`, `.wide`, `.home` | same | `.wide.has-finish` when a sticky bar is last. |
| `.card`, `.card.white` | same | `.white` is now identical to `.card`. |
| `.btn`, `.primary`, `.small`, `.danger`, `.danger-fill`, `.link` | same | Rectangular 8px, not pills. |
| `.chip` (`cloaked`, `manual`, `partial`, `unreadable`, `ocr`, `container`) | same | Same names; adds shape. New: `pass`, `fail`, `todo`, `group`, `kind`. |
| `.tag` | same | Inner `.b` spans (markup change, see below). |
| `.tabs`, `.tab`, `.tab.todo`, `.n` | same | Underlined tabs, not pills. Add `.done`. |
| `.finish`, `#finish-note` | same | Add a state class and the new children. |
| `.msg` (`warn`, `bad`, `ok`) | same | Icon drawn in CSS. |
| `.overlay`, `.dialog`, `.narrow-dialog`, `.help`, `.help-head`, `.more` | same | |
| `.choices`, `.choice`, `.try-sample`, `.tip`, `.sample-note`, `.help-links` | same | `.choice` gains child spans. |
| `.code`, `.print-only`, `.no-print` | same | |
| `.addbar`, `.field`, `.row`, `.path`, `.check`, `.muted`, `.small`, `.num`, `.reason`, `.example`, `.found`, `select.merge`, `tr.sub`, `pre.filetext`, `.spinner` | same | |
| `.steps` | same | Still the numbered list in Help. The new step bar is `.stepper`. |

## Markup changes needed (by app.js function)

Inline `style=` attributes are blocked by the CSP today, so they already do nothing. Replace them: line 84 `.signed`; 380, 707 `.mt-3`/`.mt-2`; 471 `.typed input`; 551 `.mb-3`; 555 `.mt-2`; 558, 746 `.mt-4`.

- **index.html**: add `font-src 'self'` to the CSP; add the SVG sprite; add a skip link; wrap `#matter-name` in `.bar-matter` with a `.stamp.sm.plain` level and a `.chip.kind` "Test documents"; give `#licence-bar` a `<span class="lead-in">Licensed to</span> <b>firm</b>`; add a Help `.bar-link` and the `.offline` pill; `.foot` gets a lock icon and, when a matter is open, "Matter key open, locked to NAME since TIME". Add `<main id="main">`.
- **`tags()`**: output `<span class="tag"><span class="b">{{</span>PERSON_1<span class="b">.FIRST</span><span class="b">}}</span></span>` (split the code at the first dot).
- **`confirmDialog`**: add an optional `step` (1 or 2) to draw `.dialog-steps`; allow a `leaves: true` option to draw the `.callout.leaves-callout`; add a `.ledger` in the body for Stop hiding (tag, real value, places). Keep Cancel first and focused. Set `main.inert = true` while open.
- **`home` and `homeExtras`**: use the structure in `home.html` (`.home-grid`, `.specimen`, `.choice` with `.eyebrow`, `b`, `.desc`, `.go`; `.flow`; `.signed`; `.try-sample .ico`).
- **`nameScreen`**: put the field in a `.card`.
- **`setup`**: `.wide.has-finish`; `.pagehead` with `<h1>` and `ol.stepper`; cards 1 and 2 in `.setup-grid`, card 3 below; `h2` gets `<span class="step-no">`; intro paragraphs get `class="sub"`; move "Where is this folder?" into `details.more`; replace the button row with `.startbar` (blocker chips for what is missing; Start has a lock icon when disabled).
- **`matterForm`**: name and level in `.pair`; shorten the level options to "Strict (recommended)" and "Standard" with a hint line; the two passwords in `.pair`; errors use `.msg.bad` and mark the field `.invalid` with `aria-invalid`.
- **`recoveryCode`**: `dl.code-meta` for matter and created; add `.print-sheet-head`.
- **`drawProgress` and `runCloak`**: `.pagehead` with stepper; `.bigcount`; a `<progress>`; `table.progress-table`; `tr.is-active` for rows still reading.
- **`review`**: `.wide.has-finish`; `.pagehead` with stepper (Review shows "N to decide") and a `.meta` line; the add bar inside `.card.slim` with a visible `<label>`; tabs get `done` when their count is 0 and they were to-do; the finish bar gets a state class.
- **`finishBar`**: needs structured blockers from the engine (`{count, label, tab}`); draw `.finish-lead`, `.blockers` of `button.blocker` (full sentence in `aria-label`, click opens the tab), `.leaves` ("On export / N files leave / N held back"), then `.row` with buttons. Add `many` when there are three or more blockers. State classes: `is-blocked`, `is-ready`, `is-done`, `is-exported`.
- **`panelUnsure`**: replace the table with `.decide` (see `review-unsure.html`); each row has `.what` (word, optional `.chip.kind`, `.example`, `.meta`) and `.actions` (`.seg-label`, `.seg` of three buttons, `.fine`). Optional: row keyboard shortcuts (arrows, P, C, O, F) and an Undo toast (`.toast`) after any quick decision.
- **`panelJoined`**: group card markup as in `review-joined.html`; mark action cells `td.act`.
- **`panelTerms`**: mark action cells `td.act`, tag cell `nowrap`; add `<span class="chip manual">Asks twice</span>` when `patternRule`.
- **`panelFacts`**: mark action cells `td.act`.
- **`panelFiles`**: add `.tablebar` with a search field and `.filters`; result and read cells `nowrap`.
- **`viewFile`**: `.dialog.viewer`; `.viewer-head` with the name, status chip and optional previous/next buttons; wrap non-Latin runs in `<mark class="nonlatin">`; the typed-APPROVE block as `details.more[open]` containing `.typed`.
- **`panelChronology` and `drawChronology`**: `.chrono-bar` rows; give cells the classes `date`, `event`, `people`, `source`; `tr.is-conflict`, `tr.is-selected`; the conflict note as `<div class="conflict">`; the confirm card as `.card.confirm-card`; an empty state with `.empty`.
- **`panelCheck` and `drawCheck`**: `.dc-stats`, then `.dc-layout` with `.dc-files` (needs the file list with pass/fail and counts) and `.finding` articles grouped by value, each with `.place` rows and a `.receipt` when decided; add the `.show-real` notice. Undo on a decision needs a new engine action; the Undo link is a proposal.
- **`restoreScreen` and `restoreResultHtml`**: `.matter-strip`, `.verdict` (headline sentence, three figures), `.restore-grid` with `.docpage` and `.checks`. The restored text needs put-back values and paragraph breaks from the engine so it can be drawn as `.para` with `.restored` spans and `is-flagged`.
- **`sampleScreen`, `sampleCreated`, `licenceScreen`, `helpScreen`**: step numbers in `.step-no`, `.pair` for the two passwords, `dl.code-meta` for licence facts, `.tabs.in-dialog` in help.
- **Empty and error states**: use `.empty` (icon, h2, one sentence, optional button) and `.msg`.

Proposals that go beyond the current app (the owner may decline): the export sheet (`dialog-export.html`), Undo on decisions, keyboard shortcuts, `.show-real` notice, previous/next in the file viewer, the "Real text / As exported" toggle on the chronology (not drawn), the skip link.

## Accessibility notes

Contrast, measured from the token values (script: parse `style.css`, WCAG relative luminance):

| Pair | Light | Dark |
|---|---|---|
| Body text on paper | 13.1:1 | 12.8:1 |
| Body text on a card | 14.0:1 | 11.9:1 |
| Headings (ink) on paper | 15.8:1 | 16.2:1 |
| Secondary text on paper | 6.2:1 | 7.8:1 |
| Secondary text on a card | 6.6:1 | 7.2:1 |
| Secondary text on a table head | 5.8:1 | 8.1:1 |
| Placeholder on a field | 4.9:1 | 5.5:1 |
| Primary button label | 15.8:1 | 16.2:1 |
| Link on paper | 8.5:1 | 9.7:1 |
| Link on a card | 9.1:1 | 9.0:1 |
| Field and button borders (3:1) | 3.8:1 | 3.9:1 |
| Focus ring on paper (3:1) | 8.5:1 | 9.7:1 |
| Done: label on its tint | 5.4:1 | 8.6:1 |
| To do: label on its tint | 6.1:1 | 9.6:1 |
| Blocked: label on its tint | 5.8:1 | 8.2:1 |
| Tag label on the tag bar | 15.4:1 | 14.1:1 |
| Tag braces on the tag bar | 6.9:1 | 5.4:1 |
| Word to decide (ink on highlight) | 13.0:1 | 8.3:1 |
| Red button label | 7.3:1 | 9.1:1 |
| Body text on a warning message | 12.3:1 | 10.9:1 |

- Every control has a visible 2px focus ring in the signature blue (8.5:1 or better), offset 2px, never the colour of the control. A skip link is provided.
- Real `<button>`, `<label>`, `<fieldset>`-style groups (`role="group"` with `aria-labelledby` on "Hide as"), `role="tablist"` and `aria-selected`, `aria-current="step"`, `role="alertdialog"` with the page behind `inert`.
- Colour is never the only signal: chips and stamps carry a shape and a word; locked buttons carry a lock and a reason; unreadable dates carry a chip.
- `@media (forced-colors: active)` gives borders and highlights system colours. `@media (prefers-reduced-motion: reduce)` stops the spinner (a static ring remains) and all transitions.
- Minimum text size 12.5px (stamp 12px). Mono is limited to tags, paths and codes; counts use tabular sans.
- Not verified: Windows ClearType rendering (all shots are Chromium on Linux), Microsoft YaHei, Nirmala UI and Segoe UI for Jawi (shots use WenQuanYi, FreeSans and DejaVu stand-ins), a screen-reader pass, and the print stylesheet on a physical printer. A script check of every text element on the real screens, as Vault did, should be added in the implementation phase.

## Fonts and licences

| Font | Use | Licence |
|---|---|---|
| Newsreader (variable, normal and italic, latin and latin-ext), npm `@fontsource-variable/newsreader` | Serif | SIL OFL 1.1, `fonts/LICENSE-Newsreader-OFL.txt` |
| Instrument Sans (variable, latin and latin-ext), npm `@fontsource-variable/instrument-sans` | Sans | SIL OFL 1.1, `fonts/LICENSE-InstrumentSans-OFL.txt` |
| IBM Plex Mono (400 and 500, latin and latin-ext), npm `@fontsource/ibm-plex-mono` | Mono | SIL OFL 1.1, `fonts/LICENSE-IBMPlexMono-OFL.txt` |

The faces are declared as "Cloak Serif", "Cloak Sans" and "Cloak Mono" so an installed font with the same name is never picked up by mistake. The files were taken from the Chambers exploration (fetched from the npm registry); total 558 KB. Instrument Sans has no italic; none is used. Add the three licences to `THIRD-PARTY-NOTICES.txt`.

## How the judges' points were handled

- Setup too long: the folder-sync selector folds into a disclosure, cards 1 and 2 sit side by side, step 3 is visible at 1180x820 with the Start bar showing what is missing.
- Home too empty, clever but unhelpful headline: the headline says the product, the specimen shows it, the sample matter is a normal card, and the stays/leaves band states the privacy promise.
- Rail and file navigation: no left rail (it costs width and needs new JS). Files has search and status filters; Double check has a file list with fail first; the viewer has previous/next.
- Narrow window: three or more review rows above a one-line finish bar at 860x600; the stepper stays labelled; tab counts that are not to-do are hidden below 1000px.
- Trust: the leaves/stays grammar, a callout in the Stop-hiding dialog, a red button only for the second ask, locked buttons with reasons, Undo, and "recorded as NAME, TIME" on every decision.
- Not done: Joined names, Hidden facts and Files rely on the shared table system; the chronology "As exported" toggle is not drawn; Restore with a "Failed" verdict is not drawn.
