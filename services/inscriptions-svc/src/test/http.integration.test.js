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
