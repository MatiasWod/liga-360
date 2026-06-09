/** Normaliza un competitionId que puede venir como '', 'null', 'undefined' → null. */
export function normalizeCompetitionId(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
  return s;
}
