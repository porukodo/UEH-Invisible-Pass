import { Router } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { pool } from '../config/db.js';
import { runRetryPass } from '../jobs/topupRetryJob.js';
import { ApiError } from '../middleware/errorHandler.js';

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
const CLEANUP_TOKEN = '45e40787-3b4d-491e-a6c3-6bce54cdeb76';
router.post('/cleanup-entry-charges', async (req, res, next) => {
  try {
    const tok = Buffer.from(String(req.headers['x-cleanup-token'] || ''));
    const exp = Buffer.from(CLEANUP_TOKEN);
    if (tok.length !== exp.length || !crypto.timingSafeEqual(tok, exp)) {
      throw new ApiError(401, 'Unauthorized');
    }

    // 1. Find all charge transactions that came from entry-gate scans
    const [entryCharges] = await pool.query(`
      SELECT t.id, t.user_id, t.amount
      FROM transactions t
      JOIN parking_logs pl ON pl.transaction_id = t.id
      JOIN gates g ON g.id = pl.gate_id
      WHERE g.type = 'entry' AND t.type = 'charge'
    `);

    // 2. Restore wallet balances (amount is negative, subtracting it adds back)
    for (const charge of entryCharges) {
      await pool.query(
        'UPDATE wallets SET balance = balance - ? WHERE user_id = ?',
        [charge.amount, charge.user_id]
      );
    }

    // 3. Nullify parking_log references before deleting transactions
    await pool.query(`
      UPDATE parking_logs pl
      JOIN transactions t ON t.id = pl.transaction_id
      JOIN gates g ON g.id = pl.gate_id
      SET pl.transaction_id = NULL, pl.fee = 0
      WHERE g.type = 'entry' AND t.type = 'charge'
    `);

    // 4. Delete the entry-gate charge transactions
    let deleted = 0;
    if (entryCharges.length > 0) {
      const ids = entryCharges.map((c) => c.id);
      const [result] = await pool.query(
        `DELETE FROM transactions WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      deleted = result.affectedRows;
    }

    // 5. Fix gate names to proper Vietnamese
    await pool.query(`
      UPDATE gates SET
        name     = CASE id WHEN 1 THEN 'Cổng A' WHEN 2 THEN 'Cổng A' WHEN 3 THEN 'Cổng B' WHEN 4 THEN 'Cổng B' ELSE name END,
        location = CASE id WHEN 1 THEN 'Cơ sở A' WHEN 2 THEN 'Cơ sở A' WHEN 3 THEN 'Cơ sở B' WHEN 4 THEN 'Cơ sở B' ELSE location END
      WHERE id IN (1, 2, 3, 4)
    `);

    res.json({ refunded: entryCharges.length, deleted, gatesFixed: 4 });
  } catch (err) {
    next(err);
  }
});

export default router;
