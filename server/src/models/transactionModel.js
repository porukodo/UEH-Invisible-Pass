import { pool } from '../config/db.js';

export async function listTransactionsByUser(userId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT id, type, amount, balance_after, status, gateway_ref, description, created_at
     FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

export async function findTransactionByGatewayRef(gatewayRef) {
  const [rows] = await pool.query('SELECT * FROM transactions WHERE gateway_ref = ? LIMIT 1', [gatewayRef]);
  return rows[0] || null;
}

export async function searchTransactions({ mssv, from, to }) {
  const conditions = [];
  const params = [];

  if (mssv) {
    conditions.push('u.mssv LIKE ?');
    params.push(`%${mssv}%`);
  }
  if (from) {
    conditions.push('t.created_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('t.created_at <= ?');
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT t.id, t.type, t.amount, t.balance_after, t.status, t.gateway_ref, t.description, t.created_at,
            u.mssv, u.full_name
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT 500`,
    params
  );
  return rows;
}
