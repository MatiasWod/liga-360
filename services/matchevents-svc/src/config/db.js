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
