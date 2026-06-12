import { AUTH_BASE, authHeaders, parseJsonResponse } from './client';
import { readSessionUser, saveSession } from './session';
import { ensureTeamForSession } from './teams';

export async function login(username: string, password: string) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, password }),
  });
  const json = await parseJsonResponse(res, 'Error de login');
  saveSession(json.token, json.user);
  if (json.user?.type === 'team' && json.user?.isVerified !== false ) {
    await ensureTeamForSession();
  }
  return readSessionUser();
}

export async function register(mode: 'team' | 'participant' | 'organizer', username: string, email: string, password: string, name: string, nickname?: string | null, dni?: string | null) {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ mode, username, email, password, name, nickname, dni }),
  });
  const json = await parseJsonResponse(res, 'Error de registro');
  if (mode === 'team') {
    localStorage.setItem('liga360:pendingTeamName', String(name || '').trim());
  }
  await login(username, password);
  return json.user;
}
