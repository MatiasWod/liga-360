import { gqlRequest } from './client';

export async function updateMatchResult(
  matchId: string,
  homeScore: number | null,
  awayScore: number | null,
  status: string,
) {
  return gqlRequest(
    `mutation UpdateMatchResult($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
      updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
        id homeScore awayScore status
      }
    }`,
    { matchId, homeScore, awayScore, status },
    { auth: true },
  );
}
