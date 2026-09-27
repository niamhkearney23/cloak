// Cloak drafting server.
//
// Serves the web app and exposes POST /api/draft. The browser cloaks all names
// before calling this endpoint, so this server (and the model behind it) only
// ever sees tokens such as {{PLAINTIFF_1}}. The name map never leaves the
// browser.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { DOCUMENTS, SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';
import { mockDraft } from './mock.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(here, '..', 'public');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.CLOAK_MODEL || 'claude-opus-5';
const MAX_BODY = 1_000_000;

// Demo mode drafts from a fixed template so the app can be tried without an
// API key. It still goes through the full cloak -> draft -> uncloak round trip.
const MOCK = process.env.CLOAK_MOCK === '1' ||
  (process.env.CLOAK_MOCK !== '0' && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN);

const client = MOCK ? null : new Anthropic();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

async function draft({ docType, brief, instructions }) {
  if (MOCK) return { text: mockDraft({ docType, brief, instructions }), model: 'demo' };

  const stream = client.beta.messages.stream({
    model: MODEL,
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
  return {
    text,
    model: message.model,
    truncated: message.stop_reason === 'max_tokens',
  };
}

async function handleDraft(req, res) {
  const body = await readJson(req);
  const { docType, brief, instructions } = body || {};
  if (!DOCUMENTS[docType]) return send(res, 400, { error: 'Unknown document type' });
  if (typeof brief !== 'string' || !brief.trim()) return send(res, 400, { error: 'The case brief is empty' });
  if (instructions != null && typeof instructions !== 'string') return send(res, 400, { error: 'Invalid instructions' });

  try {
    send(res, 200, await draft({ docType, brief, instructions }));
  } catch (err) {
    const status = err.status && err.status < 600 ? err.status : 502;
    // Log the error type only, never the brief.
    console.error(`[draft ${docType}] ${status} ${err.name}: ${err.message}`);
    send(res, status >= 400 ? status : 502, { error: err.message || 'Drafting failed' });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  try {
    const data = await readFile(file);
    send(res, 200, data, TYPES[path.extname(file)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found', 'text/plain');
  }
}

export const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/status') {
      return send(res, 200, { mode: MOCK ? 'demo' : 'live', model: MOCK ? null : MODEL });
    }
    if (req.method === 'POST' && req.url === '/api/draft') return await handleDraft(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res);
    send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || 'Server error' });
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, HOST, () => {
    console.log(`Cloak running at http://${HOST}:${PORT}  (${MOCK ? 'DEMO mode: no API key set' : `live, model ${MODEL}`})`);
  });
}
