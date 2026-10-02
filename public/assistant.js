/* Cloak email assistant page: connect the mailbox, check emails Cloak was
 * unsure about, change settings, and see what the assistant has done. */
(function () {
  'use strict';

  const main = document.getElementById('main');
  let status = null;
  let queue = [];
  let activity = [];
  let open = null; // { id, data, decisions: { word: 'hide' | 'allow' } }
  let busy = false;
  let notice = null;

  const params = new URLSearchParams(location.search);
  if (params.get('connected')) notice = { kind: 'ok', text: 'Mailbox connected. New emails will be handled from now on.' };
  if (params.get('error')) notice = { kind: 'warn', text: params.get('error') };
  if (params.toString()) history.replaceState(null, '', location.pathname);

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

  async function api(path, body) {
    const res = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { location.href = '/login'; throw new Error('Signed out'); }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  async function refresh() {
    try {
      [status, { queue }, { activity }] = await Promise.all([api('/api/assistant/status'), api('/api/assistant/queue'), api('/api/assistant/activity')]);
    } catch (err) {
      notice = { kind: 'warn', text: err.message };
    }
    render();
  }

  async function act(fn, okText) {
    if (busy) return;
    busy = true;
    render();
    try {
      const r = await fn();
      if (okText) notice = { kind: 'ok', text: typeof okText === 'function' ? okText(r) : okText };
    } catch (err) {
      notice = { kind: 'warn', text: err.message };
    }
    busy = false;
    await refresh();
  }

  function card(title, intro, ...body) {
    return h('section', { class: 'card' }, h('h2', {}, title), intro && h('p', { class: 'intro' }, intro), ...body);
  }

  // ------------------------------------------------------------ connection

  function connectionCard() {
    const a = status.account;
    if (!status.microsoftReady) {
      return card('1. Connect the mailbox', null, h('div', { class: 'alert warn' },
        'Microsoft 365 is not set up on the server yet. Follow ASSISTANT.md (it takes about 15 minutes, once), then come back here.'));
    }
    if (!a) {
      return card('1. Connect the mailbox', 'The mailbox owner signs in once with their own Microsoft account and approves access. Cloak can then read new emails, save reply drafts, send the acknowledgement and the daily summary, and read the calendar.',
        h('a', { class: 'primary button', href: '/assistant/connect' }, 'Connect Microsoft 365'));
    }
    return card('Mailbox', null,
      a.needsReconnect && h('div', { class: 'alert warn' }, 'Microsoft sign-in has expired. ', h('a', { href: '/assistant/connect' }, 'Reconnect now'), ' to carry on.'),
      h('p', {}, h('b', {}, a.name), ` (${a.email}) · connected ${when(a.connectedAt)}${a.connectedBy ? ` by ${a.connectedBy}` : ''}`),
      h('p', { class: 'hint' }, `Last checked: ${when(status.lastCheck) || 'not yet'} · Last summary: ${status.lastSummaryDate || 'not yet'}`),
      status.settings.paused && h('div', { class: 'alert warn' }, 'The assistant is paused. No emails are being handled.'),
      h('div', { class: 'toolbar' },
        h('button', { type: 'button', class: 'secondary', disabled: busy, onclick: () => act(() => api('/api/assistant/run', {}), (r) => `Checked ${r.checked ?? 0} new email(s).`) }, 'Check for new email now'),
        h('button', { type: 'button', class: 'secondary', disabled: busy, onclick: () => act(() => api('/api/assistant/summary', {}), (r) => (r.sent ? 'Summary sent to the mailbox owner.' : `Not sent: ${r.reason || 'nothing to do'}`)) }, 'Send today\'s summary now'),
        h('button', { type: 'button', class: 'ghost', disabled: busy, onclick: () => act(() => api('/api/assistant/settings', { paused: !status.settings.paused }), status.settings.paused ? 'Assistant resumed.' : 'Assistant paused.') }, status.settings.paused ? 'Resume' : 'Pause'),
        h('button', { type: 'button', class: 'ghost danger', disabled: busy, onclick: () => { if (confirm('Disconnect the mailbox? Cloak will stop reading email until someone connects it again.')) act(() => api('/api/assistant/disconnect', {}), 'Mailbox disconnected.'); } }, 'Disconnect')));
  }

  // ------------------------------------------------------------ check list

  function queueCard() {
    const waiting = queue.filter((q) => q.status === 'waiting');
    const done = queue.filter((q) => q.status !== 'waiting').slice(0, 10);
    return card(`Check before AI (${waiting.length})`, 'Cloak was not sure these emails were fully hidden. Look at the highlighted words: hide anything that could identify someone, mark the rest as fine, then approve. Only then does the hidden version go to the AI.',
      waiting.length === 0 && h('div', { class: 'alert ok' }, 'Nothing waiting. Every new email so far was handled automatically.'),
      waiting.map((q) => h('div', { class: 'row-card queue-item' + (open && open.id === q.id ? ' open' : '') },
        h('div', { class: 'queue-head' },
          h('div', {}, h('b', {}, q.from), ' · ', q.subject || '(no subject)', h('div', { class: 'hint' }, `${when(q.receivedAt)} · ${(q.reasons || []).join('; ')}`)),
          !(open && open.id === q.id) && h('button', { type: 'button', class: 'primary small', onclick: () => openItem(q.id) }, 'Check')),
        open && open.id === q.id && reviewPanel())),
      done.length > 0 && h('details', { class: 'map' }, h('summary', {}, 'Recently checked'),
        h('ul', {}, done.map((q) => h('li', {}, `${q.from}: ${q.subject || ''}: ${q.status === 'approved' ? 'sent to AI' : 'left for the lawyer'} by ${q.decidedBy || '?'} (${when(q.decidedAt)})`)))));
  }

  async function openItem(id) {
    open = { id, data: null, decisions: {} };
    render();
    try {
      open.data = await api(`/api/assistant/queue/${encodeURIComponent(id)}`);
    } catch (err) {
      notice = { kind: 'warn', text: err.message };
      open = null;
    }
    render();
  }

  function highlight(text, words) {
    let html = esc(text).replace(/\{\{[^}]+\}\}/g, (m) => `<span class="tok">${m}</span>`);
    for (const w of [...words].sort((a, b) => b.length - a.length)) {
      const re = new RegExp(`(?<![\\p{L}])(${esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\p{L}])`, 'gu');
      html = html.replace(re, '<mark class="suspect">$1</mark>');
    }
    return html;
  }

  function reviewPanel() {
    if (!open.data) return h('div', { class: 'working' }, h('span', { class: 'spinner' }), 'Loading…');
    const d = open.data;
    const words = d.suspects.map((s) => s.text);
    const allDecided = words.every((w) => open.decisions[w]);
    return h('div', { class: 'review' },
      d.verdict === 'sure' && h('div', { class: 'alert ok' }, 'Everything in this email is now hidden. Approve to send it to the AI.'),
      words.length > 0 && h('div', { class: 'decisions' },
        h('b', {}, 'Decide each highlighted word:'),
        words.map((w) => h('div', { class: 'decision' },
          h('code', {}, w),
          h('label', { class: 'pill' }, h('input', { type: 'radio', name: `d-${w}`, checked: open.decisions[w] === 'hide', onchange: () => { open.decisions[w] = 'hide'; render(); } }), 'Hide it'),
          h('label', { class: 'pill' }, h('input', { type: 'radio', name: `d-${w}`, checked: open.decisions[w] === 'allow', onchange: () => { open.decisions[w] = 'allow'; render(); } }), 'It\'s fine'))),
        h('div', { class: 'toolbar' },
          h('button', { type: 'button', class: 'ghost small', onclick: () => { words.forEach((w) => { open.decisions[w] = 'hide'; }); render(); } }, 'Hide all'))),
      h('h3', {}, 'What the AI would see'),
      h('pre', { class: 'payload', html: highlight(d.cloaked, words) }),
      h('div', { class: 'nav' },
        h('button', { type: 'button', class: 'ghost', disabled: busy, onclick: () => { if (confirm('Leave this email for the lawyer to handle personally? It will not be sent to the AI.')) act(async () => { await api(`/api/assistant/queue/${encodeURIComponent(open.id)}/personal`, {}); open = null; }, 'Left for the lawyer. Nothing was sent to the AI.'); } }, 'Handle personally (no AI)'),
        h('button', { type: 'button', class: 'primary', disabled: busy || !allDecided, onclick: approve }, 'Approve and prepare draft')));
  }

  async function approve() {
    const hide = Object.entries(open.decisions).filter(([, v]) => v === 'hide').map(([w]) => w);
    const allow = Object.entries(open.decisions).filter(([, v]) => v === 'allow').map(([w]) => w);
    await act(async () => {
      const r = await api(`/api/assistant/queue/${encodeURIComponent(open.id)}/approve`, { hide, allow });
      if (r.status === 'more') {
        open.data = { ...open.data, suspects: r.suspects, cloaked: r.cloaked };
        throw new Error('A few more words need a decision.');
      }
      open = null;
      return r;
    }, (r) => (r.action === 'draft' ? 'Done. A reply draft is in the Drafts folder.' : 'Done. The AI read it and found no reply was needed.'));
  }

  // ------------------------------------------------------------ settings

  function settingsCard() {
    const s = status.settings;
    const ta = (id, value, rows, placeholder) => {
      const el = h('textarea', { id, rows, placeholder });
      el.value = (value || []).join('\n');
      return el;
    };
    const field = (label, control, hint) => h('div', { class: 'field wide' }, h('label', { for: control.id }, label), control, hint && h('small', { class: 'hint' }, hint));
    const form = h('form', { class: 'settings', onsubmit: (e) => {
      e.preventDefault();
      const v = (id) => document.getElementById(id).value;
      const c = (id) => document.getElementById(id).checked;
      act(() => api('/api/assistant/settings', {
        firmDomains: v('s-firm'), clients: v('s-clients'), neverAI: v('s-never'), notifyEmails: v('s-notify'),
        hideWords: v('s-hide'), allowWords: v('s-allow'),
        ack: { enabled: c('s-ack-on'), text: v('s-ack') },
        summary: { enabled: c('s-sum-on'), time: v('s-time'), timezone: v('s-tz'), weekdaysOnly: c('s-weekdays') },
        pollMinutes: v('s-poll'),
      }), 'Settings saved.');
    } },
      h('h3', {}, 'Acknowledgement (sent automatically, no AI)'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 's-ack-on', checked: s.ack.enabled }), h('span', {}, 'Send this to people outside the firm'), h('small', {}, 'At most once a day per sender. Never sent to colleagues, newsletters or automatic emails.')),
      field('Message', Object.assign(h('textarea', { id: 's-ack', rows: 2 }), { value: s.ack.text })),
      field('Firm email domains', ta('s-firm', s.firmDomains, 2, 'e.g. kearneylaw.com.my'), 'The mailbox\'s own domain is always counted as the firm. Add any others, one per line.'),

      h('h3', {}, 'Confidentiality'),
      field('Clients', ta('s-clients', s.clients, 4, 'One per line, e.g.\nTan Ah Kow\nSyarikat Maju Jaya Sdn. Bhd.'), 'Always hidden. Names in the mailbox\'s contacts are hidden too.'),
      field('Never send to AI', ta('s-never', s.neverAI, 3, 'Email addresses, domains or words, one per line, e.g.\nceo@bigclient.com\nbigclient.com\nmerger'), 'Matching emails are left for the lawyer and never go to the AI.'),
      field('Always hide these words', ta('s-hide', s.hideWords, 3, ''), 'Added automatically when you click "Hide it". You can edit the list here.'),
      field('Words that are fine', ta('s-allow', s.allowWords, 3, ''), 'Added automatically when you click "It\'s fine".'),
      field('Tell these people when an email needs a check', ta('s-notify', s.notifyEmails, 2, 'your.name@firm.com'), 'They get a short notice with a link, with no email content.'),

      h('h3', {}, 'Daily summary'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 's-sum-on', checked: s.summary.enabled }), h('span', {}, 'Email the mailbox owner a summary every morning'), h('small', {}, 'Today\'s meetings, reply drafts waiting, and anything left for them personally.')),
      h('div', { class: 'grid' },
        h('div', { class: 'field' }, h('label', { for: 's-time' }, 'Time'), h('input', { type: 'time', id: 's-time', value: s.summary.time })),
        h('div', { class: 'field' }, h('label', { for: 's-tz' }, 'Time zone'), h('select', { id: 's-tz' },
          ['Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Kuching', 'Europe/London', 'Europe/Dublin', 'Australia/Sydney'].map((tz) => h('option', { value: tz, selected: tz === s.summary.timezone }, tz)))),
        h('div', { class: 'field' }, h('label', { for: 's-poll' }, 'Check for email every (minutes)'), h('input', { type: 'number', id: 's-poll', min: 1, max: 60, value: s.pollMinutes }))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 's-weekdays', checked: s.summary.weekdaysOnly }), h('span', {}, 'Weekdays only')),
      h('div', { class: 'nav' }, h('span'), h('button', { type: 'submit', class: 'primary', disabled: busy }, 'Save settings')));
    return card('Settings', null, form);
  }

  // ------------------------------------------------------------ activity

  const LABELS = {
    draft: 'Draft saved', read: 'Read, no reply needed', ack: 'Acknowledgement sent', queued: 'Waiting for check',
    never: 'Left for the lawyer', skipped: 'Skipped', summary: 'Summary sent', error: 'Problem', connected: 'Connected', disconnected: 'Disconnected',
  };

  function activityCard() {
    return card('Activity', 'Everything the assistant has done. "What the AI saw" shows exactly what was sent, with names hidden.',
      activity.length === 0 ? h('p', { class: 'hint' }, 'Nothing yet.') :
        h('div', { class: 'activity' }, activity.slice(0, 80).map((a) => h('div', { class: `act act-${a.action}` },
          h('div', { class: 'act-head' },
            h('span', { class: 'act-label' }, LABELS[a.action] || a.action),
            h('span', { class: 'hint' }, when(a.t))),
          (a.from || a.subject) && h('div', {}, a.from && h('b', {}, a.from), a.from && a.subject ? ' · ' : '', a.subject || ''),
          a.summary && h('div', { class: 'hint' }, a.urgency === 'high' ? '⚑ Urgent · ' : '', a.summary, a.deadline ? ` · Deadline: ${a.deadline}` : ''),
          a.detail && h('div', { class: 'hint' }, a.detail),
          a.approvedBy && h('div', { class: 'hint' }, `Checked by ${a.approvedBy}`),
          a.warning && h('div', { class: 'alert warn' }, a.warning),
          a.sentToAI && h('details', {}, h('summary', {}, 'What the AI saw'), h('pre', { class: 'payload', html: esc(a.sentToAI).replace(/\{\{[^}]+\}\}/g, (m) => `<span class="tok">${m}</span>`) }))))));
  }

  function render() {
    if (!status) {
      main.replaceChildren(h('div', { class: 'working' }, h('span', { class: 'spinner' }), 'Loading…'));
      return;
    }
    main.replaceChildren(
      h('h1', {}, 'Email assistant'),
      h('p', { class: 'intro' }, 'New emails are checked by Cloak on this server. Names and details are hidden before anything goes to the AI, and put back afterwards. Replies are saved as drafts for the lawyer to check and send.'),
      notice && h('div', { class: `alert ${notice.kind}` }, notice.text, ' ', h('button', { type: 'button', class: 'link', onclick: () => { notice = null; render(); } }, 'Dismiss')),
      connectionCard(),
      status.account && queueCard(),
      status.account && settingsCard(),
      activityCard());
  }

  fetch('/api/status').then((r) => r.json()).then((s) => {
    if (s.user) {
      document.getElementById('user-name').textContent = s.user;
      document.getElementById('logout-form').hidden = false;
    }
  }).catch(() => {});

  render();
  refresh();
  setInterval(() => { if (!open && !busy && !document.querySelector('.settings :focus')) refresh(); }, 30_000);
})();
