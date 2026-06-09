/** Acceso a datos de Participant. person_profile_id referencia a Person_Profile (misma DB, FK real). */

const PARTICIPANT_COLS =
  'id, name, first_name, last_name, nickname, dni, avatar_url, person_profile_id, created_by_user_id, created_at, updated_at';

export async function create(client, { displayName, firstName, lastName, nickname, dni, avatarUrl, createdByUserId, now }) {
  const r = await client.query(
    `INSERT INTO "Participant"(
       name, first_name, last_name, nickname, dni, avatar_url, created_by_user_id, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     RETURNING ${PARTICIPANT_COLS}`,
    [displayName, firstName, lastName, nickname ?? null, dni ?? null, avatarUrl ?? null, createdByUserId ?? null, now]
  );
  return r.rows[0];
}

/**
 * Update parcial. Para limpiar un campo opcional se pasa el centinela '__CLEAR__'
 * (nickname/dni/avatarUrl); null/undefined deja el valor previo (COALESCE).
 */
export async function update(client, participantId, { firstName, lastName, nickname, dni, avatarUrl, now }) {
  const r = await client.query(
    `UPDATE "Participant"
     SET first_name = COALESCE($2, first_name),
         last_name = COALESCE($3, last_name),
         nickname = CASE WHEN $4 = '__CLEAR__' THEN NULL ELSE COALESCE($4, nickname) END,
         dni = CASE WHEN $5 = '__CLEAR__' THEN NULL ELSE COALESCE($5, dni) END,
         avatar_url = CASE WHEN $6 = '__CLEAR__' THEN NULL ELSE COALESCE($6, avatar_url) END,
         name = CONCAT(COALESCE($2, first_name), ' ', COALESCE($3, last_name)),
         updated_at = $7
     WHERE id = $1
     RETURNING ${PARTICIPANT_COLS}`,
    [participantId, firstName ?? null, lastName ?? null, nickname ?? null, dni ?? null, avatarUrl ?? null, now]
  );
  return r.rows[0] || null;
}

export async function setPersonProfileId(client, participantId, personProfileId, now) {
  await client.query(
    `UPDATE "Participant" SET person_profile_id = $1, updated_at = $2 WHERE id = $3`,
    [personProfileId, now, participantId]
  );
}

/** Participantes vinculados a un profile (para /profiles/me). */
export async function listByProfileId(client, personProfileId) {
  // Identidad (nombre/dni/avatar) desde el Person_Profile reclamado; nickname propio del roster.
  const r = await client.query(
    `SELECT p.id,
            COALESCE(pp.first_name, p.first_name) AS first_name,
            COALESCE(pp.last_name, p.last_name)   AS last_name,
            p.nickname,
            COALESCE(pp.dni, p.dni)               AS dni,
            COALESCE(pp.avatar_url, p.avatar_url) AS avatar_url,
            p.person_profile_id
     FROM "Participant" p
     LEFT JOIN "Person_Profile" pp ON pp.id = p.person_profile_id
     WHERE p.person_profile_id = $1
     ORDER BY p.id`,
    [personProfileId]
  );
  return r.rows;
}

/** Vincula por DNI todos los participantes con ese dni al profile dado; devuelve ids. */
export async function linkByDni(client, dni, personProfileId, now) {
  const r = await client.query(
    `UPDATE "Participant"
     SET person_profile_id = $1, updated_at = $3
     WHERE dni = $2
     RETURNING id`,
    [personProfileId, dni, now]
  );
  return r.rows.map((row) => row.id);
}

/** Desvincula un participante de un profile (si le pertenece); limpia dni. Devuelve id o null. */
export async function unlinkFromProfile(client, participantId, personProfileId, now) {
  const r = await client.query(
    `UPDATE "Participant"
     SET person_profile_id = NULL, dni = NULL, updated_at = $3
     WHERE id = $1 AND person_profile_id = $2
     RETURNING id`,
    [participantId, personProfileId, now]
  );
  return r.rows[0]?.id ?? null;
}
