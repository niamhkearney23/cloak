import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Matter } from '../engine.js';

const cloak = (text) => { const m = new Matter({ options: { level: 'standard' } }); m.register(m.learn(text)); return m.apply(text); };

test('a house or unit number before the street is part of the address, even on the line above (OCR pages)', () => {
  for (const [text, gone] of [
    ['The company is at Unit 3-2,\nPersiaran Gurney, 54000 Kuala Lumpur.', /Unit 3-2/],
    ['The company is at Unit 3-2,\nPersiaran Gurney.', /Unit 3-2/],
    ['Notices to Mr Lim at 27,\nJalan Tun Sambanthan 8.', /27,/],
    ['of No. 12,\nJalan Ampang', /No\. 12/],
    ['of 27, Jalan Tun Sambanthan', /27/],
  ]) {
    const out = cloak(text);
    assert.ok(!gone.test(out) && /\{\{ADDRESS_\d+\}\}/.test(out), `${text}\n=> ${out}`);
  }
});

test('words before a dash or bracket are not swallowed into the address', () => {
  const out = cloak('Aminah binti Yusof (mother of the Plaintiff) - Taman Desa Jaya, 43000 Kajang, Selangor');
  assert.match(out, /\(mother of the Plaintiff\) - \{\{ADDRESS_\d+\}\}/, out);
  assert.ok(!/Taman Desa|Kajang/.test(out));
  const out2 = cloak('I, Ali, of No. 12, Jalan Ampang, 50450 Kuala Lumpur, state:');
  assert.match(out2, /of \{\{ADDRESS_\d+\}\}/);
});
