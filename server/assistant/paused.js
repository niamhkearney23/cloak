// The email assistant is switched off unless CLOAK_ASSISTANT_ENABLED=1.
//
// While it is off: no mailbox is read, no routes of the assistant run, and
// its pages show a plain "paused" message. Staff allowed to use the assistant
// also see what is stored (counts and dates only, never content) and can
// delete the stored data file.

import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const DATA_FILE = 'assistant.enc';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function dataFiles(dir) {
  try {
    return (await readdir(dir)).filter((f) => f === DATA_FILE || f.startsWith(`${DATA_FILE}.`));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/** Counts and dates only. Nothing here comes from the body of any email. */
export async function storedSummary({ store, dataDir }) {
  const files = await dataFiles(dataDir);
  if (!files.length) return { exists: false };
  if (!store) return { exists: true, readable: false, why: 'CLOAK_DATA_KEY is not set, so the file cannot be opened.' };
  let d;
  try {
    d = await store.load();
  } catch (err) {
    return { exists: true, readable: false, why: err.message };
  }
  const times = (d.activity || []).map((a) => a.t).filter(Boolean).sort();
  const actions = {};
  for (const a of d.activity || []) actions[a.action || 'other'] = (actions[a.action || 'other'] || 0) + 1;
  return {
    exists: true,
    readable: true,
    account: d.account ? { mailbox: d.account.email, connectedAt: d.account.connectedAt, connectedBy: d.account.connectedBy, needsReconnect: !!d.account.needsReconnect } : null,
    lastCheck: d.lastCheck || null,
    lastSummaryDate: d.lastSummaryDate || null,
    emailsProcessed: Object.keys(d.processed || {}).length,
    acknowledgementsSent: Object.keys(d.acked || {}).length,
    waitingForCheck: (d.queue || []).length,
    questions: (d.questions || []).length,
    calendarEntries: Object.keys(d.pencilled || {}).length,
    activityEntries: (d.activity || []).length,
    firstActivity: times[0] || null,
    lastActivity: times[times.length - 1] || null,
    actions,
  };
}

function page(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email assistant paused · Cloak</title><link rel="stylesheet" href="/styles.css"></head>
<body><header class="topbar"><div class="brand"><span>Email Assistant</span></div>
<div class="topbar-actions"><a class="ghost button" href="/">Drafting</a><a class="ghost button" href="/desk">Quick desk</a></div></header>
<main class="single">${body}</main></body></html>`;
}

function summaryHtml(s) {
  if (!s.exists) return '<div class="alert ok"><b>Nothing is stored.</b> There is no email assistant data file on this server.</div>';
  if (!s.readable) return `<div class="alert warn"><b>A data file exists but could not be opened.</b> ${esc(s.why)}</div>`;
  const row = (k, v) => `<tr><td>${esc(k)}</td><td><b>${esc(v ?? 'never')}</b></td></tr>`;
  const acct = s.account
    ? row('Mailbox connected', s.account.mailbox) + row('Connected on', s.account.connectedAt) + row('Connected by (Cloak login)', s.account.connectedBy) + row('Sign-in still valid', s.account.needsReconnect ? 'no' : 'yes')
    : row('Mailbox connected', 'none right now');
  return `<table class="map">${acct}
    ${row('Last time the mailbox was checked', s.lastCheck)}
    ${row('Emails processed', s.emailsProcessed)}
    ${row('Acknowledgements sent', s.acknowledgementsSent)}
    ${row('Emails waiting for a check', s.waitingForCheck)}
    ${row('Questions stored', s.questions)}
    ${row('Calendar entries pencilled in', s.calendarEntries)}
    ${row('Activity entries', s.activityEntries)}
    ${row('First activity', s.firstActivity)}
    ${row('Last activity', s.lastActivity)}
    ${row('Last daily summary', s.lastSummaryDate)}
    ${Object.entries(s.actions).map(([k, v]) => row(`Activity: ${k}`, v)).join('')}</table>
    <p class="hint">Only the mailbox connected now (or last) is stored. Counts and dates only; no email content is shown here.</p>`;
}

/**
 * Handles every email assistant address while it is paused. Returns true when
 * the request was one of them.
 */
export function createPausedAssistant({ store, dataDir, allowedUsers, authEnabled, audit }) {
  const canUse = (user) => !authEnabled || (user && allowedUsers.has(user));

  return async function handle(req, res, { pathname, user, send }) {
    const isPage = pathname === '/assistant' || pathname === '/assistant.html';
    if (!isPage && pathname !== '/assistant.js' && !pathname.startsWith('/assistant/') && !pathname.startsWith('/api/assistant')) return false;

    if (pathname.startsWith('/api/assistant')) {
      send(503, { error: 'The email assistant is paused.' });
      return true;
    }

    if (pathname === '/assistant/delete-data' && req.method === 'POST') {
      if (!canUse(user)) { send(403, 'Your login does not have access to the email assistant.', 'text/plain; charset=utf-8'); return true; }
      // Only this site's own form may trigger the delete.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) { send(403, 'Wrong origin', 'text/plain; charset=utf-8'); return true; }
      const before = await dataFiles(dataDir);
      for (const f of before) await rm(path.join(dataDir, f), { force: true });
      const left = await dataFiles(dataDir);
      audit('assistant_data_deleted', { user, files_deleted: before.length - left.length, files_left: left.length });
      send(200, page(left.length
        ? `<div class="alert warn"><b>Not everything could be deleted.</b> ${left.length} file(s) remain. Delete the disk in the hosting dashboard.</div>`
        : `<div class="alert ok"><b>Deleted.</b> ${before.length} file(s) removed. No email assistant data file is left on this server's disk.</div>
           <p class="hint">Hosting snapshots of the disk are outside this app. See the notes you were given on Render snapshots.</p>`), 'text/html; charset=utf-8');
      return true;
    }

    const paused = '<section class="card"><h1 class="desk-title">The email assistant is paused</h1><p>No mailbox is being read and nothing is being sent to the AI. Drafting and Quick desk still work.</p></section>';
    if (!isPage || !canUse(user)) {
      send(isPage ? 200 : 503, page(paused), 'text/html; charset=utf-8');
      return true;
    }
    const s = await storedSummary({ store, dataDir });
    send(200, page(`${paused}
      <section class="card"><h2 class="desk-h">What is stored on this server</h2>${summaryHtml(s)}</section>
      ${s.exists ? `<section class="card"><h2 class="desk-h">Delete the stored data</h2>
        <p>This removes the encrypted file holding the Microsoft sign-in, the settings and the activity list. It cannot be undone.</p>
        <form method="post" action="/assistant/delete-data">
          <label class="pill"><input type="checkbox" required> I have already removed Cloak's access in Microsoft</label>
          <p><button type="submit" class="button primary">Delete the data file</button></p>
        </form></section>` : ''}`), 'text/html; charset=utf-8');
    return true;
  };
}
