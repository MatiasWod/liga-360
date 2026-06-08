/** Helpers de error estructurado + traducción de errores conocidos (pg/dominio) a HTTP. */

export const badRequest = (message, code = 'VALIDATION_ERROR') => Object.assign(new Error(message), { statusCode: 400, code });
export const forbidden = (message, code = 'FORBIDDEN') => Object.assign(new Error(message), { statusCode: 403, code });
export const notFound = (message, code = 'NOT_FOUND') => Object.assign(new Error(message), { statusCode: 404, code });
export const conflict = (message, code = 'CONFLICT') => Object.assign(new Error(message), { statusCode: 409, code });

/**
 * Traduce errores conocidos (constraints únicos de pg, errores de dominio) a errores HTTP
 * estructurados. Si el error ya está estructurado se devuelve tal cual; si es desconocido,
 * se devuelve sin tocar (el errorHandler lo convertirá en 500).
 */
export function translateError(e) {
  if (e && e.statusCode) return e;
  const msg = String(e?.message || '');
  const constraint = String(e?.constraint || '');
  const pgCode = String(e?.code || '');

  if (msg.includes('DUPLICATE_TEAM_IN_TOURNAMENT')
      || (pgCode === '23505' && constraint.includes('uniq_inscription_tournament_linked_team_active'))) {
    return conflict('equipo duplicado en torneo: solo se permite una inscripción activa por equipo', 'DUPLICATE_TEAM');
  }
  if (msg.includes('DUPLICATE_PARTICIPANT_IN_TOURNAMENT')
      || (pgCode === '23505' && constraint.includes('uniq_inscription_tournament_linked_participant_active'))) {
    return conflict('participante duplicado en torneo: solo se permite una inscripción activa por participante', 'DUPLICATE_PARTICIPANT');
  }
  if (msg.includes('FORBIDDEN_PARTICIPANT_TYPE_MISMATCH')) {
    return forbidden('tipo de participante incompatible con el torneo', 'PARTICIPANT_TYPE_MISMATCH');
  }
  if (msg.startsWith('FORBIDDEN:')) {
    return forbidden(msg.replace(/^FORBIDDEN:\s*/, ''));
  }
  return e;
}
