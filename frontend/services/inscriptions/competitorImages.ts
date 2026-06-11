import type { InscriptionItem } from './types';

/**
 * Mapa inscriptionId → imagen del competidor (escudo de equipo o avatar de participante).
 * Fuente única para todas las tarjetas "vs" de la app.
 */
export function buildCompetitorImageMap(
  inscriptions: ReadonlyArray<Pick<InscriptionItem, 'id' | 'competitor_image_url' | 'team_badge_url'>>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of inscriptions) {
    const url = item.competitor_image_url ?? item.team_badge_url;
    if (url) map.set(String(item.id), String(url));
  }
  return map;
}
