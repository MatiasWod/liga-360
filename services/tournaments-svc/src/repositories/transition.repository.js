/** Acceso a datos de Transition y relaciones de avance entre etapas (ADVANCES_TO). */
import { STAGE_CYCLE_CHECK_CYPHER } from '../domain/stage/stageTransitionCycle.js';

export function mapTransition(t, dst) {
  return {
    id: t.id,
    type: t.type,
    label: t.label ?? null,
    toStageId: dst?.id ?? null,
    selectionKind: t.selectionKind ?? null,
    topN: t.topN != null ? Number(t.topN) : null,
    rangeFrom: t.rangeFrom != null ? Number(t.rangeFrom) : null,
    rangeTo: t.rangeTo != null ? Number(t.rangeTo) : null,
    bottomN: t.bottomN != null ? Number(t.bottomN) : null,
    toExternalTournamentId: t.toExternalTournamentId ?? null,
    toExternalStageId: t.toExternalStageId ?? null,
    toExternalTournamentName: t.toExternalTournamentName ?? null,
    carryOverJson: t.carryOverJson ?? null,
    timing: t.timing ?? 'in_season',
    placementSnapshotJson: t.placementSnapshotJson ?? null,
  };
}

export async function findByStage(session, stageId) {
  // Solo EMITS: cada transición tiene EMITS y a veces HAS_TRANSITION desde la misma etapa; evitar filas duplicadas.
  const res = await session.run(
    `MATCH (s:Stage {id:$id})-[:EMITS]->(tr:Transition)
     OPTIONAL MATCH (tr)-[:TO_STAGE]->(dst:Stage)
     RETURN tr, dst`,
    { id: stageId }
  );
  return res.records.map((r) => mapTransition(r.get('tr').properties, r.get('dst')?.properties || null));
}

/**
 * Elimina ADVANCES_TO entre dos etapas si no hay un nodo Transition que respalde ese avance.
 * Evita falsos positivos en el chequeo de ciclos tras borrar transiciones a mano o inconsistencias.
 */
export async function pruneOrphanAdvancesToBetweenStages(session, fromStageId, toStageId) {
  await session.run(
    `MATCH (a:Stage)-[adv:ADVANCES_TO]->(b:Stage)
     WHERE a.id IN $ids AND b.id IN $ids
     AND NOT EXISTS {
       MATCH (a)-[:EMITS|HAS_TRANSITION]->(tr:Transition)
       WHERE coalesce(tr.timing, 'in_season') <> 'next_edition'
         AND ((tr)-[:TO]->(b) OR (tr)-[:TO_STAGE]->(b))
     }
     DELETE adv`,
    { ids: [fromStageId, toStageId] }
  );
}

export async function hasCycle(session, fromStageId, toStageId) {
  const cycleCheck = await session.run(
    `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
     ${STAGE_CYCLE_CHECK_CYPHER}`,
    { from: fromStageId, to: toStageId }
  );
  return Boolean(cycleCheck.records[0]?.get('hasCycle'));
}

export async function createGeneric(session, { id, fromStageId, toStageId, label, selectionKind, topN, rangeFrom, rangeTo, bottomN, carryOverJson, timing }) {
  await session.run(
    `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
     CREATE (a)-[:EMITS]->(tr:Transition {
       id:$id, type:'generic', label:$label, selectionKind:$selectionKind,
       topN:$topN, rangeFrom:$rangeFrom, rangeTo:$rangeTo, bottomN:$bottomN,
       carryOverJson:$carryOverJson, timing:$timing
     })-[:TO]->(b)
     CREATE (a)-[:HAS_TRANSITION]->(tr)
     CREATE (tr)-[:TO_STAGE]->(b)
     RETURN tr`,
    {
      from: fromStageId,
      to: toStageId,
      id,
      label,
      selectionKind,
      topN: topN ?? null,
      rangeFrom: rangeFrom ?? null,
      rangeTo: rangeTo ?? null,
      bottomN: bottomN ?? null,
      carryOverJson: carryOverJson ?? null,
      timing,
    }
  );
}

export async function mergeAdvancesTo(session, fromStageId, toStageId) {
  await session.run(
    `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
     MERGE (a)-[:ADVANCES_TO]->(b)`,
    { from: fromStageId, to: toStageId }
  );
}

export async function createExternal(session, { id, fromStageId, label, selectionKind, topN, rangeFrom, rangeTo, bottomN, toExternalTournamentId, toExternalStageId, toExternalTournamentName, carryOverJson, timing }) {
  await session.run(
    `MATCH (a:Stage {id:$from})
     CREATE (a)-[:EMITS]->(tr:Transition {
       id:$id, type:'external', label:$label, selectionKind:$selectionKind,
       topN:$topN, rangeFrom:$rangeFrom, rangeTo:$rangeTo, bottomN:$bottomN,
       toExternalTournamentId:$toExternalTournamentId, toExternalStageId:$toExternalStageId,
       toExternalTournamentName:$toExternalTournamentName, carryOverJson:$carryOverJson, timing:$timing
     })
     CREATE (a)-[:HAS_TRANSITION]->(tr)
     RETURN tr`,
    {
      from: fromStageId,
      id,
      label,
      selectionKind,
      topN: topN ?? null,
      rangeFrom: rangeFrom ?? null,
      rangeTo: rangeTo ?? null,
      bottomN: bottomN ?? null,
      toExternalTournamentId: toExternalTournamentId ?? null,
      toExternalStageId: toExternalStageId ?? null,
      toExternalTournamentName: toExternalTournamentName ?? null,
      carryOverJson: carryOverJson ?? null,
      timing,
    }
  );
}

export async function savePlacementSnapshot(session, transitionId, snapshotJson) {
  const res = await session.run(
    `MATCH (tr:Transition {id:$id})
     SET tr.placementSnapshotJson = $snapshot
     WITH tr
     OPTIONAL MATCH (tr)-[:TO_STAGE]->(dst:Stage)
     RETURN tr, dst`,
    { id: transitionId, snapshot: snapshotJson }
  );
  if (res.records.length === 0) return null;
  return mapTransition(res.records[0].get('tr').properties, res.records[0].get('dst')?.properties || null);
}

/** Devuelve {aid, bid} de la transición (etapa origen/destino) o null si no existe. */
export async function findEndpoints(session, transitionId) {
  const meta = await session.run(
    `MATCH (tr:Transition {id:$id})
     OPTIONAL MATCH (a:Stage)-[:EMITS|HAS_TRANSITION]->(tr)
     OPTIONAL MATCH (tr)-[:TO|TO_STAGE]->(b:Stage)
     RETURN a.id AS aid, b.id AS bid`,
    { id: transitionId }
  );
  if (meta.records.length === 0) return null;
  return { aid: meta.records[0].get('aid') ?? null, bid: meta.records[0].get('bid') ?? null };
}

export async function deleteAdvancesTo(session, aid, bid) {
  await session.run(
    `MATCH (a:Stage {id:$aid})-[adv:ADVANCES_TO]->(b:Stage {id:$bid})
     DELETE adv`,
    { aid, bid }
  );
}

export async function detachDelete(session, transitionId) {
  await session.run(`MATCH (tr:Transition {id:$id}) DETACH DELETE tr`, { id: transitionId });
}

/** Verifica que la etapa emita la transición (para setMatchWinnerAdvancement). */
export async function isEmittedByStage(session, stageId, transitionId) {
  const trR = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:EMITS|HAS_TRANSITION]->(tr:Transition {id:$tid})
     RETURN tr.id AS id LIMIT 1`,
    { stageId, tid: transitionId }
  );
  return trR.records.length > 0;
}
