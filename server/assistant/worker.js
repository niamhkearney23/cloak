// The email assistant's background work:
//
//   every few minutes  - read new inbox mail; send the fixed acknowledgement to
//                        people outside the firm; cloak each email and either
//                        get an AI reply draft (sure), hold it for a person to
//                        check (unsure), or leave it for the lawyer (never).
//   every morning      - email the lawyer a summary of the day.
//
// Real names never go to the AI: only screenEmail()'s cloaked text does, and
// the name map stays in this process.

import { createRequire } from 'node:module';
import { domainOf, firmDomains, isAutomated, screenEmail, unsureWords } from './screen.js';

const require = createRequire(import.meta.url);
const { Cloak } = require('../../public/cloak.js');

export const CATEGORY = {
  draft: 'Cloak: draft ready',
  waiting: 'Cloak: waiting for check',
  personal: 'Cloak: handle personally',
};

const DAY = 24 * 3600_000;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Local date/time parts in a time zone. */
export function localParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${parts.hour}:${parts.minute}`,
    weekday: parts.weekday,
    y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), min: Number(parts.minute),
  };
}

/** UTC start and end of the local day containing `date`. */
export function localDayBounds(date, timeZone) {
  const p = localParts(date, timeZone);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - Math.floor(date.getTime() / 60000) * 60000;
  const start = Date.UTC(p.y, p.m - 1, p.d) - offset;
  return { start: new Date(start), end: new Date(start + DAY) };
}

function fmtTime(iso, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

function graphTime(t) {
  // Calendar times come back in UTC without a "Z".
  return t && t.dateTime ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(t.dateTime) ? t.dateTime : `${t.dateTime}Z`) : null;
}

export function createAssistant({ store, makeGraph, ai, publicUrl = '', now = () => new Date(), log = console.log }) {
  let running = false;
  let lastPoll = 0;
  let contactsCache = { at: 0, list: [] };
  let timer = null;
  const record = (entry) => store.log({ t: now().toISOString(), ...entry });

  async function context() {
    const data = await store.load();
    if (!data.account) return null;
    const graph = makeGraph();
    return { data, graph, me: { name: data.account.name, email: data.account.email }, settings: data.settings };
  }

  async function contacts(graph) {
    if (Date.now() - contactsCache.at < 6 * 3600_000) return contactsCache.list;
    try {
      contactsCache = { at: Date.now(), list: await graph.contacts() };
    } catch (err) {
      log(JSON.stringify({ event: 'assistant_contacts_error', error: err.message }));
    }
    return contactsCache.list;
  }

  async function markReconnect(err) {
    if (err.code === 'reconnect' || err.code === 'not_connected' || err.status === 401) {
      await store.update((d) => { if (d.account) d.account.needsReconnect = true; });
      await record({ action: 'error', detail: 'Microsoft sign-in has expired. Reconnect the mailbox on the assistant page.' });
      return true;
    }
    return false;
  }

  /** Ask the AI for a draft, put names back, and save it in Drafts. */
  async function draftReply({ graph, msg, screened, approvedBy }) {
    const result = await ai.triage(screened.cloaked);
    const summary = screened.cloak.uncloak(result.summary);
    const reply = screened.cloak.uncloak(result.reply || '');
    const unknown = [...new Set([...summary.unknown, ...reply.unknown])];
    const from = msg.from?.emailAddress || {};
    let action = 'read';
    if (result.needs_reply && reply.text.trim()) {
      await graph.createReplyDraft(msg.id, reply.text);
      await graph.addCategory(msg.id, CATEGORY.draft, msg.categories || []);
      action = 'draft';
    }
    await record({
      action,
      messageId: msg.id,
      from: from.name || from.address,
      fromAddress: from.address,
      subject: msg.subject,
      summary: summary.text,
      urgency: result.urgency,
      category: result.category,
      deadline: result.deadline ? screened.cloak.uncloak(result.deadline).text : '',
      approvedBy,
      warning: unknown.length ? `The AI used codes it was not given (${unknown.join(', ')}); check the draft.` : undefined,
      sentToAI: screened.cloaked,
    });
    return action;
  }

  async function processMessage({ graph, me, settings, contactsList, id }) {
    const msg = await graph.message(id);
    const from = msg.from?.emailAddress || {};
    const sender = String(from.address || '').toLowerCase();
    if (!sender || sender === String(me.email).toLowerCase()) return 'own';

    const automated = isAutomated(msg);
    const external = !firmDomains(me, settings).has(domainOf(sender));

    // Fixed acknowledgement (no AI): only people outside the firm, once a day each.
    if (settings.ack.enabled && external && !automated) {
      const data = await store.load();
      const last = data.acked[sender] || 0;
      if (Date.now() - last > DAY) {
        await graph.reply(msg.id, settings.ack.text);
        await store.update((d) => { d.acked[sender] = Date.now(); });
        await record({ action: 'ack', messageId: msg.id, from: from.name || sender, fromAddress: sender, subject: msg.subject });
      }
    }

    if (automated) {
      await record({ action: 'skipped', messageId: msg.id, from: from.name || sender, subject: msg.subject, detail: 'Automated or newsletter email' });
      return 'skipped';
    }

    const screened = screenEmail({ msg, me, settings, contacts: contactsList });
    if (screened.verdict === 'never') {
      await graph.addCategory(msg.id, CATEGORY.personal, msg.categories || []);
      await record({ action: 'never', messageId: msg.id, from: from.name || sender, subject: msg.subject, detail: screened.reasons.join('; ') });
      return 'never';
    }
    if (screened.verdict === 'unsure') {
      await graph.addCategory(msg.id, CATEGORY.waiting, msg.categories || []);
      await store.update((d) => {
        if (!d.queue.some((q) => q.id === msg.id)) {
          d.queue.unshift({ id: msg.id, from: from.name || sender, fromAddress: sender, subject: msg.subject, receivedAt: msg.receivedDateTime, reasons: screened.reasons, status: 'waiting', createdAt: new Date().toISOString() });
          d.queue.length = Math.min(d.queue.length, 300);
        }
      });
      await record({ action: 'queued', messageId: msg.id, from: from.name || sender, subject: msg.subject, detail: screened.reasons.join('; ') });
      return 'queued';
    }
    return draftReply({ graph, msg, screened });
  }

  async function notifyReviewers({ graph, settings, count }) {
    if (!count || !settings.notifyEmails.length) return;
    const link = publicUrl ? `${publicUrl.replace(/\/$/, '')}/assistant` : '';
    await graph.sendMail({
      to: settings.notifyEmails,
      subject: `Cloak: ${count} email${count === 1 ? '' : 's'} waiting for your check`,
      html: `<p>${count} new email${count === 1 ? ' needs' : 's need'} a quick check before the assistant can prepare a reply.</p>${link ? `<p><a href="${esc(link)}">Open the check list</a></p>` : ''}<p style="color:#777">No email content is included in this notice.</p>`,
    });
  }

  /** Read new inbox mail and handle each email. */
  async function checkMail() {
    const ctx = await context();
    if (!ctx || ctx.settings.paused || ctx.data.account.needsReconnect) return { checked: 0 };
    const { graph, me, settings } = ctx;
    const since = ctx.data.lastCheck || new Date(now().getTime() - 3600_000).toISOString();
    let list;
    try {
      list = await graph.newMessages(since);
    } catch (err) {
      if (!(await markReconnect(err))) await record({ action: 'error', detail: `Could not read the inbox: ${err.message}` });
      return { checked: 0, error: err.message };
    }
    const contactsList = await contacts(graph);
    let queued = 0;
    let latest = since;
    const results = [];
    for (const m of list) {
      if (m.receivedDateTime > latest) latest = m.receivedDateTime;
      const data = await store.load();
      if (m.isDraft || data.processed[m.id]?.done) continue;
      try {
        const r = await processMessage({ graph, me, settings, contactsList, id: m.id });
        if (r === 'queued') queued++;
        results.push(r);
        await store.update((d) => { d.processed[m.id] = { done: true, t: Date.now() }; });
      } catch (err) {
        if (await markReconnect(err)) break;
        const attempts = ((await store.load()).processed[m.id]?.attempts || 0) + 1;
        await store.update((d) => { d.processed[m.id] = { done: attempts >= 3, attempts, t: Date.now() }; });
        await record({ action: 'error', messageId: m.id, from: m.from?.emailAddress?.name, subject: m.subject, detail: `${err.message}${attempts >= 3 ? ' (gave up after 3 tries)' : ' (will try again)'}` });
      }
    }
    await store.update((d) => {
      d.lastCheck = latest;
      for (const [k, v] of Object.entries(d.processed)) if (Date.now() - v.t > 30 * DAY) delete d.processed[k];
      for (const [k, t] of Object.entries(d.acked)) if (Date.now() - t > 7 * DAY) delete d.acked[k];
    });
    try {
      await notifyReviewers({ graph, settings, count: queued });
    } catch (err) {
      await record({ action: 'error', detail: `Could not send the check notice: ${err.message}` });
    }
    return { checked: list.length, results };
  }

  /** What a reviewer sees: the cloaked email with the unsure words. */
  async function reviewItem(id) {
    const ctx = await context();
    if (!ctx) throw new Error('The mailbox is not connected.');
    const msg = await ctx.graph.message(id);
    const screened = screenEmail({ msg, me: ctx.me, settings: ctx.settings, contacts: await contacts(ctx.graph) });
    return { id, from: msg.from?.emailAddress, subject: msg.subject, receivedAt: msg.receivedDateTime, verdict: screened.verdict, reasons: screened.reasons, suspects: screened.suspects, cloaked: screened.cloaked };
  }

  /**
   * A reviewer decided on each unsure word: `hide` words become hidden,
   * `allow` words are fine. Remembered for next time.
   */
  async function approve(id, { hide = [], allow = [] }, reviewer) {
    await store.update((d) => {
      const add = (list, words) => { for (const w of words.map((x) => String(x).trim()).filter(Boolean)) if (!list.some((x) => x.toLowerCase() === w.toLowerCase())) list.push(w); };
      add(d.settings.hideWords, hide);
      add(d.settings.allowWords, allow);
    });
    const ctx = await context();
    const msg = await ctx.graph.message(id);
    const screened = screenEmail({ msg, me: ctx.me, settings: ctx.settings, contacts: await contacts(ctx.graph) });
    if (screened.verdict === 'unsure') return { status: 'more', suspects: screened.suspects, cloaked: screened.cloaked };
    if (screened.verdict === 'never') return { status: 'never' };
    const action = await draftReply({ graph: ctx.graph, msg, screened, approvedBy: reviewer });
    await store.update((d) => {
      const q = d.queue.find((x) => x.id === id);
      if (q) Object.assign(q, { status: 'approved', decidedBy: reviewer, decidedAt: new Date().toISOString(), result: action });
    });
    return { status: 'done', action };
  }

  /** Leave an email for the lawyer to deal with personally (no AI). */
  async function handlePersonally(id, reviewer) {
    const ctx = await context();
    const msg = await ctx.graph.message(id);
    await ctx.graph.addCategory(id, CATEGORY.personal, msg.categories || []);
    await store.update((d) => {
      const q = d.queue.find((x) => x.id === id);
      if (q) Object.assign(q, { status: 'personal', decidedBy: reviewer, decidedAt: new Date().toISOString() });
    });
    await record({ action: 'never', messageId: id, from: msg.from?.emailAddress?.name, subject: msg.subject, detail: `Marked "handle personally" by ${reviewer}` });
  }

  /** Build and send the morning summary to the lawyer. */
  async function sendSummary({ force = false } = {}) {
    const ctx = await context();
    if (!ctx || ctx.data.account.needsReconnect) return { sent: false, reason: 'not connected' };
    const { graph, me, settings, data } = ctx;
    const tz = settings.summary.timezone || 'Asia/Kuala_Lumpur';
    const t = now();
    const local = localParts(t, tz);
    if (!force) {
      if (!settings.summary.enabled || settings.paused) return { sent: false };
      if (data.lastSummaryDate === local.date) return { sent: false };
      if (settings.summary.weekdaysOnly && ['Sat', 'Sun'].includes(local.weekday)) return { sent: false };
      if (local.hhmm < settings.summary.time) return { sent: false };
    }

    const { start, end } = localDayBounds(t, tz);
    let events = [];
    try {
      events = (await graph.calendar(start.toISOString(), end.toISOString())).filter((e) => !e.isCancelled);
    } catch (err) {
      if (await markReconnect(err)) return { sent: false, reason: 'reconnect' };
      await record({ action: 'error', detail: `Could not read the calendar: ${err.message}` });
    }
    const since = t.getTime() - DAY;
    const recent = data.activity.filter((a) => Date.parse(a.t) >= since);
    const drafts = recent.filter((a) => a.action === 'draft');
    const read = recent.filter((a) => a.action === 'read');
    const personal = recent.filter((a) => a.action === 'never');
    const waiting = data.queue.filter((q) => q.status === 'waiting');

    const meetingLine = (e) => {
      const who = (e.attendees || []).map((a) => a.emailAddress?.name || a.emailAddress?.address).filter((n) => n && n !== me.name).slice(0, 6).join(', ');
      const when = e.isAllDay ? 'All day' : `${fmtTime(graphTime(e.start), tz)}–${fmtTime(graphTime(e.end), tz)}`;
      return { when, subject: e.subject || '(no title)', who, where: e.location?.displayName || (e.isOnlineMeeting ? 'Online' : '') };
    };
    const meetings = events.map(meetingLine);

    // AI priorities: everything cloaked; anything name-like that is still
    // unrecognised is hidden too, so nothing identifying is sent.
    let priorities = '';
    if (meetings.length || drafts.length || read.length || waiting.length) {
      const c = new Cloak();
      c.addPerson('ME', me.name, { token: 'ME', email: me.email });
      for (const cl of settings.clients) c.addPerson('CLIENT', typeof cl === 'string' ? cl : cl.name);
      for (const e of events) for (const a of e.attendees || []) if (a.emailAddress?.name) c.addPerson('PERSON', a.emailAddress.name, { email: a.emailAddress.address });
      for (const a of [...drafts, ...read, ...personal, ...waiting]) if (a.from) c.addPerson('PERSON', a.from, { email: a.fromAddress });
      for (const w of settings.hideWords) c.addLiteral('HIDDEN', w);
      const notes = [
        `Date: ${local.date}`,
        'MEETINGS TODAY:',
        ...(meetings.length ? meetings.map((m) => `- ${m.when} ${m.subject}${m.who ? ` with ${m.who}` : ''}${m.where ? ` at ${m.where}` : ''}`) : ['- none']),
        'EMAILS WITH A REPLY DRAFT READY:',
        ...(drafts.length ? drafts.map((a) => `- [${a.urgency}] ${a.subject}: ${a.summary}${a.deadline ? ` (deadline: ${a.deadline})` : ''}`) : ['- none']),
        'OTHER EMAILS READ:',
        ...(read.length ? read.map((a) => `- ${a.subject}: ${a.summary}`) : ['- none']),
        `EMAILS WAITING FOR A STAFF CHECK: ${waiting.length}`,
        `EMAILS LEFT FOR YOU PERSONALLY: ${personal.length}`,
      ].join('\n');
      let cloaked = c.cloak(notes);
      for (const s of unsureWords(cloaked, settings.allowWords)) c.addLiteral('NAME', s.text);
      cloaked = c.cloak(notes);
      try {
        priorities = c.uncloak(await ai.digest(cloaked)).text;
      } catch (err) {
        priorities = '';
        await record({ action: 'error', detail: `Summary priorities skipped: ${err.message}` });
      }
    }

    const first = String(me.name || '').split(/\s+/)[0] || '';
    const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(t);
    const link = publicUrl ? `${publicUrl.replace(/\/$/, '')}/assistant` : '';
    const section = (title, inner) => `<h3 style="font:600 15px Arial;margin:22px 0 8px;color:#1f4e79">${esc(title)}</h3>${inner}`;
    const list = (items) => (items.length ? `<ul style="margin:0;padding-left:20px">${items.map((i) => `<li style="margin:4px 0">${i}</li>`).join('')}</ul>` : '<p style="color:#777;margin:0">None.</p>');
    const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#1c2230;max-width:680px">
<p>Good morning${first ? ` ${esc(first)}` : ''},</p>
<p>Here is your summary for ${esc(dateLabel)}.</p>
${priorities ? section('Top priorities', `<div style="white-space:pre-wrap">${esc(priorities)}</div>`) : ''}
${section(`Today's meetings (${meetings.length})`, list(meetings.map((m) => `<b>${esc(m.when)}</b> ${esc(m.subject)}${m.who ? ` <span style="color:#555">with ${esc(m.who)}</span>` : ''}${m.where ? ` <span style="color:#777">· ${esc(m.where)}</span>` : ''}`)))}
${section(`Reply drafts waiting in your Drafts folder (${drafts.length})`, list(drafts.map((a) => `${a.urgency === 'high' ? '<b style="color:#b3261e">URGENT</b> ' : ''}<b>${esc(a.from)}</b>: ${esc(a.subject)}<br><span style="color:#555">${esc(a.summary)}${a.deadline ? ` · Deadline: ${esc(a.deadline)}` : ''}</span>`)))}
${read.length ? section(`Other emails, no reply needed (${read.length})`, list(read.map((a) => `<b>${esc(a.from)}</b>: ${esc(a.subject)}`))) : ''}
${personal.length ? section(`Left for you personally, not sent to AI (${personal.length})`, list(personal.map((a) => `<b>${esc(a.from || '')}</b>: ${esc(a.subject || '')}`))) : ''}
${waiting.length ? section('Waiting for a staff check', `<p style="margin:0">${waiting.length} email${waiting.length === 1 ? ' is' : 's are'} waiting for a quick check before a draft can be prepared.${link ? ` <a href="${esc(link)}">Open the check list</a>` : ''}</p>`) : ''}
<p style="color:#888;font-size:12px;margin-top:28px">Prepared by Cloak. Names and confidential details were hidden before anything was sent to the AI. Every reply draft needs your review before sending.</p>
</div>`;

    await graph.sendMail({ to: [me.email], subject: `Your day: ${dateLabel}`, html });
    await store.update((d) => { d.lastSummaryDate = local.date; });
    await record({ action: 'summary', detail: `Daily summary sent (${meetings.length} meetings, ${drafts.length} drafts, ${waiting.length} waiting)` });
    return { sent: true };
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      const data = await store.load();
      if (!data.account) return;
      const every = Math.max(1, Number(data.settings.pollMinutes) || 5) * 60_000;
      if (Date.now() - lastPoll >= every) {
        lastPoll = Date.now();
        await checkMail();
      }
      await sendSummary();
    } catch (err) {
      log(JSON.stringify({ event: 'assistant_error', error: err.message }));
    } finally {
      running = false;
    }
  }

  return {
    checkMail,
    reviewItem,
    approve,
    handlePersonally,
    sendSummary,
    tick,
    start() {
      if (!timer) timer = setInterval(tick, 60_000);
      setTimeout(tick, 5_000);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}
