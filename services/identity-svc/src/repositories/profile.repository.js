/** Acceso a datos de Person_Profile (identidad de usuario por DNI). */

const PROFILE_COLS = 'id, user_id, dni, first_name, last_name, avatar_url, created_at, updated_at';

export async function findByUserId(client, userId) {
  const r = await client.query(`SELECT ${PROFILE_COLS} FROM "Person_Profile" WHERE user_id = $1 LIMIT 1`, [userId]);
  return r.rows[0] || null;
}

export async function findByDni(client, dni) {
  const r = await client.query(`SELECT id, user_id FROM "Person_Profile" WHERE dni = $1 LIMIT 1`, [dni]);
  return r.rows[0] || null;
}

export async function upsertByUser(client, { userId, dni, firstName, lastName, avatarUrl, now }) {
  const r = await client.query(
    `INSERT INTO "Person_Profile"(user_id, dni, first_name, last_name, avatar_url, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6)
     ON CONFLICT (user_id) DO UPDATE
     SET dni = EXCLUDED.dni,
         first_name = COALESCE(EXCLUDED.first_name, "Person_Profile".first_name),
         last_name = COALESCE(EXCLUDED.last_name, "Person_Profile".last_name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, "Person_Profile".avatar_url),
         updated_at = EXCLUDED.updated_at
     RETURNING ${PROFILE_COLS}`,
    [userId, dni, firstName || null, lastName || null, avatarUrl || null, now]
  );
  return r.rows[0];
}
