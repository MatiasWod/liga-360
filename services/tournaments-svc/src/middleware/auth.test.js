import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { requireOrganizerFromAuthHeader } from './auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

test('falla sin token', () => {
  assert.throws(
    () => requireOrganizerFromAuthHeader(''),
    /UNAUTHORIZED: token requerido/
  );
});

test('falla con token inválido', () => {
  assert.throws(
    () => requireOrganizerFromAuthHeader('Bearer token-invalido'),
    /UNAUTHORIZED: token inválido/
  );
});

test('falla si el rol no es organizer', () => {
  const token = jwt.sign({ sub: 1, username: 'team1', type: 'team' }, JWT_SECRET, { expiresIn: '1h' });
  assert.throws(
    () => requireOrganizerFromAuthHeader(`Bearer ${token}`),
    /FORBIDDEN: solo organizador puede crear torneos/
  );
});

test('permite organizer válido', () => {
  const token = jwt.sign({ sub: 1, username: 'org1', type: 'organizer' }, JWT_SECRET, { expiresIn: '1h' });
  const payload = requireOrganizerFromAuthHeader(`Bearer ${token}`);
  assert.equal(payload.type, 'organizer');
  assert.equal(payload.username, 'org1');
});

