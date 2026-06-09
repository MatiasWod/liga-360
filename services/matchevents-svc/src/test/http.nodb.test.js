/**
 * Pruebas HTTP en proceso que NO tocan la base de datos: health, guards de auth y validación.
 * Usa la app factory (sin listen) y firma tokens con el JWT_SECRET de test ('devsecret').
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';

let server;
let baseUrl;
const organizerToken = jwt.sign({ sub: 1, type: 'organizer' }, 'devsecret');

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

describe('matchevents-svc HTTP (sin DB)', () => {
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

  test('GET /matches/:id/events sin token es público (no 401)', async () => {
    const r = await req('GET', '/matches/m1/events');
    // Puede ser 200 o 500 sin DB, pero nunca exige auth
    assert.notEqual(r.status, 401);
  });

  test('GET /tournaments/:id/stats/scorers sin token es público (no 401)', async () => {
    const r = await req('GET', '/tournaments/t1/stats/scorers');
    assert.notEqual(r.status, 401);
  });

  test('GET /tournaments/:id/events sin inscriptionId → 400', async () => {
    const r = await req('GET', '/tournaments/t1/events');
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });

  test('POST /matches/:id/events sin token → 401 (requiere organizer)', async () => {
    const r = await req('POST', '/matches/m1/events', { event_type: 'goal', tournament_id: 't1', display_name: 'X' });
    assert.equal(r.status, 401);
  });

  test('POST con organizer + sin inscription_id → 400 (atribución obligatoria)', async () => {
    const r = await req(
      'POST',
      '/matches/m1/events',
      { event_type: 'goal', tournament_id: 't1', display_name: 'X' },
      { Authorization: `Bearer ${organizerToken}` }
    );
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /inscription_id/);
  });

  test('POST con organizer + event_type inválido → 400', async () => {
    const r = await req('POST', '/matches/m1/events', { event_type: 'penalty', tournament_id: 't1', display_name: 'X' }, { Authorization: `Bearer ${organizerToken}` });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
  });

  test('POST con organizer + sin tournament_id → 400', async () => {
    const r = await req('POST', '/matches/m1/events', { event_type: 'goal', display_name: 'X' }, { Authorization: `Bearer ${organizerToken}` });
    assert.equal(r.status, 400);
  });

  test('POST con organizer + sin display_name ni linked_member_id → 400', async () => {
    const r = await req('POST', '/matches/m1/events', { event_type: 'goal', tournament_id: 't1' }, { Authorization: `Bearer ${organizerToken}` });
    assert.equal(r.status, 400);
  });
});
