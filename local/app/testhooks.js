// When may the CLOAK_TEST_* licence settings (a test key, a test "computer-wide" licence folder) be honoured?
//
// Only for a copy started the way the tests start it: Electron run on the
// source folder (`electron <folder>`), never an installed copy. Electron's own
// `app.isPackaged` is not enough on its own: it is decided from the program
// file's NAME (electron / electron.exe), so a copy of the installed program
// renamed to electron.exe reads as "not packaged". So every one of these must
// hold:
//   1. app.isPackaged is false;
//   2. the program was started on a folder (process.defaultApp: `electron <folder>`);
//   3. the app's folder is not the one inside the program's own resources folder,
//      which is where an installed copy keeps it (resources/app);
//   4. the app's package.json carries no release mark (`cloakRelease`, written
//      by the build in package.json "build.extraMetadata"), so a copy of the
//      installed folder started with stock Electron is refused too.
// Any doubt means the built-in licence key and the real ProgramData folder.

import path from 'node:path';

const inside = (child, parent) => {
  if (!child || !parent) return false;
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

export function testHooksAllowed({ isPackaged, defaultApp, appPath, resourcesPath, release }) {
  if (isPackaged !== false) return false;
  if (defaultApp !== true) return false;
  if (release !== false) return false; // marked as a release, or not known
  if (inside(appPath, resourcesPath)) return false;
  return true;
}
