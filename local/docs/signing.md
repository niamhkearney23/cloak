# Signing the installers

**Status: ready, not tested.** The workflow signs when the signing secrets are
set and builds unsigned, exactly as before, when they are not. No certificate
was available while this was written, so no signed or notarised build has ever
run. Expect the first signed build to need a small fix or two.

## Why sign

- **Windows**, unsigned: "Windows protected your PC ... Unknown publisher" when
  the installer is opened, and many firms' security tools (Defender attack
  surface rules, AppLocker, other endpoint tools) block unsigned programs
  outright.
- **Mac**, not notarised: "Cloak cannot be opened because Apple cannot check it
  for malicious software". People can get past it (System Settings, Privacy &
  Security, Open Anyway), but law firm IT will not want them to.

Signing proves who made the installer and that nobody changed it. It does not
send anything from Cloak: the signature is checked by Windows or macOS.

## What to buy

Prices are rough (late 2026) and change often; check them when buying.

### Windows: a code-signing certificate

- **Two kinds.** OV (organisation validated), roughly US$200 to US$500 a year,
  and EV (extended validation), roughly US$300 to US$900 a year. The issuer
  checks the company (SSM registration, address, a phone call); allow one to
  three weeks. Buy it in the name of the company that sells Cloak; that name
  is what Windows shows as the publisher.
- **OV is usually enough.** Microsoft's SmartScreen warning fades as a signed
  program builds a reputation. Microsoft has said that EV certificates no
  longer skip that reputation building, so EV costs more without removing the
  first warnings.
- **The key must be on hardware.** Since June 2023 the private key of any new
  public code-signing certificate (OV or EV) must be kept on a certified USB
  token or in a cloud signing service. You will not be given a `.pfx` file to
  upload to a build server. This matters for how the signing is done:

| How | Works with the workflow as it is? | Notes |
| --- | --- | --- |
| A `.pfx` file in `WIN_CSC_LINK` | Yes | Only for a certificate issued as a file: one bought before June 2023, or a self-signed test certificate (Windows will still warn about a self-signed one). |
| USB token | No: GitHub's build machines cannot reach a token | Build on a Windows PC with the token plugged in (`npm ci`, then `npx electron-builder --win`, with `win.signtoolOptions.certificateSubjectName` set to the certificate's name). |
| Cloud signing from the certificate issuer (for example DigiCert KeyLocker, SSL.com eSigner, Sectigo or Certum cloud signing) | Needs a few provider-specific lines | Usually a monthly or per-signature fee on top of the certificate. The provider's tool is installed on the build machine and called from electron-builder's `win.signtoolOptions.sign` hook. |
| Microsoft Azure Trusted Signing | Needs configuration (electron-builder supports it) | About US$10 a month. It was open only to companies in some countries; check whether a Malaysian company can sign up. electron-builder reads `win.azureSignOptions` (`endpoint`, `certificateProfileName`, `codeSigningAccountName`, `publisherName`) and the secrets `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`. |

The owner must choose one of these; the last two need a small workflow change
once the provider is known.

### Mac: the Apple Developer Program

- **US$99 a year** (Apple may charge the equivalent in ringgit). Enrol as an
  organisation, not an individual, so the company name is what macOS shows.
  Organisation enrolment needs a D-U-N-S number (free from Dun & Bradstreet;
  it can take one to two weeks).
- The account holder creates a **Developer ID Application** certificate
  (developer.apple.com, Certificates). Only that type works for apps given out
  outside the App Store.
- Notarisation (Apple's automatic check, needed for macOS to open the app
  without warnings) uses an Apple Account on the team, an app-specific password
  for it, and the Team ID.

## Where to put the secrets

GitHub, the repository, **Settings, Secrets and variables, Actions, New
repository secret**. Give each one exactly this name:

| Secret | What to put in it |
| --- | --- |
| `WIN_CSC_LINK` | The Windows certificate as a `.pfx` file, base64 encoded (see below) |
| `WIN_CSC_KEY_PASSWORD` | The password of that `.pfx` file |
| `CSC_LINK` | The Mac Developer ID Application certificate exported from Keychain Access as a `.p12` file, base64 encoded |
| `CSC_KEY_PASSWORD` | The password chosen when exporting the `.p12` |
| `APPLE_ID` | The Apple Account email used for notarisation |
| `APPLE_APP_SPECIFIC_PASSWORD` | An app-specific password for that account (account.apple.com, Sign-In and Security, App-Specific Passwords) |
| `APPLE_TEAM_ID` | The team's ID (developer.apple.com, Account, Membership details) |

Windows uses `WIN_CSC_LINK` rather than `CSC_LINK` because the two systems need
different certificates: electron-builder reads `WIN_CSC_*` for a Windows-only
certificate, and the workflow never offers the Mac certificate to the Windows
build. If only `CSC_LINK` is set, the Windows build stays unsigned and the run
says why.

To base64 encode a certificate file:

- Mac: `base64 -i DeveloperID.p12 | pbcopy`, then paste into the secret.
- Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx")) | Set-Clipboard`

GitHub never shows a secret again after it is saved, and does not give secrets
to runs started from forks. electron-builder also skips signing for pull
requests.

## What the workflow does

`.github/workflows/desktop-installer.yml`, step "Build the installer":

- **No secrets:** exactly the old unsigned build (`CSC_IDENTITY_AUTO_DISCOVERY=false`),
  with a note in the run saying it is unsigned.
- **Windows, `WIN_CSC_LINK` set:** electron-builder signs `Cloak.exe`, the
  installer and the uninstaller (SHA-256, with a timestamp from DigiCert's
  timestamp server, so signatures stay valid after the certificate expires).
  The next step checks every `.exe` with `Get-AuthenticodeSignature` and fails
  the run if one is not validly signed.
- **Mac, `CSC_LINK` set:** electron-builder signs the app with the hardened
  runtime and its standard Electron entitlements (JIT and unsigned executable
  memory for V8 and the WebAssembly OCR engine; library validation off). With
  all three `APPLE_*` secrets it then sends the app to Apple for notarisation
  and staples the ticket. Without all three it signs but does not notarise,
  and says so. The next step runs `codesign --verify`, `spctl --assess` and
  `stapler validate`.
- In both cases the third-party notices are made on that machine first and
  checked against the built app afterwards.

The timestamp and notarisation steps use the network **on GitHub's build
machine**, never on a firm's computer.

## Checking a signed copy

- Windows: right-click the installer or `Cloak.exe`, Properties, Digital
  Signatures; or in PowerShell `Get-AuthenticodeSignature '.\Cloak Setup 0.1.0.exe'`.
- Mac: `codesign -dv --verbose=4 /Applications/Cloak.app` and
  `spctl -a -vv /Applications/Cloak.app` (should say `source=Notarized Developer ID`).

## Not done, and things to know

- **Never run with a real certificate.** The secret handling was run locally
  for every combination of secrets; the electron-builder settings were
  validated by a local Linux build. Signing, timestamping, notarisation and the
  verification steps have not run.
- **Cloud or token signing for Windows** (the likely case for a new
  certificate) needs a few more lines once a provider is chosen; see the table
  above.
- **Intel Macs:** the Mac installer is built on GitHub's Apple Silicon machine,
  so it runs on Apple Silicon Macs only. Firms with Intel Macs need an extra
  x64 (or universal) build, which needs the x64 part of the canvas library
  installed on the build machine. Not done.
- **Hardening:** the installed program can still be started as plain Node.js
  (`ELECTRON_RUN_AS_NODE`). Some security tools flag signed programs that can
  do that. Turning it off needs Electron "fuses" (electron-builder 26, or
  `@electron/fuses` in an `afterPack` step). Not done.
- The installer is NSIS and keeps electron-builder's default look (no Cloak
  icon is set; the Electron icon is used).
