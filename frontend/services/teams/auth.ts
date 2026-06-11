import { AUTH_BASE, parseJsonResponse } from './client';
import { readSessionUser, saveSession } from './session';
import { ensureTeamForSession } from './teams';

export async function login(username: string, password: string) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await parseJsonResponse(res, 'Error de login');
  saveSession(json.token, json.user);
  if (json.user?.type === 'team') {
    await ensureTeamForSession();
  }
  return readSessionUser();
}

export async function register(mode: 'team' | 'participant' | 'organizer', username: string, email: string, password: string, name: string) {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, username, email, password, name }),
  });
  const json = await parseJsonResponse(res, 'Error de registro');
  if (mode === 'team') {
    localStorage.setItem('liga360:pendingTeamName', String(name || '').trim());
  }
  await login(username, password);
  return json.user;
}
