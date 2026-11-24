import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The tripwire behind the "nothing goes online" proof must record every way
// Node can reach the network that the app could plausibly use. Each attempt
// below is aimed at 127.0.0.1 and is refused before anything is sent.

const here = path.dirname(fileURLToPath(import.meta.url));
const tripwire = path.join(here, 'net-tripwire.cjs');

const SCRIPT = `
const net = require('node:net');
const dns = require('node:dns');
const { spawnSync } = require('node:child_process');
const attempt = (f) => { try { const r = f(); if (r && r.catch) r.catch(() => {}); } catch {} };
attempt(() => new dns.Resolver().resolve4('made-up.invalid'));
attempt(() => new dns.promises.Resolver().resolve4('made-up.invalid'));
attempt(() => new net.Socket().on('error', () => {}).connect('0x50', '127.0.0.1'));
attempt(() => new net.Socket().on('error', () => {}).connect('80', '127.0.0.1'));
// A Node child process must carry the tripwire too.
spawnSync(process.execPath, ['-e', "try { new (require('node:dns').Resolver)().resolve4('child.invalid'); } catch {}"], { env: process.env });
`;

test('the tripwire records dns.Resolver, string ports and Node child processes', { timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-tripwire-gaps-'));
  const log = path.join(dir, 'tripwire.log');
  const script = path.join(dir, 'attempts.cjs');
  await writeFile(log, '');
  await writeFile(script, SCRIPT);
  const child = spawn(process.execPath, ['--require', tripwire, script], { env: { ...process.env, CLOAK_NET_TRIPWIRE: log } });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, stderr);
  const entries = (await readFile(log, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const seen = entries.map((e) => `${e.what} ${e.detail}`);
  assert.deepEqual(seen, [
    'dns.Resolver.resolve4 made-up.invalid',
    'dns.promises.Resolver.resolve4 made-up.invalid',
    'socket connect 0x50',
    'socket connect 80',
    'dns.Resolver.resolve4 child.invalid',
  ], JSON.stringify(entries, null, 1));
});

test('a local pipe is still let through', { timeout: 60000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cloak-tripwire-pipe-'));
  const log = path.join(dir, 'tripwire.log');
  const script = path.join(dir, 'pipe.cjs');
  await writeFile(log, '');
  await writeFile(script, `
const net = require('node:net');
const sock = ${JSON.stringify(process.platform === 'win32' ? `\\\\.\\pipe\\cloak-tripwire-${path.basename(dir)}` : path.join(dir, 'p.sock'))};
const server = net.createServer((c) => c.end('hi')).listen(sock, () => {
  net.connect(sock).on('data', () => { server.close(); process.exit(0); });
});
`);
  const child = spawn(process.execPath, ['--require', tripwire, script], { env: { ...process.env, CLOAK_NET_TRIPWIRE: log } });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0);
  assert.equal((await readFile(log, 'utf8')).trim(), '');
});
