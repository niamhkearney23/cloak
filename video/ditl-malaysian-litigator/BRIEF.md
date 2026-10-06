---
workflow: general-video
flow: automation
storyboard: no
format: landscape 1920x1080, 30 fps
duration: 109 s full cut; 24–26 s per episode
audio: English narration (Kokoro, bm_george), synthesized ambient bed ducked under the voice, foley cut to the animation
---

# Brief

A day-in-the-life series about a Malaysian litigator, four episodes plus a title and end card, for the Cloak Drafting project.

## Concept

The day is a court file. Every scene is an entry stamped into it: a timestamp, a headline in the litigator's own clipped voice, a few lines of detail, a red stamp. Pages turn with a vertical push. The chrome (file number tab, punch holes, page counter, episode label) stays fixed so the cut between episodes reads as the same file continuing.

## Design

- Palette: manila paper `#ebe2cf`, ink `#1f1a14`, soft ink `#5e564a`, stamp red `#b5282e`. One accent hue.
- Type: Oswald 700 for headlines and stamps (public notice), IBM Plex Mono for timestamps and detail (the typewritten record). Both are bundled by the HyperFrames compiler.
- Decoration: ghost word per episode (Pagi, Mahkamah, Chambers, Malam) drifting behind the content, paper grain, a breathing foot rule.

## Motion

- Timestamps and headlines arrive with a waterfall entry (binary reveal, whip from below, overlapping by a frame).
- Detail lines slide in from the left with a short stagger. Stamps slam in at scale 1.8 → 1 with `power4.in`.
- Page turns are a vertical push, outgoing and incoming at the same instant.
- Scene-specific extras: a drive progress bar, a cause-list tick row, a count-up of matters called, a count-up of chargeable hours, a cloak table where names morph into codes, an e-Filing status stepper, deterministic rain.

## Sound

- Narration: one short English line per page in a measured British male voice (Kokoro `bm_george`, speed 1.05), starting 0.55 s into each page. The file on screen speaks Bahasa Malaysia; the voice translates and comments.
- Bed: A-minor pad (Am add9, Fmaj7, C add9, G), sub bass, a heartbeat pulse every two seconds and a faint clock tick every second. Ducked 7 dB under the voice.
- Foley: key presses on the timestamp characters, soft clicks on headline words, a bass thud when each stamp lands, a whoosh on every page turn and episode seam, rain under the 15:40 page, pops as names are cloaked, a ping when e-Filing is accepted, counter ticks under the two count-ups.

## Content notes

Court terms are the ones used in Kuala Lumpur practice: Kompleks Mahkamah Kuala Lumpur at Jalan Duta, Dewan 5, Yang Arif, Lampiran (enclosure) numbers, Aturan 14 of the Kaedah-Kaedah Mahkamah 2012, Timbalan Pendaftar case management, Pesuruhjaya Sumpah affirmations, e-Kehakiman e-Filing. The two authorities cited for Order 14 are real: *Bank Negara Malaysia v Mohd Ismail* [1992] 1 MLJ 400 and *National Company for Foreign Trade v Kayu Raya Sdn Bhd* [1984] 2 MLJ 300. The case number, parties and people are invented.
