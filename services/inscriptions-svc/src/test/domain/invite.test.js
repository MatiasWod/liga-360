import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureInviteUsable, generatePublicInviteCode, generateTargetedInviteToken } from '../../domain/invite.js';

test('ensureInviteUsable acepta invite activa y vigente', () => {
  assert.doesNotThrow(() => ensureInviteUsable({
    status: 'active',
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    max_uses: 2,
    uses_count: 1,
  }));
});

test('ensureInviteUsable falla por invite revocada', () => {
  assert.throws(
    () => ensureInviteUsable({ status: 'revoked', expires_at: null, max_uses: null, uses_count: 0 }),
    /invite not active/
  );
});

test('generatePublicInviteCode respeta formato y longitud esperada', () => {
  const code = generatePublicInviteCode();
  assert.equal(code.length, 8);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
});

test('generateTargetedInviteToken genera token hexadecimal', () => {
  assert.match(generateTargetedInviteToken(), /^[a-f0-9]{40}$/);
});
