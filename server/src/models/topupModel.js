import { pool } from '../config/db.js';

export async function createTopupRequest({ userId, amount, gatewayRef }) {
  const [result] = await pool.query(
    `INSERT INTO topup_requests (user_id, amount, gateway_ref, status) VALUES (?, ?, ?, 'pending')`,
    [userId, amount, gatewayRef]
  );
  return result.insertId;
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
