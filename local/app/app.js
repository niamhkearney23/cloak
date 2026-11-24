// The window. It only draws what the engine tells it and passes clicks back.
(function () {
  'use strict';
  const main = document.getElementById('main');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // A tag is a redaction bar: the braces and the ending are dimmer than the name. `code` is already escaped, without braces.
  const tagSafe = (code) => { const [base, ...rest] = code.split('.'); return `<span class="tag"><span class="b">{{</span>${base}${rest.length ? `<span class="b">.${rest.join('.')}</span>` : ''}<span class="b">}}</span></span>`; };
  const tagHtml = (code) => tagSafe(esc(code));
  const tags = (s) => esc(s).replace(/\{\{([^}]+)\}\}/g, (m, code) => tagSafe(code));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const icon = (name, size = 'sm') => `<svg class="i i-${size}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  // Runs of Jawi, Tamil or Chinese text get a lang attribute so the right face and line height are used. `html` is already escaped.
  const SCRIPT = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFC\\u0B80-\\u0BFF\\u3400-\\u9FFF\\uF900-\\uFAFF';
  const SCRIPT_RUN = new RegExp(`[${SCRIPT}]+(?:[ \\u00A0\\u3000-\\u303F\\uFF00-\\uFFEF,.;:!?()-]*[${SCRIPT}]+)*`, 'gu');
  const scriptLang = (run) => (/[\u0600-\u08FF\uFB50-\uFEFC]/.test(run) ? { lang: 'ms-Arab', dir: ' dir="rtl"' } : /[\u0B80-\u0BFF]/.test(run) ? { lang: 'ta', dir: '' } : { lang: 'zh-Hans', dir: '' });
  const langRuns = (html, cls = '') => html.replace(SCRIPT_RUN, (run) => { const l = scriptLang(run); return `<span${cls ? ` class="${cls}"` : ''} lang="${l.lang}"${l.dir}>${run}</span>`; });
  const escL = (s) => langRuns(esc(s));
  // The same date form the engine writes: 12 Nov 2026, 9:19 am.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const nowText = () => { const d = new Date(); const h = d.getHours(); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

  // How many calls to the app are still running. Closing the matter waits until it is zero.
  let pending = 0;
  async function call(name, args) {
    pending++;
    let r;
    try { r = await window.cloak.call(name, args); } finally { pending--; }
    if (r.error) throw Object.assign(new Error(withNextStep(r.error, r.code)), { code: r.code });
    return r.ok;
  }
  // What to do next, for errors whose message only says what happened. Keyed by the error's code.
  const NEXT_STEP = {
    WRONG_SECRET: (m) => (/recovery code/i.test(m) ? 'Check the code on the printed sheet and type it again. Spaces, dashes and capital letters do not matter.' : 'Check that Caps Lock is off and type it again. If the password is lost, use the recovery code instead.'),
    // DOUBLE_CHECK (export refused by the double check) says what to do next itself, and opens the Double check tab.
  };
  const withNextStep = (text, code) => (NEXT_STEP[code] ? `${text} ${NEXT_STEP[code](text)}` : text);

  const state = { info: null, folder: null, matterDir: null, matter: null, options: { dates: false, amounts: false, provisions: false }, progress: new Map(), review: null, tab: 'unsure', filter: '', busy: false, exported: null, manualSource: '', location: null, recovery: null, showAll: false, client: '', others: '', testMatter: false, level: 'strict', afterOpen: null, showUndated: false, chrono: null, draft: '', docsFolder: null, restoreResult: null, check: null, checking: false, fileFilter: 'all', fileSearch: '', showAllFiles: false, matterExists: null, openTag: null, draftName: '' };

  // The top bar names the open matter, its level and whether it holds made-up test documents.
  // "Matter settings" in the bar: drawing a screen withdraws it, and each screen that can be come back to offers it
  // again once it is drawn (offerSettings, with the way back).
  let settingsReturn = null;
  function setBar() {
    const open = !!state.matter;
    document.getElementById('bar-matter').hidden = !open;
    document.getElementById('matter-name').textContent = open ? (state.matter.name || 'Matter open') : '';
    const level = document.getElementById('matter-level');
    level.hidden = !open;
    level.textContent = state.level === 'standard' ? 'Standard' : 'Strict';
    document.getElementById('matter-test').hidden = !(open && state.testMatter);
    document.getElementById('bar-settings').hidden = !(open && settingsReturn);
  }
  function show(html) { settingsReturn = null; main.innerHTML = html; main.scrollTop = 0; setBar(); }
  function offerSettings(back) { settingsReturn = back; setBar(); }
  function on(selector, event, fn) { main.querySelectorAll(selector).forEach((el) => el.addEventListener(event, fn)); }
  const message = (text, kind = 'bad') => `<div class="msg ${kind}" role="${kind === 'bad' ? 'alert' : 'status'}">${esc(text)}</div>`;
  // The page behind a dialog cannot be reached while it is open.
  const lockMain = (on_) => { main.inert = on_; };

  // The five steps of a cloaking run. `at` is the current step (1 to 5); `count` is a short note on the current step.
  const STEPS = ['Set up', 'Read', 'Review', 'Double check', 'Export'];
  function stepper(at, count, done = 0) {
    return `<ol class="stepper" aria-label="Where you are">${STEPS.map((label, i) => {
      const n = i + 1;
      const isDone = n < at || n <= done;
      return `<li class="${isDone ? 'done' : ''}"${n === at && !isDone ? ' aria-current="step"' : ''}><span class="dot" aria-hidden="true">${isDone ? '' : n}</span><span>${label}</span>${isDone ? '<span class="vh"> (done)</span>' : ''}${n === at && count ? `<span class="count">${esc(count)}</span>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  const pageHead = (title, steps, meta = []) => `<div class="pagehead"><div><h1>${esc(title)}</h1>${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}</div>${steps || ''}</div>`;

  // A question that needs a deliberate yes. Cancel is the default and has the focus.
  // Options: step (1 or 2 of 2), kind (a chip), ledger ([[label, value, isReal]]), leaves (what leaves the computer, in the dashed grammar),
  // callout ({ icon, html }), notes ([{ icon, html }]), small (smaller body text), no (the label of the Cancel button).
  function confirmDialog({ title, body, yes, danger, no = 'Cancel', step, kind, ledger, leaves, callout, notes, small }) {
    return new Promise((resolve) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      const steps = step ? `<div class="dialog-steps"><span>Question ${step} of 2</span><span class="bars" aria-hidden="true"><i class="on"></i><i${step === 2 ? ' class="on"' : ''}></i></span></div>` : '';
      const head = kind ? `<div class="dialog-kind"><h2 id="dt">${esc(title)}</h2>${kind}</div>` : `<h2 id="dt">${esc(title)}</h2>`;
      o.innerHTML = `<div class="dialog narrow-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dt">${steps}${head}${body ? `<p${small ? ' class="small"' : ''}>${body}</p>` : ''}${ledger ? `<dl class="ledger">${ledger.map(([k, v, real]) => `<dt>${esc(k)}</dt><dd${real ? ' class="real"' : ''}>${v}</dd>`).join('')}</dl>` : ''}${leaves ? `<div class="callout leaves-callout">${icon('out', 'md')}<div>${leaves}</div></div>` : ''}${callout ? `<div class="callout">${icon(callout.icon, 'md')}<div>${callout.html}</div></div>` : ''}${notes?.length ? `<ul class="consequences">${notes.map((n) => `<li>${icon(n.icon)}<span>${n.html}</span></li>`).join('')}</ul>` : ''}<div class="row"><button class="btn" id="no" type="button">${esc(no)}</button><button class="btn primary ${danger ? 'danger-fill' : ''}" id="yes" type="button">${esc(yes)}</button></div></div>`;
      document.body.appendChild(o);
      lockMain(true);
      const done = (v) => { document.removeEventListener('keydown', onKey); lockMain(false); o.remove(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      o.querySelector('#no').addEventListener('click', () => done(false));
      o.querySelector('#yes').addEventListener('click', () => done(true));
      o.querySelector('#no').focus();
    });
  }
  // "Recorded as NAME, TIME": every decision says who made it and when.
  const recorded = () => ({ icon: 'user', html: `The matter records who did this and when: <b>${esc(state.info?.who || '')}, ${esc(nowText())}.</b>` });
  // The pasted draft and the restored text hold real details: they are never kept once the matter is closed.
  const DRAFT_NOT_KEPT = 'The pasted draft and the restored text are not kept: copy or save the restored text first.';
  const draftAtRisk = () => !!(state.draft?.trim() || state.restoreResult);
  const TYPE_WORDS = { ACCOUNT: 'bank account number', NRIC: 'NRIC or ID number', PASSPORT: 'passport number', PHONE: 'phone number', EMAIL: 'email address', ADDRESS: 'address', CASE: 'court case number', LAND: 'land title', VEHICLE: 'vehicle plate', COMPANY_NO: 'company number', UEN: 'company number', LOCATION: 'location', ID_NUMBER: 'ID or reference number', POSTCODE: 'postcode', NUMBER: 'long number', TAX_NO: 'tax number', CARD: 'card number' };

  // ------------------------------------------------------------------ first run

  function nameScreen(error, then) {
    show(`<div class="narrow">
      <h1>What is your full name?</h1>
      <p class="muted">Cloak writes it next to your computer login on every sign-off and in the log, so it is clear who checked what. It stays on this computer.</p>
      ${error ? message(error) : ''}
      <div class="card mt-4">
        <div class="field"><label for="full-name">Full name</label><input type="text" id="full-name" value="${esc(state.info.fullName)}" autocomplete="off" placeholder="e.g. Siti Aminah binti Yusof"></div>
        <p class="small muted">Computer login: <b class="ink">${esc(state.info.login)}</b></p>
        <button class="btn primary" id="save-name" type="button">Save</button>
      </div>
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
    show(`<div class="home">
      ${tip('home')}
      <div class="home-grid">
        <section class="home-hero" aria-labelledby="h">
          <p class="kicker">${icon('lock')}Runs on this computer. Nothing is sent anywhere.</p>
          <h1 id="h">Send the case to the AI, <em>not the client.</em></h1>
          <p class="lead">Cloak hides names and numbers in a folder of documents, then puts them back into the AI's draft.</p>
          <figure class="specimen" aria-label="An example of a sentence before and after cloaking">
            <div class="part">
              <div class="cap"><span>The original</span><span>stays on this computer</span></div>
              <p lang="ms"><span class="real">Pada 12 Mac 2024</span>, <span class="real">Tan Ah Kow</span> membayar <span class="real">RM 48,500.00</span> kepada <span class="real">Gudang Lima Sdn Bhd</span>.</p>
            </div>
            <div class="cut">${icon('scissors')}<span>Cloak cuts here</span></div>
            <div class="part">
              <div class="cap"><span>Cloaked</span><span>what the AI sees</span></div>
              <p lang="ms">Pada ${tagHtml('DATE_1')}, ${tagHtml('PERSON_1')} membayar ${tagHtml('AMOUNT_1')} kepada ${tagHtml('COMPANY_2')}.</p>
            </div>
          </figure>
        </section>
        <section aria-label="What would you like to do?">
          <div class="choices">
            <button class="choice primary" id="go-cloak" type="button"><span class="eyebrow">Before the AI</span><b>Cloak a folder</b><span class="desc">Hide names and numbers in a folder of documents.</span><span class="go">${icon('arrow', 'md')}</span></button>
            <button class="choice" id="go-restore" type="button"><span class="eyebrow">After the AI</span><b>Restore a draft</b><span class="desc">Put the real details back into a draft, and check it.</span><span class="go">${icon('arrow', 'md')}</span></button>
          </div>
          ${homeExtras()}
        </section>
      </div>
      <div class="flow" aria-label="What stays and what leaves">
        <div class="stay"><h3>${icon('pc', 'md')}Stays on this computer</h3><p>Your documents, the encrypted key, the real names and numbers, and the log. Nothing is sent anywhere, ever.</p></div>
        <div class="leave"><h3>${icon('out', 'md')}Leaves only when you export</h3><p>The cloaked copies, with tags instead of names, to a folder you choose. Nobody can export until a person has reviewed them.</p></div>
      </div>
      <p class="signed help-links">Signed in as <b>${esc(state.info.who)}</b><span class="sep"></span><button class="link" id="change-name" type="button">Change name</button><span class="sep"></span><button class="link" id="go-licence" type="button">Licence</button><span class="sep"></span><button class="link" data-help="how" type="button">How Cloak works</button><span class="sep"></span><button class="link" data-help="data" type="button">Your data</button><span class="sep"></span><button class="link" data-help="about" type="button">About</button></p>
    </div>`);
    on('#go-cloak', 'click', () => { state.afterOpen = null; setup(); });
    on('#go-restore', 'click', () => restoreStart());
    on('#change-name', 'click', () => nameScreen());
    on('#go-licence', 'click', () => licenceScreen());
  }

  // ----------------------------------------------------------------- setup

  // What is still missing before cloaking can start, as the bar at the foot of the setup screen says it.
  function startNote() {
    const missing = [];
    if (!state.folder) missing.push('Choose the documents');
    if (!state.matter) missing.push(!state.matterDir ? 'Choose the matter folder' : state.matterExists === false ? 'Create the matter' : 'Open the matter');
    if (missing.length) return `<span class="finish-lead">Before you can start</span><div class="blockers">${missing.map((m) => `<span class="blocker">${esc(m)}</span>`).join('')}</div>`;
    return '<span class="finish-lead">Ready to cloak</span><span>Nothing is saved or sent until you finish the review and export.</span>';
  }

  function setup(error) {
    const o = state.options;
    const ready = !!(state.folder && state.matter);
    show(`<div class="wide has-finish">
      ${pageHead('Cloak a folder', stepper(1))}
      ${screenNote('setup')}
      ${error ? message(error) : ''}
      <div class="setup-grid">
      <section class="card" aria-labelledby="s1">
        <h2 id="s1"><span class="step-no" aria-hidden="true">1</span>The documents</h2>
        <p class="sub">The folder is only read. Nothing in it is changed.</p>
        <div class="row"><button class="btn" id="pick-folder" type="button">${icon('folder', 'md')}Choose folder…</button>${state.folder ? `<span class="path" id="folder-path">${esc(state.folder)}</span>` : ''}</div>
        ${state.folder ? `${state.location ? `<div class="msg ok" id="source-note"><b>This folder is in ${esc(state.location.label)}.</b> Cloak only reads it. It will never create, rename, move or change anything there, and nothing of the matter (key, cache or cloaked copies) will be saved there.${state.location.workspacePath ? `<div class="small">Workspace path: <b>${esc(state.location.workspacePath)}</b></div>` : ''}<div class="small">Recognised from: ${esc(state.location.how)}.</div></div>` : ''}
        <details class="more"${state.manualSource ? ' open' : ''}><summary>Is this folder synced? Tell Cloak</summary><div class="field"><label for="manual-src">Where is this folder?</label><select id="manual-src"><option value="">Work it out automatically</option><option value="imanage" ${state.manualSource === 'imanage' ? 'selected' : ''}>It is on iManage Drive</option><option value="onedrive" ${state.manualSource === 'onedrive' ? 'selected' : ''}>It is in OneDrive</option><option value="googledrive" ${state.manualSource === 'googledrive' ? 'selected' : ''}>It is in Google Drive</option></select><span class="small hint">Choose one if Cloak did not recognise the folder as synced.</span></div></details>` : ''}
        ${state.level === 'standard' ? `<p class="small muted mt-3" id="keep-note">This matter is <b class="ink">Standard</b>. Dates, amounts and legal provisions are kept unless you tick them:</p>
        <label class="check"><input type="checkbox" data-opt="dates" ${o.dates ? 'checked' : ''}><span>Also hide dates</span></label>
        <label class="check"><input type="checkbox" data-opt="amounts" ${o.amounts ? 'checked' : ''}><span>Also hide amounts of money</span></label>
        <label class="check"><input type="checkbox" data-opt="provisions" ${o.provisions ? 'checked' : ''}><span>Also hide legal provisions (sections, Acts)</span></label>` : '<p class="small muted mt-3 mb-0" id="keep-note">This matter is <b class="ink">Strict</b>: dates, amounts, reference numbers, places, project names, job titles and court names are hidden as well as names and numbers.</p>'}
      </section>
      <section class="card" aria-labelledby="s2">
        <h2 id="s2"><span class="step-no" aria-hidden="true">2</span>The matter</h2>
        <p class="sub">Its own folder, holding the encrypted key. Not inside the documents folder. Keep it on the firm's shared drive.</p>
        <div class="row"><button class="btn" id="pick-matter" type="button">${icon('key', 'md')}Choose matter folder…</button>${state.matterDir ? `<span class="path" id="matter-path">${esc(state.matterDir)}</span>` : ''}</div>
        <div id="matter-form" class="mt-3"></div>
      </section>
      <section class="card" aria-labelledby="s3">
        <h2 id="s3"><span class="step-no" aria-hidden="true">3</span>The people in this matter</h2>
        <div class="grid-2">
          <div class="field"><label for="client-name">Who is the client?</label><textarea id="client-name" rows="2" autocomplete="off">${esc(state.client)}</textarea><span class="small hint">Every way it is written, separated by ;  Hidden everywhere, file names too.</span></div>
          <div class="field"><label for="other-parties">Who are the other parties?</label><textarea id="other-parties" rows="3" autocomplete="off">${esc(state.others)}</textarea><span class="small hint">One party per line, forms separated by ;  Start with person: or company: if needed.</span></div>
        </div>
        <label class="check"><input type="checkbox" id="test-matter" ${state.testMatter ? 'checked' : ''}><span>This matter holds made-up test documents only <span class="small muted">(the export report records it)</span></span></label>
      </section>
      </div>
      <div class="startbar">
        <div class="finish-note" id="finish-note">${startNote()}</div>
        <div class="row"><button class="btn" id="back" type="button">Back</button><button class="btn primary" id="start" type="button" ${ready ? '' : 'disabled'}>${ready ? '' : icon('lock')}Start cloaking</button></div>
      </div>
    </div>`);
    on('#client-name', 'input', (e) => { state.client = e.target.value; });
    on('#other-parties', 'input', (e) => { state.others = e.target.value; });
    on('#test-matter', 'change', (e) => { state.testMatter = e.target.checked; setBar(); });
    on('#back', 'click', async () => { if (pending) return; await call('closeMatter').catch(() => {}); matterClosed(); home(); });
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
      matterClosed();
      state.matterDir = p;
      state.matterExists = null;
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
    offerSettings(() => setup());
  }
  // The foot bar of the setup screen says what is still missing.
  function refreshStartNote() {
    const note = document.getElementById('finish-note');
    if (note && document.getElementById('start')) note.innerHTML = startNote();
  }

  async function matterForm(error, mode, kind = 'bad') {
    const box = document.getElementById('matter-form');
    let info;
    try { info = await call('inspectMatter', { dir: state.matterDir }); } catch (err) { box.innerHTML = message(err.message); return; }
    state.matterExists = info.exists;
    refreshStartNote();
    if (!info.exists && state.afterOpen) { box.innerHTML = message('There is no matter in this folder. Choose the folder that holds the matter key (matter.cloakkey).'); return; }
    if (!info.exists) {
      const mismatch = !!error && /do not match/.test(error);
      box.innerHTML = `${error ? message(error) : ''}
        <p class="small">This folder has no matter yet. Create one:</p>
        <div class="pair"><div class="field"><label for="m-name">Matter name (optional)</label><input type="text" id="m-name" autocomplete="off"></div>
        <div class="field"><label for="m-level">How much to hide</label><select id="m-level"><option value="strict" ${state.level === 'strict' ? 'selected' : ''}>Strict (recommended)</option><option value="standard" ${state.level === 'standard' ? 'selected' : ''}>Standard</option></select></div></div>
        <p class="small hint mb-3">Strict also hides dates, amounts and places. Standard hides names and numbers only.</p>
        <div class="pair"><div class="field"><label for="m-pw">Matter password</label><input type="password" id="m-pw" autocomplete="new-password"><span class="small hint">10 characters or more</span></div>
        <div class="field"><label for="m-pw2">Type it again</label><input type="password" id="m-pw2" autocomplete="new-password"${mismatch ? ' class="invalid" aria-invalid="true"' : ''}></div></div>
        <button class="btn primary" id="m-create" type="button">Create matter</button>`;
      on('#m-create', 'click', async () => {
        const pw = document.getElementById('m-pw').value;
        if (pw !== document.getElementById('m-pw2').value) return matterForm('The two passwords do not match. Type the same password in both boxes.');
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
    box.innerHTML = `${error ? message(error, kind) : ''}
      ${info.remembered && !recovery ? '<p class="small muted mb-3">The password for this matter is remembered on this computer.</p><div class="row"><button class="btn primary" id="m-open-remembered" type="button">Open matter</button><button class="link" id="m-forget" type="button">Forget it</button></div>' : `
      <div class="field"><label for="m-secret">${recovery ? 'Recovery code' : 'Matter password'}</label><input type="${recovery ? 'text' : 'password'}" id="m-secret" autocomplete="off"${error && kind === 'bad' ? ' class="invalid" aria-invalid="true"' : ''}></div>
      ${state.info.canRemember && !recovery ? '<label class="check"><input type="checkbox" id="m-remember"><span>Remember the password on this computer</span></label>' : ''}
      <div class="row mt-3"><button class="btn primary" id="m-open" type="button">Open matter</button><button class="link" id="m-switch" type="button">${recovery ? 'Use the password instead' : 'Forgot the password? Use the recovery code'}</button></div>`}
      <div id="m-locked" class="mt-3"></div>`;
    const open = async (args) => {
      try {
        const r = await call('openMatter', { dir: state.matterDir, ...args });
        state.matter = { name: r.name };
        state.level = r.level || 'strict';
        if (r.setup) { state.client = r.setup.client || ''; state.others = r.setup.others || ''; }
        state.testMatter = !!r.testMatter;
        const next = state.afterOpen || setup;
        // Opened with the recovery code: offer to set a new password before anything else.
        if (r.openedWith === 'recovery') matterSettings({ back: next, recovered: true }); else next();
      } catch (err) {
        if (err.code !== 'LOCKED') return matterForm(err.message, mode);
        await matterForm(err.message, mode, 'warn');
        document.getElementById('m-locked').innerHTML = '<p class="small">If that person has finished (or their computer crashed), you can take the matter over. This is recorded in the log.</p><button class="btn danger small" id="m-takeover" type="button">Take over</button>';
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
    // A new code for a matter that is already open (Matter settings), rather than for a new matter.
    const replaced = !!made.replacedText;
    show(`<div class="narrow">
      <div class="print-sheet-head"><span class="mark" aria-hidden="true"></span>cloak by Lawgistics: matter recovery code</div>
      <h1>Write down the ${replaced ? 'new ' : ''}recovery code</h1>
      <p>This code opens the matter if the password is forgotten. <b>It is shown only once.</b> Print it or write it down, and keep it on the paper file or in the safe.</p>
      ${replaced ? '<div class="msg ok no-print" id="old-code-gone"><b>The old recovery code no longer works.</b> Destroy the old sheet.</div>' : ''}
      <dl class="code-meta"><dt>Matter</dt><dd>${esc(made.name || '(no name)')}</dd>${replaced ? `<dt>Replaced</dt><dd>${esc(made.replacedText)}, by ${esc(made.who)}</dd>` : `<dt>Created</dt><dd>${esc(made.createdText)}, by ${esc(made.who)}</dd>`}</dl>
      <div class="code" id="recovery-code" aria-label="Recovery code">${esc(made.recoveryCode)}</div>
      <p class="msg warn">If both the password and this code are lost, the key cannot be opened by anyone. There is no back door.</p>
      <p class="print-only small">Do not keep this sheet with the cloaked copies or in the matter folder on the computer.</p>
      <div class="row no-print"><button class="btn" id="print" type="button">${icon('print', 'md')}Print this page</button></div>
      <p class="msg warn no-print" id="recovery-wait" hidden>Write the recovery code down first and tick the box. It is shown only once, so Cloak cannot go back to the home screen yet.</p>
      <label class="check no-print mt-4"><input type="checkbox" id="wrote"><span>I have written the ${replaced ? 'new ' : ''}recovery code down</span></label>
      <p class="no-print mt-3"><button class="btn primary" id="continue" type="button" disabled>${icon('lock')}Continue</button></p>
    </div>`);
    on('#print', 'click', () => window.print());
    on('#wrote', 'change', (e) => { const c = document.getElementById('continue'); c.disabled = !e.target.checked; c.querySelector('svg').toggleAttribute('hidden', e.target.checked); });
    on('#continue', 'click', () => { state.recovery = null; (made.then || state.afterOpen || setup)(); });
  }

  // --------------------------------------------------------------- running

  const STAGE = { reading: 'Reading…', read: 'Read', cloaked: 'Done' };
  function drawProgress() {
    const rows = [...state.progress.values()].sort((a, b) => a.index - b.index);
    const done = rows.filter((r) => r.stage !== 'reading').length;
    const total = rows[0]?.total || 0;
    const box = document.getElementById('progress');
    if (!box) return;
    document.getElementById('progress-head').innerHTML = total
      ? `<div class="bigcount"><span class="n">${done}</span><span class="of" id="progress-count">of ${total} files read</span></div><progress value="${done}" max="${total}" aria-label="Files read"></progress>`
      : '<p class="muted" id="progress-count"><span class="spinner" aria-hidden="true"></span> Looking at the folder…</p>';
    box.innerHTML = rows.map((r) => `<tr${r.stage === 'reading' ? ' class="is-active"' : ''}><td class="num">${r.index}</td><td>${escL(r.file)}</td><td>${r.ocr ? '<span class="chip ocr">OCR</span>' : ''}</td><td class="stage">${r.stage === 'reading' ? '<span class="spinner" aria-hidden="true"></span> ' : ''}${STAGE[r.stage]}</td></tr>`).join('');
  }

  async function runCloak() {
    state.progress.clear();
    show(`<div class="wide">
      ${pageHead('Cloaking…', stepper(2, '', 1), ['Reading every part of every file. Nothing leaves this computer.'])}
      <div id="progress-head"></div>
      <div class="mt-4"><table class="progress-table"><thead><tr><th>#</th><th>File</th><th>OCR</th><th>Progress</th></tr></thead><tbody id="progress"></tbody></table></div>
    </div>`);
    drawProgress();
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

  async function act(action) {
    if (state.busy) return;
    state.busy = true;
    try { state.review = await call('action', action); state.exported = null; state.check = null; review(); } catch (err) { review(err.message); } finally { state.busy = false; }
  }

  const STATUS = { cloaked: 'Cloaked', manual: 'Needs manual check', partial: 'Partly read – blocked', unreadable: 'Unreadable – blocked', container: 'Archive opened' };
  const num = (n) => Number(n).toLocaleString('en-GB');

  // An empty state says why it is empty, and what to do.
  const empty = (ic, title, text, button = '') => `<div class="empty">${icon(ic, 'xl')}<h2>${esc(title)}</h2><p>${text}</p>${button}</div>`;

  // What stops the review from being finished, as buttons that jump to the work.
  function blockerList(d) {
    const list = [];
    if (d.unsure.length) list.push({ n: d.unsure.length, label: 'not sure', aria: `${plural(d.unsure.length, 'word', 'words')} on the Not sure list`, tab: 'unsure' });
    if (d.merges.length) list.push({ n: d.merges.length, label: d.merges.length === 1 ? 'joined name' : 'joined names', aria: `${plural(d.merges.length, 'joined name', 'joined names')} to confirm`, tab: 'joined' });
    if (d.shortForms.length) list.push({ n: d.shortForms.length, label: d.shortForms.length === 1 ? 'short form' : 'short forms', aria: `${plural(d.shortForms.length, 'short form', 'short forms')} to check`, tab: 'joined' });
    return list;
  }

  function review(error, notice) {
    const d = state.review;
    const joined = d.merges.length + d.shortForms.length;
    const c = d.doubleCheck || { ran: false };
    const passed = !!(d.complete && c.ran && c.passed);
    const tab = (id, label, n, todo, short) => {
      const cls = todo && typeof n === 'number' ? (n ? 'todo' : 'done') : '';
      return `<button class="tab ${cls}" type="button" role="tab" data-tab="${id}" aria-selected="${state.tab === id}">${short ? `<span class="t-full">${label}</span><span class="t-short">${short}</span>` : label}${n === '' ? '' : `<span class="n"><span>${typeof n === 'number' ? num(n) : n}</span></span>`}</button>`;
    };
    const willExport = d.files.filter((f) => f.willExport).length;
    const blocked = d.files.filter((f) => !f.willExport && f.status !== 'container').length;
    const toDecide = d.unsure.length + joined;
    const [at, count] = !d.complete ? [3, toDecide ? `${toDecide} to decide` : ''] : state.exported ? [6, ''] : passed ? [5, ''] : [4, c.ran && c.counts.undecided ? `${c.counts.undecided} to decide` : ''];
    const meta = [`${icon('file')}${plural(d.files.length, 'file', 'files')} read in ${state.seconds.toFixed(1)} seconds`];
    if (d.source && d.source.label) meta.push(`${icon('cloud')}Source: ${esc(d.source.kind)}${d.source.workspace_path ? `, workspace path ${esc(d.source.workspace_path)}` : ''}, read only`);
    meta.push(state.exported ? `${icon('out')}Exported` : `${icon('out')}Nothing has been exported`);
    show(`<div class="wide has-finish">
      ${pageHead('Review', stepper(at, count), meta)}
      ${screenNote('review')}
      ${error ? message(error) : ''}${notice ? message(notice, 'warn') : ''}
      <div class="card slim">
        <div class="addbar"><label for="add-text">Add a word or name the tool missed</label><input type="text" id="add-text" placeholder="Type it exactly as it appears" autocomplete="off">
          <select id="add-kind" aria-label="What it is"><option value="PERSON">A person</option><option value="COMPANY">A company</option><option value="OTHER">Something else</option></select>
          <button class="btn primary" id="add-go" type="button">Hide it in every file</button></div>
      </div>
      <div class="tabs" role="tablist">
        ${tab('unsure', 'Not sure', d.unsure.length, true)}${tab('joined', 'Joined names', joined, true)}${tab('terms', 'Everything replaced', d.terms.length, false, 'Replaced')}${d.facts?.length ? tab('facts', 'Hidden facts', d.facts.length, false, 'Facts') : ''}${tab('chrono', 'Chronology', state.chrono ? state.chrono.dated : '')}${tab('files', 'Files', d.files.length)}${tab('check', 'Double check', d.doubleCheck?.ran ? d.doubleCheck.counts.undecided : '', true)}
      </div>
      <div id="panel"></div>
      ${state.exported ? `<div class="msg ok" id="exported" role="status">${plural(state.exported.written.length, 'cloaked copy', 'cloaked copies')} written to <b>${esc(state.exported.outDir)}</b>.${state.exported.heldBack ? ` ${plural(state.exported.heldBack, 'file was', 'files were')} held back.` : ''} ${esc(state.exported.doubleCheck?.statement || '')}</div>` : ''}
      ${finishBar(d, willExport, blocked)}
    </div>`);
    on('.tab', 'click', (e) => { state.tab = e.currentTarget.dataset.tab; review(); });
    on('[data-blocker-tab]', 'click', (e) => { state.tab = e.currentTarget.dataset.blockerTab; review(); });
    offerSettings(() => review());
    const add = () => { const text = document.getElementById('add-text').value.trim(); if (text) act({ type: 'add', text, kind: document.getElementById('add-kind').value }); };
    on('#add-go', 'click', add);
    on('#add-text', 'keydown', (e) => { if (e.key === 'Enter') add(); });
    on('#finish', 'click', async () => { try { state.review = await call('complete'); state.check = null; review(); } catch (err) { review(err.message); } });
    // Export runs the double check first. If anything is left to decide, nothing is written and the Double check tab opens.
    const doExport = (only) => async () => {
      const outDir = await call('pickFolder', { title: 'Choose where to save the cloaked copies' });
      if (!outDir) return;
      try {
        state.exported = await call('export', { outDir, only });
        state.review = await call('review');
        state.check = await call('doubleCheckView');
        review();
      } catch (err) {
        if (err.code === 'DOUBLE_CHECK') {
          state.check = await call('doubleCheckView').catch(() => null);
          state.review = await call('review').catch(() => state.review);
          state.tab = 'check';
        }
        review(err.message);
      }
    };
    on('#export', 'click', doExport('all'));
    on('#export-chrono', 'click', doExport('chronology'));
    on('#run-check', 'click', () => { state.tab = 'check'; runCheck(); });
    ({ unsure: panelUnsure, joined: panelJoined, terms: panelTerms, facts: panelFacts, chrono: panelChronology, files: panelFiles, check: panelCheck })[state.tab]();
  }

  // The finish bar, always at the foot: what is left, what will leave the computer, and the next step. Blockers are buttons that jump to the work.
  function finishBar(d, willExport, blocked) {
    const leaves = `<div class="leaves"><span>On export</span><b>${plural(willExport, 'file leaves', 'files leave')}</b>${blocked ? `<span>${blocked} held back</span>` : ''}</div>`;
    if (!d.complete) {
      const list = blockerList(d);
      const buttons = list.map((b) => `<button class="blocker" type="button" data-blocker-tab="${b.tab}" aria-label="${esc(b.aria)}"><b>${num(b.n)}</b> ${b.label}</button>`).join('');
      const more = list.length > 1 ? `<button class="blocker more" type="button" data-blocker-tab="${list[0].tab}" aria-label="${list.length - 1} more things to finish. Open the first."><b>+${list.length - 1}</b> more</button>` : '';
      return `<div class="finish ${list.length ? 'is-blocked' : 'is-ready'}${list.length > 2 ? ' many' : ''}">
        <div class="finish-note" id="finish-note">${list.length ? `<span class="finish-lead">Before you can finish</span><div class="blockers">${buttons}${more}</div>` : `<span class="finish-lead">Everything is decided</span><span>${plural(willExport, 'file', 'files')} will be exported${blocked ? ` and ${blocked} held back` : ''}.</span>`}</div>
        ${leaves}
        <div class="row"><button class="btn primary" id="finish" type="button" ${list.length ? 'disabled' : ''}>${list.length ? icon('lock') : ''}Finish review</button></div></div>`;
    }
    const c = d.doubleCheck || { ran: false };
    const passed = c.ran && c.passed;
    const undecided = c.ran && !c.passed ? c.counts.undecided : 0;
    const note = !c.ran ? '<span class="long" id="check-state">Next: the double check. It also runs when you export.</span>'
      : passed ? `<span class="chip cloaked" id="check-state">Double check passed</span><span class="long">${esc(c.whenText)}.${c.counts.places ? ` ${plural(c.counts.places, 'finding', 'findings')} marked fine by a person.` : ' Nothing left to decide.'}${c.hidden ? ` ${plural(c.hidden, 'finding', 'findings')} hidden during the check.` : ''}</span>`
        : `<span class="long" id="check-state">Double check: ${c.counts.undecided} to decide.</span>`;
    const exporting = state.chrono?.confirmed
      ? `<button class="btn ${passed ? 'primary' : ''}" id="export-chrono" type="button">${icon('out')}<span class="c-full">Export the chronology only (recommended)</span><span class="c-short">Chronology only</span></button><button class="btn" id="export" type="button"><span class="c-full">Export all files…</span><span class="c-short">All files…</span></button>`
      : `<button class="btn ${passed ? 'primary' : ''}" id="export" type="button">${icon('out')}<span class="c-full">Export cloaked copies…</span><span class="c-short">Export…</span></button>`;
    const lead = state.exported ? 'Exported' : undecided ? 'Export waits' : 'Review finished';
    const by = state.exported || undecided || passed ? '' : `<span class="long">by ${esc(d.complete.by)} on ${esc(d.complete.whenText)}.</span>`;
    const blockersHtml = undecided ? `<div class="blockers"><button class="blocker" type="button" data-blocker-tab="check" aria-label="${plural(undecided, 'finding', 'findings')} in ${plural(c.counts.filesFailing, 'file', 'files')} to decide"><b>${undecided}</b> ${undecided === 1 ? 'finding' : 'findings'} in ${plural(c.counts.filesFailing, 'file', 'files')}</button></div>` : '';
    return `<div class="finish ${state.exported ? 'is-exported' : undecided ? 'is-blocked' : passed ? 'is-ready' : 'is-done'}">
      <div class="finish-note" id="finish-note"><span class="finish-lead">${lead}</span>${by}${note}${blockersHtml}</div>
      ${leaves}
      <div class="row"><button class="btn ${passed ? '' : 'primary'}" id="run-check" type="button" ${state.checking ? 'disabled' : ''}>${c.ran ? 'Run the double check again' : 'Run the double check'}</button>${exporting}</div></div>`;
  }

  function panel(html) { document.getElementById('panel').innerHTML = html; }

  // The few words around the word to decide, with the word marked. The engine already cuts the excerpt to about 100 characters.
  function excerpt(text, word) {
    // The engine cuts at a fixed length: a tag cut in half at either end is dropped.
    text = text.replace(/\{\{[^}]*$/, '…').replace(/^…?[^{]*?\}\}/, (m) => (m.includes('{{') ? m : '…'));
    const at = text.indexOf(word);
    if (at < 0) return langRuns(tags(text));
    return langRuns(`${tags(text.slice(0, at))}<mark>${esc(word)}</mark>${tags(text.slice(at + word.length))}`);
  }
  const scriptChip = (word) => (/[؀-ࣿﭐ-ﻼ]/.test(word) ? '<span class="chip kind">Jawi script</span>' : /[஀-௿]/.test(word) ? '<span class="chip kind">Tamil script</span>' : /[㐀-鿿豈-﫿]/.test(word) ? '<span class="chip kind">Chinese script</span>' : '');

  function panelUnsure() {
    const d = state.review;
    if (!d.unsure.length) return panel(empty('check', 'Nothing left to decide', 'Nothing left that the tool is unsure about.'));
    panel(`<div class="decide">
      <div class="decide-head"><span><b>${plural(d.unsure.length, 'word', 'words')}</b> to decide. Your answer applies to every file and is remembered for this matter.</span></div>
      ${d.unsure.map((u, i) => `<div class="decide-row"><div class="what"><div class="word"><b>${escL(u.text)}</b>${scriptChip(u.text)}</div>
        ${u.examples.slice(0, 1).map((x) => `<div class="example">${excerpt(x, u.text)}</div>`).join('')}
        <div class="meta">${u.where ? `<span class="where">${escL(u.where)}${u.files > 1 ? ` and ${u.files - 1} more` : ''}</span>` : ''}<span><b>${num(u.places)}</b> ${u.places === 1 ? 'place' : 'places'} in <b>${num(u.files)}</b> ${u.files === 1 ? 'file' : 'files'}</span></div></div>
        <div class="actions"><span class="seg-label" id="hl${i}">Hide as</span><div class="seg" role="group" aria-labelledby="hl${i}"><button type="button" data-hide="${i}" data-kind="PERSON">Person</button><button type="button" data-hide="${i}" data-kind="COMPANY">Company</button><button type="button" data-hide="${i}" data-kind="OTHER">Other</button></div><span class="fine"><button class="btn" type="button" data-fine="${i}">It's fine</button></span></div></div>`).join('')}
    </div>`);
    on('[data-hide]', 'click', (e) => act({ type: 'add', text: d.unsure[+e.currentTarget.dataset.hide].text, kind: e.currentTarget.dataset.kind }));
    on('[data-fine]', 'click', (e) => act({ type: 'fine', text: d.unsure[+e.currentTarget.dataset.fine].text }));
  }

  function panelJoined() {
    const d = state.review;
    if (!d.merges.length && !d.shortForms.length) return panel(empty('check', 'No joined names waiting', 'No joined names waiting to be checked.'));
    // Variants that differ only in punctuation or spacing can be confirmed together.
    // "(M)", a different ending or a different spelling is always its own decision.
    const groups = new Map();
    for (const m of d.merges.filter((x) => x.onlyPunctuation)) groups.set(m.into, [...(groups.get(m.into) || []), m]);
    const grouped = new Set([...groups].filter(([, list]) => list.length >= 2).map(([into]) => into));
    const single = d.merges.filter((m) => !(m.onlyPunctuation && grouped.has(m.into)));
    const acts = (yes, no) => `<td class="act"><div class="row tight">${yes}${no}</div></td>`;
    panel(`<p class="muted small mb-3 panel-intro">The tool gave these the same tag because they look like the same person or company. Confirm each one, or split it off.</p>
      ${[...grouped].map((into) => { const list = groups.get(into); return `<div class="card group-card"><div class="row between"><div><b>${plural(list.length, 'variant', 'variants')} of ${escL(list[0].intoValue)}</b> ${tagHtml(into)}
        <div class="small muted mt-2 gc-sub">These differ only in punctuation or spacing:</div>
        <div class="taglist mt-2">${list.map((m) => `<span class="chip kind">${escL(m.value)}</span>`).join('')}</div></div>
        <button class="btn small primary" data-group="${esc(into)}" type="button">Confirm all ${list.length} in this group</button></div></div>`; }).join('')}
      ${single.length || d.shortForms.length ? `<table class="joined-table"><thead><tr><th>This</th><th>was joined to</th><th>Why</th><th></th></tr></thead><tbody>
      ${single.map((m) => `<tr><td><b>${escL(m.value)}</b><br>${tagHtml(m.tag)}</td><td>${escL(m.intoValue)}<br>${tagHtml(m.into)}</td><td class="small why">${esc(m.reason)}</td>
        ${acts(`<button class="btn small primary" data-same="${esc(m.tag)}" type="button">Same</button>`, `<button class="btn small" data-split="${esc(m.tag)}" type="button">Different: split</button>`)}</tr>`).join('')}
      ${d.shortForms.map((a, i) => `<tr><td><b>${escL(a.value)}</b><br>${tagHtml(a.tag)}</td><td>${escL(a.belongsToValue)}<br>${tagHtml(a.belongsTo)}</td><td class="small why">This short form could also mean ${escL(a.alsoValue)}.</td>
        ${acts(`<button class="btn small primary" data-short-ok="${i}" type="button">That's right</button>`, `<button class="btn small" data-short-split="${i}" type="button">Give it its own tag</button>`)}</tr>`).join('')}
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
    const places = form ? form.places : term.places;
    const files = form ? form.files : term.files;
    const where = `${plural(places, 'place', 'places')} in ${plural(files, 'file', 'files')}`;
    const yes = await confirmDialog({
      title: 'Stop hiding this?',
      step: term.patternRule ? 1 : 0,
      kind: term.patternRule ? '<span class="chip manual">Number or ID</span>' : '',
      ledger: [['Hidden now as', tagHtml(tag)], ['Will be shown as', escL(value), true], ['Where', where]],
      leaves: `<b>It will leave this computer.</b> It will be in the exported copies, in ${whole ? 'every place it appears' : 'every place this form of it appears'}.`,
      notes: [...(term.patternRule ? [{ icon: 'info', html: `Cloak found it because it looks like ${esc(TYPE_WORDS[term.type] ? `a ${TYPE_WORDS[term.type]}` : 'a number or identifier')}. <b>You will be asked once more.</b>` }] : []), recorded()],
      yes: 'Yes, stop hiding it',
    });
    if (!yes) return;
    let confirmations = 1;
    if (term.patternRule) {
      const sure = await confirmDialog({ title: 'Are you sure?', step: 2, body: `Cloak found <b>${esc(value)}</b> because it looks like a ${esc(TYPE_WORDS[term.type] || 'number or identifier')}. That kind of detail identifies a person or an account. If you go ahead it goes out in the exported copies.`, leaves: `<b>Leaves this computer:</b> ${esc(value)}, in ${where}.`, yes: 'Yes, show it', danger: true });
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
    panel(`<div class="tablebar"><label class="vh" for="filter">Search by name or tag</label><input type="search" id="filter" placeholder="Search ${num(d.terms.length)} names and tags" value="${esc(state.filter)}" autocomplete="off"></div>
      ${list.length ? `<table><thead><tr><th>Tag</th><th>Real value</th><th>Found by</th><th class="num">Places</th><th class="num">Files</th><th></th></tr></thead><tbody>
      ${list.map((t) => `<tr>
        <td class="nowrap">${tagHtml(t.tag)}</td>
        <td><b>${escL(t.value)}</b>${t.forms.length > 1 ? ` <button class="link small" data-open="${esc(t.tag)}" type="button">${state.openTag === t.tag ? 'hide' : `+ ${t.forms.length - 1} other form${t.forms.length > 2 ? 's' : ''}`}</button>` : ''}</td>
        <td class="small muted">${esc(t.how)}${t.patternRule ? ' <span class="chip manual">Asks twice</span>' : ''}</td><td class="num">${num(t.places)}</td><td class="num">${num(t.files)}</td>
        <td class="act"><div class="row tight"><button class="btn small ${t.patternRule ? 'danger' : 'quiet'}" data-remove="${esc(t.tag)}" type="button">${icon('eyeoff')}Don't hide</button>
          <select class="merge" data-merge="${esc(t.tag)}" aria-label="Merge ${esc(t.value)} into another tag"><option value="">Same as…</option>${d.terms.filter((o) => o.type === t.type && o.tag !== t.tag).map((o) => `<option value="${esc(o.tag)}">${esc(o.value)} (${esc(o.tag)})</option>`).join('')}</select></div></td></tr>
        ${state.openTag === t.tag ? t.forms.filter((f) => f.tag !== t.tag).map((f) => `<tr class="sub"><td>${tagHtml(f.tag)}</td><td>${escL(f.value)}</td><td></td><td class="num">${num(f.places)}</td><td class="num">${num(f.files)}</td>
          <td class="act"><div class="row tight"><button class="btn small quiet" data-remove="${esc(f.tag)}" type="button">Don't hide this form</button><button class="btn small" data-split-form="${esc(f.tag)}" type="button">Split off</button></div></td></tr>`).join('') : ''}`).join('')}
      </tbody></table>` : empty('search', `No name or tag matches “${state.filter}”`, 'Try part of the name, or clear the search to see everything that was replaced.', '<button class="btn small mt-2" id="clear-filter" type="button">Clear the search</button>')}
      ${list.length < matching.length ? `<p class="tablefoot">Showing ${num(list.length)} of ${num(matching.length)}. Use the search box, or <button class="link" id="show-all" type="button">show them all</button>.</p>` : ''}
      ${d.kept.length ? `<p class="small muted">Left as they are, at a reviewer's request: ${d.kept.map(esc).join(', ')}. To hide one again, add it in the box above.</p>` : ''}`);
    on('#filter', 'input', (e) => { state.filter = e.target.value; const at = e.target.selectionStart; panelTerms(); const f = document.getElementById('filter'); f.focus(); f.setSelectionRange(at, at); });
    on('#clear-filter', 'click', () => { state.filter = ''; panelTerms(); });
    on('[data-open]', 'click', (e) => { state.openTag = state.openTag === e.currentTarget.dataset.open ? null : e.currentTarget.dataset.open; panelTerms(); });
    on('#show-all', 'click', () => { state.showAll = true; panelTerms(); });
    on('[data-remove]', 'click', (e) => removeTerm(e.currentTarget.dataset.remove));
    on('[data-split-form]', 'click', (e) => act({ type: 'split', tag: e.currentTarget.dataset.splitForm }));
    on('[data-merge]', 'change', (e) => { if (e.target.value) act({ type: 'merge', from: e.target.dataset.merge, into: e.target.value }); });
  }

  const FILE_FILTERS = [['all', 'All', () => true], ['check', 'To check', (f) => f.status === 'manual' && !f.checkedBy], ['blocked', 'Blocked', (f) => !f.willExport && f.status !== 'container'], ['ocr', 'OCR', (f) => f.ocr.length > 0]];

  function panelFiles() {
    const d = state.review;
    const q = state.fileSearch.trim().toLowerCase();
    const filter = FILE_FILTERS.find((x) => x[0] === state.fileFilter) || FILE_FILTERS[0];
    const shown = d.files.filter((f) => filter[2](f) && (!q || f.name.toLowerCase().includes(q) || String(f.number).includes(q)));
    const LIMIT = 300;
    const list = state.showAllFiles || shown.length <= LIMIT ? shown : shown.slice(0, LIMIT);
    const row = (f) => `<tr>
      <td class="num">${f.number}</td>
      <td>${escL(f.name)}${f.inside ? `<span class="reason">${esc(f.inside)}</span>` : ''}${f.reasons.map((r) => `<span class="reason">${esc(r)}</span>`).join('')}</td>
      <td class="nowrap res"><span class="chip ${f.status}">${STATUS[f.status] || esc(f.status)}</span>${f.nonLatinShowing ? `<div class="mt-2"><span class="chip manual">${f.nonLatinShowing} non-Latin character${f.nonLatinShowing === 1 ? '' : 's'} showing</span></div>` : ''}${f.nonLatinHidden ? '<div class="mt-2"><span class="chip cloaked">Non-Latin text hidden</span></div>' : ''}${f.checkedBy ? `<span class="reason">Checked by ${esc(f.checkedBy.by)}<br>${esc(f.checkedBy.whenText)}</span>` : ''}</td>
      <td class="small nowrap read">${f.found ? `<span class="rd">${f.read} of ${f.found} ${esc(f.unit)}</span>` : ''}${f.characters ? `<span class="rd">${f.characters.toLocaleString()} characters</span>` : ''}${f.ocr.length ? `<span class="rd"><span class="chip ocr">OCR</span> ${esc(f.ocr.join(', '))}</span>` : ''}${f.fromCache ? '<span class="rd muted">not re-read (unchanged)</span>' : ''}</td>
      <td>${f.nonLatinShowing ? `<div class="row tight"><button class="btn small primary" data-hide-nl="${f.number}" type="button">Hide all non-Latin text</button>` : ''}${f.status === 'manual' && !f.checkedBy ? `<button class="btn small ${f.nonLatinShowing ? '' : 'primary'}" data-check="${f.number}" type="button">Check this file…</button>` : f.status === 'cloaked' || f.checkedBy ? `<button class="btn small" data-view="${f.number}" type="button">View cloaked text</button>` : ''}${f.nonLatinShowing ? '</div>' : ''}</td></tr>`;
    panel(`<div class="tablebar"><label class="vh" for="filesearch">Find a file</label><input type="search" id="filesearch" placeholder="Find a file by name" value="${esc(state.fileSearch)}" autocomplete="off"><div class="filters" role="group" aria-label="Show">${FILE_FILTERS.map(([id, label, test]) => `<button class="filter" type="button" data-file-filter="${id}" aria-pressed="${filter[0] === id}">${label}<b>${num(d.files.filter(test).length)}</b></button>`).join('')}</div></div>
      ${list.length ? `<table class="files-table"><thead><tr><th class="num">#</th><th>File</th><th>Result</th><th>Read</th><th></th></tr></thead><tbody>${list.map(row).join('')}</tbody></table>`
        : empty('search', q ? `No file matches “${state.fileSearch}”` : 'No files here', q ? `Try part of the file name, or clear the filter to see all ${num(d.files.length)} files.` : 'No file is in this group.', '<button class="btn small mt-2" id="clear-files" type="button">Clear the search</button>')}
      ${list.length < shown.length ? `<p class="tablefoot">Showing ${num(list.length)} of ${num(shown.length)}. Use the search box or a filter to find the rest, or <button class="link" id="show-all-files" type="button">show them all</button>.</p>` : ''}`);
    on('#filesearch', 'input', (e) => { state.fileSearch = e.target.value; const at = e.target.selectionStart; panelFiles(); const f = document.getElementById('filesearch'); f.focus(); f.setSelectionRange(at, at); });
    on('[data-file-filter]', 'click', (e) => { state.fileFilter = e.currentTarget.dataset.fileFilter; panelFiles(); });
    on('#clear-files', 'click', () => { state.fileSearch = ''; state.fileFilter = 'all'; panelFiles(); });
    on('#show-all-files', 'click', () => { state.showAllFiles = true; panelFiles(); });
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
    const lock = icon('lock');
    overlay.innerHTML = `<div class="dialog viewer" role="dialog" aria-modal="true" aria-labelledby="vt">
      <div class="viewer-head"><div><h2 id="vt">${escL(f.name)}</h2>${row ? `<span class="chip ${showing && approve ? 'manual' : row.status}">${showing && approve ? `${showing} non-Latin character${showing === 1 ? '' : 's'} showing` : STATUS[row.status] || esc(row.status)}</span>` : ''}</div></div>
      ${f.reasons.map((r) => message(r, 'warn')).join('')}
      ${approve ? '<p class="small">This is the cloaked text as it would be exported. Read it against the original. If a name is still showing, close this, add it in the box at the top, and come back.</p>' : ''}
      <pre class="filetext">${langRuns(tags(f.text), 'nonlatin')}</pre>
      ${approve && showing ? `<div class="msg warn"><b>${showing} character${showing === 1 ? '' : 's'} of non-Latin text (Chinese, Tamil or similar) ${showing === 1 ? 'is' : 'are'} still showing.</b> Cloak cannot check names in those scripts. The safe choice is to hide every passage: each becomes one tag and is put back when you restore a draft.</div>
        <div class="row mt-3" id="safe-row"><button class="btn primary" id="hide-nl" type="button">Hide all non-Latin text in this file</button><button class="btn" id="close" type="button">Close</button></div>
        <details class="more" open><summary>Approve it with the non-Latin text showing</summary>
          <p class="small">The text will go out as written. Only do this if you have read it and it identifies no one. Type <b>APPROVE</b> to confirm.</p>
          <div class="typed"><label class="vh" for="typed">Type APPROVE</label><input type="text" id="typed" autocomplete="off" placeholder="APPROVE"><button class="btn" id="approve" type="button" disabled>${lock}Approve this file</button></div></details>`
    : approve ? `<label class="check"><input type="checkbox" id="checked"><span>I have read this file against the original and it is safe to export</span></label>
        <div class="row"><button class="btn" id="close" type="button">Close</button><button class="btn primary" id="approve" type="button" disabled>${lock}Approve this file</button></div>`
      : '<div class="row"><button class="btn" id="close" type="button">Close</button></div>'}</div>`;
    document.body.appendChild(overlay);
    lockMain(true);
    const close = () => { lockMain(false); document.removeEventListener('keydown', onKey); overlay.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    // The lock shows only while Approve is locked.
    const setApprove = (ok) => { const b = overlay.querySelector('#approve'); b.disabled = !ok; b.querySelector('svg')?.toggleAttribute('hidden', ok); };
    overlay.querySelector('#close').addEventListener('click', close);
    overlay.querySelector('#checked')?.addEventListener('change', (e) => setApprove(e.target.checked));
    overlay.querySelector('#typed')?.addEventListener('input', (e) => setApprove(e.target.value.trim().toUpperCase() === 'APPROVE'));
    overlay.querySelector('#hide-nl')?.addEventListener('click', async () => {
      try { state.review = await call('action', { type: 'hideNonLatin', number }); close(); viewFile(number, true); } catch (err) { close(); review(err.message); }
    });
    overlay.querySelector('#approve')?.addEventListener('click', async () => {
      try { state.review = await call('approve', { number, confirmation: overlay.querySelector('#typed')?.value || '' }); close(); review(); } catch (err) { close(); review(err.message); }
    });
    (overlay.querySelector('#close') || overlay).focus();
  }


  // ------------------------------------------------------- hidden facts

  const KIND_WORDS = { date: 'Date', amount: 'Amount', ref: 'Reference number', percent: 'Percentage', place: 'Place', project: 'Project name', job: 'Job title', court: 'Court or judge' };

  async function panelFacts() {
    const d = state.review;
    panel(`<p class="muted small mb-3 panel-intro">These dates, amounts, reference numbers, places and titles are hidden because this matter is Strict. They are kept apart from the names. Show one only if a draft needs it: the matter records who did it and when.</p>
      <table><thead><tr><th>Tag</th><th>What</th><th>As written</th><th class="num">Where</th><th></th></tr></thead><tbody>${d.facts.map((r, i) => `<tr>
        <td class="nowrap">${tagHtml(r.tag)}</td><td>${esc(KIND_WORDS[r.kind] || r.kind)}</td>
        <td>${r.forms.map((f) => `${escL(f.surface)} <span class="muted small">${plural(f.count, 'place', 'places')}</span>`).join('<br>')}</td>
        <td class="num">${plural(r.count, 'place', 'places')}</td>
        <td class="act">${r.unblurred ? `<span class="chip manual">Shown</span> <button class="btn small" data-reblur="${i}" type="button">Hide again</button>` : `<button class="btn small" data-unblur="${i}" type="button">Show this one</button>`}</td></tr>`).join('')}</tbody></table>`);
    on('[data-unblur]', 'click', async (e) => {
      const r = d.facts[+e.currentTarget.dataset.unblur];
      const surface = r.forms.map((f) => f.surface).join(' · ');
      const yes = await confirmDialog({ title: 'Show this fact?', ledger: [['Hidden now as', tagHtml(r.tag)], ['Will be shown as', escL(surface), true], ['Where', plural(r.count, 'place', 'places')]], leaves: '<b>It will leave this computer</b> as written, in every file and in the exported copies.', notes: [recorded()], yes: 'Yes, show it', danger: true });
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
      // "Date (for example ...)": the example is a quiet hint after the label.
      const label = (text) => { const m = /^(.*?)\s*(\(.*\))$/.exec(text); return m ? `${esc(m[1])} <span class="muted small">${esc(m[2])}</span>` : esc(text); };
      o.innerHTML = `<div class="dialog narrow-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dt"><h2 id="dt">${esc(title)}</h2>${fields.map((f) => `<div class="field"><label for="fd-${f.id}">${label(f.label)}</label>${f.rows ? `<textarea id="fd-${f.id}" rows="${f.rows}" class="serif">${esc(f.value || '')}</textarea>` : `<input type="text" id="fd-${f.id}" value="${esc(f.value || '')}" autocomplete="off">`}</div>`).join('')}<div class="row"><button class="btn" id="fd-no" type="button">Cancel</button><button class="btn primary" id="fd-yes" type="button">${esc(yes)}</button></div></div>`;
      document.body.appendChild(o);
      lockMain(true);
      const done = (v) => { document.removeEventListener('keydown', onKey); lockMain(false); o.remove(); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', onKey);
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
    state.check = null;
    review();
  }

  async function panelChronology() {
    panel('<p class="muted"><span class="spinner" aria-hidden="true"></span> Loading…</p>');
    try { state.chrono = await call('chronology', { undated: state.showUndated }); } catch (err) { return panel(message(err.message)); }
    drawChronology();
  }

  function drawChronology(error) {
    const c = state.chrono;
    if (!c) {
      panel(empty('clock', 'No chronology yet', 'Cloak reads every sentence with a date, an amount of money or a named person or company, and puts them in one table sorted by date. Rows about the same event are grouped, and rows that disagree are flagged. No AI is used.', '<button class="btn primary mt-3" id="chrono-build" type="button">Build the chronology</button>'));
      return on('#chrono-build', 'click', async () => {
        try { state.chrono = await call('chronology', { build: true, undated: state.showUndated }); state.review = await call('review'); review(); } catch (err) { drawChronology(); panel(`${message(err.message)}${document.getElementById('panel').innerHTML}`); }
      });
    }
    const people = (r) => (r.people.length ? r.people.map((p) => `<span class="pn">${escL(p)}</span>`).join('') : '<span class="pn"><span class="muted">-</span></span>');
    panel(`${error ? message(error) : ''}
      ${c.missing.length ? `<div class="msg warn" id="chrono-missing"><details><summary><b>Events in these files are missing from this chronology.</b> <span class="sum-link">Show the ${plural(c.missing.length, 'file', 'files')}</span></summary><ul>${c.missing.map((m) => `<li>${escL(m.file)} <span class="muted">(${esc(m.why)})</span></li>`).join('')}</ul></details></div>` : ''}
      <div class="chrono-bar"><span>${plural(c.dated, 'row', 'rows')} with a date${c.notUnderstood ? `, ${plural(c.notUnderstood, 'row', 'rows')} whose date Cloak could not read (read them by hand)` : ''}${c.conflicts ? `, ${plural(c.conflicts, 'row', 'rows')} that may conflict` : ''}. ${c.undated ? `${plural(c.undated, 'row', 'rows')} with no date ${state.showUndated ? 'are shown below' : 'are hidden'}. <button class="link" id="toggle-undated" type="button">${state.showUndated ? 'Hide them' : `Show the ${c.undated} rows with no date`}</button>` : ''}</span></div>
      <div class="chrono-bar"><button class="btn small" id="chrono-merge" type="button" disabled>Merge selected rows</button><button class="btn small" id="chrono-add" type="button">${icon('plus')}Add a row</button><span class="spacer"></span><span class="chrono-key" aria-label="What the chips mean"><span class="chip group">same event</span><span class="chip partial">possible conflict</span><span class="chip manual">no year</span><span class="chip partial">date not understood</span><span class="chip container">range</span></span></div>
      <table id="chrono-table"><thead><tr><th><span class="vh">Select</span></th><th>Date</th><th>What happened</th><th>People</th><th>Source</th><th></th></tr></thead><tbody>${c.rows.map((r) => `<tr data-row="${esc(r.id)}"${r.conflict ? ' class="is-conflict"' : ''}>
        <td><input type="checkbox" data-pick="${esc(r.id)}" aria-label="Select this row"></td>
        <td class="date">${r.date ? esc(r.date) : '<span class="muted">no date</span>'}${r.dateNote ? '<span class="chip partial">date not understood</span>' : ''}${r.precision === 'dm' ? '<span class="chip manual">no year</span>' : ''}${r.precision === 'range' ? '<span class="chip container">range</span>' : ''}</td>
        <td class="event">${escL(r.event)}${r.group ? ` <span class="chip group">same event ${esc(r.group)}</span>` : ''}${r.conflict ? `<div class="conflict">possible conflict: ${esc(r.conflict.why.join('; '))}</div>` : ''}${r.relative.length ? `<div class="small muted">relative date: ${esc(r.relative.join('; '))}</div>` : ''}</td>
        <td class="people">${people(r)}</td><td class="source">${r.source.map(escL).join('<br>')}</td>
        <td><div class="row-actions"><button class="btn small" data-edit="${esc(r.id)}" type="button">Edit</button><button class="btn small danger" data-delete="${esc(r.id)}" type="button">Delete</button></div></td></tr>`).join('')}</tbody></table>
      <div class="card confirm-card" id="chrono-confirm">${c.confirmed ? `<span class="chip cloaked">Confirmed</span> by ${esc(c.confirmed.by)} on ${esc(c.confirmed.whenText)}. Any change takes the confirmation away.` : `<p>When the table is right, confirm it. The confirmed table is exported as its own cloaked document, and is the recommended thing to send for drafting.</p><button class="btn primary" id="chrono-confirm-go" type="button">Confirm the chronology</button>`}</div>`);
    on('#toggle-undated', 'click', () => { state.showUndated = !state.showUndated; panelChronology(); });
    const picked = () => [...main.querySelectorAll('[data-pick]:checked')].map((x) => x.dataset.pick);
    on('[data-pick]', 'change', (e) => {
      e.target.closest('tr').classList.toggle('is-selected', e.target.checked);
      const n = picked().length;
      const merge = document.getElementById('chrono-merge');
      merge.disabled = n < 2;
      merge.textContent = n >= 2 ? `Merge ${n} selected rows` : 'Merge selected rows';
    });
    const guard = (fn) => async (...a) => { try { await fn(...a); } catch (err) { drawChronology(err.message); } };
    on('#chrono-merge', 'click', guard(() => chronoCall({ type: 'merge', ids: picked() })));
    on('#chrono-confirm-go', 'click', guard(() => chronoCall({ type: 'confirm' })));
    on('[data-delete]', 'click', guard(async (e) => {
      const id = e.currentTarget.dataset.delete;
      const row = c.rows.find((r) => r.id === id);
      const yes = await confirmDialog({ title: 'Delete this row?', small: true, body: 'It is taken out of the chronology. It is kept in the matter (so it can be put back) but is not exported.', notes: [...(row ? [{ icon: 'clock', html: `${row.date ? `${esc(row.date)}. ` : ''}${escL(row.event)}` }] : []), recorded()], yes: 'Delete the row' });
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

  // ------------------------------------------------------- the double check

  // A second check of everything that would be exported. Its findings show the real words, on this screen only.
  async function runCheck() {
    if (state.busy) return;
    state.busy = true;
    state.checking = true;
    review();
    try {
      state.check = await call('doubleCheck');
      state.review = await call('review');
      state.checking = false;
      review();
    } catch (err) {
      state.checking = false;
      review(err.message);
    } finally { state.busy = false; }
  }

  async function decide(key, decision, kind) {
    if (state.busy) return;
    state.busy = true;
    try {
      const r = await call('decideFinding', { key, decision, kind });
      state.check = r.check;
      state.review = r.review;
      state.exported = null;
      if (r.reopened) {
        state.tab = r.review.unsure.length ? 'unsure' : r.review.merges.length + r.review.shortForms.length ? 'joined' : 'check';
        review(null, 'Hiding it gave the review something new to decide. Decide it, finish the review, then run the double check again.');
      } else review();
    } catch (err) { review(err.message); } finally { state.busy = false; }
  }

  const CHECK_WORDS = { key: 'In the key', fact: 'Fact', pattern: 'Number or ID', name: 'Possible name', tag: 'Tag problem' };

  async function panelCheck() {
    const d = state.review;
    if (!d.complete) return panel('<div class="msg warn" id="check-wait" role="status">Finish the review first. The double check reads exactly what would be exported.</div>');
    if (state.checking) return panel('<p id="check-running"><span class="spinner" aria-hidden="true"></span> Running the double check on every file that would be exported…</p>');
    if (!state.check) {
      try { state.check = await call('doubleCheckView'); } catch (err) { return panel(message(err.message)); }
    }
    drawCheck();
  }

  function drawCheck() {
    const c = state.check?.ran ? state.check : null;
    const intro = '<p class="muted small mb-3 dc-intro">A second, separate check of everything that would be exported: each cloaked copy, the context sheet, the chronology, the file names and the report. It looks again for every value in the key (in any format), for numbers that look like an NRIC, phone, account or case number, and for anything that still looks like a name, in every part of every file. No AI is used. For each finding, hide it or say it is fine. Export waits until every file passes or every finding is decided.</p>';
    if (!c) {
      panel(`${intro}<button class="btn primary" id="check-go" type="button">Run the double check</button>`);
      return on('#check-go', 'click', runCheck);
    }
    const where = (p) => `<div class="place"><div class="loc"><b>${escL(p.title)}</b><span class="vh"> · </span>${esc(p.part)} · line ${p.line}</div><div class="excerpt">${langRuns(`${tags(p.excerpt.slice(0, p.mark[0]))}<span class="found">${esc(p.excerpt.slice(p.mark[0], p.mark[1]))}</span>${tags(p.excerpt.slice(p.mark[1]))}`)}</div></div>`;
    const decided = (g) => g.places.find((p) => p.decided)?.decided;
    // Files that fail come first; the findings come before the list of files.
    const units = [...c.units.filter((u) => u.status === 'fail'), ...c.units.filter((u) => u.status !== 'fail')];
    const failing = c.counts.filesFailing;
    panel(`${intro}
      <p id="check-summary" class="mb-3">${c.passed ? '<span class="chip cloaked">Passed</span>' : '<span class="chip partial">Not passed yet</span>'} Checked ${esc(c.whenText)} by ${esc(c.by)}: ${plural(c.counts.files, 'file', 'files')}, ${plural(c.counts.places, 'finding', 'findings')}${c.counts.undecided ? `, <b>${c.counts.undecided} still to decide</b>` : ''}.</p>
      <div class="dc-stats"><div class="dc-stat"><span class="n">${num(c.counts.files)}</span><span class="l">files checked</span></div><div class="dc-stat good"><span class="n">${num(c.counts.files - failing)}</span><span class="l">passed</span></div><div class="dc-stat"><span class="n">${num(failing)}</span><span class="l">failed</span></div><div class="dc-stat${c.counts.undecided ? ' todo' : ''}"><span class="n">${num(c.counts.undecided)}</span><span class="l">findings still to decide</span></div></div>
      <p class="show-real mb-3">${icon('eye', 'md')}The real words show on this screen only. Nothing here is exported.</p>
      <div class="dc-layout"><aside class="dc-files" aria-label="Files"><div class="head"><span>Files</span><span>fails first</span></div>
        <ul id="check-files">${units.map((u) => `<li data-unit="${esc(u.title)}"><span class="nm">${escL(u.id)}</span>${u.status === 'pass' ? '<span class="stamp pass">Pass</span>' : '<span class="stamp fail">Fail</span>'}<span class="sub2">${esc(u.title)}${u.status === 'pass' ? (u.findings ? ' · every finding decided' : '') : ` · ${plural(u.undecided, 'finding', 'findings')} to decide`}</span></li>`).join('')}</ul></aside>
      <div id="check-findings">${c.groups.length ? c.groups.map((g, i) => `<article class="finding ${g.undecided ? 'is-open' : 'is-decided'}" data-finding="${i}" data-titles="${esc(JSON.stringify(g.places.map((p) => p.title)))}"><div class="top"><div class="what"><div class="value"><span class="chip ${g.undecided ? 'manual' : 'kind'}">${esc(CHECK_WORDS[g.check] || g.check)}</span><b class="serif">${escL(g.value)}</b></div>
          <div class="why">${tags(g.what)}</div></div>
          ${g.undecided ? `<div class="row tight">${g.fixable ? `${g.check === 'name' ? `<label class="vh" for="dck${i}">Hide it as</label><select class="merge" id="dck${i}" data-dc-kind="${i}"><option value="PERSON" ${g.hideAs === 'PERSON' ? 'selected' : ''}>as a person</option><option value="COMPANY" ${g.hideAs === 'COMPANY' ? 'selected' : ''}>as a company</option><option value="OTHER" ${g.hideAs === 'OTHER' ? 'selected' : ''}>as something else</option></select>` : ''}<button class="btn primary small" data-dc-hide="${i}" type="button">Hide it</button>` : ''}<button class="btn small" data-dc-fine="${i}" type="button">It is fine</button></div>`
          : `<div class="receipt"><span class="chip pass">Marked fine</span>${decided(g) ? `<span><b>${esc(decided(g).by)}</b>, ${esc(decided(g).whenText)}</span>` : ''}</div>`}</div>
        <div class="places">${g.places.map(where).join('')}${g.more ? `<div class="place"><div class="loc">and ${g.more} more</div></div>` : ''}</div></article>`).join('') : `<div id="check-clean">${empty('shield', 'Nothing was found', 'Nothing was found. Every file passes.')}</div>`}</div></div>`);
    on('[data-dc-hide]', 'click', (e) => {
      const i = +e.currentTarget.dataset.dcHide;
      decide(c.groups[i].key, 'hide', main.querySelector(`[data-dc-kind="${i}"]`)?.value);
    });
    on('[data-dc-fine]', 'click', async (e) => {
      const g = c.groups[+e.currentTarget.dataset.dcFine];
      const yes = await confirmDialog({ title: 'Is this fine to send?', body: `<b>${esc(g.value)}</b> will go out as written in ${plural(g.undecided, 'place', 'places')}. The matter records that you decided this, and when.`, leaves: '<b>It will leave this computer</b> as written.', notes: [recorded()], yes: 'Yes, it is fine' });
      if (yes) decide(g.key, 'fine');
    });
    // A file in the list takes you to its first finding.
    on('#check-files li', 'click', (e) => {
      const title = e.currentTarget.dataset.unit;
      main.querySelectorAll('#check-files li').forEach((li) => li.classList.toggle('is-current', li === e.currentTarget));
      const hit = [...main.querySelectorAll('#check-findings .finding')].find((a) => JSON.parse(a.dataset.titles || '[]').includes(title));
      hit?.scrollIntoView({ block: 'nearest' });
    });
  }

  // ---------------------------------------------------------------- restore

  function restoreStart(error) {
    state.afterOpen = restoreScreen;
    show(`<div class="narrow">
      <h1>Restore a draft</h1>
      ${tip('restore')}
      <p class="muted">Put the real details back into a draft that has tags in it. This runs on this computer only.</p>
      ${error ? message(error) : ''}
      <div class="card mt-4">
        <h2><span class="step-no" aria-hidden="true">1</span>The matter</h2>
        <p class="sub">Choose the folder that holds the matter's key, and open it with the password or the recovery code.</p>
        <div class="row"><button class="btn" id="pick-matter" type="button">${icon('key', 'md')}Choose matter folder…</button>${state.matterDir ? `<span class="path" id="matter-path">${esc(state.matterDir)}</span>` : ''}</div>
        <div id="matter-form" class="mt-3"></div>
      </div>
      <div class="row"><button class="btn" id="back" type="button">Back</button></div>
    </div>`);
    on('#back', 'click', async () => { if (pending) return; await call('closeMatter').catch(() => {}); matterClosed(); state.afterOpen = null; home(); });
    on('#pick-matter', 'click', async () => {
      const p = await call('pickFolder', { title: 'Choose the matter folder' });
      if (!p) return;
      try { await call('checkLocation', { dir: p, what: 'The matter folder' }); } catch (err) { return restoreStart(err.message); }
      await call('closeMatter').catch(() => {});
      matterClosed();
      state.matterDir = p;
      restoreStart();
    });
    if (state.matter) restoreScreen(); else if (state.matterDir) matterForm();
  }

  const RESULT_WORDS = { pass: 'Passed', warn: 'Warnings', fail: 'Failed', skipped: 'Not run' };
  const RESULT_CHIP = { pass: 'cloaked', warn: 'manual', fail: 'partial', skipped: '' };
  const RESULT_STAMP = { pass: 'pass', warn: 'warn', fail: 'fail', skipped: 'plain' };
  const baseName = (p) => String(p || '').split(/[\\/]/).filter(Boolean).pop() || String(p || '');

  // Paragraph by paragraph, the way the checks number them: an "N." at the start of a line, else the line. Put-back values are marked.
  function draftPage(text, marks, flagged, asPasted) {
    const out = [];
    let current = null;
    let pos = 0;
    String(text).split('\n').forEach((line, i) => {
      const start = pos;
      pos += line.length + 1;
      if (!line.trim()) return;
      const m = /^\s*(\d+)\.\s/.exec(line);
      if (m) current = Number(m[1]);
      const key = m ? current : current ?? `line ${i + 1}`;
      const skip = m ? m[0].length : 0;
      let html = '';
      let at = start + skip;
      const piece = (a, b, cls) => { if (b <= a) return; const raw = text.slice(a, b); html += cls ? `<span class="${cls}">${esc(raw)}</span>` : esc(raw).replace(/\{\{([^}]+)\}\}/g, (x, c) => `<span class="flagged">${tagSafe(c)}</span>`); };
      for (const [a, b] of marks.filter(([a, b]) => b > start + skip && a < start + line.length)) {
        piece(at, Math.max(a, at), '');
        piece(Math.max(a, at), Math.min(b, start + line.length), 'restored');
        at = Math.min(b, start + line.length);
      }
      piece(at, start + line.length, '');
      const id = `p-${String(key).replace(/\s+/g, '-')}`;
      const bad = flagged.has(String(key));
      out.push(`<div class="para${bad ? ' is-flagged' : ''}" id="${id}"><span class="pn">${esc(String(key).replace(/^line /, ''))}</span>${langRuns(html)}</div>`);
    });
    return out.join('');
  }

  function restoreScreen(error) {
    const r = state.restoreResult;
    const tick = (ok) => (ok ? icon('check', 'lg') : '');
    const hasDraft = !!state.draft.trim();
    show(`<div class="wide">
      ${pageHead('Restore a draft')}
      ${screenNote('draft')}
      ${error ? message(error) : ''}
      <div class="matter-strip">
        <div><span class="tick">${tick(true)}</span><span class="tx"><span class="lbl">The matter</span><span class="val">${esc(state.matter?.name || 'Open')}</span></span></div>
        <div><span class="tick">${tick(hasDraft)}</span><span class="tx"><span class="lbl">The draft</span><span class="val">${hasDraft ? esc(state.draftName || 'Pasted into the box') : 'Not added yet'}</span></span></div>
        <div><span class="tick">${tick(!!state.docsFolder)}</span><span class="tx"><span class="lbl">Documents folder</span><span class="val">${state.docsFolder ? esc(baseName(state.docsFolder)) : 'Optional'}</span></span></div>
      </div>
      ${r ? '' : `<div class="card">
        <h2>The draft</h2>
        <p class="sub">Paste the draft the AI wrote, with its tags, or choose a file (.txt, .md or .docx).</p>
        <div class="field"><label class="vh" for="draft">The draft</label><textarea id="draft" class="draft-input" rows="10" placeholder="Paste the draft here">${esc(state.draft)}</textarea></div>
        <div class="row"><button class="btn" id="pick-draft" type="button">${icon('file', 'md')}Choose a file…</button>
          <button class="btn" id="pick-docs" type="button">${icon('folder', 'md')}Choose the documents folder…</button>${state.docsFolder ? `<span class="path" id="docs-path">${esc(state.docsFolder)}</span>` : '<span class="small muted">Optional: it lets Cloak check the draft against the documents. Without it, that check is skipped.</span>'}</div>
        <div class="row mt-4"><button class="btn primary" id="do-restore" type="button">Check and restore</button><button class="btn" id="restore-back" type="button">Done</button></div>
      </div>`}
      <div id="restore-result">${r ? restoreResultHtml(r) : ''}</div>
      ${r ? `<div class="row mt-4"><button class="btn" id="change-draft" type="button">Change the draft and check again</button><button class="btn" id="restore-back" type="button">Done</button></div>` : ''}
    </div>`);
    on('#draft', 'input', (e) => { state.draft = e.target.value; state.draftName = ''; });
    on('#change-draft', 'click', () => { state.restoreResult = null; restoreScreen(); });
    offerSettings(() => restoreScreen());
    on('#restore-back', 'click', async () => {
      if (pending) return;
      if (draftAtRisk() && !(await confirmDialog({ title: 'Finish with this draft?', small: true, body: `This closes the matter. ${DRAFT_NOT_KEPT}`, callout: { icon: 'save', html: '<b>The restored text has not been copied or saved.</b> Once you close the matter it cannot be made again without the draft.' }, no: 'Go back to the draft', yes: 'Done' }))) return;
      if (pending) return;
      await call('closeMatter').catch(() => {}); matterClosed(); state.afterOpen = null; state.restoreResult = null; state.draft = ''; state.draftName = ''; home(); });
    on('#pick-draft', 'click', async () => {
      try { const f = await call('pickDraftFile'); if (f) { state.draft = f.text; state.draftName = f.name || ''; restoreScreen(); } } catch (err) { restoreScreen(err.message); }
    });
    on('#pick-docs', 'click', async () => {
      state.draft = document.getElementById('draft').value;
      const p = await call('pickFolder', { title: 'Choose the folder of documents (for the source check)' });
      if (p) { state.docsFolder = p; restoreScreen(); }
    });
    on('#do-restore', 'click', async () => {
      state.draft = document.getElementById('draft').value;
      if (!state.draft.trim()) return restoreScreen('There is no draft to check yet. Paste the draft into the box, or choose a file.');
      document.getElementById('restore-result').innerHTML = '<p><span class="spinner" aria-hidden="true"></span> Checking…</p>';
      try { state.restoreResult = await call('restoreDraft', { draft: state.draft, folder: state.docsFolder }); restoreScreen(); } catch (err) { restoreScreen(err.message); }
    });
    on('#copy-restored', 'click', async (e) => {
      const text = state.restoreResult.restored;
      try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      e.currentTarget.innerHTML = `${icon('check')}Copied`;
    });
    on('#save-restored', 'click', async () => { try { await call('saveText', { text: state.restoreResult.restored, name: 'restored-draft.txt' }); } catch (err) { restoreScreen(err.message); } });
    on('#other-matter', 'click', async () => {
      if (pending) return;
      await call('closeMatter').catch(() => {}); matterClosed(); state.restoreResult = null; restoreStart();
    });
    on('[data-para]', 'click', (e) => document.getElementById(e.currentTarget.dataset.para)?.scrollIntoView({ block: 'center' }));
  }

  function restoreResultHtml(r) {
    const rep = r.report;
    const tagList = (items, n = 6) => `<div class="taglist">${items.slice(0, n).map((t) => tagHtml(String(t).replace(/^\{\{|\}\}$/g, ''))).join('')}${items.length > n ? `<span class="chip kind">and ${items.length - n} more</span>` : ''}</div>`;
    const issues = r.checks.flatMap((c) => c.issues);
    const fails = issues.filter((i) => i.level === 'fail').length;
    const warns = issues.length - fails;
    // A draft made from another matter: none of its tags are in this key.
    const mismatch = r.result === 'fail' && rep.tagsRestored === 0 && rep.notInKey.length > 0;
    const flagged = new Set(issues.filter((i) => i.paragraph != null).map((i) => String(i.paragraph)));
    const headline = mismatch ? `<b>This draft does not match this matter's key.</b> None of its ${plural(rep.notInKey.length, 'tag', 'tags')} are in the key, so nothing was put back. The draft was probably made from another matter. Check the matter above, or open another one.`
      : r.result === 'fail' ? `<b>Do not send this draft yet.</b> ${plural(fails, 'problem', 'problems')} to fix${warns ? `, and ${plural(warns, 'place', 'places')} that need${warns === 1 ? 's' : ''} your eye` : ''}. The checks beside the draft say where.`
      : r.result === 'warn' ? `<b>${plural(warns, 'place', 'places')} need${warns === 1 ? 's' : ''} your eye.</b> No check failed.`
      : '<b>No check found a problem.</b> Read the draft through yourself before it goes out.';
    const fig = (n, cls) => `fig num${cls === 'bad' ? ' bad' : n === 0 ? ' zero' : cls ? ` ${cls}` : ''}`;
    const para = (i) => (i.paragraph == null ? '' : `<button class="pchip${i.level === 'fail' ? ' bad' : ''}" type="button" data-para="p-${esc(String(i.paragraph).replace(/\s+/g, '-'))}">${/^line /.test(String(i.paragraph)) ? 'Line' : 'Paragraph'} ${esc(String(i.paragraph).replace(/^line /, ''))}</button>`);
    const checks = mismatch ? r.checks.filter((c) => c.issues.length).slice(0, 1) : r.checks;
    return `<div id="restore-report"><div class="verdict is-${r.result === 'skipped' ? 'warn' : r.result}"><div class="headline"><span class="stamp ${RESULT_STAMP[r.result]} lg" id="restore-overall">${RESULT_WORDS[r.result]}</span><p>${headline}</p></div>
        <div><span class="${fig(rep.tagsRestored, mismatch ? 'bad' : '')}">${num(rep.tagsRestored)}</span><span class="figl">${plural(rep.tagsRestored, 'tag', 'tags')} put back<br>${plural(rep.distinctTags, 'different tag', 'different tags')}</span></div>
        <div><span class="${fig(rep.inKeyNotInDraft.length, 'some')}">${num(rep.inKeyNotInDraft.length)}</span><span class="figl">${rep.inKeyNotInDraft.length === 1 ? 'tag' : 'tags'} in the key, not in the draft${rep.inKeyNotInDraft.length ? tagList(rep.inKeyNotInDraft) : ''}</span></div>
        <div><span class="${fig(rep.notInKey.length, mismatch ? 'bad' : 'some')}">${num(rep.notInKey.length)}</span><span class="figl">${rep.notInKey.length ? 'Tag-like text that is not in the key' : 'No tag-like text outside the key'}${rep.notInKey.length ? tagList(rep.notInKey) : ''}</span></div></div>
      <div class="restore-grid">
        <section class="docpage" aria-labelledby="rd"><div class="docpage-head"><h2 id="rd">${mismatch ? 'The draft as you pasted it' : 'The restored draft'}</h2>
          <span class="legend">${mismatch ? '<span><span class="flagged">Not in the key</span></span>' : '<span><span class="restored">Put back</span> from the key</span><span><span class="flagged">Flagged</span> by a check</span>'}</span>
          <div class="row tight">${mismatch ? '<button class="btn small primary" id="other-matter" type="button">Choose another matter</button>' : `<button class="btn small primary" id="copy-restored" type="button">${icon('copy')}Copy</button><button class="btn small" id="save-restored" type="button">${icon('save')}Save as…</button>`}</div></div>
          <div class="docpage-body" id="restored-text">${draftPage(r.restored, mismatch ? [] : r.marks || [], flagged)}</div></section>
        <div class="checks">${checks.map((c, ci) => `<section class="check-card"><div class="hd"><span>${esc(c.name)}</span><span class="stamp ${RESULT_STAMP[c.result]}">${RESULT_WORDS[c.result]}</span></div>${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}${ci === 0 && c.translated?.length ? `<p class="note">${plural(c.translated.length, 'form', 'forms')} put back in the language of their sentence (month names, job titles, court names).</p>` : ''}${c.issues.length ? `<ul class="issues">${c.issues.map((i) => `<li>${para(i)}<span>${tags(i.what)}</span></li>`).join('')}</ul>` : ''}${mismatch ? '<p class="note">The other checks were not run: they need the real values.</p>' : ''}</section>`).join('')}</div>
      </div></div>`;
  }

  // ------------------------------------------------------- matter settings
  //
  // The open matter's password, recovery code and cache. Reached from "Matter
  // settings" in the bar, beside the matter's name (on the setup, review and
  // restore screens), and straight after a matter is opened with its recovery code.

  function matterSettings({ back, recovered = false }) {
    let askForPassword = recovered; // the note asking for a new password, until one is set
    const draw = ({ error, done } = {}) => {
      show(`<div class="narrow" id="matter-settings">
        <h1>Matter settings</h1>
        <p class="muted">${state.matter?.name ? `<b>${esc(state.matter.name)}</b>. ` : ''}Each change takes effect straight away and is recorded in the matter's log with your name. The log never holds the password or the recovery code.</p>
        ${askForPassword ? '<div class="msg warn" id="recovered-note"><b>You opened this matter with the recovery code.</b> Set a new password now, and tell the people who work on the matter. The recovery code has been out of the safe, so consider replacing it too.</div>' : ''}
        ${error ? message(error) : ''}
        ${done ? `<div class="msg ok" role="status" id="settings-done">${done}</div>` : ''}
        <div class="card">
          <h2>Change the password</h2>
          <p class="muted small">From now on the new password opens the matter for everyone, and the old one stops working. Cloak does not send it to anyone: tell the people who work on the matter yourself.</p>
          <div class="field"><label for="s-pw">New password (${state.info.minPasswordLength || 10} characters or more)</label><input type="password" id="s-pw" autocomplete="new-password"></div>
          <div class="field"><label for="s-pw2">Type the new password again</label><input type="password" id="s-pw2" autocomplete="new-password"></div>
          <button class="btn primary" id="s-change" type="button">Change the password</button>
        </div>
        <div class="card">
          <h2>Replace the recovery code</h2>
          <p class="muted small">Do this if the printed code may have been seen, or once it has been used. Cloak makes a new code and shows it once, to print or write down. The old code stops working straight away.</p>
          <button class="btn" id="s-recovery" type="button">Replace the recovery code…</button>
        </div>
        <div class="card">
          <h2>Clear the cache</h2>
          <p class="muted small">The cache keeps what was read from each file, encrypted, so that files that have not changed are not read again. Clearing it frees space and changes nothing in the key or the review. The next time the folder is cloaked, every file is read again, and scans and pictures go through OCR again, which can take much longer.</p>
          <button class="btn" id="s-cache" type="button">Clear the cache…</button>
        </div>
        <div class="row"><button class="btn" id="s-back" type="button">${recovered ? 'Continue' : 'Back'}</button></div>
      </div>`);
      on('#s-back', 'click', () => back());
      on('#s-change', 'click', changePassword);
      on('#s-pw2', 'keydown', (e) => { if (e.key === 'Enter') changePassword(); });
      on('#s-recovery', 'click', replaceCode);
      on('#s-cache', 'click', clearCache);
      if (askForPassword) document.getElementById('s-pw').focus();
    };
    // While a change is being saved, nothing else can be pressed or typed. Every outcome draws the screen again.
    const wait = (id, text) => {
      main.querySelectorAll('#matter-settings button, #matter-settings input').forEach((b) => { b.disabled = true; });
      document.getElementById(id).textContent = text;
    };
    async function changePassword() {
      if (document.getElementById('s-change').disabled) return;
      const password = document.getElementById('s-pw').value;
      const again = document.getElementById('s-pw2').value;
      wait('s-change', 'Changing the password…');
      try {
        const r = await call('changePassword', { password, again });
        askForPassword = false;
        const kept = { updated: ' The password remembered on this computer has been updated.', forgotten: ' The password remembered on this computer has been forgotten: type the new one next time.' }[r.remembered] || '';
        draw({ done: `<b>The password has been changed.</b> The old password no longer opens this matter.${kept}` });
      } catch (err) { draw({ error: err.message }); }
    }
    async function replaceCode() {
      const yes = await confirmDialog({ title: 'Replace the recovery code?', body: 'Cloak makes a new recovery code and shows it once, to print or write down. <b>The old code stops working straight away.</b>', yes: 'Replace the recovery code' });
      if (!yes) return;
      wait('s-recovery', 'Replacing…');
      try {
        const r = await call('newRecoveryCode');
        recoveryCode({ ...r, then: () => draw({ done: '<b>The recovery code has been replaced.</b> The old code no longer opens this matter.' }) });
      } catch (err) { draw({ error: err.message }); }
    }
    async function clearCache() {
      const yes = await confirmDialog({ title: 'Clear the cache?', body: 'Nothing in the key or the review changes. <b>The next time the folder is cloaked, every file is read again</b>, and scans and pictures go through OCR again, which can take much longer.', yes: 'Clear the cache' });
      if (!yes) return;
      wait('s-cache', 'Clearing…');
      try {
        await call('clearCache');
        draw({ done: '<b>The cache has been cleared.</b> The next time the folder is cloaked, every file is read again.' });
      } catch (err) { draw({ error: err.message }); }
    }
    draw();
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
    draft: '<b>Trying the sample? Paste a few cloaked lines with their tags here.</b> Open a file in the <b>Cloaked copies</b> folder, copy them, paste them in the box and press <b>Check and restore</b>.',
  };
  const TIPS_KEY = 'cloak.tipsClosed';
  const tipsClosed = () => { try { return JSON.parse(localStorage.getItem(TIPS_KEY) || '[]'); } catch { return []; } };
  // The tips for setup, review and restore (and the note on the sample restore screen) have no designed screen. They use the tip
  // component; in a short window (860x600) only the bold first sentence shows, so the first rows of the list stay above the finish bar.
  const compactTip = (text) => { const i = text.indexOf('</b>'); return i < 0 ? text : `${text.slice(0, i + 4)}<span class="tip-more">${text.slice(i + 4)}</span>`; };
  function tip(id) {
    if (!TIPS[id] || tipsClosed().includes(id)) return '';
    const compact = id !== 'home';
    return `<div class="tip${compact ? ' compact' : ''}" role="note" id="tip-${id}"><span>${compact ? compactTip(TIPS[id]) : TIPS[id]}</span><button class="link" type="button" data-tip-close="${id}">Got it</button></div>`;
  }
  function closeTip(id) {
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...new Set([...tipsClosed(), id])])); } catch { /* not remembered: it shows again next time */ }
    document.getElementById(`tip-${id}`)?.remove();
  }
  const isSample = () => !!state.sample && state.matterDir === state.sample.matterDir;
  // The matter is closed. If it was the sample, nothing of it (its folders, its parties, the "made-up test documents" tick) carries into the next matter.
  function matterClosed() {
    if (isSample()) Object.assign(state, { folder: null, matterDir: null, client: '', others: '', testMatter: false, level: 'strict', manualSource: '', location: null, review: null, chrono: null, exported: null });
    state.matter = null;
  }
  function screenNote(id) {
    if (isSample() && SAMPLE_NOTES[id]) return `<div class="tip sample-note${id === 'draft' ? ' compact' : ''}" role="note" id="sample-note-${id}"><span>${id === 'draft' ? compactTip(SAMPLE_NOTES[id]) : SAMPLE_NOTES[id]}</span></div>`;
    return tip(id);
  }

  const homeExtras = () => `<div class="try-sample"><span class="ico">${icon('book', 'lg')}</span><div><b>New to Cloak?</b> Try a sample matter: ten made-up documents, ready in a few minutes.</div><button class="btn" id="go-sample" data-go-sample type="button">Try a sample matter</button></div>`;

  // "Try a sample matter": where to put it and a password; Cloak does the rest.
  async function sampleScreen(error) {
    let s;
    try { s = await call('sampleStart', { parent: state.sampleParent || null }); } catch (err) { s = { refused: err.message }; }
    if (s.parent) state.sampleParent = s.parent;
    show(`<div class="narrow">
      <h1>Try a sample matter</h1>
      <p class="muted">${esc(s.about || '')} Cloak copies them into a new folder, creates a test matter for them with the people already filled in, and takes you through cloaking and the review.</p>
      ${error ? message(error) : ''}
      <div class="card mt-4">
        <h2><span class="step-no" aria-hidden="true">1</span>Where to put it</h2>
        <p class="sub">Cloak makes a new folder. Nothing already there is changed.</p>
        <div class="row"><span class="path" id="sample-path">${esc(s.folder || '')}</span><button class="btn" id="sample-place" type="button">${icon('folder', 'md')}Choose another place…</button></div>
        ${s.refused ? `<div class="msg warn" id="sample-refused" role="status">${esc(s.refused)}</div>` : ''}
      </div>
      <div class="card">
        <h2><span class="step-no" aria-hidden="true">2</span>A password for the sample matter</h2>
        <p class="sub">Every matter has its own password, 10 characters or more. You need it to open the matter again or to restore a draft. Cloak never saves it.</p>
        <div class="pair"><div class="field"><label for="sample-pw">Password</label><input type="password" id="sample-pw" autocomplete="new-password"></div>
        <div class="field"><label for="sample-pw2">Type it again</label><input type="password" id="sample-pw2" autocomplete="new-password"></div></div>
      </div>
      <div class="row"><button class="btn" id="back" type="button">Back</button><button class="btn primary" id="sample-create" type="button" ${s.refused ? 'disabled' : ''}>Create the sample matter</button></div>
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
      <div class="path mb-3" id="sample-folder">${esc(made.folder)}</div>
      <ul class="small stack">
        <li><b>Documents</b>: the ten made-up files. Open them in Word, Excel or a PDF viewer to compare with the cloaked copies later.</li>
        <li><b>Matter key</b>: the matter, with its encrypted key, its cache and its log.</li>
        <li><b>Cloaked copies</b>: empty for now. Export the cloaked copies here at the end.</li>
      </ul>
      <h2 class="mt-5">The recovery code</h2>
      <p class="small">Every matter gets a recovery code that opens it if the password is forgotten. It is shown only once. For a real matter, print it or write it down and keep it with the paper file. For the sample you do not need to keep it.</p>
      <div class="code" id="recovery-code">${esc(made.recoveryCode)}</div>
      <div class="row"><button class="btn primary" id="sample-continue" type="button">Continue</button></div>
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
      <div class="help-head"><div class="tabs in-dialog" role="tablist">${HELP_TABS.map(([id, label]) => `<button class="tab" type="button" role="tab" data-help="${id}" aria-selected="${tab === id}">${label}</button>`).join('')}</div><button class="btn small" id="help-close" type="button">Close</button></div>
      <div id="help-body"><p class="muted">Loading…</p></div></div>`;
    document.body.appendChild(o);
    lockMain(true);
    const onKey = (e) => { if (e.key === 'Escape') closeHelp?.(); };
    closeHelp = () => { document.removeEventListener('keydown', onKey); lockMain(false); o.remove(); closeHelp = null; };
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
        <li><b>Cloak.</b> Choose a folder of documents. Cloak reads every part of every file (Word, PDF, Excel, emails, pictures and text files, with their headers, footnotes, comments, tracked changes and document details) and replaces names and numbers with tags such as ${tagHtml('PERSON_1')} or ${tagHtml('NRIC_2')}. The same person gets the same tag in every file. The originals are only read, never changed.</li>
        <li><b>Review.</b> Nothing leaves until a person has checked it. Decide each word Cloak was not sure about, confirm names it joined together, and read any file that needs a manual check. Then finish the review. Your name and the time are recorded.</li>
        <li><b>Double check.</b> A second, separate check of everything that would be exported: each cloaked copy, the context sheet, the chronology, the file names and the report. It looks again for every value in the key (dates and amounts in any format), for numbers that look like an NRIC, phone, account or case number, and for anything that still looks like a name, in every part of every file. Press <b>Run the double check</b> in the bar at the bottom of the review; it also runs by itself when you export. Each finding shows the words, the file and the line. Hide it, or say it is fine: your name and the time are kept in the matter, and only counts go in the log. Nothing is exported until every file passes or every finding is decided. No AI is used.</li>
        <li><b>Export.</b> Cloak writes the cloaked copies as plain text files to a folder you choose, with a report of what was read in each file and who reviewed and double-checked it. A Strict matter also gets a context sheet that explains the tags to the AI.</li>
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
      <p><button class="btn small" id="tips-again" type="button">Show the first-time tips again</button></p>`;
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
        <li>A new password or recovery code (Matter settings) locks the old one out of the key in the matter folder, not out of older copies. Someone who kept a copy of the key file and knows the old password or code can still open that copy.</li>
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
        <tr><td>Open-source parts</td><td>Cloak is built with open-source software, including the Electron window, the Tesseract OCR engine and its language data, and PDF.js. Their licences are listed in ${code(a.noticesName || 'THIRD-PARTY-NOTICES.txt')} in the folder where the file is kept${a.noticesFolder || a.installFolder ? `: <span class="path inline" id="notices-folder">${esc(a.noticesFolder || a.installFolder)}</span>` : ''}.${a.notices ? '' : ' <span class="muted" id="notices-missing">That file is not in this copy of Cloak.</span>'}</td></tr>
        <tr><td>Fonts</td><td>Newsreader, Instrument Sans, IBM Plex Mono, Noto Sans Tamil and Noto Naskh Arabic, under the SIL Open Font Licence 1.1. Their licences are in the same file.</td></tr>
        <tr><td>Running on</td><td>${esc(a.system || '')}${a.electron ? ` · Electron ${esc(a.electron)}` : ''}</td></tr>
      </tbody></table>
      <h3>Save a support file</h3>
      <p>If something is not working, save a support file and send it to your supplier yourself. Cloak never sends it anywhere.</p>
      <p class="small">It holds the version, the operating system, a self-test (does the OCR engine start, does the open matter's key open) and the open matter's log, which records actions, counts and the names of the people who worked on the matter, but no client details. As a second guard, anything in it that matches a value in the matter key is replaced by its tag. ${a.matterOpen ? 'The open matter\'s log will be included.' : 'No matter is open, so no matter log will be included. If the problem is with one matter, open it first.'}</p>
      <button class="btn primary" id="save-support" type="button">${icon('save', 'md')}Save a support file…</button>
      <div id="support-result"></div>`;
  }

  async function saveSupport(e) {
    const btn = e.currentTarget;
    const box = document.getElementById('support-result');
    btn.disabled = true;
    box.innerHTML = '<p class="small"><span class="spinner" aria-hidden="true"></span> Choose where to save it. Cloak then checks the OCR engine and the matter key, which takes a few seconds.</p>';
    try {
      const r = await call('saveSupportFile');
      if (!r.saved) { box.innerHTML = '<p class="small muted">Not saved.</p>'; return; }
      const word = (t) => (t.ok === true ? ['cloaked', 'Passed'] : t.ok === false ? ['partial', 'Failed'] : ['', 'Not run']);
      box.innerHTML = `<div class="msg ok" id="support-saved" role="status">Support file saved to <b>${esc(r.file)}</b>. Cloak has not sent it anywhere.${r.replaced ? ` ${plural(r.replaced, 'value', 'values')} from the matter key ${r.replaced === 1 ? 'was' : 'were'} found in it and replaced by tags.` : ''}</div>
        <table class="self-test" id="self-test"><tbody>${r.test.map((t) => `<tr><td>${esc(t.check)}</td><td><span class="chip ${word(t)[0]}">${word(t)[1]}</span> ${esc(t.what)}</td></tr>`).join('')}</tbody></table>`;
    } catch (err) {
      box.innerHTML = message(err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // A way back to the home screen from any screen (the review screen has no Back button).
  async function goHome() {
    if (state.recovery) { // the recovery code is shown only once: it must be written down first
      document.getElementById('recovery-wait')?.removeAttribute('hidden');
      document.getElementById('wrote')?.focus();
      return;
    }
    if (document.getElementById('progress') || pending) return; // cloaking or a save is running: wait until it has finished
    closeHelp?.();
    if (!state.info?.fullName) return nameScreen();
    if (state.matter) {
      const yes = await confirmDialog({ title: 'Go to the home screen?', small: true, body: 'This closes the matter. Everything you decided is saved in it. Cloaked copies you have not exported are not kept: to export them later, open the matter and cloak the folder again.' + (draftAtRisk() ? ` ${DRAFT_NOT_KEPT}` : ''), notes: [{ icon: 'check', html: '<b>Saved:</b> everything you decided, in the matter.' }, ...(state.review && !state.exported ? [{ icon: 'out', html: `<b>Not exported yet:</b> ${plural(state.review.files.filter((f) => f.willExport).length, 'cloaked copy', 'cloaked copies')}. They are not kept.` }] : [])], no: 'Stay in the matter', yes: 'Close the matter' });
      if (!yes) return;
      if (pending) return;
      await call('closeMatter').catch(() => {});
      matterClosed();
      Object.assign(state, { afterOpen: null, review: null, chrono: null, exported: null, restoreResult: null, draft: '' });
    }
    home();
  }

  // The clicks every screen shares: Home and Help in the top bar, tips, the sample matter.
  // Matter settings, from the bar: not while a call is running or a dialog is open.
  document.getElementById('bar-settings').addEventListener('click', () => {
    if (pending || !settingsReturn || document.querySelector('.overlay')) return;
    matterSettings({ back: settingsReturn });
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tip-close], [data-help], [data-go-sample], [data-go-home]');
    if (!t) return;
    if (t.dataset.tipClose) closeTip(t.dataset.tipClose);
    else if (t.dataset.help) helpScreen(t.dataset.help);
    else if (t.hasAttribute('data-go-home')) goHome();
    else sampleScreen();
  });

  // ---------------------------------------------------------------- licence
  // The licence is checked by the app on this computer. Without one (or after
  // it ends) this is an evaluation copy: export is limited to test matters.
  // Restoring drafts always works.

  function licenceBar(v) {
    const el = document.getElementById('licence-bar');
    if (!el || !v) return;
    const ending = v.licensed && v.daysLeft <= 30;
    el.className = `licence-bar${v.licensed ? (ending ? ' is-ending' : '') : ' is-eval'}`;
    el.innerHTML = v.licensed ? `<span class="lead-in">Licensed to</span> <b>${esc(v.firm)}</b>${ending ? ` <span class="chip manual">${v.daysLeft ? `Ends in ${plural(v.daysLeft, 'day', 'days')}` : 'Ends today'}</span>` : ''}` : 'Evaluation copy';
    el.title = v.licensed ? `Licence ${v.id}. Ends ${v.expires}.` : 'No licence: cloaked copies can be exported only from test matters. Restoring drafts always works.';
  }
  // Facts as a label and a value. The colon after each label is read out but not drawn.
  const factList = (pairs) => `<dl class="code-meta">${pairs.map(([k, v]) => `<dt>${k}<span class="vh">:</span></dt> <dd>${v}</dd>`).join('')}</dl>`;

  async function licenceScreen(error, note) {
    let v = null;
    try { v = await call('licence'); } catch (err) { error = error || err.message; }
    licenceBar(v);
    const ending = v?.licensed && v.daysLeft <= 30;
    const ends = ending ? ` <span class="chip manual">${v.daysLeft ? `in ${plural(v.daysLeft, 'day', 'days')}` : 'today'}</span>` : '';
    show(`<div class="narrow">
      <h1>Licence</h1>
      ${error ? message(error) : ''}${note ? message(note, 'ok') : ''}
      ${ending ? `<div class="msg warn" role="status" id="licence-ending"><b>This licence ends ${v.daysLeft ? `in ${plural(v.daysLeft, 'day', 'days')}` : 'today'}.</b> Ask your supplier for a new licence, then paste it below. Cloak keeps working until the end date. After that it is an evaluation copy: cloaked copies can be exported only from test matters, and restoring drafts keeps working.</div>` : ''}
      ${v?.developmentKey ? message('This copy of Cloak was built for testing. It has the development licence key, so no licence will work in it. Ask your supplier for the copy built for sale.', 'warn') : ''}
      <div class="card" id="licence-status">${v?.licensed ? `
        <h2>Licensed to ${esc(v.firm)}</h2>
        ${factList([['Licence ID', `<b class="ink">${esc(v.id)}</b>`], ['Seats', `<b class="ink">${esc(v.seats)}</b> <span class="muted">(for your records: Cloak does not count or limit seats)</span>`], ['Issued', esc(v.issued)], ['Ends', `<b class="ink">${esc(v.expires)}</b>${ends}`]])}
        <p class="small muted">${v.where === 'computer' ? 'Installed for everyone on this computer.' : 'Kept in your own user folder on this computer.'} It was checked on this computer. Nothing is sent anywhere.</p>`
    : `<h2>Evaluation copy</h2>
        <p>Everything works, but cloaked copies can be exported only from matters ticked as made-up test documents. Restoring drafts always works, with or without a licence.</p>
        ${v && v.status !== 'none' ? `<div class="msg ${v.status === 'expired' ? 'bad' : 'warn'}" id="licence-problem" role="status">${esc(v.reason)}</div>` : ''}`}
      </div>
      <div class="card">
        <h2>${v?.licensed ? 'Replace the licence' : 'Add the licence'}</h2>
        <p class="sub">Paste the licence text, from BEGIN CLOAK LICENCE to END CLOAK LICENCE, or choose the licence file. It is checked on this computer. Nothing is sent anywhere.</p>
        <div class="field"><label for="licence-text">Licence text</label><textarea id="licence-text" rows="5" class="mono" autocomplete="off" spellcheck="false" placeholder="-----BEGIN CLOAK LICENCE-----"></textarea></div>
        <div class="row"><button class="btn primary" id="licence-use" type="button">Use this licence</button><button class="btn" id="licence-file" type="button">Choose the licence file…</button></div>
      </div>
      <div class="row"><button class="btn" id="licence-back" type="button">Back</button>${v?.licensed && v.where === 'user' ? '<button class="link" id="licence-remove" type="button">Remove the licence from this computer</button>' : ''}</div>
    </div>`);
    const install = async (text) => {
      try {
        const r = await call('installLicence', { text });
        licenceScreen(null, `Licence added. Cloak is licensed to ${r.firm} until ${r.expires}.`);
      } catch (err) { licenceScreen(err.message); }
    };
    on('#licence-use', 'click', () => {
      const text = document.getElementById('licence-text').value;
      if (!text.trim()) return licenceScreen('Paste the licence text first, or choose the licence file.');
      install(text);
    });
    on('#licence-file', 'click', async () => {
      try { const f = await call('pickLicenceFile'); if (f) install(f.text); } catch (err) { licenceScreen(err.message); }
    });
    on('#licence-back', 'click', () => home());
    on('#licence-remove', 'click', async () => {
      const yes = await confirmDialog({ title: 'Remove the licence?', small: true, body: 'Cloak goes back to being an evaluation copy for you on this computer: cloaked copies can then be exported only from test matters. Restoring drafts keeps working.', notes: [{ icon: 'info', html: 'The licence stays valid. You can add it again from the licence file.' }], yes: 'Remove the licence' });
      if (!yes) return;
      try { await call('removeLicence'); licenceScreen(null, 'The licence was removed from this computer.'); } catch (err) { licenceScreen(err.message); }
    });
  }

  call('info').then((info) => {
    state.info = info;
    document.getElementById('version').textContent = `Version ${info.version}`;
    if (info.fullName) home(); else nameScreen();
    call('licence').then(licenceBar, () => {});
  });
})();
