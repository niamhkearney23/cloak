import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, stat, truncate, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The OCR language data is copied into a folder in temp that every reader
// thread, and every Cloak process, shares. Each case reads a made-up picture in
// a child process with a temp folder of its own, and checks both the text and
// what the text reader printed: a language that failed to load ("Failed loading
// language 'msa'") still lets English through, so the text alone can look fine.

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const READ_ONE = `
const { ocrImage, closeOcr } = await import(${JSON.stringify(pathToFileURL(path.join(here, '..', 'extract.js')).href)});
const { png } = await import(${JSON.stringify(pathToFileURL(path.join(here, 'matter.js')).href)});
try { const r = await ocrImage(png(['MADE-UP RECEIPT', 'Paid to Example Trading', 'Total RM 120.00'])); console.log('TEXT:' + r.text.replace(/\\s+/g, ' ')); }
catch (err) { console.log('FAILED:' + err.message); }
await closeOcr();`;

function readInTemp(tmp) {
  return new Promise((resolve) => {
    execFile(process.execPath, ['--input-type=module', '-e', READ_ONE], { env: { ...process.env, TMPDIR: tmp, TEMP: tmp, TMP: tmp }, timeout: 120000 }, (err, stdout, stderr) => resolve(`${stdout}\n${stderr}${err ? `\n${err.message}` : ''}`));
  });
}
const healthy = (out) => /TEXT:.*RECEIPT/i.test(out) && !/Failed loading|Error opening data file|FAILED:/.test(out);
const langSource = (l) => path.join(path.dirname(require.resolve(`@tesseract.js-data/${l}/package.json`)), '4.0.0', `${l}.traineddata.gz`);

test('a language file left half-copied in the shared folder is copied again, not loaded half', { timeout: 180000 }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'cloak-ocrlang-'));
  const dir = path.join(tmp, 'cloak-ocr-lang');
  await mkdir(dir);
  for (const l of ['eng', 'msa']) {
    await copyFile(langSource(l), path.join(dir, `${l}.traineddata.gz`));
    await truncate(path.join(dir, `${l}.traineddata.gz`), Math.floor((await stat(langSource(l))).size / 2));
  }
  const out = await readInTemp(tmp);
  assert.ok(healthy(out), out);
  for (const l of ['eng', 'msa']) assert.equal((await stat(path.join(dir, `${l}.traineddata.gz`))).size, (await stat(langSource(l))).size, `${l} copied again in full`);
});

test('a half-written unpacked language file in the shared folder is not used', { timeout: 180000 }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'cloak-ocrlang-'));
  const dir = path.join(tmp, 'cloak-ocr-lang');
  await mkdir(dir);
  // What an earlier version left behind when it stopped while writing its cache.
  await writeFile(path.join(dir, 'eng.traineddata'), Buffer.alloc(4096, 1));
  await writeFile(path.join(dir, 'msa.traineddata'), Buffer.alloc(4096, 1));
  const out = await readInTemp(tmp);
  assert.ok(healthy(out), out);
});

test('readers starting at the same moment on an empty folder all load their languages in full', { timeout: 240000 }, async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'cloak-ocrlang-'));
  const outs = await Promise.all(Array.from({ length: 4 }, () => readInTemp(tmp)));
  outs.forEach((out, i) => assert.ok(healthy(out), `reader ${i + 1}:\n${out}`));
  // Only whole language files are left: no half copies, and no unpacked copies written by the text reader.
  assert.deepEqual((await readdir(path.join(tmp, 'cloak-ocr-lang'))).sort(), ['chi_sim', 'chi_tra', 'eng', 'msa', 'tam'].map((l) => `${l}.traineddata.gz`));
});
