import crypto from 'crypto';
import { pool } from '../config/db.js';
import { TOTP_STEP } from '../utils/crypto.js';

// Anti-replay window (FR13): a QR token stays "used" for slightly longer
// than the TOTP verification window (current step + previous step).
const TTL_MS = (TOTP_STEP * 2 + 5) * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function isTokenUsed(token) {
  const [rows] = await pool.query(
    'SELECT 1 FROM used_qr_tokens WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
    [hashToken(token)]
  );
  return rows.length > 0;
}

/**
 * Atomically claim a QR token for redemption (FR13 anti-replay). Relies on the
 * PRIMARY KEY on token_hash: `INSERT IGNORE` inserts exactly once, so the call
 * that gets affectedRows === 1 is the sole winner even under concurrent scans.
 * Returns false if the token was already claimed (replay), guarding against a
 * double-charge race that a separate check-then-insert would allow.
 */
export async function claimToken(token) {
  const expiresAt = new Date(Date.now() + TTL_MS);
  const [result] = await pool.query(
    'INSERT IGNORE INTO used_qr_tokens (token_hash, expires_at) VALUES (?, ?)',
    [hashToken(token), expiresAt]
  );
  return result.affectedRows === 1;
}
