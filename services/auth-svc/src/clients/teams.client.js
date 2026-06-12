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

export async function createParticipant({ name, token }) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || parts[0];

  const response = await fetch(`${BASE_URL}/participants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ firstName, lastName, linkToUserProfile: true }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error || `teams-svc responded ${response.status}`);
  }
  return response.json();
}
