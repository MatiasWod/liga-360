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

test('POST /invites/code/claim sin token responde 401', async () => {
  const response = await request(app).post('/invites/code/claim').send({ code: 'ABCD1234' });
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

// ---------------------------------------------------------------------------
// Match Events — happy path + auth guard
// ---------------------------------------------------------------------------

test('POST /matches/:matchId/events sin token responde 401', async () => {
  const response = await request(app)
    .post('/matches/match-test-1/events')
    .send({ event_type: 'goal', display_name: 'Jugador 1', tournament_id: 'trn-1' });
  assert.equal(response.statusCode, 401);
});

test('POST /matches/:matchId/events con token team responde 403', async () => {
  const token = jwt.sign({ sub: 10, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .post('/matches/match-test-1/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ event_type: 'goal', display_name: 'Jugador 1', tournament_id: 'trn-1' });
  assert.equal(response.statusCode, 403);
});

test('POST /matches/:matchId/events con event_type invalido responde 400', async () => {
  const token = jwt.sign({ sub: 1, type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .post('/matches/match-test-1/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ event_type: 'penalty', display_name: 'Jugador 1', tournament_id: 'trn-1' });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error?.message || '', /event_type invalido/);
});

test('POST /matches/:matchId/events sin display_name responde 400', async () => {
  const token = jwt.sign({ sub: 1, type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .post('/matches/match-test-1/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ event_type: 'goal', tournament_id: 'trn-1' });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error?.message || '', /display_name/);
});

test('POST /matches/:matchId/events sin tournament_id responde 400', async () => {
  const token = jwt.sign({ sub: 1, type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .post('/matches/match-test-1/events')
    .set('Authorization', `Bearer ${token}`)
    .send({ event_type: 'goal', display_name: 'Jugador 1' });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.error?.message || '', /tournament_id/);
});

test('GET /matches/:matchId/events sin token responde 401', async () => {
  const response = await request(app).get('/matches/match-test-1/events');
  assert.equal(response.statusCode, 401);
});

test('PATCH /matches/:matchId/events/:eventId sin token responde 401', async () => {
  const response = await request(app)
    .patch('/matches/match-test-1/events/999')
    .send({ display_name: 'Nuevo nombre' });
  assert.equal(response.statusCode, 401);
});

test('PATCH /matches/:matchId/events/:eventId con token team responde 403', async () => {
  const token = jwt.sign({ sub: 10, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .patch('/matches/match-test-1/events/999')
    .set('Authorization', `Bearer ${token}`)
    .send({ display_name: 'Nuevo nombre' });
  assert.equal(response.statusCode, 403);
});

test('DELETE /matches/:matchId/events/:eventId sin token responde 401', async () => {
  const response = await request(app).delete('/matches/match-test-1/events/999');
  assert.equal(response.statusCode, 401);
});

test('DELETE /matches/:matchId/events/:eventId con token team responde 403', async () => {
  const token = jwt.sign({ sub: 10, type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  const response = await request(app)
    .delete('/matches/match-test-1/events/999')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(response.statusCode, 403);
});
