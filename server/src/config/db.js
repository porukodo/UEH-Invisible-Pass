import mysql from 'mysql2/promise';
import { env } from './env.js';

function createPool() {
  const newPool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: env.db.ssl ? 3 : 10,
    dateStrings: true,
    timezone: 'Z', // serialize JS Date params (e.g. OTP/token expiry) as UTC
    ...(env.db.ssl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
  });

  // Pin every connection's session timezone to UTC so CURRENT_TIMESTAMP / NOW()
  // are UTC in all environments (Vercel is already UTC; a local MySQL defaults
  // to the OS zone). Combined with `timezone: 'Z'`, every stored timestamp and
  // every "expires_at > NOW()" comparison is consistently UTC; clients convert
  // to local (Asia/Ho_Chi_Minh) for display.
  newPool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'", (err) => {
      if (err) console.error('[db] failed to set session time_zone:', err.message);
    });
  });

  return newPool;
}

// Cache the pool on globalThis so warm serverless invocations reuse the
// same connections instead of opening new ones on every request.
export const pool = globalThis.__mysqlPool ?? (globalThis.__mysqlPool = createPool());
