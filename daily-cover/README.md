# Daily Court Update cover

Brand-matched cover for the Lawgistics Daily Court Update: cream background,
sentence-case serif headline, navy underline on the key phrase, `Lawgistics.`
top left and `lawgistics.my` bottom right.

## Make today's cover

1. Copy yesterday's file in `days/` and rename it to today's date, e.g.
   `days/2026-10-08.json`.
2. Edit the fields:

   | field | what it is | example |
   | --- | --- | --- |
   | `date` | publication date, `YYYY-MM-DD` | `2026-10-08` |
   | `headline` | the hook; wrap the key phrase in `[[ ]]` to underline it | `Asked for more time? [[You can still arbitrate.]]` |
   | `court` | court and seat | `High Court · Kuala Lumpur` |
   | `case` | case name, in italics on the cover | `Universiti Malaya v Esa Jurutera Perunding Sdn Bhd` |
   | `citation` | optional: citation, or a one-line outcome | `[2026] 5 MLRA 1 · 14 May 2026` |
   | `issue` | optional: issue number, bottom left | `No. 03` |

3. Run:

   ```bash
   node make-cover.mjs days/2026-10-08.json
   ```

Three PNGs land in `out/`:

- `<date>-reel-1080x1920.png` for a Reel or Story cover
- `<date>-feed-1080x1350.png` for an Instagram or LinkedIn feed post
- `<date>-square-1080x1080.png` for a square post

## Notes

- Headlines step down in size automatically as they get longer. Under about
  85 characters reads best.
- The key phrase always starts on a new line, so the underline never dangles.
- The weekday and month are worked out from `date`.
- Everything sits inside the profile-grid crop, so the Reel cover still reads as
  a 3:4 tile on the grid.
