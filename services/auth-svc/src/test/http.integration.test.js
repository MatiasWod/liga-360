/**
 * Integración HTTP de auth-svc (requiere Postgres con migraciones de liga360_auth aplicadas).
 * Cubre bootstrap del admin, login de baneados y ban/unban (LIGA-170).
 * Ejecutar con la DB levantada: `npm run test:integration`.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const PORT = 4097;
const JWT_SECRET = 'testsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://liga:liga@127.0.0.1:55432/liga360_auth';

// Sufijo único para no chocar con datos previos si un run anterior no limpió.
const RUN = Date.now();
const ADMIN_USERNAME = `it_admin_${RUN}`;
const ADMIN_PASSWORD = 'AdminTest123!';
const USER_USERNAME = `it_user_${RUN}`;
const USER_PASSWORD = 'UserTest123!';

let server;
let userRepository;
let baseUrl;
let adminToken;
let userId;

function httpReq(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

describe('auth-svc HTTP integration', () => {
  before(async () => {
    process.env.PORT = String(PORT);
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.POSTGRES_URL = POSTGRES_URL;
    process.env.ADMIN_USERNAME = ADMIN_USERNAME;
    process.env.ADMIN_EMAIL = `${ADMIN_USERNAME}@test.liga360.com.ar`;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;

    // index.js corre bootstrapAdmin() antes de escuchar.
    const appModule = await import('../index.js');
    server = appModule.default;
    userRepository = await import('../repositories/user.repository.js');
    baseUrl = `http://localhost:${PORT}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  after(async () => {
    // Limpieza: borra el admin bootstrapeado y el usuario registrado por el test.
    for (const username of [ADMIN_USERNAME, USER_USERNAME]) {
      const u = await userRepository.findByUsername(username);
      if (u) await userRepository.deleteById(u.id);
    }
    if (server && server.close) await new Promise((resolve) => server.close(resolve));
    await userRepository.closePool();
  });

  test('GET /health returns ok', async () => {
    const res = await httpReq('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('bootstrap: el admin de env puede loguearse sin registro', async () => {
    const res = await httpReq('POST', '/login', { username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.type, 'admin');
    assert.equal(res.body.user.isVerified, true);
    assert.ok(res.body.token);
    adminToken = res.body.token;
  });

  test('setup: registra un usuario común (organizer)', async () => {
    const res = await httpReq('POST', '/register', {
      mode: 'organizer',
      username: USER_USERNAME,
      email: `${USER_USERNAME}@test.liga360.com.ar`,
      password: USER_PASSWORD,
      name: 'Usuario Integración',
    });
    assert.equal(res.status, 201);
    userId = res.body.user.id;
    assert.ok(Number.isInteger(userId));
  });

  test('GET /users con admin lista usuarios sin exponer passwords', async () => {
    const res = await httpReq('GET', '/users', null, authHeader(adminToken));
    assert.equal(res.status, 200);
    const target = res.body.users.find((u) => u.id === userId);
    assert.ok(target, 'el usuario registrado aparece en el listado');
    assert.equal(target.bannedAt, null);
    assert.ok(!('password' in target));
  });

  test('GET /users?limit=1 respeta el límite y offset pagina', async () => {
    const page1 = await httpReq('GET', '/users?limit=1&offset=0', null, authHeader(adminToken));
    assert.equal(page1.status, 200);
    assert.equal(page1.body.users.length, 1);
    const page2 = await httpReq('GET', '/users?limit=1&offset=1', null, authHeader(adminToken));
    assert.equal(page2.status, 200);
    assert.equal(page2.body.users.length, 1);
    assert.notEqual(page1.body.users[0].id, page2.body.users[0].id);
  });

  test('GET /users con limit/offset inválidos clampea (no 400)', async () => {
    const res = await httpReq('GET', '/users?limit=-5&offset=abc', null, authHeader(adminToken));
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
  });

  test('POST /users/:id/ban banea y bloquea el login con 403 BANNED', async () => {
    const res = await httpReq('POST', `/users/${userId}/ban`, null, authHeader(adminToken));
    assert.equal(res.status, 200);
    assert.ok(res.body.user.bannedAt, 'bannedAt queda seteado');

    const login = await httpReq('POST', '/login', { username: USER_USERNAME, password: USER_PASSWORD });
    assert.equal(login.status, 403);
    assert.equal(login.body.error.code, 'BANNED');
  });

  test('re-banear es idempotente y preserva el bannedAt original', async () => {
    const first = await httpReq('POST', `/users/${userId}/ban`, null, authHeader(adminToken));
    const second = await httpReq('POST', `/users/${userId}/ban`, null, authHeader(adminToken));
    assert.equal(second.status, 200);
    assert.equal(second.body.user.bannedAt, first.body.user.bannedAt);
  });

  test('login con password incorrecta de un baneado → 401 (no revela el baneo)', async () => {
    const res = await httpReq('POST', '/login', { username: USER_USERNAME, password: 'incorrecta123' });
    assert.equal(res.status, 401);
  });

  test('DELETE /users/:id/ban desbanea y el login vuelve a funcionar', async () => {
    const res = await httpReq('DELETE', `/users/${userId}/ban`, null, authHeader(adminToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.bannedAt, null);

    const login = await httpReq('POST', '/login', { username: USER_USERNAME, password: USER_PASSWORD });
    assert.equal(login.status, 200);
  });

  test('desbanear a un no baneado es idempotente (200, bannedAt null)', async () => {
    const res = await httpReq('DELETE', `/users/${userId}/ban`, null, authHeader(adminToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.bannedAt, null);
  });

  test('banear a un admin → 403 FORBIDDEN', async () => {
    const admin = await userRepository.findByUsername(ADMIN_USERNAME);
    const res = await httpReq('POST', `/users/${admin.id}/ban`, null, authHeader(adminToken));
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  test('banear un id inexistente → 404 NOT_FOUND', async () => {
    const res = await httpReq('POST', '/users/999999999/ban', null, authHeader(adminToken));
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
