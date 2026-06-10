import { env } from '../config/env.js';

const BASE_URL = env.teamsSvcUrl;

export async function createTeam({ name, token }) {
  const response = await fetch(`${BASE_URL}/teams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `teams-svc responded ${response.status}`);
  }
  return response.json();
}

export async function createParticipant({ name, firstName, lastName, nickname, dni, token }) {
  // Compat: si no llegan firstName/lastName explícitos, se derivan de name.
  if (!firstName?.trim() || !lastName?.trim()) {
    const parts = name.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || parts[0];
  }

  // selfProfile: este endpoint solo se invoca al registrarse un usuario participante,
  // por lo que teams-svc debe crear su Person_Profile (identidad) y vincular el participante.
  const body = { firstName: firstName.trim(), lastName: lastName.trim(), selfProfile: true };
  if (nickname?.trim()) body.nickname = nickname.trim();
  if (dni != null && String(dni).trim() !== '') body.dni = String(dni).trim();

  const response = await fetch(`${BASE_URL}/participants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `teams-svc responded ${response.status}`);
  }
  return response.json();
}
