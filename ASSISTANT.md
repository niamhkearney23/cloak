# Email assistant (Outlook / Microsoft 365)

The email assistant reads the lawyer's new emails, hides every confidential detail, gets the AI to write a reply, puts the details back, and saves the reply in their **Drafts** folder. It also sends a fixed acknowledgement to people outside the firm, and a summary every morning with the day's meetings.

**The AI never sees real names or confidential details.** Only the hidden version is sent. The list linking codes to real details stays on the firm's server.

## How each email is handled

```
New email arrives
  │
  ├─ From outside the firm, a real person?  → fixed acknowledgement sent (no AI),
  │                                            at most once a day per sender
  ├─ Newsletter / automatic email?           → skipped
  ├─ Matches "Never send to AI"?             → tagged "Cloak: handle personally"
  │
  └─ Cloak hides names, IC/NRIC, phones, case numbers, addresses, clients, contacts…
        │
        ├─ Cloak is SURE everything is hidden → AI writes a reply → names put back
        │                                       → saved in Drafts, tagged "Cloak: draft ready"
        │
        └─ Cloak is UNSURE (a word might be a name it doesn't know)
              → tagged "Cloak: waiting for check", nothing sent to AI
              → you get a notice, open "Check before AI", click Hide it / It's fine
              → approve → AI writes the reply → Drafts
```

The "sure or unsure" decision is made by Cloak on your server, **not** by the AI. Words you mark are remembered, so fewer emails need checking over time.

**Nothing is ever sent to a client by the AI.** The only automatic email is the fixed acknowledgement you write yourself.

## Why no tool can promise to catch 100%

Cloak reliably hides everything it can recognise: names in the email headers, the client list, the contacts, IC/NRIC and passport numbers, phones, emails, case numbers, postcodes, accounts. The difficulty is a name it has never seen, in an unusual place, or a description that identifies someone without naming them ("the diesel tank owner on Pangkor"). That's why it's built to **stop and ask a person whenever it isn't sure**, instead of guessing. For the most sensitive clients or topics, add them to "Never send to AI".

## One-time setup (about 20 minutes)

You need someone with access to the firm's **Microsoft 365 admin** (or your IT provider) for step 1, and the lawyer for step 3.

### 1. Register Cloak with Microsoft

1. Go to **entra.microsoft.com** and sign in with an admin account.
2. **Applications → App registrations → New registration**.
   - Name: `Cloak Email Assistant`
   - Supported account types: **Accounts in this organizational directory only**
   - Redirect URI: choose **Web** and enter `https://YOUR-CLOAK-ADDRESS/assistant/callback` (for example `https://cloak-drafting.onrender.com/assistant/callback`)
   - Click **Register**.
3. On the overview page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
4. **Certificates & secrets → New client secret**. Choose 24 months. Copy the **Value** straight away; it's only shown once. Put a reminder in the calendar to renew it before it expires.
5. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, and tick:
   `offline_access`, `openid`, `profile`, `User.Read`, `Mail.ReadWrite`, `Mail.Send`, `Calendars.Read`, `Contacts.Read`.
   Then click **Grant admin consent** if your organisation requires it.

### 2. Add the settings on Render

Open the Cloak service on Render → **Environment**, and fill in:

| Setting | Value |
|---|---|
| `CLOAK_PUBLIC_URL` | Your Cloak address, e.g. `https://cloak-drafting.onrender.com` |
| `MS_CLIENT_ID` | Application (client) ID from step 1.3 |
| `MS_TENANT_ID` | Directory (tenant) ID from step 1.3 |
| `MS_CLIENT_SECRET` | Secret value from step 1.4 |
| `CLOAK_ASSISTANT_USERS` | Cloak user names allowed to use the assistant, e.g. `nk,mathew` |

`CLOAK_DATA_KEY` and the storage disk are created automatically by `render.yaml`. Keep `CLOAK_DATA_KEY` safe: if it changes, the stored connection and settings can't be read and the mailbox must be connected again.

Save. The site restarts in about a minute.

### 3. Connect the lawyer's mailbox

1. Sign in to Cloak with a user listed in `CLOAK_ASSISTANT_USERS` and click **Email assistant** at the top.
2. Click **Connect Microsoft 365**. **The lawyer signs in with their own Microsoft account** and approves access.
3. Back in Cloak, open **Settings** and fill in:
   - **Clients**: one per line. These are always hidden.
   - **Never send to AI**: addresses, domains or words for anything too sensitive.
   - **Tell these people when an email needs a check**: your email address.
   - Check the acknowledgement message and the summary time (07:00, Kuala Lumpur, weekdays, by default).

From then on, new emails are handled every 5 minutes. Old emails already in the inbox are left alone.

## Everyday use

- **In Outlook**, the lawyer sees categories on emails: *Cloak: draft ready*, *Cloak: waiting for check*, *Cloak: handle personally*. Drafts are in the **Drafts** folder, as replies in the right thread.
- **You** get a short notice (no content) when something needs checking. Open **Email assistant → Check before AI**.
- **Activity** shows everything that happened, including exactly what the AI saw for each draft.
- **Pause** stops everything instantly. **Disconnect** removes access; the lawyer can also remove it at any time from their Microsoft account (*My Apps / app permissions*).

## What is stored, and where

On the firm's server (Render, Singapore), in one encrypted file: the Microsoft sign-in token, settings, the check list (sender, subject, time), and the activity log (sender, subject, one-line summaries, and the hidden text sent to the AI). **Email bodies are not stored**; they're read from the mailbox when needed. Only the latest message in a thread is used, never the quoted history, and attachments are never sent to the AI.
