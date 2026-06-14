# Handoff Notes

Status snapshot for whoever picks this up next. For local setup see
[SETUP.md](SETUP.md); for production deployment see the
[README](README.md#deployment-vercel).

## What's done

All core features (FR01-23) are implemented and were working locally:

- **Auth**: registration with `@st.ueh.edu.vn` email + OTP verification,
  login with email/password + OTP 2FA, JWT sessions, RBAC
  (student/staff/admin).
- **Wallet & top-up**: balance view, VietQR top-up request, real SePay
  webhook confirmation (`POST /api/wallet/webhook`, `Authorization: Apikey
  <SEPAY_API_KEY>`), pending/retry UI state.
- **Dynamic QR gate pass**: client generates a TOTP+AES-encrypted QR token
  every 30s (offline, no server round-trip); gate scanner decrypts +
  verifies TOTP, debits the wallet atomically, rejects insufficient
  balance, rejects replayed tokens.
- **Barrier simulator**: shows `GATE_OPEN` events with auto-close after 10s.
- **Admin/staff**: search users/transactions/parking logs, manual wallet
  adjustment, manual gate open, Excel export.
- **PWA**: installable, offline shell via service worker.

### This session: refactored for Vercel deployment

The app previously relied on three things that don't survive Vercel's
stateless serverless model. All three are now DB-backed and behave
identically in local dev and production (one code path):

1. **Anti-replay (FR13)**: was an in-memory `Map`, now
   [`used_qr_tokens`](database/schema.sql) table +
   [`server/src/models/tokenModel.js`](server/src/models/tokenModel.js)
   (`SHA-256(token)` + TTL).
2. **Gate events / Barrier Simulator (FR18/19)**: was Socket.io push, now a
   [`gate_events`](database/schema.sql) table +
   `GET /api/gate/:gateId/events?after=<id>` polling endpoint, consumed by
   [`BarrierSimulatorPage.jsx`](client/src/pages/staff/BarrierSimulatorPage.jsx)
   every 2s. All Socket.io code/deps were removed.
3. **NFR09 retry sweep**: `node-cron` still runs locally
   ([`server.js`](server/src/server.js)), but the same logic is now also an
   HTTP endpoint `GET /api/cron/topup-retry` (guarded by `CRON_SECRET`) for
   Vercel Cron to call in production.

Also added: `server/api/index.js` + `server/vercel.json` (serverless
entrypoint), `client/vercel.json` (SPA rewrites), a serverless-friendly
MySQL pool (`globalThis`-cached, `DB_SSL` for TiDB), and
`database/data.sql` (seed data, see [SETUP.md](SETUP.md)).

All of the above was verified locally (server boots, replay rejection
returns 409, gate-events polling reflects a real gate-open, cron endpoint
auth works, client builds cleanly) — see git history for details.

### Latest session: post-deployment fixes & hardening

**Bugs fixed:**
1. **Fee timezone** — was reading UTC hour (7h off Vietnam); now computes UTC+7.
2. **Anti-replay race** — check-then-insert allowed concurrent double-charges; now atomic.
3. **iOS "Invalid Date"** — UTC timestamps weren't parsing on Safari; now safe across browsers.
4. **Seed script** — was silently no-op with empty `DEMO_USERS`; now logs.

**UX improvements:**
- Staff/admin pages now have a `StaffNav` bar linking between Admin/Scanner/Barrier and logout.
- After OTP login, staff/admin redirect to `/admin` (students still go to the wallet).

**Security hardening:**
- `POST /api/gate/verify` now requires staff/admin JWT + role in addition to HMAC signature (defense in depth — leaked client secret alone can't reach the endpoint).

## Production deployment — DONE ✅

**Live URLs:**
- **Client**: https://client-zeta-seven-74.vercel.app
- **Server**: https://server-beta-lyart-59.vercel.app
- **Database**: TiDB Cloud Serverless (`ueh_invisible_pass`)

**Deployed with:**
- TiDB provisioned, schema + gates seeded, admin account created (`phatbui.31231023065@st.ueh.edu.vn`)
- All env vars configured (DB, JWT, SMTP, VietQR, HMAC, AES, etc.)
- Vercel Cron registered for `/api/cron/topup-retry`
- Recent fixes: staff nav, gate-endpoint JWT+role auth hardening, UTC session timezone pinning

## What's still left to do

1. **SePay webhook** — Requires access to the SePay merchant dashboard (Quang has credentials). Configure:
   - URL: `https://server-beta-lyart-59.vercel.app/api/wallet/webhook`
   - Header: `Authorization: Apikey 51231f13f422c5f8d1cfcd5925f9de9c`
   - ⚠️ VietQR account is Quang's (VietinBank `100872880702`, HUYNH NHAT QUANG) — transfers land in his account; swap `VIETQR_ACCOUNT_NO/NAME` if you want your own.
   - Until configured: top-ups show a QR but don't auto-credit; use admin manual wallet adjustment for demos.

2. **Real user accounts** — Demo seeded accounts are removed; register new ones in-app or add to `server/src/seed.js` for batch creation.
   - **Students**: register via `/register`.
   - **Staff/admin**: can't self-register (role forced to `student`); tell me details and I'll add them via seed or direct DB insert.
   - **Your admin password**: change from `123456` (it's on a public URL; OTP 2FA helps).

3. **Optional**: Document in your report the design constraint that `VITE_QR_AES_KEY` must be in the browser (NFR02 offline QR generation requires client-side encryption). We hardened the gate endpoint to require auth+role on top of the HMAC, so a leaked key alone can't hit the endpoint, but the key itself can't be removed.

## Live verification checklist

Core features are deployed. Worth testing these flows against the live production URLs (staff/admin nav is new; gate-endpoint auth is hardened; UTC timestamps now display Vietnam local time):

**Auth** (`/register`, `/verify-email`, `/login`, `/verify-login-otp`)
- [ ] Register with a `@st.ueh.edu.vn` email → OTP (console or email) →
      verify → can log in.
- [ ] Login → OTP → lands on wallet page. Wrong password/OTP rejected.
- [ ] Non-`@st.ueh.edu.vn` email rejected at registration.

**Student wallet** (`/`, `/topup`, `/qr`, `/profile`)
- [ ] Wallet shows correct balance (a freshly registered account starts at 0đ;
      top up or use admin manual adjustment to add balance).
- [ ] Top-up creates a VietQR code; after a real SePay transfer (or
      simulated webhook call), balance updates and pending state clears.
- [ ] QR page shows a QR that visibly changes every ~30s.
- [ ] Profile shows correct user info; logout works.

**Gate verification** (`/gate-scanner`) — **[changed: DB-backed atomic anti-replay + auth hardening]**
- [ ] Scanning a valid QR debits the wallet by the calculated fee and shows
      success (with correct fee for the time of day, i.e., day rate before 18:00 VN).
- [ ] Scanning the **same** QR token again is rejected ("QR đã được sử dụng") — confirms atomic `INSERT IGNORE` works.
- [ ] Scanning with insufficient balance returns the friendly error (no
      debit).
- [ ] Expired/invalid TOTP rejected (and *not* consumed, so the next 30s code works).
- [ ] **[New]** Unauthenticated requests to `/api/gate/verify` return 401 (requires staff/admin JWT).

**Barrier simulator** (`/barrier`) — **[changed: polling instead of Socket.io]**
- [ ] After a successful gate scan (or admin manual-open), the barrier
      opens within ~2s and auto-closes after 10s.
- [ ] Switching the gate dropdown polls the newly selected gate.

**Admin/staff** (`/admin`, `/gate-scanner`, `/barrier`)
- [ ] After login, staff/admin land on `/admin` (not the student wallet).
- [ ] StaffNav bar is present; can navigate between Admin/Scanner/Barrier pages and logout.
- [ ] Search users/transactions/parking logs by MSSV, plate, or date range.
- [ ] Manual wallet adjustment changes balance and appears in transactions.
- [ ] Manual gate open triggers the barrier simulator (via `gate_events`).
- [ ] Excel export downloads a valid `.xlsx` with the expected rows.
- [ ] Wallet/transaction dates display in Vietnam local time (04:38 UTC+7, not 21:38 UTC).

**Cron / retry** — **[new]**
- [ ] `GET /api/cron/topup-retry` without/with wrong `Authorization`
      header → `401`; with correct `Bearer <CRON_SECRET>` → `200
      {"success":true}`.
- [ ] Old `gate_events`/`used_qr_tokens` rows get cleaned up
      (`expireOldGateEvents`).

**Build**
- [ ] `cd client && npm run build` succeeds with no Socket.io-related
      errors.
- [ ] `cd server && npm run dev` boots cleanly (no socket.io/cron import
      errors).
