import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

/**
 * Token de servicio (firmado con el JWT_SECRET compartido) para autenticar llamadas
 * service-to-service ante endpoints internos (p. ej. teams-svc `GET /profiles`). No representa
 * a un usuario final: `type: 'service'`. Se firma fresco por request (barato, evita expiración).
 */
const serviceToken = () => jwt.sign({ type: 'service', iss: 'inscriptions-svc' }, env.jwtSecret, { expiresIn: '60s' });

function serviceAuthHeader() {
  return { Authorization: `Bearer ${serviceToken()}` };
}

/**
 * Cliente HTTP resiliente hacia servicios downstream:
 *  - timeout por intento (AbortSignal.timeout) para no colgarse ante un peer lento;
 *  - reintentos con backoff exponencial + jitter para operaciones idempotentes (GET);
 *  - errores de red/timeout/5xx se traducen a 502 estructurado.
 * La degradación elegante (seguir sin el dato del peer) se decide en la capa de servicio.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.DOWNSTREAM_TIMEOUT_MS || 3000);
const DEFAULT_RETRIES = Number(process.env.DOWNSTREAM_RETRIES || 2);
const BASE_BACKOFF_MS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Backoff exponencial con jitter: ~100ms, ~200ms, ~400ms… */
function backoffDelay(attempt) {
  return BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * BASE_BACKOFF_MS);
}

/**
 * fetch con timeout y reintentos idempotentes: reintenta ante error de red, timeout
 * (AbortError) o 5xx; nunca ante 4xx (incl. 404). Devuelve la Response final.
 */
async function resilientFetch(url, options = {}, { retries = 0, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status >= 500 && attempt < retries) {
        lastErr = new Error(`upstream ${response.status}`);
        await sleep(backoffDelay(attempt));
        continue;
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** GET JSON idempotente (timeout + reintentos). Devuelve null si 404; lanza 502 ante red/5xx. */
export async function svcGet(baseUrl, path) {
  let response;
  try {
    response = await resilientFetch(
      `${baseUrl}${path}`,
      { headers: { Accept: 'application/json', ...serviceAuthHeader() } },
      { retries: DEFAULT_RETRIES }
    );
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
