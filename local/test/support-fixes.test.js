import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeMatter } from './matter.js';
import { createMatter, openMatter } from '../matter.js';

// Fixes found in review (support and sample areas). Made-up data only.
const FAST = { N: 2 ** 12, r: 8, p: 1 };
const PASSWORD = 'a long test password';
const exists = (p) => stat(p).then(() => true, () => false);

test('a save that finishes after the matter is closed is refused, so the key file is never sealed with a zeroed key', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-closed-'));
  const docs = path.join(root, 'documents');
  const dir = path.join(root, 'matter');
  await makeMatter(docs);
  const { session } = await createMatter({ testMatter: true, dir, password: PASSWORD, user: 'tester', kdf: FAST });
  // The folder is still being read when the person closes the matter.
  const reading = session.cloakFolder({ folder: docs });
  await session.close();
  await reading.catch(() => {});
  assert.equal(await exists(path.join(dir, 'matter.lock')), false, 'lock removed');
  await assert.rejects(() => session.save(), /closed/);
  const again = await openMatter({ dir, password: PASSWORD, user: "tester" });
  assert.ok(again, 'the matter still opens with its password');
  await again.close();
});

test('closing while saves are still running does not leave the lock behind', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-closing-'));
  const dir = path.join(root, 'matter');
  const { session } = await createMatter({ testMatter: true, dir, password: PASSWORD, user: 'tester', kdf: FAST });
  await Promise.all([session.save(), session.save(), session.save(), session.close(), session.close()]);
  assert.equal(await exists(path.join(dir, 'matter.lock')), false, 'lock removed');
  const again = await openMatter({ dir, password: PASSWORD, user: "tester" });
  await again.close();
});
