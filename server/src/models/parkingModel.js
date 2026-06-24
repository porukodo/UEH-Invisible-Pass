import { pool } from '../config/db.js';

export async function insertParkingLog({ userId, gateId, transactionId, fee, result, sessionId }) {
  const [res] = await pool.query(
    `INSERT INTO parking_logs (user_id, gate_id, transaction_id, fee, result, session_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, gateId, transactionId || null, fee, result, sessionId || null]
  );
  return res.insertId;
}

export async function findOpenSession(userId) {
  const [rows] = await pool.query(
    `SELECT * FROM parking_sessions WHERE user_id = ? AND status = 'open' LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function createSession({ userId, entryGateId }) {
  const [res] = await pool.query(
    `INSERT INTO parking_sessions (user_id, entry_gate_id) VALUES (?, ?)`,
    [userId, entryGateId]
  );
  return res.insertId;
}

export async function closeSession({ sessionId, exitGateId, fee, transactionId }) {
  await pool.query(
    `UPDATE parking_sessions
     SET status = 'closed', exit_gate_id = ?, exit_at = NOW(), fee = ?, transaction_id = ?
     WHERE id = ?`,
    [exitGateId, fee, transactionId, sessionId]
  );
}

export async function listOpenSessions(userId) {
  const [rows] = await pool.query(
    `SELECT * FROM parking_sessions WHERE user_id = ? AND status = 'open' ORDER BY id`,
    [userId]
  );
  return rows;
}

/** Staff recovery: close stuck open sessions without charging the wallet. */
export async function forceCloseOpenSessions(userId) {
  const open = await listOpenSessions(userId);
  if (!open.length) return [];

  const [result] = await pool.query(
    `UPDATE parking_sessions
     SET status = 'closed', exit_at = NOW(), fee = 0, exit_gate_id = NULL, transaction_id = NULL
     WHERE user_id = ? AND status = 'open'`,
    [userId]
  );
  return { sessions: open, closedCount: result.affectedRows };
}

export async function searchParkingLogs({ q, from, to }) {
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('(u.mssv LIKE ? OR u.full_name LIKE ? OR u.license_plate LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (from) {
    conditions.push('p.scanned_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('p.scanned_at <= ?');
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT p.id, p.fee, p.result, p.scanned_at, p.session_id,
            g.name AS gate_name, g.type AS gate_type,
            u.mssv, u.full_name, u.license_plate
     FROM parking_logs p
     JOIN users u ON u.id = p.user_id
     JOIN gates g ON g.id = p.gate_id
     ${where}
     ORDER BY p.scanned_at DESC
     LIMIT 500`,
    params
  );
  return rows;
}
