#!/usr/bin/env node
// The vendor's licence tool. It runs on the vendor's own computer, never on a
// firm's, and it is not part of the installer. Nothing here uses the network.
//
//   node tools/licence.mjs keygen <folder>
//       Make the vendor's key pair in <folder>, which must be outside any git
//       repository. Keep cloak-licence-private.pem safe and offline: anyone
//       who has it can make licences.
//   node tools/licence.mjs use-key <public key file> [--to <file>]
//       Build that public key into Cloak (rewrites licence-key.js).
//   node tools/licence.mjs issue --key <private key file> --firm "Firm name" --seats 10 --expires 2027-11-14
//                                [--issued 2026-11-15] [--id CL-20261115-ABC123] [--out <file>]
//       Issue a licence. Without --out it is printed.
//   node tools/licence.mjs check <licence file> [--key <public key file>]
//       Check a licence against the key built into Cloak, or another public key.
//   node tools/licence.mjs fingerprint <key file>
//
// To keep the private key encrypted, set CLOAK_LICENCE_PASSPHRASE when making
// the key and when issuing licences.

import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLicence, dayOf, issueLicence, keyFingerprint, DEVELOPMENT_KEY_FINGERPRINT } from '../licence.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PRIVATE_NAME = 'cloak-licence-private.pem';
const PUBLIC_NAME = 'cloak-licence-public.pem';

function fail(message) {
  console.error(`licence: ${message}`);
  process.exit(1);
}

function options(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) { out._.push(args[i]); continue; }
    if (args[i + 1] === undefined) fail(`${args[i]} needs a value.`);
    out[args[i].slice(2)] = args[i + 1];
    i++;
  }
  return out;
}

// The folder of the nearest git repository at or above `dir`, if any.
function gitRoot(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (existsSync(path.join(d, '.git'))) return d;
    if (path.dirname(d) === d) return null;
  }
}

function readPrivateKey(file) {
  const pem = readFileSync(file, 'utf8');
  try {
    return createPrivateKey({ key: pem, passphrase: process.env.CLOAK_LICENCE_PASSPHRASE || undefined });
  } catch (err) {
    fail(/ENCRYPTED/.test(pem) && !process.env.CLOAK_LICENCE_PASSPHRASE ? 'the private key is encrypted: set CLOAK_LICENCE_PASSPHRASE.' : `could not read the private key (${err.message}).`);
  }
}

const commands = {
  keygen(o) {
    const dir = o._[0] || fail('say which folder the keys go in: keygen <folder>');
    if (!existsSync(dir)) fail(`${dir} does not exist.`);
    const repo = gitRoot(dir);
    if (repo) fail(`${path.resolve(dir)} is inside the git repository ${repo}. The private key must never go into a repository. Choose a folder outside it (an encrypted drive or a password manager is best).`);
    const priv = path.join(dir, PRIVATE_NAME);
    const pub = path.join(dir, PUBLIC_NAME);
    for (const f of [priv, pub]) if (existsSync(f)) fail(`${f} already exists. Nothing was changed.`);
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const passphrase = process.env.CLOAK_LICENCE_PASSPHRASE;
    writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem', ...(passphrase ? { cipher: 'aes-256-cbc', passphrase } : {}) }), { mode: 0o600, flag: 'wx' });
    writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx' });
    console.log(`Made ${priv}${passphrase ? ' (encrypted with CLOAK_LICENCE_PASSPHRASE)' : ' (NOT encrypted: set CLOAK_LICENCE_PASSPHRASE next time to encrypt it)'}`);
    console.log(`Made ${pub}`);
    console.log(`Key fingerprint: ${keyFingerprint(publicKey)}`);
    console.log(`Next: node tools/licence.mjs use-key ${pub}`);
  },

  'use-key'(o) {
    const file = o._[0] || fail('say which public key file to use: use-key <file>');
    const pem = readFileSync(file, 'utf8');
    if (/PRIVATE KEY/.test(pem)) fail('that is a PRIVATE key. Only the public key goes into Cloak. Nothing was changed.');
    let key;
    try { key = createPublicKey(pem); } catch (err) { fail(`not a public key file (${err.message}).`); }
    if (key.asymmetricKeyType !== 'ed25519') fail('the licence key must be an Ed25519 key (make one with keygen).');
    const fingerprint = keyFingerprint(key);
    const to = o.to || path.join(here, '..', 'licence-key.js');
    const clean = key.export({ type: 'spki', format: 'pem' });
    writeFileSync(to, `// The public key Cloak uses to check licences. Licences are signed with the
// matching private key, which never leaves the vendor and is never in this
// repository. Fingerprint ${fingerprint}, put here on ${dayOf()} with
// tools/licence.mjs use-key. See docs/licence.md.

export const LICENCE_PUBLIC_KEY = \`${clean}\`;
`);
    console.log(`Cloak will now accept licences signed with key ${fingerprint}${fingerprint === DEVELOPMENT_KEY_FINGERPRINT ? ' (the development key)' : ''}.`);
    console.log(`Wrote ${to}. Commit it, then build the installers.`);
  },

  issue(o) {
    const privateKey = readPrivateKey(o.key || fail('say which private key to sign with: --key <file>'));
    const text = issueLicence({ privateKey, firm: o.firm, seats: o.seats, issued: o.issued || dayOf(), expires: o.expires || fail('say when the licence ends: --expires YYYY-MM-DD'), ...(o.id ? { id: o.id } : {}) });
    if (o.out) {
      if (existsSync(o.out)) fail(`${o.out} already exists. Nothing was changed.`);
      writeFileSync(o.out, text, { flag: 'wx' });
      console.error(`Wrote ${o.out}`);
    } else {
      process.stdout.write(text);
    }
    console.error(`Signed with key ${keyFingerprint(privateKey)}${keyFingerprint(privateKey) === DEVELOPMENT_KEY_FINGERPRINT ? ' (the development key)' : ''}.`);
  },

  check(o) {
    const file = o._[0] || fail('say which licence file to check: check <file>');
    const r = checkLicence(readFileSync(file, 'utf8'), o.key ? { publicKey: readFileSync(o.key, 'utf8') } : {});
    if (r.licence) console.log(`Licensed to: ${r.licence.firm}\nSeats: ${r.licence.seats}\nIssued: ${r.licence.issued}\nEnds: ${r.licence.expires}\nLicence ID: ${r.licence.id}\nSigned with key: ${r.licence.key}`);
    console.log(`Result: ${r.status}${r.reason ? ` - ${r.reason}` : ''}`);
    process.exit(r.status === 'valid' ? 0 : 1);
  },

  fingerprint(o) {
    const file = o._[0] || fail('say which key file: fingerprint <file>');
    const pem = readFileSync(file, 'utf8');
    console.log(keyFingerprint(/PRIVATE KEY/.test(pem) ? readPrivateKey(file) : pem));
  },
};

const [command, ...rest] = process.argv.slice(2);
if (!commands[command]) {
  console.error('Usage: node tools/licence.mjs keygen <folder> | use-key <public key> | issue --key <private key> --firm "Name" --seats N --expires YYYY-MM-DD | check <licence file> | fingerprint <key>');
  process.exit(command ? 1 : 0);
}
try {
  commands[command](options(rest));
} catch (err) {
  fail(err.message);
}
