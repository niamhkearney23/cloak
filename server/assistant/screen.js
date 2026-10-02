// Decides what happens to each email before any AI sees it.
//
//   never  - matches the "never send to AI" list: a person handles it.
//   unsure - after cloaking, something still looks like it could be a name.
//            It waits for a person to check it in "Check before AI".
//   sure   - every name-like word is accounted for: the cloaked text can go
//            to the AI automatically.
//
// All of this runs on our server. The AI is never asked whether an email is
// safe, because that would mean showing it the email.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Cloak, findSuspects, isCommonWord, TOKEN_RE } = require('../../public/cloak.js');

const MAX_BODY_CHARS = 12000;

// Ordinary words that often start a sentence or a line in an email. A
// capitalised word at the start of a sentence that is NOT one of these (or a
// common legal word) might be a name, e.g. "Ahmad called." or a signature.
const STARTERS = new Set(`
  a about above according actually after afternoon again all also although always am an and another any anyway apologies
  appreciate are as at attached attachment attachments available back based be because been before being below best between both
  but by can cannot certainly cheers click come confirm congratulations could currently day days dear did do does done
  due during each early either else enclosed even evening every everyone everything feel few finally find fine first
  following for forwarded friday from further get give glad go good got great greetings had has have having he hello
  hence her here hi his hope hopefully how however i if in including indeed instead is it its just kind kindly last
  later let looking lunch many may maybe me meanwhile meeting might monday more moreover morning most much must my
  near need neither never nevertheless next nice no none nor not note noted nothing now of off ok okay on once one only
  or other otherwise our out over overall per perhaps please pls pleased plus possibly previously quick re received
  recently regarding regards rgds really reminder respectfully saturday see seems sent shall she should similarly since
  sincerely so some someone something sometimes soon sorry still subject such sunday sure tel telephone thank thanks
  that the their them then there therefore these they this those though through thursday thx to today tomorrow
  tonight too totally tuesday unfortunately unless until up update upon urgent us very via want warm warmest was we
  wednesday week weekend well were what whatever when whenever where whereas whether which while who whom whose why
  will with within without would yes yesterday yet you your yours fyi fw fwd asap btw eta pm am noon tbc tba
  mobile phone fax email address office website www http https
  unit level floor suite block lot room tower wing dispute matter case file
  january february march april may june july august september october november december
  terima kasih salam selamat pagi petang tuan puan encik
`.split(/\s+/).filter(Boolean));

const AUTOMATED_SENDER = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|bounce|alerts?|newsletter|news|info-noreply)\b/i;
const AUTOMATED_SUBJECT = /^(automatic reply|auto(matic)?[- ]?reply|out of (the )?office|undeliverable|delivery status notification|mail delivery failed|read:|accepted:|declined:|tentative:)/i;

function header(msg, name) {
  const h = (msg.internetMessageHeaders || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? String(h.value) : '';
}

export function domainOf(address) {
  return String(address || '').toLowerCase().split('@')[1] || '';
}

/** Automated mail gets no acknowledgement and no AI draft. */
export function isAutomated(msg) {
  const from = msg.from?.emailAddress?.address || '';
  const auto = header(msg, 'Auto-Submitted');
  if (auto && auto.toLowerCase() !== 'no') return true;
  if (/^(bulk|list|junk)$/i.test(header(msg, 'Precedence').trim())) return true;
  if (header(msg, 'List-Unsubscribe') || header(msg, 'List-Id')) return true;
  if (header(msg, 'X-Auto-Response-Suppress')) return true;
  if (AUTOMATED_SENDER.test(from.split('@')[0] || '')) return true;
  if (AUTOMATED_SUBJECT.test(String(msg.subject || '').trim())) return true;
  if (msg.inferenceClassification === 'other') return true;
  return false;
}

export function firmDomains(me, settings) {
  return new Set([domainOf(me.email), ...settings.firmDomains.map((d) => String(d).toLowerCase().replace(/^@/, ''))].filter(Boolean));
}

/** Keep only the newest message in a thread and drop quoted history. */
export function latestText(msg) {
  let text = msg.uniqueBody?.content || msg.body?.content || '';
  text = text.replace(/\r/g, '');
  const cut = text.search(/^(-{2,}\s*Original Message\s*-{2,}|_{10,}|From:\s.+\n(Sent|Date):\s|On .{5,120} wrote:$)/mi);
  if (cut > 0) text = text.slice(0, cut);
  text = text.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > MAX_BODY_CHARS) text = `${text.slice(0, MAX_BODY_CHARS)}\n[…email shortened…]`;
  return text;
}

function looksLikeCompany(name) {
  return /\b(sdn\.?\s*bhd|berhad|bhd|pte\.?\s*ltd|ltd|limited|llp|plt|inc|corp|group|holdings|company|co\.)\b/i.test(name);
}

function matchesNeverAI(msg, settings) {
  const from = String(msg.from?.emailAddress?.address || '').toLowerCase();
  const text = `${msg.subject || ''}\n${latestText(msg)}`.toLowerCase();
  for (const raw of settings.neverAI) {
    const rule = String(raw).trim().toLowerCase();
    if (!rule) continue;
    if (/^[^@\s]+@[^@\s]+$/.test(rule)) { if (from === rule) return raw; continue; } // an address
    if (/^@?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(rule)) { if (domainOf(from) === rule.replace(/^@/, '')) return raw; continue; } // a domain
    if (text.includes(rule)) return raw; // a word or phrase
  }
  return null;
}

/** Possible names left in cloaked text, minus words people have marked fine. */
export function unsureWords(cloaked, allowWords = []) {
  const allow = new Set(allowWords.map((w) => w.toLowerCase()));
  const found = new Map();
  for (const s of findSuspects(cloaked)) {
    // Drop everyday words from the suspect ("Dear Mr" -> nothing left).
    const words = s.text.split(/\s+/).filter((w) => !STARTERS.has(w.toLowerCase().replace(/['’]s$/, '')));
    if (!words.length || allow.has(s.text.toLowerCase())) continue;
    found.set(s.text, s.count);
  }

  // A capitalised word starting a sentence or a line (a signature, "Ahmad
  // called") that is not an everyday word.
  const plain = cloaked.replace(TOKEN_RE, ' ');
  for (const m of plain.matchAll(/(?:^|[.!?]\s+|\n\s*)([\p{Lu}][\p{Ll}'’-]{2,})(?=[\s,.:;!?]|$)/gu)) {
    const w = m[1].replace(/['’]s$/, '');
    const lower = w.toLowerCase();
    if (STARTERS.has(lower) || isCommonWord(w) || allow.has(lower) || found.has(w)) continue;
    found.set(w, 1);
  }
  return [...found.entries()].map(([text, count]) => ({ text, count }));
}

/**
 * Cloak one email and decide where it goes. `contacts` is the mailbox's
 * contact list; only contacts actually mentioned in the email are used.
 */
export function screenEmail({ msg, me, settings, contacts = [], notes = '' }) {
  const from = msg.from?.emailAddress || {};
  const reasons = [];

  const never = matchesNeverAI(msg, settings);
  const body = latestText(msg);

  const c = new Cloak();
  c.addPerson('ME', me.name, { token: 'ME', email: me.email });
  if (from.address && from.address.toLowerCase() !== String(me.email).toLowerCase()) {
    (looksLikeCompany(from.name || '') ? c.addOrganisation : c.addPerson).call(c, 'SENDER', from.name || from.address, { token: 'SENDER', email: from.address });
  }
  for (const r of [...(msg.toRecipients || []), ...(msg.ccRecipients || [])]) {
    const a = r.emailAddress || {};
    if (!a.address || a.address.toLowerCase() === String(me.email).toLowerCase()) continue;
    c.addPerson('PERSON', a.name || a.address, { email: a.address });
  }
  for (const cl of settings.clients) {
    const name = typeof cl === 'string' ? cl : cl.name;
    if (!name) continue;
    (looksLikeCompany(name) ? c.addOrganisation : c.addPerson).call(c, 'CLIENT', name);
  }

  const haystack = `${msg.subject || ''}\n${body}`.toLowerCase();
  for (const ct of contacts) {
    const name = String(ct.displayName || '').trim();
    const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
    if (name && (haystack.includes(name.toLowerCase()) || parts.some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack)))) {
      c.addPerson('CONTACT', name, { email: ct.emailAddresses?.[0]?.address });
    }
    if (ct.companyName && haystack.includes(String(ct.companyName).toLowerCase())) c.addOrganisation('ORG', ct.companyName);
  }
  for (const w of settings.hideWords) c.addLiteral('HIDDEN', w);

  const recipients = (list) => (list || []).map((r) => `${r.emailAddress?.name || ''} <${r.emailAddress?.address || ''}>`).join(', ');
  const text = [
    `From: ${from.name || ''} <${from.address || ''}>`,
    `To: ${recipients(msg.toRecipients)}`,
    msg.ccRecipients?.length ? `Cc: ${recipients(msg.ccRecipients)}` : null,
    `Subject: ${msg.subject || '(no subject)'}`,
    `Received: ${msg.receivedDateTime || ''}`,
    msg.hasAttachments ? 'Attachments: yes (not included)' : null,
    '',
    body || '(empty message)',
  ].filter((l) => l !== null).join('\n');

  const cloaked = c.cloak(text);
  const suspects = unsureWords(cloaked, settings.allowWords);

  let verdict = 'sure';
  if (never) {
    verdict = 'never';
    reasons.push(`Matches "never send to AI": ${never}`);
  } else if (suspects.length) {
    verdict = 'unsure';
    reasons.push(`Might be names: ${suspects.slice(0, 8).map((s) => s.text).join(', ')}${suspects.length > 8 ? '…' : ''}`);
  }
  // The lawyer's own preferences and answers. They are the lawyer's words, so
  // anything name-like in them that Cloak doesn't recognise is simply hidden.
  let cloakedNotes = '';
  if (notes.trim()) {
    cloakedNotes = c.cloak(notes);
    for (const s of unsureWords(cloakedNotes, settings.allowWords)) c.addLiteral('NAME', s.text);
    cloakedNotes = c.cloak(notes);
  }
  return { verdict, reasons, suspects, cloak: c, cloaked, cloakedNotes };
}
