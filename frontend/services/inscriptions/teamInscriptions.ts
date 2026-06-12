import { authHeaders, INSCRIPTIONS_BASE, parseResponse } from './client';

export interface TeamInscriptionItem {
  id: number;
  tournament_id: string;
  competition_id: string | null;
  display_name: string;
  linked_team_id: number | null;
  status: string;
}

export interface InscriptionLookupItem {
  id: number;
  tournament_id: string;
  competition_id: string | null;
  display_name: string;
  linked_team_id: number | null;
  status: string;
}

/** Historial cross-torneo de un equipo (público). Incluye inscripciones rechazadas. */
export async function listTeamInscriptions(teamId: number): Promise<TeamInscriptionItem[]> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/teams/${Number(teamId)}/inscriptions`, { headers: authHeaders() });
  const json = await parseResponse(res, 'No se pudieron cargar las inscripciones del equipo');
  return json.inscriptions || [];
}

/** Lookup público por ids (resuelve inscription → linked_team_id para mano a mano). */
export async function lookupInscriptions(ids: number[]): Promise<InscriptionLookupItem[]> {
  if (!ids.length) return [];
  const params = new URLSearchParams({ ids: ids.join(',') });
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/lookup?${params}`, { headers: authHeaders() });
  const json = await parseResponse(res, 'No se pudieron resolver las inscripciones');
  return json.inscriptions || [];
}
