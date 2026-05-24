import { authHeaders, parseJsonResponse, TEAMS_BASE } from './client';

export async function createParticipant(payload: {
  firstName: string;
  lastName: string;
  nickname?: string;
  dni?: string;
  avatarUrl?: string;
  teamId?: string;
  teamCode?: string;
}) {
  const res = await fetch(`${TEAMS_BASE}/participants`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo crear participante');
  return json.participant;
}

export async function removeTeamMember(teamId: string, participantId: string, teamCode?: string) {
  const res = await fetch(`${TEAMS_BASE}/${teamId}/members/${participantId}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ teamCode: teamCode || null }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo remover integrante');
  return json;
}

export async function updateParticipant(
  participantId: string,
  payload: {
    teamId: string;
    firstName?: string;
    lastName?: string;
    nickname?: string;
    dni?: string;
    avatarUrl?: string;
    teamCode?: string;
  }
) {
  const res = await fetch(`${TEAMS_BASE}/participants/${participantId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse(res, 'No se pudo actualizar participante');
  return json.participant;
}
