import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from './index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

test('GET /health responde ok', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'ok');
});

test('GET /invites sin token responde 401', async () => {
  const response = await request(app).get('/invites?tournamentId=t-1');
  assert.equal(response.statusCode, 401);
  assert.match(String(response.body.error || ''), /UNAUTHORIZED/);
});

test('GET /invites con token team responde 403', async () => {
  const token = jwt.sign({ sub: 99, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .get('/invites?tournamentId=t-1')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
  assert.match(String(response.body.error || ''), /FORBIDDEN/);
});

test('GET /teams/me/invites sin token responde 401', async () => {
  const response = await request(app).get('/teams/me/invites');
  assert.equal(response.statusCode, 401);
  assert.match(String(response.body.error || ''), /UNAUTHORIZED/);
});
