import { gqlRequest } from '../../../services/tournaments/client';

export async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  return gqlRequest<T>(query, variables, { auth: true });
}
