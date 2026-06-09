import crypto from 'crypto';

/** Verifica que una invitación se pueda usar; lanza error (con statusCode) si no. */
export function ensureInviteUsable(invite) {
  if (!invite) {
    throw Object.assign(new Error('invite not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  if (invite.status !== 'active') {
    throw Object.assign(new Error('invite not active'), { statusCode: 410, code: 'INVITE_NOT_ACTIVE' });
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error('invite expired'), { statusCode: 410, code: 'INVITE_EXPIRED' });
  }
  if (invite.max_uses !== null && Number(invite.uses_count) >= Number(invite.max_uses)) {
    throw Object.assign(new Error('invite max uses reached'), { statusCode: 410, code: 'INVITE_MAX_USES' });
  }
}

export function generateTargetedInviteToken() {
  return crypto.randomBytes(20).toString('hex');
}

export function generatePublicInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
