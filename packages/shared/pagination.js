/**
 * Paginación uniforme para listados (limit/offset). No rompe contratos: si faltan o son
 * inválidos se clampean (nunca 400). Default generoso para que la mayoría de las listas
 * vengan completas en una sola request; el max es solo un tope de seguridad.
 */
export const PAGINATION_DEFAULT_LIMIT = 200;
export const PAGINATION_MAX_LIMIT = 1000;

export function parsePagination(query = {}) {
  let limit = Number(query?.limit);
  if (!Number.isFinite(limit) || limit < 1) limit = PAGINATION_DEFAULT_LIMIT;
  limit = Math.min(Math.trunc(limit), PAGINATION_MAX_LIMIT);

  let offset = Number(query?.offset);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  offset = Math.trunc(offset);

  return { limit, offset };
}
