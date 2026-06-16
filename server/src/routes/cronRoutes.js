import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { runRetryPass } from '../jobs/topupRetryJob.js';
import { ApiError } from '../middleware/errorHandler.js';
import { generateTotpSecret } from '../utils/crypto.js';
import { findUserByEmail, createUser } from '../models/userModel.js';
import { createWallet } from '../models/walletModel.js';

const router = Router();

function requireCronAuth(req) {
  if (!env.cronSecret) throw new ApiError(500, 'Cron secret not configured');
  const expected = Buffer.from(`Bearer ${env.cronSecret}`);
  const actual = Buffer.from(String(req.headers.authorization || ''));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new ApiError(401, 'Unauthorized');
  }
}

/** NFR09 fallback sweep, triggered by Vercel Cron in place of node-cron in serverless. */
router.get('/topup-retry', async (req, res, next) => {
  try {
    requireCronAuth(req);
    await runRetryPass();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// TEMPORARY — remove after first successful call.
// Creates the two additional admin accounts (Hoàng and Quang).
// Call once with: curl -X POST <server>/api/cron/seed-admins \
//                     -H "Authorization: Bearer <CRON_SECRET>"
const ADMIN_SEED = [
  {
    mssv: '31231024973',
    fullName: 'Nguyễn Hoàng',
    email: 'hoangnguyen.31231024973+test1@st.ueh.edu.vn',
    role: 'admin',
  },
  {
    mssv: '31231024833',
    fullName: 'Huỳnh Nhật Quang',
    email: 'quanghuynh.31231024833+test1@st.ueh.edu.vn',
    role: 'admin',
  },
];

router.post('/seed-admins', async (req, res, next) => {
  try {
    requireCronAuth(req);

    const PASSWORD = '123456';
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const created = [];
    const skipped = [];

    for (const u of ADMIN_SEED) {
      const existing = await findUserByEmail(u.email);
      if (existing) {
        skipped.push(u.email);
        continue;
      }
      const totpSecret = generateTotpSecret();
      const userId = await createUser({
        mssv: u.mssv,
        fullName: u.fullName,
        email: u.email,
        passwordHash,
        role: u.role,
        totpSecret,
      });
      await createWallet(userId);
      await pool.query(
        'UPDATE users SET email_verified_at = NOW() WHERE id = ?',
        [userId]
      );
      created.push(u.email);
    }

    res.json({ created, skipped });
  } catch (err) {
    next(err);
  }
});

export default router;
