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

/**
 * Competidor de un lado del partido: por relación HAS_COMPETITOR (modelo legacy); como fallback,
 * materializa desde InscriptionRef (modelo de generateLeagueRoundRobin).
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
