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
4. **Check what's hidden.** Cloak swaps every name, address, firm and ID number for a code like `{{PLAINTIFF_1}}` (see the list below). You see exactly what will be sent, along with any capitalised words that *might* be names it missed. Hide them with one click, or mark them as fine. You must tick "nothing in it identifies anyone" before anything is sent.
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

## What gets hidden

**Names you enter**, including the person's surname or first name used on its own ("Encik Ahmad", "Mr Tan", "Ms O'Neill"), names with bin/binti, a/l, a/p, s/o, d/o, titles such as Tan Sri, Datuk, Puan and Encik, and company names without "Sdn. Bhd.", "Pte. Ltd." or "Limited".

**ID numbers found automatically**, even if nobody typed them into the form:

| | Examples |
|---|---|
| Malaysian MyKad / MyKid / MyPR | 900101-14-5678, 900101145678, old IC A1234567, police RF123456 |
| Singapore NRIC / FIN | S1234567D, G7654321K, masked SXXXX567D |
| Passports | A12345678 (MY), E1234567A (SG) |
| Malaysian company numbers | 202001012345, 1234567-X, JM0123456-X, LLP0012345-LGN |
| Singapore UEN | 201912345K, 53123456A, T08LL1234A |
| Tax numbers | IG12345678090, SG 1234567890, SST W10-1808-31000123 |
| Court case numbers | WA-22NCvC-123-01/2024, W-02(NCVC)(W)-1234-07/2023, HC/OC 123/2024 |
| Vehicles | SBA 1234 A; Malaysian plates when labelled ("registration no. WXY 1234") |
| Phone numbers | 012-345 6789, +60 3-2123 4567, 9123 4567, +65 6123 4567 |
| Postcodes | 50450 Kuala Lumpur, Singapore 238823 |
| Cards, IBANs, emails, web links | 4111 1111 1111 1111 |
| Anything with a label | IC No., Account No., Policy No., EPF/KWSP, SOCSO, CPF, MRN, police report no., Geran, Lot, Ref, invoice, licence, permit, chassis, IMEI and more |
| Any long number | 9 or more digits in a row |

Irish PPSNs, UK National Insurance numbers, Eircodes and UK postcodes are also covered.

**Not hidden on purpose:** amounts of money, dates, and references to laws and rules (e.g. "Rules of Court 2012", "Order 18 rule 19"), because the drafts need them.

## Jurisdictions

Malaysia (Peninsular, and Sabah and Sarawak), Singapore, Northern Ireland, Ireland, England and Wales, New South Wales and Victoria, or any other court you type in. Picking one fills in court-name suggestions and the usual party names (e.g. Claimant in Singapore). Malaysian documents can be drafted in English or Bahasa Malaysia. In Singapore the writ is replaced by the Originating Claim, and the app labels it that way.

## For the firm's records

- **Checked by:** whoever reviews the hidden text enters their name or initials before sending.
- **Send record:** after drafting, "Download send record" saves a file showing the date and time, who checked it, what kinds of details were hidden, and exactly what text was sent. It shows that names and identifiers were replaced before anything left the firm, which helps with PDPA record-keeping. (The facts themselves, such as injuries and dates, are still sent, so this is a strong safeguard rather than full anonymisation.) The name map is not included.
- **DRAFT mark:** printed and Word copies carry "DRAFT, for review. Privileged and confidential." This can be switched off.
- **Gender:** each person's gender is passed to the AI as "female/male individual", without their name, so pronouns come out right.

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

## Putting it online for your team

See **[DEPLOY.md](DEPLOY.md)**. It covers a step-by-step Render setup in Singapore, staff logins (`npm run add-user`), and running on your own server with Docker.

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
