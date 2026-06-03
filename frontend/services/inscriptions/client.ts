import { API_ENDPOINTS } from '../config';

export const INSCRIPTIONS_BASE = API_ENDPOINTS.inscriptions;
export const TEAMS_BASE = API_ENDPOINTS.teams;

export function authHeaders() {
  const token = localStorage.getItem('liga360:token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function parseResponse(res: Response, fallbackError: string) {
  const raw = await res.text();
  let json: any = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }
  if (!res.ok) throw new Error(json?.error || `${fallbackError} (HTTP ${res.status})`);
  if (!json) throw new Error(`${fallbackError}: respuesta invalida`);
  return json;
}
