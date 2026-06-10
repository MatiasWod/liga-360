import { API_ENDPOINTS } from '../config';

export const TEAMS_BASE = API_ENDPOINTS.teams;
export const AUTH_BASE = API_ENDPOINTS.auth;

export function getToken() {
  return localStorage.getItem('liga360:token');
}

export function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function parseJsonResponse(res: Response, fallbackError: string) {
  const raw = await res.text();
  let json: any = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }
  if (!res.ok) {
    const err = json?.error;
    if (typeof err === 'string') {
      throw new Error(err);
    }
    if (err?.message) {
      const details = Array.isArray(err.details)
        ? err.details.map((d: any) => d?.message || d?.field).filter(Boolean).join('; ')
        : '';
      throw new Error(details ? `${err.message}: ${details}` : err.message);
    }
    throw new Error(`${fallbackError} (HTTP ${res.status})`);
  }
  if (!json) {
    if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
      throw new Error(`${fallbackError}: respuesta HTML inesperada del backend`);
    }
    throw new Error(`${fallbackError}: respuesta no JSON del backend`);
  }
  return json;
}
