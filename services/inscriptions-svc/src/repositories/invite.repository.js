/** Acceso a datos de Invite. */

const COLS = `id, token, tournament_id, competition_id, type, target_inscription_id, target_team_code,
  target_participant_user_id, status, expires_at, max_uses, uses_count, created_at, invite_response_status`;

export async function tokenExists(client, token) {
  const r = await client.query(`SELECT 1 FROM "Invite" WHERE token = $1 LIMIT 1`, [token]);
  return r.rows.length > 0;
}

export async function create(client, {
  token, tournamentId, competitionId, type, targetInscriptionId = null, targetTeamCode = null,
  targetParticipantUserId = null, expiresAt = null, maxUses = null, now,
}) {
  const r = await client.query(
    `INSERT INTO "Invite"(
       token, tournament_id, competition_id, type, target_inscription_id, target_team_code, target_participant_user_id,
       status, expires_at, max_uses, uses_count, created_at, invite_response_status
     ) VALUES ($1,$2,$3,$4::invite_type_enum,$5,$6,$7,'active',$8,$9,0,$10,'pending')
     RETURNING ${COLS}`,
    [token, tournamentId, competitionId, type, targetInscriptionId, targetTeamCode, targetParticipantUserId, expiresAt, maxUses, now]
  );
  return r.rows[0];
}

export async function listByCompetition(client, competitionId, { limit = 200, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT ${COLS} FROM "Invite" WHERE competition_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [competitionId, limit, offset]
  );
  return r.rows;
}

export async function listByTournament(client, tournamentId, { limit = 200, offset = 0 } = {}) {
  const r = await client.query(
    `SELECT ${COLS} FROM "Invite" WHERE tournament_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [tournamentId, limit, offset]
  );
  return r.rows;
}

export async function findByToken(client, token) {
  const r = await client.query(`SELECT ${COLS} FROM "Invite" WHERE token = $1 LIMIT 1`, [token]);
  return r.rows[0] || null;
}

export async function findByTokenForUpdate(client, token) {
  const r = await client.query(`SELECT ${COLS} FROM "Invite" WHERE token = $1 LIMIT 1 FOR UPDATE`, [token]);
  return r.rows[0] || null;
}

export async function findByIdForUpdate(client, id) {
  const r = await client.query(`SELECT ${COLS} FROM "Invite" WHERE id = $1 LIMIT 1 FOR UPDATE`, [id]);
  return r.rows[0] || null;
}

export async function listTargetedByTeamCode(client, teamCode) {
  const r = await client.query(
    `SELECT ${COLS} FROM "Invite"
     WHERE type = 'targeted' AND UPPER(COALESCE(target_team_code, '')) = UPPER($1)
     ORDER BY created_at DESC`,
    [teamCode]
  );
  return r.rows;
}

export async function listTargetedByParticipant(client, userId) {
  const r = await client.query(
    `SELECT ${COLS} FROM "Invite"
     WHERE type = 'targeted' AND target_participant_user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return r.rows;
}

export async function incrementUses(client, id) {
  await client.query(`UPDATE "Invite" SET uses_count = uses_count + 1 WHERE id = $1`, [id]);
}

/** Revoca tras aceptar (usado por use targeted + accept team/participant). */
export async function revokeAccepted(client, id) {
  await client.query(
    `UPDATE "Invite" SET status = 'revoked', uses_count = uses_count + 1, invite_response_status = 'accepted' WHERE id = $1`,
    [id]
  );
}

export async function rejectByTeamCode(client, id, teamCode) {
  const r = await client.query(
    `UPDATE "Invite"
     SET status = 'revoked', invite_response_status = 'rejected'
     WHERE id = $1 AND status = 'active' AND UPPER(COALESCE(target_team_code, '')) = $2
     RETURNING id`,
    [id, teamCode]
  );
  return r.rows.length > 0;
}

export async function rejectByParticipant(client, id, userId) {
  const r = await client.query(
    `UPDATE "Invite"
     SET status = 'revoked', invite_response_status = 'rejected'
     WHERE id = $1 AND status = 'active' AND target_participant_user_id = $2
     RETURNING id`,
    [id, userId]
  );
  return r.rows.length > 0;
}
