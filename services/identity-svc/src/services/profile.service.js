/** Lógica de negocio de identidad: claim-by-dni, perfil propio y desvinculación. */
import { pool } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { normalizeDni } from '../domain/dni.js';
import * as profileRepo from '../repositories/profile.repository.js';
import * as teamsClient from '../clients/teams.client.js';

export async function getMyProfile(userId) {
  const profile = await profileRepo.findByUserId(pool, userId);
  if (!profile) return { profile: null, participants: [], teams: [] };
  const roster = await teamsClient.getRosterByProfile(profile.id);
  return { profile, participants: roster.participants ?? [], teams: roster.teams ?? [] };
}

export async function claimByDni({ userId, dni, firstName, lastName, avatarUrl }) {
  const normalizedDni = normalizeDni(dni);
  if (!normalizedDni) {
    throw Object.assign(new Error('valid dni required'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  const existing = await profileRepo.findByDni(pool, normalizedDni);
  if (existing && Number(existing.user_id) !== Number(userId)) {
    throw Object.assign(new Error('dni already claimed by another profile'), { statusCode: 409, code: 'CONFLICT' });
  }
  const profile = await profileRepo.upsertByUser(pool, {
    userId,
    dni: normalizedDni,
    firstName,
    lastName,
    avatarUrl,
    now: nowIso(),
  });
  // Vincular participantes con ese DNI (en teams-svc).
  const link = await teamsClient.linkParticipantsByDni(normalizedDni, profile.id);
  return { profile, linkedParticipants: link.linkedParticipants ?? [] };
}

export async function findByDni(dni) {
  return profileRepo.findByDni(pool, dni);
}

export async function findByUser(userId) {
  return profileRepo.findByUserId(pool, userId);
}

export async function unlinkParticipant({ userId, participantId }) {
  const profile = await profileRepo.findByUserId(pool, userId);
  if (!profile) {
    throw Object.assign(new Error('profile not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  const result = await teamsClient.unlinkParticipant(participantId, profile.id);
  if (!result?.ok) {
    throw Object.assign(new Error('participant not linked to your profile'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return { ok: true, participantId };
}
