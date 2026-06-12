/**
 * Pruebas HTTP en proceso que NO tocan la base de datos: health, guards de auth y validación.
 * Usa la app factory (sin listen de index.js).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
let server;
let baseUrl;

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const r = http.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
      }
    );
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function token(type) {
  return jwt.sign({ sub: 1, username: 'u', type, isVerified: true }, JWT_SECRET, { expiresIn: '1h' });
}

describe('inscriptions-svc HTTP (sin DB)', () => {
  before(async () => {
    const app = createApp();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /health → 200 ok', async () => {
    const r = await req('GET', '/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });

  test('GET /invites sin token → 401 estructurado', async () => {
    const r = await req('GET', '/invites?tournamentId=t1');
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'UNAUTHORIZED');
  });

  test('GET /invites con token no-organizer → 403', async () => {
    const r = await req('GET', '/invites?tournamentId=t1', null, { Authorization: `Bearer ${token('team')}` });
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'FORBIDDEN');
  });

  test('POST /inscriptions sin tournamentId/displayName → 400 VALIDATION_ERROR', async () => {
    const r = await req('POST', '/inscriptions', { source: 'public' }, { Authorization: `Bearer ${token('team')}` });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });
});
