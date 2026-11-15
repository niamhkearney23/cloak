# The Cloak licence

## In short

- A licence is a small text file. It names the firm, the number of seats, the
  date it was issued, the date it ends and a licence ID, and it carries the
  vendor's digital signature (Ed25519).
- Cloak checks the licence on the firm's own computer, with the vendor's
  public key built into the app. Nothing is sent anywhere. There is no
  activation, no licence server and no "phone home".
- **No licence, or one that has ended: an evaluation copy.** Everything works,
  but cloaked copies can be exported only from matters ticked "This matter
  holds made-up test documents only". This is a check of its own: it holds
  whatever the double checker or any other check says.
- **Restoring a draft always works**, with or without a licence, so a firm is
  never locked out of its own real values.
- With a licence, the window bar says "Licensed to *firm*", and every export
  report (`cloak-report.json`) names the licensee and the licence ID.
- **Seats are shown, not enforced.** Cloak does not count computers or users.

## For the firm

**Adding the licence.** On the home screen, choose **Licence** (at the bottom,
next to "Change name"). Paste the licence text, from `BEGIN CLOAK LICENCE` to
`END CLOAK LICENCE`, or choose the licence file. Cloak shows who it is licensed
to, the licence ID, the seats, and when it ends. A licence that has been
changed, that belongs to another copy of Cloak, or that has ended is refused,
with the reason.

**Where it is kept.** In the person's own user folder on that computer
(`licence.txt` in Cloak's user-data folder: see `it-deployment.md`). IT can
instead put one licence on a computer for every user; see "Licence for
everyone" in `it-deployment.md`. A person's own licence is used first if it is
valid.

**Renewing.** Add the new licence the same way; it replaces the old one.

**When it ends.** Cloak becomes an evaluation copy again: cloaked copies can be
exported only from test matters. Nothing is deleted and drafts can still be
restored. The Licence screen shows a warning in the last 30 days.

**Removing it.** The Licence screen has "Remove the licence from this
computer" (for a licence the person added; a licence IT installed for everyone
is removed by IT).

## For the vendor: once, before building Cloak for sale

The repository's `licence-key.js` holds a **development key**. Its private half
was thrown away when it was made, so no licence can ever be issued for a copy
built with it: such a copy always runs as an evaluation copy, and its Licence
screen says "built for testing". Replace it with your own key before you build
for sale.

1. **Make your key pair**, in a folder outside any git repository (the tool
   refuses a folder inside one, and never overwrites a key):

   ```
   export CLOAK_LICENCE_PASSPHRASE='a long passphrase'   # encrypts the private key (recommended)
   node tools/licence.mjs keygen /path/outside/the/repo
   ```

   This makes `cloak-licence-private.pem` (keep it secret) and
   `cloak-licence-public.pem`, and prints the key's fingerprint.

2. **Build your public key into Cloak**:

   ```
   node tools/licence.mjs use-key /path/outside/the/repo/cloak-licence-public.pem
   ```

   This rewrites `local/licence-key.js` (it refuses a private key). Commit it:
   a public key is not secret.

3. **Build the installers** (see `signing.md`) and check one: the Licence screen
   must not say "built for testing", and a licence you issue must be accepted.

4. **Keep the private key safe.** Anyone who has it can make licences. Keep it
   offline (an encrypted USB drive, or a password manager that stores files),
   with a second copy somewhere else, and the passphrase stored separately.
   - If it is **lost**, you cannot issue licences for the copies already sold.
     You would have to make a new key, ship a new build, and give every firm a
     new licence.
   - If it is **stolen**, anyone can make licences for copies built with that
     key. Make a new key, ship a new build, and reissue licences.

## Issuing a licence

```
node tools/licence.mjs issue --key /path/outside/the/repo/cloak-licence-private.pem \
  --firm "Tetuan Contoh & Rakan" --seats 10 --expires 2027-11-30 --out contoh.licence.txt
node tools/licence.mjs check contoh.licence.txt --key /path/outside/the/repo/cloak-licence-public.pem
```

`--issued` defaults to today; `--id` defaults to `CL-<date>-<6 random hex digits>`.
Keep a register of the licences you issue (firm, ID, seats, end date).

Send the file to the firm as an attachment. It is not secret in the way a key
is (it cannot make other licences), but it does work on any copy of Cloak
built with your key, so treat it like a product key. Cloak copes with a
licence pasted from an email that quoted it with `>` or wrapped its lines; a
changed readable line (for example "Seats") makes it invalid.

## Limits (please read)

- **It keeps an honest firm honest; it is not copy protection.** The check runs
  in plain JavaScript inside the installed program folder (the app is not
  packed into an archive). Someone with administrator rights and some skill
  could edit it out, or run Cloak's reading engine directly: the installed
  program can be started as plain Node.js (Electron's `ELECTRON_RUN_AS_NODE`).
  Turning that off needs Electron "fuses", which the electron-builder version
  used here (25) cannot set; electron-builder 26, or `@electron/fuses` in an
  `afterPack` step, can.
- **The computer's clock is trusted.** Setting the clock back keeps an ended
  licence running. Cloak cannot check the date online, by design.
- **No revocation.** A licence works until its end date. Issue licences for a
  year at a time, not "for ever".
- **Seats are not counted.** The same file works on any number of computers.
  The licence names the firm, and every export report names the licensee and
  the licence ID, so a licence lent to another firm shows up in that firm's
  reports.
- **The evaluation limit is on export only.** Reading, review, the chronology
  and restoring drafts all work without a licence.
- `cloak-report.json` in each export now names the licensee (the law firm, not
  any client). A firm that does not want its own name to reach an AI tool
  should not upload the report file.

## The file

```
-----BEGIN CLOAK LICENCE-----
Product: Cloak
Licensed to: Tetuan Contoh & Rakan
Seats: 10
Issued: 15 Nov 2026
Expires: 30 Nov 2027
Licence ID: CL-20261115-7F3A9C

Data:
eyJwcm9kdWN0IjoiQ2xvYWsiLCJmb3JtYXQiOjEsImlkIjoiQ0wtMjAyNjExMTUt...
Signature:
3oNw9...
-----END CLOAK LICENCE-----
```

- `Data` is the JSON details in base64url: `product`, `format` (1), `id`,
  `firm`, `seats`, `issued` and `expires` (YYYY-MM-DD; the licence runs to the
  end of the `expires` day, by the computer's own date), and `key` (the
  fingerprint of the signing key).
- `Signature` is Ed25519 over `cloak-licence-v1\n` followed by the details.
- The readable lines at the top are for people. They must match the signed
  details or the licence is refused.

## For developers

- `licence.js`: `checkLicence`, `findLicence`, `issueLicence`,
  `assertLicenceAllowsExport`, `licenceForReport`, `licenceView`.
- `matter.js`: `Session.export` calls `assertLicenceAllowsExport` after the
  test-matter rule (error code `EVALUATION_TEST_MATTERS_ONLY`). `session.licence`
  is set by `app/main.js` from the licence on the computer just before each
  export; when it is not set the session is an evaluation copy. **A test that
  exports a matter that is not a test matter must give the session a licence**:
  make a key with `generateKeyPairSync('ed25519')`, issue a licence with
  `issueLicence`, and set `session.licence = checkLicence(text, { publicKey })`
  (see `test/licence.test.js`).
- `app/main.js`: the licence section. An installed copy always uses
  `licence-key.js`; only a copy run from the source folder accepts a test key in
  `CLOAK_TEST_LICENCE_KEY`.
- Tests: `test/licence.test.js` (valid, changed, ended, other key, not a
  licence, email-mangled text, user then machine licence, the evaluation rule,
  report fields, restore without a licence, the vendor tool) and the Licence
  screen test in `test/app.test.js`.
