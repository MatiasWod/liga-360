/** Cliente HTTP hacia teams-svc (dueño de Team/Participant). */
import { env } from '../config/env.js';
import { svcGet } from './http.js';

/** Devuelve el team ({ id, owner_user_id, ... }) o null si no existe. */
export async function getTeam(teamId) {
  const json = await svcGet(env.teamsSvcUrl, `/teams/${Number(teamId)}`);
  return json?.team ?? null;
}
