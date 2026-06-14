import { API_ENDPOINTS } from '../config';
import { authHeaders } from '../http';
import { PAGE_MAX_LIMIT } from '../pagination';

/** Presencia de un partido (ADR-0002): snapshot opt-in cargado por el equipo. */
export interface MatchPresence {
  id: number;
  match_id: string;
  tournament_id: string;
  competition_id: string | null;
  inscription_id: number;
  linked_member_id: number | null;
  display_name: string;
  is_guest: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PresenceEntry {
  linked_member_id?: number | null;
  display_name: string;
  is_guest?: boolean;
}

export interface ReplacePresencesPayload {
  inscription_id: number;
  tournament_id: string;
  competition_id?: string | null;
  entries: PresenceEntry[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as any)?.error?.message || (json as any)?.error || `HTTP ${res.status}`);
  return json as T;
}

// matchevents-svc: mismas rutas /matches/:id que los eventos.
const base = () => API_ENDPOINTS.matchEvents;

/** Lectura pública de presencias del partido (completas: alimentan el editor de plantilla). */
export async function listMatchPresences(matchId: string): Promise<MatchPresence[]> {
  const res = await fetch(`${base()}/${encodeURIComponent(matchId)}/presences?limit=${PAGE_MAX_LIMIT}`, {
    headers: authHeaders(),
  });
  return handleResponse<MatchPresence[]>(res);
}

/** Reemplaza las presencias de una inscripción en el partido (solo dueño del equipo). */
export async function replaceMatchPresences(
  matchId: string,
  payload: ReplacePresencesPayload
): Promise<MatchPresence[]> {
  const res = await fetch(`${base()}/${encodeURIComponent(matchId)}/presences`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<MatchPresence[]>(res);
}

export async function deleteMatchPresence(matchId: string, presenceId: number): Promise<void> {
  const res = await fetch(`${base()}/${encodeURIComponent(matchId)}/presences/${presenceId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any)?.error?.message || `HTTP ${res.status}`);
  }
}

/** Stats agregadas de un Participant (requiere sesión): totales + desglose por torneo. */
export interface ParticipantTournamentStats {
  tournamentId: string;
  competitionId: string | null;
  goals: number;
  yellowCards: number;
  redCards: number;
  suspensionMatches: number;
  /** null = el equipo no carga presencias (UI muestra "—"). */
  matchesPlayed: number | null;
}

export interface ParticipantStats {
  memberId: number;
  totals: Omit<ParticipantTournamentStats, 'tournamentId' | 'competitionId'>;
  byTournament: ParticipantTournamentStats[];
}

export async function getParticipantStats(memberId: number, options?: { teamId?: number }): Promise<ParticipantStats> {
  const params = options?.teamId ? `?teamId=${Number(options.teamId)}` : '';
  const res = await fetch(`${API_ENDPOINTS.matchEventsStats}/stats/participants/${memberId}${params}`, {
    headers: authHeaders(),
  });
  return handleResponse<ParticipantStats>(res);
}
