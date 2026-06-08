import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTournamentParticipantType, assertRoleMatchesParticipantType } from '../../domain/participantType.js';

test('normalizeTournamentParticipantType normaliza variantes esperadas', () => {
  assert.equal(normalizeTournamentParticipantType('teams'), 'teams');
  assert.equal(normalizeTournamentParticipantType('team'), 'teams');
  assert.equal(normalizeTournamentParticipantType('participants'), 'individuals');
  assert.equal(normalizeTournamentParticipantType('participant'), 'individuals');
  assert.equal(normalizeTournamentParticipantType('individuals'), 'individuals');
  assert.equal(normalizeTournamentParticipantType('unknown-value'), 'teams');
});

test('assertRoleMatchesParticipantType valida compatibilidad rol-tipo', () => {
  assert.doesNotThrow(() => assertRoleMatchesParticipantType('team', 'teams'));
  assert.doesNotThrow(() => assertRoleMatchesParticipantType('participant', 'individuals'));
  assert.throws(() => assertRoleMatchesParticipantType('team', 'individuals'), /FORBIDDEN_PARTICIPANT_TYPE_MISMATCH/);
  assert.throws(() => assertRoleMatchesParticipantType('participant', 'teams'), /FORBIDDEN_PARTICIPANT_TYPE_MISMATCH/);
});
