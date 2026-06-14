import { pool } from '../config/db.js';

export async function createUser({ mssv, fullName, email, passwordHash, role, totpSecret }) {
  const [result] = await pool.query(
    `INSERT INTO users (mssv, full_name, email, password_hash, role, totp_secret)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [mssv, fullName, email, passwordHash, role, totpSecret]
  );
  return result.insertId;
}

export async function findUserByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

export async function findUserByMssv(mssv) {
  const [rows] = await pool.query('SELECT * FROM users WHERE mssv = ? LIMIT 1', [mssv]);
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function markEmailVerified(userId) {
  await pool.query('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [userId]);
}

export async function updateUnverifiedUser(id, { mssv, fullName, email, passwordHash, licensePlate }) {
  await pool.query(
    `UPDATE users SET mssv = ?, full_name = ?, email = ?, password_hash = ?, license_plate = ?
     WHERE id = ? AND email_verified_at IS NULL`,
    [mssv, fullName, email, passwordHash, licensePlate || null, id]
  );
}

export async function searchUsers({ q }) {
  const [rows] = await pool.query(
    `SELECT id, mssv, full_name, email, role, license_plate, status
     FROM users
     WHERE mssv LIKE ? OR license_plate LIKE ? OR full_name LIKE ?
     LIMIT 50`,
    [`%${q}%`, `%${q}%`, `%${q}%`]
  );
  return rows;
}
