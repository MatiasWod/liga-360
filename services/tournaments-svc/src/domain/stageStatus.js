/**
 * Estado efectivo de una etapa según transiciones in_season y fuentes finalizadas.
 */

export function computeEffectiveStageStatus({ persisted, sourceCount, finishedCount }) {
  if (persisted != null && persisted !== '') return String(persisted);
  if (sourceCount === 0) return 'active';
  if (finishedCount === sourceCount) return 'active';
  return 'not_started';
}

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

export function assertStageAllowsMatchResults(stageStatus) {
  if (stageStatus === 'not_started') {
    throw new Error('STAGE_NOT_STARTED: la etapa aún no ha comenzado');
  }
  if (stageStatus === 'finished') {
    throw new Error('STAGE_FINISHED: la etapa ya está finalizada');
  }
}
