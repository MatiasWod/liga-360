import type { TeamInfo, TeamParticipant } from '../../types/domain';
import { authHeaders, parseJsonResponse, TEAMS_BASE } from './client';
import { readSessionUser } from './session';

export async function getMyTeams(): Promise<TeamInfo[]> {
  const res = await fetch(`${TEAMS_BASE}?mine=true`, { headers: authHeaders() });
  const json = await parseJsonResponse(res, 'No se pudieron cargar los equipos');
  const me = readSessionUser();
  return (json.teams || []).map((team: any) => ({
    id: String(team.id),
    name: team.name,
    badgeUrl: team.badge_url || null,
    inviteCode: team.invite_code || null,
    isOwner: me ? Number(team.owner_user_id) === Number(me.id) : false,
    secretCode: undefined,
  }));
}

export async function createTeam(name: string, badgeUrl?: string) {
  const res = await fetch(`${TEAMS_BASE}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, badgeUrl: badgeUrl || null }),
  });
  const json = await parseJsonResponse(res, 'No se pudo crear equipo');
  const me = readSessionUser();
  return {
    team: {
      id: String(json.team.id),
      name: json.team.name,
      badgeUrl: json.team.badge_url || null,
      inviteCode: json.team.invite_code || null,
      isOwner: me ? Number(json.team.owner_user_id) === Number(me.id) : true,
      secretCode: json.accessCode,
    } as TeamInfo,
    accessCode: String(json.accessCode),
  };
}

export async function updateTeam(
  teamId: string,
  payload: {
    name?: string;
    badgeUrl?: string;
    teamCode?: string;
  }
) {
  const res = await fetch(`${TEAMS_BASE}/${teamId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse(res, 'No se pudo actualizar equipo');
  return json.team;
}

export async function ensureTeamForSession() {
  const user = readSessionUser();
  if (!user || user.type !== 'team') return;
  const myTeams = await getMyTeams();
  if (myTeams.length > 0) {
    localStorage.removeItem('liga360:pendingTeamName');
    return;
  }
  const pendingName = localStorage.getItem('liga360:pendingTeamName')?.trim();
  const teamName = pendingName || user.fullName || user.username || `Equipo ${user.id}`;
  await createTeam(teamName);
  localStorage.removeItem('liga360:pendingTeamName');
}

export async function getTeamDetail(teamId: string) {
  const res = await fetch(`${TEAMS_BASE}/${teamId}`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo cargar el equipo');
  const me = readSessionUser();
  const team: TeamInfo = {
    id: String(json.team.id),
    name: json.team.name,
    badgeUrl: json.team.badge_url || null,
    inviteCode: json.team.invite_code || null,
    isOwner: me ? Number(json.team.owner_user_id) === Number(me.id) : false,
    secretCode: undefined,
  };
  const participants: TeamParticipant[] = (json.members || []).map((p: any) => ({
    id: String(p.id),
    firstName: p.first_name || '',
    lastName: p.last_name || '',
    nickname: p.nickname || '',
    dni: p.dni || '',
    avatarUrl: p.avatar_url || '',
    status: p.person_profile_id ? 'claimed' : 'unclaimed',
  }));
  return { team, participants };
}

export async function rotateTeamCode(teamId: string) {
  const res = await fetch(`${TEAMS_BASE}/${teamId}/access-code/rotate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo rotar codigo');
  return String(json.accessCode);
}

export async function getMyTeamInviteCode() {
  const res = await fetch(`${TEAMS_BASE}/me/invite-code`, { headers: authHeaders() });
  const json = await parseJsonResponse(res, 'No se pudo obtener codigo de invitacion de equipo');
  return {
    teamId: String(json.teamId),
    teamName: String(json.teamName),
    inviteCode: String(json.inviteCode),
  };
}

export async function resolveTeamByInviteCode(code: string) {
  const safeCode = String(code || '').trim().toUpperCase();
  const res = await fetch(`${TEAMS_BASE}/resolve-by-invite-code/${encodeURIComponent(safeCode)}`, {
    headers: authHeaders(),
  });
  const json = await parseJsonResponse(res, 'No se pudo resolver equipo por codigo');
  return json.team;
}
