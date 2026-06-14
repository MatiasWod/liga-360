export interface PageOpts {
  limit?: number;
  offset?: number;
}

/** Tope del backend; usar en listas que se consumen completas (brackets, fixtures, standings). */
export const PAGE_MAX_LIMIT = 1000;

/** Agrega limit/offset a un URLSearchParams (los omite si no vienen → default del backend). */
export function appendPageParams(params: URLSearchParams, opts?: PageOpts): URLSearchParams {
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.offset != null) params.set('offset', String(opts.offset));
  return params;
}
