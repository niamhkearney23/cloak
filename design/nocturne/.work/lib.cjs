// Shared pieces for the Nocturne mock pages. Writes plain static HTML.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICONS = {
  folder: '<path d="M2.6 6.1c0-.95.77-1.7 1.7-1.7h3.5l1.8 1.9h6.1c.95 0 1.7.77 1.7 1.7v6.6c0 .95-.77 1.7-1.7 1.7H4.3c-.95 0-1.7-.77-1.7-1.7z"/>',
  folderLock: '<path d="M2.6 6.1c0-.95.77-1.7 1.7-1.7h3.5l1.8 1.9h6.1c.95 0 1.7.77 1.7 1.7v6.6c0 .95-.77 1.7-1.7 1.7H4.3c-.95 0-1.7-.77-1.7-1.7z"/><rect x="7.6" y="10.4" width="4.8" height="3.6" rx=".9"/><path d="M8.6 10.4V9.6a1.4 1.4 0 012.8 0v.8"/>',
  restore: '<path d="M5.6 2.8h5.6L15 6.6v8.9c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6V4.4c0-.9.7-1.6 1.6-1.6z"/><path d="M11 2.8v4h4"/><path d="M7 11.2h6M7 13.8h3.4"/><path d="M9.2 7.6 7.4 9.2l1.8 1.6" />',
  shield: '<path d="M10 2.6l5.8 2.1v4.6c0 3.9-2.5 6.5-5.8 8.1-3.3-1.6-5.8-4.2-5.8-8.1V4.7z"/><path d="M7.4 10l1.8 1.8 3.4-3.6"/>',
  lock: '<rect x="4.2" y="8.8" width="11.6" height="8.4" rx="2"/><path d="M6.9 8.8V6.6a3.1 3.1 0 016.2 0v2.2"/>',
  check: '<path d="M4.6 10.4l3.4 3.4 7.4-7.8"/>',
  x: '<path d="M5.6 5.6l8.8 8.8M14.4 5.6l-8.8 8.8"/>',
  alert: '<path d="M10 3.3l7.2 12.5H2.8z"/><path d="M10 8.2v3.4M10 14v.1"/>',
  info: '<circle cx="10" cy="10" r="7.3"/><path d="M10 9v4.5M10 6.6v.1"/>',
  plus: '<path d="M10 4.6v10.8M4.6 10h10.8"/>',
  search: '<circle cx="9" cy="9" r="5.4"/><path d="M13.1 13.1L17 17"/>',
  users: '<circle cx="7.6" cy="7" r="2.9"/><path d="M2.7 16.4c.6-2.7 2.5-4.2 4.9-4.2s4.3 1.5 4.9 4.2"/><path d="M12.9 4.4a2.9 2.9 0 010 5.2M14.4 12.4c1.5.5 2.5 1.8 2.9 4"/>',
  key: '<circle cx="7" cy="12.6" r="3.4"/><path d="M9.5 10.1l6.3-6.3M13.4 6.2l2 2M11.9 7.7l1.5 1.5"/>',
  eye: '<path d="M2.2 10s2.9-5.4 7.8-5.4 7.8 5.4 7.8 5.4-2.9 5.4-7.8 5.4S2.2 10 2.2 10z"/><circle cx="10" cy="10" r="2.4"/>',
  eyeOff: '<path d="M3 3l14 14"/><path d="M8.2 4.8A7.6 7.6 0 0110 4.6c4.9 0 7.8 5.4 7.8 5.4a13 13 0 01-2.4 3M12.6 14.9a7.2 7.2 0 01-2.6.5C5.1 15.4 2.2 10 2.2 10a13.4 13.4 0 013.4-4"/><path d="M8.3 8.3a2.4 2.4 0 003.4 3.4"/>',
  file: '<path d="M5.6 2.8h5.6L15 6.6v8.9c0 .9-.7 1.6-1.6 1.6H5.6c-.9 0-1.6-.7-1.6-1.6V4.4c0-.9.7-1.6 1.6-1.6z"/><path d="M11 2.8v4h4"/>',
  sheet: '<rect x="3.4" y="3.4" width="13.2" height="13.2" rx="2"/><path d="M3.4 8h13.2M3.4 12.3h13.2M8.2 8v8.6"/>',
  mail: '<rect x="2.8" y="4.6" width="14.4" height="10.8" rx="2"/><path d="M3.4 5.6l6.6 5 6.6-5"/>',
  image: '<rect x="3" y="3.6" width="14" height="12.8" rx="2"/><circle cx="7.4" cy="7.8" r="1.4"/><path d="M3.4 14.2l4-3.8 3 2.6 2.4-2 3.8 3.4"/>',
  merge: '<path d="M5 3.6v3.2c0 2.2 1.6 3.4 5 4.2 3.4-.8 5-2 5-4.2V3.6"/><path d="M10 11v5.4M7.6 14.2 10 16.6l2.4-2.4"/>',
  edit: '<path d="M12.6 4.3l3.1 3.1-8.3 8.3H4.3v-3.1z"/><path d="M11 5.9l3.1 3.1"/>',
  trash: '<path d="M4.4 6h11.2M8 6V4.4h4V6"/><path d="M5.9 6l.7 9.6c.1.9.8 1.6 1.7 1.6h3.4c.9 0 1.6-.7 1.7-1.6L14.1 6"/>',
  print: '<path d="M6 7.4V3.2h8v4.2"/><rect x="2.9" y="7.4" width="14.2" height="6.4" rx="1.6"/><path d="M6 11.6h8v5.2H6z"/>',
  copy: '<rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2"/><path d="M12.8 7.2V5.2c0-1.1-.9-2-2-2H5.2c-1.1 0-2 .9-2 2v5.6c0 1.1.9 2 2 2h2"/>',
  save: '<path d="M10 3.2v9.2M6.2 8.8 10 12.6l3.8-3.8"/><path d="M3.6 13.4v1.9c0 .9.8 1.7 1.7 1.7h9.4c.9 0 1.7-.8 1.7-1.7v-1.9"/>',
  arrowRight: '<path d="M4 10h11.4M11 5.6l4.4 4.4-4.4 4.4"/>',
  arrowLeft: '<path d="M16 10H4.6M9 5.6 4.6 10 9 14.4"/>',
  chevronDown: '<path d="M5.6 8 10 12.4 14.4 8"/>',
  chevronRight: '<path d="M8 5.6l4.4 4.4L8 14.4"/>',
  home: '<path d="M3.6 9.1 10 3.8l6.4 5.3v6.7c0 .6-.4 1-1 1h-3.2v-4.4H7.8v4.4H4.6c-.6 0-1-.4-1-1z"/>',
  help: '<circle cx="10" cy="10" r="7.3"/><path d="M7.9 7.8a2.2 2.2 0 014.3.6c0 1.6-2.2 1.8-2.2 3.3M10 14.1v.1"/>',
  seal: '<circle cx="10" cy="8.4" r="4.8"/><path d="M7.3 12.4l-.9 4.8 3.6-1.8 3.6 1.8-.9-4.8"/><path d="M8.2 8.5l1.2 1.2 2.4-2.5"/>',
  calendar: '<rect x="3" y="4.4" width="14" height="12.6" rx="2"/><path d="M3 8.4h14M7 2.8V6M13 2.8V6"/>',
  scan: '<path d="M3 7V5.2C3 4 4 3 5.2 3H7M13 3h1.8C16 3 17 4 17 5.2V7M17 13v1.8c0 1.2-1 2.2-2.2 2.2H13M7 17H5.2C4 17 3 16 3 14.8V13"/><path d="M6.4 8h7.2M6.4 10.4h7.2M6.4 12.8h4.4"/>',
  layers: '<path d="M10 3.2l6.8 3.7L10 10.6 3.2 6.9z"/><path d="M3.2 10.2 10 13.9l6.8-3.7M3.2 13.5 10 17.2l6.8-3.7"/>',
  clock: '<circle cx="10" cy="10" r="7.3"/><path d="M10 6.2v4l2.7 1.7"/>',
  undo: '<path d="M7.4 5.2 4 8.6 7.4 12"/><path d="M4.4 8.6h7.4a4 4 0 010 8H9"/>',
  cloud: '<path d="M6 15.4h8.4a3.2 3.2 0 00.4-6.4 4.8 4.8 0 00-9.2 1.3A2.6 2.6 0 006 15.4z"/>',
  book: '<path d="M4 4.4c2.4-.8 4.4-.6 6 .8v11c-1.6-1.4-3.6-1.6-6-.8zM16 4.4c-2.4-.8-4.4-.6-6 .8v11c1.6-1.4 3.6-1.6 6-.8z"/>',
  database: '<ellipse cx="10" cy="5.4" rx="6" ry="2.4"/><path d="M4 5.4v9.2c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5.4M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4"/>',
  badge: '<path d="M10 2.8l1.9 1.4 2.3-.2.7 2.2 1.9 1.4-.8 2.2.8 2.2-1.9 1.4-.7 2.2-2.3-.2L10 17.2l-1.9-1.4-2.3.2-.7-2.2-1.9-1.4.8-2.2-.8-2.2 1.9-1.4.7-2.2 2.3.2z"/><path d="M7.6 10.1l1.6 1.6 3.2-3.3"/>',
  moon: '<path d="M15.6 12.4A6.4 6.4 0 017.6 4.4a6.4 6.4 0 108 8z"/>',
  text: '<path d="M4 5h12M4 8.6h12M4 12.2h8M4 15.8h5"/>',
  split: '<path d="M10 3.4v5.2c0 1.6-1.2 2.4-5 3.6M10 8.6c0 1.6 1.2 2.4 5 3.6M5 12.2v4.4M15 12.2v4.4"/>',
  quote: '<path d="M4 13.6c0-3.4 1.2-5.6 3.8-7M10.4 13.6c0-3.4 1.2-5.6 3.8-7"/>',
};
const icon = (name, cls = '') => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

// The Cloak mark: a lacquer tile with three lines of text; one name is sealed under a gold bar.
// Each instance gets its own gradient ids (k), so two marks can share a page.
const SQUIRCLE = 'M10.7 0h10.6C28.8 0 32 3.2 32 10.7v10.6C32 28.8 28.8 32 21.3 32H10.7C3.2 32 0 28.8 0 21.3V10.7C0 3.2 3.2 0 10.7 0z';
const SQUIRCLE_IN = 'M10.9.55h10.2c7.3 0 10.35 3.05 10.35 10.35v10.2c0 7.3-3.05 10.35-10.35 10.35H10.9C3.6 31.45.55 28.4.55 21.1V10.9C.55 3.6 3.6.55 10.9.55z';
const mark = (cls = 'mark', k = 'a') => `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><defs><linearGradient id="mk-t-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-t1"/><stop offset="1" class="m-t2"/></linearGradient><linearGradient id="mk-b-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="m-b1"/><stop offset="1" class="m-b2"/></linearGradient></defs><path class="m-tile" fill="url(#mk-t-${k})" d="${SQUIRCLE}"/><path class="m-edge" d="${SQUIRCLE_IN}"/><rect class="m-line" x="7.4" y="8.9" width="17.2" height="2.2" rx="1.1"/><rect class="m-line m-word" x="7.4" y="14.9" width="4.1" height="2.2" rx="1.1"/><rect class="m-bar" fill="url(#mk-b-${k})" x="13.4" y="13.3" width="11.2" height="5.4" rx="1.7"/><rect class="m-line m-last" x="7.4" y="20.9" width="11.6" height="2.2" rx="1.1"/></svg>`;

// {{PERSON_1.SURNAME}} -> sealed tag markup (braces and form suffix dimmed). Text is escaped first.
const tagHtml = (inner) => {
  const m = /^([A-Z_]+?_\d+)((?:\.[A-Z0-9]+)*)$/.exec(inner);
  if (!m) return `<span class="tag"><span class="b">{{</span>${inner}<span class="b">}}</span></span>`;
  return `<span class="tag"><span class="b">{{</span>${m[1]}${m[2] ? `<span class="f">${m[2]}</span>` : ''}<span class="b">}}</span></span>`;
};
const t = (s) => String(s).replace(/\{\{([^}]+)\}\}/g, (_, inner) => tagHtml(inner));

const bar = ({ matter = '', level = 'Strict', licence = 'Cempaka Wong &amp; Partners' } = {}) => `<header class="bar">
  <div class="brand">${mark('mark', 'bar')}<span class="wordmark">Cloak</span><span class="by">by Lawgistics</span></div>
  ${matter ? `<div class="crumb" id="matter-name"><span class="crumb-name">${matter}</span><span class="level${level === 'Standard' ? ' standard' : ''}">${level}</span></div>` : ''}
  <div class="bar-right">
    <span class="licence-bar" id="licence-bar" title="Licence CW-2026-0412. Ends 31 Dec 2027.">${icon('seal')}<span>Licensed to <b>${licence}</b></span></span>
    <button class="bar-link" type="button" id="bar-home">${icon('home')}<span>Home</span></button>
    <button class="bar-link" type="button" id="bar-help">${icon('help')}<span>Help</span></button>
    <span class="version" id="version">Version 0.9.4</span>
  </div>
</header>`;

const foot = () => `<footer class="foot">${icon('shield')}<span>Everything runs on this computer. Nothing is sent anywhere.</span></footer>`;

const page = ({ title, body, cls = '', matter = '', level, extra = '', mainAttrs = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Cloak · ${title}</title>
<link rel="stylesheet" href="style.css">
</head>
<body${cls ? ` class="${cls}"` : ''}>
${bar({ matter, level })}
<main id="main"${mainAttrs}>
${body}
</main>
${foot()}
${extra}
</body>
</html>
`;

const flow = (now) => {
  const steps = ['Set up', 'Read', 'Review', 'Double check', 'Export'];
  const i = steps.indexOf(now);
  return `<ol class="flow" aria-label="Where you are">${steps.map((s, k) => `<li class="${k < i ? 'done' : k === i ? 'now' : ''}"${k === i ? ' aria-current="step"' : ''}><span class="step-dot" aria-hidden="true"></span>${s}</li>`).join('')}</ol>`;
};

module.exports = { esc, icon, mark, t, tagHtml, bar, foot, page, flow };
