// The matter key file: the map from each tag to its real value.
//
// It lives on this computer or the firm's own drive and nowhere else. Nothing
// in this file talks to a network.
//
// How it is protected
//   - The contents are encrypted with AES-256-GCM under a random 256-bit
//     "data key" made for this matter.
//   - The data key is itself locked twice: once with a key derived from the
//     matter password, once with a key derived from the recovery code. Either
//     one opens the matter. Both derivations use scrypt, which makes guessing
//     slow (about a third of a second and 128 MB of memory per guess).
//   - The password and the recovery code are never stored anywhere.
//   - There is no back door. If both are lost, the key cannot be opened.
//   - Any change to the file (even one byte) is detected when it is opened.

import crypto from 'node:crypto';
import { readFile, rename, writeFile, copyFile } from 'node:fs/promises';
import { VERSION } from './version.js';

export const KEY_FILE_NAME = 'matter.cloakkey';
const FORMAT = 'cloak-key';
const FORMAT_VERSION = 1;
const SCRYPT = { N: 2 ** 17, r: 8, p: 1 };
export const MIN_PASSWORD_LENGTH = 10;

// Letters and digits that are not easily mistaken for each other.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const b64 = (b) => b.toString('base64');
const un64 = (s) => Buffer.from(s, 'base64');

function derive(secret, salt, kdf) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(Buffer.from(secret.normalize('NFKC'), 'utf8'), salt, 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 256 * kdf.N * kdf.r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function seal(key, plain, aad) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) c.setAAD(aad);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return { iv: b64(iv), tag: b64(c.getAuthTag()), data: b64(data) };
}

function unseal(key, box, aad) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, un64(box.iv));
  if (aad) d.setAAD(aad);
  d.setAuthTag(un64(box.tag));
  return Buffer.concat([d.update(un64(box.data)), d.final()]);
}

export function newRecoveryCode() {
  const bytes = crypto.randomBytes(24);
  const chars = [...bytes].map((b) => ALPHABET[b % 32]);
  return chars.join('').match(/.{4}/g).join('-');
}
/** Typed-in recovery codes: case, spaces and look-alike letters do not matter. */
const tidyCode = (code) => String(code || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');

export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) throw new Error(`The matter password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

async function slot(type, secret, dataKey, kdf) {
  const salt = crypto.randomBytes(16);
  return { type, salt: b64(salt), ...seal(await derive(secret, salt, kdf), dataKey) };
}

// The header is bound to the contents: swapping it for another matter's
// header makes the file fail to open.
const aadOf = (file) => Buffer.from(JSON.stringify([file.format, file.format_version, file.matter_id]), 'utf8');

async function write(path, file) {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 1), { mode: 0o600 });
  // Keep the previous version beside it (also encrypted) in case a save is cut short.
  await copyFile(path, `${path}.bak`).catch(() => {});
  await rename(tmp, path);
}

/**
 * Make a new key file. Returns the recovery code, which is shown once and
 * never stored.
 */
export async function createKeyFile(path, { password, contents, kdf = SCRYPT }) {
  checkPassword(password);
  const dataKey = crypto.randomBytes(32);
  const recoveryCode = newRecoveryCode();
  const file = {
    format: FORMAT,
    format_version: FORMAT_VERSION,
    cloak_version: VERSION,
    matter_id: crypto.randomUUID(),
    created: new Date().toISOString(),
    note: 'Cloak matter key. Encrypted. Keep it on the firm\'s own drive. Never email it or upload it.',
    kdf: { name: 'scrypt', ...kdf },
    slots: [await slot('password', password, dataKey, kdf), await slot('recovery', tidyCode(recoveryCode), dataKey, kdf)],
  };
  file.contents = seal(dataKey, Buffer.from(JSON.stringify(contents), 'utf8'), aadOf(file));
  await writeFile(path, JSON.stringify(file, null, 1), { mode: 0o600, flag: 'wx' });
  return { recoveryCode, dataKey, matterId: file.matter_id };
}

async function load(path) {
  let file;
  try {
    file = JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('There is no matter key in this folder.');
    throw new Error('The matter key file is damaged and cannot be read.');
  }
  if (file.format !== FORMAT) throw new Error('This is not a Cloak matter key.');
  if (file.format_version > FORMAT_VERSION) throw new Error(`This matter key was made by a newer Cloak (${file.cloak_version}). Update Cloak to open it.`);
  return file;
}

/** Open with the password or the recovery code. */
export async function openKeyFile(path, { password, recoveryCode }) {
  const file = await load(path);
  const type = recoveryCode ? 'recovery' : 'password';
  const secret = recoveryCode ? tidyCode(recoveryCode) : String(password || '');
  const s = file.slots.find((x) => x.type === type);
  let dataKey;
  try {
    dataKey = unseal(await derive(secret, un64(s.salt), file.kdf), s);
  } catch {
    throw Object.assign(new Error(recoveryCode ? 'That recovery code is not right.' : 'That password is not right.'), { code: 'WRONG_SECRET' });
  }
  let contents;
  try {
    contents = JSON.parse(unseal(dataKey, file.contents, aadOf(file)).toString('utf8'));
  } catch {
    throw new Error('The matter key file has been changed or damaged and cannot be opened. Restore the copy named matter.cloakkey.bak.');
  }
  return { contents, dataKey, matterId: file.matter_id, created: file.created, madeWith: file.cloak_version, openedWith: type };
}

/** Save new contents under the same data key. */
export async function saveKeyFile(path, dataKey, contents) {
  const file = await load(path);
  file.cloak_version = VERSION;
  file.saved = new Date().toISOString();
  file.contents = seal(dataKey, Buffer.from(JSON.stringify(contents), 'utf8'), aadOf(file));
  await write(path, file);
}

/** Set a new password. Needs the data key, i.e. the matter must be open. */
export async function setPassword(path, dataKey, password) {
  checkPassword(password);
  const file = await load(path);
  file.slots = [await slot('password', password, dataKey, file.kdf), ...file.slots.filter((s) => s.type !== 'password')];
  await write(path, file);
}

/** Replace the recovery code (the old one stops working). */
export async function replaceRecoveryCode(path, dataKey) {
  const file = await load(path);
  const recoveryCode = newRecoveryCode();
  file.slots = [...file.slots.filter((s) => s.type !== 'recovery'), await slot('recovery', tidyCode(recoveryCode), dataKey, file.kdf)];
  await write(path, file);
  return recoveryCode;
}

/** Encrypt / decrypt a cache entry with a key derived from the data key. */
export function cacheCrypto(dataKey) {
  const key = Buffer.from(crypto.hkdfSync('sha256', dataKey, Buffer.alloc(0), 'cloak cache v1', 32));
  return {
    encrypt: (obj) => { const box = seal(key, Buffer.from(JSON.stringify(obj), 'utf8')); return Buffer.concat([Buffer.from('CLC1'), un64(box.iv), un64(box.tag), un64(box.data)]); },
    decrypt: (buf) => {
      if (buf.subarray(0, 4).toString() !== 'CLC1') throw new Error('not a Cloak cache file');
      return JSON.parse(unseal(key, { iv: b64(buf.subarray(4, 16)), tag: b64(buf.subarray(16, 32)), data: b64(buf.subarray(32)) }).toString('utf8'));
    },
    // File names in the cache folder are keyed hashes: they say nothing
    // about the original file to someone without the matter key.
    name: (fileHash) => crypto.createHmac('sha256', key).update(fileHash).digest('hex'),
  };
}
