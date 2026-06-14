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
npm run seed            # creates demo student/staff/admin accounts (password: 123456)
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
