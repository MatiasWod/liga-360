import { gqlRequest } from './client';

export interface UpdateMatchDateTimePayload {
  scheduledAt?: string | null;
  venue?: string | null;
  referee?: string | null;
}

export interface MatchDateTimeResult {
  id: string;
  scheduledAt: string | null;
  venue: string | null;
  referee: string | null;
}

export async function updateMatchDateTime(
  matchId: string,
  payload: UpdateMatchDateTimePayload
): Promise<MatchDateTimeResult> {
  const data = await gqlRequest<{ updateMatchDateTime: MatchDateTimeResult }>(
    `mutation UpdateMatchDateTime($matchId: ID!, $scheduledAt: String, $venue: String, $referee: String) {
      updateMatchDateTime(matchId: $matchId, scheduledAt: $scheduledAt, venue: $venue, referee: $referee) {
        id
        scheduledAt
        venue
        referee
      }
    }`,
    { matchId, ...payload },
    { auth: true }
  );
  return data.updateMatchDateTime;
}
