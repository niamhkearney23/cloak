# Installing Cloak across a firm: notes for IT

Cloak runs entirely on the lawyer's own computer. It needs no server, no
account, no licence server and no internet connection, and it makes no network
connection of any kind (see `offline.md`, and "Checking that Cloak makes no
network connection" below).

## What is installed

| | Windows | Mac |
| --- | --- | --- |
| Installer | `Cloak Setup <version>.exe` (NSIS) | `Cloak-<version>-arm64.dmg` |
| Installed size | about 0.5 GB, about 760 files | about 0.5 GB |
| For one user (default, no admin rights) | `%LOCALAPPDATA%\Programs\Cloak` | drag to `~/Applications` |
| For everyone on the computer (admin) | `C:\Program Files\Cloak` | drag to `/Applications` |
| Runs on | Windows 10 or 11, 64-bit (x64; Windows on Arm runs it through emulation, more slowly) | Apple Silicon Macs (M1 or later) only: there is no Intel build yet |

The installers are **not code-signed yet** (see `signing.md`): Windows shows
"Unknown publisher" and macOS refuses to open the app until they are.

## Windows: silent install and uninstall

The installer asks "anyone who uses this computer" or "only for me" (the
default). From the command line:

| | Command |
| --- | --- |
| Install for the current user, silently | `"Cloak Setup 0.1.0.exe" /S` |
| Install for every user, silently (run elevated, e.g. as SYSTEM from Intune or Configuration Manager) | `"Cloak Setup 0.1.0.exe" /S /allusers` |
| Choose the folder (must be the last argument, no quotes) | `... /D=D:\Apps\Cloak` |
| Uninstall, current user | `"%LOCALAPPDATA%\Programs\Cloak\Uninstall Cloak.exe" /S` |
| Uninstall, every user (elevated) | `"C:\Program Files\Cloak\Uninstall Cloak.exe" /S /allusers` |

- Exit code 0 means success.
- **Upgrading:** run the new installer the same way. It finds the earlier
  installation through the registry and replaces it in place.
- **Detection rule** (Intune and similar): the uninstall entry is
  `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\be938ee6-9302-5d02-bbf4-51464a3716cd`
  for an install for everyone, `HKCU\...` for one user; it holds
  `DisplayVersion`. Or check for `C:\Program Files\Cloak\Cloak.exe`.
- An installer from before 15 Nov 2026 was a one-click per-user installer that
  used `%LOCALAPPDATA%\Programs\cloak-desktop`. Upgrades keep using that folder.
- Uninstalling leaves the user-data folder and the licence in place, and never
  touches matter folders or exported copies.
- These options are electron-builder's standard NSIS options. They have not yet
  been tried on a Windows computer.

## Where Cloak keeps data

| What | Windows | Mac | What is in it |
| --- | --- | --- | --- |
| The program | see above | `Cloak.app` | Program files only. Cloak never writes here. |
| User settings | `%APPDATA%\cloak-desktop\` | `~/Library/Application Support/cloak-desktop/` | `profile.json`: the person's full name (written next to their sign-offs). `remembered.json`: matter passwords the person chose to remember, encrypted by Windows (DPAPI) or the macOS Keychain. `licence.txt`: the licence, if the person added it. Chromium's own working folders (`Cache`, `Code Cache`, `GPUCache`, `Local Storage`, `Crashpad`, `Dictionaries` and similar): no client documents and no cloaked text. |
| Licence for everyone (optional) | `%ProgramData%\Cloak\licence.txt` | `/Library/Application Support/Cloak/licence.txt` | Put there by IT; see below. |
| OCR language data | `%TEMP%\cloak-ocr-lang\` | `$TMPDIR/cloak-ocr-lang/` | About 190 MB: copies of the OCR language files that ship with Cloak, unpacked on first use. No client data. Safe to delete; it is made again when needed. |
| Matter folders | wherever the person chooses (the firm's shared drive) | same | `matter.cloakkey` (the encrypted key: every tag and its real value), `matter.cloakkey.bak`, `cache/` (encrypted copies of what was read), `log.jsonl` (who did what, no real values), `matter.lock`. Cloak refuses to put a matter in a OneDrive, Google Drive or iManage Drive folder. |
| Cloaked copies | wherever the person exports them | same | Cloaked text files, `cloak-report.json` (which names the firm's licence, not any client), a marker file. |
| Restored drafts | wherever the person saves them | same | Real values: treat like any client document. |

Cloak reads documents where they are and never changes them. It writes text
read from documents only inside the encrypted matter folder, and in the cloaked
copies and drafts a person chooses to save. Like any program, its memory can
end up in the system's page file or hibernation file; full-disk encryption
(BitLocker, FileVault) covers that.

## Licence for everyone on a computer

Copy the licence file the firm received to `%ProgramData%\Cloak\licence.txt`
(Mac: `/Library/Application Support/Cloak/licence.txt`). Users need read access
only. Every user of that computer is then licensed; a licence a user adds on
the Licence screen is used first if it is valid. The licence is checked on the
computer; nothing is sent anywhere. See `licence.md`.

## Removing everything

1. Uninstall the program (above), or on a Mac move `Cloak.app` to the Bin.
2. Delete the user-data folder of each user: `%APPDATA%\cloak-desktop`
   (Mac: `~/Library/Application Support/cloak-desktop`).
3. Delete `%TEMP%\cloak-ocr-lang` for each user (Mac: `$TMPDIR/cloak-ocr-lang`).
4. Delete `%ProgramData%\Cloak` (Mac: `/Library/Application Support/Cloak`) if
   a licence was installed for everyone.
5. Matter folders and exported copies are the firm's records: keep or delete
   them under the firm's retention policy. **Deleting a matter's
   `matter.cloakkey` means drafts made from that matter can never be restored
   automatically.**

## Hardware

Measured on a 4-core computer:

- A 300-page scanned bundle took about 9 minutes, almost all of it OCR.
- A 5,000-row spreadsheet adds about a minute to each run.
- Peak memory was about 1.2 GB.
- Files that have not changed are not read again (Cloak keeps an encrypted copy
  of what it read), so a second run on the same folder is much quicker.

Guidance:

| | Minimum | Recommended for scanned bundles |
| --- | --- | --- |
| Processor | 4 cores | 8 cores or more |
| Memory | 8 GB | 16 GB |
| Disk | SSD, 2 GB free (program 0.5 GB, OCR data 0.2 GB, working space) | SSD |

OCR time grows with the number of scanned pages and shrinks with more cores.
On 8 cores a 300-page scan should take roughly half the time measured on 4
cores; that is an estimate, not a measurement.

## Antivirus and security tools

- **Unsigned builds** are blocked by some endpoint tools and warned about by
  SmartScreen. Sign the installers before rolling Cloak out (`signing.md`).
  Once signed, allow Cloak by publisher rather than by path.
- The program folder holds about 760 files, including WebAssembly modules (the
  OCR engine and the PDF decoders) and a native module
  (`skia.win32-x64-msvc.node`, the drawing library). The first start after
  installing can be slow while antivirus scans them.
- Cloak runs as `Cloak.exe` with Chromium's usual helper processes
  (`Cloak.exe --type=renderer`, `--type=gpu-process`, `--type=utility`). It
  reads files in worker threads, not separate programs.
- **Controlled folder access** (Windows ransomware protection) can stop Cloak
  from writing matter folders or exported copies in protected folders such as
  Documents. Add `Cloak.exe` as an allowed app if your firm uses it.
- The installed program can be started as plain Node.js
  (`ELECTRON_RUN_AS_NODE=1`), as most Electron programs can. Some security
  rules flag that. Switching it off is a planned hardening step (`signing.md`).
- **Crash reports:** Cloak never sends crash reports and does not start
  Electron's crash reporter. But if Cloak crashes, Windows Error Reporting or
  macOS may record a crash report, and depending on the computer's settings
  send it to Microsoft or Apple. A crash report can hold part of the program's
  memory, including what was on screen. If that matters to the firm, turn off
  sending: Windows Group Policy, Windows Components, Windows Error Reporting,
  "Disable Windows Error Reporting" (or "Do not send additional data"); Mac:
  System Settings, Privacy & Security, Analytics & Improvements, "Share Mac
  Analytics" off.
- Antivirus cloud features (for example Microsoft Defender's automatic sample
  submission) are separate from Cloak. Set them by firm policy.

## Checking that Cloak makes no network connection

What Cloak does to stay offline is in `offline.md`. To check it yourself:

**Windows**

1. Block it and see that it still works: Windows Defender Firewall with
   Advanced Security, Outbound Rules, New Rule, Program, the path to
   `Cloak.exe`, Block. Or in PowerShell:
   `New-NetFirewallRule -DisplayName "Block Cloak" -Direction Outbound -Program "C:\Program Files\Cloak\Cloak.exe" -Action Block`
   Everything in Cloak keeps working with the rule on: cloaking, OCR, review,
   export, restore, the licence.
2. Watch it: Resource Monitor (`resmon`), Network tab, tick `Cloak.exe`. While
   you cloak a folder, "Network Activity" and "TCP Connections" stay empty for
   Cloak. Sysinternals TCPView, or Process Monitor filtered on "Process Name is
   Cloak.exe" and "Operation begins with TCP" or "UDP", show the same.

**Mac**

1. A firewall that asks about outgoing connections (LuLu, which is free, or
   Little Snitch) never asks about Cloak.
2. In Terminal while Cloak works: `sudo lsof -i -n -P | grep -i cloak` shows
   nothing; `nettop -p <Cloak's process ID>` shows no traffic.

**What you may see that is not Cloak:** when a downloaded installer is first
opened, Windows SmartScreen and macOS Gatekeeper may check it with Microsoft or
Apple. That is the operating system, once per download, before Cloak runs.

**How it is tested:** the automated tests run a whole cloak of a made-up matter
with every network function booby-trapped and record no attempt, and run the
app window with Chromium's own network log on and find no web request, name
lookup or connection (`offline.md`). These tests run on Linux; on Windows and
Mac, use the checks above.
