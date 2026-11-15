// The window. It only draws what the engine tells it and passes clicks back.
(function () {
  'use strict';
  const main = document.getElementById('main');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tags = (s) => esc(s).replace(/\{\{[^}]+\}\}/g, (m) => `<span class="tag">${m}</span>`);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function call(name, args) {
    const r = await window.cloak.call(name, args);
    if (r.error) throw Object.assign(new Error(r.error), { code: r.code });
    return r.ok;
  }

  const state = { info: null, folder: null, matterDir: null, matter: null, options: { dates: false, amounts: false, provisions: false }, progress: new Map(), review: null, tab: 'unsure', filter: '', busy: false, exported: null, manualSource: '', location: null, recovery: null, showAll: false, client: '', others: '', testMatter: false, level: 'strict', afterOpen: null, showUndated: false, chrono: null, draft: '', docsFolder: null, restoreResult: null };

  function show(html) { main.innerHTML = html; main.scrollTop = 0; }
  function on(selector, event, fn) { main.querySelectorAll(selector).forEach((el) => el.addEventListener(event, fn)); }
  const message = (text, kind = 'bad') => `<div class="msg ${kind}" role="alert">${esc(text)}</div>`;

  // A question that needs a deliberate yes. Cancel is the default.
  function confirmDialog({ title, body, yes, danger }) {
    return new Promise((resolve) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = `<div class="dialog narrow-dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p>${body}</p><div class="row"><button class="btn" id="no">Cancel</button><button class="btn primary ${danger ? 'danger-fill' : ''}" id="yes">${esc(yes)}</button></div></div>`;
      document.body.appendChild(o);
      const done = (v) => { document.removeEventListener('keydown', onKey); o.remove(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      o.querySelector('#no').addEventListener('click', () => done(false));
      o.querySelector('#yes').addEventListener('click', () => done(true));
      o.querySelector('#no').focus();
    });
  }
  const TYPE_WORDS = { ACCOUNT: 'bank account number', NRIC: 'NRIC or ID number', PASSPORT: 'passport number', PHONE: 'phone number', EMAIL: 'email address', ADDRESS: 'address', CASE: 'court case number', LAND: 'land title', VEHICLE: 'vehicle plate', COMPANY_NO: 'company number', UEN: 'company number', LOCATION: 'location', ID_NUMBER: 'ID or reference number', POSTCODE: 'postcode', NUMBER: 'long number', TAX_NO: 'tax number', CARD: 'card number' };

  // ------------------------------------------------------------------ first run

  function nameScreen(error, then) {
    show(`<div class="narrow">
      <h1>What is your full name?</h1>
      <p class="muted">Cloak writes it next to your computer login on every sign-off and in the log, so it is clear who checked what. It stays on this computer.</p>
      ${error ? message(error) : ''}
      <div class="field"><label for="full-name">Full name</label><input type="text" id="full-name" value="${esc(state.info.fullName)}" autocomplete="off" placeholder="e.g. Siti Aminah binti Yusof"></div>
      <p class="small muted">Computer login: <b>${esc(state.info.login)}</b></p>
      <button class="btn primary" id="save-name">Save</button>
    </div>`);
    const save = async () => {
      try { const r = await call('setName', { fullName: document.getElementById('full-name').value }); state.info = { ...state.info, ...(await call('info')), who: r.who }; home(); } catch (err) { nameScreen(err.message); }
    };
    on('#save-name', 'click', save);
    on('#full-name', 'keydown', (e) => { if (e.key === 'Enter') save(); });
    document.getElementById('full-name').focus();
  }

  // ------------------------------------------------------------------ home

  function home() {
    document.getElementById('matter-name').textContent = '';
    show(`<div class="narrow home">
      <span class="mark" aria-hidden="true"></span>
      <h1>Cloak</h1>
      <p class="muted">Hide client details before a document goes to an AI tool. Put them back afterwards.</p>
      ${tip('home')}
      <div class="choices">
        <button class="choice primary" id="go-cloak"><b>Cloak a folder</b>Hide names and numbers in a folder of documents.</button>
        <button class="choice" id="go-restore"><b>Restore a draft</b>Put the real details back into a draft, and check it.</button>
      </div>
      ${homeExtras()}
      <p class="small muted" style="margin-top:26px">Signed in as <b>${esc(state.info.who)}</b> · <button class="link" id="change-name">Change name</button></p>
    </div>`);
    on('#go-cloak', 'click', () => { state.afterOpen = null; setup(); });
    on('#go-restore', 'click', () => restoreStart());
    on('#change-name', 'click', () => nameScreen());
  }

  // ----------------------------------------------------------------- setup

  function setup(error) {
    const o = state.options;
    show(`<div class="narrow">
      <h1>Cloak a folder</h1>
      ${screenNote('setup')}
      ${error ? message(error) : ''}
      <div class="card">
        <h2>1. The documents</h2>
        <p class="muted small">The folder is only read. Nothing in it is changed.</p>
        <div class="row"><button class="btn" id="pick-folder">Choose folder…</button>${state.folder ? `<span class="path" id="folder-path">${esc(state.folder)}</span>` : ''}</div>
        ${state.folder ? `${state.location ? `<div class="msg ok" id="source-note"><b>This folder is in ${esc(state.location.label)}.</b> Cloak only reads it. It will never create, rename, move or change anything there, and nothing of the matter (key, cache or cloaked copies) will be saved there.${state.location.workspacePath ? `<div class="small">Workspace path: <b>${esc(state.location.workspacePath)}</b></div>` : ''}<div class="small">Recognised from: ${esc(state.location.how)}.</div></div>` : ''}
        <div class="field"><label for="manual-src">Where is this folder?</label><select id="manual-src"><option value="">Work it out automatically</option><option value="imanage" ${state.manualSource === 'imanage' ? 'selected' : ''}>It is on iManage Drive</option><option value="onedrive" ${state.manualSource === 'onedrive' ? 'selected' : ''}>It is in OneDrive</option><option value="googledrive" ${state.manualSource === 'googledrive' ? 'selected' : ''}>It is in Google Drive</option></select><span class="small muted">Choose one if Cloak did not recognise the folder as synced.</span></div>` : ''}
        ${state.level === 'standard' ? `<p class="small muted" id="keep-note">This matter is <b>Standard</b>. Dates, amounts and legal provisions are kept unless you tick them:</p>
        <label class="check"><input type="checkbox" data-opt="dates" ${o.dates ? 'checked' : ''}> Also hide dates</label>
        <label class="check"><input type="checkbox" data-opt="amounts" ${o.amounts ? 'checked' : ''}> Also hide amounts of money</label>
        <label class="check"><input type="checkbox" data-opt="provisions" ${o.provisions ? 'checked' : ''}> Also hide legal provisions (sections, Acts)</label>` : '<p class="small muted" id="keep-note">This matter is <b>Strict</b>: dates, amounts, reference numbers, places, project names, job titles and court names are hidden as well as names and numbers.</p>'}
      </div>
      <div class="card">
        <h2>2. The matter</h2>
        <p class="muted small">Each matter has its own folder holding its encrypted key. Keep it on the firm's shared drive, not inside the documents folder.</p>
        <div class="row"><button class="btn" id="pick-matter">Choose matter folder…</button>${state.matterDir ? `<span class="path" id="matter-path">${esc(state.matterDir)}</span>` : ''}</div>
        <div id="matter-form"></div>
      </div>
      <div class="card">
        <h2>3. The people in this matter</h2>
        <div class="field"><label for="client-name">Who is the client?</label><textarea id="client-name" rows="2" autocomplete="off">${esc(state.client)}</textarea><span class="small muted">Every way it is written, separated by ; (for example: Seri Kembara Logistics Sdn Bhd; Seri Kembara; Kembara). Each form is hidden everywhere, file and folder names included.</span></div>
        <div class="field"><label for="other-parties">Who are the other parties?</label><textarea id="other-parties" rows="3" autocomplete="off">${esc(state.others)}</textarea><span class="small muted">One party per line. Forms of the same party are separated by ;. Start a line with person: or company: if Cloak should treat it as one or the other.</span></div>
        <label class="check"><input type="checkbox" id="test-matter" ${state.testMatter ? 'checked' : ''}> This matter holds made-up test documents only</label>
        <p class="small muted">Until the double checker is built, cloaked copies can be exported only from a test matter.</p>
      </div>
      <div class="row"><button class="btn" id="back">Back</button><button class="btn primary" id="start" ${state.folder && state.matter ? '' : 'disabled'}>Start cloaking</button></div>
    </div>`);
    on('#client-name', 'input', (e) => { state.client = e.target.value; });
    on('#other-parties', 'input', (e) => { state.others = e.target.value; });
    on('#test-matter', 'change', (e) => { state.testMatter = e.target.checked; });
    on('#back', 'click', async () => { await call('closeMatter').catch(() => {}); state.matter = null; home(); });
    on('#pick-folder', 'click', async () => {
      const p = await call('pickFolder', { title: 'Choose the folder of documents' });
      if (!p) return;
      state.folder = p;
      state.manualSource = '';
      await refreshSource();
      setup();
    });
    on('#manual-src', 'change', async (e) => { state.manualSource = e.target.value; await refreshSource(); setup(); });
    on('#pick-matter', 'click', async () => {
      const p = await call('pickFolder', { title: 'Choose the matter folder (new or existing)' });
      if (!p) return;
      try {
        // The key and the matter may not sit where a sync app would upload them.
        await call('checkLocation', { dir: p, what: 'The matter folder', folder: state.folder, manual: state.manualSource });
      } catch (err) { return setup(err.message); }
      await call('closeMatter').catch(() => {});
      state.matter = null;
      state.matterDir = p;
      setup();
    });
    on('[data-opt]', 'change', (e) => { o[e.target.dataset.opt] = e.target.checked; });
    on('#start', 'click', () => runCloak());
    if (state.matter) matterOpenNote(); else if (state.matterDir) matterForm();
  }

  async function refreshSource() {
    try { state.location = (await call('inspectSource', { folder: state.folder, manual: state.manualSource })).location; } catch { state.location = null; }
  }

  function matterOpenNote() {
    document.getElementById('matter-form').innerHTML = `<div class="msg ok">Matter open${state.matter.name ? `: <b>${esc(state.matter.name)}</b>` : ''}.</div>`;
  }

  async function matterForm(error, mode) {
    const box = document.getElementById('matter-form');
    let info;
    try { info = await call('inspectMatter', { dir: state.matterDir }); } catch (err) { box.innerHTML = message(err.message); return; }
    if (!info.exists && state.afterOpen) { box.innerHTML = message('There is no matter in this folder. Choose the folder that holds the matter key (matter.cloakkey).'); return; }
    if (!info.exists) {
      box.innerHTML = `${error ? message(error) : ''}
        <p class="small">This folder has no matter yet. Create one:</p>
        <div class="field"><label for="m-name">Matter name (optional)</label><input type="text" id="m-name" autocomplete="off"></div>
        <div class="field"><label for="m-level">How much to hide</label><select id="m-level"><option value="strict" ${state.level === 'strict' ? 'selected' : ''}>Strict: names, numbers and distinctive facts (recommended)</option><option value="standard" ${state.level === 'standard' ? 'selected' : ''}>Standard: names and numbers only</option></select></div>
        <div class="field"><label for="m-pw">Matter password (10 characters or more)</label><input type="password" id="m-pw" autocomplete="new-password"></div>
        <div class="field"><label for="m-pw2">Type the password again</label><input type="password" id="m-pw2" autocomplete="new-password"></div>
        <button class="btn primary" id="m-create">Create matter</button>`;
      on('#m-create', 'click', async () => {
        const pw = document.getElementById('m-pw').value;
        if (pw !== document.getElementById('m-pw2').value) return matterForm('The two passwords do not match.');
        try {
          state.level = document.getElementById('m-level').value;
          const made = await call('createMatter', { dir: state.matterDir, name: document.getElementById('m-name').value.trim(), password: pw, level: state.level });
          state.matter = { name: made.name };
          recoveryCode(made);
        } catch (err) { matterForm(err.message); }
      });
      return;
    }
    const recovery = mode === 'recovery';
    box.innerHTML = `${error ? message(error) : ''}
      ${info.remembered && !recovery ? '<p class="small">The password for this matter is remembered on this computer.</p><div class="row"><button class="btn primary" id="m-open-remembered">Open matter</button><button class="link" id="m-forget">Forget it</button></div>' : `
      <div class="field"><label for="m-secret">${recovery ? 'Recovery code' : 'Matter password'}</label><input type="${recovery ? 'text' : 'password'}" id="m-secret" autocomplete="off"></div>
      ${state.info.canRemember && !recovery ? '<label class="check"><input type="checkbox" id="m-remember"> Remember the password on this computer</label>' : ''}
      <div class="row"><button class="btn primary" id="m-open">Open matter</button><button class="link" id="m-switch">${recovery ? 'Use the password instead' : 'Forgot the password? Use the recovery code'}</button></div>`}
      <div id="m-locked"></div>`;
    const open = async (args) => {
      try {
        const r = await call('openMatter', { dir: state.matterDir, ...args });
        state.matter = { name: r.name };
        state.level = r.level || 'strict';
        if (r.setup) { state.client = r.setup.client || ''; state.others = r.setup.others || ''; }
        state.testMatter = !!r.testMatter;
        (state.afterOpen || setup)();
      } catch (err) {
        if (err.code !== 'LOCKED') return matterForm(err.message, mode);
        await matterForm(err.message, mode);
        document.getElementById('m-locked').innerHTML = '<p class="small">If that person has finished (or their computer crashed), you can take the matter over. This is recorded in the log.</p><button class="btn danger" id="m-takeover">Take over</button>';
        on('#m-takeover', 'click', () => open(lastSecret === null ? { useRemembered: true, takeOver: true } : { [recovery ? 'recoveryCode' : 'password']: lastSecret, takeOver: true }));
      }
    };
    // What was typed, kept for "Take over" (null when the remembered password was used).
    let lastSecret = null;
    on('#m-open', 'click', () => { lastSecret = document.getElementById('m-secret').value; open({ [recovery ? 'recoveryCode' : 'password']: lastSecret, rememberIt: !!document.getElementById('m-remember')?.checked }); });
    on('#m-secret', 'keydown', (e) => { if (e.key === 'Enter') document.getElementById('m-open').click(); });
    on('#m-open-remembered', 'click', () => open({ useRemembered: true }));
    on('#m-forget', 'click', async () => { await call('forgetPassword', { dir: state.matterDir }); matterForm(); });
    on('#m-switch', 'click', () => matterForm(null, recovery ? 'password' : 'recovery'));
  }

  function recoveryCode(made) {
    state.recovery = made;
    show(`<div class="narrow">
      <h1>Write down the recovery code</h1>
      <p>This code opens the matter if the password is forgotten. <b>It is shown only once.</b> Print it or write it down, and keep it on the paper file or in the safe.</p>
      <p class="small"><b>Matter:</b> ${esc(made.name || '(no name)')}<br><b>Created:</b> ${esc(made.createdText)} by ${esc(made.who)}</p>
      <div class="code" id="recovery-code">${esc(made.recoveryCode)}</div>
      <p class="msg warn">If both the password and this code are lost, the key cannot be opened by anyone. There is no back door.</p>
      <p class="print-only small">Do not keep this sheet with the cloaked copies or in the matter folder on the computer.</p>
      <div class="row no-print"><button class="btn" id="print">Print this page</button></div>
      <label class="check no-print"><input type="checkbox" id="wrote"> I have written the recovery code down</label>
      <p class="no-print"><button class="btn primary" id="continue" disabled>Continue</button></p>
    </div>`);
    on('#print', 'click', () => window.print());
    on('#wrote', 'change', (e) => { document.getElementById('continue').disabled = !e.target.checked; });
    on('#continue', 'click', () => { state.recovery = null; (state.afterOpen || setup)(); });
  }

  // --------------------------------------------------------------- running

  const STAGE = { reading: 'Reading…', read: 'Read', cloaked: 'Done' };
  function drawProgress() {
    const rows = [...state.progress.values()].sort((a, b) => a.index - b.index);
    const done = rows.filter((r) => r.stage !== 'reading').length;
    const total = rows[0]?.total || 0;
    const box = document.getElementById('progress');
    if (!box) return;
    document.getElementById('progress-count').textContent = total ? `${done} of ${total} files read` : 'Looking at the folder…';
    box.innerHTML = rows.map((r) => `<tr><td class="num">${r.index}</td><td>${esc(r.file)}</td><td>${r.ocr ? '<span class="chip ocr">OCR</span>' : ''}</td><td>${r.stage === 'reading' ? '<span class="spinner"></span> ' : ''}${STAGE[r.stage]}</td></tr>`).join('');
  }

  async function runCloak() {
    state.progress.clear();
    show(`<div class="wide">
      <h1>Cloaking…</h1>
      <p class="muted" id="progress-count">Looking at the folder…</p>
      <div class="card white"><table><thead><tr><th>#</th><th>File</th><th>OCR</th><th>Progress</th></tr></thead><tbody id="progress"></tbody></table></div>
    </div>`);
    try {
      const r = await call('cloak', { folder: state.folder, options: state.options, manualSource: state.manualSource, setup: { client: state.client, others: state.others, testMatter: state.testMatter } });
      state.review = r.review;
      state.seconds = r.seconds;
      state.tab = r.review.unsure.length ? 'unsure' : r.review.merges.length + r.review.shortForms.length ? 'joined' : 'files';
      review();
    } catch (err) {
      setup(err.message);
    }
  }
  window.cloak.onProgress((p) => { state.progress.set(p.index, p); drawProgress(); });

  // ---------------------------------------------------------------- review

  const STATUS = { cloaked: 'Cloaked', manual: 'Needs manual check', partial: 'Partly read – blocked', unreadable: 'Unreadable – blocked', container: 'Archive opened' };

  async function act(action) {
    if (state.busy) return;
    state.busy = true;
    try { state.review = await call('action', action); state.exported = null; review(); } catch (err) { review(err.message); } finally { state.busy = false; }
  }

  function review(error) {
    const d = state.review;
    document.getElementById('matter-name').textContent = state.matter?.name || '';
    const joined = d.merges.length + d.shortForms.length;
    const tab = (id, label, n, todo) => `<button class="tab ${todo && n ? 'todo' : ''}" role="tab" data-tab="${id}" aria-selected="${state.tab === id}">${label}<span class="n">${n}</span></button>`;
    const willExport = d.files.filter((f) => f.willExport).length;
    const blocked = d.files.filter((f) => !f.willExport && f.status !== 'container').length;
    show(`<div class="wide">
      <h1>Review</h1>
      ${screenNote('review')}
      <p class="muted">${plural(d.files.length, 'file', 'files')} read in ${state.seconds.toFixed(1)} seconds. Nothing has been exported. Check the lists below, then finish the review.</p>
      ${d.source && d.source.label ? `<p class="small muted">Source: <b>${esc(d.source.kind)}</b>${d.source.workspace_path ? ` · workspace path <b>${esc(d.source.workspace_path)}</b>` : ''}. Read only.</p>` : ''}
      ${error ? message(error) : ''}
      <div class="card">
        <h2>Add a word or name the tool missed</h2>
        <div class="addbar"><input type="text" id="add-text" placeholder="Type it exactly as it appears" autocomplete="off">
          <select id="add-kind" aria-label="What it is"><option value="PERSON">A person</option><option value="COMPANY">A company</option><option value="OTHER">Something else</option></select>
          <button class="btn primary" id="add-go">Hide it in every file</button></div>
      </div>
      <div class="tabs" role="tablist">
        ${tab('unsure', 'Not sure', d.unsure.length, true)}${tab('joined', 'Joined names', joined, true)}${tab('terms', 'Everything replaced', d.terms.length)}${d.facts?.length ? tab('facts', 'Hidden facts', d.facts.length) : ''}${tab('chrono', 'Chronology', state.chrono ? state.chrono.dated : '')}${tab('files', 'Files', d.files.length)}
      </div>
      <div id="panel"></div>
      <div class="finish">
        <div id="finish-note">${d.complete
    ? `<span class="chip cloaked">Review finished</span> by ${esc(d.complete.by)} on ${esc(d.complete.whenText)}. ${plural(willExport, 'file', 'files')} ready to export${blocked ? `, ${blocked} held back` : ''}.`
    : d.blockers.length ? `<b>Before you can finish:</b> ${d.blockers.map(esc).join(' ')}` : `Everything is decided. ${plural(willExport, 'file', 'files')} will be exported${blocked ? ` and ${blocked} held back` : ''}.`}</div>
        <div class="row">${d.complete ? `${state.chrono?.confirmed ? '<button class="btn primary" id="export-chrono">Export the chronology only (recommended)</button><button class="btn" id="export">Export all files…</button>' : '<button class="btn primary" id="export">Export cloaked copies…</button>'}` : `<button class="btn primary" id="finish" ${d.blockers.length ? 'disabled' : ''}>Finish review</button>`}</div>
      </div>
      ${state.exported ? `<div class="msg ok" id="exported">${plural(state.exported.written.length, 'cloaked copy', 'cloaked copies')} written to <b>${esc(state.exported.outDir)}</b>.${state.exported.heldBack ? ` ${plural(state.exported.heldBack, 'file was', 'files were')} held back.` : ''} The double checker is not built yet, so treat these as <b>not double-checked</b>.</div>` : ''}
    </div>`);
    on('.tab', 'click', (e) => { state.tab = e.currentTarget.dataset.tab; review(); });
    const add = () => { const text = document.getElementById('add-text').value.trim(); if (text) act({ type: 'add', text, kind: document.getElementById('add-kind').value }); };
    on('#add-go', 'click', add);
    on('#add-text', 'keydown', (e) => { if (e.key === 'Enter') add(); });
    on('#finish', 'click', async () => { try { state.review = await call('complete'); review(); } catch (err) { review(err.message); } });
    const doExport = (only) => async () => {
      const outDir = await call('pickFolder', { title: 'Choose where to save the cloaked copies' });
      if (!outDir) return;
      try { state.exported = await call('export', { outDir, only }); review(); } catch (err) { review(err.message); }
    };
    on('#export', 'click', doExport('all'));
    on('#export-chrono', 'click', doExport('chronology'));
    ({ unsure: panelUnsure, joined: panelJoined, terms: panelTerms, facts: panelFacts, chrono: panelChronology, files: panelFiles })[state.tab]();
  }

  function panel(html) { document.getElementById('panel').innerHTML = html; }

  function panelUnsure() {
    const d = state.review;
    if (!d.unsure.length) return panel('<div class="msg ok">Nothing left that the tool is unsure about.</div>');
    panel(`<p class="muted small">These words look like they could be names. For each one, hide it or say it is fine. Your answer applies to every file and is remembered for this matter.</p>
      <table><thead><tr><th>Word</th><th>Where</th><th></th></tr></thead><tbody>${d.unsure.map((u, i) => `<tr>
        <td><b>${esc(u.text)}</b>${u.examples.map((x) => `<div class="example">${tags(x)}</div>`).join('')}</td>
        <td class="num">${plural(u.places, 'place', 'places')}<br><span class="muted small">${plural(u.files, 'file', 'files')}</span></td>
        <td><div class="row"><button class="btn small primary" data-hide="${i}" data-kind="PERSON">Hide: person</button><button class="btn small" data-hide="${i}" data-kind="COMPANY">Hide: company</button><button class="btn small" data-hide="${i}" data-kind="OTHER">Hide: other</button><button class="btn small" data-fine="${i}">It's fine</button></div></td></tr>`).join('')}</tbody></table>`);
    on('[data-hide]', 'click', (e) => act({ type: 'add', text: d.unsure[+e.currentTarget.dataset.hide].text, kind: e.currentTarget.dataset.kind }));
    on('[data-fine]', 'click', (e) => act({ type: 'fine', text: d.unsure[+e.currentTarget.dataset.fine].text }));
  }

  function panelJoined() {
    const d = state.review;
    if (!d.merges.length && !d.shortForms.length) return panel('<div class="msg ok">No joined names waiting to be checked.</div>');
    // Variants that differ only in punctuation or spacing can be confirmed together.
    // "(M)", a different ending or a different spelling is always its own decision.
    const groups = new Map();
    for (const m of d.merges.filter((x) => x.onlyPunctuation)) groups.set(m.into, [...(groups.get(m.into) || []), m]);
    const grouped = new Set([...groups].filter(([, list]) => list.length >= 2).map(([into]) => into));
    const single = d.merges.filter((m) => !(m.onlyPunctuation && grouped.has(m.into)));
    panel(`<p class="muted small">The tool gave these the same tag because they look like the same person or company. Confirm each one, or split it off.</p>
      ${[...grouped].map((into) => { const list = groups.get(into); return `<div class="card white"><b>${plural(list.length, 'variant', 'variants')} of ${esc(list[0].intoValue)}</b> <span class="tag">{{${esc(into)}}}</span>
        <div class="small muted">These differ only in punctuation or spacing: ${list.map((m) => esc(m.value)).join(' · ')}</div>
        <div class="row" style="margin-top:8px"><button class="btn small primary" data-group="${esc(into)}">Confirm all ${list.length} in this group</button></div></div>`; }).join('')}
      ${single.length || d.shortForms.length ? `<table><thead><tr><th>This</th><th>was joined to</th><th>Why</th><th></th></tr></thead><tbody>
      ${single.map((m) => `<tr><td><b>${esc(m.value)}</b><br><span class="tag">{{${esc(m.tag)}}}</span></td><td>${esc(m.intoValue)}<br><span class="tag">{{${esc(m.into)}}}</span></td><td class="small">${esc(m.reason)}</td>
        <td><div class="row"><button class="btn small primary" data-same="${esc(m.tag)}">Same</button><button class="btn small" data-split="${esc(m.tag)}">Different: split</button></div></td></tr>`).join('')}
      ${d.shortForms.map((a, i) => `<tr><td><b>${esc(a.value)}</b><br><span class="tag">{{${esc(a.tag)}}}</span></td><td>${esc(a.belongsToValue)}<br><span class="tag">{{${esc(a.belongsTo)}}}</span></td><td class="small">This short form could also mean ${esc(a.alsoValue)}.</td>
        <td><div class="row"><button class="btn small primary" data-short-ok="${i}">That's right</button><button class="btn small" data-short-split="${i}">Give it its own tag</button></div></td></tr>`).join('')}
      </tbody></table>` : ''}`);
    on('[data-group]', 'click', (e) => act({ type: 'confirmGroup', into: e.currentTarget.dataset.group }));
    on('[data-same]', 'click', (e) => act({ type: 'confirmMerge', tag: e.currentTarget.dataset.same }));
    on('[data-split]', 'click', (e) => act({ type: 'split', tag: e.currentTarget.dataset.split }));
    on('[data-short-ok]', 'click', (e) => { const a = d.shortForms[+e.currentTarget.dataset.shortOk]; act({ type: 'confirmShortForm', tag: a.tag, also: a.also }); });
    on('[data-short-split]', 'click', (e) => act({ type: 'split', tag: d.shortForms[+e.currentTarget.dataset.shortSplit].tag }));
  }

  // "Don't hide" needs a deliberate yes. Numbers and IDs found by a pattern ask twice.
  async function removeTerm(tag) {
    const d = state.review;
    const base = tag.split('.')[0];
    const term = d.terms.find((t) => t.tag === base);
    if (!term) return;
    const form = term.forms.find((f) => f.tag === tag);
    const value = form?.value ?? term.value;
    const whole = !tag.includes('.');
    const yes = await confirmDialog({ title: 'Stop hiding this?', body: `<b>${esc(value)}</b> will be shown as written in ${whole ? 'every place it appears' : 'every place this form of it appears'}, and it will be in the exported copies.`, yes: 'Yes, stop hiding it' });
    if (!yes) return;
    let confirmations = 1;
    if (term.patternRule) {
      const sure = await confirmDialog({ title: 'Are you sure?', body: `Cloak found <b>${esc(value)}</b> because it looks like a ${esc(TYPE_WORDS[term.type] || 'number or identifier')}. That kind of detail identifies a person or an account. If you go ahead it goes out in the exported copies.`, yes: 'Yes, show it', danger: true });
      if (!sure) return;
      confirmations = 2;
    }
    act({ type: 'remove', tag, confirmations });
  }

  function panelTerms() {
    const d = state.review;
    const q = state.filter.toLowerCase();
    const matching = d.terms.filter((t) => !q || t.tag.toLowerCase().includes(q) || t.forms.some((f) => f.value.toLowerCase().includes(q)));
    // A big matter can have thousands of terms: show the first part, search for the rest.
    const LIMIT = 300;
    const list = state.showAll || matching.length <= LIMIT ? matching : matching.slice(0, LIMIT);
    panel(`<div class="row"><input type="text" id="filter" placeholder="Search by name or tag" value="${esc(state.filter)}" autocomplete="off"></div>
      <table><thead><tr><th>Tag</th><th>Real value</th><th>Found by</th><th class="num">Places</th><th class="num">Files</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr>
        <td><span class="tag">{{${esc(t.tag)}}}</span></td>
        <td><b>${esc(t.value)}</b>${t.forms.length > 1 ? ` <button class="link small" data-open="${esc(t.tag)}">${state.openTag === t.tag ? 'hide' : `+ ${t.forms.length - 1} other form${t.forms.length > 2 ? 's' : ''}`}</button>` : ''}</td>
        <td class="small muted">${esc(t.how)}</td><td class="num">${t.places}</td><td class="num">${t.files}</td>
        <td><div class="row"><button class="btn small danger" data-remove="${esc(t.tag)}">Don't hide</button>
          <select class="merge" data-merge="${esc(t.tag)}" aria-label="Merge ${esc(t.value)} into another tag"><option value="">Same as…</option>${d.terms.filter((o) => o.type === t.type && o.tag !== t.tag).map((o) => `<option value="${esc(o.tag)}">${esc(o.value)} (${esc(o.tag)})</option>`).join('')}</select></div></td></tr>
        ${state.openTag === t.tag ? t.forms.filter((f) => f.tag !== t.tag).map((f) => `<tr class="sub"><td><span class="tag">{{${esc(f.tag)}}}</span></td><td>${esc(f.value)}</td><td></td><td class="num">${f.places}</td><td class="num">${f.files}</td>
          <td><div class="row"><button class="btn small danger" data-remove="${esc(f.tag)}">Don't hide this form</button><button class="btn small" data-split-form="${esc(f.tag)}">Split off</button></div></td></tr>`).join('') : ''}`).join('')}
      </tbody></table>
      ${list.length < matching.length ? `<p class="small muted">Showing ${list.length} of ${matching.length.toLocaleString()}. Use the search box, or <button class="link" id="show-all">show them all</button>.</p>` : ''}
      ${d.kept.length ? `<p class="small muted">Left as they are, at a reviewer's request: ${d.kept.map(esc).join(', ')}. To hide one again, add it in the box above.</p>` : ''}`);
    on('#filter', 'input', (e) => { state.filter = e.target.value; const at = e.target.selectionStart; panelTerms(); const f = document.getElementById('filter'); f.focus(); f.setSelectionRange(at, at); });
    on('[data-open]', 'click', (e) => { state.openTag = state.openTag === e.currentTarget.dataset.open ? null : e.currentTarget.dataset.open; panelTerms(); });
    on('#show-all', 'click', () => { state.showAll = true; panelTerms(); });
    on('[data-remove]', 'click', (e) => removeTerm(e.currentTarget.dataset.remove));
    on('[data-split-form]', 'click', (e) => act({ type: 'split', tag: e.currentTarget.dataset.splitForm }));
    on('[data-merge]', 'change', (e) => { if (e.target.value) act({ type: 'merge', from: e.target.dataset.merge, into: e.target.value }); });
  }

  function panelFiles() {
    const d = state.review;
    panel(`<table><thead><tr><th>#</th><th>File</th><th>Result</th><th>Read</th><th></th></tr></thead><tbody>${d.files.map((f) => `<tr>
      <td class="num">${f.number}</td>
      <td>${esc(f.name)}${f.inside ? `<div class="reason">${esc(f.inside)}</div>` : ''}${f.reasons.map((r) => `<div class="reason">${esc(r)}</div>`).join('')}</td>
      <td><span class="chip ${f.status}">${STATUS[f.status] || esc(f.status)}</span>${f.nonLatinShowing ? `<div><span class="chip manual">${f.nonLatinShowing} non-Latin character${f.nonLatinShowing === 1 ? '' : 's'} showing</span></div>` : ''}${f.nonLatinHidden ? '<div><span class="chip cloaked">Non-Latin text hidden</span></div>' : ''}${f.checkedBy ? `<div class="reason">Checked by ${esc(f.checkedBy.by)}<br>${esc(f.checkedBy.whenText)}</div>` : ''}</td>
      <td class="small">${f.found ? `${f.read} of ${f.found} ${esc(f.unit)}<br>` : ''}${f.characters ? `${f.characters.toLocaleString()} characters` : ''}${f.ocr.length ? `<br><span class="chip ocr">OCR</span> ${esc(f.ocr.join(', '))}` : ''}${f.fromCache ? '<br><span class="muted">not re-read (unchanged)</span>' : ''}</td>
      <td>${f.nonLatinShowing ? `<div class="row"><button class="btn small primary" data-hide-nl="${f.number}">Hide all non-Latin text</button>` : ''}${f.status === 'manual' && !f.checkedBy ? `<button class="btn small ${f.nonLatinShowing ? '' : 'primary'}" data-check="${f.number}">Check this file…</button>` : f.status === 'cloaked' || f.checkedBy ? `<button class="btn small" data-view="${f.number}">View cloaked text</button>` : ''}${f.nonLatinShowing ? '</div>' : ''}</td></tr>`).join('')}</tbody></table>`);
    on('[data-hide-nl]', 'click', (e) => act({ type: 'hideNonLatin', number: +e.currentTarget.dataset.hideNl }));
    on('[data-check]', 'click', (e) => viewFile(+e.currentTarget.dataset.check, true));
    on('[data-view]', 'click', (e) => viewFile(+e.currentTarget.dataset.view, false));
  }

  async function viewFile(number, approve) {
    let f;
    try { f = await call('fileText', { number }); } catch (err) { return review(err.message); }
    const row = state.review.files.find((x) => x.number === number);
    const showing = row?.nonLatinShowing || 0;
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">
      <h2>${esc(f.name)}</h2>
      ${f.reasons.map((r) => message(r, 'warn')).join('')}
      ${approve ? '<p class="small">This is the cloaked text as it would be exported. Read it against the original. If a name is still showing, close this, add it in the box at the top, and come back.</p>' : ''}
      <pre class="filetext">${tags(f.text)}</pre>
      ${approve && showing ? `<div class="msg warn"><b>${showing} character${showing === 1 ? '' : 's'} of non-Latin text (Chinese, Tamil or similar) ${showing === 1 ? 'is' : 'are'} still showing.</b> Cloak cannot check names in those scripts. The safe choice is to hide every passage: each becomes one tag and is put back when you restore a draft.</div>
        <div class="row"><button class="btn primary" id="hide-nl">Hide all non-Latin text in this file</button><button class="btn" id="close">Close</button></div>
        <details class="more"><summary>Approve it with the non-Latin text showing</summary>
          <p class="small">The text will go out as written. Only do this if you have read it and it identifies no one. Type <b>APPROVE</b> to confirm.</p>
          <div class="row"><input type="text" id="typed" autocomplete="off" placeholder="APPROVE" style="max-width:200px"><button class="btn" id="approve" disabled>Approve this file</button></div></details>`
    : approve ? `<label class="check"><input type="checkbox" id="checked"> I have read this file against the original and it is safe to export</label>
        <div class="row"><button class="btn" id="close">Close</button><button class="btn primary" id="approve" disabled>Approve this file</button></div>`
      : '<div class="row"><button class="btn" id="close">Close</button></div>'}</div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#close').addEventListener('click', close);
    overlay.querySelector('#checked')?.addEventListener('change', (e) => { overlay.querySelector('#approve').disabled = !e.target.checked; });
    overlay.querySelector('#typed')?.addEventListener('input', (e) => { overlay.querySelector('#approve').disabled = e.target.value.trim().toUpperCase() !== 'APPROVE'; });
    overlay.querySelector('#hide-nl')?.addEventListener('click', async () => {
      try { state.review = await call('action', { type: 'hideNonLatin', number }); close(); viewFile(number, true); } catch (err) { close(); review(err.message); }
    });
    overlay.querySelector('#approve')?.addEventListener('click', async () => {
      try { state.review = await call('approve', { number, confirmation: overlay.querySelector('#typed')?.value || '' }); close(); review(); } catch (err) { close(); review(err.message); }
    });
  }


  // ------------------------------------------------------- hidden facts

  const KIND_WORDS = { date: 'Date', amount: 'Amount', ref: 'Reference number', percent: 'Percentage', place: 'Place', project: 'Project name', job: 'Job title', court: 'Court or judge' };

  async function panelFacts() {
    const d = state.review;
    panel(`<p class="muted small">These dates, amounts, reference numbers, places and titles are hidden because this matter is Strict. They are kept apart from the names. Show one only if a draft needs it: the matter records who did it and when.</p>
      <table><thead><tr><th>Tag</th><th>What</th><th>As written</th><th>Where</th><th></th></tr></thead><tbody>${d.facts.map((r, i) => `<tr>
        <td><span class="tag">{{${esc(r.tag)}}}</span></td><td>${esc(KIND_WORDS[r.kind] || r.kind)}</td>
        <td>${r.forms.map((f) => `${esc(f.surface)} <span class="muted small">${plural(f.count, 'place', 'places')}</span>`).join('<br>')}</td>
        <td class="num">${plural(r.count, 'place', 'places')}</td>
        <td>${r.unblurred ? `<span class="chip manual">Shown</span> <button class="btn small" data-reblur="${i}">Hide again</button>` : `<button class="btn small" data-unblur="${i}">Show this one</button>`}</td></tr>`).join('')}</tbody></table>`);
    on('[data-unblur]', 'click', async (e) => {
      const r = d.facts[+e.currentTarget.dataset.unblur];
      const yes = await confirmDialog({ title: 'Show this fact?', body: `<b>${esc(r.forms.map((f) => f.surface).join(' · '))}</b> will be written as it is in every file and in the exported copies. The matter records that you did this.`, yes: 'Yes, show it', danger: true });
      if (yes) act({ type: 'unblurFact', kind: r.kind, key: r.key });
    });
    on('[data-reblur]', 'click', (e) => { const r = d.facts[+e.currentTarget.dataset.reblur]; act({ type: 'reblurFact', kind: r.kind, key: r.key }); });
  }

  // ----------------------------------------------------------- chronology

  // A small form in a dialog. Returns the values, or null when cancelled.
  function formDialog({ title, fields, yes }) {
    return new Promise((resolve) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.innerHTML = `<div class="dialog narrow-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${fields.map((f) => `<div class="field"><label for="fd-${f.id}">${esc(f.label)}</label>${f.rows ? `<textarea id="fd-${f.id}" rows="${f.rows}">${esc(f.value || '')}</textarea>` : `<input type="text" id="fd-${f.id}" value="${esc(f.value || '')}" autocomplete="off">`}</div>`).join('')}<div class="row"><button class="btn" id="fd-no">Cancel</button><button class="btn primary" id="fd-yes">${esc(yes)}</button></div></div>`;
      document.body.appendChild(o);
      const done = (v) => { o.remove(); resolve(v); };
      o.querySelector('#fd-no').addEventListener('click', () => done(null));
      o.querySelector('#fd-yes').addEventListener('click', () => done(Object.fromEntries(fields.map((f) => [f.id, o.querySelector(`#fd-${f.id}`).value]))));
      o.querySelector('input,textarea')?.focus();
    });
  }

  async function chronoCall(action) {
    const r = await call('chronologyAction', { action, undated: state.showUndated });
    state.chrono = r.view;
    state.review = r.review;
    state.exported = null;
    review();
  }

  async function panelChronology() {
    panel('<p class="muted">Loading…</p>');
    try { state.chrono = await call('chronology', { undated: state.showUndated }); } catch (err) { return panel(message(err.message)); }
    drawChronology();
  }

  function drawChronology(error) {
    const c = state.chrono;
    if (!c) {
      panel(`<div class="card"><p>No chronology yet. Cloak reads every sentence with a date, an amount of money or a named person or company, and puts them in one table sorted by date. Rows about the same event are grouped, and rows that disagree are flagged. No AI is used.</p><button class="btn primary" id="chrono-build">Build the chronology</button></div>`);
      return on('#chrono-build', 'click', async () => {
        try { state.chrono = await call('chronology', { build: true, undated: state.showUndated }); state.review = await call('review'); review(); } catch (err) { drawChronology(); panel(`${message(err.message)}${document.getElementById('panel').innerHTML}`); }
      });
    }
    panel(`${error ? message(error) : ''}
      ${c.missing.length ? `<div class="msg warn" id="chrono-missing"><b>Events in these files are missing from this chronology.</b><ul>${c.missing.map((m) => `<li>${esc(m.file)} <span class="muted">(${esc(m.why)})</span></li>`).join('')}</ul></div>` : ''}
      <p class="muted small">${plural(c.dated, 'row', 'rows')} with a date${c.notUnderstood ? `, ${plural(c.notUnderstood, 'row', 'rows')} whose date Cloak could not read (read them by hand)` : ''}${c.conflicts ? `, ${plural(c.conflicts, 'row', 'rows')} that may conflict` : ''}. ${c.undated ? `${plural(c.undated, 'row', 'rows')} with no date ${state.showUndated ? 'are shown below' : 'are hidden'}. <button class="link" id="toggle-undated">${state.showUndated ? 'Hide them' : `Show the ${c.undated} rows with no date`}</button>` : ''}</p>
      <div class="row" style="margin-bottom:10px"><button class="btn small" id="chrono-merge" disabled>Merge selected rows</button><button class="btn small" id="chrono-add">Add a row</button></div>
      <table id="chrono-table"><thead><tr><th></th><th>Date</th><th>What happened</th><th>People</th><th>Source</th><th></th></tr></thead><tbody>${c.rows.map((r) => `<tr data-row="${esc(r.id)}">
        <td><input type="checkbox" data-pick="${esc(r.id)}" aria-label="Select this row"></td>
        <td class="num">${r.date ? esc(r.date) : '<span class="muted">no date</span>'}${r.dateNote ? '<br><span class="chip partial">date not understood</span>' : ''}${r.precision === 'dm' ? '<br><span class="chip manual">no year</span>' : ''}${r.precision === 'range' ? '<br><span class="chip">range</span>' : ''}</td>
        <td>${esc(r.event)}${r.group ? ` <span class="chip container">same event ${esc(r.group)}</span>` : ''}${r.conflict ? `<div class="chip partial" style="margin-top:4px">possible conflict: ${esc(r.conflict.why.join('; '))}</div>` : ''}${r.relative.length ? `<div class="small muted">relative date: ${esc(r.relative.join('; '))}</div>` : ''}</td>
        <td class="small">${r.people.map(esc).join('<br>') || '<span class="muted">-</span>'}</td><td class="small">${r.source.map(esc).join('<br>')}</td>
        <td><div class="row"><button class="btn small" data-edit="${esc(r.id)}">Edit</button><button class="btn small danger" data-delete="${esc(r.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table>
      <div class="card" style="margin-top:14px" id="chrono-confirm">${c.confirmed ? `<span class="chip cloaked">Confirmed</span> by ${esc(c.confirmed.by)} on ${esc(c.confirmed.whenText)}. Any change takes the confirmation away.` : `<p>When the table is right, confirm it. The confirmed table is exported as its own cloaked document, and is the recommended thing to send for drafting.</p><button class="btn primary" id="chrono-confirm-go">Confirm the chronology</button>`}</div>`);
    on('#toggle-undated', 'click', () => { state.showUndated = !state.showUndated; panelChronology(); });
    const picked = () => [...main.querySelectorAll('[data-pick]:checked')].map((x) => x.dataset.pick);
    on('[data-pick]', 'change', () => { document.getElementById('chrono-merge').disabled = picked().length < 2; });
    const guard = (fn) => async (...a) => { try { await fn(...a); } catch (err) { drawChronology(err.message); } };
    on('#chrono-merge', 'click', guard(() => chronoCall({ type: 'merge', ids: picked() })));
    on('#chrono-confirm-go', 'click', guard(() => chronoCall({ type: 'confirm' })));
    on('[data-delete]', 'click', guard(async (e) => {
      const id = e.currentTarget.dataset.delete;
      const yes = await confirmDialog({ title: 'Delete this row?', body: 'It is taken out of the chronology. It is kept in the matter (so it can be put back) but is not exported.', yes: 'Delete the row' });
      if (yes) await chronoCall({ type: 'remove', id });
    }));
    on('[data-edit]', 'click', guard(async (e) => {
      const row = c.rows.find((r) => r.id === e.currentTarget.dataset.edit);
      const v = await formDialog({ title: 'Edit this row', yes: 'Save', fields: [{ id: 'date', label: 'Date (for example 3 July 2025 or 03/07/2025; leave empty for no date)', value: row.dateNote ? '' : row.date }, { id: 'text', label: 'What happened', value: row.event, rows: 4 }] });
      if (v) await chronoCall({ type: 'edit', id: row.id, patch: { dateText: v.date, text: v.text } });
    }));
    on('#chrono-add', 'click', guard(async () => {
      const v = await formDialog({ title: 'Add a row', yes: 'Add', fields: [{ id: 'date', label: 'Date (for example 3 July 2025; leave empty for no date)', value: '' }, { id: 'text', label: 'What happened', value: '', rows: 4 }, { id: 'source', label: 'Where it comes from (for example: client instructions)', value: '' }] });
      if (v) await chronoCall({ type: 'add', row: { dateText: v.date, text: v.text, source: v.source || 'added by hand' } });
    }));
  }

  // ---------------------------------------------------------------- restore

  function restoreStart(error) {
    state.afterOpen = restoreScreen;
    show(`<div class="narrow">
      <h1>Restore a draft</h1>
      ${tip('restore')}
      <p class="muted">Put the real details back into a draft that has tags in it. This runs on this computer only.</p>
      ${error ? message(error) : ''}
      <div class="card">
        <h2>1. The matter</h2>
        <p class="muted small">Choose the folder that holds the matter's key, and open it with the password or the recovery code.</p>
        <div class="row"><button class="btn" id="pick-matter">Choose matter folder…</button>${state.matterDir ? `<span class="path" id="matter-path">${esc(state.matterDir)}</span>` : ''}</div>
        <div id="matter-form"></div>
      </div>
      <div class="row"><button class="btn" id="back">Back</button></div>
    </div>`);
    on('#back', 'click', async () => { await call('closeMatter').catch(() => {}); state.matter = null; state.afterOpen = null; home(); });
    on('#pick-matter', 'click', async () => {
      const p = await call('pickFolder', { title: 'Choose the matter folder' });
      if (!p) return;
      try { await call('checkLocation', { dir: p, what: 'The matter folder' }); } catch (err) { return restoreStart(err.message); }
      await call('closeMatter').catch(() => {});
      state.matter = null;
      state.matterDir = p;
      restoreStart();
    });
    if (state.matter) restoreScreen(); else if (state.matterDir) matterForm();
  }

  const RESULT_WORDS = { pass: 'Passed', warn: 'Warnings', fail: 'Failed', skipped: 'Not run' };
  const RESULT_CHIP = { pass: 'cloaked', warn: 'manual', fail: 'partial', skipped: '' };

  function restoreScreen(error) {
    document.getElementById('matter-name').textContent = state.matter?.name || '';
    const r = state.restoreResult;
    show(`<div class="wide">
      <h1>Restore a draft</h1>
      ${screenNote('draft')}
      ${error ? message(error) : ''}
      <div class="card">
        <h2>The draft</h2>
        <p class="muted small">Paste the draft the AI wrote, with its tags, or choose a file (.txt, .md or .docx).</p>
        <div class="field"><textarea id="draft" rows="10" aria-label="The draft" placeholder="Paste the draft here">${esc(state.draft)}</textarea></div>
        <div class="row"><button class="btn" id="pick-draft">Choose a file…</button>
          <button class="btn" id="pick-docs">Choose the documents folder…</button>${state.docsFolder ? `<span class="path" id="docs-path">${esc(state.docsFolder)}</span>` : '<span class="small muted">Optional: it lets Cloak check the draft against the documents. Without it, that check is skipped.</span>'}</div>
        <div class="row" style="margin-top:12px"><button class="btn primary" id="do-restore">Check and restore</button><button class="btn" id="restore-back">Done</button></div>
      </div>
      <div id="restore-result">${r ? restoreResultHtml(r) : ''}</div>
    </div>`);
    on('#draft', 'input', (e) => { state.draft = e.target.value; });
    on('#restore-back', 'click', async () => { await call('closeMatter').catch(() => {}); state.matter = null; state.afterOpen = null; state.restoreResult = null; state.draft = ''; home(); });
    on('#pick-draft', 'click', async () => {
      try { const f = await call('pickDraftFile'); if (f) { state.draft = f.text; restoreScreen(); } } catch (err) { restoreScreen(err.message); }
    });
    on('#pick-docs', 'click', async () => {
      const p = await call('pickFolder', { title: 'Choose the folder of documents (for the source check)' });
      if (p) { state.docsFolder = p; restoreScreen(); }
    });
    on('#do-restore', 'click', async () => {
      state.draft = document.getElementById('draft').value;
      if (!state.draft.trim()) return restoreScreen('Paste or choose a draft first.');
      document.getElementById('restore-result').innerHTML = '<p><span class="spinner"></span> Checking…</p>';
      try { state.restoreResult = await call('restoreDraft', { draft: state.draft, folder: state.docsFolder }); restoreScreen(); } catch (err) { restoreScreen(err.message); }
    });
    on('#copy-restored', 'click', async () => {
      const text = state.restoreResult.restored;
      try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      document.getElementById('copy-restored').textContent = 'Copied';
    });
    on('#save-restored', 'click', async () => { try { await call('saveText', { text: state.restoreResult.restored, name: 'restored-draft.txt' }); } catch (err) { restoreScreen(err.message); } });
  }

  function restoreResultHtml(r) {
    const rep = r.report;
    const list = (items, n = 12) => `${items.slice(0, n).map((t) => `<span class="tag">{{${esc(String(t).replace(/^\{\{|\}\}$/g, ''))}}}</span>`).join(' ')}${items.length > n ? ` and ${items.length - n} more` : ''}`;
    return `<div class="card white" id="restore-report">
      <h2>Result <span class="chip ${RESULT_CHIP[r.result]}" id="restore-overall">${RESULT_WORDS[r.result]}</span></h2>
      <p>${plural(rep.tagsRestored, 'tag', 'tags')} put back (${plural(rep.distinctTags, 'different tag', 'different tags')}).
      ${rep.inKeyNotInDraft.length ? `<br>${plural(rep.inKeyNotInDraft.length, 'tag', 'tags')} in the key are not in the draft: ${list(rep.inKeyNotInDraft)}` : ''}
      ${rep.notInKey.length ? `<br><b>Tag-like text that is not in the key:</b> ${list(rep.notInKey)}` : '<br>No tag-like text outside the key.'}</p>
      ${r.checks.map((c) => `<h2 style="margin-top:14px;font-size:15px">${esc(c.name)} <span class="chip ${RESULT_CHIP[c.result]}">${RESULT_WORDS[c.result]}</span></h2>${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ''}${c.issues.length ? `<table><tbody>${c.issues.map((i) => `<tr><td class="num">${i.paragraph == null ? '' : `paragraph ${esc(String(i.paragraph))}`}</td><td><span class="chip ${i.level === 'fail' ? 'partial' : 'manual'}">${esc(i.level)}</span> ${esc(i.what)}</td></tr>`).join('')}</tbody></table>` : ''}`).join('')}
      ${r.checks[0].translated?.length ? `<p class="small muted">${plural(r.checks[0].translated.length, 'form', 'forms')} put back in the language of their sentence (month names, job titles, court names).</p>` : ''}
    </div>
    <div class="card white"><h2>The restored draft</h2><pre class="filetext" id="restored-text">${esc(r.restored)}</pre><div class="row"><button class="btn primary" id="copy-restored">Copy</button><button class="btn" id="save-restored">Save as…</button></div></div>`;
  }

  // ------------------------------------------------------------ first run
  //
  // The first-time tips, the sample matter, the help screens and the support
  // file. Other screens only draw what tip(), screenNote() and homeExtras() return.

  // A short note on each main screen until it is closed. Closing it is remembered on this computer.
  const TIPS = {
    home: '<b>Start here.</b> <b>Cloak a folder</b> hides client details in a folder of documents before they go to an AI tool. <b>Restore a draft</b> puts them back into what the AI wrote. New to Cloak? Try the sample matter first.',
    setup: '<b>This screen sets up a cloaking run.</b> Choose the documents (they are only read, never changed), choose or create the matter that holds the encrypted key, and say who the parties are. Nothing is saved or sent until you finish the review and export.',
    review: '<b>Check what Cloak found before anything leaves.</b> Work through each tab with an amber number, read any file that needs a manual check, then press Finish review. Nothing has been exported yet.',
    restore: '<b>This puts the real details back into a draft.</b> Open the matter the draft was made from, then paste the draft. Cloak checks the draft as well. It all happens on this computer.',
  };
  // While the sample matter is open, these take the place of the tips.
  const SAMPLE_NOTES = {
    setup: '<b>This is the sample matter.</b> Everything is filled in for you: the ten made-up documents, the matter (already open) and the people in it. Look at what each part asks for, then press <b>Start cloaking</b> at the bottom.',
    review: '<b>Sample matter.</b> A few words on the <b>Not sure</b> list are names or part of an address: hide those, and mark the rest as fine. Confirm the joined names. On the <b>Files</b> tab, the WhatsApp chat needs a manual check because it has a line in Chinese. Then finish the review and export to the <b>Cloaked copies</b> folder inside the sample folder.',
    draft: '<b>Trying the sample?</b> Open a file in the <b>Cloaked copies</b> folder, copy a few lines with their tags, paste them here and press <b>Check and restore</b>.',
  };
  const TIPS_KEY = 'cloak.tipsClosed';
  const tipsClosed = () => { try { return JSON.parse(localStorage.getItem(TIPS_KEY) || '[]'); } catch { return []; } };
  function tip(id) {
    if (!TIPS[id] || tipsClosed().includes(id)) return '';
    return `<div class="tip" role="note" id="tip-${id}"><span>${TIPS[id]}</span><button class="link" data-tip-close="${id}">Got it</button></div>`;
  }
  function closeTip(id) {
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...new Set([...tipsClosed(), id])])); } catch { /* not remembered: it shows again next time */ }
    document.getElementById(`tip-${id}`)?.remove();
  }
  const isSample = () => !!state.sample && state.matterDir === state.sample.matterDir;
  function screenNote(id) {
    if (isSample() && SAMPLE_NOTES[id]) return `<div class="tip sample-note" role="note" id="sample-note-${id}"><span>${SAMPLE_NOTES[id]}</span></div>`;
    return tip(id);
  }

  const homeExtras = () => `<div class="try-sample"><div><b>New to Cloak?</b> Try it on a sample matter: ten made-up documents, ready in a few minutes.</div><button class="btn" id="go-sample" data-go-sample>Try a sample matter</button></div>
      <p class="small help-links"><button class="link" data-help="how">How Cloak works</button> · <button class="link" data-help="data">Your data</button> · <button class="link" data-help="about">About</button></p>`;

  // "Try a sample matter": where to put it and a password; Cloak does the rest.
  async function sampleScreen(error) {
    let s;
    try { s = await call('sampleStart', { parent: state.sampleParent || null }); } catch (err) { s = { refused: err.message }; }
    if (s.parent) state.sampleParent = s.parent;
    show(`<div class="narrow">
      <h1>Try a sample matter</h1>
      <p class="muted">${esc(s.about || '')} Cloak copies them into a new folder, creates a test matter for them with the people already filled in, and takes you through cloaking and the review.</p>
      ${error ? message(error) : ''}
      <div class="card">
        <h2>1. Where to put it</h2>
        <p class="muted small">Cloak makes a new folder. Nothing already there is changed.</p>
        <div class="row"><span class="path" id="sample-path">${esc(s.folder || '')}</span><button class="btn" id="sample-place">Choose another place…</button></div>
        ${s.refused ? `<div class="msg warn" id="sample-refused">${esc(s.refused)}</div>` : ''}
      </div>
      <div class="card">
        <h2>2. A password for the sample matter</h2>
        <p class="muted small">Every matter has its own password, 10 characters or more. You need it to open the matter again or to restore a draft. Cloak never saves it.</p>
        <div class="field"><label for="sample-pw">Password</label><input type="password" id="sample-pw" autocomplete="new-password"></div>
        <div class="field"><label for="sample-pw2">Type the password again</label><input type="password" id="sample-pw2" autocomplete="new-password"></div>
      </div>
      <div class="row"><button class="btn" id="back">Back</button><button class="btn primary" id="sample-create" ${s.refused ? 'disabled' : ''}>Create the sample matter</button></div>
    </div>`);
    on('#back', 'click', () => home());
    on('#sample-place', 'click', async () => {
      const p = await call('pickFolder', { title: 'Choose where to put the sample matter' });
      if (p) { state.sampleParent = p; sampleScreen(); }
    });
    on('#sample-pw2', 'keydown', (e) => { if (e.key === 'Enter') document.getElementById('sample-create').click(); });
    on('#sample-create', 'click', async (e) => {
      const pw = document.getElementById('sample-pw').value;
      if (pw !== document.getElementById('sample-pw2').value) return sampleScreen('The two passwords do not match. Type the same password in both boxes.');
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = 'Creating…';
      try {
        const made = await call('sampleCreate', { parent: state.sampleParent, password: pw });
        Object.assign(state, { folder: made.docs, matterDir: made.matterDir, matter: { name: made.name }, client: made.client, others: made.others, testMatter: true, level: made.level, manualSource: '', location: null, afterOpen: null, review: null, chrono: null, exported: null, sample: { folder: made.folder, matterDir: made.matterDir, outDir: made.outDir } });
        sampleCreated(made);
      } catch (err) { sampleScreen(err.message); }
    });
    document.getElementById(s.refused ? 'sample-place' : 'sample-pw').focus();
  }

  function sampleCreated(made) {
    show(`<div class="narrow">
      <h1>The sample matter is ready</h1>
      <p>Cloak made this folder:</p>
      <div class="path" id="sample-folder">${esc(made.folder)}</div>
      <ul class="small">
        <li><b>Documents</b>: the ten made-up files. Open them in Word, Excel or a PDF viewer to compare with the cloaked copies later.</li>
        <li><b>Matter key</b>: the matter, with its encrypted key, its cache and its log.</li>
        <li><b>Cloaked copies</b>: empty for now. Export the cloaked copies here at the end.</li>
      </ul>
      <h2>The recovery code</h2>
      <p class="small">Every matter gets a recovery code that opens it if the password is forgotten. It is shown only once. For a real matter, print it or write it down and keep it with the paper file. For the sample you do not need to keep it.</p>
      <div class="code" id="recovery-code">${esc(made.recoveryCode)}</div>
      <div class="row"><button class="btn primary" id="sample-continue">Continue</button></div>
    </div>`);
    on('#sample-continue', 'click', () => setup());
  }

  // ------------------------------------------------------------- help

  const HELP_TABS = [['how', 'How Cloak works'], ['data', 'Your data'], ['about', 'About']];
  let closeHelp = null;

  async function helpScreen(tab = 'how') {
    closeHelp?.();
    const o = document.createElement('div');
    o.className = 'overlay help-overlay';
    o.innerHTML = `<div class="dialog help" role="dialog" aria-modal="true" aria-label="Help">
      <div class="help-head"><div class="tabs" role="tablist">${HELP_TABS.map(([id, label]) => `<button class="tab" role="tab" data-help="${id}" aria-selected="${tab === id}">${label}</button>`).join('')}</div><button class="btn" id="help-close">Close</button></div>
      <div id="help-body"><p class="muted">Loading…</p></div></div>`;
    document.body.appendChild(o);
    const onKey = (e) => { if (e.key === 'Escape') closeHelp?.(); };
    closeHelp = () => { document.removeEventListener('keydown', onKey); o.remove(); closeHelp = null; };
    document.addEventListener('keydown', onKey);
    o.querySelector('#help-close').addEventListener('click', () => closeHelp?.());
    o.addEventListener('click', (e) => { if (e.target === o) closeHelp?.(); });
    o.querySelector('[aria-selected="true"]').focus();
    const body = o.querySelector('#help-body');
    if (tab === 'data') body.innerHTML = helpData(await call('dataPlaces').catch(() => ({})));
    else if (tab === 'about') {
      body.innerHTML = helpAbout(await call('about').catch(() => ({})));
      body.querySelector('#save-support').addEventListener('click', saveSupport);
    } else {
      body.innerHTML = helpHow();
      body.querySelector('#tips-again').addEventListener('click', (e) => {
        try { localStorage.removeItem(TIPS_KEY); } catch { /* nothing to clear */ }
        e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { className: 'small muted', textContent: 'Done. Each screen will show its tip again.' }));
      });
    }
  }

  const code = (s) => `<code>${esc(s)}</code>`;

  function helpHow() {
    return `<h2>How Cloak works</h2>
      <p>Cloak hides client details in a folder of documents before they go to an AI tool, and puts them back into what the AI writes. Everything happens on this computer.</p>
      <ol class="steps">
        <li><b>Cloak.</b> Choose a folder of documents. Cloak reads every part of every file (Word, PDF, Excel, emails, pictures and text files, with their headers, footnotes, comments, tracked changes and document details) and replaces names and numbers with tags such as ${code('{{PERSON_1}}')} or ${code('{{NRIC_2}}')}. The same person gets the same tag in every file. The originals are only read, never changed.</li>
        <li><b>Review.</b> Nothing leaves until a person has checked it. Decide each word Cloak was not sure about, confirm names it joined together, and read any file that needs a manual check. Then finish the review. Your name and the time are recorded.</li>
        <li><b>Double check.</b> A second check of the cloaked copies before they leave. It is not built yet. Until it is, cloaked copies can only be exported from a matter marked as made-up test documents, and they are marked "reviewed, not double-checked". Before a Strict matter is exported, Cloak already reads the copies once more for every value in the key and stops the export if one is found.</li>
        <li><b>Export.</b> Cloak writes the cloaked copies as plain text files to a folder you choose, with a report of what was read in each file. A Strict matter also gets a context sheet that explains the tags to the AI.</li>
        <li><b>Use your AI tool.</b> Give it the cloaked copies only, and ask it to keep every tag exactly as written. It never sees the real details. Its own terms still apply to what you send it, so follow your firm's policy.</li>
        <li><b>Restore.</b> Paste the AI's draft into <b>Restore a draft</b>. Cloak puts the real details back from the matter's key and checks the draft: tags left over or made up, facts that are not in the documents, and sums or dates that do not add up.</li>
      </ol>
      <h3>Strict and Standard</h3>
      <table><tbody>
        <tr><td>Standard</td><td>Hides people, companies, NRIC and passport numbers, addresses, phone numbers, email addresses, bank accounts, case numbers, land titles and vehicle plates. Dates, amounts and legal provisions are kept unless you tick them.</td></tr>
        <tr><td>Strict (the default)</td><td>Hides all of that, and also blurs facts that could tie the text to a real dispute: dates, amounts of money, reference numbers (contract, invoice, cheque, policy, claim), towns and places, project names, job titles that point to one person, and court and judge names.</td></tr>
      </tbody></table>
      <p class="small">Even Strict cannot hide the shape of a dispute: who sued whom, for what, and in what order. Someone who knows the case may still recognise it. Strict lowers that chance; it does not remove it.</p>
      <h3>What Cloak cannot see</h3>
      <p>Cloak works by rules and word lists, not by an AI model. It is not perfect: the review is what makes it safe.</p>
      <ul>
        <li><b>Files it cannot read</b> are blocked and listed, and never exported: old Word (.doc), .rtf, old Excel (.xls), PowerPoint, iPhone photos (.heic), archives other than zip, Outlook mailboxes (.pst, .ost), audio, video, and anything password-protected or damaged.</li>
        <li><b>Parts it does not read</b> are left out of the cloaked copy: email routing headers, the name in a PDF's digital signature, stamps drawn on a page, barcodes and QR codes, a signature or a few handwritten words on a typed page, small or faint text in pictures, and fonts and layout.</li>
        <li><b>Text it reads but may get wrong:</b> anything read by OCR (scans and pictures), and the reading order of PDF pages set in columns or tables.</li>
        <li><b>Names it can miss:</b> a name with no clue around it (no title, no bin, binti, a/l or a/p, no ID number beside it) goes on the Not sure list for you to decide; one-word names and nicknames; people described but not named ("the only cardiologist in Kuantan"); names written in Chinese, Tamil or Jawi script (the file is held for a manual check); places and organisations without a company ending, unless they are part of an address.</li>
        <li><b>Facts Strict can miss:</b> places that are not on its list and have no word such as Taman or Mukim before them; amounts and dates written in words; relative dates ("14 days after the letter"); a month on its own ("in March").</li>
        <li><b>Not tested yet:</b> Outlook .msg files, scanned Tamil pages, and files kept only in the cloud by OneDrive or Google Drive.</li>
      </ul>
      <p><button class="btn small" id="tips-again">Show the first-time tips again</button></p>`;
  }

  function helpData(p) {
    const path = (s) => (s ? `<span class="path inline">${esc(s)}</span>` : '');
    return `<h2>Your data</h2>
      <div class="msg ok"><b>Nothing leaves this computer.</b> Cloak makes no network connection of any kind. The window can only load its own files, name lookups are switched off, and there is no automatic update and no usage reporting.</div>
      <h3>In each matter folder (the folder you chose for the matter)</h3>
      <table><tbody>
        <tr><td>${code('matter.cloakkey')}</td><td>The key: every tag and the real value it stands for. <b>Encrypted</b> (AES-256-GCM). It opens only with the matter password or the recovery code.</td></tr>
        <tr><td>${code('matter.cloakkey.bak')}</td><td>The previous save of the key, encrypted the same way.</td></tr>
        <tr><td>${code('cache')}</td><td>What was read from each file, so unchanged files are not read again. <b>Encrypted</b> with the matter key; the file names in it are scrambled.</td></tr>
        <tr><td>${code('log.jsonl')}</td><td>Who did what and when, with counts. <b>Not encrypted.</b> It never holds names, numbers or text from the documents.</td></tr>
        <tr><td>${code('matter.lock')}</td><td>Who has the matter open now: their name and the computer's name. Not encrypted. Removed when the matter is closed.</td></tr>
      </tbody></table>
      ${p.matterDir ? `<p class="small">The open matter's folder: ${path(p.matterDir)}</p>` : ''}
      <h3>On this computer</h3>
      <table><tbody>
        <tr><td>Your full name</td><td>In ${code('profile.json')} in Cloak's own folder${p.appData ? `: ${path(p.appData)}` : ''}. Not encrypted.</td></tr>
        <tr><td>Remembered passwords</td><td>Only if you tick "Remember the password on this computer". Kept in ${code('remembered.json')} in the same folder, locked by Windows or macOS for your login.</td></tr>
        <tr><td>Which tips you closed</td><td>In the window's own storage, in the same folder.</td></tr>
        <tr><td>OCR language data</td><td>Copied from the app to ${p.ocrData ? path(p.ocrData) : 'a temporary folder'}. Language data only, no documents.</td></tr>
      </tbody></table>
      <h3>Where you choose</h3>
      <ul>
        <li><b>Your documents</b> are only read: never changed, moved or copied.</li>
        <li><b>Cloaked copies</b> and their report are plain text in the folder you export to. They hold tags, not real details, and are not encrypted: they are meant to go to the AI tool.</li>
        <li><b>Restored drafts</b> that you save hold the real details again, and are <b>not encrypted</b>. Keep them with the matter's other documents.</li>
        <li><b>Support files</b> are saved where you choose and never sent by Cloak.</li>
      </ul>
      <h3>What Cloak cannot protect</h3>
      <ul>
        <li>While a matter is open, its key is in this computer's memory.</li>
        <li>Anyone who gets a copy of ${code('matter.cloakkey')} can try passwords against it for as long as they like. A long password is what protects it.</li>
        <li>If both the password and the recovery code are lost, nobody can open the key. There is no back door.</li>
        <li>Once you paste cloaked text into an AI tool, that tool's own terms apply.</li>
      </ul>`;
  }

  function helpAbout(a) {
    return `<h2>About Cloak</h2>
      <table><tbody>
        <tr><td>Version</td><td id="about-version">${esc(a.version || state.info?.version || '')}</td></tr>
        <tr><td>Made by</td><td>Lawgistics</td></tr>
        <tr><td>Support</td><td>${esc(a.support || '')}</td></tr>
        <tr><td>Open-source parts</td><td>Cloak is built with open-source software, including the Electron window, the Tesseract OCR engine and its language data, and PDF.js. Their licences are listed in ${code(a.noticesName || 'THIRD-PARTY-NOTICES.txt')} in the folder where Cloak is installed${a.installFolder ? `: <span class="path inline">${esc(a.installFolder)}</span>` : ''}.${a.notices ? '' : ' <span class="muted" id="notices-missing">That file is not in this copy of Cloak.</span>'}</td></tr>
        <tr><td>Running on</td><td>${esc(a.system || '')}${a.electron ? ` · Electron ${esc(a.electron)}` : ''}</td></tr>
      </tbody></table>
      <h3>Save a support file</h3>
      <p>If something is not working, save a support file and send it to your supplier yourself. Cloak never sends it anywhere.</p>
      <p class="small">It holds the version, the operating system, a self-test (does the OCR engine start, does the open matter's key open) and the open matter's log, which records actions and counts but no client details. As a second guard, anything in it that matches a value in the matter key is replaced by its tag. ${a.matterOpen ? 'The open matter\'s log will be included.' : 'No matter is open, so no matter log will be included. If the problem is with one matter, open it first.'}</p>
      <button class="btn primary" id="save-support">Save a support file…</button>
      <div id="support-result"></div>`;
  }

  async function saveSupport(e) {
    const btn = e.currentTarget;
    const box = document.getElementById('support-result');
    btn.disabled = true;
    box.innerHTML = '<p class="small"><span class="spinner"></span> Choose where to save it. Cloak then checks the OCR engine and the matter key, which takes a few seconds.</p>';
    try {
      const r = await call('saveSupportFile');
      if (!r.saved) { box.innerHTML = '<p class="small muted">Not saved.</p>'; return; }
      const word = (t) => (t.ok === true ? ['cloaked', 'Passed'] : t.ok === false ? ['partial', 'Failed'] : ['', 'Not run']);
      box.innerHTML = `<div class="msg ok" id="support-saved">Support file saved to <b>${esc(r.file)}</b>. Cloak has not sent it anywhere.${r.replaced ? ` ${plural(r.replaced, 'value', 'values')} from the matter key ${r.replaced === 1 ? 'was' : 'were'} found in it and replaced by tags.` : ''}</div>
        <table id="self-test"><tbody>${r.test.map((t) => `<tr><td>${esc(t.check)}</td><td><span class="chip ${word(t)[0]}">${word(t)[1]}</span> ${esc(t.what)}</td></tr>`).join('')}</tbody></table>`;
    } catch (err) {
      box.innerHTML = message(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // The Help button in the top bar, and the clicks every screen shares.
  document.querySelector('.bar-right')?.insertAdjacentHTML('afterbegin', '<button class="bar-link" id="bar-help" data-help="how">Help</button>');
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tip-close], [data-help], [data-go-sample]');
    if (!t) return;
    if (t.dataset.tipClose) closeTip(t.dataset.tipClose);
    else if (t.dataset.help) helpScreen(t.dataset.help);
    else sampleScreen();
  });

  call('info').then((info) => {
    state.info = info;
    document.getElementById('version').textContent = `Version ${info.version}`;
    if (info.fullName) home(); else nameScreen();
  });
})();
