import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, configFromEnv } from '../server/server.js';
import { hashPassword } from '../server/auth.js';
import { createStore } from '../server/assistant/store.js';

const USERS = `nk:${hashPassword('assistant password 1')},staff:${hashPassword('staff password 12')}`;
const store = createStore({ dir: mkdtempSync(path.join(os.tmpdir(), 'cloak-r-')), key: crypto.randomBytes(32).toString('hex') });
const ms = { clientId: 'cid', clientSecret: 'secret', tenant: 'organizations', redirectUri: 'https://cloak.example.com/assistant/callback' };
const tokenCalls = [];
const fakeFetch = async (url, opts) => {
  tokenCalls.push({ url, body: String(opts.body) });
  return new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const fakeGraph = () => ({ me: async () => ({ displayName: 'Mathew Lee', mail: 'Mathew@KearneyLaw.com.my' }) });

let server, base;
before(async () => {
  const config = configFromEnv({ CLOAK_MOCK: '1', CLOAK_USERS: USERS, CLOAK_SECRET: 'y'.repeat(40), CLOAK_ASSISTANT_USERS: 'nk' });
  server = createApp(config, { store, makeGraph: fakeGraph, ms, fetchImpl: fakeFetch, startWorker: false });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function session(username, password) {
  const res = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }) });
  return res.headers.get('set-cookie').split(';')[0];
}

test('only assistant staff can open the email assistant', async () => {
  const staff = await session('staff', 'staff password 12');
  assert.equal((await fetch(`${base}/assistant`, { headers: { cookie: staff } })).status, 403);
  assert.equal((await fetch(`${base}/api/assistant/status`, { headers: { cookie: staff } })).status, 403);
  const status = await (await fetch(`${base}/api/status`, { headers: { cookie: staff } })).json();
  assert.equal(status.assistant, false);

  const nk = await session('nk', 'assistant password 1');
  assert.equal((await fetch(`${base}/assistant`, { headers: { cookie: nk } })).status, 200);
  const s = await (await fetch(`${base}/api/assistant/status`, { headers: { cookie: nk } })).json();
  assert.equal(s.microsoftReady, true);
  assert.equal(s.account, null);
  assert.equal((await (await fetch(`${base}/api/status`, { headers: { cookie: nk } })).json()).assistant, true);
});

test('not signed in at all goes to the login page', async () => {
  const res = await fetch(`${base}/assistant`, { redirect: 'manual' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login');
});

test('Microsoft connect uses PKCE and state, and the callback stores the mailbox', async () => {
  const nk = await session('nk', 'assistant password 1');
  const res = await fetch(`${base}/assistant/connect`, { redirect: 'manual', headers: { cookie: nk } });
  assert.equal(res.status, 303);
  const auth = new URL(res.headers.get('location'));
  assert.equal(auth.host, 'login.microsoftonline.com');
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.match(auth.searchParams.get('scope'), /Mail\.ReadWrite/);
  assert.match(auth.searchParams.get('scope'), /Calendars\.Read/);
  const state = auth.searchParams.get('state');

  // A forged state is refused.
  let cb = await fetch(`${base}/assistant/callback?code=abc&state=wrong`, { redirect: 'manual', headers: { cookie: nk } });
  assert.match(cb.headers.get('location'), /error=/);

  cb = await fetch(`${base}/assistant/callback?code=abc&state=${state}`, { redirect: 'manual', headers: { cookie: nk } });
  assert.equal(cb.headers.get('location'), '/assistant?connected=1');
  assert.match(tokenCalls.at(-1).body, /code_verifier=/);
  const d = await store.load();
  assert.equal(d.account.email, 'mathew@kearneylaw.com.my');
  assert.equal(d.account.tokens.refresh, 'RT');
  assert.equal(d.account.connectedBy, 'nk');

  const s = await (await fetch(`${base}/api/assistant/status`, { headers: { cookie: nk } })).json();
  assert.equal(s.account.name, 'Mathew Lee');
  assert.equal(s.account.tokens, undefined, 'tokens are never sent to the browser');
});

test('settings are validated and saved', async () => {
  const nk = await session('nk', 'assistant password 1');
  const res = await fetch(`${base}/api/assistant/settings`, {
    method: 'POST',
    headers: { cookie: nk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ firmDomains: '@KearneyLaw.sg\n', notifyEmails: 'nk@kearneylaw.com.my\nnot-an-email', summary: { enabled: true, time: '25:99', timezone: 'Not/AZone', weekdaysOnly: false }, pollMinutes: -3, ack: { enabled: true, text: '' } }),
  });
  const { settings } = await res.json();
  assert.deepEqual(settings.firmDomains, ['kearneylaw.sg']);
  assert.deepEqual(settings.notifyEmails, ['nk@kearneylaw.com.my']);
  assert.equal(settings.summary.time, '07:00');
  assert.equal(settings.summary.timezone, 'Asia/Kuala_Lumpur');
  assert.equal(settings.pollMinutes, 1);
  assert.match(settings.ack.text, /received your email/);
});

test('assistant API needs JSON for changes', async () => {
  const nk = await session('nk', 'assistant password 1');
  const res = await fetch(`${base}/api/assistant/disconnect`, { method: 'POST', headers: { cookie: nk, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'x=1' });
  assert.equal(res.status, 415);
});
