import { gqlRequest } from './client';
import { updateMatchDateTime } from './matchDateTime';

export async function getTournamentConfigurationById(tournamentId: string) {
  const data = await gqlRequest<{ tournament: any }>(
    `query ConfigTournament($id: ID!) {
      tournament(id: $id) {
        id
        name
        sport
        status
        organizer
        seriesId
        editionLabel
        seriesName
        categoryLabel
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
            stageStatus
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
              timing
              placementSnapshotJson
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
                winnerAdvancementTransitionId
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
              winnerAdvancementTransitionId
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
  force?: boolean;
  seedOrder?: number;
}) {
  await gqlRequest(
    `mutation Assign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!, $force: Boolean, $seedOrder: Int) {
      assignInscriptionToStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName, force: $force, seedOrder: $seedOrder)
    }`,
    payload,
    { auth: true }
  );
}

export async function hydrateEliminationFirstRoundFromRoster(stageId: string) {
  await gqlRequest(
    `mutation HydrateElimFirstRound($stageId: ID!) {
      hydrateEliminationFirstRoundFromRoster(stageId: $stageId)
    }`,
    { stageId },
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

export async function setMatchWinnerAdvancement(matchId: string, transitionId: string | null) {
  const data = await gqlRequest<{ setMatchWinnerAdvancement: { id: string; winnerAdvancementTransitionId?: string | null } }>(
    `mutation SetMatchWinnerAdvance($matchId: ID!, $transitionId: ID) {
      setMatchWinnerAdvancement(matchId: $matchId, transitionId: $transitionId) {
        id
        winnerAdvancementTransitionId
      }
    }`,
    { matchId, transitionId: transitionId ?? null },
    { auth: true }
  );
  return data?.setMatchWinnerAdvancement ?? null;
}

export async function generateLeagueRoundRobin(stageId: string, doubleRound: boolean, maxRounds?: number | null) {
  await gqlRequest(
    `mutation GenLeague($stageId: ID!, $doubleRound: Boolean!, $maxRounds: Int) {
      generateLeagueRoundRobin(stageId: $stageId, doubleRound: $doubleRound, maxRounds: $maxRounds) { id fixtureCode }
    }`,
    { stageId, doubleRound, maxRounds: maxRounds ?? null },
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

export async function trimEliminationBracketAfterRound(payload: {
  stageId: string;
  tournamentId: string;
  lastRoundInclusive: number;
}) {
  await gqlRequest(
    `mutation TrimElim($stageId: ID!, $tournamentId: ID!, $lastRoundInclusive: Int!) {
      trimEliminationBracketAfterRound(
        stageId: $stageId
        tournamentId: $tournamentId
        lastRoundInclusive: $lastRoundInclusive
      )
    }`,
    {
      stageId: payload.stageId,
      tournamentId: payload.tournamentId,
      lastRoundInclusive: Math.trunc(payload.lastRoundInclusive),
    },
    { auth: true }
  );
}

export async function generateGroupsStageRoundRobin(stageId: string, doubleRound: boolean, maxRounds?: number | null) {
  await gqlRequest(
    `mutation GenGroups($stageId: ID!, $doubleRound: Boolean!, $maxRounds: Int) {
      generateGroupsStageRoundRobin(stageId: $stageId, doubleRound: $doubleRound, maxRounds: $maxRounds) { id fixtureCode groupId }
    }`,
    { stageId, doubleRound, maxRounds: maxRounds ?? null },
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
    `mutation AssignMatchSlot($stageId: ID!, $matchId: ID!, $slotRole: String!, $inscriptionId: ID, $tournamentId: ID!, $displayName: String) {
      assignInscriptionToMatchSlot(stageId: $stageId, matchId: $matchId, slotRole: $slotRole, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
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
    `mutation UpdateMatchScheduling($stageId: ID!, $matchId: ID!, $round: Int!, $leg: Int!, $slotIndex: Int!) {
      updateMatchScheduling(stageId: $stageId, matchId: $matchId, round: $round, leg: $leg, slotIndex: $slotIndex)
    }`,
    payload,
    { auth: true }
  );
}

/** Alias de updateMatchDateTime enfocado solo en la fecha/hora del partido. */
export async function updateMatchScheduledAt(payload: {
  tournamentId: string;
  stageId: string;
  matchId: string;
  scheduledAt: string | null;
}) {
  await updateMatchDateTime(payload.matchId, { scheduledAt: payload.scheduledAt });
}

/** Alias de updateMatchResult para usarse desde el fixture viewer (solo scores, status → completed). */
export async function updateMatchResultFromViewer(payload: {
  tournamentId: string;
  stageId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
}) {
  await gqlRequest(
    `mutation UpdateMatchResult($matchId: ID!, $homeScore: Int, $awayScore: Int, $status: String) {
      updateMatchResult(matchId: $matchId, homeScore: $homeScore, awayScore: $awayScore, status: $status) {
        id homeScore awayScore status
      }
    }`,
    {
      matchId: payload.matchId,
      homeScore: payload.homeScore,
      awayScore: payload.awayScore,
      status: 'completed',
    },
    { auth: true }
  );
}

export async function setStageStatus(stageId: string, status: 'not_started' | 'active' | 'finished'): Promise<void> {
  await gqlRequest(
    `mutation SetStageStatus($stageId: ID!, $status: String!) {
      setStageStatus(stageId: $stageId, status: $status) { id stageStatus }
    }`,
    { stageId, status },
    { auth: true }
  );
}

export async function saveTransitionPlacementSnapshot(transitionId: string, snapshotJson: string): Promise<void> {
  await gqlRequest(
    `mutation SaveTransitionPlacementSnapshot($transitionId: ID!, $snapshotJson: String!) {
      saveTransitionPlacementSnapshot(transitionId: $transitionId, snapshotJson: $snapshotJson) { id }
    }`,
    { transitionId, snapshotJson },
    { auth: true }
  );
}
