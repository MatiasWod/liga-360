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
  competition_id: string | null;
  competitor_kind?: 'team' | 'participant';
  team_badge_url?: string | null;
  source: 'public' | 'invitation' | 'manual';
  linked_team_id: number | null;
  linked_participant_user_id?: number | null;
  display_name: string;
  status: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO';
  created_by_user_id: number | null;
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
  competition_id: string | null;
  type: 'public' | 'targeted';
  target_inscription_id: number | null;
  target_team_code?: string | null;
  target_participant_user_id?: number | null;
  status: 'active' | 'revoked';
  invite_response_status?: 'pending' | 'accepted' | 'rejected';
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  created_at: string;
}

export async function listTournamentInscriptions(tournamentId: string): Promise<InscriptionItem[]> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/tournaments/${encodeURIComponent(tournamentId)}/inscriptions`, {
    headers: authHeaders(),
  });
  const json = await parseResponse(res, 'No se pudieron cargar las inscripciones');
  return json.inscriptions || [];
}

export async function listCompetitionInscriptions(competitionId: string): Promise<InscriptionItem[]> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/competitions/${encodeURIComponent(competitionId)}/inscriptions`, {
    headers: authHeaders(),
  });
  const json = await parseResponse(res, 'No se pudieron cargar las inscripciones de la competicion');
  return json.inscriptions || [];
}

export async function createManualTeamInscription(payload: {
  tournamentId: string;
  competitionId: string;
  name: string;
  linkedTeamId?: number | null;
  badgeUrl?: string | null;
}): Promise<InscriptionItem> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tournamentId: payload.tournamentId,
      competitionId: payload.competitionId,
      displayName: payload.name,
      linkedTeamId: payload.linkedTeamId ?? null,
      source: 'manual',
    }),
  });
  const json = await parseResponse(res, 'No se pudo crear la inscripcion manual');
  return json.inscription;
}

export async function createManualParticipantInscription(payload: {
  tournamentId: string;
  competitionId: string;
  name: string;
  linkedParticipantUserId?: number | null;
}): Promise<InscriptionItem> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tournamentId: payload.tournamentId,
      competitionId: payload.competitionId,
      displayName: payload.name,
      linkedParticipantUserId: payload.linkedParticipantUserId ?? null,
      competitorKind: 'participant',
      source: 'manual',
    }),
  });
  const json = await parseResponse(res, 'No se pudo crear la inscripcion manual de participante');
  return json.inscription;
}

export async function createPublicTeamInscription(payload: {
  tournamentId: string;
  competitionId?: string | null;
  teamId: number;
  teamName: string;
}): Promise<InscriptionItem> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tournamentId: payload.tournamentId,
      competitionId: payload.competitionId ?? null,
      displayName: payload.teamName,
      linkedTeamId: payload.teamId,
      source: 'public',
    }),
  });
  const json = await parseResponse(res, 'No se pudo solicitar la inscripcion');
  return json.inscription;
}

export async function createPublicParticipantInscription(payload: {
  tournamentId: string;
  competitionId?: string | null;
  displayName: string;
}): Promise<InscriptionItem> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tournamentId: payload.tournamentId,
      competitionId: payload.competitionId ?? null,
      displayName: payload.displayName,
      source: 'public',
      competitorKind: 'participant',
    }),
  });
  const json = await parseResponse(res, 'No se pudo solicitar la inscripcion como participante');
  return json.inscription;
}

export async function updateInscriptionStatus(inscriptionId: number, status: 'approved' | 'rejected') {
  const mappedStatus = status === 'approved' ? 'ACEPTADO' : 'RECHAZADO';
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/${inscriptionId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status: mappedStatus }),
  });
  const json = await parseResponse(res, 'No se pudo actualizar el estado');
  return json.inscription;
}

export async function moveInscriptionCompetition(inscriptionId: number, competitionId: string) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/${inscriptionId}/competition`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ competitionId }),
  });
  const json = await parseResponse(res, 'No se pudo mover la inscripcion de competicion');
  return json.inscription as InscriptionItem;
}

export async function associateInscription(inscriptionId: number) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/${inscriptionId}/associate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo asociar la inscripcion');
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

export async function listCompetitionInvites(competitionId: string): Promise<TournamentInvite[]> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites?competitionId=${encodeURIComponent(competitionId)}`, {
    headers: authHeaders(),
  });
  const json = await parseResponse(res, 'No se pudieron cargar invitaciones');
  return json.invites || [];
}

export async function createCompetitionInvite(tournamentId: string, competitionId?: string | null): Promise<TournamentInvite> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ tournamentId, competitionId: competitionId ?? null, type: 'public' }),
  });
  const json = await parseResponse(res, 'No se pudo crear invitacion');
  return json.invite;
}

export async function createTournamentInvite(tournamentId: string): Promise<TournamentInvite> {
  return createCompetitionInvite(tournamentId, null);
}

export async function claimCompetitionByInviteCode(code: string) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/code/claim`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code: String(code || '').trim().toUpperCase() }),
  });
  const json = await parseResponse(res, 'No se pudo inscribir mediante codigo');
  return json.inscription;
}

export async function createTeamInvite(payload: {
  tournamentId: string;
  competitionId?: string | null;
  targetInscriptionId?: number;
  targetTeamCode?: string;
  targetParticipantUserId?: number;
}): Promise<TournamentInvite> {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tournamentId: payload.tournamentId,
      competitionId: payload.competitionId ?? null,
      type: 'targeted',
      targetInscriptionId: payload.targetInscriptionId ?? null,
      targetTeamCode: payload.targetTeamCode ? payload.targetTeamCode.toUpperCase() : null,
      targetParticipantUserId: payload.targetParticipantUserId ?? null,
    }),
  });
  const json = await parseResponse(res, 'No se pudo crear invitacion por equipo');
  return json.invite;
}

export async function getInviteByToken(token: string): Promise<{
  id: number;
  tournamentId: string;
  competitionId?: string | null;
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
  const invite = json.invite;
  return {
    ...invite,
    inviteType: invite.inviteType === 'public' ? 'general' : 'team',
    consumedAt: null,
    consumedByUserId: null,
  };
}

export async function claimGeneralInvite(token: string, payload: {
  mode: 'without_account' | 'with_account';
  displayName?: string;
  badgeUrl?: string | null;
}) {
  const displayName = (payload.displayName || '').trim() || 'Equipo pendiente';
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/${encodeURIComponent(token)}/use`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ displayName }),
  });
  const json = await parseResponse(res, 'No se pudo reclamar la invitacion');
  return json;
}

export async function claimTeamInvite(token: string) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/${encodeURIComponent(token)}/use`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo asociar la invitacion de equipo');
  return json;
}

export async function createManualTeamInscriptionsBatch(payload: {
  tournamentId: string;
  competitionId: string;
  entries: Array<{ name: string; linkedTeamId?: number | null }>;
}) {
  const results: Array<{ ok: boolean; inscription?: InscriptionItem; error?: string; name: string }> = [];
  for (const entry of payload.entries) {
    const name = String(entry.name || '').trim();
    if (!name) {
      results.push({ ok: false, error: 'Nombre requerido', name: '' });
      continue;
    }
    try {
      const inscription = await createManualTeamInscription({
        tournamentId: payload.tournamentId,
        competitionId: payload.competitionId,
        name,
        linkedTeamId: entry.linkedTeamId ?? null,
      });
      results.push({ ok: true, inscription, name });
    } catch (e: any) {
      results.push({ ok: false, error: e?.message || 'Error al crear inscripcion', name });
    }
  }
  return results;
}

export async function createManualParticipantInscriptionsBatch(payload: {
  tournamentId: string;
  competitionId: string;
  entries: Array<{ name: string; linkedParticipantUserId?: number | null }>;
}) {
  const results: Array<{ ok: boolean; inscription?: InscriptionItem; error?: string; name: string }> = [];
  for (const entry of payload.entries) {
    const name = String(entry.name || '').trim();
    if (!name) {
      results.push({ ok: false, error: 'Nombre requerido', name: '' });
      continue;
    }
    try {
      const inscription = await createManualParticipantInscription({
        tournamentId: payload.tournamentId,
        competitionId: payload.competitionId,
        name,
        linkedParticipantUserId: entry.linkedParticipantUserId ?? null,
      });
      results.push({ ok: true, inscription, name });
    } catch (e: any) {
      results.push({ ok: false, error: e?.message || 'Error al crear inscripcion', name });
    }
  }
  return results;
}

export async function listMyTeamInvites() {
  const res = await fetch(`${INSCRIPTIONS_BASE}/teams/me/invites`, { headers: authHeaders() });
  if (res.status === 404) {
    return { invites: [] };
  }
  const json = await parseResponse(res, 'No se pudieron cargar invitaciones del equipo');
  return json;
}

export async function acceptMyTeamInvite(inviteId: number) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/teams/me/invites/${inviteId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo aceptar la invitacion');
  return json;
}

export async function rejectMyTeamInvite(inviteId: number) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/teams/me/invites/${inviteId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo rechazar la invitacion');
  return json;
}

export async function listMyParticipantInvites() {
  const res = await fetch(`${INSCRIPTIONS_BASE}/participants/me/invites`, { headers: authHeaders() });
  if (res.status === 404) {
    return { invites: [] };
  }
  const json = await parseResponse(res, 'No se pudieron cargar invitaciones del participante');
  return json;
}

export async function acceptMyParticipantInvite(inviteId: number) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/participants/me/invites/${inviteId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo aceptar la invitacion');
  return json;
}

export async function rejectMyParticipantInvite(inviteId: number) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/participants/me/invites/${inviteId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  const json = await parseResponse(res, 'No se pudo rechazar la invitacion');
  return json;
}

