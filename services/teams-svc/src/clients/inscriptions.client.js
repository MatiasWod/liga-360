/** Cliente HTTP hacia inscriptions-svc (lookup + tournament_rating interno). */
import { env } from '../config/env.js';
import { svcGet, svcPatch } from './http.js';

const BASE = env.inscriptionsSvcUrl;

export async function lookupInscriptions(inscriptionIds) {
  const ids = [...new Set(inscriptionIds.map((id) => Number(id)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return [];
  try {
    const json = await svcGet(BASE, `/inscriptions?ids=${encodeURIComponent(ids.join(','))}`);
    return json?.inscriptions ?? [];
  } catch {
    return [];
  }
}

export async function updateTournamentRating(inscriptionId, tournamentRating) {
  return svcPatch(BASE, `/inscriptions/${inscriptionId}/tournament-rating`, { tournamentRating });
}
