import { pool } from '../config/db.js';

export async function insertParkingLog({ userId, gateId, transactionId, fee, result }) {
  const [res] = await pool.query(
    `INSERT INTO parking_logs (user_id, gate_id, transaction_id, fee, result)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, gateId, transactionId || null, fee, result]
  );
  return res.insertId;
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
    `SELECT p.id, p.fee, p.result, p.scanned_at, g.name AS gate_name, g.type AS gate_type,
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
