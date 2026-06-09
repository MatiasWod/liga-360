/** Acceso a datos de MatchEvent (goles, tarjetas, suspensiones, sanciones). */

export async function create(client, {
  matchId, tournamentId, eventType, inscriptionId = null, linkedMemberId = null,
  displayName = '', minute = null, suspensionMatches = null, notes = null, extraJson = null, createdByUserId = null,
}) {
  const r = await client.query(
    `INSERT INTO "MatchEvent"(match_id, tournament_id, event_type, inscription_id, linked_member_id, display_name,
       minute, suspension_matches, notes, extra_json, created_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
     RETURNING *`,
    [matchId, tournamentId, eventType, inscriptionId, linkedMemberId, displayName, minute, suspensionMatches,
      notes, extraJson ? JSON.stringify(extraJson) : null, createdByUserId]
  );
  return r.rows[0];
}

export async function listByMatch(client, matchId) {
  const r = await client.query(
    `SELECT * FROM "MatchEvent"
     WHERE match_id = $1
     ORDER BY COALESCE(minute, 999999) ASC, created_at ASC`,
    [matchId]
  );
  return r.rows;
}

export async function existsInMatch(client, eventId, matchId) {
  const r = await client.query(
    `SELECT id FROM "MatchEvent" WHERE id = $1 AND match_id = $2 LIMIT 1`,
    [Number(eventId), matchId]
  );
  return r.rows.length > 0;
}

export async function update(client, eventId, matchId, {
  eventType = null, inscriptionId = null, linkedMemberId = null, displayName = null,
  minute = null, suspensionMatches = null, notes = null, extraJson = null,
}) {
  const r = await client.query(
    `UPDATE "MatchEvent"
     SET event_type         = COALESCE($1, event_type),
         inscription_id     = COALESCE($2, inscription_id),
         linked_member_id   = COALESCE($3, linked_member_id),
         display_name       = COALESCE($4, display_name),
         minute             = COALESCE($5, minute),
         suspension_matches = COALESCE($6, suspension_matches),
         notes              = COALESCE($7, notes),
         extra_json         = COALESCE($8, extra_json),
         updated_at         = NOW()
     WHERE id = $9 AND match_id = $10
     RETURNING *`,
    [eventType, inscriptionId, linkedMemberId, displayName, minute, suspensionMatches, notes,
      extraJson ? JSON.stringify(extraJson) : null, Number(eventId), matchId]
  );
  return r.rows[0] || null;
}

export async function deleteByIdInMatch(client, eventId, matchId) {
  const r = await client.query(
    `DELETE FROM "MatchEvent" WHERE id = $1 AND match_id = $2 RETURNING id`,
    [Number(eventId), matchId]
  );
  return r.rows.length > 0;
}
