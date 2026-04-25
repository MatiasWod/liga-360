import { gqlRequest } from './client';

export async function getTournamentConfigurationById(tournamentId: string) {
  const data = await gqlRequest<{ tournament: any }>(
    `query ConfigTournament($id: ID!) {
      tournament(id: $id) {
        id
        name
        participantType
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
            standings {
              position
              inscriptionId
              displayName
              played
              won
              drawn
              lost
              goalsFor
              goalsAgainst
              goalDifference
              points
            }
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
              standings {
                position
                inscriptionId
                displayName
                played
                won
                drawn
                lost
                goalsFor
                goalsAgainst
                goalDifference
                points
              }
              matches {
                id
                round
                leg
                slotIndex
                fixtureCode
                groupId
                scheduledAt
                venue
                referee
                homeScore
                awayScore
                status
                leagueHomeSeed
                leagueAwaySeed
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
              groupId
              scheduledAt
              venue
              referee
              homeScore
              awayScore
              status
              leagueHomeSeed
              leagueAwaySeed
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
