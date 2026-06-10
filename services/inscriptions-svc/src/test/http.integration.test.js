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

test('GET /invites sin token responde 401', async () => {
  const response = await request(app).get('/invites?tournamentId=t-1');
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('GET /invites con token team responde 403', async () => {
  const token = jwt.sign({ sub: 99, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .get('/invites?tournamentId=t-1')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error?.code || '', /FORBIDDEN/);
});

test('GET /teams/me/invites sin token responde 401', async () => {
  const response = await request(app).get('/teams/me/invites');
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('POST /invites/claims sin token responde 401', async () => {
  const response = await request(app).post('/invites/claims').send({ code: 'ABCD1234' });
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('GET /participants/me/invites sin token responde 401', async () => {
  const response = await request(app).get('/participants/me/invites');
  assert.equal(response.statusCode, 401);
  assert.match(response.body.error?.code || '', /UNAUTHORIZED/);
});

test('GET /participants/me/invites con token team responde 403', async () => {
  const token = jwt.sign({ sub: 7, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .get('/participants/me/invites')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
  assert.match(response.body.error?.code || '', /FORBIDDEN/);
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
