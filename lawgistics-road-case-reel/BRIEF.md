# LAWGISTICS High Court Update № 02 — the 58-year road (Instagram Reels cut)

## Intent
Instagram Reels cut (1080×1920, 9:16) of the LinkedIn video in `../lawgistics-road-case`.
Same narration, screens and cut times; the layout keeps content inside the Reels safe zone
(clear of the top ~220px and bottom ~400px the Reels interface covers), with larger prints
and type for the taller frame. It tells the story of a Kuala Lumpur High Court land case:
a public road laid across private land in 1968, no acquisition paperwork, registered title
upheld 58 years later, RM4.8m damages.

## Style
**Editorial Grain** (same system as the Instagram reel), extended with real photographs:
- Warm paper #efe8dc, animated SVG film grain at 12%
- Instrument Serif headlines (upright + italic), Inter labels, ink #1a1a1a, navy accent #1e3559
  (the CSS variable is still called `--red` for parity with the Instagram reel)
- Photos pasted on as prints: paper mat, thin border, slight tilt, figure caption, slow push-in
- Red / ink cut-out paper blocks behind key words; thin rules; page numbers
- One hand-drawn site plan (SVG) for the 736.44 m² strip; a two-thirds share bar for damages
- Unhurried, uneven stagger, gentle slides and wipes, no bounces

## Photos
Real photographs from the Open Images dataset (Flickr, CC BY 2.0), pre-treated to a muted
print look in `assets/photos/`. Credits appear on the closing screen.

| file | subject | author |
| --- | --- | --- |
| road-1968.jpg | two-lane road | Jorge Figueroa |
| duke-highway.jpg | DUKE highway traffic, Kuala Lumpur | Ahmad Adlan |
| kl-skyline.jpg | Kuala Lumpur, Hang Tuah | Joshua Eckert |
| letters.jpg | old letters | Fort George G. Meade Public Affairs Office |
| car-jaguar.jpg | car on a road, Malaysia | Jason Thien |

## Voiceover
Kokoro TTS, voice `bm_george`, speed 1.1, one line per screen (`audio/voiceover.mp3`, 79s).
"Ringgit" and "Kuala Lumpur" are passed as phonemes so they get Malaysian pronunciations
(hard g in ringgit, "LOOM-poor") instead of the engine's anglicised defaults.

## Output
`renders/lawgistics-road-case-reel.mp4` (1080×1920, 30 fps, H.264, 83s)
