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

## What's left to do

1. **Provision a production database** — TiDB Cloud Serverless via the
   Vercel Marketplace (Storage tab), then run `database/schema.sql` and
   `database/data.sql` (or just the new-table snippet if reusing an
   existing DB). Details in the README.
2. **Create two Vercel projects**:
   - `server/` (root directory `server`) — set all env vars from
     `server/.env.example` (DB creds + `DB_SSL=true`, `JWT_SECRET`,
     `CLIENT_ORIGIN`, SMTP, VietQR, `GATE_HMAC_SECRET`, `QR_AES_KEY`,
     `SEPAY_API_KEY`, `CRON_SECRET`).
   - `client/` (root directory `client`) — set `VITE_API_URL` (server
     project URL), `VITE_QR_AES_KEY`, `VITE_GATE_HMAC_SECRET` (must match
     server).
3. **Deploy both** (`vercel` then `vercel --prod` in each directory), then
   set `CLIENT_ORIGIN` (server) and `VITE_API_URL` (client) to each other's
   real URLs and redeploy if needed.
4. **Point the SePay webhook** at
   `https://<server-project>.vercel.app/api/wallet/webhook` (ngrok no
   longer needed).
5. Double-check Vercel Cron is registered for `/api/cron/topup-retry` — on
   the Hobby plan this only runs ~once/day, which is fine since it's just a
   fallback for top-ups that never got a webhook.

## Re-verification checklist

Worth re-testing end-to-end after the refactor above (especially items
marked **[changed]**), ideally once locally and again after the Vercel
deploy:

**Auth** (`/register`, `/verify-email`, `/login`, `/verify-login-otp`)
- [ ] Register with a `@st.ueh.edu.vn` email → OTP (console or email) →
      verify → can log in.
- [ ] Login → OTP → lands on wallet page. Wrong password/OTP rejected.
- [ ] Non-`@st.ueh.edu.vn` email rejected at registration.

**Student wallet** (`/`, `/topup`, `/qr`, `/profile`)
- [ ] Wallet shows correct balance (demo student starts at 100,000đ).
- [ ] Top-up creates a VietQR code; after a real SePay transfer (or
      simulated webhook call), balance updates and pending state clears.
- [ ] QR page shows a QR that visibly changes every ~30s.
- [ ] Profile shows correct user info; logout works.

**Gate verification** (`/gate-scanner`) — **[changed: DB-backed anti-replay]**
- [ ] Scanning a valid QR debits the wallet by the calculated fee and shows
      success.
- [ ] Scanning the **same** QR token again is rejected ("QR da duoc su
      dung") — confirms `used_qr_tokens` works.
- [ ] Scanning with insufficient balance returns the friendly error (no
      debit).
- [ ] Expired/invalid TOTP rejected.

**Barrier simulator** (`/barrier`) — **[changed: polling instead of Socket.io]**
- [ ] After a successful gate scan (or admin manual-open), the barrier
      opens within ~2s and auto-closes after 10s.
- [ ] Switching the gate dropdown polls the newly selected gate.

**Admin/staff** (`/admin`)
- [ ] Search users/transactions/parking logs by MSSV, plate, or date range.
- [ ] Manual wallet adjustment changes balance and appears in transactions.
- [ ] Manual gate open triggers the barrier simulator (via `gate_events`).
- [ ] Excel export downloads a valid `.xlsx` with the expected rows.

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
