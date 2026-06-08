/** Cliente HTTP hacia teams-svc (dueño de Participant/Team). */
import { env } from '../config/env.js';
import { logger } from '../logger.js';

const BASE_URL = env.teamsSvcUrl;

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    logger.error({ err: err.message, path }, 'teams-svc request failed');
    throw Object.assign(new Error('teams service unavailable'), { statusCode: 502, code: 'TEAMS_SVC_ERROR' });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw Object.assign(new Error(`teams-svc responded ${response.status}`), { statusCode: 502, code: 'TEAMS_SVC_ERROR' });
  }
  return response.json();
}

/** Participantes + equipos vinculados a un person_profile id (para /profiles/me). */
export async function getRosterByProfile(profileId) {
  const [participantsBody, teamsBody] = await Promise.all([
    request(`/participants?personProfileId=${encodeURIComponent(profileId)}`),
    request(`/teams?personProfileId=${encodeURIComponent(profileId)}`),
  ]);
  return {
    participants: participantsBody?.participants || [],
    teams: teamsBody?.teams || [],
  };
}

/** Vincula participantes con ese DNI al profile; devuelve { linkedParticipants: id[] }. */
export async function linkParticipantsByDni(dni, personProfileId) {
  const body = await request(`/participants?dni=${encodeURIComponent(dni)}`, {
    method: 'PATCH',
    body: { personProfileId },
  });
  return body || { linkedParticipants: [] };
}

/** Desvincula un participante del profile; devuelve { ok, participantId }. */
export async function unlinkParticipant(participantId, personProfileId) {
  const body = await request(`/participants/${encodeURIComponent(participantId)}/person-profile`, {
    method: 'DELETE',
    body: { personProfileId },
  });
  return body || { ok: false };
}
