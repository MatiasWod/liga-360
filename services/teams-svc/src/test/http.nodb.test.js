/**
 * Pruebas HTTP en proceso que NO tocan la base de datos: health, guards de auth, validación
 * y forma de error estructurada. Usa la app factory (sin listen de index.js).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';

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

describe('teams-svc HTTP (sin DB)', () => {
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

  test('GET /teams sin token → 401 con error estructurado', async () => {
    const r = await req('GET', '/teams');
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'UNAUTHORIZED');
  });

  test('POST /teams sin token → 401', async () => {
    const r = await req('POST', '/teams', { name: 'X' });
    assert.equal(r.status, 401);
  });

  test('POST /participants sin firstName → 400 VALIDATION_ERROR', async () => {
    const r = await req('POST', '/participants', { lastName: 'Pérez' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });

  test('POST /participants con DNI inválido → 400', async () => {
    const r = await req('POST', '/participants', { firstName: 'Juan', lastName: 'Pérez', dni: '123' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });

  test('POST /teams/participants (alias nginx) sin firstName → 400 (no 404)', async () => {
    const r = await req('POST', '/teams/participants', { lastName: 'X' });
    assert.equal(r.status, 400);
  });
});
