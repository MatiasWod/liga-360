/** Acceso a datos de Team (y lectura de miembros). Recibe un client/pool pg. */
import { buildInviteCodeCandidate } from '../domain/invite.js';

const TEAM_COLS = 'id, name, owner_user_id, badge_url, invite_code, created_at, updated_at';
const TEAM_COLS_T = 't.id, t.name, t.owner_user_id, t.badge_url, t.invite_code, t.created_at, t.updated_at';

export async function listAll(client) {
  const r = await client.query(`SELECT ${TEAM_COLS} FROM "Team" ORDER BY id DESC`);
  return r.rows;
}

/** Equipos del usuario: propios (owner) ∪ vinculados vía Participant.person_profile_id. */
export async function listMine(client, userId, profileId) {
  const r = await client.query(
    `WITH owned AS (
       SELECT ${TEAM_COLS_T} FROM "Team" t WHERE t.owner_user_id = $1
     ),
     linked AS (
       SELECT DISTINCT ${TEAM_COLS_T}
       FROM "Team" t
       JOIN "Team_Member" tm ON tm.team_id = t.id
       JOIN "Participant" p ON p.id = tm.participant_id
       WHERE p.person_profile_id = $2
     )
     SELECT DISTINCT * FROM (
       SELECT * FROM owned
       UNION
       SELECT * FROM linked
     ) q
     ORDER BY id DESC`,
    [userId, profileId ?? null]
  );
  return r.rows;
}

export async function findById(client, teamId) {
  const r = await client.query(`SELECT ${TEAM_COLS} FROM "Team" WHERE id = $1 LIMIT 1`, [teamId]);
  return r.rows[0] || null;
}

export async function create(client, { name, ownerUserId, badgeUrl, accessCodeHash, inviteCode, now }) {
  const r = await client.query(
    `INSERT INTO "Team"(name, owner_user_id, badge_url, access_code_hash, invite_code, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING ${TEAM_COLS}`,
    [name, ownerUserId, badgeUrl ?? null, accessCodeHash, inviteCode, now]
  );
  return r.rows[0];
}

export async function update(client, teamId, { name, badgeUrl, now }) {
  const r = await client.query(
    `UPDATE "Team"
     SET name = COALESCE($2, name),
         badge_url = COALESCE($3, badge_url),
         updated_at = $4
     WHERE id = $1
     RETURNING ${TEAM_COLS}`,
    [teamId, name ?? null, badgeUrl ?? null, now]
  );
  return r.rows[0] || null;
}

export async function isOwner(client, teamId, userId) {
  if (!userId) return false;
  const r = await client.query(`SELECT 1 FROM "Team" WHERE id = $1 AND owner_user_id = $2`, [teamId, userId]);
  return r.rows.length > 0;
}

export async function getAccessCodeHash(client, teamId) {
  const r = await client.query(`SELECT access_code_hash FROM "Team" WHERE id = $1 LIMIT 1`, [teamId]);
  if (r.rows.length === 0) return undefined;
  return r.rows[0].access_code_hash;
}

export async function updateAccessCodeHash(client, teamId, accessCodeHash, now) {
  await client.query(`UPDATE "Team" SET access_code_hash = $2, updated_at = $3 WHERE id = $1`, [teamId, accessCodeHash, now]);
}

export async function findFirstOwnedByUser(client, userId) {
  const r = await client.query(
    `SELECT id, name, invite_code FROM "Team" WHERE owner_user_id = $1 ORDER BY id LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

export async function findByInviteCode(client, code) {
  const r = await client.query(
    `SELECT id, name, badge_url, invite_code FROM "Team" WHERE invite_code = $1 LIMIT 1`,
    [code]
  );
  return r.rows[0] || null;
}

async function inviteCodeExists(client, code) {
  const r = await client.query(`SELECT 1 FROM "Team" WHERE invite_code = $1 LIMIT 1`, [code]);
  return r.rows.length > 0;
}

/** Genera un invite code único `ABC-123` (candidatos puros + verificación en DB). */
export async function generateUniqueInviteCode(client, name, maxAttempts = 50) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildInviteCodeCandidate(name);
    if (!(await inviteCodeExists(client, candidate))) return candidate;
  }
  throw Object.assign(new Error('INVITE_CODE_GENERATION_FAILED'), { statusCode: 500, code: 'INVITE_CODE_GENERATION_FAILED' });
}

export async function getMembers(client, teamId) {
  // Cuando el participante está reclamado (person_profile_id), la identidad (nombre/dni/avatar)
  // proviene del Person_Profile (fuente de verdad); el nickname es propio del roster.
  const r = await client.query(
    `SELECT p.id,
            COALESCE(pp.first_name, p.first_name) AS first_name,
            COALESCE(pp.last_name, p.last_name)   AS last_name,
            p.nickname,
            COALESCE(pp.avatar_url, p.avatar_url) AS avatar_url,
            COALESCE(pp.dni, p.dni)               AS dni,
            p.person_profile_id
     FROM "Team_Member" tm
     JOIN "Participant" p ON p.id = tm.participant_id
     LEFT JOIN "Person_Profile" pp ON pp.id = p.person_profile_id
     WHERE tm.team_id = $1
     ORDER BY p.id`,
    [teamId]
  );
  return r.rows;
}

/** Equipos vinculados a un person_profile_id (para hidratar /profiles/me, ahora local). */
export async function listByProfileId(client, profileId) {
  const r = await client.query(
    `SELECT DISTINCT t.id, t.name, t.badge_url
     FROM "Team" t
     JOIN "Team_Member" tm ON tm.team_id = t.id
     JOIN "Participant" p ON p.id = tm.participant_id
     WHERE p.person_profile_id = $1
     ORDER BY t.id`,
    [profileId]
  );
  return r.rows;
}

/** Equipos cuyo owner es el usuario (para consumidores internos como inscriptions-svc). */
export async function listOwnedByUser(client, userId) {
  const r = await client.query(
    `SELECT id, name, badge_url, invite_code FROM "Team" WHERE owner_user_id = $1 ORDER BY id`,
    [userId]
  );
  return r.rows;
}

const NAME_NORM = `regexp_replace(lower(trim(name)), '[^a-z0-9]+', '', 'g')`;

/**
 * Equipos que coinciden con alguno de los ids o cuyo nombre normalizado coincide con
 * alguno de los nombres dados (para enriquecer inscripciones). Devuelve una colección
 * con `normalizedName` para que el consumidor arme su mapeo por id y por nombre.
 */
export async function findByIdsOrNames(client, ids = [], names = []) {
  const cleanIds = [...new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isInteger(n)))];
  const normOf = (s) => String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
  const norms = [...new Set((names || []).map(normOf).filter(Boolean))];
  if (cleanIds.length === 0 && norms.length === 0) return [];
  const r = await client.query(
    `SELECT id, name, badge_url, ${NAME_NORM} AS normalized_name
     FROM "Team"
     WHERE id = ANY($1::int[]) OR ${NAME_NORM} = ANY($2::text[])
     ORDER BY id`,
    [cleanIds, norms]
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    badge_url: row.badge_url,
    normalizedName: row.normalized_name,
  }));
}
