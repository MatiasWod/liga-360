import { API_ENDPOINTS } from '../config';

export { getToken, authHeaders } from '../http';

export const TEAMS_BASE = API_ENDPOINTS.teams;
export const AUTH_BASE = API_ENDPOINTS.auth;

export function formatApiError(json: any, fallback: string): string {
  const err = json?.error;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err.message === 'string' && err.message.trim()) return err.message;
  return fallback;
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
    if (typeof err === 'string' && err.trim()) {
      throw new Error(err);
    }
    if (err?.message) {
      const details = Array.isArray(err.details)
        ? err.details.map((d: any) => d?.message || d?.field).filter(Boolean).join('; ')
        : '';
      throw new Error(details ? `${err.message}: ${details}` : err.message);
    }
    throw new Error(formatApiError(json, `${fallbackError} (HTTP ${res.status})`));
  }
  if (!json) {
    if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
      throw new Error(`${fallbackError}: respuesta HTML inesperada del backend`);
    }
    throw new Error(`${fallbackError}: respuesta no JSON del backend`);
  }
  return json;
}
