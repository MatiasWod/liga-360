/** Mapeo lineal MVP: 800→1, 1200→5, 1600→10 (espejo de teams-svc). */

const ELO_MIN = 800;
const ELO_MAX = 1600;
export const DEFAULT_ELO = 1200;

export function eloToSuggestedWeight(elo) {
  const n = Number(elo);
  if (!Number.isFinite(n)) return 5;
  const clamped = Math.min(ELO_MAX, Math.max(ELO_MIN, n));
  return Math.min(10, Math.max(1, Math.floor(1 + (9 * (clamped - ELO_MIN)) / (ELO_MAX - ELO_MIN))));
}
