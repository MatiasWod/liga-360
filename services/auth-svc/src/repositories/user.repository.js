import pkg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pkg;
const pool = new Pool({
  connectionString: env.postgresUrl,
  allowExitOnIdle: env.nodeEnv === 'test',
});

export async function findByUsername(username) {
  const r = await pool.query(
    'SELECT id, username, password, type, "isVerified", banned_at FROM "Users" WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return r.rows[0] || null;
}

export async function findById(id) {
  const r = await pool.query(
      'SELECT id, username, email, type, "isVerified", banned_at FROM "Users" WHERE id = $1',
      [id]
  );
  return r.rows[0] || null;
}

export async function findAll({ limit, offset } = {}) {
  const r = await pool.query(
      'SELECT id, username, email, type, "isVerified", banned_at FROM "Users" ORDER BY id LIMIT $1 OFFSET $2',
      [limit, offset]
  );
  return r.rows;
}

export async function create({ username, email, password, type, isVerified = false }) {
  const r = await pool.query(
      'INSERT INTO "Users"(username, email, password, type, "isVerified") VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, type, "isVerified"',
      [username, email, password, type, isVerified]
  );
  return r.rows[0];
}

// Claim atómico: solo una request concurrente obtiene la fila (las demás reciben null).
export async function markVerified(id) {
  const r = await pool.query(
      'UPDATE "Users" SET "isVerified" = true WHERE id = $1 AND NOT "isVerified" RETURNING id, username, type, "isVerified"',
      [id]
  );
  return r.rows[0] || null;
}

// COALESCE preserva el timestamp del primer baneo: re-banear es un no-op idempotente.
export async function ban(id) {
  const r = await pool.query(
      'UPDATE "Users" SET banned_at = COALESCE(banned_at, now()) WHERE id = $1 RETURNING id, username, email, type, "isVerified", banned_at',
      [id]
  );
  return r.rows[0] || null;
}

export async function unban(id) {
  const r = await pool.query(
      'UPDATE "Users" SET banned_at = NULL WHERE id = $1 RETURNING id, username, email, type, "isVerified", banned_at',
      [id]
  );
  return r.rows[0] || null;
}

export async function deleteById(id) {
  await pool.query('DELETE FROM "Users" WHERE id = $1', [id]);
}

export async function update(id, updateData) {
  const keys = Object.keys(updateData);
  if (keys.length === 0) return null;

  // Crea la parte del SET: '"isVerified" = $1'
  const setString = keys.map((key, index) => `"${key}" = $${index + 1}`).join(', ');

  // Array de valores: [true]
  const values = Object.values(updateData);

  // Agregamos el id al final del array para el WHERE
  values.push(id);

  const query = `
    UPDATE "Users"
    SET ${setString}
    WHERE id = $${values.length}
    RETURNING id, username, type, "isVerified"
  `;

  const r = await pool.query(query, values);
  return r.rows[0] || null;
}

export async function closePool() {
  await pool.end();
}
