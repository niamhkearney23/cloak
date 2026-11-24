import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildNotices, checkBuilt, shippedPackages, NOT_SHIPPED } from '../tools/third-party-notices.mjs';

const local = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(local, 'package.json'), 'utf8'));
// The compiled part of the canvas library differs from system to system.
const perSystem = (name) => /^@napi-rs\/canvas-/.test(name);

test('the shipped packages are the dependencies and theirs, never the dev tools', () => {
  const names = shippedPackages().map((p) => p.name);
  for (const n of ['pdfjs-dist', 'tesseract.js', 'tesseract.js-core', '@napi-rs/canvas', '@kenjiuno/msgreader', '@tesseract.js-data/eng']) assert.ok(names.includes(n), n);
  for (const n of Object.keys(pkg.devDependencies)) assert.ok(!names.includes(n), `${n} is a dev tool`);
  assert.ok(names.some(perSystem), 'the canvas part for this system');
  assert.ok(!names.includes('encoding'), 'an optional peer that nothing requires is not shipped');
});

test('the notices name every shipped package with its licence text, and the parts built into binaries', () => {
  const { text, packages, warnings } = buildNotices();
  // Only the Linux part of the canvas library could be inspected; if another
  // system's part has no bill of materials, say so but do not stop the build.
  for (const w of warnings.filter((x) => /sbom\.cdx\.json/.test(x))) console.log(`      warning: ${w}`);
  assert.deepEqual(warnings.filter((x) => !/sbom\.cdx\.json/.test(x)), []);
  for (const p of packages) assert.ok(text.includes(`\n${p.name} ${p.version}\nLicence: `), `${p.name} ${p.version}`);
  assert.match(text, /^Electron \d+\.\d+\.\d+\nLicence: MIT/m);
  assert.match(text, /LICENSES\.chromium\.html/);
  assert.match(text, /--- wasm\/LICENSE_JBIG2 ---[\s\S]*PDFium Authors/, 'the JBIG2 decoder in pdf.js and its PDFium licence');
  assert.match(text, /^ {2}freetype .* - FTL - /m, 'from the canvas library\'s bill of materials');
  assert.match(text, /^ {2}Leptonica - /m, 'inside Tesseract');
  assert.doesNotMatch(text, /Liberation/i, 'the fonts left out of the installer are not listed');
});

test('the THIRD-PARTY-NOTICES.txt in the repository is up to date', async () => {
  // (A Windows checkout may have turned the line endings into CRLF: .gitattributes prevents it, and this is read either way.)
  const committed = (await readFile(path.join(local, 'THIRD-PARTY-NOTICES.txt'), 'utf8')).replace(/\r\n/g, '\n');
  for (const p of shippedPackages().filter((x) => !perSystem(x.name))) {
    assert.ok(committed.includes(`\n${p.name} ${p.version}\nLicence: `), `${p.name} ${p.version} is not in THIRD-PARTY-NOTICES.txt: run node tools/third-party-notices.mjs`);
  }
});

test('the installer carries the notices and Electron\'s own licence files, and leaves out what the notices leave out', () => {
  const b = pkg.build;
  assert.ok(b.extraResources.some((r) => r.from === 'THIRD-PARTY-NOTICES.txt' && r.to === 'THIRD-PARTY-NOTICES.txt'));
  // electron-builder deletes these from the Mac app; Windows keeps them in the installation folder.
  for (const f of ['LICENSE', 'LICENSES.chromium.html']) assert.ok(b.mac.extraResources.some((r) => r.from === `node_modules/electron/dist/${f}`), f);
  for (const x of NOT_SHIPPED) assert.ok(b.files.includes(`!node_modules/${x.pkg}/${x.pattern}`), `${x.pkg}/${x.pattern} must be left out in package.json too`);
});

test('the check after building finds a package missing from the notices and a file that should have been left out', async () => {
  const dist = await mkdtemp(path.join(os.tmpdir(), 'cloak-notices-'));
  const res = path.join(dist, 'win-unpacked', 'resources');
  const mod = (name, version) => mkdir(path.join(res, 'app', 'node_modules', name), { recursive: true }).then(() => writeFile(path.join(res, 'app', 'node_modules', name, 'package.json'), JSON.stringify({ name, version })));
  await mod('known', '1.0.0');
  await mod('@scope/also-known', '2.0.0');
  await writeFile(path.join(res, 'app', 'package.json'), '{}');
  await writeFile(path.join(res, 'THIRD-PARTY-NOTICES.txt'), 'x\nknown 1.0.0\nLicence: MIT\n\n@scope/also-known 2.0.0\nLicence: MIT\n');
  for (const f of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) await writeFile(path.join(dist, 'win-unpacked', f), '');
  assert.deepEqual(checkBuilt(dist), []);
  await mod('surprise', '0.0.1');
  await mkdir(path.join(res, 'app', 'node_modules', 'pdfjs-dist', 'standard_fonts'), { recursive: true });
  await writeFile(path.join(res, 'app', 'node_modules', 'pdfjs-dist', 'standard_fonts', 'LiberationSans-Regular.ttf'), '');
  const problems = checkBuilt(dist);
  assert.ok(problems.some((p) => /surprise 0\.0\.1 is in the app but not in its THIRD-PARTY-NOTICES/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /LiberationSans-\*\.ttf should have been left out/.test(p)), problems.join('\n'));
  assert.ok(problems.some((p) => /pdfjs-dist\/wasm\/\*\.wasm is missing/.test(p)) && problems.some((p) => /pdfjs-dist\/cmaps\/\*\.bcmap is missing/.test(p)), 'a build without the pdf.js decoders and character maps is refused');
});
