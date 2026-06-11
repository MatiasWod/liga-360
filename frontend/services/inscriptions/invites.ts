import { authHeaders, INSCRIPTIONS_BASE, parseResponse } from './client';
import type { TournamentInvite } from './types';

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
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/claims`, {
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
  const res = await fetch(`${INSCRIPTIONS_BASE}/invites/${encodeURIComponent(token)}`, { headers: authHeaders() });
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
