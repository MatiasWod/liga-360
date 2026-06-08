/** Lecturas específicas de generación de fixtures (orden de inscripciones, seeds, primera ronda). */

function mapInscription(record) {
  const i = record.get('i').properties;
  return {
    inscriptionId: String(i.inscriptionId ?? ''),
    tournamentId: String(i.tournamentId ?? ''),
    displayName: String(i.displayName ?? i.inscriptionId ?? ''),
  };
}

/** Inscripciones de la etapa en orden de seed (seedOrder, displayName, inscriptionId). */
export async function loadOrderedStageInscriptions(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i ORDER BY coalesce(i.seedOrder, 999999), i.displayName, i.inscriptionId`,
    { stageId }
  );
  return res.records.map(mapInscription);
}

/** Inscripciones del grupo en orden (displayName, inscriptionId). */
export async function loadOrderedGroupInscriptions(session, groupId) {
  const res = await session.run(
    `MATCH (g:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i ORDER BY i.displayName, i.inscriptionId`,
    { groupId }
  );
  return res.records.map(mapInscription);
}

export async function countAssignedInscriptionsOnGroup(session, groupId) {
  const r = await session.run(
    `MATCH (:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN count(DISTINCT i.inscriptionId) AS c`,
    { groupId }
  );
  return Number(r.records[0]?.get('c') || 0);
}

/** Partidos de liga (sin grupo) con sus seeds, para hidratar. */
export async function listLeagueSeedMatches(session, stageId) {
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.groupId IS NULL
     RETURN m.id AS id, m.leagueHomeSeed AS lhs, m.leagueAwaySeed AS las`,
    { stageId }
  );
  return res.records.map((r) => ({ id: r.get('id'), lhs: r.get('lhs'), las: r.get('las') }));
}

export async function listDistinctGroupIds(session, stageId) {
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.groupId IS NOT NULL AND m.groupId <> ''
     RETURN DISTINCT m.groupId AS gid`,
    { stageId }
  );
  return res.records.map((r) => String(r.get('gid') ?? ''));
}

export async function listGroupSeedMatches(session, stageId, gid) {
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {groupId:$gid})
     RETURN m.id AS id, m.leagueHomeSeed AS lhs, m.leagueAwaySeed AS las`,
    { stageId, gid }
  );
  return res.records.map((r) => ({ id: r.get('id'), lhs: r.get('lhs'), las: r.get('las') }));
}

/** Partidos de primera ronda de eliminación (round=1) ordenados por slot/leg. */
export async function listFirstRoundMatches(session, stageId) {
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(toInteger(m.round), 0) = 1
     RETURN m.id AS id, m.slotIndex AS si, coalesce(toInteger(m.leg), 1) AS leg
     ORDER BY m.slotIndex, m.leg`,
    { stageId }
  );
  return res.records.map((r) => ({ id: r.get('id'), si: r.get('si'), leg: r.get('leg') }));
}
