import { logger } from '../logger.js';

/** GET JSON de un servicio downstream. Devuelve null si 404; lanza ante red/error. */
export async function svcGet(baseUrl, path) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } });
  } catch (err) {
    logger.error({ err: err.message, baseUrl, path }, 'downstream service request failed');
    throw Object.assign(new Error('servicio no disponible'), { statusCode: 502, code: 'DOWNSTREAM_UNAVAILABLE' });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw Object.assign(new Error(`${baseUrl} respondió ${response.status}`), { statusCode: 502, code: 'DOWNSTREAM_ERROR' });
  }
  return response.json();
}
