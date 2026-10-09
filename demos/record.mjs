// Records the three concept demos as screen recordings for the portfolio video.
//
// Each demo is driven through the exact flow in the video brief, with a visible
// cursor that moves smoothly, and saved as a 1600x900 clip:
//
//   demos/recordings/1-legal-dashboard.webm   (open a matter, view deadlines, assign a task)
//   demos/recordings/2-marketing-automation.webm (a new enquiry triggers the follow-up workflow)
//   demos/recordings/3-booking-site.webm      (choose a service, pick a time, confirmation)
//
// plus a still of each demo (demos/recordings/*.png) for thumbnails.
// If a full ffmpeg is on your PATH (or FFMPEG points at one), an .mp4 copy of
// each clip is written as well, which most video editors prefer over WebM.
//
// Setup (once):   npm install --no-save playwright && npx playwright install chromium
// Record:         node demos/record.mjs
// Watch it run:   HEADED=1 node demos/record.mjs
//
// The script opens the demo pages from disk, so nothing else needs to be running.

import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  try { return require('playwright'); } catch {}
  try { return require(path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')); } catch {}
  console.error('Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}
const { chromium } = loadPlaywright();

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'recordings');
const SIZE = { width: 1600, height: 900 };
const HEADED = !!process.env.HEADED;
const TYPE_DELAY = 55;

// A fake cursor drawn on the page, because screen recordings from a headless
// browser don't include the real one.
const CURSOR = `
  const c = document.createElement('div');
  c.id = '__cursor';
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:30px;z-index:2147483647;pointer-events:none;transition:transform .08s;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))';
  c.innerHTML = '<svg viewBox="0 0 22 30" width="22" height="30"><path d="M2 2l16 13-7 1 4 9-3 1.5-4-9-6 5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const attach = () => document.body ? document.body.appendChild(c) : requestAnimationFrame(attach);
  attach();
  window.addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
  window.addEventListener('mousedown', () => { c.style.transform += ' scale(.85)'; }, true);
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mouse = { x: 800, y: 450 };

async function moveTo(page, selector, { dx = 0, dy = 0, ms = 650 } = {}) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible' });
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  const x = box.x + box.width / 2 + dx, y = box.y + box.height / 2 + dy;
  const steps = Math.max(12, Math.round(ms / 16));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
}
async function click(page, selector, opts = {}) {
  await moveTo(page, selector, opts);
  await sleep(opts.pause ?? 350);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
}
async function type(page, selector, text) {
  await click(page, selector);
  await sleep(200);
  await page.keyboard.type(text, { delay: TYPE_DELAY });
}

const FLOWS = {
  '1-legal-dashboard': async (page) => {
    await page.goto('file://' + path.join(ROOT, 'legal-dashboard', 'index.html'));
    await page.mouse.move(mouse.x, mouse.y);
    await sleep(1800);                                     // let the viewer read the overview
    await moveTo(page, 'tbody tr:nth-child(1) .matter-name', { ms: 900 });
    await sleep(500);
    await click(page, 'tbody tr:nth-child(1) .matter-name');  // open a matter
    await sleep(1600);
    await moveTo(page, '#deadlines li:nth-child(1)', { ms: 700 }); // look at the deadlines
    await sleep(700);
    await moveTo(page, '#deadlines li:nth-child(3)', { ms: 700 });
    await sleep(900);
    await click(page, '#btn-assign');                      // assign a task
    await sleep(500);
    await type(page, '#t-title', 'Prepare exhibits for the Defence');
    await sleep(300);
    await click(page, '#t-who');
    await page.selectOption('#t-who', { index: 1 });       // Daniel Koh
    await page.keyboard.press('Escape');
    await sleep(400);
    await click(page, '#assign button[type=submit]');
    await sleep(2600);                                     // toast + new task row
  },

  '2-marketing-automation': async (page) => {
    await page.goto('file://' + path.join(ROOT, 'marketing-automation', 'index.html'));
    await page.mouse.move(mouse.x, mouse.y);
    await sleep(1800);
    await type(page, '#f-name', 'Aisha Rahman');
    await type(page, '#f-email', 'aisha@example.com');
    await click(page, '#f-interest');
    await page.selectOption('#f-interest', { index: 1 }); // Full home interior
    await page.keyboard.press('Escape');
    await sleep(400);
    await click(page, '#form button[type=submit]');       // the enquiry enters
    await sleep(900);
    await moveTo(page, '[data-step="2"]', { ms: 1200 });  // follow the workflow down
    await sleep(2200);
    await moveTo(page, '[data-step="4"]', { ms: 1200 });
    await sleep(2200);
    await moveTo(page, '#log li:nth-child(1)', { ms: 900 });
    await sleep(2200);
  },

  '3-booking-site': async (page) => {
    await page.goto('file://' + path.join(ROOT, 'booking-site', 'index.html'));
    await page.mouse.move(mouse.x, mouse.y);
    await sleep(1800);                                    // hero
    await moveTo(page, '.hero .cta .btn', { ms: 700 });
    await sleep(300);
    await click(page, '.hero .cta .btn');                 // Book a treatment
    await sleep(1200);
    await click(page, '.choice[data-id="aroma"]');        // choose a service
    await sleep(600);
    await click(page, '#to-2');
    await sleep(900);
    await click(page, '.day[data-i="1"]');                // pick a day
    await sleep(700);
    await click(page, '.slot[data-t="14:30"]');           // pick a time
    await sleep(600);
    await click(page, '#to-3');
    await sleep(800);
    await type(page, '#d-name', 'Nadia Hussain');
    await type(page, '#d-phone', '012-345 6789');
    await type(page, '#d-email', 'nadia@example.com');
    await sleep(300);
    await click(page, '#to-4');                           // confirmation screen
    await sleep(2800);
  },
};

async function record(name, flow) {
  const browser = await chromium.launch({ headless: !HEADED });
  const tmp = path.join(OUT, '.tmp-' + name);
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: tmp, size: SIZE }, reducedMotion: 'no-preference' });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  mouse = { x: 800, y: 450 };
  await flow(page);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  await context.close();
  await browser.close();
  const [file] = await readdir(tmp);
  const webm = path.join(OUT, name + '.webm');
  await rename(path.join(tmp, file), webm);
  await rm(tmp, { recursive: true, force: true });
  return webm;
}

// A full ffmpeg (with H.264) from FFMPEG or PATH. The cut-down copy Playwright
// installs for itself can only write WebM, so it is not used here.
function findFfmpeg() {
  for (const bin of [process.env.FFMPEG, 'ffmpeg'].filter(Boolean)) {
    const r = spawnSync(bin, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
    if (r.status === 0 && /libx264/.test(r.stdout)) return bin;
  }
  return null;
}
const FFMPEG = findFfmpeg();

function toMp4(webm) {
  if (!FFMPEG) return null;
  const mp4 = webm.replace(/\.webm$/, '.mp4');
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  return r.status === 0 ? mp4 : null;
}

await mkdir(OUT, { recursive: true });
const only = process.argv[2];
for (const [name, flow] of Object.entries(FLOWS)) {
  if (only && !name.includes(only)) continue;
  process.stdout.write(`Recording ${name}… `);
  const webm = await record(name, flow);
  const mp4 = toMp4(webm);
  console.log(path.relative(process.cwd(), mp4 || webm) + (mp4 ? '' : '  (install ffmpeg for an .mp4 copy)'));
}
