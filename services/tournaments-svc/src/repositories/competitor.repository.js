/** Acceso a datos de Competitor (snapshots de equipos/participantes) en Neo4j. */

export function mapCompetitor(c) {
  return {
    id: c.id,
    kind: c.kind ?? 'team',
    displayName: c.displayName ?? c.id,
    shortName: c.shortName ?? null,
    avatarUrl: c.avatarUrl ?? null,
    badgeUrl: c.badgeUrl ?? null,
    source: c.source ?? null,
    updatedAt: c.updatedAt ?? null,
  };
}

export async function upsertSnapshot(session, { competitorId, kind, displayName, shortName, avatarUrl, badgeUrl }) {
  const updatedAt = new Date().toISOString();
  const res = await session.run(
    `MERGE (c:Competitor {id:$id})
     REMOVE c:Team:Participant
     SET c:Competitor
     FOREACH (_ IN CASE WHEN $kind = 'team' THEN [1] ELSE [] END | SET c:Team)
     FOREACH (_ IN CASE WHEN $kind = 'participant' THEN [1] ELSE [] END | SET c:Participant)
     ON CREATE SET
       c.kind = $kind,
       c.displayName = $displayName,
       c.shortName = $shortName,
       c.avatarUrl = $avatarUrl,
       c.badgeUrl = $badgeUrl,
       c.source = 'sql-snapshot',
       c.updatedAt = $updatedAt
     ON MATCH SET
       c.kind = coalesce($kind, c.kind),
       c.displayName = coalesce($displayName, c.displayName),
       c.shortName = coalesce($shortName, c.shortName),
       c.avatarUrl = coalesce($avatarUrl, c.avatarUrl),
       c.badgeUrl = coalesce($badgeUrl, c.badgeUrl),
       c.source = coalesce(c.source, 'sql-snapshot'),
       c.updatedAt = $updatedAt
     RETURN c`,
    {
      id: competitorId,
      kind,
      displayName,
      shortName: shortName ?? null,
      avatarUrl: avatarUrl ?? null,
      badgeUrl: badgeUrl ?? null,
      updatedAt,
    }
  );
  return res.records[0]?.get('c')?.properties;
}

/**
 * Competidor de un lado del partido: primero por relación HAS_COMPETITOR (modelo legacy de
 * createMatch); como fallback, materializa desde InscriptionRef (modelo de generateLeagueRoundRobin).
 */
export async function findMatchCompetitor(session, matchId, role, inscriptionId) {
  const res = await session.run(
    `MATCH (m:Match {id:$id})-[:HAS_COMPETITOR {role:$role}]->(c:Competitor)
     RETURN c LIMIT 1`,
    { id: matchId, role }
  );
  if (res.records.length > 0) {
    return mapCompetitor(res.records[0].get('c').properties);
  }
  if (inscriptionId) {
    const ir = await session.run(
      `MATCH (i:InscriptionRef {inscriptionId:$iid})
       RETURN i LIMIT 1`,
      { iid: String(inscriptionId) }
    );
    if (ir.records.length > 0) {
      const i = ir.records[0].get('i').properties;
      return {
        id: String(i.inscriptionId),
        kind: 'team',
        displayName: i.displayName ?? String(i.inscriptionId),
        shortName: null,
        avatarUrl: null,
        badgeUrl: null,
        source: 'inscription-ref',
        updatedAt: null,
      };
    }
  }
  return null;
}
