// Critic: token contrast matrix for both themes. Lists every pair under 4.5:1 (text) or 3:1 (UI/large).
const fs = require('fs'), path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const hex = /--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g;
const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1];
const darkIdx = css.indexOf('prefers-color-scheme: dark');
const darkBlock = css.slice(darkIdx, css.indexOf('\n  }', darkIdx));
const grab = (s) => { const o = {}; for (const m of s.matchAll(hex)) o[m[1]] = m[2]; return o; };
const L = grab(rootBlock), D = { ...L, ...grab(darkBlock) };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const surfaces = ['paper', 'sheet', 'well', 'hover', 'accent-soft', 'ok-soft', 'warn-soft', 'bad-soft', 'restored', 'highlight'];
const textTok = ['text', 'ink', 'muted', 'placeholder', 'accent', 'ok', 'warn', 'bad'];
const pairs = [];
for (const t of textTok) for (const s of surfaces) pairs.push([`${t} text on ${s}`, t, s, 4.5, 'matrix']);
pairs.push(
  ['primary button label', 'on-ink', 'ink', 4.5], ['danger-fill button label', 'on-danger', 'danger-fill', 4.5],
  ['danger outline button (bad on sheet)', 'bad', 'sheet', 4.5], ['danger outline hover (bad on bad-soft)', 'bad', 'bad-soft', 4.5],
  ['secondary button hover (text on hover)', 'text', 'hover', 4.5], ['quiet button (muted on paper)', 'muted', 'paper', 4.5],
  ['disabled button (muted on well)', 'muted', 'well', 4.5],
  ['tag label on tag bar', 'tag-fg', 'tag-bg', 4.5], ['tag braces/endings on tag bar', 'tag-dim', 'tag-bg', 4.5],
  ['tag.off (muted on paper)', 'muted', 'paper', 4.5], ['tag.off (muted on sheet)', 'muted', 'sheet', 4.5],
  ['chip ok', 'ok', 'ok-soft', 4.5], ['chip warn', 'warn', 'warn-soft', 4.5], ['chip bad', 'bad', 'bad-soft', 4.5], ['chip ocr/info', 'accent', 'accent-soft', 4.5],
  ['link on restored', 'accent', 'restored', 4.5],
  ['focus ring on paper', 'focus', 'paper', 3], ['focus ring on sheet', 'focus', 'sheet', 3], ['focus ring on well', 'focus', 'well', 3], ['focus ring on ink (adjacent to primary)', 'focus', 'ink', 3], ['focus ring on hover', 'focus', 'hover', 3],
  ['control border on paper', 'control', 'paper', 3], ['control border on sheet', 'control', 'sheet', 3], ['control border on well', 'control', 'well', 3], ['control border on hover', 'control', 'hover', 3],
  ['highlight underline on highlight', 'highlight-line', 'highlight', 3], ['highlight underline on sheet', 'highlight-line', 'sheet', 3],
  ['restored underline on restored', 'restored-line', 'restored', 3], ['restored underline on sheet', 'restored-line', 'sheet', 3],
  ['icon ok on ok-soft (non-text)', 'ok', 'ok-soft', 3], ['icon bad on bad-soft', 'bad', 'bad-soft', 3], ['icon warn on warn-soft', 'warn', 'warn-soft', 3],
  ['rule-strong on paper (decorative, informational)', 'rule-strong', 'paper', 3], ['ok-line on ok-soft', 'ok-line', 'ok-soft', 3], ['warn-line on warn-soft', 'warn-line', 'warn-soft', 3], ['bad-line on bad-soft', 'bad-line', 'bad-soft', 3], ['accent-line on accent-soft', 'accent-line', 'accent-soft', 3],
);
const missing = new Set();
for (const [name, T] of [['light', L], ['dark', D]]) {
  console.log('== ' + name);
  let n = 0;
  for (const [label, f, b, min, kind] of pairs) {
    if (!T[f] || !T[b]) { missing.add(f + '/' + b); continue; }
    const r = cr(T[f], T[b]);
    if (r < min) { n++; console.log(`UNDER ${r.toFixed(2)} (min ${min}) ${kind ? '[matrix] ' : ''}${label}  ${T[f]} on ${T[b]}`); }
  }
  console.log(`${name}: ${n} pairs under threshold of ${pairs.length}`);
}
if (missing.size) console.log('tokens not found:', [...missing].join(', '));
