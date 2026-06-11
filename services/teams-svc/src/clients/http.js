import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

const serviceToken = () => jwt.sign({ type: 'service', iss: 'teams-svc' }, env.jwtSecret, { expiresIn: '60s' });

function serviceAuthHeader() {
  return { Authorization: `Bearer ${serviceToken()}` };
}

const DEFAULT_TIMEOUT_MS = Number(process.env.DOWNSTREAM_TIMEOUT_MS || 3000);

export async function svcGet(baseUrl, path) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json', ...serviceAuthHeader() },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ err: err.message, baseUrl, path }, 'downstream GET failed');
    throw Object.assign(new Error('servicio no disponible'), { statusCode: 502, code: 'DOWNSTREAM_UNAVAILABLE' });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw Object.assign(new Error(`${baseUrl} respondió ${response.status}`), { statusCode: 502, code: 'DOWNSTREAM_ERROR' });
  }
  return response.json();
}

export async function svcPatch(baseUrl, path, body) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...serviceAuthHeader() },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ err: err.message, baseUrl, path }, 'downstream PATCH failed');
    throw Object.assign(new Error('servicio no disponible'), { statusCode: 502, code: 'DOWNSTREAM_UNAVAILABLE' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`${baseUrl} respondió ${response.status}`), { statusCode: 502, code: 'DOWNSTREAM_ERROR' });
  }
  return response.json();
}
