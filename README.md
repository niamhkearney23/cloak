# Cloak Drafting

A simple web app for legal support staff. Type in the facts of a case, tick the documents you need, and get first drafts back. The real names never go to the AI.

Documents it drafts:

- Writ of Summons
- Statement of Claim
- Witness Statement
- Affidavit
- Reply (and Defence to Counterclaim)

## How it works

1. **Case details.** Pick the court and jurisdiction, then enter the parties, anyone else named in the facts, and the solicitors.
2. **The facts.** Write what happened in plain words, using real names.
3. **Pick documents.** Tick what you need. Witness statements, affidavits and replies ask a couple of extra questions.
4. **Check what's hidden.** Cloak swaps every name, address, firm, record number, email, phone number, postcode, PPSN, NI number and IBAN for a code like `{{PLAINTIFF_1}}`. You see exactly what will be sent, along with any capitalised words that *might* be names it missed. Hide them with one click, or mark them as fine. You must tick "nothing in it identifies anyone" before anything is sent.
5. **Your drafts.** Only the cloaked text goes to the drafter. When the drafts come back, Cloak puts the real names back in, in your browser. You can then edit, download as Word, print or save as PDF, or copy.

```
 browser                                   server / AI
 ────────────────────────────              ─────────────────────
 facts + names
   │  cloak()  ──►  "{{PLAINTIFF_1}} was…"  ──►  drafts the document
   │                                              using the codes
   ◄──  uncloak()  ◄──  "{{PLAINTIFF_1|UPPER}} v …"
 draft with real names

 The name map (code → real name) never leaves the browser.
```

## Running it

Needs Node.js 20 or later.

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # your Anthropic API key
npm start                              # http://127.0.0.1:3000
```

With no API key it runs in **demo mode**. It still does the full cloak → draft → uncloak round trip, but the "draft" is only a skeleton, so you can try the app safely.

Settings (environment variables):

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Turns on real drafting |
| `CLOAK_MODEL` | `claude-opus-5` | Model used for drafting |
| `CLOAK_MOCK` | auto | `1` forces demo mode, `0` forces live mode |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Where the server listens |

## Privacy notes

- The name map and the case details are stored only in the browser (`localStorage`) on the computer being used. Use **Clear everything** when you finish a matter on a shared computer. **Save matter file** downloads everything, real names included, as a JSON file, so store it as you would any client file.
- The server only receives cloaked text, and never logs the text it receives.
- Cloak catches names you have typed into the parties and people lists (including surname-only and first-name-only mentions, and company names without "Limited"), plus common identifiers. It **cannot** know about a name you never entered. That is what the "might be names" check and the tick-box are for. Always read the grey box before sending.

## Important

These are first drafts for a solicitor to review. Check every fact, date, amount and name, and fill in every `[square-bracket gap]`, before anything is signed, sworn, issued or served. Court forms and rules differ between jurisdictions. The drafter follows the jurisdiction you choose, but a solicitor must confirm the form is right.

## Project layout

```
public/cloak.js     the cloak / uncloak engine (runs in the browser)
public/app.js       the step-by-step form and drafts screen
server/server.js    serves the app, sends cloaked text to the drafting model
server/prompts.js   drafting instructions for each document type
server/mock.js      demo-mode drafter
test/               npm test
```
