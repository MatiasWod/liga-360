import type { LinkedTeam, TeamParticipant } from '../../types/domain';
import { authHeaders, parseJsonResponse, TEAMS_BASE } from './client';

export async function getMyProfile(): Promise<{ profile: any; participants: TeamParticipant[]; teams: LinkedTeam[] }> {
  const res = await fetch(`${TEAMS_BASE}/profiles/me`, { headers: authHeaders() });
  const json = await parseJsonResponse(res, 'No se pudo cargar perfil');
  if (!res.ok) throw new Error(json?.error || 'No se pudo cargar perfil');
  const participants: TeamParticipant[] = (json.participants || []).map((p: any) => ({
    id: String(p.id),
    firstName: p.first_name || '',
    lastName: p.last_name || '',
    nickname: p.nickname || '',
    dni: p.dni || '',
    avatarUrl: p.avatar_url || '',
    status: p.person_profile_id ? 'claimed' : 'unclaimed',
  }));
  const teams: LinkedTeam[] = (json.teams || []).map((t: any) => ({
    id: String(t.id),
    name: t.name,
    badgeUrl: t.badge_url || '',
    roleLabel: 'Vinculado',
  }));
  return { profile: json.profile, participants, teams };
}

export async function claimMyDni(payload: { dni: string; firstName?: string; lastName?: string; avatarUrl?: string }) {
  const res = await fetch(`${TEAMS_BASE}/profiles/me/claims`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse(res, 'No se pudo reclamar DNI');
  if (!res.ok) throw new Error(json?.error || 'No se pudo reclamar DNI');
  return json;
}

export async function unlinkMyParticipant(participantId: string) {
  const res = await fetch(`${TEAMS_BASE}/profiles/me/participants/${participantId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await parseJsonResponse(res, 'No se pudo desvincular participante');
  if (!res.ok) throw new Error(json?.error || 'No se pudo desvincular participante');
  return json;
}
