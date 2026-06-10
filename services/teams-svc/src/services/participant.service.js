/** Lógica de negocio de participantes: alta/edición + auto-link a profile por DNI (JOIN local). */
import { pool, withTransaction } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { normalizeDni } from '../domain/dni.js';
import * as participantRepo from '../repositories/participant.repository.js';
import * as membershipRepo from '../repositories/membership.repository.js';
import * as profileRepo from '../repositories/profile.repository.js';
import { canWriteTeam, forbidden } from './teamAccess.js';

async function profileIdByDni(client, normalizedDni) {
  if (!normalizedDni) return null;
  const profile = await profileRepo.findByDni(client, normalizedDni);
  return profile?.id ?? null;
}

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404, code: 'NOT_FOUND' });
}

export async function createParticipant({ firstName, lastName, nickname, avatarUrl, dni, teamId, teamCode, userId }) {
  const normalizedDni = normalizeDni(dni);
  const displayName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();

  const participant = await withTransaction(async (client) => {
    if (teamId) {
      if (!(await canWriteTeam(client, Number(teamId), userId, teamCode))) throw forbidden();
    }
    // Auto-link al profile por DNI (JOIN local en la misma DB).
    const profileId = await profileIdByDni(client, normalizedDni);
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

  const participant = await withTransaction(async (client) => {
    const profileId = await profileIdByDni(client, normalizedDni);
    if (teamId) {
      // Autorización por equipo: owner del team o teamCode válido, y participante en su roster.
      if (!(await canWriteTeam(client, Number(teamId), userId, teamCode))) throw forbidden();
      if (!(await membershipRepo.exists(client, Number(teamId), participantId))) {
        throw notFound('participant is not member of this team');
      }
    } else {
      // Sin teamId: solo el creador del participante o el dueño del profile vinculado.
      if (!userId) throw forbidden();
      const existing = await participantRepo.findById(client, participantId);
      if (!existing) throw notFound('participant not found');
      const callerProfile = await profileRepo.findByUserId(client, userId);
      const owns =
        existing.created_by_user_id === userId ||
        (callerProfile != null && existing.person_profile_id === callerProfile.id);
      if (!owns) throw forbidden();
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

// --- Lectura de vínculo para inscriptions-svc (GET /participants?personProfileId=) ---

export async function listByProfile(personProfileId) {
  return { participants: await participantRepo.listByProfileId(pool, personProfileId) };
}
