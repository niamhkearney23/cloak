# Putting Cloak on a private server

This guide uses **Render** (render.com). It's simple, has a **Singapore** data centre, sets up the secure `https://` address for you, and updates the site whenever the code on GitHub changes. It costs about **US$7 a month**, plus your AI usage.

Only people you give a login to can open the site.

---

## What you need

1. Your **GitHub** account (the code is already there).
2. An **Anthropic API key**: sign up at console.anthropic.com → API Keys → Create key. Copy it somewhere safe. It starts with `sk-ant-`.
3. A **login for each staff member** (step 1 below).

---

## Step 1: Make the staff logins

Do this on your own computer, in the downloaded `cloak` folder (see the README), after `npm install`:

```
npm run add-user
```

It asks for a user name and a password (12+ characters), then prints a line like:

```
jane:s1$Xy...$Ab...
```

Do it once per person. Join the lines with commas, with no spaces, into one long line:

```
jane:s1$Xy...$Ab...,mathew:s1$Qr...$Cd...
```

That long line is your **CLOAK_USERS** value. It contains scrambled versions of the passwords, never the passwords themselves.

---

## Step 2: Create the site on Render

1. Go to **render.com** and sign up with your GitHub account.
2. Click **New +** → **Blueprint**.
3. Choose the **cloak** repository. Render reads the `render.yaml` file and sets up a web service in **Singapore**.
4. Render asks for three values:
   - **ANTHROPIC_API_KEY**: your key from Anthropic.
   - **CLOAK_USERS**: the long line from step 1.
   - **CLOAK_FIRM_NAME**: your firm's name, shown on the sign-in page (optional).
5. Click **Apply**. The first build takes a few minutes.

When it's done, Render shows the address, something like `https://cloak-drafting.onrender.com`. Open it, sign in, and you should see **"Live drafting"** at the top.

> You can give it your own address (e.g. `cloak.yourfirm.com`) under the service's **Settings → Custom Domains**.

---

## Everyday tasks

| Task | How |
|---|---|
| Add a staff member | Run `npm run add-user`, then on Render open the service → **Environment** → edit **CLOAK_USERS** → add a comma and the new line → **Save**. The site restarts in about a minute. |
| Remove someone | Delete their entry from **CLOAK_USERS** and save. They're signed out straight away. |
| Change a password | Run `npm run add-user` for the same name and replace their old entry. |
| See who did what | Render → the service → **Logs**. It records sign-ins, failed sign-ins and each document drafted, with the user and time. It **never** records case text. |
| Cap AI costs | Add **CLOAK_DRAFTS_PER_HOUR** (default 60 per person). Also set a monthly spending limit in the Anthropic console. |
| Sign everyone out | Change **CLOAK_SECRET** to a new random value and save. |

---

## What's protected, and how

- **Logins:** every page needs a staff login. Passwords are stored only as salted scrypt hashes. Ten wrong attempts from one place blocks sign-in for 15 minutes. Sessions last 12 hours.
- **Names stay in the browser:** the server never receives real names or ID numbers, only the cloaked text. The name map lives in each staff member's browser.
- **Log out clears the browser:** logging out wipes the matter from that computer, which matters on shared machines. (Save the matter file first to carry on later.)
- **Secure connection:** Render serves the site over `https://` only, and the app adds strict browser security settings (no embedding in other sites, no third-party scripts).
- **Data location:** the server runs in Render's Singapore region. The cloaked text is sent on to Anthropic to draft. Anthropic's commercial terms say API data is not used for training. Check their current data-retention terms against your firm's policy.

---

## Running it on your own server instead

If the firm has its own server or a cloud account (AWS, Azure, Google Cloud, DigitalOcean, Alibaba Cloud…), use Docker:

```
docker build -t cloak .
docker run -d -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e CLOAK_USERS='jane:s1$...,mathew:s1$...' \
  -e CLOAK_SECRET=<a long random value> \
  -e CLOAK_FIRM_NAME='Your Firm' \
  cloak
```

Put it behind HTTPS (for example Caddy or nginx with a certificate) and set `TRUST_PROXY=1` when it sits behind such a proxy. The app refuses to start on a network address without logins set up.

## All settings

| Setting | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes, for real drafts | Without it the site runs in demo mode |
| `CLOAK_USERS` | Yes, on a server | Staff logins from `npm run add-user` |
| `CLOAK_SECRET` | Yes, on a server | Long random value that signs sessions (Render creates one) |
| `CLOAK_FIRM_NAME` | No | Shown on the sign-in page and top bar |
| `CLOAK_DRAFTS_PER_HOUR` | No | Per-person limit, default 60 |
| `CLOAK_MODEL` | No | AI model, default `claude-opus-5` |
| `TRUST_PROXY` | Behind a proxy | Set to `1` so secure cookies and visitor addresses work |
| `HOST` / `PORT` | No | Default `0.0.0.0` / `3000` in Docker |
