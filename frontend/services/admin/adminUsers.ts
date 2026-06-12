import { AUTH_BASE, authHeaders, parseJsonResponse } from '../teams/client';

/** Usuario como lo expone auth-svc al admin (GET /users). Nunca incluye password. */
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  type: 'team' | 'participant' | 'organizer' | 'admin';
  isVerified: boolean;
  bannedAt: string | null;
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await fetch(`${AUTH_BASE}/users`, { headers: authHeaders() });
  const json = await parseJsonResponse(res, 'No se pudieron cargar los usuarios');
  return json.users;
}

export async function banUser(id: number): Promise<AdminUser> {
  const res = await fetch(`${AUTH_BASE}/users/${id}/ban`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await parseJsonResponse(res, 'No se pudo banear al usuario');
  return json.user;
}

export async function unbanUser(id: number): Promise<AdminUser> {
  const res = await fetch(`${AUTH_BASE}/users/${id}/ban`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await parseJsonResponse(res, 'No se pudo desbanear al usuario');
  return json.user;
}
