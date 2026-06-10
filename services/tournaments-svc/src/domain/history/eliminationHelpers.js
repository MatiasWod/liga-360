/** Helpers de eliminatoria para derivación de podio (espejo de eliminationInitHelpers.ts). */

export function isThirdPlaceMatchRow(m) {
  const kind = String(m?.matchKind ?? '').toLowerCase();
  if (kind === 'third_place') return true;
  const fc = String(m?.fixtureCode ?? '').trim().toUpperCase();
  return Number(m?.slotIndex) === 0 && (fc === '3P' || fc.startsWith('3P-'));
}

export function isByeMatch(m) {
  return String(m?.matchKind ?? '').toLowerCase() === 'bye';
}
