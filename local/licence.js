// The offline licence.
//
// A licence is a short text file naming the firm, the number of seats, the
// issue and expiry dates and a licence ID, signed by the vendor with an
// Ed25519 key. Cloak checks the signature here, on this computer, with the
// vendor's public key built into the app (licence-key.js). Nothing is sent
// anywhere, nothing is looked up online and nothing is activated.
//
// No licence, or one that has ended, means an evaluation copy: everything
// works, but cloaked copies can be exported only from matters ticked as
// made-up test documents. Restoring a draft always works, licensed or not, so
// a firm is never locked out of its own real values.
//
// Seats are shown, not counted or enforced.
//
// Limits: the check runs in plain JavaScript on the firm's own computer and
// trusts the computer's clock. It keeps an honest firm honest; it is not copy
// protection. See docs/licence.md.

import { KeyObject, createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { LICENCE_PUBLIC_KEY } from './licence-key.js';

/** Fingerprint of the development key in licence-key.js. Its private half was thrown away. */
export const DEVELOPMENT_KEY_FINGERPRINT = '01092F4C1B3F50A4';

const BEGIN = '-----BEGIN CLOAK LICENCE-----';
const END = '-----END CLOAK LICENCE-----';
// Signed together with the details, so a signature made for a licence means nothing anywhere else.
const CONTEXT = Buffer.from('cloak-licence-v1\n');
const MAX_TEXT = 16 * 1024; // the licence block itself
const MAX_LOOKED_AT = 1024 * 1024; // all the text it is looked for in
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NO_LICENCE = 'There is no licence on this computer.';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const wrap = (s) => s.match(/.{1,64}/g).join('\n');
const pad = (n) => String(n).padStart(2, '0');
const same = (a, b) => String(a).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase() === String(b).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** A calendar date as YYYY-MM-DD, in this computer's time zone. */
export const dayOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function isDay(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}
const dayNumber = (s) => Date.parse(`${s}T00:00:00Z`) / 86400000;

/** "14 Nov 2027" for 2027-11-14. */
export function formatDay(s) {
  if (!isDay(s)) return String(s ?? '');
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// Keys may be PEM text or KeyObjects; a private key also gives its public key.
const toPublic = (k) => (k instanceof KeyObject && k.type === 'public' ? k : createPublicKey(k));
const toPrivate = (k) => (k instanceof KeyObject ? k : createPrivateKey(k));

/** A short name for a public key: the first 16 hex digits of the SHA-256 of the key. */
export function keyFingerprint(key) {
  return createHash('sha256').update(toPublic(key).export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16).toUpperCase();
}

export const newLicenceId = (issued = dayOf()) => `CL-${issued.replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;

const SUMMARY = [
  ['product', 'Product', (d) => d.product],
  ['licensed to', 'Licensed to', (d) => d.firm],
  ['seats', 'Seats', (d) => String(d.seats)],
  ['issued', 'Issued', (d) => formatDay(d.issued)],
  ['expires', 'Expires', (d) => formatDay(d.expires)],
  ['licence id', 'Licence ID', (d) => d.id],
];

function checkDetails(d) {
  if (!d || typeof d !== 'object') return 'the details are damaged.';
  if (d.product !== 'Cloak' || d.format !== 1) return 'it is not a Cloak licence, or it is for a newer version of Cloak.';
  if (typeof d.firm !== 'string' || !d.firm.trim() || d.firm.length > 200) return 'it must name the firm (200 characters at most).';
  if (!Number.isInteger(d.seats) || d.seats < 1 || d.seats > 100000) return 'seats must be a whole number from 1 to 100,000.';
  if (!isDay(d.issued) || !isDay(d.expires)) return 'dates must be real dates written as YYYY-MM-DD.';
  if (d.expires < d.issued) return 'it would end before it was issued.';
  if (typeof d.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{3,63}$/.test(d.id)) return 'the licence ID may use letters, digits and hyphens (4 to 64 characters).';
  if (typeof d.key !== 'string' || !/^[0-9A-F]{16}$/.test(d.key)) return 'it does not say which key signed it.';
  return null;
}

/**
 * Make a licence. Used by the vendor's tool (tools/licence.mjs) and the tests.
 * `privateKey` is the vendor's Ed25519 private key: PEM text or a KeyObject.
 */
export function issueLicence({ privateKey, firm, seats, issued = dayOf(), expires, id = newLicenceId(issued) }) {
  const key = toPrivate(privateKey);
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') throw new Error('The licence key must be an Ed25519 private key.');
  const details = { product: 'Cloak', format: 1, id, firm: String(firm ?? '').replace(/\s+/g, ' ').trim(), seats: Number(seats), issued, expires, key: keyFingerprint(key) };
  const problem = checkDetails(details);
  if (problem) throw new Error(`Cannot issue this licence: ${problem}`);
  const payload = Buffer.from(JSON.stringify(details), 'utf8');
  const signature = sign(null, Buffer.concat([CONTEXT, payload]), key);
  return [BEGIN, ...SUMMARY.map(([, label, value]) => `${label}: ${value(details)}`), '', 'Data:', wrap(b64url(payload)), 'Signature:', wrap(b64url(signature)), END, ''].join('\n');
}

// The lines of the licence block, with email quoting ("> ") and stray spaces taken off.
function blockLines(text) {
  const t = String(text ?? '');
  if (t.length > MAX_LOOKED_AT) return null; // a generous bound on the text looked through at all (a long email thread)
  const lines = t.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^\s*(?:>\s?)+/, '').trim());
  const a = lines.indexOf(BEGIN);
  const b = a < 0 ? -1 : lines.indexOf(END, a + 1);
  if (a < 0 || b < 0) return null;
  const block = lines.slice(a, b + 1);
  return block.join('\n').length > MAX_TEXT ? null : block; // the 16 KB limit is for the licence itself
}

/** The licence block on its own, tidied, for saving. */
export function licenceBlock(text) {
  const lines = blockLines(text);
  return lines ? `${lines.join('\n')}\n` : null;
}

function parse(text) {
  const lines = blockLines(text);
  if (!lines) return null;
  const body = lines.slice(1, -1);
  const di = body.indexOf('Data:');
  const si = body.indexOf('Signature:');
  if (di < 0 || si < di) return null;
  const summary = {};
  for (const l of body.slice(0, di)) {
    const m = l.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (m) summary[m[1].trim().toLowerCase()] = m[2];
  }
  const joined = (ls) => ls.join('').replace(/\s+/g, '').replace(/=+$/, '');
  const data = joined(body.slice(di + 1, si));
  const sig = joined(body.slice(si + 1));
  if (!/^[A-Za-z0-9_+/-]+$/.test(data) || !/^[A-Za-z0-9_+/-]+$/.test(sig)) return null;
  return { payload: unb64(data), signature: unb64(sig), summary };
}

/** Is the licence still running today? Works on the details of a licence that has been checked. */
export function licenceState(licence, today = new Date()) {
  if (!licence) return { status: 'none', code: 'NONE', reason: NO_LICENCE };
  const daysLeft = dayNumber(licence.expires) - dayNumber(dayOf(today));
  if (daysLeft < 0) return { status: 'expired', code: 'EXPIRED', reason: `This licence ended on ${formatDay(licence.expires)}. Cloak now works as an evaluation copy.`, daysLeft };
  return { status: 'valid', code: 'VALID', reason: null, daysLeft };
}

/**
 * Check a licence against the public key built into the app (or `publicKey`).
 * Returns { status: 'valid' | 'expired' | 'invalid', code, reason, licence }.
 * Codes: VALID, EXPIRED, NOT_A_LICENCE, CHANGED (altered since it was issued),
 * OTHER_KEY (issued with another key: not for this copy), BAD_DETAILS, NO_KEY.
 */
export function checkLicence(text, { publicKey = LICENCE_PUBLIC_KEY, today = new Date() } = {}) {
  const fail = (code, reason) => ({ status: 'invalid', code, reason });
  const p = parse(text);
  if (!p) return fail('NOT_A_LICENCE', 'This is not a Cloak licence. Paste the whole text, from BEGIN CLOAK LICENCE to END CLOAK LICENCE, or choose the licence file.');
  let pub;
  try {
    pub = toPublic(publicKey);
    if (pub.asymmetricKeyType !== 'ed25519') throw new Error('not ed25519');
  } catch {
    return fail('NO_KEY', 'This copy of Cloak has no usable licence key, so no licence can be checked.');
  }
  const fingerprint = keyFingerprint(pub);
  let details = null;
  try { details = JSON.parse(p.payload.toString('utf8')); } catch { details = null; }
  let good = false;
  try { good = p.signature.length === 64 && verify(null, Buffer.concat([CONTEXT, p.payload]), pub, p.signature); } catch { good = false; }
  const otherKey = () => fail('OTHER_KEY', 'This licence was issued for a different copy of Cloak (it was signed with another key). Ask the supplier for a licence for this copy.');
  if (!good) {
    if (details && typeof details.key === 'string' && details.key !== fingerprint) return otherKey();
    return fail('CHANGED', 'This licence has been changed since it was issued, so it cannot be used. Ask the supplier for a fresh copy of the licence file.');
  }
  const problem = checkDetails(details);
  if (problem) return fail('BAD_DETAILS', `This licence cannot be used: ${problem}`);
  if (details.key !== fingerprint) return otherKey();
  // The readable lines at the top must say the same as the signed details.
  for (const [key, label, value] of SUMMARY) {
    if (key in p.summary && !same(p.summary[key], value(details))) return fail('CHANGED', `The "${label}" line of this licence has been changed since it was issued, so it cannot be used. Ask the supplier for a fresh copy of the licence file.`);
  }
  const licence = { id: details.id, firm: details.firm, seats: details.seats, issued: details.issued, expires: details.expires, key: fingerprint };
  return { ...licenceState(licence, today), licence };
}

/** A licence file's text: UTF-8 (BOM or not), or UTF-16 with a BOM (Windows PowerShell 5.1 Out-File and ">"). Never throws. */
export function licenceFileText(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le', 2);
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2, buf.length - (buf.length % 2))).swap16().toString('utf16le');
  return buf.toString('utf8');
}

/**
 * Look for a licence: the person's own first, then one IT put on the computer
 * for everyone. `files` is a list of { file, where }. Returns the first valid
 * licence, or else what was wrong with the first one found.
 */
export async function findLicence({ files, publicKey = LICENCE_PUBLIC_KEY, today = new Date() }) {
  let first = null;
  for (const { file, where } of files) {
    let text;
    try { text = licenceFileText(await readFile(file)); } catch { continue; }
    const r = { ...checkLicence(text, { publicKey, today }), file, where };
    if (r.status === 'valid') return r;
    first ||= r;
  }
  return first || { status: 'none', code: 'NONE', reason: NO_LICENCE };
}

/** True when `result` (from checkLicence or findLicence) is a licence that is still running today. */
export function isLicensed(result, today = new Date()) {
  return result?.status === 'valid' && !!result.licence && licenceState(result.licence, today).status === 'valid';
}

/**
 * An evaluation copy (no licence, or one that has ended) exports cloaked
 * copies only from matters ticked as made-up test documents, whatever any
 * other check says. This is deliberately a check of its own. Restoring a
 * draft never calls it.
 */
export function assertLicenceAllowsExport({ licence, testMatter, today = new Date() }) {
  if (testMatter || isLicensed(licence, today)) return;
  throw Object.assign(new Error('This is an evaluation copy of Cloak, so cloaked copies can be exported only from matters that hold made-up test documents. To export other matters, add the firm\'s licence: on the home screen, choose Licence. Restoring drafts works without a licence.'), { code: 'EVALUATION_TEST_MATTERS_ONLY' });
}

/** What the export report says about the licence. */
export function licenceForReport(licence, today = new Date()) {
  if (isLicensed(licence, today)) return { licensed_to: licence.licence.firm, licence_id: licence.licence.id, licence_ends: licence.licence.expires };
  return { evaluation_copy: true, note: 'No running licence: exports are limited to matters ticked as made-up test documents.' };
}

/** What the Licence screen and the window bar show. */
export function licenceView(result, today = new Date()) {
  const l = result?.licence || null;
  const state = l ? licenceState(l, today) : null;
  const licensed = isLicensed(result, today);
  return {
    licensed,
    status: licensed ? 'valid' : state?.status === 'expired' ? 'expired' : result?.status === 'invalid' ? 'invalid' : 'none',
    reason: licensed ? null : (state?.reason || result?.reason || NO_LICENCE),
    firm: l?.firm ?? null,
    id: l?.id ?? null,
    seats: l?.seats ?? null,
    issued: l ? formatDay(l.issued) : null,
    expires: l ? formatDay(l.expires) : null,
    daysLeft: state ? state.daysLeft : null,
    where: result?.where ?? null,
  };
}
