/** Lógica de negocio de participantes: alta/edición + auto-link a profile por DNI (vía identity-svc). */
import { pool, withTransaction } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { normalizeDni } from '../domain/dni.js';
import * as participantRepo from '../repositories/participant.repository.js';
import * as membershipRepo from '../repositories/membership.repository.js';
import { canWriteTeam, forbidden } from './teamAccess.js';
import * as identityClient from '../clients/identity.client.js';

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404, code: 'NOT_FOUND' });
}

export async function createParticipant({ firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode, userId }) {
  const normalizedDni = normalizeDni(dni);
  const displayName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
  // Lookup del profile por DNI fuera de la transacción (llamada HTTP a identity-svc).
  const profileId = normalizedDni ? await identityClient.getProfileIdByDni(normalizedDni) : null;

  const participant = await withTransaction(async (client) => {
    if (teamId) {
      if (!(await canWriteTeam(client, Number(teamId), userId, teamCode))) throw forbidden();
    }
    const created = await participantRepo.create(client, {
      displayName,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      nickname: nickname?.trim() || null,
      dni: normalizedDni,
      avatarUrl: avatarUrl || null,
      createdByUserId: userId ?? null,
      now: nowIso(),
    });
    if (profileId) {
      await participantRepo.setPersonProfileId(client, created.id, profileId, nowIso());
      created.person_profile_id = profileId;
    }
    if (teamId) {
      await membershipRepo.add(client, Number(teamId), created.id, nowIso());
    }
    return created;
  });
  return { participant };
}

export async function updateParticipant({ participantId, firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode, userId }) {
  const normalizedDni = dni === undefined ? undefined : normalizeDni(dni);
  const profileId = normalizedDni ? await identityClient.getProfileIdByDni(normalizedDni) : null;

  const participant = await withTransaction(async (client) => {
    if (!(await canWriteTeam(client, Number(teamId), userId, teamCode))) throw forbidden();
    if (!(await membershipRepo.exists(client, Number(teamId), participantId))) {
      throw notFound('participant is not member of this team');
    }
    const updated = await participantRepo.update(client, participantId, {
      firstName: firstName?.trim() || null,
      lastName: lastName?.trim() || null,
      nickname: nickname === '' ? '__CLEAR__' : (nickname ?? null),
      dni: dni === '' ? '__CLEAR__' : (normalizedDni ?? null),
      avatarUrl: avatarUrl === '' ? '__CLEAR__' : (avatarUrl ?? null),
      now: nowIso(),
    });
    if (!updated) throw notFound('participant not found');
    if (profileId) {
      await participantRepo.setPersonProfileId(client, participantId, profileId, nowIso());
      updated.person_profile_id = profileId;
    }
    return updated;
  });
  return { participant };
}

// --- Lecturas/escrituras de vínculo para consumidores (identity-svc, inscriptions-svc) ---

export async function listByProfile(personProfileId) {
  return { participants: await participantRepo.listByProfileId(pool, personProfileId) };
}

export async function linkByDni(dni, personProfileId) {
  const linkedParticipants = await participantRepo.linkByDni(pool, dni, personProfileId, nowIso());
  return { linkedParticipants };
}

export async function unlinkFromProfile(participantId, personProfileId) {
  const id = await participantRepo.unlinkFromProfile(pool, participantId, personProfileId, nowIso());
  return { ok: id != null, participantId: id };
}
