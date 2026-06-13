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
const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://liga:liga@127.0.0.1:55432/liga360_teams';

let server;
let appModule;
let baseUrl;
let dbReady = false;

// Salta el test si no hay Postgres (degradación limpia, igual que las otras integraciones).
function itDb(name, fn) {
  test(name, async (t) => {
    if (!dbReady) return t.skip('DB no disponible');
    return fn(t);
  });
}

// Ids de usuario únicos por corrida: la DB de test no se limpia entre runs y getMyInviteCode
// resuelve "el primer equipo del usuario", así que subs fijos harían fallar en la 2da corrida.
// owner_user_id es INTEGER (máx ~2.1e9): se usa el módulo para no desbordar (Date.now() no entra).
const RUN = Date.now() % 100000000;

// verifyToken (de @liga360/shared) exige isVerified; los tokens reales lo traen tras la
// verificación de email. Default isVerified:true (un test puede overridearlo con ...payload).
function makeToken(payload) {
  return jwt.sign({ isVerified: true, ...payload }, JWT_SECRET, { expiresIn: '1h' });
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
    // Mismo pool singleton que usa la app (import dinámico tras fijar env, por el freeze de env.js).
    const { pool } = await import('../config/db.js');
    try {
      await pool.query('SELECT 1');
      dbReady = true;
    } catch {
      dbReady = false;
    }
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
    itDb('GET /teams sin token → 401', async () => {
      assert.equal((await httpReq('GET', '/teams')).status, 401);
    });
    itDb('POST /teams sin token → 401', async () => {
      assert.equal((await httpReq('POST', '/teams', { name: 'Test' })).status, 401);
    });
    itDb('POST /participants sin token → 401 (requiere team/participant verificado)', async () => {
      const res = await httpReq('POST', '/participants', { firstName: 'Test', lastName: 'User' });
      assert.equal(res.status, 401);
    });
  });

  describe('teams CRUD', () => {
    let teamId;
    let accessCode;
    const ownerToken = makeToken({ sub: RUN + 1, type: 'team' });

    itDb('POST /teams crea un equipo', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Test' }, authHeader(ownerToken));
      assert.equal(res.status, 201);
      assert.equal(res.body.team.name, 'Equipo Test');
      assert.ok(res.body.accessCode);
      teamId = res.body.team.id;
      accessCode = res.body.accessCode;
    });

    itDb('GET /teams/:id retorna equipo con miembros (logueado)', async () => {
      const res = await httpReq('GET', `/teams/${teamId}`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Equipo Test');
      assert.ok(Array.isArray(res.body.members));
    });

    itDb('GET /teams/:id sin token → 200 (lectura pública: alimenta la vista pública de equipo)', async () => {
      const res = await httpReq('GET', `/teams/${teamId}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.team.id, teamId);
    });

    itDb('GET /teams?mine=true retorna equipos del usuario', async () => {
      const res = await httpReq('GET', '/teams?mine=true', null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.ok(res.body.teams.length > 0);
    });

    itDb('PATCH /teams/:id con teamCode actualiza (no-owner verificado + teamCode)', async () => {
      // Token verificado de otro usuario team: la autorización viene del teamCode, no del owner.
      const nonOwner = makeToken({ sub: RUN + 2, type: 'team' });
      const res = await httpReq('PATCH', `/teams/${teamId}`, { name: 'Equipo Actualizado', teamCode: accessCode }, authHeader(nonOwner));
      assert.equal(res.status, 200);
      assert.equal(res.body.team.name, 'Equipo Actualizado');
    });

    itDb('PATCH /teams/:id sin token → 401', async () => {
      assert.equal((await httpReq('PATCH', `/teams/${teamId}`, { name: 'Hackeado' })).status, 401);
    });

    itDb('PATCH /teams/:id con token verificado pero sin owner ni teamCode → 403', async () => {
      const stranger = makeToken({ sub: RUN + 3, type: 'team' });
      assert.equal((await httpReq('PATCH', `/teams/${teamId}`, { name: 'Hackeado' }, authHeader(stranger))).status, 403);
    });

    itDb('POST /teams/:id/members agrega participante', async () => {
      const p = await httpReq('POST', '/participants', { firstName: 'Jugador', lastName: 'Uno', teamId, teamCode: accessCode }, authHeader(ownerToken));
      assert.equal(p.status, 201);
      const teamRes = await httpReq('GET', `/teams/${teamId}`, null, authHeader(ownerToken));
      assert.ok(teamRes.body.members.map((m) => m.id).includes(p.body.participant.id));
    });
  });

  describe('participants', () => {
    // Crear participante standalone (sin teamId) requiere un token verificado team/participant.
    const creatorToken = makeToken({ sub: RUN + 5, type: 'participant' });

    itDb('POST /participants crea participante (token verificado)', async () => {
      const res = await httpReq('POST', '/participants', { firstName: 'Juan', lastName: 'Pérez', nickname: 'JP', dni: '12345678' }, authHeader(creatorToken));
      assert.equal(res.status, 201);
      assert.equal(res.body.participant.first_name, 'Juan');
    });
    itDb('POST /teams/participants alias nginx legacy', async () => {
      const res = await httpReq('POST', '/teams/participants', { firstName: 'Ana', lastName: 'López' }, authHeader(creatorToken));
      assert.equal(res.status, 201);
      assert.equal(res.body.participant.first_name, 'Ana');
    });
    itDb('POST /participants rechaza sin firstName', async () => {
      assert.equal((await httpReq('POST', '/participants', { lastName: 'Pérez' }, authHeader(creatorToken))).status, 400);
    });
    itDb('POST /participants rechaza DNI inválido', async () => {
      assert.equal((await httpReq('POST', '/participants', { firstName: 'Juan', lastName: 'Pérez', dni: '123' }, authHeader(creatorToken))).status, 400);
    });
  });

  describe('invite codes', () => {
    const ownerToken = makeToken({ sub: RUN + 10, type: 'team' });
    let teamId;
    let inviteCode;

    itDb('POST /teams crea equipo con invite code', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Invite' }, authHeader(ownerToken));
      assert.equal(res.status, 201);
      teamId = res.body.team.id;
      inviteCode = res.body.team.invite_code;
      assert.ok(/^[A-Z]{3}-\d{3}$/.test(inviteCode));
    });
    itDb('GET /teams/me/invite-code retorna invite code', async () => {
      const res = await httpReq('GET', '/teams/me/invite-code', null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.teamId, teamId);
    });
    itDb('GET /teams?inviteCode= resuelve equipo', async () => {
      const res = await httpReq('GET', `/teams?inviteCode=${encodeURIComponent(inviteCode)}`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.team.id, teamId);
    });
    itDb('GET /teams?inviteCode= inválido → 404', async () => {
      assert.equal((await httpReq('GET', '/teams?inviteCode=XXX-999', null, authHeader(ownerToken))).status, 404);
    });
  });

  describe('access code rotation', () => {
    const ownerToken = makeToken({ sub: RUN + 20, type: 'team' });
    let teamId;
    let firstCode;

    itDb('POST /teams crea equipo', async () => {
      const res = await httpReq('POST', '/teams', { name: 'Equipo Rotación' }, authHeader(ownerToken));
      teamId = res.body.team.id;
      firstCode = res.body.accessCode;
    });
    itDb('POST /teams/:id/access-code/rotate rota código', async () => {
      const res = await httpReq('POST', `/teams/${teamId}/access-code/rotate`, null, authHeader(ownerToken));
      assert.equal(res.status, 200);
      assert.notEqual(res.body.accessCode, firstCode);
    });
    itDb('rotate sin owner token → 403', async () => {
      const nonOwner = makeToken({ sub: RUN + 99, type: 'team' });
      assert.equal((await httpReq('POST', `/teams/${teamId}/access-code/rotate`, null, authHeader(nonOwner))).status, 403);
    });
  });
});
