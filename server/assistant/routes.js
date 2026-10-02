// Web routes for the email assistant page. Only staff listed in
// CLOAK_ASSISTANT_USERS can use them (when logins are switched on).

import crypto from 'node:crypto';
import { authorizeUrl, exchangeCode, pkcePair } from './graph.js';
import { DEFAULT_SETTINGS } from './store.js';

const list = (v, max = 500) => (Array.isArray(v) ? v : String(v || '').split('\n'))
  .map((s) => String(s).trim()).filter(Boolean).slice(0, max).map((s) => s.slice(0, 200));

function cleanSettings(input, current) {
  const s = structuredClone(current);
  if ('firmDomains' in input) s.firmDomains = list(input.firmDomains).map((d) => d.toLowerCase().replace(/^@/, ''));
  if ('clients' in input) s.clients = list(input.clients);
  if ('neverAI' in input) s.neverAI = list(input.neverAI);
  if ('allowWords' in input) s.allowWords = list(input.allowWords, 5000);
  if ('hideWords' in input) s.hideWords = list(input.hideWords, 5000);
  if ('notifyEmails' in input) s.notifyEmails = list(input.notifyEmails, 20).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (input.ack) {
    s.ack.enabled = !!input.ack.enabled;
    const text = String(input.ack.text ?? s.ack.text).trim().slice(0, 1000);
    s.ack.text = text || DEFAULT_SETTINGS.ack.text;
  }
  if (input.summary) {
    s.summary.enabled = !!input.summary.enabled;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(input.summary.time || '')) s.summary.time = input.summary.time;
    if (input.summary.timezone) {
      try {
        new Intl.DateTimeFormat('en-GB', { timeZone: input.summary.timezone });
        s.summary.timezone = input.summary.timezone;
      } catch { /* keep the old one */ }
    }
    s.summary.weekdaysOnly = !!input.summary.weekdaysOnly;
  }
  if ('pollMinutes' in input) s.pollMinutes = Math.min(60, Math.max(1, Number(input.pollMinutes) || 5));
  if ('paused' in input) s.paused = !!input.paused;
  return s;
}

export function createAssistantRoutes({ store, assistant, ms, makeGraph, allowedUsers, authEnabled, audit, fetchImpl = fetch }) {
  const pending = new Map(); // OAuth state -> { verifier, user, exp }

  const canUse = (user) => !authEnabled || (user && allowedUsers.has(user));

  return async function handle(req, res, { pathname, url, user, send, redirect, readJson }) {
    const isPage = pathname === '/assistant' || pathname === '/assistant.html' || pathname === '/assistant.js';
    if (!isPage && !pathname.startsWith('/assistant/') && !pathname.startsWith('/api/assistant')) return false;
    if (!canUse(user)) {
      if (pathname.startsWith('/api/')) send(403, { error: 'Your login does not have access to the email assistant.' });
      else send(403, 'Your login does not have access to the email assistant.', 'text/plain; charset=utf-8');
      return true;
    }
    if (isPage) return false; // served as a normal static file

    const json = async () => {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
        throw Object.assign(new Error('Expected JSON'), { status: 415 });
      }
      return (await readJson(req)) || {};
    };

    // --- Microsoft sign-in
    if (req.method === 'GET' && pathname === '/assistant/connect') {
      if (!ms) { redirect('/assistant?error=' + encodeURIComponent('Microsoft 365 is not set up on the server yet. See ASSISTANT.md.')); return true; }
      const state = crypto.randomBytes(16).toString('base64url');
      const { verifier, challenge } = pkcePair();
      pending.set(state, { verifier, user, exp: Date.now() + 10 * 60_000 });
      for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k);
      redirect(authorizeUrl(ms, { state, challenge }));
      return true;
    }
    if (req.method === 'GET' && pathname === '/assistant/callback') {
      const state = url.searchParams.get('state') || '';
      const p = pending.get(state);
      pending.delete(state);
      const fail = (msg) => { redirect('/assistant?error=' + encodeURIComponent(msg)); return true; };
      if (url.searchParams.get('error')) return fail(url.searchParams.get('error_description') || 'Microsoft sign-in was cancelled.');
      if (!p || p.exp < Date.now() || p.user !== user) return fail('The sign-in link expired. Please click Connect again.');
      try {
        const tokens = await exchangeCode(ms, { code: url.searchParams.get('code') || '', verifier: p.verifier }, fetchImpl);
        let saved = tokens;
        const graph = makeGraph({ getTokens: async () => saved, saveTokens: async (t) => { saved = t; } });
        const me = await graph.me();
        await store.update((d) => {
          d.account = {
            name: me.displayName,
            email: (me.mail || me.userPrincipalName || '').toLowerCase(),
            tokens: saved,
            connectedAt: new Date().toISOString(),
            connectedBy: user,
            needsReconnect: false,
          };
          // Only handle mail from now on, not the whole old inbox.
          d.lastCheck = new Date().toISOString();
        });
        await store.log({ action: 'connected', detail: `Mailbox ${me.mail || me.userPrincipalName} connected by ${user || 'local user'}` });
        audit('assistant_connected', { user, mailbox: me.mail || me.userPrincipalName });
        redirect('/assistant?connected=1');
      } catch (err) {
        return fail(`Microsoft sign-in failed: ${err.message}`);
      }
      return true;
    }

    // --- JSON API
    if (req.method === 'GET' && pathname === '/api/assistant/status') {
      const d = await store.load();
      send(200, {
        microsoftReady: !!ms,
        account: d.account ? { name: d.account.name, email: d.account.email, connectedAt: d.account.connectedAt, connectedBy: d.account.connectedBy, needsReconnect: !!d.account.needsReconnect } : null,
        settings: d.settings,
        waiting: d.queue.filter((q) => q.status === 'waiting').length,
        lastCheck: d.lastCheck,
        lastSummaryDate: d.lastSummaryDate,
      });
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/assistant/settings') {
      const input = await json();
      const settings = await store.update((d) => { d.settings = cleanSettings(input, d.settings); return d.settings; });
      audit('assistant_settings', { user });
      send(200, { settings });
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/assistant/disconnect') {
      await json();
      await store.update((d) => { d.account = null; });
      await store.log({ action: 'disconnected', detail: `Mailbox disconnected by ${user || 'local user'}` });
      audit('assistant_disconnected', { user });
      send(200, { ok: true });
      return true;
    }
    if (req.method === 'GET' && pathname === '/api/assistant/queue') {
      const d = await store.load();
      send(200, { queue: d.queue.slice(0, 100) });
      return true;
    }
    const item = /^\/api\/assistant\/queue\/([^/]+)(?:\/(approve|personal))?$/.exec(pathname);
    if (item) {
      const id = item[1];
      const d = await store.load();
      if (!d.queue.some((q) => q.id === id)) { send(404, { error: 'Not in the check list.' }); return true; }
      if (req.method === 'GET' && !item[2]) {
        send(200, await assistant.reviewItem(id));
        return true;
      }
      if (req.method === 'POST' && item[2] === 'approve') {
        const body = await json();
        const result = await assistant.approve(id, { hide: list(body.hide, 200), allow: list(body.allow, 200) }, user || 'local user');
        audit('assistant_approved', { user, result: result.status });
        send(200, result);
        return true;
      }
      if (req.method === 'POST' && item[2] === 'personal') {
        await json();
        await assistant.handlePersonally(id, user || 'local user');
        audit('assistant_personal', { user });
        send(200, { ok: true });
        return true;
      }
    }
    if (req.method === 'POST' && pathname === '/api/assistant/run') {
      await json();
      send(200, await assistant.checkMail());
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/assistant/summary') {
      await json();
      send(200, await assistant.sendSummary({ force: true }));
      return true;
    }
    if (req.method === 'GET' && pathname === '/api/assistant/activity') {
      const d = await store.load();
      send(200, { activity: d.activity.slice(0, 200) });
      return true;
    }
    send(404, { error: 'Not found' });
    return true;
  };
}
