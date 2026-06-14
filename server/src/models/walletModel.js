import { pool } from '../config/db.js';

export async function createWallet(userId, conn = pool) {
  await conn.query('INSERT INTO wallets (user_id, balance) VALUES (?, 0)', [userId]);
}

export async function getWallet(userId) {
  const [rows] = await pool.query('SELECT * FROM wallets WHERE user_id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

/**
 * Apply a balance delta inside a transaction and record the ledger entry.
 * Throws if the resulting balance would be negative (insufficient funds).
 * Returns the resulting transaction row id and new balance.
 */
export async function applyLedgerEntry({ userId, type, amount, gatewayRef, description, createdBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [walletRows] = await conn.query(
      'SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    if (!walletRows[0]) throw new Error('Wallet not found');

    const currentBalance = Number(walletRows[0].balance);
    const newBalance = Number((currentBalance + Number(amount)).toFixed(2));

    if (newBalance < 0) {
      const err = new Error('Insufficient balance');
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    await conn.query('UPDATE wallets SET balance = ? WHERE user_id = ?', [newBalance, userId]);

    const [txResult] = await conn.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, gateway_ref, description, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'success')`,
      [userId, type, amount, newBalance, gatewayRef || null, description || null, createdBy || null]
    );

    await conn.commit();
    return { transactionId: txResult.insertId, balance: newBalance };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
