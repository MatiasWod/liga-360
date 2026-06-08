/**
 * Estado efectivo de una etapa: lógica pura. La lectura de fuentes desde Neo4j
 * (fetchStageStatusInputs / resolveEffectiveStageStatus...) vive en stage.repository.js.
 */

export function computeEffectiveStageStatus({ persisted, sourceCount, finishedCount }) {
  if (persisted != null && persisted !== '') return String(persisted);
  if (sourceCount === 0) return 'active';
  if (finishedCount === sourceCount) return 'active';
  return 'not_started';
}

export function assertStageAllowsMatchResults(stageStatus) {
  if (stageStatus === 'not_started') {
    throw new Error('STAGE_NOT_STARTED: la etapa aún no ha comenzado');
  }
  if (stageStatus === 'finished') {
    throw new Error('STAGE_FINISHED: la etapa ya está finalizada');
  }
}
