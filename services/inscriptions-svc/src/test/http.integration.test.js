import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app, closePool } from '../index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

test('GET /health responde ok', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'ok');
});

test.after(async () => {
  if (typeof closePool === 'function') {
    await closePool();
  }
});

function extractCode(body) {
  // verifyToken/requireRole: { error: "string", code: "..." }
  // errorHandler: { error: { code: "...", message: "..." } }
  return body.code || body.error?.code || '';
}

function makeToken(type) {
  return jwt.sign({ sub: 1, username: 'u', type, isVerified: true }, JWT_SECRET, { expiresIn: '1h' });
}

test('GET /invites sin token responde 401', async () => {
  const response = await request(app).get('/invites?tournamentId=t-1');
  assert.equal(response.statusCode, 401);
  assert.match(extractCode(response.body), /UNAUTHORIZED/);
});

test('GET /invites con token team responde 403', async () => {
  const token = makeToken('team');
  const response = await request(app)
    .get('/invites?tournamentId=t-1')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
  assert.match(extractCode(response.body), /FORBIDDEN/);
});

test('GET /teams/me/invites sin token responde 401', async () => {
  const response = await request(app).get('/teams/me/invites');
  assert.equal(response.statusCode, 401);
  assert.match(extractCode(response.body), /UNAUTHORIZED/);
});

test('POST /invites/claims sin token responde 401', async () => {
  const response = await request(app).post('/invites/claims').send({ code: 'ABCD1234' });
  assert.equal(response.statusCode, 401);
  assert.match(extractCode(response.body), /UNAUTHORIZED/);
});

test('GET /participants/me/invites sin token responde 401', async () => {
  const response = await request(app).get('/participants/me/invites');
  assert.equal(response.statusCode, 401);
  assert.match(extractCode(response.body), /UNAUTHORIZED/);
});

test('GET /participants/me/invites con token team responde 403', async () => {
  const token = makeToken('team');
  const response = await request(app)
    .get('/participants/me/invites')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
  assert.match(extractCode(response.body), /FORBIDDEN/);
});

test('GET /inscriptions/:id sin token responde 401 (endpoint interno)', async () => {
  const response = await request(app).get('/inscriptions/1');
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('GET /inscriptions/:id con token de usuario responde 403 (solo servicio)', async () => {
  const token = jwt.sign({ sub: 1, type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .get('/inscriptions/1')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error?.code || '', /FORBIDDEN/);
});

test('GET /inscriptions/:id con token de servicio responde 404 para id inexistente', async (t) => {
  // Requiere Postgres: se saltea limpio si la DB local no está levantada.
  try {
    const { pool } = await import('../config/db.js');
    await pool.query('SELECT 1');
  } catch {
    return t.skip('DB no disponible');
  }
  const token = jwt.sign({ type: 'service', iss: 'matchevents-svc' }, JWT_SECRET, { expiresIn: '60s' });
  const response = await request(app)
    .get('/inscriptions/999999999')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 404);
});

test('GET /teams/:teamId/inscriptions sin token responde 200 con lista vacía para equipo sin historia', async (t) => {
  try {
    const { pool } = await import('../config/db.js');
    await pool.query('SELECT 1');
  } catch {
    return t.skip('DB no disponible');
  }
  const response = await request(app).get('/teams/999999999/inscriptions');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.teamId, 999999999);
  assert.deepEqual(response.body.inscriptions, []);
});

test('GET /teams/:teamId/inscriptions con teamId invalido responde 400', async () => {
  const response = await request(app).get('/teams/abc/inscriptions');
  assert.equal(response.statusCode, 400);
});

test('PATCH /inscriptions/:id/weight sin token responde 401', async () => {
  const response = await request(app).patch('/inscriptions/1/weight').send({ weight: 5 });
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('PATCH /inscriptions/:id/weight con token team responde 403', async () => {
  const token = jwt.sign({ sub: 7, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .patch('/inscriptions/1/weight')
    .set('Authorization', `Bearer ${token}`)
    .send({ weight: 5 });
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error?.code || '', /FORBIDDEN/);
});

test('PATCH /inscriptions/:id/weight con peso invalido responde 400', async () => {
  const token = jwt.sign({ sub: 1, type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .patch('/inscriptions/1/weight')
    .set('Authorization', `Bearer ${token}`)
    .send({ weight: 11 });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error?.code || '', /VALIDATION_ERROR/);
});

test('PATCH /internal/inscriptions/:id/tournament-rating sin token responde 401', async () => {
  const response = await request(app).patch('/internal/inscriptions/1/tournament-rating').send({ tournamentRating: 1200 });
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('PATCH /internal/inscriptions/:id/tournament-rating con token organizer responde 403', async () => {
  const token = jwt.sign({ sub: 1, type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .patch('/internal/inscriptions/1/tournament-rating')
    .set('Authorization', `Bearer ${token}`)
    .send({ tournamentRating: 1200 });
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error?.code || '', /FORBIDDEN/);
});

test('PATCH /internal/inscriptions/:id/tournament-rating con rating invalido responde 400', async () => {
  const token = jwt.sign({ type: 'service', iss: 'teams-svc' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .patch('/internal/inscriptions/1/tournament-rating')
    .set('Authorization', `Bearer ${token}`)
    .send({ tournamentRating: 12.5 });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error?.code || '', /VALIDATION_ERROR/);
});

test('PATCH /internal/inscriptions/:id/tournament-rating fantasma actualiza rating', async (t) => {
  try {
    const { pool } = await import('../config/db.js');
    await pool.query('SELECT 1');
  } catch {
    return t.skip('DB no disponible');
  }

  const { pool } = await import('../config/db.js');
  const inserted = await pool.query(
    `INSERT INTO "Inscription"(
       tournament_id, competition_id, competitor_kind, display_name, linked_team_id,
       status, source, created_at, updated_at
     ) VALUES ($1,$2,'team',$3,NULL,'ACEPTADO','manual',now(),now())
     RETURNING id`,
    ['t-elo-test', 'c-elo-test', 'Fantasma ELO Test']
  );
  const inscriptionId = inserted.rows[0].id;

  try {
    const token = jwt.sign({ type: 'service', iss: 'teams-svc' }, JWT_SECRET, { expiresIn: '1h' });
    const response = await request(app)
      .patch(`/internal/inscriptions/${inscriptionId}/tournament-rating`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tournamentRating: 1350 });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.inscription.tournament_rating, 1350);
  } finally {
    await pool.query('DELETE FROM "Inscription" WHERE id = $1', [inscriptionId]);
  }
});

test('GET /inscriptions/lookup sin ids responde 200 con lista vacía', async (t) => {
  try {
    const { pool } = await import('../config/db.js');
    await pool.query('SELECT 1');
  } catch {
    return t.skip('DB no disponible');
  }
  const response = await request(app).get('/inscriptions/lookup');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.inscriptions, []);
});
