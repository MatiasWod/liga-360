/**
 * Pruebas HTTP en proceso que NO tocan la base de datos: health y guards de auth
 * (todas las rutas /profiles requieren token, así que devuelven 401 antes de la DB).
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

describe('identity-svc HTTP (sin DB)', () => {
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

  test('GET /profiles/me sin token → 401 estructurado', async () => {
    const r = await req('GET', '/profiles/me');
    assert.equal(r.status, 401);
    assert.equal(r.body.error.code, 'UNAUTHORIZED');
  });

  test('POST /profiles/me/claim-by-dni sin token → 401', async () => {
    const r = await req('POST', '/profiles/me/claim-by-dni', { dni: '12345678' });
    assert.equal(r.status, 401);
  });

  test('DELETE /profiles/me/participants/:id/unlink sin token → 401', async () => {
    const r = await req('DELETE', '/profiles/me/participants/1/unlink');
    assert.equal(r.status, 401);
  });

  test('GET /teams/profiles/me (alias nginx) sin token → 401 (no 404)', async () => {
    const r = await req('GET', '/teams/profiles/me');
    assert.equal(r.status, 401);
  });
});
