# Sehari Dalam Hidup — a day in the life of a Malaysian litigator

A four-episode motion-graphics series, built as a [HyperFrames](https://hyperframes.heygen.com) project. Every frame is plain HTML and CSS animated with GSAP, so an episode can be edited in a text editor or in the HyperFrames Studio and rendered again.

The whole day is told as entries stamped into one court file: a timestamp, a headline, a few lines of detail, and a red stamp. Pages turn with a vertical push. Bahasa Malaysia is the voice of the file; English appears where a Malaysian litigator would use it.

| Episode | Title | Length | Pages |
|---|---|---|---|
| — | Title card | 5 s | Siri · 4 episod |
| 1 | Pagi | 24 s | 06:10 alarm and e-Review · 06:40 mamak · 07:30 DUKE to Jalan Duta · 08:30 robing at Kompleks Mahkamah KL · 08:50 the cause list |
| 2 | Mahkamah | 26 s | 09:00 court sits · 09:05 waiting your turn · 10:42 Order 14 submissions · 11:15 decision reserved · 11:40 case management before the Deputy Registrar |
| 3 | Chambers | 24 s | 14:05 the inbox · 14:30 new client, names cloaked before drafting · 15:40 afternoon rain and written submissions · 17:15 affidavit affirmed · 18:20 e-Filing |
| 4 | Malam | 24 s | 19:30 home with files · 21:00 authorities · 22:30 timesheet · 22:45 tomorrow's list · 23:10 lights out |
| — | End card | 6 s | Esok, sekali lagi |

The full cut runs 109 seconds at 1920×1080. There is no audio track yet: the renders are silent by design, so a music bed or narration can be added later without re-timing anything.

## Files

```
index.html                 full series: title → ep1 → ep2 → ep3 → ep4 → end
episodes/episode-N.html    one episode on its own (same sub-composition, no cards)
compositions/title.html    title card
compositions/epN.html      one episode: five "pages" inside one sub-composition
compositions/end.html      end card
vendor/gsap.min.js         GSAP 3.14.2, vendored so renders need no network
renders/                   MP4 output (not committed)
```

Each episode file is self-contained: its styles, markup and timeline all live inside the `<template>`, as HyperFrames requires for sub-compositions. The host `index.html` only lays the episodes out in time and owns the push between them.

## Preview, check, render

Needs Node 20+ and FFmpeg. The first run downloads a headless Chrome (about 115 MB).

```bash
cd video/ditl-malaysian-litigator
npm run dev                      # Studio preview with a scrubbable timeline
npm run check                    # lint + runtime + layout + contrast gate
npm run render                   # renders/index.mp4, the full series

# one episode on its own
npx hyperframes@0.8.137 render -c episodes/episode-2.html -o renders/episode-2.mp4

# a portrait cut for Reels / TikTok needs a layout pass first; the preset flag alone
# only changes the output size
npx hyperframes@0.8.137 render --resolution portrait
```

On a machine without a GPU add `--no-browser-gpu` to `render`, `check` and `snapshot`.

## Editing an episode

Open `compositions/ep1.html`. Each page is a `<section class="ph">` with:

- `.ts` the big timestamp (split into characters and whipped in),
- `.lab` the small caption under it,
- `.stamp` the red stamp,
- `.col` the right column: `.hl` headline, `.rule`, a `.det` list, and an optional extra (progress bar, counter, cloak table, e-filing steps).

Timing is computed in the script at the bottom of the file from the root `data-duration`: pages are evenly spaced, each page's entrance starts half a second after its push lands. To add a page, add a section and a matching `entry("epN-pK", t0)` block, and lengthen the episode's `data-duration` both in the composition and in the host files that mount it.

Keep these rules or `npm run check` will fail:

- one paused GSAP timeline per file, registered on `window.__timelines["<id>"]`;
- no `Math.random()`, `Date.now()` or network fetches in a composition;
- only the bundled fonts (Oswald, IBM Plex Mono) unless you add an `@font-face`;
- headline words are separated with `<wbr>` plus a margin rather than spaces, because the renderer drops the last inter-word space between inline-block spans.

## Where Cloak appears

Episode 3, page 2: the paralegal types the facts with real names, and the file shows them replaced by Cloak's codes (`{{PLAINTIFF_1}}`, `{{DEFENDANT_1}}`, `{{MY_IC_1}}`) before the first draft of the Writ Saman and Pernyataan Tuntutan comes back. Episode 3, page 1, mentions the email assistant's morning count of drafts ready and drafts waiting for a check. The end card carries a one-line credit.
