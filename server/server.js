// Cloak drafting server.
//
// Serves the web app and exposes POST /api/draft. The browser cloaks all names
// before calling this endpoint, so this server (and the model behind it) only
// ever sees tokens such as {{PLAINTIFF_1}}. The name map never leaves the
// browser.
//
// When CLOAK_USERS is set, every page and API call needs a staff login.

import http from 'node:http';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { DOCUMENTS, SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import { mockDraft } from './mock.js';
import { createAuth, parseUsers, rateLimiter } from './auth.js';
import { createStore } from './assistant/store.js';
import { createGraph, msConfigFromEnv } from './assistant/graph.js';
import { createAI } from './assistant/ai.js';
import { createAssistant } from './assistant/worker.js';
import { createAssistantRoutes } from './assistant/routes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(here, '..', 'public');
const MAX_BODY = 1_000_000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Pages anyone can load before logging in.
const PUBLIC_PATHS = new Set(['/login', '/styles.css', '/healthz']);

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export function configFromEnv(env = process.env) {
  return {
    model: env.CLOAK_MODEL || 'claude-opus-5',
    // Demo mode drafts from a fixed template so the app can be tried without
    // an API key. It still goes through the full cloak -> draft -> uncloak trip.
    mock: env.CLOAK_MOCK === '1' || (env.CLOAK_MOCK !== '0' && !env.ANTHROPIC_API_KEY && !env.ANTHROPIC_AUTH_TOKEN),
    users: parseUsers(env.CLOAK_USERS),
    secret: env.CLOAK_SECRET || '',
    trustProxy: env.TRUST_PROXY === '1',
    secureCookies: env.COOKIE_SECURE === '1' || env.NODE_ENV === 'production',
    draftsPerHour: Number(env.CLOAK_DRAFTS_PER_HOUR || 60),
    firmName: env.CLOAK_FIRM_NAME || '',
    // Email assistant (optional): needs CLOAK_DATA_KEY to store its data.
    dataKey: env.CLOAK_DATA_KEY || '',
    dataDir: env.CLOAK_DATA_DIR || path.resolve(here, '..', 'data'),
    publicUrl: env.CLOAK_PUBLIC_URL || '',
    ms: msConfigFromEnv(env),
    assistantUsers: new Set(String(env.CLOAK_ASSISTANT_USERS || '').split(',').map((u) => u.trim().toLowerCase()).filter(Boolean)),
  };
}

function audit(event, fields) {
  // One JSON line per event, for the hosting provider's logs. Never includes
  // case text.
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loginPage({ error, firmName }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign in · Cloak Drafting</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%231f4e79%22 d=%22M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z%22/%3E%3C/svg%3E">
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="login-body">
  <main class="login-card">
    <div class="login-brand">
      <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm0 2.2 6 2.25V11c0 3.9-2.5 7.6-6 8.9-3.5-1.3-6-5-6-8.9V6.45l6-2.25Z"/></svg>
      <div><b>Cloak Drafting</b>${firmName ? `<span>${esc(firmName)}</span>` : ''}</div>
    </div>
    ${error ? `<div class="alert warn" role="alert">${esc(error)}</div>` : ''}
    <form method="post" action="/login">
      <div class="field"><label for="u">User name</label><input type="text" id="u" name="username" autocomplete="username" required autofocus></div>
      <div class="field"><label for="p">Password</label><input type="password" id="p" name="password" autocomplete="current-password" required></div>
      <button type="submit" class="primary">Sign in</button>
    </form>
    <p class="hint">For authorised staff only. Activity is logged.</p>
  </main>
</body>
</html>`;
}

/**
 * deps lets tests swap in a fake mailbox: { store, makeGraph, ai, startWorker }.
 */
export function createApp(config = configFromEnv(), deps = {}) {
  const auth = createAuth({ users: config.users, secret: config.secret || crypto.randomBytes(32).toString('hex') });
  const loginLimit = rateLimiter(10, 15 * 60_000);
  const draftLimit = rateLimiter(config.draftsPerHour, 60 * 60_000);
  const client = config.mock ? null : new Anthropic();

  // --- email assistant
  let assistant = null;
  let assistantRoutes = null;
  const store = deps.store || (config.dataKey ? createStore({ dir: config.dataDir, key: config.dataKey }) : null);
  if (store) {
    const graphFor = deps.makeGraph || ((tokenIO) => createGraph({ ms: config.ms, ...tokenIO }));
    const makeGraph = (tokenIO) => graphFor(tokenIO || {
      getTokens: async () => (await store.load()).account?.tokens,
      saveTokens: (t) => store.update((d) => { if (d.account) d.account.tokens = t; }),
    });
    assistant = createAssistant({
      store,
      makeGraph: () => makeGraph(),
      ai: deps.ai || createAI({ mock: config.mock, model: config.model }),
      publicUrl: config.publicUrl,
      log: (line) => console.log(line),
    });
    assistantRoutes = createAssistantRoutes({
      store, assistant, ms: deps.ms !== undefined ? deps.ms : config.ms, makeGraph,
      allowedUsers: config.assistantUsers, authEnabled: auth.enabled, audit,
      fetchImpl: deps.fetchImpl,
    });
    if (deps.startWorker !== false) assistant.start();
  }

  function isSecure(req) {
    if (config.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https') return true;
    return !!req.socket.encrypted;
  }

  function clientIp(req) {
    if (config.trustProxy && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
  }

  function send(req, res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
    const headers = {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': CSP,
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      ...extra,
    };
    if (isSecure(req)) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    res.writeHead(status, headers);
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
  }

  function redirect(req, res, location, extra = {}) {
    send(req, res, 303, '', 'text/plain; charset=utf-8', { Location: location, ...extra });
  }

  async function readBody(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  async function readJson(req) {
    try {
      return JSON.parse(await readBody(req));
    } catch (err) {
      if (err.status) throw err;
      throw Object.assign(new Error('Invalid JSON'), { status: 400 });
    }
  }

  async function draft({ docType, brief, instructions }) {
    if (config.mock) return { text: mockDraft({ docType, brief, instructions }), model: 'demo' };

    const stream = client.beta.messages.stream({
      model: config.model,
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt({ docType, brief, instructions }) }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      const why = message.stop_details?.explanation || 'The drafting model declined this request.';
      throw Object.assign(new Error(why), { status: 422 });
    }
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    if (!text) throw Object.assign(new Error('The drafting model returned no text.'), { status: 502 });
    return { text, model: message.model, truncated: message.stop_reason === 'max_tokens' };
  }

  async function handleDraft(req, res, user) {
    // JSON only: a cross-site form cannot send this content type.
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
      return send(req, res, 415, { error: 'Expected JSON' });
    }
    const { docType, brief, instructions } = (await readJson(req)) || {};
    if (!DOCUMENTS[docType]) return send(req, res, 400, { error: 'Unknown document type' });
    if (typeof brief !== 'string' || !brief.trim()) return send(req, res, 400, { error: 'The case brief is empty' });
    if (instructions != null && typeof instructions !== 'string') return send(req, res, 400, { error: 'Invalid instructions' });
    if (!draftLimit.hit(user || clientIp(req))) {
      audit('draft_limited', { user, doc: docType });
      return send(req, res, 429, { error: `Drafting limit reached (${config.draftsPerHour} documents an hour). Please try again later.` });
    }

    try {
      const result = await draft({ docType, brief, instructions });
      audit('draft', { user, doc: docType, ok: true, model: result.model, chars_sent: brief.length + (instructions || '').length });
      send(req, res, 200, result);
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
      // Log the error type only, never the brief.
      audit('draft', { user, doc: docType, ok: false, status, error: `${err.name}: ${err.message}` });
      send(req, res, status, { error: err.message || 'Drafting failed' });
    }
  }

  async function handleLogin(req, res) {
    const ip = clientIp(req);
    const form = new URLSearchParams(await readBody(req));
    const username = form.get('username') || '';
    if (!loginLimit.hit(ip)) {
      audit('login_blocked', { ip, user: username.slice(0, 40) });
      return send(req, res, 429, loginPage({ error: 'Too many attempts. Wait 15 minutes and try again.', firmName: config.firmName }), 'text/html; charset=utf-8');
    }
    const result = auth.login(username, form.get('password') || '');
    if (!result) {
      audit('login_failed', { ip, user: username.slice(0, 40) });
      return send(req, res, 401, loginPage({ error: 'That user name or password is not right.', firmName: config.firmName }), 'text/html; charset=utf-8');
    }
    loginLimit.reset(ip);
    audit('login', { ip, user: result.user });
    redirect(req, res, '/', { 'Set-Cookie': auth.cookie(result.token, config.secureCookies || isSecure(req)) });
  }

  async function serveStatic(req, res, pathname) {
    let rel = pathname;
    if (rel === '/') rel = '/index.html';
    if (rel === '/assistant') rel = '/assistant.html';
    const file = path.resolve(PUBLIC_DIR, '.' + rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep) || path.basename(file) === 'package.json') {
      return send(req, res, 404, 'Not found', 'text/plain; charset=utf-8');
    }
    try {
      const data = await readFile(file);
      send(req, res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
    } catch {
      send(req, res, 404, 'Not found', 'text/plain; charset=utf-8');
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return send(req, res, 400, 'Bad request', 'text/plain; charset=utf-8');
      }

      if (pathname === '/healthz') return send(req, res, 200, { ok: true });

      if (auth.enabled) {
        if (pathname === '/login' && req.method === 'POST') return await handleLogin(req, res);
        if (pathname === '/login') {
          if (auth.userFor(req)) return redirect(req, res, '/');
          return send(req, res, 200, loginPage({ firmName: config.firmName }), 'text/html; charset=utf-8');
        }
        if (pathname === '/logout' && req.method === 'POST') {
          const user = auth.userFor(req);
          if (user) audit('logout', { user });
          return redirect(req, res, '/login', { 'Set-Cookie': auth.clearCookie(config.secureCookies || isSecure(req)) });
        }
      }

      const user = auth.enabled ? auth.userFor(req) : null;
      if (auth.enabled && !user && !PUBLIC_PATHS.has(pathname)) {
        if (pathname.startsWith('/api/')) return send(req, res, 401, { error: 'Please sign in again.' });
        return redirect(req, res, '/login');
      }

      if (assistantRoutes) {
        const handled = await assistantRoutes(req, res, {
          pathname, url, user, readJson,
          send: (status, body, type) => send(req, res, status, body, type),
          redirect: (location) => redirect(req, res, location),
        });
        if (handled) return;
      }

      if (req.method === 'GET' && pathname === '/api/status') {
        return send(req, res, 200, {
          mode: config.mock ? 'demo' : 'live',
          model: config.mock ? null : config.model,
          user,
          auth: auth.enabled,
          firmName: config.firmName || null,
          assistant: !!assistantRoutes && (!auth.enabled || config.assistantUsers.has(user)),
        });
      }
      if (req.method === 'POST' && pathname === '/api/draft') return await handleDraft(req, res, user);
      if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res, pathname);
      send(req, res, 405, { error: 'Method not allowed' });
    } catch (err) {
      if (!err.status) console.error(err);
      send(req, res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    }
  });
  server.on('close', () => assistant?.stop());
  server.assistant = assistant;
  return server;
}

function isLoopback(host) {
  return ['127.0.0.1', 'localhost', '::1'].includes(host);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '127.0.0.1';
  let config;
  try {
    config = configFromEnv();
  } catch (err) {
    console.error(`Cloak cannot start: ${err.message}`);
    process.exit(1);
  }

  // Never run open to the network without logins.
  if (!isLoopback(HOST) && config.users.size === 0 && process.env.CLOAK_ALLOW_NO_LOGIN !== '1') {
    console.error('Cloak cannot start: it is listening on a network address but no staff logins are set up.\n' +
      'Create logins with "npm run add-user" and put the result in the CLOAK_USERS setting.');
    process.exit(1);
  }
  if (config.users.size > 0 && config.secret.length < 32) {
    console.warn('Warning: CLOAK_SECRET is missing or short, so everyone will be signed out whenever the server restarts. Set it to a long random value.');
  }

  createApp(config).listen(PORT, HOST, () => {
    console.log(`Cloak running at http://${HOST}:${PORT}  (${config.mock ? 'DEMO mode: no API key set' : `live, model ${config.model}`}; ` +
      `${config.users.size ? `${config.users.size} staff login(s)` : 'no login required'})`);
  });
}
