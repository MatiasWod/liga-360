/**
 * Pruebas HTTP en proceso que NO tocan la base de datos: health, guards de admin
 * (verifyToken + requireRole de @liga360/shared) y validación de :id. Usa la app
 * factory (sin listen de index.js, sin bootstrapAdmin).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'testsecret-nodb';

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

function bearer(payload) {
  return { Authorization: `Bearer ${jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })}` };
}

const adminToken = () => bearer({ sub: 1, username: 'admin', type: 'admin', isVerified: true });

describe('auth-svc HTTP (sin DB)', () => {
  before(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    const { createApp } = await import('../app.js');
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

  describe('guards de admin', () => {
    test('GET /users sin token → 401', async () => {
      const r = await req('GET', '/users');
      assert.equal(r.status, 401);
      assert.equal(r.body.code, 'UNAUTHORIZED');
    });

    test('POST /users/1/ban sin token → 401', async () => {
      const r = await req('POST', '/users/1/ban');
      assert.equal(r.status, 401);
      assert.equal(r.body.code, 'UNAUTHORIZED');
    });

    test('DELETE /users/1/ban sin token → 401', async () => {
      const r = await req('DELETE', '/users/1/ban');
      assert.equal(r.status, 401);
      assert.equal(r.body.code, 'UNAUTHORIZED');
    });

    test('POST /users/1/ban con token organizer → 403 FORBIDDEN', async () => {
      const r = await req('POST', '/users/1/ban', null, bearer({ sub: 2, type: 'organizer', isVerified: true }));
      assert.equal(r.status, 403);
      assert.equal(r.body.code, 'FORBIDDEN');
    });

    test('GET /users con token participant → 403 FORBIDDEN', async () => {
      const r = await req('GET', '/users', null, bearer({ sub: 3, type: 'participant', isVerified: true }));
      assert.equal(r.status, 403);
      assert.equal(r.body.code, 'FORBIDDEN');
    });

    test('POST /users/1/ban con token admin no verificado → 403 EMAIL_NOT_VERIFIED', async () => {
      const r = await req('POST', '/users/1/ban', null, bearer({ sub: 1, type: 'admin', isVerified: false }));
      assert.equal(r.status, 403);
      assert.equal(r.body.code, 'EMAIL_NOT_VERIFIED');
    });

    test('POST /users/1/ban con token inválido → 401 INVALID_TOKEN', async () => {
      const r = await req('POST', '/users/1/ban', null, { Authorization: 'Bearer not-a-jwt' });
      assert.equal(r.status, 401);
      assert.equal(r.body.code, 'INVALID_TOKEN');
    });
  });

  describe('validación de :id (corta antes de tocar la DB)', () => {
    test('POST /users/abc/ban con admin → 400 BAD_REQUEST', async () => {
      const r = await req('POST', '/users/abc/ban', null, adminToken());
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'BAD_REQUEST');
    });

    test('DELETE /users/1.5/ban con admin → 400 BAD_REQUEST', async () => {
      const r = await req('DELETE', '/users/1.5/ban', null, adminToken());
      assert.equal(r.status, 400);
      assert.equal(r.body.error.code, 'BAD_REQUEST');
    });
  });
});
