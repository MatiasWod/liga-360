/** Cliente GraphQL hacia tournaments-svc (vía el gateway). */
import { env } from '../config/env.js';
import { normalizeTournamentParticipantType } from '../domain/participantType.js';

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

export async function resolveCompetitionMaxSlots(competitionId) {
  try {
    const data = await gql(
      `query CompetitionMaxSlots($id: ID!) { competition(id: $id) { id effectiveMaxSlots } }`,
      { id: competitionId }
    );
    const maxSlots = Number(data?.competition?.effectiveMaxSlots);
    if (!Number.isFinite(maxSlots) || maxSlots < 0) {
      throw new Error('COMPETITION_MAX_SLOTS_UNAVAILABLE');
    }
    return maxSlots;
  } catch {
    throw Object.assign(new Error('COMPETITION_MAX_SLOTS_UNAVAILABLE'), { statusCode: 502, code: 'COMPETITION_MAX_SLOTS_UNAVAILABLE' });
  }
}

export async function resolveTournamentAccessConfig(tournamentId) {
  try {
    const data = await gql(
      `query TournamentInscriptionMode($id: ID!) { tournament(id: $id) { id inscriptionMode participantType } }`,
      { id: tournamentId }
    );
    const mode = String(data?.tournament?.inscriptionMode || '').trim().toLowerCase();
    const participantType = normalizeTournamentParticipantType(data?.tournament?.participantType);
    if (!['public', 'invitation'].includes(mode)) {
      throw new Error('TOURNAMENT_MODE_UNAVAILABLE');
    }
    return { mode, participantType };
  } catch {
    throw Object.assign(new Error('TOURNAMENT_MODE_UNAVAILABLE'), { statusCode: 502, code: 'TOURNAMENT_MODE_UNAVAILABLE' });
  }
}

export async function clearTournamentInitialAssignments({ tournamentId, inscriptionId, authorization }) {
  await gql(
    `mutation ClearInscriptionAssignments($tournamentId: ID!, $inscriptionId: ID!) {
       clearInscriptionAssignments(tournamentId: $tournamentId, inscriptionId: $inscriptionId)
     }`,
    { tournamentId: String(tournamentId), inscriptionId: String(inscriptionId) },
    authorization
  );
}
