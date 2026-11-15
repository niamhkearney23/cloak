#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.txt: every open-source part shipped in the
// installer, with its version, licence and licence text.
//
//   node tools/third-party-notices.mjs            write local/THIRD-PARTY-NOTICES.txt
//   node tools/third-party-notices.mjs --check <dist folder>
//       after electron-builder has run: check that every package inside the
//       built app is named in the notices it carries, that the notices and
//       Electron's own licence files are in it, and that the files left out
//       on purpose are not.
//
// In the installed app the file is resources/THIRD-PARTY-NOTICES.txt
// (process.resourcesPath); when run from the source folder it is
// local/THIRD-PARTY-NOTICES.txt.
//
// The packages are found the way electron-builder finds them: the
// "dependencies" of package.json, then theirs, with optional dependencies
// that are installed (the canvas library's part for this system). Dev
// dependencies are not shipped and are not listed. The installer workflow
// runs this on each system before building, so each installer lists the
// parts for its own system. Nothing here uses the network.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const local = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(local, 'THIRD-PARTY-NOTICES.txt');
const LICENCE_FILE = /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i;

// Shipped packages whose files are left out of the installer on purpose
// (package.json "build.files"). pdf.js only reads its standard fonts when it
// is told where they are, and Cloak never tells it, so these GPL-licensed
// fonts are not needed. Keep this list and package.json in step (a test checks).
export const NOT_SHIPPED = [
  { pkg: 'pdfjs-dist', pattern: 'standard_fonts/LiberationSans-*.ttf' },
  { pkg: 'pdfjs-dist', pattern: 'standard_fonts/LICENSE_LIBERATION' },
];
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
const notShipped = (pkg, rel) => NOT_SHIPPED.some((x) => x.pkg === pkg && globRe(x.pattern).test(rel));

// Libraries compiled into binary files, which no package.json names. Each is
// listed only when its marker is found in the shipped file.
const TESSERACT_CORE = [
  { name: 'Tesseract OCR', licence: 'Apache-2.0', source: 'https://github.com/tesseract-ocr/tesseract', marker: /tesseract/i },
  { name: 'Leptonica', licence: 'BSD-2-Clause (Leptonica licence)', source: 'http://www.leptonica.org', marker: /leptonica/i },
  { name: 'libpng', licence: 'libpng-2.0', source: 'http://www.libpng.org/pub/png/libpng.html', marker: /built with libpng/ },
  { name: 'libjpeg (Independent JPEG Group)', licence: 'IJG', source: 'https://www.ijg.org', marker: /JPEG library/ },
  { name: 'LibTIFF', licence: 'libtiff', source: 'https://libtiff.gitlab.io/libtiff/', marker: /TIFFRead/ },
  { name: 'libwebp', licence: 'BSD-3-Clause', source: 'https://chromium.googlesource.com/webm/libwebp', marker: /VP8GetHeaders/ },
  { name: 'zlib', licence: 'Zlib', source: 'https://zlib.net', marker: /zlib/ },
];

// Standard texts for licences named by packages that ship no text of their own.
const STANDARD = {
  MIT: `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
  'BSD-2-Clause': `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  'BSD-3-Clause': `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`,
  ISC: `Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`,
  Zlib: `This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.`,
  libtiff: `Copyright (c) 1988-1997 Sam Leffler
Copyright (c) 1991-1997 Silicon Graphics, Inc.

Permission to use, copy, modify, distribute, and sell this software and
its documentation for any purpose is hereby granted without fee, provided
that (i) the above copyright notices and this permission notice appear in
all copies of the software and related documentation, and (ii) the names of
Sam Leffler and Silicon Graphics may not be used in any advertising or
publicity relating to the software without the specific, prior written
permission of Sam Leffler and Silicon Graphics.

THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND,
EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY
WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

IN NO EVENT SHALL SAM LEFFLER OR SILICON GRAPHICS BE LIABLE FOR
ANY SPECIAL, INCIDENTAL, INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER OR NOT ADVISED OF THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF
LIABILITY, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
OF THIS SOFTWARE.`,
};
const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const rule = (ch = '-') => ch.repeat(79);
const sha = (s) => createHash('sha256').update(s.replace(/\r\n?/g, '\n').trim()).digest('hex');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const sourceOf = (pkg) => {
  const r = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const url = (r || pkg.homepage || '').replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/');
  return /^[\w-]+\/[\w.-]+$/.test(url) ? `https://github.com/${url}` : url;
};
const licenceOf = (pkg) => (typeof pkg.license === 'string' ? pkg.license : pkg.license?.type || (pkg.licenses || []).map((l) => l.type || l).join(' OR ') || 'not stated');
const authorOf = (pkg) => (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || '').replace(/\s*<[^>]*>|\s*\([^)]*\)/g, '').trim();

/** Where Node would find package `name` when it is required from `fromDir`. */
function resolvePackage(name, fromDir) {
  for (let d = fromDir; ; d = path.dirname(d)) {
    const candidate = path.join(d, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (d === local || path.dirname(d) === d) return null;
  }
}

/** The packages shipped in the app: { name, version, dir, pkg, optional }, sorted by name. */
export function shippedPackages() {
  const root = readJson(path.join(local, 'package.json'));
  const found = new Map();
  const visit = (name, fromDir, optional) => {
    const dir = resolvePackage(name, fromDir);
    if (!dir) {
      if (optional) return; // an optional part for another system
      throw new Error(`${name} is a dependency but is not installed (run npm ci).`);
    }
    const real = path.resolve(dir);
    if (found.has(real)) return;
    const pkg = readJson(path.join(dir, 'package.json'));
    found.set(real, { name: pkg.name, version: pkg.version, dir, pkg, optional });
    for (const dep of Object.keys(pkg.dependencies || {})) visit(dep, dir, false);
    for (const dep of Object.keys(pkg.optionalDependencies || {})) visit(dep, dir, true);
  };
  for (const dep of Object.keys(root.dependencies || {})) visit(dep, local, false);
  for (const dep of Object.keys(root.optionalDependencies || {})) visit(dep, local, true);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

/** Licence files in a package, nested folders included (not node_modules), minus files left out of the installer. */
function licenceFiles(entry) {
  const out = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (name === 'node_modules') continue;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, r);
      else if (LICENCE_FILE.test(name) && st.size < 200000 && !notShipped(entry.name, r)) out.push(r);
    }
  };
  walk(entry.dir, '');
  // The package's own licence first, then the ones for parts inside it.
  return out.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}

function electronSection() {
  const dir = path.join(local, 'node_modules', 'electron');
  const version = readJson(path.join(dir, 'package.json')).version;
  const licence = readFileSync(path.join(dir, 'dist', 'LICENSE'), 'utf8').trim();
  return [
    `Electron ${version}`,
    'Licence: MIT',
    'Source: https://github.com/electron/electron',
    '',
    'Cloak runs on Electron, which includes Chromium, V8, Node.js, FFmpeg, ICU,',
    'BoringSSL and several hundred other libraries. Their notices are in',
    'LICENSES.chromium.html, installed with Cloak (Windows: in the Cloak',
    'installation folder; Mac: in Cloak.app/Contents/Resources). Electron\'s own',
    'licence is in LICENSE.electron.txt in the same place, and follows here.',
    '',
    licence,
  ].join('\n');
}

function canvasBinarySection(packages, warnings, mpl) {
  const lines = [];
  for (const entry of packages.filter((p) => /^@napi-rs\/canvas-/.test(p.name))) {
    const sbomFile = path.join(entry.dir, 'sbom.cdx.json');
    const binary = readdirSync(entry.dir).find((f) => f.endsWith('.node'));
    lines.push(`${entry.name} ${entry.version}: the compiled part of @napi-rs/canvas for this system${binary ? ` (${binary})` : ''}.`);
    if (!existsSync(sbomFile)) {
      warnings.push(`${entry.name} has no sbom.cdx.json: the libraries compiled into it are not listed.`);
      continue;
    }
    const sbom = readJson(sbomFile);
    const components = (sbom.components || []).filter((c) => c.type !== 'file');
    const skia = binary && /SkShaper|Skia/.test(readFileSync(path.join(entry.dir, binary)).toString('latin1'));
    lines.push(`It is built from the following, as listed in the package's own bill of materials (sbom.cdx.json).`, '');
    if (skia) lines.push('  Skia (graphics library, Google) - BSD-3-Clause - https://skia.org');
    for (const c of components) {
      const licence = (c.licenses || []).map((l) => l.license?.id || l.license?.name || l.expression).filter(Boolean).join(' OR ') || 'licence not stated in the bill of materials';
      const purl = c.purl || '';
      const source = purl.startsWith('pkg:cargo/') ? `https://crates.io/crates/${c.name}` : decodeURIComponent((purl.match(/repository_url=([^&]+)/) || [])[1] || '');
      const version = /^[0-9a-f]{40}$/.test(c.version || '') ? `commit ${c.version.slice(0, 12)}` : c.version || '';
      lines.push(`  ${c.name} ${version} - ${licence}${source ? ` - ${source}` : ''}`);
      if (/MPL/.test(licence) && !mpl.includes(c.name)) mpl.push(c.name);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function tesseractCoreSection(packages, warnings) {
  const entry = packages.find((p) => p.name === 'tesseract.js-core');
  if (!entry) return '';
  const wasm = readdirSync(entry.dir).filter((f) => f.endsWith('.wasm'));
  const text = wasm.map((f) => readFileSync(path.join(entry.dir, f)).toString('latin1')).join('\n');
  const lines = [`tesseract.js-core ${entry.version}: Tesseract compiled to WebAssembly (${wasm.join(', ')}).`, 'Built into those files:', ''];
  for (const lib of TESSERACT_CORE) {
    if (lib.marker.test(text)) lines.push(`  ${lib.name} - ${lib.licence} - ${lib.source}`);
    else warnings.push(`tesseract.js-core: could not confirm that ${lib.name} is built in; left out of the list.`);
  }
  return lines.join('\n');
}

export function buildNotices() {
  const app = readJson(path.join(local, 'package.json'));
  const packages = shippedPackages();
  const warnings = [];
  const seen = new Map(); // text hash -> where it first appeared
  const blocks = packages.map((entry) => {
    const { name, version, pkg } = entry;
    const licence = licenceOf(pkg);
    const files = licenceFiles(entry);
    const head = [rule(), `${name} ${version}`, `Licence: ${licence}`, `Source: ${sourceOf(pkg) || 'not stated'}`];
    const body = [];
    for (const rel of files) {
      const text = readFileSync(path.join(entry.dir, rel), 'utf8').replace(/\r\n?/g, '\n').trim();
      const key = sha(text);
      body.push('', `--- ${rel} ---`, seen.has(key) ? `(Same text as ${seen.get(key)}.)` : text);
      if (!seen.has(key)) seen.set(key, `${rel} of ${name}`);
    }
    if (!files.length) {
      const parent = name.match(/^(@napi-rs\/canvas)-/);
      if (parent) {
        body.push('', `This package has no licence file of its own. It is the compiled part of ${parent[1]}, from the same project under the same licence: see ${parent[1]} above.`);
      } else if (/^@tesseract\.js-data\//.test(name)) {
        body.push('', `This package has no licence file. Its package.json says ${licence}. The language data in it comes from the Tesseract project's tessdata (https://github.com/tesseract-ocr/tessdata), published under the Apache License 2.0 (text above, under pdfjs-dist).`);
      } else if (STANDARD[licence]) {
        const holder = authorOf(pkg);
        body.push('', `This package has no licence file. Its package.json says ${licence}; the standard ${licence} text follows${holder ? `, with the copyright holder named in package.json` : ''}.`, '', holder ? `Copyright (c) ${holder}` : 'Copyright (c) the authors of this package', '', STANDARD[licence]);
      } else {
        body.push('', `This package has no licence file. Its package.json says: ${licence}.`);
        warnings.push(`${name} ${version}: no licence file and no standard text for "${licence}".`);
      }
    }
    return [...head, ...body, ''].join('\n');
  });

  const nodeLicences = new Set(packages.map((p) => licenceOf(p.pkg)));
  const mpl = [];
  const binaries = [canvasBinarySection(packages, warnings, mpl), tesseractCoreSection(packages, warnings)].filter(Boolean).join('\n\n');
  const standardTexts = ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', 'libtiff'].map((id) => `--- ${id} ---\n\n${STANDARD[id]}`).join('\n\n');
  const platform = `${process.platform}-${process.arch}`;
  const text = [
    `THIRD-PARTY NOTICES FOR CLOAK ${app.version}`,
    rule('='),
    '',
    'Cloak includes the open-source software listed below. Each part keeps its own',
    'licence. This file gives each part\'s licence and the notices that licence asks',
    'for. Nothing here changes the terms on which Cloak itself is licensed.',
    '',
    `This copy was made by tools/third-party-notices.mjs from the packages installed`,
    `for ${platform}. Each installer is built with a copy made on its own system, so it`,
    'lists the parts for that system.',
    '',
    '1. Electron (the app\'s runtime)',
    `2. Packages shipped inside the app (${packages.length}): ${[...nodeLicences].sort().join(', ')}`,
    '3. Libraries compiled into binary files of those packages',
    '4. Standard licence texts',
    '',
    rule('='),
    '1. ELECTRON',
    rule('='),
    '',
    electronSection(),
    '',
    rule('='),
    '2. PACKAGES SHIPPED INSIDE THE APP',
    rule('='),
    '',
    ...blocks,
    rule('='),
    '3. LIBRARIES COMPILED INTO BINARY FILES',
    rule('='),
    '',
    'These libraries are inside binary files of the packages above. Most of them are',
    'also part of Chromium, and their licence texts are in LICENSES.chromium.html.',
    'For the others, the standard texts are in section 4 and each project\'s own',
    'copyright notice is at the address given.',
    '',
    binaries,
    '',
    'Portions of this software are copyright (c) The FreeType Project',
    '(www.freetype.org). All rights reserved.',
    'This software is based in part on the work of the Independent JPEG Group.',
    '',
    rule('='),
    '4. STANDARD LICENCE TEXTS',
    rule('='),
    '',
    'For parts above whose licence is named but whose text is not given with them.',
    'The Apache License 2.0 text is given in full under pdfjs-dist in section 2.',
    ...(mpl.length ? [`The Mozilla Public License 2.0, under which ${andList(mpl)} ${mpl.length === 1 ? 'is' : 'are'} published`, '(section 3; the source is at the crates.io address given there), is in', 'LICENSES.chromium.html and at https://www.mozilla.org/MPL/2.0/.'] : []),
    '',
    standardTexts,
    '',
  ].join('\n');
  return { text, packages, warnings };
}

/** After electron-builder: check the built app against its notices. Returns a list of problems. */
export function checkBuilt(distDir) {
  const problems = [];
  const apps = [];
  for (const name of existsSync(distDir) ? readdirSync(distDir) : []) {
    const d = path.join(distDir, name);
    if (!statSync(d).isDirectory()) continue;
    if (existsSync(path.join(d, 'resources', 'app', 'package.json'))) apps.push({ root: d, resources: path.join(d, 'resources'), licences: d });
    for (const sub of readdirSync(d).filter((x) => x.endsWith('.app'))) {
      const res = path.join(d, sub, 'Contents', 'Resources');
      if (existsSync(path.join(res, 'app', 'package.json'))) apps.push({ root: path.join(d, sub), resources: res, licences: res });
    }
  }
  if (!apps.length) return [`No built app found in ${distDir}.`];
  for (const a of apps) {
    // In the resources folder: electron-builder keeps an extra resource out of the app folder itself.
    const notices = path.join(a.resources, 'THIRD-PARTY-NOTICES.txt');
    if (!existsSync(notices)) { problems.push(`${notices} is missing.`); continue; }
    for (const f of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) if (!existsSync(path.join(a.licences, f))) problems.push(`${f} is missing from ${a.licences}.`);
    const text = readFileSync(notices, 'utf8');
    const modules = path.join(a.resources, 'app', 'node_modules');
    const walk = (dir) => {
      for (const name of existsSync(dir) ? readdirSync(dir) : []) {
        const d = path.join(dir, name);
        if (name.startsWith('@')) { walk(d); continue; }
        const pj = path.join(d, 'package.json');
        if (!existsSync(pj)) continue;
        const { name: n, version: v } = readJson(pj);
        if (!text.includes(`\n${n} ${v}\n`)) problems.push(`${n} ${v} is in the app but not in its THIRD-PARTY-NOTICES.txt.`);
        walk(path.join(d, 'node_modules'));
      }
    };
    walk(modules);
    // pdf.js reads fax, JBIG2 and JPEG 2000 pictures and Chinese character maps from these folders; without them such pages come out empty.
    for (const [sub, ext] of [['wasm', '.wasm'], ['cmaps', '.bcmap']]) {
      const dir = path.join(modules, 'pdfjs-dist', sub);
      if (!existsSync(dir) || !readdirSync(dir).some((f) => f.endsWith(ext))) problems.push(`pdfjs-dist/${sub}/*${ext} is missing from the app, so some scanned or Chinese PDF pages could not be read.`);
    }
    for (const x of NOT_SHIPPED) {
      const dir = path.join(modules, x.pkg, path.dirname(x.pattern));
      const hit = existsSync(dir) && readdirSync(dir).some((f) => globRe(path.basename(x.pattern)).test(f));
      if (hit) problems.push(`${x.pkg}/${x.pattern} should have been left out of the app.`);
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--check') {
    const problems = checkBuilt(path.resolve(process.argv[3] || path.join(local, 'dist')));
    for (const p of problems) console.error(`notices: ${p}`);
    if (problems.length) process.exit(1);
    console.log('notices: every package in the built app is named in its THIRD-PARTY-NOTICES.txt.');
  } else {
    const { text, packages, warnings } = buildNotices();
    writeFileSync(OUT, text);
    for (const w of warnings) console.error(`notices: warning: ${w}`);
    console.log(`Wrote ${OUT}: ${packages.length} packages.`);
  }
}
