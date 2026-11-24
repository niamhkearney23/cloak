// Test helper, never shipped. Load it into a process with
//   node --require test/net-tripwire.cjs ...      or
//   NODE_OPTIONS="--require /full/path/net-tripwire.cjs"
// and it is also loaded into every worker thread that process starts (the
// file readers and the OCR workers). Any attempt to reach the network from
// Node (fetch, http, https, http2, TCP or TLS sockets, UDP, DNS, WebSocket) is
// written to the file named in CLOAK_NET_TRIPWIRE and refused.
// Local pipes (a socket with a path rather than a port) are not the network
// and are let through. A port written as a string ('80', '0x50') is a port.
// It also puts itself into NODE_OPTIONS so a Node child process (and any
// worker) loads it too. Programs that are not Node (powershell.exe, cmd.exe)
// are not covered: this file cannot see inside them.
'use strict';
const fs = require('node:fs');
const { threadId } = require('node:worker_threads');

const logFile = process.env.CLOAK_NET_TRIPWIRE;

function trip(what, detail) {
  const where = (new Error().stack || '').split('\n').slice(3, 9).map((l) => l.trim()).join(' | ');
  try { fs.appendFileSync(logFile, `${JSON.stringify({ what, detail: String(detail ?? ''), thread: threadId, where })}\n`); } catch { /* nothing to log to */ }
  throw Object.assign(new Error(`Network use refused by the test tripwire: ${what} ${detail ?? ''}`), { code: 'CLOAK_NET_TRIPWIRE' });
}

const describe = (x) => {
  try { return typeof x === 'string' ? x : x instanceof URL ? x.href : JSON.stringify(x, (k, v) => (typeof v === 'function' ? undefined : v)).slice(0, 200); } catch { return String(x); }
};

if (logFile) {
  const net = require('node:net');
  const connect = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function (...args) {
    // Node passes [options, callback] arrays internally.
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const pipe = (typeof first === 'string' && !(Number(first) >= 0)) || (first && typeof first === 'object' && first.path != null && first.port == null);
    if (!pipe) trip('socket connect', describe(first));
    return connect.apply(this, args);
  };
  for (const name of ['http', 'https']) {
    const mod = require(`node:${name}`);
    mod.request = (...args) => trip(`${name}.request`, describe(args[0]));
    mod.get = (...args) => trip(`${name}.get`, describe(args[0]));
  }
  require('node:http2').connect = (...args) => trip('http2.connect', describe(args[0]));
  require('node:dgram').createSocket = (...args) => trip('udp socket', describe(args[0]));
  const dns = require('node:dns');
  for (const fn of ['lookup', 'lookupService', 'resolve', 'resolve4', 'resolve6', 'resolveAny', 'resolveCname', 'resolveMx', 'resolveNs', 'resolveTxt', 'resolveSrv', 'reverse']) {
    dns[fn] = (...args) => trip(`dns.${fn}`, describe(args[0]));
    if (dns.promises[fn]) dns.promises[fn] = (...args) => trip(`dns.promises.${fn}`, describe(args[0]));
  }
  // dns.Resolver sends its own queries and does not go through dns.resolve*.
  for (const [label, proto] of [['dns.Resolver', dns.Resolver.prototype], ['dns.promises.Resolver', dns.promises.Resolver.prototype]]) {
    for (const fn of Object.getOwnPropertyNames(proto)) {
      if (typeof proto[fn] !== 'function' || fn === 'constructor' || /^(?:get|set|cancel)/.test(fn)) continue;
      proto[fn] = (...args) => trip(`${label}.${fn}`, describe(args[0]));
    }
  }
  // Node children inherit the tripwire through NODE_OPTIONS.
  const own = `--require ${JSON.stringify(__filename)}`;
  if (!(process.env.NODE_OPTIONS || '').includes(own)) process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${own}`.trim();
  globalThis.fetch = (...args) => trip('fetch', describe(args[0]));
  if (globalThis.WebSocket) globalThis.WebSocket = function WebSocket(url) { trip('WebSocket', describe(url)); };
}
