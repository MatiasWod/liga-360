import { API_ENDPOINTS } from '../config';
import { authHeaders } from '../http';
import { PAGE_MAX_LIMIT } from '../pagination';
import type { MatchEvent } from './types';

/** Fila de goleadores agregada por matchevents-svc (clave compuesta member:/name:). */
export interface ScorerStatsRow {
  playerKey: string;
  displayName: string;
  inscriptionId: number | null;
  linkedMemberId: number | null;
  goals: number;
  /** PJ desde presencias (ADR-0002): null = sin datos, la UI muestra "—". */
  matchesPlayed?: number | null;
}

export interface CardStatsRow {
  playerKey: string;
  displayName: string;
  inscriptionId: number | null;
  linkedMemberId: number | null;
  yellowCards: number;
  redCards: number;
  suspensionMatches: number;
  /** PJ desde presencias (ADR-0002): null = sin datos, la UI muestra "—". */
  matchesPlayed?: number | null;
}

export interface TeamStatsRow {
  inscriptionId: number;
  goals: number;
  yellowCards: number;
  redCards: number;
}

// Endpoints públicos: no requieren token.
const base = () => API_ENDPOINTS.matchEventsStats;

async function getJson<T>(url: string, fallbackError: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as any)?.error?.message || fallbackError);
  return json as T;
}

function statsUrl(tournamentId: string, path: string, competitionId?: string | null, extra?: Record<string, string>) {
  const params = new URLSearchParams({ tournamentId });
  if (competitionId) params.set('competitionId', competitionId);
  for (const [k, v] of Object.entries(extra || {})) params.set(k, v);
  // Rankings/merges se consumen completos: pedir el tope salvo que el caller fije un top-N.
  if (!params.has('limit')) params.set('limit', String(PAGE_MAX_LIMIT));
  return `${base()}${path}?${params}`;
}

export async function getScorerStats(
  tournamentId: string,
  competitionId?: string | null,
  limit?: number
): Promise<ScorerStatsRow[]> {
  const extra = limit ? { limit: String(limit) } : undefined;
  return getJson(statsUrl(tournamentId, '/stats/scorers', competitionId, extra), 'No se pudieron cargar los goleadores');
}

/** Goleadores agregados cross-torneo (matchevents multi-edición). */
export async function getMultiScorerStats(
  tournamentIds: string[],
  limit = 50
): Promise<ScorerStatsRow[]> {
  const params = new URLSearchParams({
    tournamentIds: tournamentIds.join(','),
    limit: String(limit),
  });
  return getJson(
    `${base()}/stats/scorers?${params}`,
    'No se pudieron cargar los goleadores históricos'
  );
}

export async function getCardStats(tournamentId: string, competitionId?: string | null): Promise<CardStatsRow[]> {
  return getJson(statsUrl(tournamentId, '/stats/cards', competitionId), 'No se pudieron cargar los amonestados');
}

export async function getTeamStats(tournamentId: string, competitionId?: string | null): Promise<TeamStatsRow[]> {
  return getJson(statsUrl(tournamentId, '/stats/teams', competitionId), 'No se pudieron cargar las estadísticas por equipo');
}

export async function getEventsByInscription(tournamentId: string, inscriptionId: number): Promise<MatchEvent[]> {
  return getJson(
    statsUrl(tournamentId, '/stats', null, { inscriptionId: String(inscriptionId) }),
    'No se pudieron cargar los eventos del equipo'
  );
}
