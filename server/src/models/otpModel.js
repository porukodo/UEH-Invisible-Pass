import { pool } from '../config/db.js';

export async function createOtp({ userId, codeHash, purpose, expiresAt }) {
  await pool.query(
    'INSERT INTO otp_codes (user_id, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?)',
    [userId, codeHash, purpose, expiresAt]
  );
}

/** Latest, unconsumed, non-expired OTP for a user + purpose. */
export async function findActiveOtp(userId, purpose) {
  const [rows] = await pool.query(
    `SELECT * FROM otp_codes
     WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  );
  return rows[0] || null;
}

export async function consumeOtp(id) {
  await pool.query('UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?', [id]);
}

/** Count OTPs issued for a user+purpose in the last windowMinutes (for rate-limiting). */
export async function countRecentOtps(userId, purpose, windowMinutes = 10) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM otp_codes
     WHERE user_id = ? AND purpose = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [userId, purpose, windowMinutes]
  );
  return Number(rows[0].cnt);
}
