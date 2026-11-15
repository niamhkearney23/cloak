const fs = require('fs'); const path = require('path');
const P = '/home/user/cloak/design/nocturne/.work/pkgs';
const f = (pkg, file) => `file://${P}/${pkg}/x/package/files/${file}`;
const faces = [
  ['NotoDisplay', f('_fontsource-variable_noto-serif-display','noto-serif-display-latin-standard-normal.woff2'), '100 900', 'normal'],
  ['NotoDisplay', f('_fontsource-variable_noto-serif-display','noto-serif-display-latin-standard-italic.woff2'), '100 900', 'italic'],
  ['Bodoni', f('_fontsource-variable_bodoni-moda','bodoni-moda-latin-opsz-normal.woff2'), '400 900', 'normal'],
  ['Bodoni', f('_fontsource-variable_bodoni-moda','bodoni-moda-latin-opsz-italic.woff2'), '400 900', 'italic'],
  ['Fraunces', f('_fontsource-variable_fraunces','fraunces-latin-full-normal.woff2'), '100 900', 'normal'],
  ['Fraunces', f('_fontsource-variable_fraunces','fraunces-latin-full-italic.woff2'), '100 900', 'italic'],
  ['Hanken', f('_fontsource-variable_hanken-grotesk','hanken-grotesk-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['Geist', f('_fontsource-variable_geist','geist-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['Mona', f('_fontsource-variable_mona-sans','mona-sans-latin-standard-normal.woff2'), '200 900', 'normal'],
  ['Wix', f('_fontsource-variable_wix-madefor-text','wix-madefor-text-latin-wght-normal.woff2'), '400 800', 'normal'],
  ['GeistMono', f('_fontsource-variable_geist-mono','geist-mono-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['DMMono', f('_fontsource_dm-mono','dm-mono-latin-500-normal.woff2'), '500', 'normal'],
  ['DMMono', f('_fontsource_dm-mono','dm-mono-latin-400-normal.woff2'), '400', 'normal'],
];
const css = faces.map(([n, u, w, s]) => `@font-face{font-family:"${n}";src:url("${u}") format("woff2");font-weight:${w};font-style:${s};}`).join('\n');
const combos = [['NotoDisplay','font-weight:400;font-stretch:100%','Hanken','DMMono'],['NotoDisplay','font-weight:400','Mona','GeistMono'],['Bodoni','font-weight:500','Geist','DMMono'],['Fraunces','font-variation-settings:"SOFT" 30,"WONK" 0,"opsz" 96;font-weight:350','Wix','GeistMono']];
const block = (mode, [serif, st, sans, mono]) => `<div class=s style="font-family:${sans}">
<div class=eyebrow>SERI KEMBARA v TERATAI JAYA · STRICT</div>
<h1 style='font-family:${serif};${st}'>Review <em>the findings</em></h1>
<p class=sub>20 files read in 48.2 seconds. Nothing has been exported. Check each list, then finish the review.</p>
<div class=row><div class=w><b>Kembara</b><div class=ex>… the deposit was paid to <span class=tag style="font-family:${mono}">{{PERSON_3}}</span> at <mark>Kembara</mark>'s office in <span class=tag style="font-family:${mono}">{{PLACE_2}}</span> on <span class=tag style="font-family:${mono}">{{DATE_3.B}}</span> …</div></div><div class=n>14 places<br><span>6 files</span></div></div>
<div class=row><div class=w><b>Teratai Jaya Properties Berhad</b><div class=ex>Surat tuntutan daripada <span class=tag style="font-family:${mono}">{{COMPANY_2}}</span> berjumlah <span class=tag style="font-family:${mono}">{{AMOUNT_12}}</span></div></div><div class=n>3 places<br><span>2 files</span></div></div>
<div class=big style='font-family:${serif};${st}'>1,284 <small>terms replaced</small></div>
<div class=lab>${serif} + ${sans} + ${mono}</div></div>`;
const page = (mode) => `<!doctype html><html><head><meta charset=utf-8><style>${css}
body{margin:0;padding:24px;background:${mode==='dark'?'#101216':'#F5F3EE'};color:${mode==='dark'?'#ECEEF2':'#17181C'}}
.g{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.s{padding:22px 24px;border-radius:16px;background:${mode==='dark'?'#171A20':'#fff'};font-size:14px;line-height:1.5}
.eyebrow{font-size:11px;letter-spacing:.12em;font-weight:600;opacity:.6}
h1{font-size:38px;line-height:1.1;margin:6px 0 6px;letter-spacing:-.005em;font-weight:400}
h1 em{font-style:italic;opacity:.8}
.sub{margin:0 0 14px;opacity:.72}
.row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-top:1px solid ${mode==='dark'?'#262A33':'#ECE8DF'}}
.w b{font-weight:600;font-size:14.5px}.ex{font-size:13px;opacity:.78;margin-top:3px}
.n{text-align:right;font-size:13px;white-space:nowrap}.n span{opacity:.6}
mark{background:${mode==='dark'?'rgba(226,196,138,.18)':'#F3E6C6'};color:inherit;border-radius:3px;padding:0 2px}
.tag{font-size:11.5px;font-weight:500;padding:1px 6px;border-radius:5px;background:${mode==='dark'?'#0C0D10':'#1D1F26'};color:${mode==='dark'?'#E2C48A':'#EEDDB5'};letter-spacing:.02em}
.big{font-size:40px;margin-top:10px}.big small{font-size:14px;opacity:.6;font-family:inherit}
.lab{margin-top:8px;font-size:11px;opacity:.5}
</style></head><body><div class=g>${combos.map((c) => block(mode, c)).join('')}</div></body></html>`;
fs.writeFileSync(path.join(__dirname, 'dark2.html'), page('dark'));
fs.writeFileSync(path.join(__dirname, 'light2.html'), page('light'));
