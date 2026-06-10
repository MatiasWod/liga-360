/** Acceso a datos de Team_Member (join equipo↔participante). */

export async function add(client, teamId, participantId, now) {
  await client.query(
    `INSERT INTO "Team_Member"(team_id, participant_id, created_at)
     VALUES ($1,$2,$3)
     ON CONFLICT (team_id, participant_id) DO NOTHING`,
    [teamId, participantId, now]
  );
}

export async function remove(client, teamId, participantId) {
  const r = await client.query(
    `DELETE FROM "Team_Member" WHERE team_id = $1 AND participant_id = $2`,
    [teamId, participantId]
  );
  return r.rowCount;
}

export async function exists(client, teamId, participantId) {
  const r = await client.query(
    `SELECT 1 FROM "Team_Member" WHERE team_id = $1 AND participant_id = $2 LIMIT 1`,
    [teamId, participantId]
  );
  return r.rows.length > 0;
}
