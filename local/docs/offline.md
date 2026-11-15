# Offline: every part of Cloak, and how it is kept off the network

The owner's rule: nothing leaves the machine. Cloak makes no network connection
of any kind: no telemetry, no licence server, no online activation, no online
update, no crash reporting, no web fonts. This page lists every part that runs,
whether it could use the network, and what stops it. It also flags the
licences that need a decision before Cloak is sold as a closed-source product.

## What stops network use

**In the window (Chromium)**, set in `app/main.js`:

1. Only the app's own files load. Every other request from the window is
   cancelled before it reaches the network (`webRequest.onBeforeRequest`), and
   the page's Content Security Policy allows nothing outside the app.
2. Every name lookup fails: `host-resolver-rules=MAP * ~NOTFOUND`. This also
   covers requests Chromium makes on its own, outside the window, and even a
   proxy given as an IP address (seen in testing: the proxy `127.0.0.1` was
   mapped to "not found").
3. Chromium's background services are off: background networking, component
   updates, sync, pings, autofill server, optimisation hints, media router,
   translate, feed suggestions.
4. **The spell checker is off for the whole session.** Found while writing the
   network test: at start Chromium tried to download a spell-check dictionary
   from `redirector.gvt1.com`, from outside the window, although spell checking
   was off in the window. Rule 2 stopped it before any connection; now it is
   never tried.
5. Permission requests are refused, new windows are refused, navigation away
   from the app is blocked.
6. No auto-update. Electron's crash reporter is never started (Electron makes a
   `Crashpad` folder holding a random ID; no crash handler runs and nothing is
   uploaded: checked on Linux).

**In Node (the main process, the file-reading threads and the OCR threads):**
Cloak's own code imports no network module (a test reads every source file to
check). The libraries that could use the network are only ever given local
files and in-memory data (table below). Node's network functions are **not**
switched off inside the installed app: this rests on how the libraries are
called, and on the tests.

**The tests** (all run with `npm test`; the window ones need a display):

- `test/offline.test.js`: a whole cloak of the made-up 20-file matter (Word,
  Excel, PDF, scans through OCR, emails, a picture) with a tripwire
  (`test/net-tripwire.cjs`) loaded into every thread. Any use of fetch, http,
  https, http2, sockets, UDP, DNS or WebSocket is recorded and refused. The
  record must hold only two attempts made on purpose at the end, which shows
  the tripwire was armed.
- `test/app.test.js`, Licence screen test: the real window runs with Chromium's
  network log on and the tripwire in the main process. The log must show no web
  request, name lookup, socket or connection. This is the test that found the
  dictionary download.
- `test/app.test.js`, first test: a request from the window to a web address is
  refused.
- `test/folder.test.js`: no source file in `local/` uses a network module,
  `fetch`, `XMLHttpRequest` or `WebSocket`.

## Every part that runs

| Part | Version | Licence | What it does | Could it use the network? | What keeps it offline |
| --- | --- | --- | --- | --- | --- |
| Electron (Chromium, V8, Node.js, FFmpeg, ICU, BoringSSL and others) | 33.4.11 | MIT; Chromium's parts under their own licences (`LICENSES.chromium.html`) | The window and the JavaScript engine | Yes: it contains a web browser and Node.js | Everything in "What stops network use" |
| pdfjs-dist (pdf.js) | 6.5.438 | Apache-2.0 | Reads PDFs, draws pages for OCR | Only if given a web address for the PDF or for its resources | The PDF is passed as bytes. Its decoders (`wasm/`) and character maps (`cmaps/`) are given as folders on disk, which pdf.js reads with `fs.readFile` in Node. PDF JavaScript is off (`isEvalSupported: false`) |
| pdf.js decoders: JBIG2 and fax (from PDFium), JPEG 2000 (OpenJPEG), colour (qcms), QuickJS | bundled | BSD-3-Clause and Apache-2.0 (PDFium), BSD-2-Clause (OpenJPEG), MIT (qcms, QuickJS) | Decode scanned pictures | No: WebAssembly can only do what the code around it allows | - |
| tesseract.js | 7.0.0 | Apache-2.0 | OCR | Yes: with no language folder given it downloads language data from cdn.jsdelivr.net; it downloads a picture given as a web address | Cloak always gives a language folder on disk (copied from the app's own files to the temp folder) and passes pictures as in-memory data |
| tesseract.js-core | 7.0.0 | Apache-2.0 (built in: Tesseract Apache-2.0, Leptonica BSD-2-Clause, libpng, IJG libjpeg, LibTIFF, libwebp, zlib) | The OCR engine, in WebAssembly | Its loader can fetch its own `.wasm` file in a browser; in Node it reads it from disk | Runs under Node |
| @tesseract.js-data: eng, msa, chi_sim, chi_tra, tam | 1.0.0 | MIT (package); the data is Google's tessdata, Apache-2.0 | OCR language data | No (data files) | - |
| @napi-rs/canvas (and its part for each system) | 1.1.0 | MIT (built in: Skia BSD-3-Clause and about 140 libraries, listed in the notices) | Pictures for OCR, pages drawn by pdf.js | Its `loadImage` downloads a picture given as a web address | Cloak passes only in-memory data |
| @kenjiuno/msgreader, @kenjiuno/decompressrtf | 1.29.0, 0.1.4 | Apache-2.0, BSD-2-Clause | Outlook `.msg` files | No | - |
| iconv-lite, safer-buffer | 0.6.3, 2.1.2 | MIT | Text encodings for emails | No | - |
| node-fetch, whatwg-url, tr46, webidl-conversions | 2.7.0, 5.0.0, 0.0.3, 3.0.1 | MIT, MIT, MIT, BSD-2-Clause | Shipped because tesseract.js lists node-fetch | Yes, node-fetch is a web client | Only tesseract.js would call it, for a web address, and Cloak never gives one. (tesseract.js uses Node's own `fetch` first, so node-fetch is not even loaded) |
| is-url, bmp-js, zlibjs, regenerator-runtime, wasm-feature-detect, idb-keyval | various | MIT; Apache-2.0 (idb-keyval, wasm-feature-detect) | Small helpers of tesseract.js (`idb-keyval` is for browsers and is not used under Node) | No | - |
| opencollective-postinstall | 2.0.3 | MIT | Prints a "please donate" message when a developer installs tesseract.js | No, and it never runs in the installed app | - |

The full list with licence texts is `THIRD-PARTY-NOTICES.txt`, made by
`node tools/third-party-notices.mjs` (see "Third-party notices" below).

## Licences to decide on before selling

No shipped part is under the GPL or AGPL. The points that need a decision or a
lawyer's look:

1. **The JBIG2 decoder in pdf.js is not the AGPL one.** pdf.js 6 ships a JBIG2
   decoder as WebAssembly. Its licence file is PDFium's (BSD-3-Clause, plus
   Apache-2.0), and the code inside `jbig2.wasm` is PDFium's (its class names,
   `CJBig2_GRDProc` and `fxcodec`, are there), not Artifex's jbig2dec, which is
   AGPL. No problem, but worth knowing if anyone asks.
2. **GPL fonts left out.** pdf.js ships the Liberation Sans fonts under the GPL
   version 2 with a font exception. Cloak never uses them (pdf.js reads its
   standard fonts only when told where they are, and Cloak never tells it), so
   the installer leaves them out and the notices do not list them. Anyone who
   later gives pdf.js `standardFontDataUrl` must look at that licence first.
3. **FFmpeg inside Electron is LGPL-2.1.** It is a separate library file
   (`ffmpeg.dll` or `libffmpeg`), as in every Electron app. The usual
   obligations: keep its notice (it is in `LICENSES.chromium.html`), do not
   change it or build it into another file, and be able to point to its source
   (Electron publishes it). Low risk; no action beyond keeping the notices.
4. **MPL-2.0 inside the canvas library.** `cssparser`, `cssparser-macros`,
   `dtoa-short` and `selectors` are compiled into `@napi-rs/canvas`'s binary.
   MPL-2.0 applies file by file: using it unchanged in a closed product is
   allowed, provided people are told where the source is (the notices give the
   crates.io addresses).
5. **Copyright lines for libraries inside binaries.** The canvas library's bill
   of materials gives each library's licence but not its copyright line, and
   Tesseract's WebAssembly comes with no list at all (the notices list what was
   confirmed inside the file). The notices give the standard licence texts and
   point to `LICENSES.chromium.html`, which has the full texts for most of these
   libraries (Chromium uses them too). Leptonica and libjxl get only the
   standard BSD text, without their own copyright line. A reviewing lawyer may
   ask for the exact lines; they can be taken from each project's source.
6. **The language data.** The `@tesseract.js-data` packages say MIT; the data
   in them comes from Google's tessdata, under Apache-2.0. Both are permissive;
   the notices say both.
7. **Electron and Chromium** are used by many commercial closed-source programs
   under these licences. Keep `LICENSE.electron.txt` and `LICENSES.chromium.html`
   with the app: Windows installs them next to `Cloak.exe`; for the Mac they
   were missing (electron-builder deletes them there) and are now put in
   `Cloak.app/Contents/Resources`.

## Third-party notices

- `local/THIRD-PARTY-NOTICES.txt` is made by `node tools/third-party-notices.mjs`
  from the packages actually installed: the dependencies of `package.json` and
  theirs, with the optional part for the system it runs on, the same way
  electron-builder chooses what to ship. Dev tools are not shipped and not
  listed.
- The installer workflow makes it again on each system just before building,
  so each installer lists the parts for its own system, then runs
  `node tools/third-party-notices.mjs --check dist`, which fails the build if
  any package inside the built app is missing from its notices, if Electron's
  licence files are missing, or if the Liberation fonts are present.
- In the installed app it is `resources/THIRD-PARTY-NOTICES.txt` (Windows:
  `<install folder>\resources\`; Mac: `Cloak.app/Contents/Resources/`), found
  in code at `path.join(process.resourcesPath, 'THIRD-PARTY-NOTICES.txt')`, or
  `local/THIRD-PARTY-NOTICES.txt` when run from the source folder. (It cannot
  also be inside `resources/app`: electron-builder keeps extra resources out of
  the app folder.)
- `test/notices.test.js` checks the generator, that the committed file names
  every shipped package (except the per-system canvas part), and the installer
  settings.
- Run it again after any change to the dependencies, and commit the result.

## Limits

- The network log and tripwire tests run on Linux. Chromium on Windows and Mac
  may have other background services. The blocking rules above apply there
  too, but it has not been watched on those systems: IT can check with a
  firewall rule (`it-deployment.md`).
- Node's network functions are not switched off at run time in the installed
  app. A future version of a library that decided to go online on its own would
  only be caught by the tests (which run before every installer build) or by a
  firewall. Shipping a guard like the test tripwire inside the app would close
  that; it is not done.
- The operating system is outside Cloak: SmartScreen and Gatekeeper check a
  downloaded installer once, Windows Error Reporting and macOS may send crash
  reports if the computer allows it, and antivirus cloud features follow their
  own settings (`it-deployment.md`).
- Before this work, pdf.js could not decode fax, JBIG2 or JPEG 2000 pictures in
  scanned PDFs, or Chinese text written with Adobe's standard character maps:
  such pages came out empty, were counted as read, and raised no warning. Fixed
  (`extract.js` now gives pdf.js its decoder and character-map folders); see
  `test/pdf-decoders.test.js`. Matters cloaked earlier with version 0.1.0 may
  still hold the old readings in their cache, because the cache is keyed to the
  version number: give the next build a new version number, or clear those
  matters' caches.
