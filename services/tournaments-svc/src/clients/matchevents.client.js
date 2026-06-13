/** Cliente HTTP hacia matchevents-svc (stats agregadas cross-torneo). */
import { env } from '../config/env.js';

const DEFAULT_TIMEOUT_MS = Number(process.env.DOWNSTREAM_TIMEOUT_MS || 3000);

/**
 * Goleadores agregados por lista de torneos (endpoint público multi-torneo).
 * Devuelve [] si matchevents no está disponible (KPI muestra "—" en UI).
 */
export async function getMultiTournamentScorers(tournamentIds, { limit = 20 } = {}) {
  const ids = [...new Set(tournamentIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const qs = new URLSearchParams({ tournamentIds: ids.join(','), limit: String(limit) });
  try {
    const response = await fetch(`${env.matcheventsSvcUrl}/stats/scorers?${qs}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}
