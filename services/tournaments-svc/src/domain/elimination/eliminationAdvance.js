/**
 * Lógica pura de avance en brackets de eliminación. La detección de destinos por ref que
 * requiere leer el grafo (findRefBasedAdvanceTargets) vive en elimination.repository.js.
 */

/** Refs sintéticos que apuntan al ganador de una llave concreta. */
export function buildWinnerSlotRefs(stageId, matchIds) {
  const refs = new Set();
  for (const mid of matchIds) {
    const id = String(mid || '').trim();
    if (!id) continue;
    if (stageId) refs.add(`liga360-slot:ew:${stageId}:${id}`);
    refs.add(`pos:ew:${id}`);
  }
  return [...refs];
}

/** Destino clásico del árbol (1+2→slot1, 3+4→slot2, …). */
export function defaultBracketAdvanceTarget(round, slotIndex) {
  const r = Math.max(1, Math.trunc(Number(round) || 1));
  const s = Math.max(1, Math.trunc(Number(slotIndex) || 1));
  return {
    nextRound: r + 1,
    nextSlotIndex: Math.ceil(s / 2),
    isHomeInLeg1: s % 2 === 1,
  };
}

/** ¿En qué lado del partido destino estaba el ref del ganador? */
export function pickAdvanceSideForRef(homeInscriptionId, awayInscriptionId, winnerRefs) {
  const refSet = winnerRefs instanceof Set ? winnerRefs : new Set(winnerRefs);
  const hid = String(homeInscriptionId || '');
  const aid = String(awayInscriptionId || '');
  if (refSet.has(hid)) return 'home';
  if (refSet.has(aid)) return 'away';
  return null;
}

/** Local/visitante en pierna N respetando ida y vuelta. */
export function resolveAdvanceRoleForLeg(side, leg) {
  const lg = Math.max(1, Math.trunc(Number(leg) || 1));
  const isHome = side === 'home';
  if (lg === 2) return isHome ? 'away' : 'home';
  return isHome ? 'home' : 'away';
}
