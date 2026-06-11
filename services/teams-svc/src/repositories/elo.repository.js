/** Persistencia de ELO por equipo y eventos por partido. */

export async function findEventByMatchId(client, matchId) {
  const r = await client.query(
    `SELECT * FROM elo_match_event WHERE match_id = $1 LIMIT 1`,
    [String(matchId)]
  );
  return r.rows[0] || null;
}

export async function deleteEventByMatchId(client, matchId) {
  await client.query(`DELETE FROM elo_match_event WHERE match_id = $1`, [String(matchId)]);
}

export async function insertEvent(client, event) {
  const r = await client.query(
    `INSERT INTO elo_match_event(
       match_id, tournament_id, home_inscription_id, away_inscription_id,
       home_elo_before, away_elo_before, home_delta, away_delta,
       home_elo_after, away_elo_after, home_team_id, away_team_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      event.matchId,
      event.tournamentId,
      event.homeInscriptionId,
      event.awayInscriptionId,
      event.homeEloBefore,
      event.awayEloBefore,
      event.homeDelta,
      event.awayDelta,
      event.homeEloAfter,
      event.awayEloAfter,
      event.homeTeamId ?? null,
      event.awayTeamId ?? null,
    ]
  );
  return r.rows[0];
}

export async function getTeamElo(client, teamId) {
  const r = await client.query(`SELECT elo FROM "Team" WHERE id = $1 LIMIT 1`, [Number(teamId)]);
  return r.rows[0]?.elo != null ? Number(r.rows[0].elo) : null;
}

export async function setTeamElo(client, teamId, elo) {
  await client.query(
    `UPDATE "Team" SET elo = $2, updated_at = now() WHERE id = $1`,
    [Number(teamId), Math.trunc(elo)]
  );
}
