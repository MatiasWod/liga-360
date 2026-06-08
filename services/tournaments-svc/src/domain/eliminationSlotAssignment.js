import { isPhysicalInscriptionId } from './participantLabels.js';

export function normalizeInscriptionIdStr(raw) {
  if (raw == null) return '';
  return String(raw);
}

export function isSameEliminationTie(roundA, slotA, roundB, slotB) {
  return Number(roundA ?? 1) === Number(roundB ?? 1) && Number(slotA ?? 0) === Number(slotB ?? 0);
}

/**
 * Resuelve un id de slot (físico o pos:/liga360-slot:) al inscriptionId físico del equipo, si aplica.
 */
export async function resolveAssignmentPhysicalKey(driver, inscriptionId, resolvePositionRefFn) {
  const iid = normalizeInscriptionIdStr(inscriptionId);
  if (!iid) return null;
  if (isPhysicalInscriptionId(iid)) return iid;
  if (iid.startsWith('liga360-slot:')) return null;
  if (iid.startsWith('pos:')) {
    const resolved = await resolvePositionRefFn(driver, iid);
    const rid = normalizeInscriptionIdStr(resolved?.inscriptionId);
    return isPhysicalInscriptionId(rid) ? rid : null;
  }
  return null;
}

/** Impide que el mismo equipo real ocupe dos llaves distintas (ida/vuelta de la misma llave sí comparte equipo). */
export async function assertEliminationPhysicalNotDuplicateElsewhere({
  session,
  driver,
  stageId,
  matchId,
  round,
  slotIndex,
  candidateInscriptionId,
  resolvePositionRefFn,
}) {
  const candidatePhysical = await resolveAssignmentPhysicalKey(
    driver,
    candidateInscriptionId,
    resolvePositionRefFn
  );
  if (!candidatePhysical) return;

  const rows = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     RETURN m.id AS id,
            toInteger(coalesce(m.round, 1)) AS round,
            toInteger(coalesce(m.slotIndex, 0)) AS slotIndex,
            m.homeInscriptionId AS home,
            m.awayInscriptionId AS away`,
    { stageId }
  );

  const curRound = Number(round ?? 1);
  const curSlot = Number(slotIndex ?? 0);

  for (const rec of rows.records) {
    const mid = rec.get('id');
    if (mid === matchId) continue;
    const mRound = Number(rec.get('round') ?? 1);
    const mSlot = Number(rec.get('slotIndex') ?? 0);
    if (isSameEliminationTie(curRound, curSlot, mRound, mSlot)) continue;

    for (const sideId of [rec.get('home'), rec.get('away')]) {
      const sid = normalizeInscriptionIdStr(sideId);
      if (!sid) continue;
      const otherPhysical = await resolveAssignmentPhysicalKey(driver, sid, resolvePositionRefFn);
      if (otherPhysical && otherPhysical === candidatePhysical) {
        throw new Error('BAD_REQUEST: el equipo ya está asignado en otra llave de este cuadro');
      }
    }
  }
}
