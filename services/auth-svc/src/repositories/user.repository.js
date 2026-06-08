import pkg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pkg;
const pool = new Pool({
  connectionString: env.postgresUrl,
  allowExitOnIdle: env.nodeEnv === 'test',
});

export async function findByUsername(username) {
  const r = await pool.query(
    'SELECT id, username, password, type FROM "Users" WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return r.rows[0] || null;
}

export async function findById(id) {
  const r = await pool.query(
    'SELECT id, username, type FROM "Users" WHERE id = $1',
    [id]
  );
  return r.rows[0] || null;
}

export async function create({ username, password, type }) {
  const r = await pool.query(
    'INSERT INTO "Users"(username, password, type) VALUES ($1, $2, $3) RETURNING id, username, type',
    [username, password, type]
  );
  return r.rows[0];
}

export async function deleteById(id) {
  await pool.query('DELETE FROM "Users" WHERE id = $1', [id]);
}

export async function closePool() {
  await pool.end();
}
