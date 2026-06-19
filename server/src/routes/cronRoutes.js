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

// TEMPORARY — remove after migration succeeds.
const MIGRATION_TOKEN = 'c39e633f-c5ab-458b-b10e-1575cdb45085';
router.post('/run-migration', async (req, res, next) => {
  try {
    const tok = Buffer.from(String(req.headers['x-migration-token'] || ''));
    const exp = Buffer.from(MIGRATION_TOKEN);
    if (tok.length !== exp.length || !crypto.timingSafeEqual(tok, exp)) {
      throw new ApiError(401, 'Unauthorized');
    }

    const steps = [];

    // 1a. Extend parking_logs result enum + add session_id column
    await pool.query(`
      ALTER TABLE parking_logs
        MODIFY COLUMN result ENUM(
          'success','insufficient_balance','invalid_token','duplicate_token',
          'already_parked','no_session'
        ) NOT NULL,
        ADD COLUMN IF NOT EXISTS session_id BIGINT UNSIGNED DEFAULT NULL
    `);
    steps.push('parking_logs column added');

    // 1b. Add index on session_id (separate statement; TiDB rejects IF NOT EXISTS on KEY in same ALTER)
    try {
      await pool.query('ALTER TABLE parking_logs ADD KEY idx_pl_session (session_id)');
      steps.push('parking_logs index added');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        steps.push('parking_logs index already exists (skipped)');
      } else throw e;
    }

    // 2. Create parking_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parking_sessions (
        id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id        INT UNSIGNED NOT NULL,
        entry_gate_id  INT UNSIGNED NOT NULL,
        exit_gate_id   INT UNSIGNED DEFAULT NULL,
        entry_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        exit_at        DATETIME DEFAULT NULL,
        fee            DECIMAL(12,2) DEFAULT NULL,
        transaction_id BIGINT UNSIGNED DEFAULT NULL,
        status         ENUM('open','closed') NOT NULL DEFAULT 'open',
        PRIMARY KEY (id),
        KEY idx_ps_user_status (user_id, status),
        KEY idx_ps_entry_at (entry_at),
        CONSTRAINT fk_ps_user        FOREIGN KEY (user_id)        REFERENCES users(id)         ON DELETE CASCADE,
        CONSTRAINT fk_ps_entry_gate  FOREIGN KEY (entry_gate_id)  REFERENCES gates(id),
        CONSTRAINT fk_ps_exit_gate   FOREIGN KEY (exit_gate_id)   REFERENCES gates(id),
        CONSTRAINT fk_ps_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id)  ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
    steps.push('parking_sessions created');

    res.json({ success: true, steps });
  } catch (err) {
    next(err);
  }
});

export default router;
