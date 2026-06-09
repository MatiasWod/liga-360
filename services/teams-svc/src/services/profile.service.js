/**
 * Lógica de negocio de identidad (Person_Profile). Tras unir identity-svc a teams-svc, todo es
 * LOCAL: claim-by-dni y /profiles/me son JOINs/transacciones locales (sin llamadas HTTP).
 */
import { pool, withTransaction } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { normalizeDni } from '../domain/dni.js';
import * as profileRepo from '../repositories/profile.repository.js';
import * as participantRepo from '../repositories/participant.repository.js';
import * as teamRepo from '../repositories/team.repository.js';

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400, code: 'VALIDATION_ERROR' });
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409, code: 'CONFLICT' });
const notFound = (message) => Object.assign(new Error(message), { statusCode: 404, code: 'NOT_FOUND' });

export async function getMyProfile(userId) {
  const profile = await profileRepo.findByUserId(pool, userId);
  if (!profile) return { profile: null, participants: [], teams: [] };
  const [participants, teams] = await Promise.all([
    participantRepo.listByProfileId(pool, profile.id),
    teamRepo.listByProfileId(pool, profile.id),
  ]);
  return { profile, participants, teams };
}

export async function claimByDni({ userId, dni, firstName, lastName, avatarUrl }) {
  const normalizedDni = normalizeDni(dni);
  if (!normalizedDni) throw badRequest('valid dni required');
  const existing = await profileRepo.findByDni(pool, normalizedDni);
  if (existing && Number(existing.user_id) !== Number(userId)) {
    throw conflict('dni already claimed by another profile');
  }
  return withTransaction(async (client) => {
    const profile = await profileRepo.upsertByUser(client, { userId, dni: normalizedDni, firstName, lastName, avatarUrl, now: nowIso() });
    const linkedParticipants = await participantRepo.linkByDni(client, normalizedDni, profile.id, nowIso());
    return { profile, linkedParticipants };
  });
}

export async function unlinkParticipant({ userId, participantId }) {
  const profile = await profileRepo.findByUserId(pool, userId);
  if (!profile) throw notFound('profile not found');
  const id = await participantRepo.unlinkFromProfile(pool, participantId, profile.id, nowIso());
  if (id == null) throw notFound('participant not linked to your profile');
  return { ok: true, participantId: id };
}

export async function findByDni(dni) {
  return profileRepo.findByDni(pool, dni);
}

export async function findByUser(userId) {
  return profileRepo.findByUserId(pool, userId);
}
