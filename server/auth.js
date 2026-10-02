// Logins for Cloak: named staff accounts, signed session cookies, and simple
// rate limits. No database: accounts live in the CLOAK_USERS setting.
//
// CLOAK_USERS holds one entry per person, separated by commas:
//   name:s1$<salt>$<hash>,othername:s1$<salt>$<hash>
// Create entries with:  npm run add-user

import crypto from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const SESSION_HOURS = 12;
export const COOKIE = 'cloak_session';

export function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(String(password), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `s1$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 's1' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64url'), expected.length, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function parseUsers(spec) {
  const users = new Map();
  for (const entry of String(spec || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) {
    const i = entry.indexOf(':');
    if (i < 1) throw new Error(`CLOAK_USERS entry is not "name:hash": ${entry.slice(0, 20)}…`);
    const name = entry.slice(0, i).trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,40}$/.test(name)) throw new Error(`Invalid user name in CLOAK_USERS: ${name}`);
    users.set(name, entry.slice(i + 1).trim());
  }
  return users;
}

// A fixed hash to compare against when the user name is unknown, so a wrong
// name takes as long as a wrong password.
const DUMMY_HASH = hashPassword('not-a-real-password');

export function createAuth({ users, secret }) {
  const key = Buffer.from(secret);

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = crypto.createHmac('sha256', key).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  function verify(token) {
    const [body, mac] = String(token || '').split('.');
    if (!body || !mac) return null;
    const expected = crypto.createHmac('sha256', key).update(body).digest();
    const given = Buffer.from(mac, 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!data.u || !users.has(data.u) || !(data.exp > Date.now())) return null;
      return data;
    } catch {
      return null;
    }
  }

  return {
    enabled: users.size > 0,

    login(name, password) {
      const user = String(name || '').trim().toLowerCase();
      const stored = users.get(user);
      const ok = verifyPassword(password, stored || DUMMY_HASH) && !!stored;
      return ok ? { user, token: sign({ u: user, exp: Date.now() + SESSION_HOURS * 3600_000 }) } : null;
    },

    /** Returns the signed-in user name for a request, or null. */
    userFor(req) {
      const cookies = parseCookies(req.headers.cookie);
      return verify(cookies[COOKIE])?.u || null;
    },

    cookie(token, secure) {
      return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${secure ? '; Secure' : ''}`;
    },

    clearCookie(secure) {
      return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
    },
  };
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

/** Fixed-window counter: allow `limit` hits per `windowMs` for each key. */
export function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return {
    hit(key) {
      const now = Date.now();
      let e = hits.get(key);
      if (!e || now - e.start > windowMs) {
        e = { start: now, count: 0 };
        hits.set(key, e);
      }
      e.count += 1;
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
      }
      return e.count <= limit;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
