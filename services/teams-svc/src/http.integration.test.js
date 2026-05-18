import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

const PORT = 4099;
const JWT_SECRET = 'testsecret';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://liga:liga@localhost:55432/liga360';

let server;
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
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
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

    const { default: appModule } = await import('./index.js');
    server = appModule;
    baseUrl = `http://localhost:${PORT}`;

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  after(async () => {
    if (server && server.close) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('health', () => {
    test('GET /health returns ok', async () => {
      const res = await httpReq('GET', '/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
    });
  });

  describe('auth guards', () => {
    test('GET /teams sin token retorna 401', async () => {
      const res = await httpReq('GET', '/teams');
      assert.equal(res.status, 401);
    });

    test('POST /teams sin token retorna 401', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Test' });
      assert.equal(res.status, 401);
    });

    test('POST /participants sin token funciona (es opcional)', async () => {
      const res = await httpReq('POST', '/participants', {
        firstName: 'Test',
        lastName: 'User',
      });
      // Puede ser 201 o 500 si no hay DB, pero no 401
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
      assert.ok(res.body.team);
      assert.equal(res.body.team.name, 'Equipo Test');
      assert.ok(res.body.accessCode);
      teamId = res.body.team.id;
      accessCode = res.body.accessCode;
    });

    test('GET /teams/:id retorna equipo con miembros', async () => {
      const res = await httpReq('GET', `/teams/${teamId}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.team);
      assert.equal(res.body.team.name, 'Equipo Test');
      assert.ok(Array.isArray(res.body.members));
    });

    test('GET /teams?mine=true retorna equipos del usuario', async () => {
      const res = await httpReq('GET', '/teams?mine=true', null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.teams));
      assert.ok(res.body.teams.length > 0);
    });

    test('PATCH /teams/:id con teamCode actualiza', async () => {
      const res = await httpReq('PATCH', `/teams/${teamId}`, {
        name: 'Equipo Actualizado',
        teamCode: accessCode,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Equipo Actualizado');
    });

    test('PATCH /teams/:id sin auth retorna 403', async () => {
      const res = await httpReq('PATCH', `/teams/${teamId}`, { name: 'Hackeado' });
      assert.equal(res.status, 403);
    });

    test('POST /teams/:id/members agrega participante', async () => {
      // Crear participante primero
      const participantRes = await httpReq('POST', '/participants', {
        firstName: 'Jugador',
        lastName: 'Uno',
        teamId,
        teamCode: accessCode,
      });
      assert.equal(participantRes.status, 201);
      const participantId = participantRes.body.participant.id;

      // Verificar que está en el equipo
      const teamRes = await httpReq('GET', `/teams/${teamId}`);
      assert.equal(teamRes.status, 200);
      const memberIds = teamRes.body.members.map((m) => m.id);
      assert.ok(memberIds.includes(participantId));
    });
  });

  describe('participants', () => {
    test('POST /participants crea participante sin auth', async () => {
      const res = await httpReq('POST', '/participants', {
        firstName: 'Juan',
        lastName: 'Pérez',
        nickname: 'JP',
        dni: '12345678',
      });
      assert.equal(res.status, 201);
      assert.ok(res.body.participant);
      assert.equal(res.body.participant.first_name, 'Juan');
      assert.equal(res.body.participant.last_name, 'Pérez');
    });

    test('POST /participants rechaza sin firstName', async () => {
      const res = await httpReq('POST', '/participants', { lastName: 'Pérez' });
      assert.equal(res.status, 400);
    });

    test('POST /participants rechaza DNI inválido', async () => {
      const res = await httpReq('POST', '/participants', {
        firstName: 'Juan',
        lastName: 'Pérez',
        dni: '123',
      });
      assert.equal(res.status, 400);
    });
  });

  describe('profiles', () => {
    const userToken = makeToken({ sub: 9002, type: 'participant' });

    test('GET /profiles/me sin perfil retorna null', async () => {
      const res = await httpReq('GET', '/profiles/me', null, authHeader(userToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.profile, null);
    });

    test('POST /profiles/me/claim-by-dni crea perfil', async () => {
      const res = await httpReq('POST', '/profiles/me/claim-by-dni', {
        dni: '87654321',
        firstName: 'María',
        lastName: 'García',
      }, authHeader(userToken));
      assert.equal(res.status, 200);
      assert.ok(res.body.profile);
      assert.equal(res.body.profile.dni, '87654321');
    });

    test('POST /profiles/me/claim-by-dni duplicado retorna 409', async () => {
      const otherToken = makeToken({ sub: 9003, type: 'participant' });
      const res = await httpReq('POST', '/profiles/me/claim-by-dni', {
        dni: '87654321',
        firstName: 'Otro',
        lastName: 'User',
      }, authHeader(otherToken));
      assert.equal(res.status, 409);
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
      assert.ok(inviteCode);
      assert.ok(/^[A-Z]{3}-\d{3}$/.test(inviteCode));
    });

    test('GET /teams/me/invite-code retorna invite code', async () => {
      const res = await httpReq('GET', '/teams/me/invite-code', null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.teamId, teamId);
      assert.ok(res.body.inviteCode);
    });

    test('GET /teams/resolve-by-invite-code/:code resuelve equipo', async () => {
      const res = await httpReq('GET', `/teams/resolve-by-invite-code/${inviteCode}`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.team.id, teamId);
    });

    test('GET /teams/resolve-by-invite-code con código inválido retorna 404', async () => {
      const res = await httpReq('GET', '/teams/resolve-by-invite-code/XXX-999', null, authHeader(ownerToken));
      assert.equal(res.status, 404);
    });
  });

  describe('access code rotation', () => {
    const ownerToken = makeToken({ sub: 9020, type: 'team' });
    let teamId;
    let firstCode;

    test('POST /teams crea equipo', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Rotación' }, authHeader(ownerToken));
      assert.equal(res.status, 201);
      teamId = res.body.team.id;
      firstCode = res.body.accessCode;
    });

    test('POST /teams/:id/access-code/rotate rota código', async () => {
      const res = await httpReq('POST', `/teams/${teamId}/access-code/rotate`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.ok(res.body.accessCode);
      assert.notEqual(res.body.accessCode, firstCode);
    });

    test('rotate sin owner token retorna 403', async () => {
      const nonOwnerToken = makeToken({ sub: 9999, type: 'team' });
      const res = await httpReq('POST', `/teams/${teamId}/access-code/rotate`, null, authHeader(nonOwnerToken));
      assert.equal(res.status, 403);
    });
  });
});
