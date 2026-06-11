import { authHeaders, INSCRIPTIONS_BASE, parseResponse, TEAMS_BASE } from './client';
import type { InscriptionItem, TeamOption } from './types';

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

export async function updateInscriptionWeight(inscriptionId: number, weight: number | null) {
  const res = await fetch(`${INSCRIPTIONS_BASE}/inscriptions/${inscriptionId}/weight`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ weight }),
  });
  const json = await parseResponse(res, 'No se pudo actualizar la ponderacion');
  return json.inscription as InscriptionItem;
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
  const res = await fetch(`${TEAMS_BASE}`, { headers: authHeaders() });
  const json = await parseResponse(res, 'No se pudieron cargar equipos');
  return (json.teams || []).map((team: any) => ({
    id: Number(team.id),
    name: team.name,
    badge_url: team.badge_url || null,
  }));
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
