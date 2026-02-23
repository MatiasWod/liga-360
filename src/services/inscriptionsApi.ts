const INSCRIPTIONS_BASE = 'http://localhost:4004';
const TEAMS_BASE = 'http://localhost:4002';

function authHeaders() {
  const token = localStorage.getItem('liga360:token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseResponse(res: Response, fallbackError: string) {
  const raw = await res.text();
  let json: any = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }
  if (!res.ok) throw new Error(json?.error || `${fallbackError} (HTTP ${res.status})`);
  if (!json) throw new Error(`${fallbackError}: respuesta invalida`);
  return json;
}

export interface InscriptionItem {
  id: number;
  tournament_id: string;
  competitor_kind: 'team' | 'participant';
  source: 'manual' | 'self';
  linked_team_id: number | null;
  display_name: string;
  badge_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_by_user_id: number | null;
  reviewed_by_user_id: number | null;
}

export interface TeamOption {
  id: number;
  name: string;
  badge_url?: string | null;
}

export interface TournamentInvite {
  id: number;
  token: string;
  tournament_id: string;
  invite_type: 'general' | 'team';
  target_inscription_id: number | null;
  status: 'active' | 'revoked' | 'consumed';
  expires_at: string | null;
  consumed_at: string | null;
  consumed_by_user_id: number | null;
  created_by_user_id: number;
  created_at: string;
}

export async function listTournamentInscriptions(tournamentId: string): Promise<InscriptionItem[]> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions?tournamentId=${encodeURIComponent(tournamentId)}`, {
    headers: authHeaders(),
  });
  const json = await parseResponse(res, 'No se pudieron cargar las inscripciones');
  return json.inscriptions || [];
}

export async function createManualTeamInscription(payload: {
  tournamentId: string;
  name: string;
  linkedTeamId?: number | null;
  badgeUrl?: string | null;
}): Promise<InscriptionItem> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/manual-team`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await parseResponse(res, 'No se pudo crear la inscripcion manual');
  return json.inscription;
}

export async function updateInscriptionStatus(inscriptionId: number, status: 'approved' | 'rejected') {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/${inscriptionId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  const json = await parseResponse(res, 'No se pudo actualizar el estado');
  return json.inscription;
}

export async function listTeamsForOrganizer(): Promise<TeamOption[]> {
  const res = await fetch(`${TEAMS_BASE}/teams`, { headers: authHeaders() });
  const json = await parseResponse(res, 'No se pudieron cargar equipos');
  return (json.teams || []).map((team: any) => ({
    id: Number(team.id),
    name: team.name,
    badge_url: team.badge_url || null,
  }));
}

export async function listTournamentInvites(tournamentId: string): Promise<TournamentInvite[]> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites?tournamentId=${encodeURIComponent(tournamentId)}`, {
    headers: authHeaders(),
  });
  const json = await parseResponse(res, 'No se pudieron cargar invitaciones');
  return json.invites || [];
}

export async function createTournamentInvite(tournamentId: string): Promise<TournamentInvite> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/general`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tournamentId }),
  });
  const json = await parseResponse(res, 'No se pudo crear invitacion');
  return json.invite;
}

export async function createTeamInvite(tournamentId: string, targetInscriptionId: number): Promise<TournamentInvite> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/team`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tournamentId, targetInscriptionId }),
  });
  const json = await parseResponse(res, 'No se pudo crear invitacion por equipo');
  return json.invite;
}

export async function getInviteByToken(token: string): Promise<{
  id: number;
  tournamentId: string;
  inviteType: 'general' | 'team';
  status: string;
  expiresAt: string | null;
  consumedAt: string | null;
  consumedByUserId: number | null;
  targetInscriptionId: number | null;
  target: any;
}> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/${encodeURIComponent(token)}`);
  const json = await parseResponse(res, 'No se pudo cargar la invitacion');
  return json.invite;
}

export async function claimGeneralInvite(token: string, payload: {
  mode: 'without_account' | 'with_account';
  displayName?: string;
  badgeUrl?: string | null;
}) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/${encodeURIComponent(token)}/claim-general`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await parseResponse(res, 'No se pudo reclamar la invitacion');
  return json;
}

export async function claimTeamInvite(token: string) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/${encodeURIComponent(token)}/claim-team`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo asociar la invitacion de equipo');
  return json;
}

