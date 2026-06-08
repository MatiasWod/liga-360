/** Cliente HTTP hacia identity-svc (dueño de Person_Profile). */
import { env } from '../config/env.js';
import { logger } from '../logger.js';

const BASE_URL = env.identitySvcUrl;

async function getJson(path) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  } catch (err) {
    logger.error({ err: err.message, path }, 'identity-svc request failed');
    throw Object.assign(new Error('identity service unavailable'), { statusCode: 502, code: 'IDENTITY_SVC_ERROR' });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw Object.assign(new Error(`identity-svc responded ${response.status}`), { statusCode: 502, code: 'IDENTITY_SVC_ERROR' });
  }
  return response.json();
}

/** Devuelve el person_profile id que tiene ese DNI, o null. */
export async function getProfileIdByDni(dni) {
  if (!dni) return null;
  const body = await getJson(`/profiles?dni=${encodeURIComponent(dni)}`);
  return body?.profile?.id ?? null;
}

/** Devuelve el person_profile id del usuario, o null. */
export async function getProfileIdByUser(userId) {
  if (!userId) return null;
  const body = await getJson(`/profiles?userId=${encodeURIComponent(userId)}`);
  return body?.profile?.id ?? null;
}
