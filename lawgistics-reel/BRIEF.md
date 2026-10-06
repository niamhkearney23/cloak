# LAWGISTICS Court Update Reel

## Intent
30-second vertical Instagram Reel (1080×1920) explaining a Malaysian Federal Court decision on arbitration rights. Editorial Grain aesthetic: warm paper magazine spread.

## Style
**Editorial Grain**
- Warm paper background #efe8dc with animated film grain (12% opacity)
- Fonts: Instrument Serif (headlines, mix upright/italic), Inter (labels, caps, letter-spaced)
- Colors: ink black #1a1a1a, deep red accent #c2412d
- Design: cut-out paper rectangles behind key words, slight rotation (1–3°), thin rules, page numbers
- Motion: unhurried, staggered (not perfectly even), gentle slides/wipes, no bounces

## Content
- Header: LAWGISTICS / COURT UPDATE
- 11 text screens following voiceover rhythm
- Case citation footer with court details
- Closing: LAWGISTICS branding

## Voiceover
Generated locally with Kokoro TTS (voice `bm_george`, British male, speed 1.08), one line per
on-screen screen, short pauses between ideas. Story-style rewrite of the original script:

> Picture this. You signed a contract with an arbitration clause. Then a court summons lands on
> your desk. So you ask for more time to file your defence. But... did that one request just cost
> you your right to arbitrate? Not automatically. In Universiti Malaya against Esa Jurutera
> Perunding, the Federal Court said: asking for more time did not mean giving up arbitration. The
> court looked at the conduct as a whole. The takeaway? Check your arbitration clause early. Your
> next move matters.

File: `audio/voiceover.mp3` (36.0s). Screen cuts in `index.html` follow the line starts.

## Workflow
`/general-video` — custom composition with text animation, voiceover sync, editorial design.

## Output
`renders/lawgistics-reel.mp4` (vertical, 1080×1920, 30fps, H.264)
