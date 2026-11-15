// The first-run part of the window's engine: the sample matter, what the
// help screens need to know (where things are kept, the version), and the
// support file. main.js adds these to its api. Everything runs on this
// computer; nothing here opens a network connection.

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSampleMatter, planSample, sampleInfo } from '../sample.js';
import { selfTest, supportFile, supportFileName, systemInfo, SUPPORT_CONTACT } from '../support.js';
import { formatDate } from '../dates.js';
import { VERSION } from '../version.js';

const NOTICES = 'THIRD-PARTY-NOTICES.txt';

export function firstRunApi({ app, dialog, getWin, getMatter, setMatter, who, testPicks }) {
  let sample = null; // the sample matter made in this window: { matterDir, folder }
  const documents = () => app.getPath('documents');
  // Where Cloak is installed: next to Cloak.exe in an installed copy, the app folder when run from source.
  const installFolder = () => (app.isPackaged ? path.dirname(process.execPath) : app.getAppPath());
  const findNotices = () => [installFolder(), process.resourcesPath, app.getAppPath(), path.join(app.getAppPath(), '..')]
    .filter(Boolean).map((dir) => path.join(dir, NOTICES)).find((file) => existsSync(file)) || null;

  const api = {
    // Where the sample would go, and why Cloak would refuse that place, if it would.
    sampleStart: async ({ parent } = {}) => {
      const where = parent || documents();
      const [plan, info] = await Promise.all([planSample(where), sampleInfo()]);
      return { parent: where, folder: plan.folder, refused: plan.refused, about: info.about, files: info.files.length };
    },

    sampleCreate: async ({ parent, password }) => {
      // One matter open at a time: whatever was open is closed first.
      await getMatter()?.close().catch(() => {});
      setMatter(null);
      const made = await createSampleMatter({ parent: parent || documents(), password, user: who() });
      setMatter(made.session);
      sample = { matterDir: path.resolve(made.matterDir), folder: made.folder };
      return { recoveryCode: made.recoveryCode, name: made.info.name, createdText: formatDate(new Date()), who: who(), folder: made.folder, docs: made.docs, matterDir: made.matterDir, outDir: made.outDir, client: made.info.client, others: made.info.others, level: made.info.level || 'strict' };
    },

    // For the "Your data" screen.
    dataPlaces: async () => ({ appData: app.getPath('userData'), ocrData: path.join(os.tmpdir(), 'cloak-ocr-lang'), matterDir: getMatter()?.dir || null }),

    // For the "About" screen.
    about: async () => {
      const s = systemInfo();
      // Windows gives a readable name ("Windows 11 Pro"); elsewhere the kernel's own version string is not one.
      const system = process.platform === 'win32' ? s.operating_system_version : process.platform === 'darwin' ? `macOS (Darwin ${os.release()})` : s.operating_system;
      return { version: VERSION, installFolder: installFolder(), notices: findNotices(), noticesName: NOTICES, support: SUPPORT_CONTACT, system: `${system} (${s.architecture})`, electron: s.electron, matterOpen: !!getMatter() };
    },

    // The person chooses where; Cloak writes the zip there and nowhere else.
    saveSupportFile: async () => {
      const name = supportFileName();
      let file = null;
      if (testPicks) { const dir = testPicks.shift(); file = dir ? path.join(dir, name) : null; }
      else {
        const r = await dialog.showSaveDialog(getWin(), { title: 'Save the support file', defaultPath: path.join(documents(), name), filters: [{ name: 'Zip file', extensions: ['zip'] }] });
        file = r.canceled ? null : r.filePath;
      }
      if (!file) return { saved: false };
      const session = getMatter();
      const test = await selfTest({ session });
      const zip = await supportFile({ session, test });
      await writeFile(file, zip.buffer);
      return { saved: true, file, test, replaced: zip.replaced, names: zip.names, withLog: !!session };
    },
  };

  return {
    api,
    // Folder choosers start in the sample folder while the sample matter is open.
    pickerStart: () => (sample && getMatter() && path.resolve(getMatter().dir) === sample.matterDir ? sample.folder : undefined),
  };
}
