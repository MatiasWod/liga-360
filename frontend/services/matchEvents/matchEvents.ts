import { API_ENDPOINTS } from '../config';
import { authHeaders } from '../http';
import { PAGE_MAX_LIMIT } from '../pagination';
import type { CreateMatchEventPayload, MatchEvent, UpdateMatchEventPayload } from './types';

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

// matchevents-svc (servicio propio). En prod nginx enruta /api/matches → matchevents-svc.
const base = () => API_ENDPOINTS.matchEvents;

export async function listMatchEvents(matchId: string): Promise<MatchEvent[]> {
  // Eventos completos del partido (alimentan tarjetas/forms): pide el tope, no el default.
  const res = await fetch(`${base()}/${encodeURIComponent(matchId)}/events?limit=${PAGE_MAX_LIMIT}`, {
    headers: authHeaders(),
  });
  return handleResponse<MatchEvent[]>(res);
}

export async function createMatchEvent(
  matchId: string,
  payload: CreateMatchEventPayload
): Promise<MatchEvent> {
  const res = await fetch(`${base()}/${encodeURIComponent(matchId)}/events`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<MatchEvent>(res);
}

export async function updateMatchEvent(
  matchId: string,
  eventId: number,
  payload: UpdateMatchEventPayload
): Promise<MatchEvent> {
  const res = await fetch(
    `${base()}/${encodeURIComponent(matchId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    }
  );
  return handleResponse<MatchEvent>(res);
}

export async function deleteMatchEvent(matchId: string, eventId: number): Promise<void> {
  const res = await fetch(
    `${base()}/${encodeURIComponent(matchId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
}
