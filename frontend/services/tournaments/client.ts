import { API_ENDPOINTS } from '../config';
import { authHeaders } from '../http';

const TOURNAMENTS_GRAPHQL_URL = API_ENDPOINTS.tournamentsGraphql;

interface GqlOptions {
  /** @deprecated El Bearer se adjunta siempre que haya sesión; cada resolver decide si lo exige. */
  auth?: boolean;
}

export async function gqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  _options: GqlOptions = {}
): Promise<T> {
  const res = await fetch(TOURNAMENTS_GRAPHQL_URL, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors?.[0]?.message || 'GraphQL error');
  return json.data as T;
}
