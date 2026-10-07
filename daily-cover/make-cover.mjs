#!/usr/bin/env node
// Daily Court Update cover generator.
//
//   node make-cover.mjs days/2026-10-07.json
//
// Writes out/<date>-reel-1080x1920.png, out/<date>-feed-1080x1350.png
// and out/<date>-square-1080x1080.png. See README.md for the JSON fields.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, copyFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dayFile = process.argv[2];
if (!dayFile) {
  console.error("usage: node make-cover.mjs days/<date>.json");
  process.exit(1);
}
const day = JSON.parse(readFileSync(resolve(dayFile), "utf8"));
for (const k of ["date", "headline", "court", "case"]) {
  if (!day[k]) throw new Error(`missing "${k}" in ${dayFile}`);
}

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Headline: the phrase between [[ and ]] gets the navy underline and always starts
// on its own line, so the underline never dangles off the end of the line above.
const hlText = day.headline.replace(/\[\[|\]\]/g, "");
const m = day.headline.match(/^(.*?)\[\[(.+?)\]\](.*)$/s);
const headlineHtml = m
  ? (m[1].trim() ? `<span class="line">${esc(m[1].trim())}</span>` : "") +
    `<span class="line"><span class="ul">${esc(m[2])}</span>${esc(m[3])}</span>`
  : esc(day.headline);
// Size steps down for longer headlines so it always fits in about four lines.
const n = hlText.length;
const hlSize = n <= 40 ? 112 : n <= 60 ? 96 : n <= 85 ? 84 : 72;

const d = new Date(day.date + "T12:00:00Z");
if (Number.isNaN(d.getTime())) throw new Error(`bad date "${day.date}" (use YYYY-MM-DD)`);
const fmt = (o) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(d);

// Formats: name, width, height, safe-band top/bottom (px from each edge).
const FORMATS = [
  { name: "reel-1080x1920", W: 1080, H: 1920, TOP: 300, BOTTOM: 300 },
  { name: "feed-1080x1350", W: 1080, H: 1350, TOP: 110, BOTTOM: 110 },
  { name: "square-1080x1080", W: 1080, H: 1080, TOP: 80, BOTTOM: 80, square: true },
];

const template = readFileSync(join(here, "template.html"), "utf8");
mkdirSync(join(here, "out"), { recursive: true });

for (const f of FORMATS) {
  const build = join(here, "build", f.name);
  rmSync(build, { recursive: true, force: true });
  mkdirSync(build, { recursive: true });
  cpSync(join(here, "fonts"), join(build, "fonts"), { recursive: true });
  cpSync(join(here, "vendor"), join(build, "vendor"), { recursive: true });
  copyFileSync(join(here, "hyperframes.json"), join(build, "hyperframes.json"));
  writeFileSync(join(build, "meta.json"), JSON.stringify({ id: `daily-cover-${f.name}`, name: "Daily Court Update cover" }));

  // The square has less room: shrink the headline one step.
  const size = f.square ? Math.round(hlSize * 0.86) : hlSize;
  const vals = {
    W: f.W,
    H: f.H,
    TOP: f.TOP,
    BOTTOM: f.BOTTOM,
    HL_SIZE: size,
    DAY: fmt({ day: "numeric" }),
    MONTH_YEAR: fmt({ month: "long", year: "numeric" }),
    WEEKDAY: fmt({ weekday: "long" }),
    HEADLINE_HTML: headlineHtml,
    COURT: esc(day.court),
    CASE: esc(day.case),
    CITATION: esc(day.citation ?? ""),
    ISSUE: esc(day.issue ?? ""),
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vals)) throw new Error(`template field {{${k}}} has no value`);
    return String(vals[k]);
  });
  writeFileSync(join(build, "index.html"), html);

  const snaps = join(build, "snapshots");
  execFileSync("npx", ["--yes", "hyperframes@0.8.137", "snapshot", build, "--at", "0.5", "--no-end", "-o", snaps], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const png = readdirSync(snaps).find((x) => x.startsWith("frame-") && x.endsWith(".png"));
  if (!png) throw new Error(`no frame captured for ${f.name}`);
  const out = join(here, "out", `${day.date}-${f.name}.png`);
  copyFileSync(join(snaps, png), out);
  console.log("wrote", out);
}
