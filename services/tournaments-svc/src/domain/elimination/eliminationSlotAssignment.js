/**
 * Helpers puros de asignación de slots en eliminación (comparación de llaves, normalización).
 * Las verificaciones que requieren leer el grafo (resolveAssignmentPhysicalKey /
 * assertEliminationPhysicalNotDuplicateElsewhere) viven en elimination.repository.js.
 */

export function normalizeInscriptionIdStr(raw) {
  if (raw == null) return '';
  return String(raw);
}

export function isSameEliminationTie(roundA, slotA, roundB, slotB) {
  return Number(roundA ?? 1) === Number(roundB ?? 1) && Number(slotA ?? 0) === Number(slotB ?? 0);
}
