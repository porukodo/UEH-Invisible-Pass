import crypto from 'crypto';
import { pool } from '../config/db.js';

/**
 * Inserts the row first to get its id, then derives a short `UEHIP<id>`
 * gateway_ref from it - VietQR's transfer-content field is size-limited
 * (and SePay's VietinBank link requires it to start with "SEVQR "), so the
 * old `UEHIP<userId><timestamp>` ref was too long to fit alongside that.
 */
export async function createTopupRequest({ userId, amount }) {
  // gateway_ref is UNIQUE, and this placeholder is briefly written before
  // being replaced below - add randomness so two requests from the same
  // user in the same millisecond (e.g. a double-tap) can't collide on it.
  const placeholder = `PENDING${userId}${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
  const [result] = await pool.query(
    `INSERT INTO topup_requests (user_id, amount, gateway_ref, status) VALUES (?, ?, ?, 'pending')`,
    [userId, amount, placeholder]
  );
  const gatewayRef = `UEHIP${result.insertId}`;
  await pool.query('UPDATE topup_requests SET gateway_ref = ? WHERE id = ?', [gatewayRef, result.insertId]);
  return gatewayRef;
}

export async function findTopupByGatewayRef(gatewayRef) {
  const [rows] = await pool.query('SELECT * FROM topup_requests WHERE gateway_ref = ? LIMIT 1', [gatewayRef]);
  return rows[0] || null;
}

export async function markTopupStatus(id, status) {
  await pool.query('UPDATE topup_requests SET status = ?, last_checked_at = NOW() WHERE id = ?', [status, id]);
}

/** NFR09: requests still pending after creation, eligible for another retry check. */
export async function getPendingTopupsForRetry(maxRetries = 3, intervalMinutes = 15) {
  const [rows] = await pool.query(
    `SELECT * FROM topup_requests
     WHERE status = 'pending'
       AND retry_count < ?
       AND (last_checked_at IS NULL OR last_checked_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE))
       AND created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)`,
    [maxRetries, intervalMinutes]
  );
  return rows;
}

export async function incrementTopupRetry(id) {
  await pool.query(
    'UPDATE topup_requests SET retry_count = retry_count + 1, last_checked_at = NOW() WHERE id = ?',
    [id]
  );
}

export async function expireStaleTopups(maxRetries = 3) {
  await pool.query(
    `UPDATE topup_requests SET status = 'expired'
     WHERE status = 'pending' AND retry_count >= ?`,
    [maxRetries]
  );
}
