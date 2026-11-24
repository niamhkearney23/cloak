# Cloak design system (final)

Base: "Chambers" (highest combined score, 31.5), with ideas grafted from Vault, Instrument and Nocturne, and every weakness the judges raised fixed. Open `index.html` to see all 61 screens and states (48 at the first review, 13 added in the second round). Screenshots: `shots/` (1180x820, light and dark, plus a `narrow-*` pair at 860x600 for every screen) and `shots-2x/` (2360x1640, light and dark, 11 key screens). Regenerate with `node checks/shoot.cjs`.

Files: `style.css` (the only stylesheet; drop-in candidate for `local/app/app.css`), `fonts/` (14 woff2 files and five OFL licences, 738 KB in all), one HTML page per screen, `docs.css` (index page only), `checks/` (contrast.cjs, audit.cjs, shoot.cjs, fonts.cjs, probe.cjs; they are `.cjs` because the repository's package.json sets type module).

## Five principles

1. **Two voices.** The client's words (excerpts, chronology events, the restored draft, file text, the matter name) are set in a serif (Newsreader). The tool's own words, figures, controls and headings (h2, h3, dialog titles) are set in a sans (Instrument Sans). Mono is used only for tags, paths and codes. One deliberate exception: Cloak's own display titles at 24px and above (the page title, the home headline, the two big choices) are serif too. They are set large and are never running text, so below 24px a serif line is always the client's. Figures are never set in a display serif.
2. **Hidden reads as hidden.** A tag is a redaction bar: an ink bar with the label printed on it (a paper bar in dark mode), braces and endings dimmer. A put-back value is the opposite: a quiet blue underline. Copying a tag copies the exact `{{PERSON_1.FIRST}}`.
3. **One colour, one meaning.** Ink does the work. Amber means it needs you. Green means done, or stays on this computer. Red means blocked, failed or stop. Blue is only focus, links and put-back values. What will leave the computer is never a colour: it is a dashed rule and an arrow-out icon, in the same grammar everywhere (finish bar, in every size, dialogs, home, export sheet). Colour is never the only signal: every state has a shape and a word.
4. **Say what happens next.** The finish bar always names what is left (blockers are buttons that jump to the work), what will leave ("On export: 212 files leave, 2 held back"), and why a button is locked (a lock icon and a reason, never just dimming). Every decision is recorded under a name and a time, and says so.
5. **Compact, calm, exact.** One column, one sticky bar at the foot, hairlines, small radii, no card inside a card, no gradients or glows. At 860x600 the finish bar is one line (54px at most) and the list keeps three full rows above it (see Compact windows below for the screens that keep two). Nothing the reader must read is clipped with an ellipsis. Both themes are designed as equals.

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
| `--highlight-line` | #9A6F0C | #D6B055 | its underline (4.1:1 on paper in light) |
| `--tag-bg` | #161A22 | #E9E4D8 | tag bar |
| `--tag-fg` | #F4F1E9 | #14171D | tag label |
| `--tag-dim` | #9EA3AF | #565A64 | braces and endings on a tag |
| `--restored` | #E6E9F7 | #20264A | put-back values in a restored draft |
| `--restored-line` | #5B68B8 | #7480D0 | their underline: the only mark that tells a put-back value from the client's own words (4.2:1 light, 4.0:1 dark on the restored wash) |
| `--focus` | #2F3D99 | #AEB8F5 | focus ring |

Type: `--font-serif` Newsreader, `--font-sans` Instrument Sans, `--font-mono` IBM Plex Mono. Scale: display 42, h1 30, h2 20 (sans), h3 15.5, body 15, small 13.5, micro 12.5. Nothing is smaller than 12px (stamps, step numbers, counts and key hints are 12; the audit script reports anything below). Space: 4, 8, 12, 16, 24, 32, 48, 64. Radii: 3, 6, 10, 14 (buttons 8). Gutter 32 (24 below 1000px). Tamil and Jawi are bundled (see Fonts). Chinese uses fallbacks: Microsoft YaHei and PingFang SC. The stacks also keep Nirmala UI, Tamil MN, Segoe UI and Geeza Pro behind the bundled faces. `:lang(ta)`, `:lang(ms-Arab)` and `:lang(zh)` rules exist; the app should set `lang` on non-Latin runs (`dialog-viewer-scripts.html` shows how).

## Components (do and don't)

| Component | Classes | Do | Don't |
|---|---|---|---|
| Buttons | `.btn`, `.primary`, `.small`, `.quiet`, `.danger`, `.danger-fill`, `.link` | One `.primary` per view. Put a lock icon and the reason beside a locked button. | Don't use red except for "Yes, show it". Don't dim a locked button without a reason. |
| Fields | `.field`, `input`, `select`, `textarea`, `.check`, `.hint`, `.pair` | A visible label for each field, including the licence text box. Borders are 3:1. A placeholder may show an example of the format, never the label. | Don't use placeholders as labels (the add-a-word bar hides its label only below 1000px, and keeps `aria-label`). |
| Cards | `.card`, `.card.slim`, `.card.bare` | Hairline, small radius. | Don't put a card in a card. |
| Chips | `.chip` + `cloaked`/`pass`, `manual`/`todo`, `partial`/`unreadable`/`fail`, `ocr`, `container`, `group`, `kind` | The shape comes from CSS (tick, filled triangle, filled square, eye, box). | Don't invent new colours for states. |
| Stamps | `.stamp` + `pass`/`warn`/`fail`/`plain`, `.sm`, `.lg` | For a verdict on a file or a check, and the matter level. | Don't use for counts. |
| Tags | `.tag` (+ `.b` for dim parts), `.tag.off` | Keep the text in the DOM. 12.5px minimum. | Don't wrap tags in extra colour. |
| Marks | `mark`, `.found`, `.restored`, `.flagged`, `.nonlatin` | Yellow = decide, red wavy = double-check finding, blue = put back, amber wavy = flagged. | Don't mix them in one sentence unless the screen is Restore. |
| Tabs | `.tabs`, `.tab` (`.todo`, `.done`), `.n`, `.t-full`/`.t-short` | Amber count = to do; tick = done. Below 900px "Everything replaced" reads "Replaced" and "Hidden facts" reads "Facts", so all seven tabs fit at 860px. If a tab row still overflows it scrolls, with a soft edge on the side that has more. | Don't hide a to-do count. |
| Tables | `table`, `td.num`, `td.act`, `tr.sub`, `.reason`, `.files-table`, `.joined-table`, `#chrono-table` | Names wrap (`overflow-wrap:anywhere`). Counts are tabular. Below 900px or 700px high, the Files, Joined names and Chronology tables become short cards (a row of two or three lines) instead of squeezed columns. | Don't truncate a file, company or draft name, a place or an excerpt with an ellipsis, anywhere (cells, the Not sure rows, the matter strip). |
| Decision rows | `.decide`, `.decide-row`, `.seg`, `.seg-label`, `.fine` | "Hide as" label, three actions that hide, then a separate "It's fine". | Don't use unlabelled or unbordered segments. |
| Finish bar | `.finish` + `is-blocked`/`is-ready`/`is-done`/`is-exported`, `.many`, `.finish-lead`, `.blockers .blocker`, `.blocker.more`, `.leaves`, `.long`, `.c-full`/`.c-short` | Blockers are buttons. Show what leaves, with the arrow-out icon. At 860px wide or 700px high it is one line of 54px at most, by the collapse order in Compact windows. | Don't let it wrap to a second line, and don't hide the first blocker, the lock or the primary button. |
| Stepper | `.stepper` | Mark done, current and counts. | Don't collapse to bare numbers. |
| Dialogs | `.overlay`, `.dialog`, `.narrow-dialog`, `.dialog-steps`, `.ledger`, `.callout`, `.consequences`, `.more`, `.typed` | Cancel first and focused. Put "It will leave this computer" in a callout. Safe action large; risky action behind a disclosure and a typed word. Set `main.inert` while open. | Don't give "Yes" the focus. |
| Messages | `.msg` + `ok`/`warn`/`bad`/`info` | Plain words, then what to do. | Don't show a code. |
| Progress | `progress`, `.spinner`, `.bigcount`, `.progress-table` | Set bar width with `value`/`max`, not `style`. | Don't use inline styles (the CSP blocks them). |
| Recovery code | `.code`, `.code-meta`, `.print-sheet-head` | Large mono, dashed border, print view in black on white. | |
| Double check | `.dc-stats`, `.dc-layout`, `.dc-files`, `.finding`, `.place`, `.receipt`, `.show-real` | Group by word; show part and line; record who and when; offer Undo. | Don't give "It is fine" a single-key shortcut without Undo. |
| Chronology | `#chrono-table`, `.chrono-bar`, `.confirm-card` | Chips for same event, conflict, no year, not understood, range. | |
| Restore | `.matter-strip`, `.verdict`, `.restore-grid`, `.docpage`, `.checks`, `.check-card`, `.issues` | Verdict in words first, then counts, then the draft with paragraph numbers beside the issues. | Don't present the verdict as a toggle. |
| Home | `.home-grid`, `.specimen`, `.choices .choice`, `.flow`, `.try-sample`, `.signed` | Explain the product, then the two actions, then the privacy facts. At 700px high or less the lead is dropped, the specimen is tightened and the two choices sit side by side, so both buttons show without scrolling at 860x600. | |
| Licence in the bar | `#licence-bar`, `.licence-bar.is-eval`, `.is-ending` | Licensed: the firm, plain. Ending within 30 days: the firm plus an amber triangle chip "Ends in N days". Evaluation copy: a dashed pill with a flask and the words "Evaluation copy" (it exports test matters only). Word and shape, never colour alone. | Don't leave the slot empty. |
| Self-test | `table.self-test`, `.chip` Passed/Failed/Not run | A chip and one plain sentence per check. | Don't show codes. |
| Placeholder list | `.stublist` | List files that are only placeholders, up to six, then "and N more". | |

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

**Required app.js change (blocking).** `app.js` writes 9 inline `style=` attributes. The app CSP is `style-src 'self'`, so Chromium drops them today and the layout shifts (the `#typed` field loses its 200px width). Replace every one with a class that `style.css` defines (all exist; this folder does not touch `local/`):

| app.js line | Remove | Use instead |
|---|---|---|
| 84 (home, signed in as) | `style="margin-top:26px"` on the `<p class="small muted">` | `<p class="signed">` (it sets the 24px top margin, the small muted text and the gap) |
| 380 (Confirm all in this group) | `style="margin-top:8px"` | `class="row mt-2"` |
| 471 (`#typed` APPROVE field) | `style="max-width:200px"` | add `class="w-sm"` to the input |
| 551 (chronology buttons) | `style="margin-bottom:10px"` | `class="row mb-3"` |
| 555 (possible-conflict chip) | `style="margin-top:4px"` | `class="chip partial mt-2"` |
| 558 (chronology Confirm card) | `style="margin-top:14px"` | `class="card mt-4"` |
| 645 (Each file heading) | `style="margin-top:18px"` | `<h2 class="mt-4">` |
| 707 (Check and restore row) | `style="margin-top:12px"` | `class="row mt-3"` |
| 746 (restore check headings) | `style="margin-top:14px;font-size:15px"` | `<h2 class="mt-4 h-minor">` |

Spacing steps differ from the old numbers by at most 4px (8, 10, 12, 14, 18 become 8, 12, 12, 16, 16) so that every gap is a token. After the change `grep -c 'style=' app.js` must print 0. Utilities kept for this purpose: `mt-0, mt-2..mt-5, mb-0, mb-3, w-sm, h-minor, ink, nowrap`.

- **index.html**: add `font-src 'self'` to the CSP (required, blocking: `local/app/index.html` line 5 has no `font-src`, and with `default-src 'none'` every bundled font is blocked and the window falls back to system fonts until that one word is added. The line must read `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:`. This folder does not touch `local/`, so it is left to the implementation phase); add the SVG sprite; add a skip link; wrap `#matter-name` in `.bar-matter` with a `.stamp.sm.plain` level and a `.chip.kind` "Test documents"; give `#licence-bar` a `<span class="lead-in">Licensed to</span> <b>firm</b>` when licensed, add `.is-ending` and a `.chip.manual` "Ends in N days" when `daysLeft <= 30`, and `.is-eval` with the text "Evaluation copy" when unlicensed (no empty `<b>`); add a Help `.bar-link` and the `.offline` pill; `.foot` gets a lock icon and, when a matter is open, "Matter key open, locked to NAME since TIME". Add `<main id="main">`.
- **`tags()`**: output `<span class="tag"><span class="b">{{</span>PERSON_1<span class="b">.FIRST</span><span class="b">}}</span></span>` (split the code at the first dot).
- **`confirmDialog`**: add an optional `step` (1 or 2) to draw `.dialog-steps`; allow a `leaves: true` option to draw the `.callout.leaves-callout`; add a `.ledger` in the body for Stop hiding (tag, real value, places). Keep Cancel first and focused. Set `main.inert = true` while open.
- **`home` and `homeExtras`**: use the structure in `home.html` (`.home-grid`, `.specimen`, `.choice` with `.eyebrow`, `b`, `.desc`, `.go`; `.flow`; `.signed`; `.try-sample .ico`).
- **`nameScreen`**: put the field in a `.card`.
- **`setup`**: `.wide.has-finish`; `.pagehead` with `<h1>` and `ol.stepper`; all three cards inside `.setup-grid` (the CSS places card 3 under cards 1 and 2, or under card 1 beside a tall card 2 in a short window); `h2` gets `<span class="step-no">`; intro paragraphs get `class="sub"`; move "Where is this folder?" into `details.more`; replace the button row with `.startbar` (blocker chips for what is missing; Start has a lock icon when disabled).
- **`matterForm`**: name and level in `.pair`; shorten the level options to "Strict (recommended)" and "Standard" with a hint line; the two passwords in `.pair`; errors use `.msg.bad` and mark the field `.invalid` with `aria-invalid`.
- **`recoveryCode`**: `dl.code-meta` for matter and created; add `.print-sheet-head`.
- **`drawProgress` and `runCloak`**: `.pagehead` with stepper; `.bigcount`; a `<progress>`; `table.progress-table`; `tr.is-active` for rows still reading.
- **`review`**: `.wide.has-finish`; `.pagehead` with stepper (Review shows "N to decide") and a `.meta` line; the add bar inside `.card.slim` with a visible `<label>`; tabs get `done` when their count is 0 and they were to-do; the finish bar gets a state class.
- **`finishBar`**: needs structured blockers from the engine (`{count, label, tab}`); draw `.finish-lead`, `.blockers` of `button.blocker` (full sentence in `aria-label`, click opens the tab), followed when there are two or more by `button.blocker.more` ("+N more", it opens the first blocker; the compact bar shows only the first blocker and this button), `.leaves` ("On export / N files leave / N held back"; the arrow-out icon is drawn by CSS), then `.row` with buttons. Put `.long` on the explanatory sentence and wrap long button labels as `<span class="c-full">Export the chronology only (recommended)</span><span class="c-short">Chronology only</span>`. Add `many` when there are three or more blockers. State classes: `is-blocked`, `is-ready`, `is-done`, `is-exported`.
- **`panelUnsure`**: replace the table with `.decide` (see `review-unsure.html`); the engine must cut each excerpt to a window around the highlighted word (about 110 characters, with real "…" characters at the cut ends): CSS never clamps it. Each row has `.what` (word, optional `.chip.kind`, `.example`, `.meta` with the full place text and the "and N more" button) and `.actions` (`.seg-label`, `.seg` of three buttons, `.fine`). Optional: row keyboard shortcuts (arrows, P, C, O, F) and an Undo toast (`.toast`) after any quick decision.
- **`panelJoined`**: group card markup as in `review-joined.html` (`.group-card`, `.gc-sub`, `.panel-intro`); table class `joined-table`, the reason cell `td.why`, action cells `td.act`.
- **`panelTerms`**: mark action cells `td.act`, tag cell `nowrap`; add `<span class="chip manual">Asks twice</span>` when `patternRule`.
- **`panelFacts`**: mark action cells `td.act`.
- **`panelFiles`**: add `.tablebar` with a search field and `.filters`; table class `files-table`; the result cell `td.res`, the read cell `td.read` with one `span.rd` per fact (pages, characters, OCR pages); a block or manual-check reason goes under the file name as `span.reason`.
- **`viewFile`**: `.dialog.viewer`; `.viewer-head` with the name, status chip and optional previous/next buttons; wrap non-Latin runs in `<mark class="nonlatin">`; the typed-APPROVE block as `details.more[open]` containing `.typed`.
- **`panelChronology` and `drawChronology`**: `.chrono-bar` rows; the missing-events warning is `details` (headline in the `summary`, the file list inside, a "Show the N files" link in the summary); give cells the classes `date`, `event`, `people` (one `span.pn` per person), `source`; `tr.is-conflict`, `tr.is-selected`; the conflict note as `<div class="conflict">`; the confirm card as `.card.confirm-card`; an empty state with `.empty`.
- **`panelCheck` and `drawCheck`**: `.dc-stats`, then `.dc-layout` with `.dc-files` (needs the file list with pass/fail and counts) and `.finding` articles grouped by value, each with `.place` rows and a `.receipt` when decided; add the `.show-real` notice. Undo on a decision needs a new engine action; the Undo link is a proposal.
- **`restoreScreen` and `restoreResultHtml`**: `.matter-strip`, `.verdict` (headline sentence, three figures), `.restore-grid` with `.docpage` and `.checks`. The restored text needs put-back values and paragraph breaks from the engine so it can be drawn as `.para` with `.restored` spans and `is-flagged`.
- **`sampleScreen`, `sampleCreated`, `licenceScreen`, `helpScreen`**: step numbers in `.step-no`, `.pair` for the two passwords, `dl.code-meta` for licence facts, `.tabs.in-dialog` in help.
- **Empty and error states**: use `.empty` (icon, h2, one sentence, optional button) and `.msg`.

Proposals that go beyond the current app (the owner may decline): the export sheet (`dialog-export.html`), Undo on decisions, keyboard shortcuts, `.show-real` notice, previous/next in the file viewer, the "Real text / As exported" toggle on the chronology (not drawn), the skip link.

## Compact windows (860px wide, or 700px high or less)

One rule set, written once at the end of `style.css` and in the 700px-high block. What changes, in the order it collapses:

1. **Finish bar** (one line, 54px at most): the explanatory sentence (`.long`) goes first; then the labels on "what leaves" (the arrow-out icon and "N files leave" stay); then every blocker after the first becomes one "+N more" button; then button labels shorten (`.c-short`). The lock, the first blocker and the primary button never go. A button that is locked keeps its lock and the bar's lead says why.
2. **Page head**: the meta line goes; the add-a-word card loses its frame.
3. **Lists**: Not sure rows put the word and the three actions on one line, with the excerpt and the place across the full width, nothing clipped. The Files, Joined names and Chronology tables become short cards. Double check shows its four counts as one strip.
4. **Explanations**: panel intros, the chip key on Chronology, the "differ only in punctuation" sentence and the Double check intro are hidden (every chip still names itself). The "events are missing" warning folds to its headline and a "Show the N files" link.
5. **Home and setup**: the home lead is dropped and both buttons sit side by side above the fold; setup keeps card 3 beside a tall card 2, so step 3 shows in the first screen.

Measured at 860x600 (a probe counting rows that sit wholly above the bar): the bar is 51px or 54px on every screen, and `checks/audit.cjs` finds no clipped text. Full rows above the bar: four on Joined names (the group card is not counted), Files, the reviewed and exported states and Double check (its file list); three on Not sure, Not sure after an undo, Everything replaced, Hidden facts and Double check passed; two on Chronology, the blocked files and the Not sure sample page, because each row there carries a sentence that must be read whole (an event, a reason) or the page carries a note (the sample banner). On those the third row is partly visible and the list scrolls under the bar. The empty and ready states have no rows by nature.

Modal pages (`.narrow`: your name, licence) have a plain `h1` and no stepper on purpose: they are not steps in a matter, and they open from the home screen and return to it.

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
| Restored underline on the restored wash (non-text, 3:1) | 4.2:1 | 4.0:1 |
| Highlight underline on paper (non-text, 3:1) | 4.1:1 | 9.0:1 |
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
- Minimum text size 12px (running text 12.5px and up). `checks/audit.cjs` reports any text element below 12px, and any element whose text is clipped or past the window edge, on every screen at 860x600 in both themes; at this version it reports none, and no text pair on any screen is below 4.5:1 (disabled controls excluded). Mono is limited to tags, paths and codes; counts use tabular sans.
- Non-text pairs under 3:1, on purpose: the state borders (ok, warn and bad lines on their tints, 1.4 to 2.0:1) because every chip also carries a word and a shape; hairline rules; and the focus ring measured against an ink button face (1.7 to 1.9:1), because the ring is drawn 2px outside the button, against the page (8.5:1 or better).
- Not verified: Windows ClearType rendering (all shots are Chromium on Linux), Microsoft YaHei, Nirmala UI and Segoe UI for Jawi (shots use WenQuanYi, FreeSans and DejaVu stand-ins), a screen-reader pass, and the print stylesheet on a physical printer. A script check of every text element on the real screens, as Vault did, should be added in the implementation phase.

## Fonts and licences

| Font | Use | Licence |
|---|---|---|
| Newsreader (variable, normal and italic, latin and latin-ext), npm `@fontsource-variable/newsreader` | Serif | SIL OFL 1.1, `fonts/LICENSE-Newsreader-OFL.txt` |
| Instrument Sans (variable, latin and latin-ext), npm `@fontsource-variable/instrument-sans` | Sans | SIL OFL 1.1, `fonts/LICENSE-InstrumentSans-OFL.txt` |
| IBM Plex Mono (400, 500 and 600, latin and latin-ext), npm `@fontsource/ibm-plex-mono` | Mono | SIL OFL 1.1, `fonts/LICENSE-IBMPlexMono-OFL.txt` |
| Noto Sans Tamil (variable, Tamil block only), npm `@fontsource-variable/noto-sans-tamil`, declared as "Cloak Tamil" at 92% size | Tamil text and file names | SIL OFL 1.1, `fonts/LICENSE-NotoSansTamil-OFL.txt` |
| Noto Naskh Arabic (variable, Arabic block only), npm `@fontsource-variable/noto-naskh-arabic`, declared as "Cloak Jawi" | Jawi and Arabic text | SIL OFL 1.1, `fonts/LICENSE-NotoNaskhArabic-OFL.txt` |

The faces are declared as "Cloak Serif", "Cloak Sans", "Cloak Mono", "Cloak Tamil" and "Cloak Jawi" so an installed font with the same name is never picked up by mistake. All files came from the npm registry (second round: Tamil, Jawi and Plex Mono 600); total 738 KB with the licences. Tamil and Jawi are listed right after the Latin face in every stack and restricted by `unicode-range`, so they are used only for those scripts and their letters (including the Jawi letters ڠ ݢ ڤ ۏ ڽ) never depend on Segoe UI. Plex Mono now has a real 600, so bold mono is no longer synthesized. Instrument Sans has no italic; none is used. Add the five licences to `THIRD-PARTY-NOTICES.txt`.

Not bundled, and why: **Chinese**. Decision recorded: a Simplified Chinese face is several megabytes even as a subset (the npm packages are split into over a hundred slices) and the subset cannot be chosen without knowing which characters appear in files, so Chinese keeps the system fallbacks, in the sans stack (`:lang(zh)` now uses `--font-sans`, so Chinese is not a sans face inside a serif context). Microsoft YaHei ships with every supported Windows and PingFang SC with every Mac, so tofu is expected only on a stripped-down install. Revisit if a client reports it. Original note: Chinese keeps the system fallbacks (Microsoft YaHei on Windows, PingFang SC on macOS). Nothing proprietary ships either way. Tamil and Jawi rendering was checked here with the bundled faces (`dialog-viewer-scripts.html`); Windows 10 and 11 were not available, so the CJK fallback on Windows is still unverified.

## How the judges' points were handled

- Setup too long: the folder-sync selector folds into a disclosure, cards 1 and 2 sit side by side, step 3 is visible at 1180x820 and, in a short window, beside card 2 at 860x600, with the Start bar showing what is missing.
- Home too empty, clever but unhelpful headline: the headline says the product, the specimen shows it, the sample matter is a normal card, and the stays/leaves band states the privacy promise.
- Rail and file navigation: no left rail (it costs width and needs new JS). Files has search and status filters; Double check has a file list with fail first; the viewer has previous/next.
- Narrow window: a one-line finish bar and three rows (or two plus the start of a third, see Compact windows) at 860x600; the stepper stays labelled; tab counts that are not to-do are hidden below 1000px.
- Trust: the leaves/stays grammar, a callout in the Stop-hiding dialog, a red button only for the second ask, locked buttons with reasons, Undo, and "recorded as NAME, TIME" on every decision.
- Second round: the compact rule, no clipped text, the evaluation bar, and the states that were missing (support-file result, placeholder files, poor scans and almost empty pages, restore Failed and wrong matter, four confirm dialogs, licence ending and ended, a file with Jawi, Tamil and Chinese).
- Not done: the chronology "As exported" toggle is not drawn; Windows rendering is unverified; Chinese is not bundled (decision above). At 860x600 the add-a-word bar is not collapsed (review tabs show about 2.5 rows; accepted).
- Third round: focus ring no longer changes a control's radius; the finish bar's full-width colour line is a border-image (it no longer makes `main` report twice its width); the Jawi band in the file viewer is tighter; unused classes were removed from `style.css` (`.dialog-actions`, `.note-ok`, `.more-places`, `.is-pass`, `.label-row`, `.reason-line`, `.hl`, `.quote`, `.bar-matter-name`, `.right`, `.mb-4`, `.w-md`, `.gap-2`, `.truncate`, `.break`, `.page-end`).

## Wording that is proposed, not taken from the app

The app source has the words for: Delete this row, Finish with this draft, Go to the home screen, Remove the licence, the support-file result and self-test chips, the evaluation copy text, the placeholder (stub) warning, and the poor-scan and almost-empty reasons. These are new and need the owner's approval: the Failed restore note ("Do not send this draft yet", "A check failed. You can still copy or save the draft"), the wrong-matter verdict ("This draft does not match this matter's key"), the licence-ending banner ("This licence ends in 18 days..."), "The licence ended on ...", the placeholder list shown as an in-app dialog (the app uses a native message box today, with the buttons "Download and include them" and "Leave them out"), the buttons "Download and read", "Read again" and "Why?" on the blocked files, the Self-test names ("Tamil OCR language data"), and the count lines on Delete, Go home and Finish. Every example name, company and amount is made up.

## Language attributes (app.js change, recommended)

`:lang(ta)`, `:lang(ms-Arab)` and `:lang(zh)` rules (line height for Jawi, serif Tamil in quotes) only apply when text carries a `lang` attribute, and `app.js` sets none. Fonts are still chosen correctly without it because Tamil and Jawi are bundled with `unicode-range`. To get the line-height and sizing rules too, wrap excerpts, file names and viewer text that contain those scripts in `<span lang="ta">`, `<span lang="ms-Arab" dir="rtl">` or `<span lang="zh-Hans">`; the engine can choose by the first strong character (U+0B80-0BFF Tamil, U+0600-06FF Jawi, U+4E00-9FFF Chinese). Not required for the drop-in.

## Focus ring contrast

Non-text lines that are decoration only (chip borders, `--rule-strong` hairlines) are below 3:1 by design: the information is also carried by text and icons. The focus ring has a 2px offset, so it sits on the page and not on an ink button, and passes there.
