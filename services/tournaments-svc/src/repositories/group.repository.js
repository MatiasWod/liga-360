/** Acceso a datos de Group y sus relaciones (competidores, inscripciones) en Neo4j. */
import { mapCompetitor } from './competitor.repository.js';

export async function findByStage(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$id})-[hg:HAS_GROUP]->(g:Group)
     RETURN g ORDER BY hg.order`,
    { id: stageId }
  );
  return res.records.map((r) => {
    const g = r.get('g').properties;
    return { id: g.id, name: g.name, order: Number(g.order) || 0 };
  });
}

/** Propiedades crudas de los grupos de una etapa, ordenadas por HAS_GROUP.order (para sync). */
export async function listRawByStage(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$stageId})-[r:HAS_GROUP]->(g:Group)
     RETURN g
     ORDER BY r.order`,
    { stageId }
  );
  return res.records.map((record) => record.get('g').properties);
}

export async function create(session, { stageId, id, name, order }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     CREATE (s)-[:HAS_GROUP {order:$order}]->(g:Group {id:$id, name:$name, order:$order})
     RETURN g`,
    { stageId, id, name, order }
  );
  return { id, name, order };
}

/** Devuelve las props del grupo si pertenece a la etapa, o null. */
export async function findInStage(session, stageId, groupId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_GROUP]->(g:Group {id:$groupId})
     RETURN g LIMIT 1`,
    { stageId, groupId }
  );
  if (res.records.length === 0) return null;
  return res.records[0].get('g').properties;
}

export async function countDistinctAssignedInscriptions(session, groupId) {
  const r = await session.run(
    `MATCH (:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN count(DISTINCT toString(i.inscriptionId)) AS c`,
    { groupId }
  );
  return Number(r.records[0]?.get('c') || 0);
}

export async function competitorIds(session, groupId) {
  const res = await session.run(
    `MATCH (g:Group {id:$id})-[:HAS_COMPETITOR]->(c:Competitor)
     RETURN c.id AS cid ORDER BY c.id`,
    { id: groupId }
  );
  return res.records.map((r) => r.get('cid'));
}

export async function competitors(session, groupId) {
  const res = await session.run(
    `MATCH (g:Group {id:$id})-[:HAS_COMPETITOR]->(c:Competitor)
     RETURN c ORDER BY c.displayName, c.id`,
    { id: groupId }
  );
  return res.records.map((r) => mapCompetitor(r.get('c').properties));
}

export async function assignedInscriptions(session, groupId) {
  const res = await session.run(
    `MATCH (g:Group {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i
     ORDER BY i.displayName, i.inscriptionId`,
    { id: groupId }
  );
  return res.records.map((record) => {
    const i = record.get('i').properties;
    return {
      inscriptionId: i.inscriptionId,
      tournamentId: i.tournamentId,
      displayName: i.displayName ?? i.inscriptionId,
    };
  });
}

export async function capacity(session, groupId, deriveGroupsConfig) {
  const res = await session.run(
    `MATCH (:Stage)-[:HAS_GROUP]->(g:Group {id:$id})
     RETURN g LIMIT 1`,
    { id: groupId }
  );
  if (res.records.length === 0) return null;
  const group = res.records[0].get('g').properties;
  if (group.capacity != null) return Number(group.capacity);

  const cfgR = await session.run(
    `MATCH (:Stage)-[:HAS_GROUP]->(g:Group {id:$id})<-[:HAS_GROUP]-(s:Stage)
     RETURN s
     LIMIT 1`,
    { id: groupId }
  );
  if (cfgR.records.length === 0) return null;
  const stageProps = cfgR.records[0].get('s').properties;
  const { teamsPerGroup } = deriveGroupsConfig(stageProps);
  return teamsPerGroup > 0 ? teamsPerGroup : null;
}

/** Asigna inscripción a un grupo y la quita de los demás grupos de la misma etapa. */
export async function mergeInscription(session, { stageId, groupId, tournamentId, iid, displayName }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId}), (g:Group {id:$groupId})
     MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     SET i.displayName = $displayName
     MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)
     MERGE (g)-[:HAS_ASSIGNED_INSCRIPTION]->(i)
     WITH s, i
     OPTIONAL MATCH (s)-[:HAS_GROUP]->(other:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i)
     WHERE other.id <> $groupId
     DELETE r`,
    { stageId, groupId, tid: tournamentId, iid, displayName }
  );
}

