/** Acceso a datos de Inscription. Recibe un client/pool pg (las transacciones las maneja el servicio). */

const COLS = `id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id,
  linked_participant_user_id, status, source, weight, tournament_rating, created_by_user_id, reviewed_by_user_id, created_at, updated_at`;

/** Lock transaccional por clave (advisory) para evitar carreras en duplicados/cupos. */
export async function acquireAdvisoryLock(client, key) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
}

/** Inserta una inscripción. status/source se castean a sus enums. */
export async function insert(client, {
  tournamentId, competitionId, competitorKind, displayName,
  linkedTeamId = null, linkedParticipantUserId = null, status, source,
  createdByUserId = null, reviewedByUserId = null, now,
}) {
  const r = await client.query(
    `INSERT INTO "Inscription"(
       tournament_id, competition_id, competitor_kind, display_name, linked_team_id, linked_participant_user_id,
       status, source, created_by_user_id, reviewed_by_user_id, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::inscription_status_enum,$8::inscription_source_enum,$9,$10,$11,$11)
     RETURNING ${COLS}`,
    [tournamentId, competitionId, competitorKind, displayName, linkedTeamId, linkedParticipantUserId,
      status, source, createdByUserId, reviewedByUserId, now]
  );
  return r.rows[0];
}

export async function findById(client, id) {
  const r = await client.query(`SELECT ${COLS} FROM "Inscription" WHERE id = $1 LIMIT 1`, [id]);
  return r.rows[0] || null;
}

export async function findByIdForUpdate(client, id) {
  const r = await client.query(`SELECT ${COLS} FROM "Inscription" WHERE id = $1 LIMIT 1 FOR UPDATE`, [id]);
  return r.rows[0] || null;
}

/** Inscripción activa (no RECHAZADO) más reciente por equipo, con FOR UPDATE. */
export async function findActiveByTeamForUpdate(client, tournamentId, teamId) {
  const r = await client.query(
    `SELECT id, status FROM "Inscription"
     WHERE tournament_id = $1 AND linked_team_id = $2 AND status <> 'RECHAZADO'
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [tournamentId, teamId]
  );
  return r.rows[0] || null;
}

export async function findActiveByParticipantForUpdate(client, tournamentId, userId) {
  const r = await client.query(
    `SELECT id, status FROM "Inscription"
     WHERE tournament_id = $1 AND linked_participant_user_id = $2 AND status <> 'RECHAZADO'
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [tournamentId, userId]
  );
  return r.rows[0] || null;
}

export async function existsActiveByTeam(client, tournamentId, teamId, excludeId = null) {
  const r = await client.query(
    `SELECT id FROM "Inscription"
     WHERE tournament_id = $1 AND linked_team_id = $2 AND status <> 'RECHAZADO'
       AND ($3::INT IS NULL OR id <> $3)
     LIMIT 1`,
    [tournamentId, Number(teamId), excludeId ? Number(excludeId) : null]
  );
  return r.rows.length > 0;
}

export async function existsActiveByParticipant(client, tournamentId, userId, excludeId = null) {
  const r = await client.query(
    `SELECT id FROM "Inscription"
     WHERE tournament_id = $1 AND linked_participant_user_id = $2 AND status <> 'RECHAZADO'
       AND ($3::INT IS NULL OR id <> $3)
     LIMIT 1`,
    [tournamentId, Number(userId), excludeId ? Number(excludeId) : null]
  );
  return r.rows.length > 0;
}

export async function existsActiveByName(client, tournamentId, displayName, excludeId = null) {
  const r = await client.query(
    `SELECT id FROM "Inscription"
     WHERE tournament_id = $1 AND linked_team_id IS NULL AND status <> 'RECHAZADO'
       AND LOWER(TRIM(display_name)) = LOWER(TRIM($2))
       AND ($3::INT IS NULL OR id <> $3)
     LIMIT 1`,
    [tournamentId, displayName, excludeId ? Number(excludeId) : null]
  );
  return r.rows.length > 0;
}

/** linked_team_id distintos del usuario en el torneo (regla de asociación única de equipo). */
export async function distinctTeamLinksByCreator(client, tournamentId, userId, excludeId) {
  const r = await client.query(
    `SELECT DISTINCT linked_team_id FROM "Inscription"
     WHERE tournament_id = $1 AND created_by_user_id = $2 AND status <> 'RECHAZADO'
       AND linked_team_id IS NOT NULL AND id <> $3`,
    [tournamentId, userId, excludeId]
  );
  return r.rows;
}

export async function updateStatus(client, id, status, reviewedByUserId, now) {
  const r = await client.query(
    `UPDATE "Inscription"
     SET status = $2::inscription_status_enum, reviewed_by_user_id = $3, updated_at = $4
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, status, reviewedByUserId, now]
  );
  return r.rows[0] || null;
}

export async function countAcceptedByCompetition(client, competitionId) {
  const r = await client.query(
    `SELECT COUNT(*)::INT AS count_accepted FROM "Inscription"
     WHERE competition_id = $1 AND status = 'ACEPTADO'`,
    [competitionId]
  );
  return Number(r.rows[0].count_accepted || 0);
}

export async function updateTournamentRating(client, id, tournamentRating, now) {
  const r = await client.query(
    `UPDATE "Inscription"
     SET tournament_rating = $2, updated_at = $3
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, tournamentRating, now]
  );
  return r.rows[0] || null;
}

export async function updateWeight(client, id, weight, now) {
  const r = await client.query(
    `UPDATE "Inscription"
     SET weight = $2, updated_at = $3
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, weight, now]
  );
  return r.rows[0] || null;
}

export async function updateCompetition(client, id, competitionId, displayName, now) {
  const r = await client.query(
    `UPDATE "Inscription"
     SET competition_id = $2, display_name = COALESCE($3, display_name), updated_at = $4
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, competitionId, displayName, now]
  );
  return r.rows[0] || null;
}

export async function associateTeam(client, id, teamId, displayName, now) {
  const r = await client.query(
    `UPDATE "Inscription"
     SET linked_team_id = $2, display_name = $3, updated_at = $4
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, teamId, displayName, now]
  );
  return r.rows[0] || null;
}

/** Completa la inscripción objetivo de un invite targeted (display opcional, pasa a ACEPTADO). */
export async function completeTargetFromInvite(client, id, displayName, reviewedByUserId, now) {
  const r = await client.query(
    `UPDATE "Inscription"
     SET display_name = COALESCE(NULLIF($2, ''), display_name),
         status = 'ACEPTADO',
         reviewed_by_user_id = COALESCE($4, reviewed_by_user_id),
         source = 'invitation',
         updated_at = $3
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, displayName, now, reviewedByUserId]
  );
  return r.rows[0] || null;
}

const LIST_COLS = `i.id, i.tournament_id, i.competition_id, i.competitor_kind, i.display_name,
  i.linked_team_id, i.linked_participant_user_id, i.status, i.source, i.weight, i.tournament_rating,
  i.created_by_user_id, i.reviewed_by_user_id, i.created_at, i.updated_at`;

// ORDER BY created_at DESC con desempate por id para que el paginado por offset sea estable.
export async function listByTournament(client, tournamentId, competitionId = null, { limit = 200, offset = 0 } = {}) {
  if (competitionId) {
    const r = await client.query(
      `SELECT ${LIST_COLS} FROM "Inscription" i
       WHERE i.tournament_id = $1 AND i.competition_id = $2
       ORDER BY i.created_at DESC, i.id DESC
       LIMIT $3 OFFSET $4`,
      [tournamentId, competitionId, limit, offset]
    );
    return r.rows;
  }
  const r = await client.query(
    `SELECT ${LIST_COLS} FROM "Inscription" i
     WHERE i.tournament_id = $1
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $2 OFFSET $3`,
    [tournamentId, limit, offset]
  );
  return r.rows;
}

export async function listByCompetition(client, competitionId, { limit = 200, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT ${LIST_COLS} FROM "Inscription" i
     WHERE i.competition_id = $1
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $2 OFFSET $3`,
    [competitionId, limit, offset]
  );
  return r.rows;
}

/** Todas las inscripciones históricas de un equipo (incluye rechazadas). */
export async function listByTeam(client, teamId, { limit = 200, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT ${LIST_COLS} FROM "Inscription" i
     WHERE i.linked_team_id = $1
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $2 OFFSET $3`,
    [Number(teamId), limit, offset]
  );
  return r.rows;
}

/** Lookup público por ids (frontend compone mano a mano: inscription → linked_team_id). */
export async function findByIds(client, ids) {
  const numericIds = (ids || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (numericIds.length === 0) return [];
  const r = await client.query(
    `SELECT id, tournament_id, competition_id, competitor_kind, display_name, linked_team_id, status, weight, tournament_rating
     FROM "Inscription" WHERE id = ANY($1::int[])
     ORDER BY created_at DESC`,
    [numericIds]
  );
  return r.rows;
}
