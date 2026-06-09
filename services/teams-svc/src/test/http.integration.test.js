/**
 * Integración HTTP de teams-svc (requiere Postgres). Incluye /profiles (Person_Profile absorbido).
 * Ejecutar con la DB levantada: `npm run test:integration`.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

const PORT = 4099;
const JWT_SECRET = 'testsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://liga:liga@127.0.0.1:5432/liga360_teams';

let server;
let appModule;
let baseUrl;

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

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

describe('teams-svc HTTP integration', () => {
  before(async () => {
    process.env.PORT = String(PORT);
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.POSTGRES_URL = POSTGRES_URL;
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
    assert.equal(res.body.status, 'ok');
  });

  describe('auth guards', () => {
    test('GET /teams sin token → 401', async () => {
      assert.equal((await httpReq('GET', '/teams')).status, 401);
    });
    test('POST /teams sin token → 401', async () => {
      assert.equal((await httpReq('POST', '/teams', { name: 'Test' })).status, 401);
    });
    test('POST /participants sin token funciona (opcional)', async () => {
      const res = await httpReq('POST', '/participants', { firstName: 'Test', lastName: 'User' });
      assert.notEqual(res.status, 401);
    });
  });

  describe('teams CRUD', () => {
    let teamId;
    let accessCode;
    const ownerToken = makeToken({ sub: 9001, type: 'team' });

    test('POST /teams crea un equipo', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Test' }, authHeader(ownerToken));
      assert.equal(res.status, 201);
      assert.equal(res.body.team.name, 'Equipo Test');
      assert.ok(res.body.accessCode);
      teamId = res.body.team.id;
      accessCode = res.body.accessCode;
    });

    test('GET /teams/:id retorna equipo con miembros', async () => {
      const res = await httpReq('GET', `/teams/${teamId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Equipo Test');
      assert.ok(Array.isArray(res.body.members));
    });

    test('GET /teams?mine=true retorna equipos del usuario', async () => {
      const res = await httpReq('GET', '/teams?mine=true', null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.ok(res.body.teams.length > 0);
    });

    test('PATCH /teams/:id con teamCode actualiza', async () => {
      const res = await httpReq('PATCH', `/teams/${teamId}`, { name: 'Equipo Actualizado', teamCode: accessCode });
      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Equipo Actualizado');
    });

    test('PATCH /teams/:id sin auth → 403', async () => {
      assert.equal((await httpReq('PATCH', `/teams/${teamId}`, { name: 'Hackeado' })).status, 403);
    });

    test('POST /teams/:id/members agrega participante', async () => {
      const p = await httpReq('POST', '/participants', { firstName: 'Jugador', lastName: 'Uno', teamId, teamCode: accessCode });
      assert.equal(p.status, 201);
      const teamRes = await httpReq('GET', `/teams/${teamId}`);
      assert.ok(teamRes.body.members.map((m) => m.id).includes(p.body.participant.id));
    });
  });

  describe('participants', () => {
    test('POST /participants crea participante sin auth', async () => {
      const res = await httpReq('POST', '/participants', { firstName: 'Juan', lastName: 'Pérez', nickname: 'JP', dni: '12345678' });
      assert.equal(res.status, 201);
      assert.equal(res.body.participant.first_name, 'Juan');
    });
    test('POST /teams/participants alias nginx legacy', async () => {
      const res = await httpReq('POST', '/teams/participants', { firstName: 'Ana', lastName: 'López' });
      assert.equal(res.status, 201);
      assert.equal(res.body.participant.first_name, 'Ana');
    });
    test('POST /participants rechaza sin firstName', async () => {
      assert.equal((await httpReq('POST', '/participants', { lastName: 'Pérez' })).status, 400);
    });
    test('POST /participants rechaza DNI inválido', async () => {
      assert.equal((await httpReq('POST', '/participants', { firstName: 'Juan', lastName: 'Pérez', dni: '123' })).status, 400);
    });
  });

  describe('invite codes', () => {
    const ownerToken = makeToken({ sub: 9010, type: 'team' });
    let teamId;
    let inviteCode;

    test('POST /teams crea equipo con invite code', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Invite' }, authHeader(ownerToken));
      assert.equal(res.status, 201);
      teamId = res.body.team.id;
      inviteCode = res.body.team.invite_code;
      assert.ok(/^[A-Z]{3}-\d{3}$/.test(inviteCode));
    });
    test('GET /teams/me/invite-code retorna invite code', async () => {
      const res = await httpReq('GET', '/teams/me/invite-code', null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.teamId, teamId);
    });
    test('GET /teams?inviteCode= resuelve equipo', async () => {
      const res = await httpReq('GET', `/teams?inviteCode=${encodeURIComponent(inviteCode)}`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.team.id, teamId);
    });
    test('GET /teams?inviteCode= inválido → 404', async () => {
      assert.equal((await httpReq('GET', '/teams?inviteCode=XXX-999', null, authHeader(ownerToken))).status, 404);
    });
  });

  describe('access code rotation', () => {
    const ownerToken = makeToken({ sub: 9020, type: 'team' });
    let teamId;
    let firstCode;

    test('POST /teams crea equipo', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Rotación' }, authHeader(ownerToken));
      teamId = res.body.team.id;
      firstCode = res.body.accessCode;
    });
    test('POST /teams/:id/access-code/rotate rota código', async () => {
      const res = await httpReq('POST', `/teams/${teamId}/access-code/rotate`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.notEqual(res.body.accessCode, firstCode);
    });
    test('rotate sin owner token → 403', async () => {
      const nonOwner = makeToken({ sub: 9999, type: 'team' });
      assert.equal((await httpReq('POST', `/teams/${teamId}/access-code/rotate`, null, authHeader(nonOwner))).status, 403);
    });
  });
});
