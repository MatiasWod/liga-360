import { gqlRequest } from './client';

export async function getTournamentConfigurationById(tournamentId: string) {
  const data = await gqlRequest<{ tournament: any }>(
    `query ConfigTournament($id: ID!) {
      tournament(id: $id) {
        id
        name
        sport
        season
        venue
        participantType
        inscriptionMode
        status
        organizer
        competitions {
          id
          name
          order
          stages {
            id
            name
            order
            format
            isInitial
            configJson
            childrenJson
            transitions {
              id
              label
              toStageId
              selectionKind
              topN
              rangeFrom
              rangeTo
              bottomN
              toExternalTournamentId
              toExternalStageId
              toExternalTournamentName
            }
            groups {
              id
              name
              order
              capacity
              assignedInscriptions { inscriptionId displayName }
              matches {
                id
                round
                leg
                slotIndex
                fixtureCode
                groupId
                scheduledAt
                leagueHomeSeed
                leagueAwaySeed
                status
                homeScore
                awayScore
                resultRecordedAt
                resultRecordedBy
                homeAssignedInscription { inscriptionId displayName }
                awayAssignedInscription { inscriptionId displayName }
              }
            }
            matches {
              id
              round
              leg
              slotIndex
              fixtureCode
              scheduledAt
              leagueHomeSeed
              leagueAwaySeed
              status
              homeScore
              awayScore
              resultRecordedAt
              resultRecordedBy
              homeAssignedInscription { inscriptionId displayName }
              awayAssignedInscription { inscriptionId displayName }
            }
            assignedInscriptions { inscriptionId displayName }
          }
        }
      }
    }`,
    { id: tournamentId },
    { auth: true }
  );
  return data?.tournament || null;
}

export async function unassignInscriptionFromStage(stageId: string, inscriptionId: string, tournamentId: string) {
  await gqlRequest(
    `mutation Unassign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!) {
      unassignInscriptionFromStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId)
    }`,
    { stageId, inscriptionId, tournamentId },
    { auth: true }
  );
}

export async function assignInscriptionToStage(payload: {
  stageId: string;
  inscriptionId: string;
  tournamentId: string;
  displayName: string;
}) {
  await gqlRequest(
    `mutation Assign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
      assignInscriptionToStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
    }`,
    payload,
    { auth: true }
  );
}

export async function syncStageGroups(stageId: string, totalGroups: number) {
  await gqlRequest(
    `mutation SyncGroups($stageId: ID!, $totalGroups: Int!) {
      syncStageGroups(stageId: $stageId, totalGroups: $totalGroups) { id }
    }`,
    { stageId, totalGroups },
    { auth: true }
  );
}

export async function assignInscriptionToGroup(payload: {
  stageId: string;
  groupId: string;
  inscriptionId: string;
  tournamentId: string;
  displayName: string;
}) {
  await gqlRequest(
    `mutation AssignGroup($stageId: ID!, $groupId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
      assignInscriptionToGroup(stageId: $stageId, groupId: $groupId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
    }`,
    payload,
    { auth: true }
  );
}

export async function generateLeagueRoundRobin(stageId: string, doubleRound: boolean) {
  await gqlRequest(
    `mutation GenLeague($stageId: ID!, $doubleRound: Boolean!) {
      generateLeagueRoundRobin(stageId: $stageId, doubleRound: $doubleRound) { id fixtureCode }
    }`,
    { stageId, doubleRound },
    { auth: true }
  );
}

export async function generateSingleEliminationBracket(stageId: string, doubleRound: boolean) {
  await gqlRequest(
    `mutation GenElim($stageId: ID!, $doubleRound: Boolean!) {
      generateSingleEliminationBracket(stageId: $stageId, doubleRound: $doubleRound) { id fixtureCode round slotIndex leg }
    }`,
    { stageId, doubleRound },
    { auth: true }
  );
}

export async function generateGroupsStageRoundRobin(stageId: string, doubleRound: boolean) {
  await gqlRequest(
    `mutation GenGroups($stageId: ID!, $doubleRound: Boolean!) {
      generateGroupsStageRoundRobin(stageId: $stageId, doubleRound: $doubleRound) { id fixtureCode groupId }
    }`,
    { stageId, doubleRound },
    { auth: true }
  );
}

/** Publica el torneo (misma mutación que edición general) para habilitar resultados y vista pública. */
export async function setTournamentPublished(payload: {
  id: string;
  name: string;
  sport: string;
  season?: string | null;
  venue?: string | null;
  participantType?: string | null;
  inscriptionMode: 'public' | 'invitation';
}) {
  await gqlRequest(
    `mutation PublishTournament(
      $id: ID!
      $name: String!
      $sport: String!
      $season: String
      $venue: String
      $participantType: String
      $inscriptionMode: InscriptionMode!
      $status: TournamentStatus!
    ) {
      updateTournament(
        id: $id
        name: $name
        sport: $sport
        season: $season
        venue: $venue
        participantType: $participantType
        inscriptionMode: $inscriptionMode
        status: $status
      ) {
        id
        status
      }
    }`,
    {
      id: payload.id,
      name: payload.name,
      sport: payload.sport,
      season: payload.season ?? null,
      venue: payload.venue ?? null,
      participantType: payload.participantType ?? null,
      inscriptionMode: payload.inscriptionMode,
      status: 'published',
    },
    { auth: true }
  );
}

export async function assignInscriptionToMatchSlot(payload: {
  stageId: string;
  matchId: string;
  slotRole: 'home' | 'away';
  inscriptionId: string | null;
  tournamentId: string;
  displayName?: string | null;
}) {
  await gqlRequest(
    `mutation AssignSlot(
      $stageId: ID!
      $matchId: ID!
      $slotRole: String!
      $inscriptionId: ID
      $tournamentId: ID!
      $displayName: String
    ) {
      assignInscriptionToMatchSlot(
        stageId: $stageId
        matchId: $matchId
        slotRole: $slotRole
        inscriptionId: $inscriptionId
        tournamentId: $tournamentId
        displayName: $displayName
      )
    }`,
    {
      stageId: payload.stageId,
      matchId: payload.matchId,
      slotRole: payload.slotRole,
      inscriptionId: payload.inscriptionId,
      tournamentId: payload.tournamentId,
      displayName: payload.displayName ?? null,
    },
    { auth: true }
  );
}

export async function updateMatchScheduling(payload: {
  stageId: string;
  matchId: string;
  round: number;
  leg: number;
  slotIndex: number;
}) {
  await gqlRequest(
    `mutation UpdateMatchScheduling(
      $stageId: ID!
      $matchId: ID!
      $round: Int!
      $leg: Int!
      $slotIndex: Int!
    ) {
      updateMatchScheduling(
        stageId: $stageId
        matchId: $matchId
        round: $round
        leg: $leg
        slotIndex: $slotIndex
      )
    }`,
    payload,
    { auth: true }
  );
}

export async function updateMatchScheduledAt(payload: {
  tournamentId: string;
  stageId: string;
  matchId: string;
  scheduledAt: string | null;
}) {
  await gqlRequest(
    `mutation UpdateMatchScheduledAt(
      $tournamentId: ID!
      $stageId: ID!
      $matchId: ID!
      $scheduledAt: String
    ) {
      updateMatchScheduledAt(
        tournamentId: $tournamentId
        stageId: $stageId
        matchId: $matchId
        scheduledAt: $scheduledAt
      ) {
        id
        scheduledAt
      }
    }`,
    {
      tournamentId: payload.tournamentId,
      stageId: payload.stageId,
      matchId: payload.matchId,
      scheduledAt: payload.scheduledAt,
    },
    { auth: true }
  );
}

export async function updateMatchResult(payload: {
  tournamentId: string;
  stageId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
}) {
  await gqlRequest(
    `mutation UpdateMatchResult(
      $tournamentId: ID!
      $stageId: ID!
      $matchId: ID!
      $homeScore: Int!
      $awayScore: Int!
    ) {
      updateMatchResult(
        tournamentId: $tournamentId
        stageId: $stageId
        matchId: $matchId
        homeScore: $homeScore
        awayScore: $awayScore
      ) {
        id
        status
        homeScore
        awayScore
        resultRecordedAt
        resultRecordedBy
      }
    }`,
    payload,
    { auth: true }
  );
}
