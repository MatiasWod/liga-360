import pkg from 'pg';
import { env } from './env.js';

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: env.postgresUrl,
  allowExitOnIdle: env.nodeEnv === 'test',
});

export async function closePool() {
  await pool.end();
}

/**
 * Ejecuta `fn(client)` dentro de una transacción (BEGIN/COMMIT, ROLLBACK ante error).
 * El control transaccional vive en infraestructura; los servicios solo orquestan repositorios.
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
