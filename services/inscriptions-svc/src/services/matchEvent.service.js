/** Lógica de negocio de eventos de partido (goles, tarjetas, suspensiones, sanciones). */
import { pool } from '../config/db.js';
import * as matchEventRepo from '../repositories/matchEvent.repository.js';
import { notFound } from './serviceErrors.js';

export const VALID_EVENT_TYPES = ['goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction'];

export async function create({ matchId, tournamentId, eventType, inscriptionId, linkedMemberId, displayName, minute, suspensionMatches, notes, extraJson, createdByUserId }) {
  return matchEventRepo.create(pool, {
    matchId,
    tournamentId: String(tournamentId),
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
}

export async function listByMatch(matchId) {
  return matchEventRepo.listByMatch(pool, matchId);
}

export async function update({ matchId, eventId, eventType, inscriptionId, linkedMemberId, displayName, minute, suspensionMatches, notes, extraJson }) {
  if (!(await matchEventRepo.existsInMatch(pool, eventId, matchId))) {
    throw notFound('evento no encontrado');
  }
  return matchEventRepo.update(pool, eventId, matchId, {
    eventType: eventType ?? null,
    inscriptionId: inscriptionId ?? null,
    linkedMemberId: linkedMemberId ?? null,
    displayName: displayName ?? null,
    minute: minute != null ? Number(minute) : null,
    suspensionMatches: suspensionMatches != null ? Number(suspensionMatches) : null,
    notes: notes ?? null,
    extraJson: extraJson ?? null,
  });
}

export async function remove({ matchId, eventId }) {
  if (!(await matchEventRepo.deleteByIdInMatch(pool, eventId, matchId))) {
    throw notFound('evento no encontrado');
  }
  return { ok: true };
}
