import crypto from 'crypto';

export function normalizeDni(rawDni) {
  if (rawDni == null) return null;
  const digits = String(rawDni).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 7 || digits.length > 8) return null;
  return digits;
}

export function nowIso() {
  return new Date().toISOString();
}

export function hashTeamCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

export function generateTeamCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function normalizeInvitePrefix(name) {
  const cleaned = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const base = (cleaned || 'TEAM').slice(0, 3);
  return base.padEnd(3, 'X');
}

export function randomThreeDigits() {
  return String(crypto.randomInt(0, 1000)).padStart(3, '0');
}

export async function generateUniqueInviteCode(client, name, maxAttempts = 50) {
  const prefix = normalizeInvitePrefix(name);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const inviteCode = `${prefix}-${randomThreeDigits()}`;
    const exists = await client.query(
      `SELECT 1 FROM "Team" WHERE invite_code = $1 LIMIT 1`,
      [inviteCode]
    );
    if (exists.rows.length === 0) return inviteCode;
  }
  throw new Error('INVITE_CODE_GENERATION_FAILED');
}
