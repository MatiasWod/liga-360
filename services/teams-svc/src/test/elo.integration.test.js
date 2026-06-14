/**
 * Integración ELO con Postgres + mock de inscriptions-svc (lookup / tournament-rating).
 * Requiere DB teams: `npm run test:integration` (o solo este archivo).
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'testsecret-elo';
const POSTGRES_URL =
  process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://liga:liga@127.0.0.1:55432/liga360_teams';

let mockInscriptions = [];
let mockServer;
let server;
let baseUrl;
let dbReady = false;
let teamHomeId;
let teamAwayId;
let pool;
let closePool;

const HOME_INSC_ID = 880001;
const AWAY_INSC_ID = 880002;
const MATCH_ID = 'elo-integration-match-1';

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

function startMockInscriptions() {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/inscriptions' && url.searchParams.has('ids')) {
        const ids = new Set(
          String(url.searchParams.get('ids') || '')
            .split(',')
            .map((id) => Number(id.trim()))
        );
        const rows = mockInscriptions.filter((row) => ids.has(Number(row.id)));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ inscriptions: rows }));
        return;
      }
      if (req.method === 'PATCH' && /^\/inscriptions\/\d+\/tournament-rating$/.test(url.pathname)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
    mockServer.listen(0, '127.0.0.1', () => resolve(mockServer.address().port));
  });
}

function serviceToken() {
  return jwt.sign({ type: 'service', iss: 'elo-integration-test' }, JWT_SECRET, { expiresIn: '1h' });
}

describe('ELO process-match (integración)', () => {
  before(async () => {
    // env.js congela los valores en el primer import: TODO process.env relevante
    // tiene que estar seteado antes de importar config/db.js o app.js.
    const mockPort = await startMockInscriptions();
    process.env.POSTGRES_URL = POSTGRES_URL;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.INSCRIPTIONS_SVC_URL = `http://127.0.0.1:${mockPort}`;

    try {
      ({ pool, closePool } = await import('../config/db.js'));
      await pool.query('SELECT 1');
      dbReady = true;
    } catch {
      dbReady = false;
      return;
    }

    const { createApp } = await import('../app.js');
    const app = createApp();
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const ownerToken = jwt.sign({ sub: 88001, type: 'team', isVerified: true }, JWT_SECRET, { expiresIn: '1h' });
    const homeRes = await httpReq('POST', '/teams', { name: 'ELO Home FC' }, authHeader(ownerToken));
    assert.equal(homeRes.status, 201);
    teamHomeId = homeRes.body.team.id;

    const awayOwner = jwt.sign({ sub: 88002, type: 'team', isVerified: true }, JWT_SECRET, { expiresIn: '1h' });
    const awayRes = await httpReq('POST', '/teams', { name: 'ELO Away FC' }, authHeader(awayOwner));
    assert.equal(awayRes.status, 201);
    teamAwayId = awayRes.body.team.id;

    mockInscriptions = [
      { id: HOME_INSC_ID, competitor_kind: 'team', linked_team_id: teamHomeId, tournament_rating: null },
      { id: AWAY_INSC_ID, competitor_kind: 'team', linked_team_id: teamAwayId, tournament_rating: null },
    ];

    await pool.query(`UPDATE "Team" SET elo = 1200 WHERE id IN ($1, $2)`, [teamHomeId, teamAwayId]);
    await pool.query(`DELETE FROM elo_match_event WHERE match_id = $1`, [MATCH_ID]);
  });

  after(async () => {
    if (dbReady && pool) {
      await pool.query(`DELETE FROM elo_match_event WHERE match_id = $1`, [MATCH_ID]);
    }
    if (server?.close) await new Promise((resolve) => server.close(resolve));
    if (mockServer?.close) await new Promise((resolve) => mockServer.close(resolve));
    if (dbReady && typeof closePool === 'function') await closePool();
  });

  test('torneo no publicado → skipped', async (t) => {
    if (!dbReady) return t.skip('DB no disponible');

    const res = await httpReq(
      'PUT',
      '/matches/elo-skip-draft/elo',
      {
        tournamentId: 't-draft',
        tournamentStatus: 'draft',
        homeInscriptionId: String(HOME_INSC_ID),
        awayInscriptionId: String(AWAY_INSC_ID),
        homeScore: 1,
        awayScore: 0,
      },
      authHeader(serviceToken())
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.skipped, true);
    assert.equal(res.body.reason, 'tournament_not_published');
  });

  test('process-match idempotente: re-procesar mismo partido no duplica ELO', async (t) => {
    if (!dbReady) return t.skip('DB no disponible');

    const payload = {
      tournamentId: 't-elo-integration',
      tournamentStatus: 'published',
      homeInscriptionId: String(HOME_INSC_ID),
      awayInscriptionId: String(AWAY_INSC_ID),
      homeScore: 2,
      awayScore: 1,
    };

    const first = await httpReq('PUT', `/matches/${MATCH_ID}/elo`, payload, authHeader(serviceToken()));
    assert.equal(first.status, 200);
    assert.equal(first.body.processed, true);

    const afterFirst = await pool.query(`SELECT elo FROM "Team" WHERE id = $1`, [teamHomeId]);
    const homeElo = Number(afterFirst.rows[0].elo);
    assert.ok(homeElo > 1200, `home elo esperado > 1200, obtuvo ${homeElo}`);

    const second = await httpReq('PUT', `/matches/${MATCH_ID}/elo`, payload, authHeader(serviceToken()));
    assert.equal(second.status, 200);
    assert.equal(second.body.processed, true);

    const afterSecond = await pool.query(`SELECT elo FROM "Team" WHERE id = $1`, [teamHomeId]);
    assert.equal(Number(afterSecond.rows[0].elo), homeElo);

    const events = await pool.query(`SELECT COUNT(*)::int AS c FROM elo_match_event WHERE match_id = $1`, [MATCH_ID]);
    assert.equal(events.rows[0].c, 1);
  });

  test('re-procesar con marcador distinto actualiza ELO', async (t) => {
    if (!dbReady) return t.skip('DB no disponible');

    const before = await pool.query(`SELECT elo FROM "Team" WHERE id = $1`, [teamHomeId]);
    const eloBefore = Number(before.rows[0].elo);

    const res = await httpReq(
      'PUT',
      `/matches/${MATCH_ID}/elo`,
      {
        tournamentId: 't-elo-integration',
        tournamentStatus: 'published',
        homeInscriptionId: String(HOME_INSC_ID),
        awayInscriptionId: String(AWAY_INSC_ID),
        homeScore: 0,
        awayScore: 3,
      },
      authHeader(serviceToken())
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.processed, true);

    const after = await pool.query(`SELECT elo FROM "Team" WHERE id = $1`, [teamHomeId]);
    const eloAfter = Number(after.rows[0].elo);
    assert.ok(eloAfter < eloBefore, `elo debería bajar tras derrota (${eloBefore} → ${eloAfter})`);
  });
});
