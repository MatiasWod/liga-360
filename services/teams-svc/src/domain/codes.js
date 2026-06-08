import crypto from 'crypto';

/** Hash determinístico (sha256) del access code de un equipo. */
export function hashTeamCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/** Access code aleatorio (alfabeto sin caracteres ambiguos). */
export function generateTeamCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
