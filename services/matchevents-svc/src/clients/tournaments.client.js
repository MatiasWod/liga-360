/** Cliente GraphQL hacia tournaments-svc (vía gateway). */
import { env } from '../config/env.js';

const URL = env.tournamentsGraphqlUrl;
const TIMEOUT_MS = Number(process.env.DOWNSTREAM_TIMEOUT_MS || 3000);

async function gql(query, variables, authorization) {
  const response = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await response.json();
  if (!response.ok || body?.errors?.length) {
    const err = new Error(body?.errors?.[0]?.message || 'TOURNAMENTS_GQL_ERROR');
    err.graphqlErrors = body?.errors;
    throw err;
  }
  return body?.data;
}

export async function updateMatchResult({ matchId, homeScore, awayScore, status, authorization }) {
  try {
    const data = await gql(
      `mutation UpdateMatchResult($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
         updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
           id homeScore awayScore status
         }
       }`,
      { matchId: String(matchId), homeScore, awayScore, status },
      authorization
    );
    const match = data?.updateMatchResult;
    if (!match?.id) throw new Error('UPDATE_MATCH_RESULT_EMPTY');
    return match;
  } catch (err) {
    throw Object.assign(new Error(err.message || 'TOURNAMENTS_UPDATE_FAILED'), {
      statusCode: 502,
      code: 'TOURNAMENTS_UPDATE_FAILED',
    });
  }
}
