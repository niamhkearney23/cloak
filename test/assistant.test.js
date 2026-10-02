import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../server/assistant/store.js';
import { createAssistant, localDayBounds } from '../server/assistant/worker.js';
import { screenEmail, isAutomated, latestText } from '../server/assistant/screen.js';

const ME = { name: 'Mathew Lee', email: 'mathew@kearneylaw.com.my' };
const REAL = ['Ahmad', 'Ismail', 'Wong', 'Kah Fai', 'Siti', 'Mathew', 'Lee', '800505-14-5521', '012-987 6543', 'ahmad.ismail', 'Tan Ah Kow', 'Lim Mei Ling'];

function fakeMailbox() {
  const mb = {
    messages: new Map(), drafts: [], replies: [], sent: [], categories: new Map(), events: [], created: [], deleted: [],
    add(msg) { mb.messages.set(msg.id, { categories: [], internetMessageHeaders: [], toRecipients: [{ emailAddress: { name: ME.name, address: ME.email } }], ...msg }); },
  };
  mb.graph = {
    me: async () => ({ displayName: ME.name, mail: ME.email }),
    newMessages: async (since) => [...mb.messages.values()].filter((m) => m.receivedDateTime >= since).map((m) => ({ id: m.id, subject: m.subject, from: m.from, receivedDateTime: m.receivedDateTime })),
    message: async (id) => structuredClone(mb.messages.get(id)),
    createReplyDraft: async (id, comment) => { mb.drafts.push({ id, comment }); return { id: `draft-${mb.drafts.length}` }; },
    deleteDraft: async (id) => { mb.deleted.push(id); return true; },
    createEvent: async (e) => { mb.created.push(e); return { id: `ev-${mb.created.length}` }; },
    reply: async (id, comment) => { mb.replies.push({ id, comment }); },
    addCategory: async (id, cat) => { mb.categories.set(id, cat); },
    sendMail: async (m) => { mb.sent.push(m); },
    calendar: async () => mb.events,
    contacts: async () => [{ displayName: 'Tan Ah Kow', emailAddresses: [{ address: 'tan@example.com' }] }],
  };
  return mb;
}

function fakeAI() {
  const ai = {
    seen: [],
    opts: [],
    events: [],
    questions: [],
    async triage(text, opts = {}) {
      ai.seen.push(text);
      ai.opts.push(opts);
      if (opts.notes) ai.seen.push(opts.notes);
      return { category: 'client', urgency: 'high', needs_reply: true, summary: '{{SENDER}} wants a meeting on Friday.', deadline: 'Friday', reply: 'Dear {{SENDER.FIRST}},\n\nThank you. [confirm Friday]\n\nRegards,\n{{ME}}', events: ai.events, questions: ai.questions };
    },
    async digest(text) { ai.seen.push(text); return '- Reply to {{PERSON_1}} about Friday.'; },
  };
  return ai;
}

let store, mb, ai, assistant, dir;
const NOW = new Date('2026-10-05T00:30:00Z'); // Monday 08:30 in Kuala Lumpur

beforeEach(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'cloak-'));
  store = createStore({ dir, key: crypto.randomBytes(32).toString('hex') });
  await store.update((d) => {
    d.account = { name: ME.name, email: ME.email, tokens: {} };
    d.lastCheck = '2026-10-05T00:00:00Z';
  });
  mb = fakeMailbox();
  ai = fakeAI();
  assistant = createAssistant({ store, makeGraph: () => mb.graph, ai, publicUrl: 'https://cloak.example.com', now: () => NOW, log: () => {} });
});

const clientEmail = (over = {}) => ({
  id: 'm1',
  subject: 'Tenancy deposit',
  from: { emailAddress: { name: 'Ahmad bin Ismail', address: 'ahmad.ismail@gmail.com' } },
  receivedDateTime: '2026-10-05T00:10:00Z',
  uniqueBody: { content: 'Dear Mr Lee,\n\nCan we meet on Friday about the deposit? My IC is 800505-14-5521.\n\nRegards,\nAhmad\n012-987 6543' },
  ...over,
});

function assertNoRealNames(texts) {
  for (const t of texts) for (const n of REAL) assert.ok(!t.includes(n), `AI saw "${n}" in:\n${t}`);
}

test('client email: acknowledgement sent, draft saved with real names, AI saw only codes', async () => {
  mb.add(clientEmail());
  await assistant.checkMail();
  assert.equal(mb.replies.length, 1);
  assert.match(mb.replies[0].comment, /received your email/);
  assert.equal(mb.drafts.length, 1);
  assert.match(mb.drafts[0].comment, /^Dear Ahmad,/);
  assert.match(mb.drafts[0].comment, /Regards,\nMathew Lee$/);
  assert.equal(ai.seen.length, 1);
  assertNoRealNames(ai.seen);
  assert.equal(mb.categories.get('m1'), 'Cloak: draft ready');
  const { activity } = await store.load();
  assert.equal(activity[0].action, 'draft');
  assert.equal(activity[0].summary, 'Ahmad bin Ismail wants a meeting on Friday.');
});

test('colleagues in the firm get no acknowledgement', async () => {
  mb.add(clientEmail({ from: { emailAddress: { name: 'Lim Mei Ling', address: 'meiling@kearneylaw.com.my' } }, uniqueBody: { content: 'Can you review the file?' } }));
  await assistant.checkMail();
  assert.equal(mb.replies.length, 0);
  assert.equal(mb.drafts.length, 1);
});

test('extra firm domains count as the firm', async () => {
  await store.update((d) => { d.settings.firmDomains = ['kearneylaw.sg']; });
  mb.add(clientEmail({ from: { emailAddress: { name: 'Lim Mei Ling', address: 'ml@kearneylaw.sg' } }, uniqueBody: { content: 'Noted, thanks.' } }));
  await assistant.checkMail();
  assert.equal(mb.replies.length, 0);
});

test('newsletters and automatic emails: no acknowledgement, no AI', async () => {
  mb.add(clientEmail({ from: { emailAddress: { name: 'Law Weekly', address: 'news@lawweekly.com' } }, internetMessageHeaders: [{ name: 'List-Unsubscribe', value: '<mailto:x>' }] }));
  mb.add(clientEmail({ id: 'm2', subject: 'Automatic reply: Out of office', from: { emailAddress: { name: 'X', address: 'x@other.com' } } }));
  await assistant.checkMail();
  assert.equal(mb.replies.length, 0);
  assert.equal(ai.seen.length, 0);
});

test('acknowledgement goes at most once a day to each sender', async () => {
  mb.add(clientEmail());
  mb.add(clientEmail({ id: 'm2', receivedDateTime: '2026-10-05T00:20:00Z' }));
  await assistant.checkMail();
  assert.equal(mb.replies.length, 1);
  assert.equal(mb.drafts.length, 2);
});

test('an unknown name waits for a person; approving hides it and only then calls the AI', async () => {
  mb.add(clientEmail({ uniqueBody: { content: 'Dear Mr Lee,\n\nMy landlord Mr Wong Kah Fai will not return the deposit. Siti will come too.\n\nRegards,\nAhmad' } }));
  await assistant.checkMail();
  assert.equal(ai.seen.length, 0, 'AI must not be called while unsure');
  assert.equal(mb.drafts.length, 0);
  assert.equal(mb.categories.get('m1'), 'Cloak: waiting for check');
  let d = await store.load();
  assert.equal(d.queue[0].status, 'waiting');
  assert.equal(mb.replies.length, 1, 'the fixed acknowledgement still goes out');

  const review = await assistant.reviewItem('m1');
  assert.deepEqual(review.suspects.map((s) => s.text).sort(), ['Siti', 'Wong Kah Fai']);

  const partial = await assistant.approve('m1', { hide: ['Wong Kah Fai'] }, 'nk');
  assert.equal(partial.status, 'more');
  assert.equal(ai.seen.length, 0);

  const done = await assistant.approve('m1', { hide: ['Siti'] }, 'nk');
  assert.equal(done.status, 'done');
  assert.equal(ai.seen.length, 1);
  assertNoRealNames(ai.seen);
  assert.equal(mb.drafts.length, 1);
  d = await store.load();
  assert.equal(d.queue[0].status, 'approved');
  assert.equal(d.queue[0].decidedBy, 'nk');
  assert.ok(d.settings.hideWords.includes('Siti'), 'remembered for next time');
});

test('words marked fine are remembered and stop the email waiting next time', async () => {
  await store.update((d) => { d.settings.allowWords = ['Wong Kah Fai', 'Siti']; });
  mb.add(clientEmail({ uniqueBody: { content: 'My landlord Mr Wong Kah Fai refused. Siti agrees.' } }));
  await assistant.checkMail();
  assert.equal(ai.seen.length, 1);
});

test('"handle personally" leaves the email for the lawyer with no AI', async () => {
  mb.add(clientEmail({ uniqueBody: { content: 'Mr Wong Kah Fai called.' } }));
  await assistant.checkMail();
  await assistant.handlePersonally('m1', 'nk');
  assert.equal(ai.seen.length, 0);
  assert.equal(mb.categories.get('m1'), 'Cloak: handle personally');
});

test('never-send-to-AI list: by domain, address or word', async () => {
  await store.update((d) => { d.settings.neverAI = ['bigclient.com', 'merger']; });
  mb.add(clientEmail({ from: { emailAddress: { name: 'CEO', address: 'ceo@bigclient.com' } } }));
  mb.add(clientEmail({ id: 'm2', subject: 'Confidential merger talks', from: { emailAddress: { name: 'X', address: 'x@else.com' } } }));
  await assistant.checkMail();
  assert.equal(ai.seen.length, 0);
  assert.equal(mb.categories.get('m1'), 'Cloak: handle personally');
  assert.equal(mb.categories.get('m2'), 'Cloak: handle personally');
});

test('each email is handled once, and own emails are ignored', async () => {
  mb.add(clientEmail());
  mb.add(clientEmail({ id: 'm2', from: { emailAddress: { name: ME.name, address: ME.email } } }));
  await assistant.checkMail();
  await assistant.checkMail();
  assert.equal(ai.seen.length, 1);
  assert.equal(mb.drafts.length, 1);
});

test('reviewers are told when something is waiting, without any email content', async () => {
  await store.update((d) => { d.settings.notifyEmails = ['nk@kearneylaw.com.my']; });
  mb.add(clientEmail({ uniqueBody: { content: 'Mr Wong Kah Fai called.' } }));
  await assistant.checkMail();
  const notice = mb.sent.find((m) => m.to.includes('nk@kearneylaw.com.my'));
  assert.ok(notice);
  assert.match(notice.subject, /1 email waiting/);
  assert.doesNotMatch(notice.html, /Wong|Ahmad|deposit/);
  assert.match(notice.html, /https:\/\/cloak\.example\.com\/assistant/);
});

test('daily summary: meetings and drafts, names restored, AI saw only codes, once a day', async () => {
  mb.add(clientEmail());
  await assistant.checkMail();
  mb.events = [{ subject: 'Mediation', start: { dateTime: '2026-10-05T02:00:00.0000000' }, end: { dateTime: '2026-10-05T03:00:00.0000000' }, attendees: [{ emailAddress: { name: 'Tan Ah Kow', address: 'tan@example.com' } }], location: { displayName: 'Level 5' } }];
  ai.seen = [];
  const r = await assistant.sendSummary();
  assert.equal(r.sent, true);
  const mail = mb.sent.find((m) => m.to.includes(ME.email));
  assert.match(mail.subject, /Your day: Monday,? 5 October 2026/);
  assert.match(mail.html, /10:00–11:00/);
  assert.match(mail.html, /Tan Ah Kow/);
  assert.match(mail.html, /Ahmad bin Ismail/);
  assert.match(mail.html, /URGENT/);
  assertNoRealNames(ai.seen);
  assert.equal((await assistant.sendSummary()).sent, false, 'only once a day');
});

test('summary waits for the set time and skips weekends', async () => {
  await store.update((d) => { d.settings.summary.time = '09:00'; });
  assert.equal((await assistant.sendSummary()).sent, false);
  const sunday = createAssistant({ store, makeGraph: () => mb.graph, ai, now: () => new Date('2026-10-04T02:00:00Z'), log: () => {} });
  await store.update((d) => { d.settings.summary.time = '07:00'; });
  assert.equal((await sunday.sendSummary()).sent, false);
});

test('local day bounds for Kuala Lumpur', () => {
  const { start, end } = localDayBounds(NOW, 'Asia/Kuala_Lumpur');
  assert.equal(start.toISOString(), '2026-10-04T16:00:00.000Z');
  assert.equal(end.toISOString(), '2026-10-05T16:00:00.000Z');
});

test('quoted history is dropped before anything is cloaked or sent', () => {
  const text = latestText({ uniqueBody: { content: 'New point.\n\nOn Mon, 29 Sep 2026 Mathew Lee wrote:\n> old secret' } });
  assert.equal(text, 'New point.');
  const t2 = latestText({ body: { content: 'Hi\n\n-----Original Message-----\nFrom: X\nold' } });
  assert.equal(t2, 'Hi');
});

test('screenEmail: signature names and sentence-start names are caught', () => {
  const settings = { firmDomains: [], clients: [], neverAI: [], allowWords: [], hideWords: [] };
  const r = screenEmail({ msg: clientEmail({ uniqueBody: { content: 'Thanks.\n\nBest,\nRizal' } }), me: ME, settings });
  assert.equal(r.verdict, 'unsure');
  assert.deepEqual(r.suspects.map((s) => s.text), ['Rizal']);
  const ok = screenEmail({ msg: clientEmail({ uniqueBody: { content: 'Thanks, noted. Please call me on Friday.\n\nRegards,\nAhmad' } }), me: ME, settings });
  assert.equal(ok.verdict, 'sure');
});

test('isAutomated spots bulk and no-reply mail', () => {
  assert.ok(isAutomated({ from: { emailAddress: { address: 'no-reply@bank.com' } } }));
  assert.ok(isAutomated({ from: { emailAddress: { address: 'a@b.com' } }, internetMessageHeaders: [{ name: 'Precedence', value: 'bulk' }] }));
  assert.ok(!isAutomated({ from: { emailAddress: { address: 'client@b.com' } }, subject: 'Hello' }));
});

test('stored data is encrypted and needs the right key', async () => {
  await store.log({ action: 'draft', from: 'Ahmad bin Ismail', subject: 'Tenancy deposit' });
  const raw = readFileSync(path.join(dir, 'assistant.enc'));
  assert.ok(!raw.includes('Ahmad'));
  assert.ok(!raw.includes(ME.email));
  const wrong = createStore({ dir, key: crypto.randomBytes(32).toString('hex') });
  await assert.rejects(wrong.load(), /wrong CLOAK_DATA_KEY/);
});


test('meetings and deadlines are pencilled in as tentative, with names restored and no one invited', async () => {
  ai.events = [
    { title: 'Meeting with {{SENDER}} re deposit', kind: 'meeting', start: '2026-10-09T15:00', minutes: 60, location: 'Our office' },
    { title: 'Deadline: file defence', kind: 'deadline', start: '2026-10-20', minutes: 0, location: '' },
    { title: 'Old thing', kind: 'meeting', start: '2026-09-01T10:00', minutes: 30, location: '' },
  ];
  mb.add(clientEmail());
  await assistant.checkMail();
  assert.equal(mb.created.length, 2, 'past dates are skipped');
  const [meeting, deadline] = mb.created;
  assert.equal(meeting.subject, '[Cloak suggestion] Meeting with Ahmad bin Ismail re deposit');
  assert.equal(meeting.startUtc, '2026-10-09T07:00:00.000Z', '3pm Kuala Lumpur is 7am UTC');
  assert.equal(meeting.endUtc, '2026-10-09T08:00:00.000Z');
  assert.equal(meeting.attendees, undefined);
  assert.equal(deadline.allDay, true);
  assert.equal(deadline.startDate, '2026-10-20');
  assert.equal(deadline.endDate, '2026-10-21');
  assertNoRealNames(ai.seen);
  assert.match(ai.opts[0].today, /Monday, 5 October 2026|Monday 5 October 2026/);

  // The same entry is not added twice.
  mb.add(clientEmail({ id: 'm2', receivedDateTime: '2026-10-05T00:20:00Z' }));
  await assistant.checkMail();
  assert.equal(mb.created.length, 2);
});

test('calendar pencilling can be switched off', async () => {
  await store.update((d) => { d.settings.calendar.enabled = false; });
  ai.events = [{ title: 'Meeting', kind: 'meeting', start: '2026-10-09T15:00', minutes: 60, location: '' }];
  mb.add(clientEmail());
  await assistant.checkMail();
  assert.equal(mb.created.length, 0);
});

test('unknown outside sender writing about client work: "is this a client?" and yes adds them', async () => {
  mb.add(clientEmail());
  await assistant.checkMail();
  let d = await store.load();
  const q = d.questions.find((x) => x.kind === 'client');
  assert.ok(q);
  assert.match(q.text, /Is Ahmad bin Ismail \(ahmad\.ismail@gmail\.com\) a client\?/);
  const r = await assistant.answerQuestion(q.id, { answer: 'Yes' }, 'mathew');
  assert.equal(r.addedClient, true);
  d = await store.load();
  assert.ok(d.settings.clients.includes('Ahmad bin Ismail'));
  assert.equal(d.questions.find((x) => x.id === q.id).status, 'answered');
  // Not asked again for the same person.
  mb.add(clientEmail({ id: 'm2', receivedDateTime: '2026-10-05T00:20:00Z' }));
  await assistant.checkMail();
  d = await store.load();
  assert.equal(d.questions.filter((x) => x.kind === 'client').length, 1);
});

test('the AI\'s questions are saved with names restored; answering rewrites the draft without leaking names', async () => {
  ai.questions = ['Do you want to meet {{SENDER.FIRST}} on Friday at 3pm?'];
  mb.add(clientEmail());
  await assistant.checkMail();
  let d = await store.load();
  const q = d.questions.find((x) => x.kind === 'free');
  assert.equal(q.text, 'Do you want to meet Ahmad on Friday at 3pm?');
  assert.equal(mb.drafts.length, 1);

  ai.seen = [];
  ai.questions = [];
  const r = await assistant.answerQuestion(q.id, { answer: 'Yes, but 4pm, and bring Siti Rahmah too', redraft: true }, 'mathew');
  assert.equal(r.redraft, 'draft');
  assert.equal(mb.drafts.length, 2, 'a new draft');
  assert.deepEqual(mb.deleted, ['draft-1'], 'the old draft is replaced');
  const notes = ai.opts.at(-1).notes;
  assert.match(notes, /Yes, but 4pm/);
  assert.doesNotMatch(notes, /Siti|Rahmah|Ahmad/, 'names in the answer are hidden');
  assertNoRealNames(ai.seen);
  d = await store.load();
  assert.equal(d.questions.find((x) => x.id === q.id).answer, 'Yes, but 4pm, and bring Siti Rahmah too');
  assert.equal(mb.created.length, 0, 'a rewrite does not pencil things in again');
});

test('standing instructions go with every email, names hidden', async () => {
  await store.update((d) => { d.settings.preferences = ['Sign off with "Best regards"', 'Refer family law matters to Puan Noraini Hassan']; });
  mb.add(clientEmail());
  await assistant.checkMail();
  const notes = ai.opts[0].notes;
  assert.match(notes, /Best regards/);
  assert.doesNotMatch(notes, /Noraini|Hassan/);
  assertNoRealNames(ai.seen);
});

test('daily summary lists questions and pencilled entries', async () => {
  ai.questions = ['Should I quote the usual fee?'];
  ai.events = [{ title: 'Call with {{SENDER}}', kind: 'call', start: '2026-10-06T10:00', minutes: 30, location: '' }];
  mb.add(clientEmail());
  await assistant.checkMail();
  await assistant.sendSummary({ force: true });
  const mail = mb.sent.find((m) => m.to.includes(ME.email));
  assert.match(mail.html, /Questions for you/);
  assert.match(mail.html, /Should I quote the usual fee\?/);
  assert.match(mail.html, /Pencilled into your calendar/);
  assert.match(mail.html, /Call with Ahmad bin Ismail/);
});

test('zonedToUtc handles Singapore and London summer time', async () => {
  const { zonedToUtc } = await import('../server/assistant/worker.js');
  assert.equal(zonedToUtc('2026-10-09T15:00', 'Asia/Singapore').toISOString(), '2026-10-09T07:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-01T09:00', 'Europe/London').toISOString(), '2026-07-01T08:00:00.000Z');
});
