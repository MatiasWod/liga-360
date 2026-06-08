/** Acceso a datos de Stage e InscriptionRef asociadas a etapas. */
import { computeEffectiveStageStatus } from '../domain/stage/stageStatus.js';

export function mapStage(s) {
  return {
    id: s.id,
    name: s.name,
    order: Number(s.order) || 0,
    format: s.format,
    configJson: s.configJson ?? null,
    childrenJson: s.childrenJson ?? null,
    stageStatus: s.stageStatus ?? null,
  };
}

export async function findRawProps(session, stageId) {
  const r = await session.run('MATCH (s:Stage {id:$id}) RETURN s LIMIT 1', { id: stageId });
  if (r.records.length === 0) return null;
  return r.records[0].get('s').properties;
}

export async function create(session, { id, competitionId, name, order, format, configJson, childrenJson, subtype }) {
  await session.run(
    `MATCH (c:Competition {id:$cid})
     CREATE (c)-[:HAS_STAGE {order:$order}]->(st:Stage:${subtype} {id:$id, name:$name, order:$order, format:$format, configJson:$configJson, childrenJson:$childrenJson})
     RETURN st`,
    {
      cid: competitionId,
      id,
      name,
      order,
      format,
      configJson: configJson ?? null,
      childrenJson: childrenJson ?? null,
    }
  );
  return {
    id,
    name,
    order,
    format,
    configJson: configJson ?? null,
    childrenJson: childrenJson ?? null,
  };
}

export async function update(session, { stageId, name, order, format, configJson, childrenJson }) {
  const r = await session.run(
    `MATCH (st:Stage {id:$id})
     SET st.name = $name,
         st.order = $order,
         st.format = $format,
         st.configJson = $configJson,
         st.childrenJson = $childrenJson
     RETURN st
     LIMIT 1`,
    {
      id: stageId,
      name,
      order,
      format,
      configJson: configJson ?? null,
      childrenJson: childrenJson ?? null,
    }
  );
  if (r.records.length === 0) return null;
  const st = r.records[0].get('st').properties;
  return {
    id: st.id,
    name: st.name,
    order: Number(st.order) || 0,
    format: st.format,
    configJson: st.configJson ?? null,
    childrenJson: st.childrenJson ?? null,
  };
}

export async function setStatus(session, stageId, status) {
  const res = await session.run(
    `MATCH (s:Stage {id:$id})
     SET s.stageStatus = $status
     RETURN s`,
    { id: stageId, status }
  );
  if (res.records.length === 0) return null;
  return res.records[0].get('s').properties;
}

/** Cascada: si todas las etapas de la competición están finished → competición finished;
 * si todas las competiciones del torneo finished → torneo finished. */
export async function cascadeFinish(session, stageId) {
  await session.run(
    `MATCH (c:Competition)-[:HAS_STAGE]->(target:Stage {id: $stageId})
     MATCH (c)-[:HAS_STAGE]->(allS:Stage)
     WITH c, count(allS) AS total,
          sum(CASE WHEN allS.stageStatus = 'finished' THEN 1 ELSE 0 END) AS done
     WHERE total > 0 AND total = done
     SET c.status = 'finished'
     WITH c
     MATCH (t:Tournament)-[:HAS_COMPETITION]->(c)
     WITH t
     MATCH (t)-[:HAS_COMPETITION]->(allC:Competition)
     WITH t, count(allC) AS totalC,
          sum(CASE WHEN allC.status = 'finished' THEN 1 ELSE 0 END) AS doneC
     WHERE totalC > 0 AND totalC = doneC
     SET t.status = 'finished'`,
    { stageId }
  );
}

export async function isInitial(session, stageId) {
  const res = await session.run(
    `MATCH (c:Competition)-[:HAS_STAGE]->(s:Stage {id:$id})
     OPTIONAL MATCH (c)-[:HAS_STAGE]->(other:Stage)-[:ADVANCES_TO]->(s)
     RETURN COUNT(other) AS incoming`,
    { id: stageId }
  );
  return Number(res.records[0]?.get('incoming') || 0) === 0;
}

/** Devuelve las props de la etapa si pertenece al torneo, o null. */
export async function findInTournament(session, tournamentId, stageId) {
  const res = await session.run(
    `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage {id:$stageId})
     RETURN s LIMIT 1`,
    { tid: tournamentId, stageId }
  );
  if (res.records.length === 0) return null;
  return res.records[0].get('s').properties;
}

export async function assignedInscriptions(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i ORDER BY coalesce(i.seedOrder, 999999), i.displayName, i.inscriptionId`,
    { id: stageId }
  );
  return res.records.map((r) => {
    const i = r.get('i').properties;
    return {
      inscriptionId: i.inscriptionId,
      tournamentId: i.tournamentId,
      displayName: i.displayName ?? i.inscriptionId,
    };
  });
}

export async function countPhysicalAssignedInscriptions(session, stageId, tournamentId = null) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     WHERE NOT toString(i.inscriptionId) STARTS WITH 'liga360-slot:'
       AND NOT toString(i.inscriptionId) STARTS WITH 'pos:'
       AND ($tid IS NULL OR i.tournamentId = $tid)
     RETURN count(DISTINCT toString(i.inscriptionId)) AS c`,
    { stageId, tid: tournamentId }
  );
  return Number(r.records[0]?.get('c') || 0);
}

export async function inscriptionExistsInStage(session, stageId, tournamentId, iid) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     RETURN i LIMIT 1`,
    { stageId, tid: tournamentId, iid }
  );
  return r.records.length > 0;
}

export async function mergeStageInscription(session, { stageId, tournamentId, iid, displayName, seedOrder }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     SET i.displayName = coalesce($displayName, i.displayName),
         i.seedOrder = coalesce($seedOrder, i.seedOrder)
     MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)`,
    { stageId, tid: tournamentId, iid, displayName: displayName ?? null, seedOrder: seedOrder ?? null }
  );
}

export async function unassignFromStage(session, stageId, tournamentId, iid) {
  await session.run(
    `MATCH (:Stage {id:$stageId})-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     DELETE r`,
    { stageId, tid: tournamentId, iid }
  );
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_GROUP]->(:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     DELETE r`,
    { stageId, tid: tournamentId, iid }
  );
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.homeTournamentId = $tid AND m.homeInscriptionId = $iid
     SET m.homeTournamentId = null, m.homeInscriptionId = null, m.homeDisplayName = null`,
    { stageId, tid: tournamentId, iid }
  );
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.awayTournamentId = $tid AND m.awayInscriptionId = $iid
     SET m.awayTournamentId = null, m.awayInscriptionId = null, m.awayDisplayName = null`,
    { stageId, tid: tournamentId, iid }
  );
}

export async function clearAssignments(session, tournamentId, iid) {
  await session.run(
    `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage)
     OPTIONAL MATCH (s)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     DELETE r`,
    { tid: tournamentId, iid }
  );
  await session.run(
    `MATCH (:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
     DELETE r`,
    { tid: tournamentId, iid }
  );
  await session.run(
    `MATCH (m:Match)
     WHERE m.homeTournamentId = $tid AND m.homeInscriptionId = $iid
     SET m.homeTournamentId = null, m.homeInscriptionId = null, m.homeDisplayName = null`,
    { tid: tournamentId, iid }
  );
  await session.run(
    `MATCH (m:Match)
     WHERE m.awayTournamentId = $tid AND m.awayInscriptionId = $iid
     SET m.awayTournamentId = null, m.awayInscriptionId = null, m.awayDisplayName = null`,
    { tid: tournamentId, iid }
  );
}

// --- Estado efectivo de etapa (compone con computeEffectiveStageStatus puro) ---

const INCOMING_SOURCES_FRAGMENT = `
  OPTIONAL MATCH (other:Stage)-[:EMITS]->(tr:Transition)
  WHERE ((tr)-[:TO]->(s) OR (tr)-[:TO_STAGE]->(s))
    AND coalesce(tr.timing, 'in_season') <> 'next_edition'
`;

export async function fetchStageStatusInputs(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$id})
     ${INCOMING_SOURCES_FRAGMENT}
     RETURN s.stageStatus AS persisted,
            count(distinct other) AS sourceCount,
            sum(CASE WHEN other.stageStatus = 'finished' THEN 1 ELSE 0 END) AS finishedCount`,
    { id: stageId }
  );
  if (res.records.length === 0) {
    return { persisted: null, sourceCount: 0, finishedCount: 0 };
  }
  const r = res.records[0];
  return {
    persisted: r.get('persisted'),
    sourceCount: Number(r.get('sourceCount') || 0),
    finishedCount: Number(r.get('finishedCount') || 0),
  };
}

export async function resolveEffectiveStageStatus(session, stageId) {
  const inputs = await fetchStageStatusInputs(session, stageId);
  return computeEffectiveStageStatus(inputs);
}

export async function resolveEffectiveStageStatusForMatch(session, matchId) {
  const res = await session.run(
    `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$matchId})
     ${INCOMING_SOURCES_FRAGMENT}
     RETURN s.stageStatus AS persisted,
            count(distinct other) AS sourceCount,
            sum(CASE WHEN other.stageStatus = 'finished' THEN 1 ELSE 0 END) AS finishedCount
     LIMIT 1`,
    { matchId }
  );
  if (res.records.length === 0) return null;
  const r = res.records[0];
  return computeEffectiveStageStatus({
    persisted: r.get('persisted'),
    sourceCount: Number(r.get('sourceCount') || 0),
    finishedCount: Number(r.get('finishedCount') || 0),
  });
}
