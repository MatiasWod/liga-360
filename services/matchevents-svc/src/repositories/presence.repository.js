/** Acceso a datos de MatchPresence. Recibe un client/pool pg. */

const COLS = `id, match_id, tournament_id, competition_id, inscription_id, linked_member_id,
  display_name, is_guest, created_by_user_id, created_at, updated_at`;

export async function listByMatch(client, matchId) {
  const r = await client.query(
    `SELECT ${COLS} FROM "MatchPresence" WHERE match_id = $1 ORDER BY inscription_id, is_guest, lower(display_name)`,
    [matchId]
  );
  return r.rows;
}

/**
 * Reemplazo bulk (semántica PUT): borra las presencias de la inscripción en el
 * partido y escribe la lista nueva, en una sola transacción.
 * Recibe el Pool: toma una conexión dedicada para que BEGIN/COMMIT compartan sesión.
 */
export async function replaceForInscription(pool, {
  matchId, tournamentId, competitionId = null, inscriptionId, entries, createdByUserId = null,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM "MatchPresence" WHERE match_id = $1 AND inscription_id = $2`,
      [matchId, Number(inscriptionId)]
    );
    const inserted = [];
    for (const e of entries) {
      const r = await client.query(
        `INSERT INTO "MatchPresence"(match_id, tournament_id, competition_id, inscription_id,
           linked_member_id, display_name, is_guest, created_by_user_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), NOW())
         RETURNING ${COLS}`,
        [matchId, tournamentId, competitionId, Number(inscriptionId),
          e.linkedMemberId, e.displayName, e.isGuest, createdByUserId]
      );
      inserted.push(r.rows[0]);
    }
    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findByIdInMatch(client, presenceId, matchId) {
  const r = await client.query(
    `SELECT ${COLS} FROM "MatchPresence" WHERE id = $1 AND match_id = $2 LIMIT 1`,
    [Number(presenceId), matchId]
  );
  return r.rows[0] || null;
}

export async function deleteByIdInMatch(client, presenceId, matchId) {
  const r = await client.query(
    `DELETE FROM "MatchPresence" WHERE id = $1 AND match_id = $2 RETURNING id`,
    [Number(presenceId), matchId]
  );
  return r.rowCount > 0;
}

/**
 * Asegura una presencia positiva cuando un evento atribuye jugador + inscripción.
 * Idempotente: no duplica si ya existe (por member o por nombre de invitado).
 */
export async function ensureForAttribution(client, {
  matchId, tournamentId, competitionId = null, inscriptionId, linkedMemberId = null,
  displayName, isGuest = false, createdByUserId = null,
}) {
  const insId = Number(inscriptionId);
  const name = String(displayName || '').trim();
  if (!matchId || !tournamentId || !insId || (!name && linkedMemberId == null)) return null;

  if (linkedMemberId != null) {
    const memberId = Number(linkedMemberId);
    const existing = await client.query(
      `SELECT ${COLS} FROM "MatchPresence"
       WHERE match_id = $1 AND inscription_id = $2 AND linked_member_id = $3 LIMIT 1`,
      [matchId, insId, memberId]
    );
    if (existing.rows[0]) return existing.rows[0];
    const r = await client.query(
      `INSERT INTO "MatchPresence"(match_id, tournament_id, competition_id, inscription_id,
         linked_member_id, display_name, is_guest, created_by_user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), NOW())
       RETURNING ${COLS}`,
      [matchId, tournamentId, competitionId, insId, memberId, name || `Jugador ${memberId}`, false, createdByUserId]
    );
    return r.rows[0];
  }

  const existingName = await client.query(
    `SELECT ${COLS} FROM "MatchPresence"
     WHERE match_id = $1 AND inscription_id = $2 AND linked_member_id IS NULL
       AND lower(btrim(display_name)) = lower(btrim($3)) LIMIT 1`,
    [matchId, insId, name]
  );
  if (existingName.rows[0]) return existingName.rows[0];

  const r = await client.query(
    `INSERT INTO "MatchPresence"(match_id, tournament_id, competition_id, inscription_id,
       linked_member_id, display_name, is_guest, created_by_user_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,NULL,$5,$6,$7, NOW(), NOW())
     RETURNING ${COLS}`,
    [matchId, tournamentId, competitionId, insId, name, Boolean(isGuest), createdByUserId]
  );
  return r.rows[0];
}
