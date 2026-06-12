import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

const serviceToken = () => jwt.sign({ type: 'service', iss: 'tournaments-svc' }, env.jwtSecret, { expiresIn: '60s' });

function serviceAuthHeader() {
  return { Authorization: `Bearer ${serviceToken()}` };
}

const DEFAULT_TIMEOUT_MS = Number(process.env.DOWNSTREAM_TIMEOUT_MS || 3000);
const DEFAULT_RETRIES = Number(process.env.DOWNSTREAM_RETRIES || 2);
const BASE_BACKOFF_MS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt) {
  return BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * BASE_BACKOFF_MS);
}

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
    throw Object.assign(new Error('servicio downstream no disponible'), { statusCode: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  }
  if (response.status === 404) return null;
  if (!response.ok) {
    throw Object.assign(new Error(`${baseUrl} respondió ${response.status}`), { statusCode: 503, code: 'DOWNSTREAM_ERROR' });
  }
  return response.json();
}

export async function userFetch(baseUrl, path, { method = 'GET', body, authHeader } = {}) {
  const headers = { Accept: 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) };
  if (body != null) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await resilientFetch(
      `${baseUrl}${path}`,
      {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      },
      { retries: 0 }
    );
  } catch (err) {
    logger.warn({ err: err.message, baseUrl, path, method }, 'downstream user request failed');
    throw Object.assign(new Error('servicio downstream no disponible'), { statusCode: 503, code: 'DOWNSTREAM_UNAVAILABLE' });
  }
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!response.ok) {
    const message = json?.error?.message || `${baseUrl} respondió ${response.status}`;
    throw Object.assign(new Error(message), { statusCode: response.status, code: json?.error?.code || 'DOWNSTREAM_ERROR', body: json });
  }
  return json;
}

export async function userPost(baseUrl, path, body, authHeader) {
  return userFetch(baseUrl, path, { method: 'POST', body, authHeader });
}

export async function userPatch(baseUrl, path, body, authHeader) {
  return userFetch(baseUrl, path, { method: 'PATCH', body, authHeader });
}

export async function svcPost(baseUrl, path, body) {
  let response;
  try {
    response = await resilientFetch(
      `${baseUrl}${path}`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...serviceAuthHeader() },
        body: JSON.stringify(body ?? {}),
      },
      { retries: 0 }
    );
  } catch (err) {
    logger.warn({ err: err.message, baseUrl, path }, 'downstream POST failed');
    return null;
  }
  if (!response.ok) {
    logger.warn({ status: response.status, baseUrl, path }, 'downstream POST non-ok');
    return null;
  }
  return response.json();
}
