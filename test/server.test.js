import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.CLOAK_MOCK = '1';
const { server } = await import('../server/server.js');
const { buildUserPrompt, DOCUMENTS } = await import('../server/prompts.js');
const require = createRequire(import.meta.url);
const { Cloak } = require('../public/cloak.js');

let base;
before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('serves the app', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Cloak Drafting/);
});

test('blocks path traversal', async () => {
  const res = await fetch(`${base}/..%2fpackage.json`);
  assert.notEqual(res.status, 200);
});

test('reports demo mode', async () => {
  const res = await fetch(`${base}/api/status`);
  assert.deepEqual(await res.json(), { mode: 'demo', model: null });
});

test('rejects unknown document types and empty briefs', async () => {
  let res = await fetch(`${base}/api/draft`, { method: 'POST', body: JSON.stringify({ docType: 'nope', brief: 'x' }) });
  assert.equal(res.status, 400);
  res = await fetch(`${base}/api/draft`, { method: 'POST', body: JSON.stringify({ docType: 'writ', brief: '  ' }) });
  assert.equal(res.status, 400);
});

test('full round trip: cloak in, draft, uncloak out', async () => {
  const c = new Cloak();
  c.addPerson('PLAINTIFF', "Mary O'Neill");
  c.addOrganisation('DEFENDANT', 'Acme Haulage Limited');
  c.register('RECORD_NO', '2026/123');
  const brief = c.cloak([
    'Jurisdiction: Northern Ireland',
    'Court: High Court',
    'Record number: 2026/123',
    'Party terminology: Plaintiff / Defendant',
    '',
    'PARTIES',
    "Plaintiff 1: Mary O'Neill",
    'Defendant 1: Acme Haulage Limited',
    '',
    'FACTS',
    "Mary O'Neill was hit by a lorry owned by Acme Haulage Limited.",
  ].join('\n'));
  assert.doesNotMatch(brief, /Mary|Acme|2026\/123/);

  for (const docType of Object.keys(DOCUMENTS)) {
    const res = await fetch(`${base}/api/draft`, { method: 'POST', body: JSON.stringify({ docType, brief, instructions: '' }) });
    assert.equal(res.status, 200);
    const { text } = await res.json();
    assert.doesNotMatch(text, /Mary|Acme/, 'server output must only contain tokens');
    const back = c.uncloak(text);
    assert.deepEqual(back.unknown, []);
    assert.match(back.text, /MARY O'NEILL/);
    assert.match(back.text, /ACME HAULAGE LIMITED/);
    assert.match(back.text, /Record No\. 2026\/123/);
  }
});

test('prompt wraps staff text as data and includes document guidance', () => {
  const p = buildUserPrompt({ docType: 'reply', brief: 'B', instructions: 'I' });
  assert.match(p, /<case_brief>\nB\n<\/case_brief>/);
  assert.match(p, /<document_instructions>\nI\n<\/document_instructions>/);
  assert.match(p, /REPLY/);
});
