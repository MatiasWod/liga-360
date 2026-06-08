/** Cliente HTTP hacia teams-svc (dueño de Team/Participant). */
import { env } from '../config/env.js';
import { svcGet } from './http.js';

const BASE = env.teamsSvcUrl;

export async function listOwnedTeamsByUser(userId) {
  const body = await svcGet(BASE, `/teams?ownerUserId=${encodeURIComponent(userId)}`);
  return body?.teams || [];
}

export async function getTeamById(teamId) {
  const body = await svcGet(BASE, `/teams/${encodeURIComponent(teamId)}`);
  return body?.team || null;
}

/** Equipos por ids y/o nombres (filtro de colección) para enriquecer inscripciones. */
export async function resolveTeams(ids, names) {
  const params = new URLSearchParams();
  if (ids.length) params.set('ids', ids.join(','));
  if (names.length) params.set('names', names.join(','));
  const body = await svcGet(BASE, `/teams?${params.toString()}`);
  return body?.teams || [];
}

export async function getParticipantsByProfile(profileId) {
  const body = await svcGet(BASE, `/participants?personProfileId=${encodeURIComponent(profileId)}`);
  return body?.participants || [];
}
