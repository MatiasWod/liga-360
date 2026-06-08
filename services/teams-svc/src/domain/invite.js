import crypto from 'crypto';

const COMBINING_MARKS = /[̀-ͯ]/g;

/** Prefijo de 3 letras A-Z derivado del nombre del equipo (rellena con X). */
export function normalizeInvitePrefix(name) {
  const cleaned = String(name || '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const base = (cleaned || 'TEAM').slice(0, 3);
  return base.padEnd(3, 'X');
}

export function randomThreeDigits() {
  return String(crypto.randomInt(0, 1000)).padStart(3, '0');
}

/** Un candidato de invite code `ABC-123` (la unicidad se valida en el repositorio). */
export function buildInviteCodeCandidate(name) {
  return `${normalizeInvitePrefix(name)}-${randomThreeDigits()}`;
}
