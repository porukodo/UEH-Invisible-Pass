import mysql from 'mysql2/promise';
import { env } from './env.js';

function createPool() {
  return mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: env.db.ssl ? 3 : 10,
    dateStrings: true,
    ...(env.db.ssl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
  });
}

// Cache the pool on globalThis so warm serverless invocations reuse the
// same connections instead of opening new ones on every request.
export const pool = globalThis.__mysqlPool ?? (globalThis.__mysqlPool = createPool());
