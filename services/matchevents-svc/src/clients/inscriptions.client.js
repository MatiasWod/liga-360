/** Cliente HTTP hacia inscriptions-svc (endpoint interno de lookup por id). */
import { env } from '../config/env.js';
import { svcGet } from './http.js';

/** Devuelve la inscripción (snake_case) o null si no existe. */
export async function getInscription(inscriptionId) {
  const json = await svcGet(env.inscriptionsSvcUrl, `/inscriptions/${Number(inscriptionId)}`);
  return json?.inscription ?? null;
}

/** Historial cross-torneo de un equipo (endpoint público de inscriptions-svc). */
export async function listTeamInscriptions(teamId) {
  let response;
  try {
    response = await fetch(`${env.inscriptionsSvcUrl}/teams/${Number(teamId)}/inscriptions`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(Number(process.env.DOWNSTREAM_TIMEOUT_MS || 3000)),
    });
  } catch {
    throw Object.assign(new Error('servicio de inscripciones no disponible'), { statusCode: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`inscriptions respondió ${response.status}`), { statusCode: 503, code: 'DOWNSTREAM_ERROR' });
  }
  const json = await response.json();
  return json?.inscriptions ?? [];
}
