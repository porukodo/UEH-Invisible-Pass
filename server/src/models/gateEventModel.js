import { pool } from '../config/db.js';

export async function insertGateEvent(gateId, payload) {
  await pool.query('INSERT INTO gate_events (gate_id, payload) VALUES (?, ?)', [
    gateId,
    JSON.stringify(payload),
  ]);
}

export async function listGateEventsAfter(gateId, afterId = 0) {
  const [rows] = await pool.query(
    'SELECT id, payload, created_at FROM gate_events WHERE gate_id = ? AND id > ? ORDER BY id ASC LIMIT 50',
    [gateId, afterId]
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    ...(typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload),
  }));
}

export async function expireOldGateEvents(maxAgeHours = 1) {
  await pool.query('DELETE FROM gate_events WHERE created_at < DATE_SUB(NOW(), INTERVAL ? HOUR)', [
    maxAgeHours,
  ]);
}
