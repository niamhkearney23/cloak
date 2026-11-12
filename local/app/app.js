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

  const state = { info: null, folder: null, matterDir: null, matter: null, options: { dates: false, amounts: false, provisions: false }, progress: new Map(), review: null, tab: 'unsure', filter: '', busy: false, exported: null, manualSource: '', location: null, recovery: null, showAll: false };

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
      <div class="choices">
        <button class="choice primary" id="go-cloak"><b>Cloak a folder</b>Hide names and numbers in a folder of documents.</button>
        <button class="choice" id="go-restore" disabled><b>Restore a draft</b>Put the real details back into a draft. Coming in a later version.</button>
      </div>
      <p class="small muted" style="margin-top:26px">Signed in as <b>${esc(state.info.who)}</b> · <button class="link" id="change-name">Change name</button></p>
    </div>`);
    on('#go-cloak', 'click', () => setup());
    on('#change-name', 'click', () => nameScreen());
  }

  // ----------------------------------------------------------------- setup

  function setup(error) {
    const o = state.options;
    show(`<div class="narrow">
      <h1>Cloak a folder</h1>
      ${error ? message(error) : ''}
      <div class="card">
        <h2>1. The documents</h2>
        <p class="muted small">The folder is only read. Nothing in it is changed.</p>
        <div class="row"><button class="btn" id="pick-folder">Choose folder…</button>${state.folder ? `<span class="path" id="folder-path">${esc(state.folder)}</span>` : ''}</div>
        ${state.folder ? `${state.location ? `<div class="msg ok" id="source-note"><b>This folder is in ${esc(state.location.label)}.</b> Cloak only reads it. It will never create, rename, move or change anything there, and nothing of the matter (key, cache or cloaked copies) will be saved there.${state.location.workspacePath ? `<div class="small">Workspace path: <b>${esc(state.location.workspacePath)}</b></div>` : ''}<div class="small">Recognised from: ${esc(state.location.how)}.</div></div>` : ''}
        <div class="field"><label for="manual-src">Where is this folder?</label><select id="manual-src"><option value="">Work it out automatically</option><option value="imanage" ${state.manualSource === 'imanage' ? 'selected' : ''}>It is on iManage Drive</option><option value="onedrive" ${state.manualSource === 'onedrive' ? 'selected' : ''}>It is in OneDrive</option><option value="googledrive" ${state.manualSource === 'googledrive' ? 'selected' : ''}>It is in Google Drive</option></select><span class="small muted">Choose one if Cloak did not recognise the folder as synced.</span></div>` : ''}
        <p class="small muted" id="keep-note">Dates, amounts and legal provisions are kept unless you tick them:</p>
        <label class="check"><input type="checkbox" data-opt="dates" ${o.dates ? 'checked' : ''}> Also hide dates</label>
        <label class="check"><input type="checkbox" data-opt="amounts" ${o.amounts ? 'checked' : ''}> Also hide amounts of money</label>
        <label class="check"><input type="checkbox" data-opt="provisions" ${o.provisions ? 'checked' : ''}> Also hide legal provisions (sections, Acts)</label>
      </div>
      <div class="card">
        <h2>2. The matter</h2>
        <p class="muted small">Each matter has its own folder holding its encrypted key. Keep it on the firm's shared drive, not inside the documents folder.</p>
        <div class="row"><button class="btn" id="pick-matter">Choose matter folder…</button>${state.matterDir ? `<span class="path" id="matter-path">${esc(state.matterDir)}</span>` : ''}</div>
        <div id="matter-form"></div>
      </div>
      <div class="row"><button class="btn" id="back">Back</button><button class="btn primary" id="start" ${state.folder && state.matter ? '' : 'disabled'}>Start cloaking</button></div>
    </div>`);
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
    if (!info.exists) {
      box.innerHTML = `${error ? message(error) : ''}
        <p class="small">This folder has no matter yet. Create one:</p>
        <div class="field"><label for="m-name">Matter name (optional)</label><input type="text" id="m-name" autocomplete="off"></div>
        <div class="field"><label for="m-pw">Matter password (10 characters or more)</label><input type="password" id="m-pw" autocomplete="new-password"></div>
        <div class="field"><label for="m-pw2">Type the password again</label><input type="password" id="m-pw2" autocomplete="new-password"></div>
        <button class="btn primary" id="m-create">Create matter</button>`;
      on('#m-create', 'click', async () => {
        const pw = document.getElementById('m-pw').value;
        if (pw !== document.getElementById('m-pw2').value) return matterForm('The two passwords do not match.');
        try {
          const made = await call('createMatter', { dir: state.matterDir, name: document.getElementById('m-name').value.trim(), password: pw });
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
        setup();
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
    on('#continue', 'click', () => { state.recovery = null; setup(); });
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
      const r = await call('cloak', { folder: state.folder, options: state.options, manualSource: state.manualSource });
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
        ${tab('unsure', 'Not sure', d.unsure.length, true)}${tab('joined', 'Joined names', joined, true)}${tab('terms', 'Everything replaced', d.terms.length)}${tab('files', 'Files', d.files.length)}
      </div>
      <div id="panel"></div>
      <div class="finish">
        <div id="finish-note">${d.complete
    ? `<span class="chip cloaked">Review finished</span> by ${esc(d.complete.by)} on ${esc(d.complete.whenText)}. ${plural(willExport, 'file', 'files')} ready to export${blocked ? `, ${blocked} held back` : ''}.`
    : d.blockers.length ? `<b>Before you can finish:</b> ${d.blockers.map(esc).join(' ')}` : `Everything is decided. ${plural(willExport, 'file', 'files')} will be exported${blocked ? ` and ${blocked} held back` : ''}.`}</div>
        <div class="row">${d.complete ? '<button class="btn primary" id="export">Export cloaked copies…</button>' : `<button class="btn primary" id="finish" ${d.blockers.length ? 'disabled' : ''}>Finish review</button>`}</div>
      </div>
      ${state.exported ? `<div class="msg ok" id="exported">${plural(state.exported.written.length, 'cloaked copy', 'cloaked copies')} written to <b>${esc(state.exported.outDir)}</b>.${state.exported.heldBack ? ` ${plural(state.exported.heldBack, 'file was', 'files were')} held back.` : ''} The double checker is not built yet, so treat these as <b>not double-checked</b>.</div>` : ''}
    </div>`);
    on('.tab', 'click', (e) => { state.tab = e.currentTarget.dataset.tab; review(); });
    const add = () => { const text = document.getElementById('add-text').value.trim(); if (text) act({ type: 'add', text, kind: document.getElementById('add-kind').value }); };
    on('#add-go', 'click', add);
    on('#add-text', 'keydown', (e) => { if (e.key === 'Enter') add(); });
    on('#finish', 'click', async () => { try { state.review = await call('complete'); review(); } catch (err) { review(err.message); } });
    on('#export', 'click', async () => {
      const outDir = await call('pickFolder', { title: 'Choose where to save the cloaked copies' });
      if (!outDir) return;
      try { state.exported = await call('export', { outDir }); review(); } catch (err) { review(err.message); }
    });
    ({ unsure: panelUnsure, joined: panelJoined, terms: panelTerms, files: panelFiles })[state.tab]();
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

  call('info').then((info) => {
    state.info = info;
    document.getElementById('version').textContent = `Version ${info.version}`;
    if (info.fullName) home(); else nameScreen();
  });
})();
