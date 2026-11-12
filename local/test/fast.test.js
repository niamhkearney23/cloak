import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeMatter } from './matter.js';
import { cloakFolder } from '../run.js';
import { Matter } from '../engine.js';

// The single-pass search for known values must give exactly the same result as
// trying the values one by one (the original method).

function both(matter, text) {
  const a = Matter.fromState(matter.state());
  const b = Matter.fromState(matter.state());
  return {
    slow: a.cloak.cloak(text),
    fast: b.cloak.cloak(b.known(text), { skipKnown: true }),
    slowKey: JSON.stringify(a.key()),
    fastKey: JSON.stringify(b.key()),
  };
}

test('same output as the one-by-one search on the whole made-up matter', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-fast-'));
  await makeMatter(path.join(root, 'in'));
  const run = await cloakFolder({ folder: path.join(root, 'in'), write: false });
  let compared = 0;
  for (const f of run.files) for (const p of f.parts) {
    const r = both(run.matter, p.text);
    assert.equal(r.fast, r.slow, `different output for ${f.rel}: ${p.label}`);
    assert.equal(r.fastKey, r.slowKey, `different new tags for ${f.rel}`);
    compared++;
  }
  assert.ok(compared > 20);
});

test('same output on random names, spellings, punctuation, case and spacing', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const words = ['Tan', 'Lim', 'Ah', 'Kow', 'Siti', 'Nur', 'binti', 'bin', 'Ahmad', "O'Neill", 'Maju', 'Jaya', 'Sdn.', 'Bhd.', 'Sdn', 'Bhd', '(M)', 'No.', '12,', 'Jalan', 'Ampang', 'may', 'May', 'wood', 'Wood', '012-987', '6543', 'Dato’', 'Sri', 'A/L', '&', 'Co', 'of', 'the'];
  const phrase = (min, max) => Array.from({ length: min + rnd(max - min + 1) }, () => words[rnd(words.length)]).join(rnd(8) ? ' ' : '  ');
  for (let round = 0; round < 40; round++) {
    const m = new Matter();
    for (let i = 0; i < 12; i++) m.cloak.addLiteral('TERM', phrase(1, 4));
    const text = Array.from({ length: 30 }, () => { let t = phrase(2, 9); const r = rnd(5); return r === 0 ? t.toUpperCase() : r === 1 ? t.toLowerCase() : r === 2 ? t.replace(/ /g, '\n') : t; }).join(rnd(2) ? '. ' : '\n');
    const r = both(m, text);
    assert.equal(r.fast, r.slow, `round ${round}\n${text}`);
  }
});

test('thousands of known values are replaced quickly', () => {
  const m = new Matter();
  for (let i = 0; i < 20000; i++) m.cloak.register(`PERSON_${i + 1}`, `Zeta${i} Name${i % 97}`);
  const text = Array.from({ length: 6000 }, (_, i) => `Row ${i}: Zeta${(i * 7) % 20000} Name${((i * 7) % 20000) % 97} paid on Monday.`).join('\n');
  const started = Date.now();
  const out = m.known(text);
  const ms = Date.now() - started;
  assert.doesNotMatch(out, /Zeta/);
  console.log(`      20,000 known values, ${Math.round(text.length / 1000)} KB of text: ${ms} ms`);
  assert.ok(ms < 3000, `took ${ms} ms`);
});
