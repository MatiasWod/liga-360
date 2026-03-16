import type { AppUser, TeamInfo, TeamParticipant, LinkedTeam } from '../types/domain';

const TEAMS_BASE = 'http://localhost:4002';
const AUTH_BASE = 'http://localhost:4003';

async function parseJsonResponse(res: Response, fallbackError: string) {
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
    throw new Error(json?.error || `${fallbackError} (HTTP ${res.status})`);
  }
  if (!json) {
    if (raw.trim().startsWith('<!DOCTYPE') || raw.trim().startsWith('<html')) {
      throw new Error(`${fallbackError}: respuesta HTML inesperada del backend`);
    }
    throw new Error(`${fallbackError}: respuesta no JSON del backend`);
  }
  return json;
}

function getToken() {
  return localStorage.getItem('liga360:token');
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function readSessionUser(): AppUser | null {
  try {
    const raw = localStorage.getItem('liga360:user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return {
      id: String(user.id),
      fullName: user.username || `Usuario ${user.id}`,
      username: user.username,
      type: user.type,
    };
  } catch {
    return null;
  }
}

export async function login(username: string, password: string) {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await parseJsonResponse(res, 'Error de login');
  localStorage.setItem('liga360:token', json.token);
  localStorage.setItem('liga360:user', JSON.stringify(json.user));
  if (json.user?.type === 'team') {
    await ensureTeamForSession();
  }
  return readSessionUser();
}

export async function register(mode: 'team' | 'participant' | 'organizer', username: string, password: string, name: string) {
  const res = await fetch(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, username, password, name }),
  });
  const json = await parseJsonResponse(res, 'Error de registro');
  if (mode === 'team') {
    localStorage.setItem('liga360:pendingTeamName', String(name || '').trim());
  }
  await login(username, password);
  return json.user;
}

export function logout() {
  localStorage.removeItem('liga360:user');
  localStorage.removeItem('liga360:token');
}

export async function getMyTeams(): Promise<TeamInfo[]> {
  const res = await fetch(`${TEAMS_BASE}/teams?mine=true`, { headers: authHeaders() });
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
  const res = await fetch(`${TEAMS_BASE}/teams`, {
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
  const res = await fetch(`${TEAMS_BASE}/teams/${teamId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse(res, 'No se pudo actualizar equipo');
  return json.team;
}

async function ensureTeamForSession() {
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
  const res = await fetch(`${TEAMS_BASE}/teams/${teamId}`, { headers: authHeaders() });
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
  const res = await fetch(`${TEAMS_BASE}/teams/${teamId}/access-code/rotate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo rotar codigo');
  return String(json.accessCode);
}

export async function getMyTeamInviteCode() {
  const res = await fetch(`${TEAMS_BASE}/teams/me/invite-code`, { headers: authHeaders() });
  const json = await parseJsonResponse(res, 'No se pudo obtener codigo de invitacion de equipo');
  return {
    teamId: String(json.teamId),
    teamName: String(json.teamName),
    inviteCode: String(json.inviteCode),
  };
}

export async function resolveTeamByInviteCode(code: string) {
  const safeCode = String(code || '').trim().toUpperCase();
  const res = await fetch(`${TEAMS_BASE}/teams/resolve-by-invite-code/${encodeURIComponent(safeCode)}`, {
    headers: authHeaders(),
  });
  const json = await parseJsonResponse(res, 'No se pudo resolver equipo por codigo');
  return json.team;
}

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
  const res = await fetch(`${TEAMS_BASE}/teams/${teamId}/members/${participantId}`, {
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

export async function getMyProfile(): Promise<{ profile: any; participants: TeamParticipant[]; teams: LinkedTeam[] }> {
  const res = await fetch(`${TEAMS_BASE}/profiles/me`, { headers: authHeaders() });
  const json = await res.json();
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
  const res = await fetch(`${TEAMS_BASE}/profiles/me/claim-by-dni`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo reclamar DNI');
  return json;
}

export async function unlinkMyParticipant(participantId: string) {
  const res = await fetch(`${TEAMS_BASE}/profiles/me/participants/${participantId}/unlink`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || 'No se pudo desvincular participante');
  return json;
}

