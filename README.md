# UEH Invisible Pass

A closed-loop cashless/cardless parking system for UEH: students top up a
prepaid wallet, then enter/exit the parking lot using a dynamic QR code
(TOTP-based, refreshes every 30s) that's scanned at the gate. Staff/admin
manage users, top-ups, and gates from a web dashboard.

## Tech stack

- **Server**: Node.js (Express), MySQL (`mysql2`)
- **Client**: React + Vite + Tailwind (PWA)
- **Auth**: JWT + email OTP
- **Top-up**: VietQR transfer + SePay webhook (FR08/09)
- **Gate verification**: AES-encrypted QR payload + TOTP + HMAC-signed gate requests (FR11-19)

## Project structure

```
client/    React PWA (student wallet/QR, staff scanner & barrier simulator, admin dashboard)
server/    Express API + MySQL models
database/  schema.sql (run once to create the database and tables)
```

## Setting up your own deployment (step-by-step for beginners)

This guide walks you through creating every account and service the app
needs, from zero. You do not need to understand the code — just follow
each step in order.

> **What you will create:** a cloud database (TiDB Cloud), two hosting
> projects (Vercel), an email sender (Gmail), and a payment receiver
> (SePay). Everything has a free tier.

---

### Step 1 — Create a TiDB Cloud account (the database)

All student data, wallets, and parking records live here.

1. Go to [tidbcloud.com](https://tidbcloud.com) and sign up with Google.
2. Click **Create Cluster → Serverless** (free, no credit card needed).
3. Choose region **Singapore** (closest to Vietnam) and click **Create**.
4. Once it finishes, click **Connect**. Choose **MySQL CLI** from the
   dropdown. Copy the host, username, password, and database name shown
   — you will paste these into Vercel later.
5. Open a SQL client (e.g. [TablePlus](https://tableplus.com), free tier)
   and connect using those details. TiDB Cloud requires TLS — check the
   "Use SSL" box if your client asks.
6. In TablePlus, click **Import** → select the file `database/schema.sql`
   from this project and run it. This creates all the tables the app needs.

---

### Step 2 — Create a Vercel account (the hosting)

Vercel runs both the server and the website. One account hosts both.

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2. You will create **two separate projects** in later steps — one for
   `server/` and one for `client/`.

---

### Step 3 — Set up a Gmail app password (for OTP emails)

The app sends one-time passwords to students by email.

1. Go to your Google account → **Security → 2-Step Verification** and
   turn it on if it isn't already.
2. Then go to **Security → App passwords**, create a new one called
   "UEH Invisible Pass", and copy the 16-character password shown.
3. Note down your full Gmail address (e.g. `yourname@gmail.com`).

---

### Step 4 — Deploy the server to Vercel

1. In the Vercel dashboard, click **Add New → Project**.
2. Import your GitHub repository. When asked for the **Root Directory**,
   type `server` and click **Continue**.
3. Before deploying, click **Environment Variables** and add each row
   from the table below. Every row is required.

| Variable | What to put |
|---|---|
| `DB_HOST` | The host from TiDB Cloud Step 1 (e.g. `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`) |
| `DB_PORT` | `4000` |
| `DB_USER` | The username from TiDB Cloud |
| `DB_PASSWORD` | The password from TiDB Cloud |
| `DB_NAME` | The database name from TiDB Cloud (e.g. `ueh_invisible_pass`) |
| `DB_SSL` | `true` |
| `JWT_SECRET` | Any long random string — go to [randomkeygen.com](https://randomkeygen.com) and copy a "256-bit WEP Key" |
| `JWT_EXPIRES_IN` | `2h` |
| `CLIENT_ORIGIN` | Leave blank for now — you will fill this after Step 5 |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | The 16-character app password from Step 3 |
| `SMTP_FROM` | `UEH Invisible Pass <yourname@gmail.com>` |
| `VIETQR_BANK_ID` | Your bank's ID from [vietqr.io/danh-sach-ngan-hang](https://vietqr.io/danh-sach-ngan-hang) (e.g. `970415` for Vietinbank) |
| `VIETQR_ACCOUNT_NO` | Your bank account number |
| `VIETQR_ACCOUNT_NAME` | Your account name as shown on your bank card |
| `GATE_HMAC_SECRET` | Any long random string (go to [randomkeygen.com](https://randomkeygen.com)) |
| `QR_AES_KEY` | Exactly 64 hex characters — run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` in a terminal, or use a 256-bit key from [randomkeygen.com](https://randomkeygen.com) |
| `SEPAY_API_KEY` | From your SePay account (Step 6) — leave blank for now |
| `CRON_SECRET` | Any random string — copy another one from [randomkeygen.com](https://randomkeygen.com) |

4. Click **Deploy**. Wait for it to finish. Copy the URL shown (e.g.
   `https://your-project-name.vercel.app`) — this is your **server URL**.

---

### Step 5 — Deploy the client to Vercel

1. In Vercel, click **Add New → Project** again.
2. Import the same GitHub repository. This time set **Root Directory** to
   `client`.
3. Add these environment variables:

| Variable | What to put |
|---|---|
| `VITE_API_URL` | Your server URL from Step 4 (e.g. `https://your-project-name.vercel.app`) |
| `VITE_QR_AES_KEY` | The same 64-character key you used for `QR_AES_KEY` in Step 4 |
| `VITE_GATE_HMAC_SECRET` | The same string you used for `GATE_HMAC_SECRET` in Step 4 |

4. Click **Deploy**. Copy the client URL when it finishes (e.g.
   `https://your-client-name.vercel.app`) — this is the address students
   open in their browser.

5. Go back to the **server** project in Vercel → **Settings →
   Environment Variables** → find `CLIENT_ORIGIN` and set its value to
   your client URL from above. Then redeploy the server (click
   **Deployments → the latest one → Redeploy**).

---

### Step 6 — Set up SePay (automatic payment confirmation)

SePay watches your bank account and tells the app when a student's
transfer arrives so the wallet is topped up automatically.

1. Register at [sepay.vn](https://sepay.vn). Add your bank account.
2. In the SePay dashboard, find your **API key** and copy it.
   - Paste it into the server's `SEPAY_API_KEY` environment variable on
     Vercel, then redeploy the server.
3. In SePay, set the **Webhook URL** to:
   ```
   https://<your-server-url>/api/wallet/webhook
   ```
4. Set the webhook **Authorization header** to:
   ```
   Apikey <your-SEPAY_API_KEY>
   ```
   (Replace `<your-SEPAY_API_KEY>` with the same key you pasted in step 2.)

---

### Step 7 — Create the first admin account

The app has no admin user until you create one manually.

1. Open the client URL in your browser and register a normal account.
2. Connect to TiDB Cloud with TablePlus, then run:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@st.ueh.edu.vn';
   ```
3. Log out and back in. You will now see the admin dashboard.

---

### Done

Your deployment is complete. Bookmark:
- **Student app:** your client URL
- **Database:** [tidbcloud.com](https://tidbcloud.com) (to view raw data)
- **Hosting dashboard:** [vercel.com](https://vercel.com) (to redeploy or change env vars)

---

## Local development

### 1. Database

Import the schema into a local MySQL/MariaDB instance (e.g. XAMPP):

```bash
mysql -u root -p < database/schema.sql
```

### 2. Server

```bash
cd server
cp .env.example .env   # fill in DB/SMTP/VietQR/etc. credentials
npm install
npm run seed            # optional: seeds accounts listed in src/seed.js (empty by default)
npm run dev              # http://localhost:4000
```

### 3. Client

```bash
cd client
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:4000`, so
`VITE_API_URL` can stay empty for local dev.

## Deployment (Vercel)

The app deploys as **two separate Vercel projects** — one for `client/`,
one for `server/` — backed by a cloud MySQL database. Both run on Vercel's
serverless platform, so there's no Socket.io connection or in-process cron:
real-time gate events and anti-replay tracking are DB-backed
(`gate_events`, `used_qr_tokens`), and the NFR09 retry sweep runs via
Vercel Cron hitting `GET /api/cron/topup-retry`.

### 1. Database: TiDB Cloud Serverless

1. In the Vercel dashboard, go to **Storage → Browse Marketplace** and add
   a **TiDB Cloud Serverless** database (MySQL-wire-protocol compatible,
   free tier).
2. From the TiDB connection details, note the host, port, user, password,
   and database name. TiDB Cloud requires TLS.
3. Connect to it (e.g. with `mysql` CLI or TablePlus using the TLS cert
   TiDB provides) and run `database/schema.sql` to create all tables.

   If you already created the database before these two tables existed,
   just run this snippet instead of the full schema:

   ```sql
   CREATE TABLE used_qr_tokens (
     token_hash  CHAR(64) NOT NULL,
     expires_at  DATETIME NOT NULL,
     created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (token_hash)
   ) ENGINE=InnoDB;

   CREATE TABLE gate_events (
     id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
     gate_id    INT UNSIGNED NOT NULL,
     payload    JSON NOT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (id),
     KEY idx_gate_events_gate_id (gate_id, id),
     CONSTRAINT fk_gate_events_gate FOREIGN KEY (gate_id) REFERENCES gates(id)
       ON DELETE CASCADE
   ) ENGINE=InnoDB;
   ```

### 2. Server project (root directory: `server/`)

Create a new Vercel project, set its **root directory** to `server`, and
add these environment variables (copy from `server/.env.example`):

| Variable | Notes |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | from TiDB Cloud |
| `DB_SSL` | set to `true` |
| `JWT_SECRET` | long random string |
| `JWT_EXPIRES_IN` | e.g. `2h` |
| `CLIENT_ORIGIN` | your client project's URL, e.g. `https://ueh-invisible-pass.vercel.app` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | for email OTP |
| `VIETQR_BANK_ID`, `VIETQR_ACCOUNT_NO`, `VIETQR_ACCOUNT_NAME` | for top-up QR generation |
| `GATE_HMAC_SECRET` | shared with the client's gate scanner |
| `QR_AES_KEY` | shared with the client (`VITE_QR_AES_KEY`) |
| `SEPAY_API_KEY` | SePay webhook auth |
| `CRON_SECRET` | any random string — Vercel Cron sends it automatically as `Authorization: Bearer <CRON_SECRET>` |

Deploy with the Vercel CLI from `server/`:

```bash
cd server
vercel        # first deploy, follow prompts (root directory: server)
vercel --prod
```

`server/vercel.json` routes all requests through `server/api/index.js`
(the Express app) and registers the `topup-retry` cron job. Note: on the
Vercel **Hobby** plan, cron jobs run at most once per day — this sweep is
just a fallback for top-ups that never received a SePay webhook; the
webhook remains the primary, instant confirmation path.

### 3. Client project (root directory: `client/`)

Create a second Vercel project with root directory `client`, and set:

| Variable | Notes |
| --- | --- |
| `VITE_API_URL` | your server project's URL, e.g. `https://ueh-invisible-pass-server.vercel.app` |
| `VITE_QR_AES_KEY` | must match the server's `QR_AES_KEY` |
| `VITE_GATE_HMAC_SECRET` | must match the server's `GATE_HMAC_SECRET` |

`client/vercel.json` rewrites all routes to `index.html` for client-side
routing. Deploy the same way:

```bash
cd client
vercel
vercel --prod
```

### 4. Update the SePay webhook

Once the server project has a stable URL, point the SePay webhook at:

```
https://<your-server-project>.vercel.app/api/wallet/webhook
```

with header `Authorization: Apikey <SEPAY_API_KEY>` (matching the server's
`SEPAY_API_KEY`). ngrok is no longer needed.
