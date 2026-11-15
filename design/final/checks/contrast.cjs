// Token-pair contrast for style.css, both themes.
const fs = require('fs');
const css = fs.readFileSync(__dirname + '/../style.css', 'utf8');
const rootM = css.match(/:root\s*\{([\s\S]*?)\n\}/);
const darkM = css.match(/prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n  \}/);
const parse = (b) => { const o = {}; for (const m of b.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) o[m[1]] = m[2]; return o; };
const light = parse(rootM[1]); const dark = { ...light, ...parse(darkM[1]) };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const pairs = [
  // [label, fg, bg, min]
  ['text on paper', 'text', 'paper', 4.5], ['text on sheet', 'text', 'sheet', 4.5], ['text on well', 'text', 'well', 4.5], ['text on hover', 'text', 'hover', 4.5],
  ['ink on paper', 'ink', 'paper', 4.5], ['ink on sheet', 'ink', 'sheet', 4.5],
  ['muted on paper', 'muted', 'paper', 4.5], ['muted on sheet', 'muted', 'sheet', 4.5], ['muted on well', 'muted', 'well', 4.5], ['muted on hover', 'muted', 'hover', 4.5],
  ['muted on accent-soft', 'muted', 'accent-soft', 4.5], ['muted on warn-soft', 'muted', 'warn-soft', 4.5], ['muted on ok-soft', 'muted', 'ok-soft', 4.5], ['muted on bad-soft', 'muted', 'bad-soft', 4.5],
  ['placeholder on sheet', 'placeholder', 'sheet', 4.5], ['placeholder on paper', 'placeholder', 'paper', 4.5],
  ['link on paper', 'accent', 'paper', 4.5], ['link on sheet', 'accent', 'sheet', 4.5], ['link on well', 'accent', 'well', 4.5], ['link on hover', 'accent', 'hover', 4.5], ['link on accent-soft', 'accent', 'accent-soft', 4.5],
  ['chip ok', 'ok', 'ok-soft', 4.5], ['chip warn', 'warn', 'warn-soft', 4.5], ['chip bad', 'bad', 'bad-soft', 4.5], ['chip info/ocr (accent on accent-soft)', 'accent', 'accent-soft', 4.5],
  ['ok on paper', 'ok', 'paper', 4.5], ['ok on sheet', 'ok', 'sheet', 4.5], ['warn on paper', 'warn', 'paper', 4.5], ['warn on sheet', 'warn', 'sheet', 4.5], ['bad on paper', 'bad', 'paper', 4.5], ['bad on sheet', 'bad', 'sheet', 4.5],
  ['warn on well', 'warn', 'well', 4.5], ['bad on well', 'bad', 'well', 4.5], ['ok on well', 'ok', 'well', 4.5],
  ['text on warn-soft', 'text', 'warn-soft', 4.5], ['text on ok-soft', 'text', 'ok-soft', 4.5], ['text on bad-soft', 'text', 'bad-soft', 4.5], ['text on accent-soft', 'text', 'accent-soft', 4.5],
  ['tag label on tag bar', 'tag-fg', 'tag-bg', 4.5], ['tag braces on tag bar', 'tag-dim', 'tag-bg', 4.5],
  ['primary button (on-ink on ink)', 'on-ink', 'ink', 4.5], ['danger button', 'on-danger', 'danger-fill', 4.5],
  ['secondary button (text on sheet)', 'text', 'sheet', 4.5], ['secondary button hover (text on hover)', 'text', 'hover', 4.5],
  ['text on highlight', 'ink', 'highlight', 4.5], ['text on restored', 'ink', 'restored', 4.5], ['text on restored (text)', 'text', 'restored', 4.5], ['link on restored', 'accent', 'restored', 4.5],
  ['disabled button label (muted on well)', 'muted', 'well', 4.5],
  // UI / large (3:1)
  ['focus ring on paper', 'focus', 'paper', 3], ['focus ring on sheet', 'focus', 'sheet', 3], ['focus ring on well', 'focus', 'well', 3], ['focus ring on ink (primary btn adjacent)', 'focus', 'ink', 3],
  ['control border on paper', 'control', 'paper', 3], ['control border on sheet', 'control', 'sheet', 3], ['control border on well', 'control', 'well', 3],
  ['highlight underline on paper', 'highlight-line', 'paper', 3], ['restored underline on restored', 'restored-line', 'restored', 3], ['restored underline on sheet', 'restored-line', 'sheet', 3],
  ['ok-line on ok-soft (chip border, decorative)', 'ok-line', 'ok-soft', 3], ['warn-line on warn-soft', 'warn-line', 'warn-soft', 3], ['bad-line on bad-soft', 'bad-line', 'bad-soft', 3],
  ['rule on paper (decorative)', 'rule-strong', 'paper', 3],
];
let bad = 0;
for (const [name, theme] of [['light', light], ['dark', dark]]) {
  console.log('== ' + name);
  for (const [label, f, b, min] of pairs) {
    const r = cr(theme[f], theme[b]);
    const flag = r < min;
    if (flag) bad++;
    console.log(`${flag ? 'FAIL' : 'ok  '} ${r.toFixed(2).padStart(5)} (min ${min}) ${label}  ${theme[f]} on ${theme[b]}`);
  }
}
console.log('under threshold:', bad);
