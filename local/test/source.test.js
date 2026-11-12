import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import fsp from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { makeMatter } from './matter.js';
import { finishReview } from './helpers.js';
import { createMatter, openMatter } from '../matter.js';
import { assertNotSynced, isInside, locate, parseMacListing, parseWindowsListing } from '../source.js';
import { formatDate } from '../dates.js';

// iManage Drive, OneDrive and Google Drive: read-only sources, and nothing of
// the matter is ever saved inside them. Made-up paths and made-up files only.
// NONE OF THIS HAS BEEN RUN AGAINST A REAL iManage Drive, OneDrive OR Google
// Drive: the names and the file attributes are those the systems are known to
// use, tested here on stand-ins.

const noLabel = async () => 'Local Disk';
const win = (p, extra = {}) => locate(p, { platform: 'win32', env: {}, volumeLabel: noLabel, resolveLinks: false, ...extra });
const nix = (p, extra = {}) => locate(p, { platform: 'darwin', env: {}, resolveLinks: false, ...extra });

test('a synced location is recognised from the path: iManage Drive, OneDrive, Google Drive', async () => {
  let l = await win('C:\\Users\\siti\\OneDrive - Kearney Law\\Matters\\Tan v Lim');
  assert.deepEqual([l.kind, l.label, l.root, l.relative], ['onedrive', 'OneDrive', 'C:\\Users\\siti\\OneDrive - Kearney Law', 'Matters/Tan v Lim']);
  l = await win('G:\\My Drive\\Clients\\Maju Jaya');
  assert.deepEqual([l.kind, l.root, l.relative], ['googledrive', 'G:\\My Drive', 'Clients/Maju Jaya']);
  l = await win('I:\\iManage Drive\\Kearney Library\\Maju Jaya\\Dispute 2024\\Pleadings');
  assert.deepEqual([l.kind, l.label, l.root, l.relative], ['imanage', 'iManage Drive', 'I:\\iManage Drive', 'Kearney Library/Maju Jaya/Dispute 2024/Pleadings']);
  l = await nix('/Users/siti/Library/CloudStorage/OneDrive-KearneyLaw/Docs');
  assert.deepEqual([l.kind, l.root], ['onedrive', '/Users/siti/Library/CloudStorage/OneDrive-KearneyLaw']);
  l = await nix('/Users/siti/Library/CloudStorage/GoogleDrive-siti@kearney.example/My Drive/Docs');
  assert.deepEqual([l.kind, l.relative], ['googledrive', 'My Drive/Docs']);
  l = await nix('/Volumes/iManage Drive/Library/Client/Matter');
  assert.deepEqual([l.kind, l.root, l.relative], ['imanage', '/Volumes/iManage Drive', 'Library/Client/Matter']);
  assert.equal((await win('c:\\users\\SITI\\ONEDRIVE\\x')).kind, 'onedrive');
});

test('a mapped drive is recognised from its label, and the system\'s OneDrive folder from its settings', async () => {
  const l = await win('I:\\Kearney Library\\Maju Jaya', { volumeLabel: async () => 'iManage Drive' });
  assert.deepEqual([l.kind, l.root, l.relative], ['imanage', 'I:\\', 'Kearney Library/Maju Jaya']);
  assert.equal(await win('D:\\Work\\Matters'), null);
  const o = await win('D:\\Firm Share\\Cases\\A', { env: { OneDriveCommercial: 'D:\\Firm Share' } });
  assert.equal(o.kind, 'onedrive');
});

test('an ordinary folder is not treated as synced, and the person can say a folder is', async () => {
  assert.equal(await win('C:\\Users\\siti\\Documents\\Matters'), null);
  assert.equal(await nix('/Users/siti/Documents/Matters'), null);
  const m = await nix('/Users/siti/Work/Docs', { manual: 'imanage' });
  assert.deepEqual([m.kind, m.how], ['imanage', 'marked by the person']);
  assert.equal((await win('E:\\Share\\Docs', { manual: 'googledrive' })).root, 'E:\\');
});

test('a shortcut or symbolic link cannot hide where a folder really is', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-link-'));
  const real = path.join(root, 'OneDrive - Test Firm', 'Cases');
  await mkdir(real, { recursive: true });
  try { await symlink(real, path.join(root, 'innocent-looking')); } catch { return t.skip('cannot make a symbolic link here'); }
  const l = await locate(path.join(root, 'innocent-looking'));
  assert.equal(l.kind, 'onedrive');
});

test('nothing of the matter may be saved inside a synced location', async () => {
  const sync = { kind: 'imanage', label: 'iManage Drive', root: 'I:\\iManage Drive', how: 'x' };
  const opts = { platform: 'win32', env: {}, volumeLabel: noLabel, resolveLinks: false };
  await assert.rejects(assertNotSynced('I:\\iManage Drive\\Library\\Matter key', 'The matter folder', opts), (e) => e.code === 'SYNC_LOCATION' && /Choose a folder outside iManage Drive/.test(e.message) && /would upload them/.test(e.message));
  // Even a folder that looks ordinary is refused if it is inside the area the documents came from.
  await assert.rejects(assertNotSynced('I:\\iManage Drive\\x', 'The folder for the cloaked copies', { ...opts, source: sync }), /iManage Drive/);
  await assertNotSynced('D:\\Work\\Matter key', 'The matter folder', { ...opts, source: sync });
  assert.ok(isInside('c:\\A\\b', 'C:\\a', 'win32'));
  assert.ok(!isInside('C:\\Ab', 'C:\\A', 'win32'));
});

test('a matter folder inside a synced folder cannot be created or opened', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-sync-'));
  const inSync = path.join(root, 'OneDrive - Kearney Law', 'matter');
  await assert.rejects(createMatter({ dir: inSync, password: 'a long enough password' }), /OneDrive.*Choose a folder outside OneDrive/s);
  await assert.rejects(openMatter({ dir: path.join(root, 'iManage Drive', 'old matter'), password: 'a long enough password' }), /iManage Drive/);
  await assert.rejects(stat0(inSync), 'nothing was created there');
});
const stat0 = (p) => lstat(p);

test('files that are only placeholders are recognised from the listing the system gives', () => {
  const windows = ['32|C:\\Docs\\downloaded.docx', '4194336|C:\\Docs\\online only (OneDrive).pdf', '4128|C:\\Docs\\Offline|odd name.txt', '262176|C:\\Docs\\recall on open.docx', 'garbage line', '16|C:\\Docs\\folder'].join('\r\n');
  assert.deepEqual(parseWindowsListing(windows), ['C:\\Docs\\online only (OneDrive).pdf', 'C:\\Docs\\Offline|odd name.txt', 'C:\\Docs\\recall on open.docx']);
  const mac = ['0|/Users/x/Docs/here.docx', `${0x40000000}|/Users/x/Docs/in the cloud.pdf`, `${0x40000020}|/Users/x/Docs/cloud 2.pdf`].join('\n');
  assert.deepEqual(parseMacListing(mac), ['/Users/x/Docs/in the cloud.pdf', '/Users/x/Docs/cloud 2.pdf']);
});

test('dates are written as "12 Nov 2026, 9:19 am", never as numbers', () => {
  assert.equal(formatDate(new Date(2026, 10, 12, 9, 19)), '12 Nov 2026, 9:19 am');
  assert.equal(formatDate(new Date(2026, 0, 3, 0, 5)), '3 Jan 2026, 12:05 am');
  assert.equal(formatDate(new Date(2026, 11, 31, 23, 59)), '31 Dec 2026, 11:59 pm');
  assert.equal(formatDate(new Date(2026, 5, 1, 12, 0)), '1 Jun 2026, 12:00 pm');
});

// ----------------------------------------------------- the read-only guarantee

async function snapshot(dir) {
  const out = {};
  async function visit(p) {
    const st = await lstat(p);
    const rel = path.relative(dir, p) || '.';
    if (st.isDirectory()) {
      out[rel] = { type: 'directory', mode: st.mode, mtime: st.mtimeMs, ctime: st.ctimeMs, entries: (await readdir(p)).sort() };
      for (const name of out[rel].entries) await visit(path.join(p, name));
    } else {
      out[rel] = { type: 'file', size: st.size, mode: st.mode, mtime: st.mtimeMs, ctime: st.ctimeMs, ino: st.ino, sha256: createHash('sha256').update(await readFile(p)).digest('hex') };
    }
  }
  await visit(dir);
  return out;
}

test('an iManage Drive folder is only read: nothing in it changes, and the report says where it came from', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-srctest-'));
  const workspace = path.join(root, 'iManage Drive', 'Kearney Library', 'Maju Jaya Dispute', 'Pleadings');
  await makeMatter(workspace);
  await writeFile(path.join(workspace, '.hidden marker.txt'), 'A hidden file.');
  const drive = path.join(root, 'iManage Drive');
  const before = await snapshot(drive);
  const FAST = { N: 2 ** 12, r: 8, p: 1 };

  // The key may not be made inside the drive.
  await assert.rejects(createMatter({ dir: path.join(drive, 'matter'), password: 'a long enough password', kdf: FAST }), /Choose a folder outside iManage Drive/);
  const { session } = await createMatter({ dir: path.join(root, 'work', 'matter'), password: 'a long enough password', name: 'Made-up matter', user: 'Siti Aminah (siti.a)', kdf: FAST });

  // Two files are stand-ins for "not downloaded yet". They must be listed, asked about, and never opened.
  const stubNames = ['01 Writ and Statement of Claim.docx', '02 Affidavit Ahmad bin Ismail.txt'];
  const reads = [];
  const original = fsp.readFile;
  fsp.readFile = async (p, ...rest) => { reads.push(String(p)); return original(p, ...rest); };
  syncBuiltinESMExports();
  let asked = null;
  const seen = [];
  let run;
  try {
    run = await session.cloakFolder({
      folder: workspace,
      detectStubs: async () => stubNames.map((n) => path.join(workspace, n)),
      onCloudOnly: async (names) => { asked = names; return false; },
      onProgress: (p) => seen.push(p),
    });
  } finally {
    fsp.readFile = original;
    syncBuiltinESMExports();
  }
  assert.deepEqual([...asked].sort(), stubNames);
  for (const n of stubNames) {
    const f = run.files.find((x) => x.rel === n);
    assert.equal(f.status, 'unreadable');
    assert.match(f.reasons[0], /Not downloaded yet.*Cloak did not open it/);
    assert.ok(!reads.some((r) => r.endsWith(n)), `${n} was opened`);
    assert.ok(!seen.some((p) => p.file === n && p.stage === 'reading'), `${n} was sent to be read`);
  }
  assert.ok(reads.some((r) => r.endsWith('03 Affidavit of Siti Nurhaliza.docx')), 'files that are downloaded are read');

  // If the person says yes, they are read.
  const yes = await session.cloakFolder({ folder: workspace, detectStubs: async () => stubNames.map((n) => path.join(workspace, n)), onCloudOnly: async () => true });
  assert.equal(yes.files.find((x) => x.rel === stubNames[0]).status, 'cloaked');

  // The report records the source; the path is tags, not names.
  await finishReview(session);
  await assert.rejects(session.export({ outDir: path.join(drive, 'cloaked') }), /Choose a folder outside iManage Drive/);
  await assert.rejects(session.export({ outDir: path.join(workspace, 'cloaked') }), /iManage Drive/);
  const out = path.join(root, 'work', 'cloaked');
  await session.export({ outDir: out });
  const reportText = await readFile(path.join(out, 'cloak-report.json'), 'utf8');
  const report = JSON.parse(reportText);
  assert.equal(report.source.kind, 'iManage Drive folder');
  assert.equal(report.source.read_only, true);
  assert.match(report.source.workspace_path, /^\{\{PATH_1\}\}\/\{\{PATH_2\}\}\/Pleadings$/);
  assert.doesNotMatch(reportText, /Kearney Library|Maju Jaya Dispute/);
  // The real path is in the encrypted key and on the review screen.
  assert.equal(session.reviewData().source.workspace_path, 'Kearney Library/Maju Jaya Dispute/Pleadings');
  assert.equal(session.matter.cloak.uncloak(report.source.workspace_path).text, 'Kearney Library/Maju Jaya Dispute/Pleadings');
  assert.ok(session.sources.some((s) => s.kind === 'iManage Drive folder' && s.workspace_path === 'Kearney Library/Maju Jaya Dispute/Pleadings'));
  await session.close();

  // Nothing in the iManage Drive folder changed in any way during all of that.
  assert.deepEqual(await snapshot(drive), before);
});

test('an ordinary folder is read-only too, and cloaked copies cannot be written inside it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cloak-ro-'));
  const docs = path.join(root, 'documents');
  await makeMatter(docs);
  const before = await snapshot(docs);
  const { cloakFolder } = await import('../run.js');
  await assert.rejects(cloakFolder({ folder: docs, outDir: path.join(docs, 'cloaked') }), /outside the documents folder/);
  await assert.rejects(cloakFolder({ folder: docs, outDir: docs }), /outside the documents folder/);
  const run = await cloakFolder({ folder: docs, outDir: path.join(root, 'cloaked') });
  assert.ok(run.report.totals.cloaked > 10);
  assert.equal(run.report.source.kind, 'ordinary folder');
  assert.deepEqual(await snapshot(docs), before);
});
