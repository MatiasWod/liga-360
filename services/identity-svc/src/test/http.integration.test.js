/**
 * Integración HTTP de identity-svc. Requiere Postgres Y teams-svc corriendo
 * (claim-by-dni y /profiles/me llaman a teams-svc por HTTP). Deferido al stage de infra.
 * Ejecutar: levantar teams-svc + DB, luego `npm run test:integration`.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

const PORT = 4098;
const JWT_SECRET = 'testsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@127.0.0.1:5432/liga360';
const TEAMS_SVC_URL = process.env.TEAMS_SVC_URL || 'http://localhost:4002';

let server;
let appModule;
let baseUrl;

const token = jwt.sign({ sub: 9002, type: 'participant' }, JWT_SECRET, { expiresIn: '1h' });

function httpReq(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('identity-svc HTTP integration', () => {
  before(async () => {
    process.env.PORT = String(PORT);
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.POSTGRES_URL = POSTGRES_URL;
    process.env.TEAMS_SVC_URL = TEAMS_SVC_URL;
    appModule = await import('../index.js');
    server = appModule.default;
    baseUrl = `http://localhost:${PORT}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  after(async () => {
    if (server && server.close) await new Promise((resolve) => server.close(resolve));
    if (typeof appModule?.closePool === 'function') await appModule.closePool();
  });

  test('GET /health returns ok', async () => {
    const res = await httpReq('GET', '/health');
    assert.equal(res.status, 200);
  });

  test('GET /profiles/me sin perfil → profile null', async () => {
    const res = await httpReq('GET', '/profiles/me', null, { Authorization: `Bearer ${token}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile, null);
  });

  test('POST /profiles/me/claim-by-dni crea perfil', async () => {
    const res = await httpReq('POST', '/profiles/me/claim-by-dni', { dni: '87654321', firstName: 'María', lastName: 'García' }, { Authorization: `Bearer ${token}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.dni, '87654321');
  });

  test('claim-by-dni duplicado por otro usuario → 409', async () => {
    const other = jwt.sign({ sub: 9003, type: 'participant' }, JWT_SECRET, { expiresIn: '1h' });
    const res = await httpReq('POST', '/profiles/me/claim-by-dni', { dni: '87654321', firstName: 'Otro', lastName: 'User' }, { Authorization: `Bearer ${other}` });
    assert.equal(res.status, 409);
  });
});
