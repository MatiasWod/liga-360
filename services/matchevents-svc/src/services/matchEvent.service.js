/** Lógica de negocio de eventos de partido (goles, tarjetas, suspensiones, sanciones). */
import { pool } from '../config/db.js';
import * as matchEventRepo from '../repositories/matchEvent.repository.js';
import * as presenceRepo from '../repositories/presence.repository.js';
import { notFound } from './serviceErrors.js';

/** Deriva presencia opt-in desde un evento atribuido (inscripción + jugador). */
function presenceFromEventRow(row) {
  const inscriptionId = row?.inscription_id;
  if (!inscriptionId) return null;
  const linkedMemberId = row.linked_member_id != null ? Number(row.linked_member_id) : null;
  const displayName = String(row.display_name || '').trim();
  if (!displayName && linkedMemberId == null) return null;
  return {
    matchId: row.match_id,
    tournamentId: row.tournament_id,
    competitionId: row.competition_id ?? null,
    inscriptionId: Number(inscriptionId),
    linkedMemberId,
    displayName: displayName || (linkedMemberId != null ? `Jugador ${linkedMemberId}` : 'Invitado'),
    isGuest: linkedMemberId == null,
    createdByUserId: row.created_by_user_id ?? null,
  };
}

async function ensurePresenceForEvent(row) {
  const payload = presenceFromEventRow(row);
  if (!payload) return null;
  return presenceRepo.ensureForAttribution(pool, payload);
}

export async function create({ matchId, tournamentId, competitionId, eventType, inscriptionId, linkedMemberId, displayName, minute, suspensionMatches, notes, extraJson, createdByUserId }) {
  const event = await matchEventRepo.create(pool, {
    matchId,
    tournamentId: String(tournamentId),
    competitionId: competitionId != null ? String(competitionId) : null,
    eventType,
    inscriptionId: inscriptionId ?? null,
    linkedMemberId: linkedMemberId ?? null,
    displayName: displayName ?? '',
    minute: minute != null ? Number(minute) : null,
    suspensionMatches: suspensionMatches != null ? Number(suspensionMatches) : null,
    notes: notes ?? null,
    extraJson: extraJson ?? null,
    createdByUserId: createdByUserId ?? null,
  });
  await ensurePresenceForEvent(event);
  return event;
}

export async function listByMatch(matchId) {
  return matchEventRepo.listByMatch(pool, matchId);
}

export async function update({ matchId, eventId, eventType, competitionId, inscriptionId, linkedMemberId, displayName, minute, suspensionMatches, notes, extraJson }) {
  if (!(await matchEventRepo.existsInMatch(pool, eventId, matchId))) {
    throw notFound('evento no encontrado');
  }
  const event = await matchEventRepo.update(pool, eventId, matchId, {
    eventType: eventType ?? null,
    competitionId: competitionId != null ? String(competitionId) : null,
    inscriptionId: inscriptionId ?? null,
    linkedMemberId: linkedMemberId ?? null,
    displayName: displayName ?? null,
    minute: minute != null ? Number(minute) : null,
    suspensionMatches: suspensionMatches != null ? Number(suspensionMatches) : null,
    notes: notes ?? null,
    extraJson: extraJson ?? null,
  });
  if (event) await ensurePresenceForEvent(event);
  return event;
}

export async function remove({ matchId, eventId }) {
  if (!(await matchEventRepo.deleteByIdInMatch(pool, eventId, matchId))) {
    throw notFound('evento no encontrado');
  }
  return { ok: true };
}
