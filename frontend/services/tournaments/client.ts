import { API_ENDPOINTS } from '../config';

const TOURNAMENTS_GRAPHQL_URL = API_ENDPOINTS.tournamentsGraphql;

interface GqlOptions {
  auth?: boolean;
}

export async function gqlRequest<T = any>(
  query: string,
  variables?: Record<string, any>,
  options: GqlOptions = {}
): Promise<T> {
  const token = options.auth ? localStorage.getItem('liga360:token') : null;
  const res = await fetch(TOURNAMENTS_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors?.[0]?.message || 'GraphQL error');
  return json.data as T;
}
