import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, configFromEnv } from '../server/server.js';
import { hashPassword, parseUsers } from '../server/auth.js';

const USERS = `nk:${hashPassword('correct horse battery')},mathew:${hashPassword('another long password')}`;
let server;
let base;

before(async () => {
  server = createApp(configFromEnv({ CLOAK_MOCK: '1', CLOAK_USERS: USERS, CLOAK_SECRET: 'x'.repeat(40), CLOAK_DRAFTS_PER_HOUR: '2', CLOAK_FIRM_NAME: 'Kearney & Co' }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function login(username, password) {
  return fetch(`${base}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
}

test('pages and API need a login', async () => {
  let res = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login');
  res = await fetch(`${base}/app.js`, { redirect: 'manual' });
  assert.equal(res.status, 303);
  res = await fetch(`${base}/api/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 401);
  res = await fetch(`${base}/api/status`);
  assert.equal(res.status, 401);
});

test('login page, stylesheet and health check are public', async () => {
  let res = await fetch(`${base}/login`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Sign in/);
  assert.match(html, /Kearney &amp; Co/);
  res = await fetch(`${base}/styles.css`);
  assert.equal(res.status, 200);
  res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
});

test('wrong password or unknown user is refused', async () => {
  let res = await login('nk', 'wrong password!!');
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
  res = await login('nobody', 'correct horse battery');
  assert.equal(res.status, 401);
});

test('correct login gives a session cookie that works, and logout ends it', async () => {
  const res = await login('NK', 'correct horse battery');
  assert.equal(res.status, 303);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const session = cookie.split(';')[0];

  const status = await (await fetch(`${base}/api/status`, { headers: { cookie: session } })).json();
  assert.equal(status.user, 'nk');
  assert.equal(status.firmName, 'Kearney & Co');

  const page = await fetch(`${base}/`, { headers: { cookie: session } });
  assert.equal(page.status, 200);

  const out = await fetch(`${base}/logout`, { method: 'POST', redirect: 'manual', headers: { cookie: session } });
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

test('a tampered cookie is rejected', async () => {
  const res = await login('nk', 'correct horse battery');
  const session = res.headers.get('set-cookie').split(';')[0];
  const [name, value] = session.split('=');
  const [body, mac] = value.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'mathew', exp: Date.now() + 1e9 })).toString('base64url');
  const r = await fetch(`${base}/api/status`, { headers: { cookie: `${name}=${forged}.${mac}` } });
  assert.equal(r.status, 401);
  assert.ok(body);
});

test('drafts are limited per user per hour', async () => {
  const res = await login('mathew', 'another long password');
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const send = () => fetch(`${base}/api/draft`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ docType: 'writ', brief: 'Jurisdiction: Singapore\nFACTS\nx' }),
  });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
});

test('repeated failed logins are blocked', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await login('nk', 'nope nope nope');
  assert.equal(last.status, 429);
});

test('parseUsers rejects bad entries', () => {
  assert.throws(() => parseUsers('no-colon-here'));
  assert.throws(() => parseUsers('Bad Name:s1$a$b'));
  assert.equal(parseUsers('').size, 0);
});
