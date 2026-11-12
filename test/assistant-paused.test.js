import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, configFromEnv } from '../server/server.js';
import { hashPassword } from '../server/auth.js';
import { createStore } from '../server/assistant/store.js';

// The email assistant is paused unless CLOAK_ASSISTANT_ENABLED=1.
const USERS = `nk:${hashPassword('assistant password 1')},staff:${hashPassword('staff password 12')}`;
const dir = mkdtempSync(path.join(os.tmpdir(), 'cloak-p-'));
const key = crypto.randomBytes(32).toString('hex');

let server, base;
before(async () => {
  // Data left behind by an earlier connection (all made up).
  const old = createStore({ dir, key });
  await old.update((d) => {
    d.account = { name: 'Mathew Lee', email: 'mathew@kearneylaw.example', connectedAt: '2026-10-20T03:00:00.000Z', connectedBy: 'nk', tokens: { refresh_token: 'RT-SECRET' } };
    d.processed = { a: 1, b: 1, c: 1 };
    d.lastCheck = '2026-11-01T09:00:00.000Z';
    d.activity = [{ t: '2026-11-01T09:00:00.000Z', action: 'draft', from: 'Ahmad bin Ismail', subject: 'Tenancy deposit dispute' }];
  });
  const config = configFromEnv({ CLOAK_MOCK: '1', CLOAK_USERS: USERS, CLOAK_SECRET: 'y'.repeat(40), CLOAK_ASSISTANT_USERS: 'nk', CLOAK_DATA_KEY: key, CLOAK_DATA_DIR: dir });
  server = createApp(config);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function session(username, password) {
  const res = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }) });
  return res.headers.get('set-cookie').split(';')[0];
}

test('paused: no worker runs and every assistant route is off', async () => {
  assert.equal(server.assistant, null);
  const nk = await session('nk', 'assistant password 1');
  for (const p of ['/api/assistant/status', '/api/assistant/settings', '/api/assistant/queue']) {
    assert.equal((await fetch(`${base}${p}`, { headers: { cookie: nk } })).status, 503, p);
  }
  assert.equal((await fetch(`${base}/assistant/connect`, { headers: { cookie: nk }, redirect: 'manual' })).status, 503);
  const status = await (await fetch(`${base}/api/status`, { headers: { cookie: nk } })).json();
  assert.equal(status.assistant, false);
});

test('paused page shows counts and dates only, never content or tokens', async () => {
  const nk = await session('nk', 'assistant password 1');
  const html = await (await fetch(`${base}/assistant`, { headers: { cookie: nk } })).text();
  assert.match(html, /The email assistant is paused/);
  assert.match(html, /mathew@kearneylaw\.example/);
  assert.match(html, /Emails processed<\/td><td><b>3</);
  assert.match(html, /2026-11-01T09:00:00\.000Z/);
  assert.doesNotMatch(html, /Ahmad|Tenancy|RT-SECRET/);

  const staff = await session('staff', 'staff password 12');
  const plain = await (await fetch(`${base}/assistant`, { headers: { cookie: staff } })).text();
  assert.match(plain, /paused/);
  assert.doesNotMatch(plain, /kearneylaw|Emails processed/);
});

test('only assistant staff can delete the data file, and it is really gone', async () => {
  const file = path.join(dir, 'assistant.enc');
  assert.ok(existsSync(file));
  const staff = await session('staff', 'staff password 12');
  assert.equal((await fetch(`${base}/assistant/delete-data`, { method: 'POST', headers: { cookie: staff } })).status, 403);
  assert.ok(existsSync(file));
  const nk = await session('nk', 'assistant password 1');
  assert.equal((await fetch(`${base}/assistant/delete-data`, { method: 'POST', headers: { cookie: nk, origin: 'https://evil.example' } })).status, 403);
  const res = await fetch(`${base}/assistant/delete-data`, { method: 'POST', headers: { cookie: nk } });
  assert.match(await res.text(), /Deleted/);
  assert.equal(existsSync(file), false);
  assert.match(await (await fetch(`${base}/assistant`, { headers: { cookie: nk } })).text(), /Nothing is stored/);
});
