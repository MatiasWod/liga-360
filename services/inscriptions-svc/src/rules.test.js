import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRoleMatchesParticipantType,
  ensureInviteUsable,
  generatePublicInviteCode,
  generateTargetedInviteToken,
  normalizeTournamentParticipantType,
} from './index.js';

test('ensureInviteUsable acepta invite activa y vigente', () => {
  const invite = {
    status: 'active',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    max_uses: 2,
    uses_count: 1,
  };
  assert.doesNotThrow(() => ensureInviteUsable(invite));
});

test('ensureInviteUsable falla por invite revocada', () => {
  const invite = {
    status: 'revoked',
    expires_at: null,
    max_uses: null,
    uses_count: 0,
  };
  assert.throws(() => ensureInviteUsable(invite), /invite not active/);
});

test('generatePublicInviteCode respeta formato y longitud esperada', () => {
  const code = generatePublicInviteCode();
  assert.equal(code.length, 8);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
});

test('generateTargetedInviteToken genera token hexadecimal', () => {
  const token = generateTargetedInviteToken();
  assert.match(token, /^[a-f0-9]{40}$/);
});

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
  assert.throws(
    () => assertRoleMatchesParticipantType('team', 'individuals'),
    /FORBIDDEN_PARTICIPANT_TYPE_MISMATCH/
  );
  assert.throws(
    () => assertRoleMatchesParticipantType('participant', 'teams'),
    /FORBIDDEN_PARTICIPANT_TYPE_MISMATCH/
  );
});
