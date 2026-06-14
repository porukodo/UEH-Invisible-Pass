import { pool } from '../config/db.js';

export async function listGates() {
  const [rows] = await pool.query('SELECT * FROM gates ORDER BY id');
  return rows;
}

export async function findGateById(id) {
  const [rows] = await pool.query('SELECT * FROM gates WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
