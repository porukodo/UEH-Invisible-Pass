import { Router } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
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

export default router;
