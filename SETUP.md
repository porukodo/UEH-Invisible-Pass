# Setup Guide

Step-by-step from cloning the repo to running UEH Invisible Pass locally.

## Prerequisites

- **Node.js** 18+ and npm
- **MySQL/MariaDB** 8 / 10.4+ — easiest via [XAMPP](https://www.apachefriends.org/) (this project was developed against XAMPP's MySQL on `127.0.0.1:3306`, user `root`, no password)
- Git

## 1. Clone the repo

```bash
git clone <repo-url>
cd UEH-Invisible-Pass
```

## 2. Database

Start MySQL (e.g. open XAMPP and start the MySQL module), then run the
schema and seed data:

```bash
mysql -u root < database/schema.sql
mysql -u root ueh_invisible_pass < database/data.sql
```

- `schema.sql` creates the `ueh_invisible_pass` database and all tables.
- `data.sql` populates 4 demo gates and 3 demo accounts (see below).

(If your MySQL root user has a password, add `-p` and enter it when
prompted.)

## 3. Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

The server listens on `http://localhost:4000`. The defaults in
`.env.example` already match a default XAMPP MySQL setup, so for local dev
you mostly don't need to change `DB_*`.

Things worth knowing about `.env`:

- **SMTP** (`SMTP_USER`/`SMTP_PASS`): if left empty, the server doesn't send
  real emails — OTP codes (for registration/login) are printed to the
  server console instead (`[mailer] OTP for ... : 123456`). Fine for local
  dev; fill these in with a real SMTP provider (e.g. Gmail app password) to
  send real emails.
- **VietQR** (`VIETQR_ACCOUNT_NO`/`VIETQR_ACCOUNT_NAME`): used to build the
  top-up QR image URL. Leave blank to skip real top-up testing, or fill in
  a real/test bank account to see a working QR.
- **`GATE_HMAC_SECRET`** and **`QR_AES_KEY`** must match the same values in
  `client/.env` (the `.env.example` defaults already match each other).
- **`SEPAY_API_KEY`** / **`CRON_SECRET`**: only needed for the SePay webhook
  and the production cron endpoint — not required for local dev.

## 4. Client

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api` requests
to `http://localhost:4000`, so `VITE_API_URL` can stay empty.

## 5. Demo accounts

All seeded by `database/data.sql` (password for all: `123456`):

| Role | Login email | MSSV |
| --- | --- | --- |
| Student | `svdemo@st.ueh.edu.vn` | `31221012345` (wallet starts at 100,000đ) |
| Staff | `staffdemo@st.ueh.edu.vn` | `STAFF001` |
| Admin | `admindemo@st.ueh.edu.vn` | `ADMIN001` |

Login requires an OTP step — check the **server console** for the printed
code if SMTP isn't configured.

Alternatively, `npm run seed` (from `server/`) creates the same 3 accounts
programmatically (with freshly generated TOTP secrets) and is idempotent —
useful if you ever wipe the `users`/`wallets` tables without re-running
`data.sql`.

## 6. Where to find things in the app

- **Student**: wallet balance, top-up (VietQR), dynamic QR code, profile —
  log in with the student account.
- **Staff/Admin**: gate scanner (`/staff/gate-scanner`), barrier simulator
  (`/staff/barrier-simulator`), admin dashboard (search users/transactions,
  manual wallet adjustment, manual gate open, Excel export) — log in with
  the staff or admin account.

## Deployment

See the [README](README.md) for deploying to Vercel (client + server) with
a TiDB Cloud Serverless database.
