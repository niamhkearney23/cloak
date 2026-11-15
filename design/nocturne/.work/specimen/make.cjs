const fs = require('fs'); const path = require('path');
const P = '/home/user/cloak/design/nocturne/.work/pkgs';
const f = (pkg, file) => `file://${P}/${pkg}/x/package/files/${file}`;
const faces = [
  ['Fraunces', f('_fontsource-variable_fraunces','fraunces-latin-full-normal.woff2'), '100 900', 'normal'],
  ['Fraunces', f('_fontsource-variable_fraunces','fraunces-latin-full-italic.woff2'), '100 900', 'italic'],
  ['Cormorant', f('_fontsource-variable_cormorant-garamond','cormorant-garamond-latin-wght-normal.woff2'), '300 700', 'normal'],
  ['Cormorant', f('_fontsource-variable_cormorant-garamond','cormorant-garamond-latin-wght-italic.woff2'), '300 700', 'italic'],
  ['Bodoni', f('_fontsource-variable_bodoni-moda','bodoni-moda-latin-opsz-normal.woff2'), '400 900', 'normal'],
  ['Bodoni', f('_fontsource-variable_bodoni-moda','bodoni-moda-latin-opsz-italic.woff2'), '400 900', 'italic'],
  ['NotoDisplay', f('_fontsource-variable_noto-serif-display','noto-serif-display-latin-standard-normal.woff2'), '100 900', 'normal'],
  ['NotoDisplay', f('_fontsource-variable_noto-serif-display','noto-serif-display-latin-standard-italic.woff2'), '100 900', 'italic'],
  ['InstrumentSerif', f('_fontsource_instrument-serif','instrument-serif-latin-400-normal.woff2'), '400', 'normal'],
  ['InstrumentSerif', f('_fontsource_instrument-serif','instrument-serif-latin-400-italic.woff2'), '400', 'italic'],
  ['SourceSerif', f('_fontsource-variable_source-serif-4','source-serif-4-latin-opsz-normal.woff2'), '200 900', 'normal'],
  ['SourceSerif', f('_fontsource-variable_source-serif-4','source-serif-4-latin-opsz-italic.woff2'), '200 900', 'italic'],
  ['Brygada', f('_fontsource-variable_brygada-1918','brygada-1918-latin-wght-normal.woff2'), '400 700', 'normal'],
  ['Brygada', f('_fontsource-variable_brygada-1918','brygada-1918-latin-wght-italic.woff2'), '400 700', 'italic'],
  ['Gloock', f('_fontsource_gloock','gloock-latin-400-normal.woff2'), '400', 'normal'],
  ['Inter', f('_fontsource-variable_inter','inter-latin-opsz-normal.woff2'), '100 900', 'normal'],
  ['Geist', f('_fontsource-variable_geist','geist-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['Mona', f('_fontsource-variable_mona-sans','mona-sans-latin-standard-normal.woff2'), '200 900', 'normal'],
  ['Wix', f('_fontsource-variable_wix-madefor-text','wix-madefor-text-latin-wght-normal.woff2'), '400 800', 'normal'],
  ['Hanken', f('_fontsource-variable_hanken-grotesk','hanken-grotesk-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['Onest', f('_fontsource-variable_onest','onest-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['Figtree', f('_fontsource-variable_figtree','figtree-latin-wght-normal.woff2'), '300 900', 'normal'],
  ['GeistMono', f('_fontsource-variable_geist-mono','geist-mono-latin-wght-normal.woff2'), '100 900', 'normal'],
  ['DMMono', f('_fontsource_dm-mono','dm-mono-latin-500-normal.woff2'), '500', 'normal'],
  ['DMMono', f('_fontsource_dm-mono','dm-mono-latin-400-normal.woff2'), '400', 'normal'],
  ['Fragment', f('_fontsource_fragment-mono','fragment-mono-latin-400-normal.woff2'), '400', 'normal'],
  ['RedHatMono', f('_fontsource-variable_red-hat-mono','red-hat-mono-latin-wght-normal.woff2'), '300 700', 'normal'],
  ['Martian', f('_fontsource-variable_martian-mono','martian-mono-latin-standard-normal.woff2'), '100 800', 'normal'],
  ['Spline', f('_fontsource-variable_spline-sans-mono','spline-sans-mono-latin-wght-normal.woff2'), '300 700', 'normal'],
];
const css = faces.map(([n, u, w, s]) => `@font-face{font-family:"${n}";src:url("${u}") format("woff2");font-weight:${w};font-style:${s};}`).join('\n');
const serifs = [['Fraunces', 'font-variation-settings:"SOFT" 0,"WONK" 0;font-weight:380'], ['Cormorant','font-weight:500'], ['Bodoni','font-weight:450'], ['NotoDisplay','font-weight:380'], ['InstrumentSerif','font-weight:400'], ['SourceSerif','font-weight:400'], ['Brygada','font-weight:450'], ['Gloock','font-weight:400']];
const sans = ['Inter','Geist','Mona','Wix','Hanken','Onest','Figtree'];
const monos = [['GeistMono',500],['DMMono',500],['Fragment',400],['RedHatMono',500],['Martian',450],['Spline',500]];
const page = (mode) => `<!doctype html><html><head><meta charset=utf-8><style>${css}
body{margin:0;padding:28px 36px;background:${mode==='dark'?'#111317':'#F6F4EF'};color:${mode==='dark'?'#ECEEF2':'#17181C'};font-family:Inter}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px 28px}
.s{padding:14px 16px;border-radius:14px;background:${mode==='dark'?'#181B21':'#fff'}}
.l{font:500 11px Inter;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:6px}
h1{font-size:46px;line-height:1.05;margin:0 0 4px;letter-spacing:-.01em;font-weight:inherit}
h2{font-size:24px;line-height:1.15;margin:0;font-weight:inherit}
.it{font-style:italic}
.sx{font-size:14px;line-height:1.5}
.tag{display:inline-block;font-size:12.5px;padding:2px 8px;border-radius:6px;background:${mode==='dark'?'#0B0C0F':'#1C1E25'};color:${mode==='dark'?'#E6D3A8':'#F1E7CF'};margin:2px 4px 2px 0;letter-spacing:.01em}
</style></head><body>
<div class=g>${serifs.map(([n, st]) => `<div class=s><div class=l>${n}</div><div style='font-family:${n};${st}'><h1>Review</h1><h2>Restore a <span class=it>draft</span></h2><h2 style='font-size:30px;margin-top:6px'>Cloak a folder</h2></div></div>`).join('')}</div>
<div class=g style='margin-top:18px;grid-template-columns:repeat(4,1fr)'>${sans.map((n) => `<div class=s><div class=l>${n}</div><div class=sx style='font-family:${n}'><b style='font-weight:600'>Teratai Jaya Properties Berhad</b><br>14 places · 6 files · 12 of 20 files read<br>RM 4,317,250.00 · 1,284 terms · 3 Mac 2023<br><span style='font-size:12.5px;opacity:.75'>Before you can finish: decide 14 words on Not sure.</span><br><span style='font-weight:600;font-size:13px'>Hide: person &nbsp; It’s fine &nbsp; Finish review</span></div></div>`).join('')}</div>
<div class=g style='margin-top:18px;grid-template-columns:repeat(3,1fr)'>${monos.map(([n,w]) => `<div class=s><div class=l>${n}</div><div style='font-family:${n};font-weight:${w}'><span class=tag>{{PERSON_1}}</span><span class=tag>{{DATE_3.B}}</span><span class=tag>{{AMOUNT_2}}</span><span class=tag>{{COMPANY_12.SHORT}}</span><span class=tag>{{NRIC_1}}</span></div></div>`).join('')}</div>
</body></html>`;
fs.writeFileSync(path.join(__dirname, 'dark.html'), page('dark'));
fs.writeFileSync(path.join(__dirname, 'light.html'), page('light'));
