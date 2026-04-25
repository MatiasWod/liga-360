import { API_ENDPOINTS } from '../config';
import type { CreateMatchEventPayload, MatchEvent, UpdateMatchEventPayload } from './types';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('liga360:token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json as T;
}

const base = () => API_ENDPOINTS.inscriptions;

export async function listMatchEvents(matchId: string): Promise<MatchEvent[]> {
  const res = await fetch(`${base()}/matches/${encodeURIComponent(matchId)}/events`, {
    headers: { ...getAuthHeaders() },
  });
  return handleResponse<MatchEvent[]>(res);
}

export async function createMatchEvent(
  matchId: string,
  payload: CreateMatchEventPayload
): Promise<MatchEvent> {
  const res = await fetch(`${base()}/matches/${encodeURIComponent(matchId)}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    `${base()}/matches/${encodeURIComponent(matchId)}/events/${eventId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    }
  );
  return handleResponse<MatchEvent>(res);
}

export async function deleteMatchEvent(matchId: string, eventId: number): Promise<void> {
  const res = await fetch(
    `${base()}/matches/${encodeURIComponent(matchId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
    }
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
}
