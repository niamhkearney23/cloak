// Cloak for the desktop: one window. Everything runs on this computer.
//
// The window can only load its own files. Every other request is refused,
// name lookups are switched off, and there is no auto-update.

import { app, BrowserWindow, dialog, ipcMain, safeStorage, session as electronSession } from 'electron';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMatter, openMatter } from '../matter.js';
import { KEY_FILE_NAME, MIN_PASSWORD_LENGTH } from '../keyfile.js';
import { VERSION } from '../version.js';
import { assertNotSynced, locate } from '../source.js';
import { formatDate } from '../dates.js';
import { checkDraft } from '../draftcheck.js';
import { extractFile } from '../extract.js';
import { firstRunApi } from './firstrun.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// No part of the app may reach the network.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('no-pings');
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,OptimizationHints,MediaRouter,Translate,InterestFeedContentSuggestions');
if (process.env.CLOAK_TEST_USER_DATA) app.setPath('userData', process.env.CLOAK_TEST_USER_DATA);
if (process.env.CLOAK_TEST_DOCUMENTS) app.setPath('documents', process.env.CLOAK_TEST_DOCUMENTS);

let win = null;
let matter = null; // the open matter session
const login = os.userInfo().username;
// The person's full name is asked for once and kept on this computer. Sign-offs
// and logs carry it together with the computer login: "Siti Aminah (siti.a)".
const profileFile = () => path.join(app.getPath('userData'), 'profile.json');
let fullName = '';
async function loadProfile() {
  try { fullName = String(JSON.parse(await readFile(profileFile(), 'utf8')).fullName || '').trim(); } catch { fullName = ''; }
}
const who = () => (fullName ? `${fullName} (${login})` : login);
// Tests cannot click the system's folder chooser: they supply the answers.
const testPicks = process.env.CLOAK_TEST_PICKS ? JSON.parse(process.env.CLOAK_TEST_PICKS) : null;
const testDraft = process.env.CLOAK_TEST_DRAFT || null;

const rememberedFile = () => path.join(app.getPath('userData'), 'remembered.json');
const dirId = (dir) => createHash('sha256').update(path.resolve(dir)).digest('hex');
async function remembered() {
  try { return JSON.parse(await readFile(rememberedFile(), 'utf8')); } catch { return {}; }
}
// "Remember on this computer": the password is kept by the operating
// system's own protected store (Windows DPAPI, macOS Keychain). With no
// password, or where that store is missing, any password kept for the matter
// is forgotten instead. Returns whether a password is now kept.
async function remember(dir, password) {
  const all = await remembered();
  const id = dirId(dir);
  if (password && safeStorage.isEncryptionAvailable()) all[id] = safeStorage.encryptString(password).toString('base64');
  else if (id in all) delete all[id];
  else return false;
  await mkdir(path.dirname(rememberedFile()), { recursive: true });
  await writeFile(rememberedFile(), JSON.stringify(all), { mode: 0o600 });
  return id in all;
}

const needMatter = () => { if (!matter) throw new Error('No matter is open. Choose the matter folder and open it with its password, then try again.'); return matter; };
const NOT_IN_RUN = 'That file is not in this run. The list may be out of date: cloak the folder again to see the files as they are now.';

const api = {
  info: async () => ({ version: VERSION, login, fullName, who: who(), canRemember: safeStorage.isEncryptionAvailable(), minPasswordLength: MIN_PASSWORD_LENGTH }),

  setName: async ({ fullName: name }) => {
    name = String(name || '').replace(/\s+/g, ' ').trim();
    if (name.split(' ').length < 2 || name.length < 5) throw new Error('That is not a full name. Type your first and last name (for example, Siti Aminah binti Yusof): it is written next to your sign-offs.');
    fullName = name;
    await mkdir(path.dirname(profileFile()), { recursive: true });
    await writeFile(profileFile(), JSON.stringify({ fullName }), { mode: 0o600 });
    return { who: who() };
  },

  // Is a folder in iManage Drive, OneDrive or Google Drive?
  inspectSource: async ({ folder, manual }) => {
    const loc = await locate(folder, { manual: manual || null });
    return { location: loc && { label: loc.label, kind: loc.kind, root: loc.root, workspacePath: loc.relative, how: loc.how } };
  },

  // The matter folder and the cloaked copies may not sit in a synced folder.
  checkLocation: async ({ dir, what, folder, manual }) => {
    const source = folder ? await locate(folder, { manual: manual || null }) : null;
    await assertNotSynced(dir, what || 'That folder', { source });
    return {};
  },

  pickFolder: async ({ title }) => {
    if (testPicks) return testPicks.shift() ?? null;
    const r = await dialog.showOpenDialog(win, { title, defaultPath: firstRun.pickerStart(), properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  },

  inspectMatter: async ({ dir }) => {
    const exists = await stat(path.join(dir, KEY_FILE_NAME)).then(() => true, () => false);
    return { exists, remembered: exists && !!(await remembered())[dirId(dir)] };
  },

  createMatter: async ({ dir, name, password, level }) => {
    const made = await createMatter({ dir, name, password, user: who(), options: { level: level === 'standard' ? 'standard' : 'strict' } });
    matter = made.session;
    return { recoveryCode: made.recoveryCode, name: matter.name, createdText: formatDate(new Date()), who: who() };
  },

  openMatter: async ({ dir, password, recoveryCode, takeOver, rememberIt, useRemembered }) => {
    if (useRemembered) {
      const blob = (await remembered())[dirId(dir)];
      if (!blob) throw new Error('No password is remembered for this matter on this computer. Type the matter password instead.');
      password = safeStorage.decryptString(Buffer.from(blob, 'base64'));
    }
    try {
      matter = await openMatter({ dir, password, recoveryCode, takeOver, user: who() });
    } catch (err) {
      // Someone changed the matter password since it was remembered here: forget it, so the window asks for the new one.
      if (useRemembered && err.code === 'WRONG_SECRET') {
        await remember(dir, null);
        throw new Error('The password remembered on this computer no longer opens this matter. Someone may have changed it. Cloak has forgotten it on this computer: type the new matter password.');
      }
      throw err;
    }
    if (rememberIt && password) await remember(dir, password);
    return { name: matter.name, openedWith: matter.openedWith, level: matter.matter.options.level, setup: matter.matter.setup, testMatter: matter.testMatter };
  },

  forgetPassword: async ({ dir }) => { await remember(dir, null); return {}; },

  // Matter settings. Each needs the open matter, and each is recorded in the
  // matter's log without the password or the recovery code.
  changePassword: async ({ password, again }) => {
    const m = needMatter();
    if (String(password ?? '') !== String(again ?? '')) throw new Error('The two passwords do not match. Type the same password in both boxes.');
    await m.changePassword(password);
    // A password remembered on this computer would no longer open the matter: it is updated, or forgotten if it cannot be kept safely.
    if (!(dirId(m.dir) in (await remembered()))) return { remembered: null };
    return { remembered: (await remember(m.dir, password)) ? 'updated' : 'forgotten' };
  },
  newRecoveryCode: async () => {
    const m = needMatter();
    const recoveryCode = await m.newRecoveryCode();
    return { recoveryCode, name: m.name, replacedText: formatDate(new Date()), who: who() };
  },
  clearCache: async () => { await needMatter().clearCache(); return {}; },

  cloak: async ({ folder, options, manualSource, setup }) => {
    const m = needMatter();
    Object.assign(m.matter.options, options);
    // Who the client and the other parties are, and whether this is a test matter: kept in the encrypted matter key.
    if (setup) await m.setSetup(setup);
    const run = await m.cloakFolder({
      folder,
      manualSource: manualSource || null,
      onProgress: (p) => win?.webContents.send('progress', p),
      // Files still in the cloud are only downloaded if the person says so.
      onCloudOnly: async (files) => {
        if (testPicks) return false;
        const shown = files.slice(0, 20).join('\n') + (files.length > 20 ? `\n…and ${files.length - 20} more` : '');
        const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Download and include them', 'Leave them out'], defaultId: 1, cancelId: 1, message: `${files.length} file${files.length === 1 ? ' is' : 's are'} only placeholders in the synced folder: not downloaded to this computer yet.`, detail: `${shown}\n\nOpening them makes iManage Drive, OneDrive or Google Drive download them. Cloak has not opened them. Files left out are listed as not read, and are not exported.` });
        return r.response === 0;
      },
    });
    return { seconds: run.seconds, totals: run.report.totals, review: m.reviewData() };
  },

  review: async () => needMatter().reviewData(),
  action: async (action) => needMatter().reviewAction(action),
  approve: async ({ number, confirmation }) => needMatter().approveFile(number, { confirmation }),
  complete: async () => needMatter().completeReview(),
  fileText: async ({ number }) => {
    const f = needMatter().run?.files.find((x) => x.index === number);
    if (!f) throw new Error(NOT_IN_RUN);
    return { name: f.rel, text: f.cloaked || '', reasons: f.reasons };
  },
  export: async ({ outDir, only }) => needMatter().export({ outDir, only: only === 'chronology' ? 'chronology' : 'all' }),

  // The chronology table.
  chronology: async ({ build, undated }) => {
    const m = needMatter();
    if (build) await m.buildChronology();
    return m.chronologyView({ undated: !!undated });
  },
  chronologyAction: async ({ action, undated }) => {
    const m = needMatter();
    const view = await m.chronologyAction(action);
    return { view: m.chronologyView({ undated: !!undated }) || view, review: m.reviewData() };
  },

  // Restore a draft: the matter must be open. Source files are only needed for the source check.
  pickDraftFile: async () => {
    if (testPicks) return { text: testDraft || '' };
    const r = await dialog.showOpenDialog(win, { title: 'Choose the draft', properties: ['openFile'], filters: [{ name: 'Drafts', extensions: ['txt', 'md', 'docx'] }] });
    if (r.canceled) return null;
    const file = r.filePaths[0];
    const read = await extractFile(file);
    const parts = read.parts || [];
    if (!parts.length) throw new Error(`Cloak could not read that file${read.reasons?.length ? ` (${read.reasons[0]})` : ''}. Open it, copy the text and paste it into the box instead.`);
    return { name: path.basename(file), text: parts.map((p) => p.text).join('\n\n') };
  },
  restoreDraft: async ({ draft, folder }) => {
    const m = needMatter();
    if (folder && !m.run) await m.cloakFolder({ folder, onCloudOnly: async () => false });
    const sources = m.run ? m.run.files.flatMap((f) => (f.parts || []).map((p) => p.text)) : null;
    const r = checkDraft({ matter: m.matter, draft, sources });
    await m.log('draft-restored', { tags_restored: r.report.tagsRestored, result: r.result });
    return r;
  },
  saveText: async ({ text, name }) => {
    if (testPicks) { const p = testPicks.shift(); if (p) await writeFile(path.join(p, name || 'restored-draft.txt'), text, 'utf8'); return { saved: !!p }; }
    const r = await dialog.showSaveDialog(win, { title: 'Save the restored draft', defaultPath: name || 'restored-draft.txt', filters: [{ name: 'Text', extensions: ['txt'] }] });
    if (r.canceled) return { saved: false };
    await writeFile(r.filePath, text, 'utf8');
    return { saved: true };
  },
  closeMatter: async () => { await matter?.close(); matter = null; return {}; },
};

// First run: the sample matter, the help screens and the support file (app/firstrun.js).
const firstRun = firstRunApi({ app, dialog, getWin: () => win, getMatter: () => matter, setMatter: (s) => { matter = s; }, who, testPicks });
Object.assign(api, firstRun.api);

ipcMain.handle('cloak', async (event, name, args) => {
  // Only the app's own window may call in.
  if (event.sender !== win?.webContents || !api[name]) return { error: 'Not allowed.' };
  try {
    return { ok: await api[name](args || {}) };
  } catch (err) {
    return { error: err.message || String(err), code: err.code };
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    title: `Cloak ${VERSION}`,
    backgroundColor: '#ffffff',
    webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, webSecurity: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(here, 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('page-title-updated', (e) => e.preventDefault());
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    await loadProfile();
    const ses = electronSession.defaultSession;
    // Only the app's own files load. Everything else is refused.
    ses.webRequest.onBeforeRequest((details, done) => done({ cancel: !/^(?:file|devtools|chrome-devtools):/.test(details.url) }));
    ses.setPermissionRequestHandler((wc, permission, done) => done(false));
    createWindow();
  });
  // Closing the window closes the matter, so the next person can open it.
  let closing = false;
  app.on('before-quit', (e) => {
    if (closing || !matter) return;
    e.preventDefault();
    closing = true;
    matter.close().catch(() => {}).finally(() => { matter = null; app.quit(); });
  });
  app.on('window-all-closed', () => app.quit());
}
