// Encrypted storage for the email assistant: the Microsoft sign-in, settings,
// the "check before AI" queue and the activity log.
//
// Everything is kept in one JSON file encrypted with AES-256-GCM using
// CLOAK_DATA_KEY. Email bodies are never stored; they are fetched from the
// mailbox when needed.

import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SETTINGS = {
  // Extra domains that count as "in the firm" (the boss's own domain is
  // always included). Acknowledgements are never sent to these.
  firmDomains: [],
  // Clients: names (hidden as CLIENT tokens) and optional email/domain.
  clients: [],
  // Never sent to the AI: sender addresses, domains, or words in the subject.
  neverAI: [],
  // Words a reviewer marked as fine / always hide. Grows over time.
  allowWords: [],
  hideWords: [],
  ack: {
    enabled: true,
    text: 'Thank you, we have received your email and will reply within one working day.',
  },
  // Who gets told when an email is waiting in "check before AI" (no content
  // is included in the notice).
  notifyEmails: [],
  summary: { enabled: true, time: '07:00', timezone: 'Asia/Kuala_Lumpur', weekdaysOnly: true },
  pollMinutes: 5,
  paused: false,
  // Pencil meetings, hearings and deadlines from emails into the calendar as
  // tentative "Cloak suggestion" entries (no one is invited).
  calendar: { enabled: true },
  // Standing instructions from the lawyer, e.g. "Sign off 'Best regards'".
  preferences: [],
};

function blankData() {
  return {
    account: null,
    settings: structuredClone(DEFAULT_SETTINGS),
    processed: {},
    acked: {},
    queue: [],
    questions: [],
    pencilled: {},
    activity: [],
    lastCheck: null,
    lastSummaryDate: null,
  };
}

export function createStore({ dir, key }) {
  if (!key || String(key).length < 32) {
    throw new Error('CLOAK_DATA_KEY must be a random value of at least 32 characters. Create one with: openssl rand -hex 32');
  }
  // 64 hex characters are used as-is; any other long random string is hashed.
  const k = /^[0-9a-f]{64}$/i.test(key) ? Buffer.from(key, 'hex') : crypto.createHash('sha256').update(String(key)).digest();
  const file = path.join(dir, 'assistant.enc');
  let data = null;
  let writing = Promise.resolve();

  function encrypt(obj) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', k, iv);
    const body = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
    return Buffer.concat([Buffer.from('CLK1'), iv, c.getAuthTag(), body]);
  }

  function decrypt(buf) {
    if (buf.subarray(0, 4).toString() !== 'CLK1') throw new Error('Not a Cloak data file');
    const d = crypto.createDecipheriv('aes-256-gcm', k, buf.subarray(4, 16));
    d.setAuthTag(buf.subarray(16, 32));
    return JSON.parse(Buffer.concat([d.update(buf.subarray(32)), d.final()]).toString('utf8'));
  }

  async function load() {
    if (data) return data;
    try {
      const loaded = decrypt(await readFile(file));
      const defaults = structuredClone(DEFAULT_SETTINGS);
      data = { ...blankData(), ...loaded, settings: { ...defaults, ...loaded.settings, calendar: { ...defaults.calendar, ...loaded.settings?.calendar } } };
    } catch (err) {
      if (err.code !== 'ENOENT') throw new Error(`Could not open the assistant data file (wrong CLOAK_DATA_KEY?): ${err.message}`);
      data = blankData();
    }
    return data;
  }

  async function save() {
    const snapshot = encrypt(data);
    writing = writing.then(async () => {
      await mkdir(dir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot, { mode: 0o600 });
      await rename(tmp, file);
    });
    return writing;
  }

  return {
    load,
    save,
    /** Change the data with fn(data), then save. */
    async update(fn) {
      await load();
      const result = await fn(data);
      await save();
      return result;
    },
    async log(entry) {
      await load();
      data.activity.unshift({ t: new Date().toISOString(), ...entry });
      data.activity.length = Math.min(data.activity.length, 500);
      await save();
    },
  };
}
