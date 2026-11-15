// The review screen family: review (Not sure), chronology, dialog (Everything replaced + "Stop hiding this?").
const { icon, t, page, flow } = require('./lib.cjs');

const MATTER = 'Seri Kembara v Teratai Jaya';

const head = () => `<div class="page-head">
    <div>
      ${flow('Review')}
      <h1>Review</h1>
      <p class="lede">20 files read in 48.2 seconds. Nothing has been exported. Check the lists below, then finish the review.</p>
      <p class="meta"><span class="meta-item">${icon('cloud')}Source: <b>OneDrive</b>, read only</span><span class="meta-item">${icon('key')}Matter key: <b>\\\\fileserver\\matters\\SK-2026-014</b></span></p>
    </div>
    <div class="head-side">
      <span class="chip cloaked">18 files ready</span>
      <span class="chip manual">2 held back</span>
    </div>
  </div>
  <section class="card addbar-card" aria-labelledby="add-label">
    <div class="label" id="add-label">${icon('plus')}Add a word or name the tool missed</div>
    <div class="addbar">
      <div class="input-icon">${icon('search')}<input type="text" id="add-text" placeholder="Type it exactly as it appears" autocomplete="off" aria-labelledby="add-label"></div>
      <select id="add-kind" aria-label="What it is"><option value="PERSON">A person</option><option value="COMPANY">A company</option><option value="OTHER">Something else</option></select>
      <button class="btn tonal" type="button" id="add-go">${icon('eyeOff')}Hide it in every file</button>
    </div>
  </section>`;

const tabs = (active, chronoDone = false) => {
  const list = [
    ['unsure', 'Not sure', '14', 'todo'],
    ['joined', 'Joined names', '3', 'todo'],
    ['terms', 'Everything replaced', '1,284', ''],
    ['facts', 'Hidden facts', '312', ''],
    ['chrono', 'Chronology', '86', ''],
    ['files', 'Files', '20', ''],
  ];
  if (chronoDone) { list[0][2] = ''; list[0][3] = 'done'; list[1][2] = ''; list[1][3] = 'done'; }
  return `<div class="tabs" role="tablist" aria-label="Review lists">${list.map(([id, label, n, state]) => `<button class="tab${state ? ' ' + state : ''}" role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${active === id}" aria-controls="panel"${active === id ? '' : ' tabindex="-1"'}>${label}<span class="n">${state === 'done' ? '<span class="sr-only">done</span>' : n}${state === 'todo' ? '<span class="sr-only"> to do</span>' : ''}</span></button>`).join('')}</div>`;
};

const unsureRows = [
  { w: 'Halim', p: 14, f: 6, ex: ['…the warehouse keys were handed to <mark class="hit">Halim</mark> at the {{PLACE_3}} depot on {{DATE_9}}, together with the gate pass…', '…<mark class="hit">Halim</mark> says the forklift log was signed by {{PERSON_4.FIRST}} before {{DATE_9.B}}.'] },
  { w: 'Bayu', from: 'also in a file name', p: 6, f: 3, ex: ['…invoice {{REF_4}} from <mark class="hit">Bayu</mark> Freight for {{AMOUNT_7}} remains unpaid as at {{DATE_12}}…'] },
  { w: 'Gudang Lima', p: 4, f: 2, ex: ['…stok telah dipindahkan ke <mark class="hit">Gudang Lima</mark> di {{PLACE_5}} selepas {{DATE_11}}…'] },
  { w: 'Ah Seng', p: 3, f: 1, ex: ['…{{PERSON_6.FIRST}} told <mark class="hit">Ah Seng</mark> to stop loading lorry {{VEHICLE_2}} until the deposit was paid…'] },
  { w: 'Seroja', p: 2, f: 2, ex: ['…the balance was paid from the <mark class="hit">Seroja</mark> account {{ACCOUNT_1}} on {{DATE_14}}…'] },
];

const unsurePanel = () => `<section class="panel" id="panel" role="tabpanel" aria-labelledby="tab-unsure">
    <div class="panel-intro"><p>These words look like they could be names. For each one, hide it or say it is fine. Your answer applies to every file and is remembered for this matter.</p><span class="xs faint nowrap">14 left</span></div>
    <div class="list-head" aria-hidden="true"><span>Word, as it appears</span><span class="r">Where</span><span class="r h-act">Decide</span></div>
    <ul class="unsure-list">
      ${unsureRows.map((u, i) => `<li class="unsure">
        <div class="u-main">
          <div class="u-word">${u.w}${u.from ? `<span class="u-from">${u.from}</span>` : ''}</div>
          ${u.ex.map((x) => `<div class="u-ex">${t(x)}</div>`).join('')}
        </div>
        <div class="u-where"><b>${u.p}</b>places<br>${u.f} file${u.f === 1 ? '' : 's'}</div>
        <div class="u-actions">
          <div class="seg" role="group" aria-label="Hide ${u.w} as"><span class="seg-label">Hide as</span><button class="btn" type="button" data-hide="${i}" data-kind="PERSON">Person</button><button class="btn" type="button" data-hide="${i}" data-kind="COMPANY">Company</button><button class="btn" type="button" data-hide="${i}" data-kind="OTHER">Other</button></div>
          <button class="btn small" type="button" data-fine="${i}">${icon('check')}It’s fine</button>
        </div>
      </li>`).join('')}
    </ul>
  </section>`;

const finishBlocked = () => `<div class="finish" role="region" aria-label="Finish the review">
    <div class="finish-status">
      <span class="lamp" aria-hidden="true"></span>
      <div><b>Before you can finish:</b>
        <ul class="blockers">
          <li><button class="link" type="button" data-tab="unsure">14 words the tool is not sure about still need a decision</button></li>
          <li><button class="link" type="button" data-tab="joined">3 joined names need to be confirmed or split</button></li>
        </ul>
      </div>
    </div>
    <div class="row"><button class="btn primary" type="button" id="finish" disabled>${icon('lock')}Finish review</button></div>
  </div>`;

const review = () => page({
  title: 'Review',
  matter: MATTER,
  body: `<div class="wide">
  ${head()}
  ${tabs('unsure')}
  ${unsurePanel()}
  ${finishBlocked()}
</div>`,
});

// ---------------------------------------------------------------- chronology
const chronoRows = [
  { id: 'R1', date: '3 Mar 2023', ev: 'Perjanjian Sewa Gudang ditandatangani antara Seri Kembara Logistics Sdn Bhd dan Teratai Jaya Properties Berhad bagi Lot 12, Kawasan Perindustrian Bukit Raja.', chips: ['<span class="chip same">same event A</span>'], people: ['Seri Kembara Logistics Sdn Bhd', 'Teratai Jaya Properties Berhad'], src: ['02 Perjanjian Sewa Gudang 2023, page 1'] },
  { id: 'R2', date: '3 Mar 2023', ev: 'The Plaintiff and the Defendant entered into a written tenancy of the warehouse for a term of three years.', chips: ['<span class="chip same">same event A</span>'], people: ['Seri Kembara Logistics Sdn Bhd', 'Teratai Jaya Properties Berhad'], src: ['01 Statement of Claim, para 4'] },
  { id: 'R3', date: '15 Apr 2023', ev: 'Deposit of RM 250,000.00 paid to Teratai Jaya Properties Berhad by cheque.', chips: ['<span class="chip same">same event B</span>', '<span class="chip conflict">possible conflict: the same event is given different amounts</span>'], people: ['Teratai Jaya Properties Berhad'], src: ['05 Invoices Q3 2024, sheet Payments'], sel: true },
  { id: 'R4', date: '15 Apr 2023', ev: 'Received the sum of RM 205,000.00 being the security deposit for Lot 12.', chips: ['<span class="chip same">same event B</span>', '<span class="chip conflict">possible conflict: the same event is given different amounts</span>'], people: ['Lim Wei Jie'], src: ['03 Surat Tuntutan - Teratai Jaya, page 2'], sel: true },
  { id: 'R5', date: '5 June', dateChip: '<span class="chip manual">no year</span>', ev: 'Site inspection of the warehouse roof by Lim Wei Jie and the contractor.', rel: 'relative date: within 14 days of the inspection', people: ['Lim Wei Jie'], src: ['09 Emel daripada pengurus gudang'] },
  { id: 'R6', date: 'Jan – Mar 2024', dateChip: '<span class="chip quiet">range</span>', ev: 'Rent for January to March 2024 not paid; reminders sent each month.', people: ['Seri Kembara Logistics Sdn Bhd'], src: ['04 WhatsApp export - Lim Wei Jie', '08 Board minutes 14.11.2024'] },
  { id: 'R7', date: '31/02/2024', dateChip: '<span class="chip fail">date not understood</span>', ev: 'Surat peringatan bertarikh 31/02/2024 mengenai tunggakan sewa.', people: ['Teratai Jaya Properties Berhad'], src: ['03 Surat Tuntutan - Teratai Jaya, page 1'] },
  { id: 'R8', date: '14 Nov 2024', ev: 'Board resolves to terminate the tenancy and to claim RM 4,317,250.00 for loss of stock.', people: ['Nurul Huda binti Rahman', 'Seri Kembara Logistics Sdn Bhd'], src: ['08 Board minutes 14.11.2024, page 3'] },
];

const chronoPanel = () => `<section class="panel" id="panel" role="tabpanel" aria-labelledby="tab-chrono">
    <div class="msg warn" id="chrono-missing"><div><b>Events in these files are missing from this chronology.</b>
      <ul>
        <li><span class="file-name">07 சாட்சி அறிக்கை - ராஜேஷ்.docx</span> <span class="faint">(held back: needs a manual check)</span></li>
        <li><span class="file-name">10 Site photos (scanned).pdf</span> <span class="faint">(partly read, blocked)</span></li>
      </ul></div></div>
    <div class="chrono-summary"><span><b class="tnum">86</b> rows with a date</span><span class="sep" aria-hidden="true"></span><span><b class="tnum">1</b> row whose date Cloak could not read (read it by hand)</span><span class="sep" aria-hidden="true"></span><span><b class="tnum">2</b> rows that may conflict</span></div>
    <div class="toolbar">
      <div class="row"><button class="btn small" type="button" id="chrono-merge">${icon('merge')}Merge selected rows <span class="faint">(2)</span></button><button class="btn small" type="button" id="chrono-add">${icon('plus')}Add a row</button></div>
      <span class="count">Sorted by date · undated rows last</span>
    </div>
    <div class="card flush">
    <table class="chrono-table" id="chrono-table">
      <thead><tr><th class="tight"><span class="sr-only">Select</span></th><th>Date</th><th>What happened</th><th>People</th><th>Source</th><th class="tight"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>
      ${chronoRows.map((r) => `<tr data-row="${r.id}"${r.sel ? ' class="selected"' : ''}>
        <td class="pick"><input type="checkbox" aria-label="Select this row"${r.sel ? ' checked' : ''}></td>
        <td class="date"><span class="d">${r.date}</span>${r.dateChip || ''}</td>
        <td class="event">${r.ev}${r.chips ? `<div>${r.chips.join('')}</div>` : ''}${r.rel ? `<span class="rel">${r.rel}</span>` : ''}</td>
        <td class="people">${r.people.map((p) => `<span>${p}</span>`).join('')}</td>
        <td class="source">${r.src.map((s) => `<span class="file-name">${s}</span>`).join('<br>')}</td>
        <td class="acts"><div class="row"><button class="btn small ghost icon-only" type="button" aria-label="Edit this row" title="Edit">${icon('edit')}</button><button class="btn small ghost danger icon-only" type="button" aria-label="Delete this row" title="Delete">${icon('trash')}</button></div></td>
      </tr>`).join('')}
      </tbody>
    </table>
    </div>
    <div class="undated"><span><b class="tnum">23</b> rows with no date are hidden.</span><button class="btn small" type="button" id="toggle-undated">Show the 23 rows with no date</button></div>
    <div class="card confirm-card" id="chrono-confirm">
      <div class="cc-copy"><span class="seal-ico">${icon('seal', 'lg')}</span><div><h2>Confirm the chronology</h2><p>When the table is right, confirm it. The confirmed table is exported as its own cloaked document, and is the recommended thing to send for drafting. Any change takes the confirmation away.</p></div></div>
      <button class="btn primary" type="button" id="chrono-confirm-go">${icon('check')}Confirm the chronology</button>
    </div>
  </section>`;

const finishReady = () => `<div class="finish" role="region" aria-label="Finish the review">
    <div class="finish-status">
      <span class="lamp ok" aria-hidden="true"></span>
      <div><b>Everything is decided.</b> 18 files will be exported and 2 held back.<div class="xs faint">Finishing records your name and the time: Nurul Aina binti Kamal.</div></div>
    </div>
    <div class="row"><button class="btn primary" type="button" id="finish">${icon('check')}Finish review</button></div>
  </div>`;

const chronology = () => page({
  title: 'Chronology',
  matter: MATTER,
  body: `<div class="wide">
  ${head()}
  ${tabs('chrono', true)}
  ${chronoPanel()}
  ${finishReady()}
</div>`,
});

// ------------------------------------------------- dialog over "Everything replaced"
const terms = [
  ['PERSON_1', 'Lim Wei Jie', 'typed at setup', 212, 14, 2],
  ['COMPANY_1', 'Seri Kembara Logistics Sdn Bhd', 'typed at setup', 388, 19, 3],
  ['COMPANY_2', 'Teratai Jaya Properties Berhad', 'typed at setup', 164, 12, 1],
  ['PERSON_2', 'Nurul Huda binti Rahman', 'name pattern (binti)', 41, 6, 0],
  ['NRIC_4', '760101-14-5501', 'NRIC number pattern', 31, 9, 0, true],
  ['PERSON_3', 'Rajesh a/l Subramaniam', 'name pattern (a/l)', 27, 4, 1],
  ['ACCOUNT_1', '5140 2208 7716', 'bank account pattern', 6, 3, 0],
  ['PHONE_2', '+60 12-448 1902', 'phone number pattern', 5, 2, 0],
  ['ADDRESS_1', 'Lot 12, Jalan Perusahaan 3, Kawasan Perindustrian Bukit Raja', 'address pattern', 18, 7, 0],
];
const termsPanel = () => `<section class="panel" id="panel" role="tabpanel" aria-labelledby="tab-terms">
    <div class="toolbar"><div class="input-icon">${icon('search')}<input type="search" id="filter" placeholder="Search by name or tag" aria-label="Search by name or tag"></div><span class="count">Showing 300 of 1,284 · search to find the rest</span></div>
    <div class="card flush">
    <table class="terms">
      <thead><tr><th>Tag</th><th>Real value</th><th>Found by</th><th class="num">Places</th><th class="num">Files</th><th class="tight"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>
      ${terms.map(([tag, v, how, places, files, forms, focus]) => `<tr${focus ? ' class="focus-row"' : ''}>
        <td class="tight">${t(`{{${tag}}}`)}</td>
        <td><span class="value">${v}</span>${forms ? ` <button class="link small" type="button">+ ${forms} other form${forms > 1 ? 's' : ''}</button>` : ''}</td>
        <td class="how">${how}</td><td class="num">${places}</td><td class="num">${files}</td>
        <td class="tight"><div class="row"><button class="btn small ghost danger" type="button">${icon('eye', 'sm')}Don’t hide</button><select class="merge" aria-label="Merge ${v} into another tag"><option value="">Same as…</option></select></div></td>
      </tr>`).join('')}
      </tbody>
    </table>
    </div>
  </section>`;

const dialogOverlay = () => `<div class="overlay">
  <div class="dialog narrow-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby="dlg-body">
    <div class="dlg-top"><span class="dlg-ico warn">${icon('eye', 'lg')}</span><span class="steps-pill"><span class="pip on"></span><span class="pip"></span>Step 1 of 2</span></div>
    <h2 id="dlg-title">Stop hiding this?</h2>
    <div class="reveal">${t('{{NRIC_4}}')}${icon('arrowRight', 'arrow')}<span class="real">760101-14-5501<span class="real-sub">31 places in 9 files</span></span></div>
    <p id="dlg-body"><b>760101-14-5501</b> will be shown as written in every place it appears, and it will be in the exported copies.</p>
    <p class="dlg-note">${icon('alert')}<span>Cloak found this because it looks like an NRIC or ID number. Numbers and IDs are asked about twice.</span></p>
    <div class="dlg-actions"><button class="btn" type="button" id="no" autofocus>Cancel</button><button class="btn primary" type="button" id="yes">Yes, stop hiding it</button></div>
  </div>
</div>`;

const dialog = () => page({
  title: 'Stop hiding this?',
  matter: MATTER,
  body: `<div class="wide" aria-hidden="true">
  ${head()}
  ${tabs('terms')}
  ${termsPanel()}
  ${finishBlocked()}
</div>`,
  extra: dialogOverlay(),
});

module.exports = { review, chronology, dialog };
