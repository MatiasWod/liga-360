/**
 * Resolvers GraphQL (subgrafo Apollo). Capa fina: validan autorización y delegan toda la
 * lógica en los servicios. El driver Neo4j llega por context.driver.
 */
import { requireOrganizerFromAuthHeader } from '../middleware/auth.js';
import * as tournamentService from '../services/tournament.service.js';
import * as competitionService from '../services/competition.service.js';
import * as stageService from '../services/stage.service.js';
import * as groupService from '../services/group.service.js';
import * as keyService from '../services/key.service.js';
import * as advancementService from '../services/advancement.service.js';
import * as fixtureService from '../services/fixture.service.js';
import * as matchService from '../services/match.service.js';
import * as standingsService from '../services/standings.service.js';

function requireOrganizer(context) {
  return requireOrganizerFromAuthHeader(context?.headers?.authorization || '');
}

const resolvers = {
  Query: {
    health: () => 'ok',
    version: () => '0.1.0',
    tournaments: (_p, _args, { driver }) => tournamentService.list(driver),
    tournament: (_p, { id }, { driver }) => tournamentService.getById(driver, id),
    competition: (_p, { id }, { driver }) => competitionService.getById(driver, id),
  },
  Mutation: {
    createTournament: (_p, args, context) => {
      const user = requireOrganizer(context);
      const organizer = String(user?.username || '').trim() || `organizer-${String(user?.sub || '')}`;
      return tournamentService.create(context.driver, { ...args, organizer });
    },
    updateTournament: (_p, { id, ...updates }, context) => {
      requireOrganizer(context);
      return tournamentService.update(context.driver, id, updates);
    },
    deleteTournament: (_p, { id }, context) => {
      const user = requireOrganizer(context);
      return tournamentService.remove(context.driver, id, user);
    },

    createCompetition: (_p, { tournamentId, name, order, maxSlots }, { driver }) =>
      competitionService.create(driver, { tournamentId, name, order, maxSlots }),
    updateCompetition: (_p, { competitionId, name, order, maxSlots }, context) => {
      requireOrganizer(context);
      return competitionService.update(context.driver, competitionId, { name, order, maxSlots });
    },

    addStage: (_p, args, { driver }) => stageService.create(driver, args),
    updateStage: (_p, args, context) => {
      requireOrganizer(context);
      return stageService.update(context.driver, args);
    },
    setStageStatus: (_p, { stageId, status }, context) => {
      requireOrganizer(context);
      return stageService.setStatus(context.driver, stageId, status);
    },

    addTransition: (_p, args, { driver }) => advancementService.addTransition(driver, args),
    saveTransitionPlacementSnapshot: (_p, { transitionId, snapshotJson }, context) => {
      requireOrganizer(context);
      return advancementService.savePlacementSnapshot(context.driver, transitionId, snapshotJson);
    },
    deleteTransition: (_p, { transitionId }, context) => {
      requireOrganizer(context);
      return advancementService.deleteTransition(context.driver, transitionId);
    },

    syncStageGroups: (_p, { stageId, totalGroups }, context) => {
      requireOrganizer(context);
      return groupService.syncStageGroups(context.driver, stageId, totalGroups);
    },
    assignInscriptionToGroup: (_p, args, context) => {
      requireOrganizer(context);
      return groupService.assignInscriptionToGroup(context.driver, args);
    },

    generateLeagueRoundRobin: (_p, { stageId, doubleRound, maxRounds }, context) => {
      requireOrganizer(context);
      return fixtureService.generateLeagueRoundRobin(context.driver, stageId, doubleRound, maxRounds);
    },
    generateSingleEliminationBracket: (_p, { stageId, doubleRound }, context) => {
      requireOrganizer(context);
      return fixtureService.generateSingleEliminationBracket(context.driver, stageId, doubleRound);
    },
    generateGroupsStageRoundRobin: (_p, { stageId, doubleRound, maxRounds }, context) => {
      requireOrganizer(context);
      return fixtureService.generateGroupsStageRoundRobin(context.driver, stageId, doubleRound, maxRounds);
    },
    trimEliminationBracketAfterRound: (_p, { stageId, tournamentId, lastRoundInclusive }, context) => {
      requireOrganizer(context);
      return fixtureService.trimEliminationBracketAfterRound(context.driver, stageId, tournamentId, lastRoundInclusive);
    },
    hydrateEliminationFirstRoundFromRoster: (_p, { stageId }, context) => {
      requireOrganizer(context);
      return fixtureService.hydrateEliminationFirstRoundFromRoster(context.driver, stageId);
    },

    assignInscriptionToMatchSlot: (_p, args, context) => {
      requireOrganizer(context);
      return matchService.assignInscriptionToMatchSlot(context.driver, args);
    },
    updateMatchScheduling: (_p, args, context) => {
      requireOrganizer(context);
      return matchService.updateMatchScheduling(context.driver, args);
    },
    updateMatchDateTime: (_p, args, context) => {
      requireOrganizer(context);
      return matchService.updateMatchDateTime(context.driver, args);
    },
    setMatchWinnerAdvancement: (_p, args, context) => {
      requireOrganizer(context);
      return matchService.setMatchWinnerAdvancement(context.driver, args);
    },
    updateMatchResult: (_p, args, context) => {
      requireOrganizer(context);
      return matchService.updateMatchResult(context.driver, args);
    },

    assignInscriptionToStage: (_p, { stageId, inscriptionId, tournamentId, displayName, force, seedOrder }, context) => {
      requireOrganizer(context);
      return stageService.assignInscription(context.driver, stageId, tournamentId, inscriptionId, displayName, force, seedOrder);
    },
    unassignInscriptionFromStage: (_p, { stageId, inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      return stageService.unassignInscription(context.driver, stageId, tournamentId, inscriptionId);
    },
    clearInscriptionAssignments: (_p, { inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      return stageService.clearAssignments(context.driver, tournamentId, inscriptionId);
    },
  },

  Tournament: {
    competitions: (parent, _args, { driver }) => tournamentService.getCompetitions(driver, parent.id),
  },

  Competition: {
    maxSlots: (parent) => (parent.maxSlots != null ? Number(parent.maxSlots) : null),
    effectiveMaxSlots: (parent, _args, { driver }) => competitionService.getEffectiveMaxSlots(driver, parent.id),
    stages: (parent, _args, { driver }) => competitionService.getStages(driver, parent.id),
  },

  Stage: {
    stageStatus: (parent, _args, { driver }) => stageService.getStageStatus(driver, parent),
    isInitial: (parent, _args, { driver }) => stageService.isInitial(driver, parent.id),
    assignedInscriptions: (parent, _args, { driver }) => stageService.getAssignedInscriptions(driver, parent.id),
    standings: (parent, _args, { driver }) =>
      parent.format === 'elimination' ? [] : standingsService.getStageStandings(driver, parent.id),
    transitions: (parent, _args, { driver }) => advancementService.getStageTransitions(driver, parent.id),
    groups: (parent, _args, { driver }) => groupService.getStageGroups(driver, parent.id),
    keys: (parent, _args, { driver }) => keyService.getStageKeys(driver, parent.id),
    matches: (parent, _args, { driver }) => matchService.getStageMatches(driver, parent.id),
  },

  Group: {
    competitorIds: (parent, _args, { driver }) => groupService.getCompetitorIds(driver, parent.id),
    competitors: (parent, _args, { driver }) => groupService.getCompetitors(driver, parent.id),
    assignedInscriptions: (parent, _args, { driver }) => groupService.getAssignedInscriptions(driver, parent.id),
    standings: (parent, _args, { driver }) => standingsService.getGroupStandings(driver, parent.id),
    capacity: (parent, _args, { driver }) => groupService.getCapacity(driver, parent.id),
    matches: (parent, _args, { driver }) => matchService.getGroupMatches(driver, parent.id),
  },

  Match: {
    matchKind: (parent) => (parent.matchKind != null ? String(parent.matchKind) : null),
    homeCompetitor: (parent, _args, { driver }) =>
      matchService.getMatchCompetitor(driver, parent.id, 'home', parent.homeInscriptionId),
    awayCompetitor: (parent, _args, { driver }) =>
      matchService.getMatchCompetitor(driver, parent.id, 'away', parent.awayInscriptionId),
    homeAssignedInscription: (parent) => {
      if (!parent.homeInscriptionId) return null;
      return {
        inscriptionId: String(parent.homeInscriptionId),
        tournamentId: parent.homeTournamentId ?? '',
        displayName: parent.homeDisplayName ?? String(parent.homeInscriptionId),
      };
    },
    awayAssignedInscription: (parent) => {
      if (!parent.awayInscriptionId) return null;
      return {
        inscriptionId: String(parent.awayInscriptionId),
        tournamentId: parent.awayTournamentId ?? '',
        displayName: parent.awayDisplayName ?? String(parent.awayInscriptionId),
      };
    },
  },

  Key: {
    groupIds: (parent, _args, { driver }) => keyService.getGroupIds(driver, parent.id),
  },
};

export default resolvers;
