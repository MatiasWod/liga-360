/** Carga una competencia principal con etapas completas para computeFinalPlacements. */
import * as tournamentRepo from '../repositories/tournament.repository.js';
import * as competitionRepo from '../repositories/competition.repository.js';
import * as standingsService from './standings.service.js';
import * as matchService from './match.service.js';
import * as groupService from './group.service.js';

export async function loadPrimaryCompetitionForHistory(driver, tournamentId) {
  const session = driver.session();
  let competitions;
  let stages;
  try {
    competitions = await tournamentRepo.findCompetitions(session, tournamentId);
    if (!competitions?.length) return null;
    const primary = [...competitions].sort((a, b) => Number(a.order) - Number(b.order))[0];
    stages = await competitionRepo.findStages(session, primary.id);
  } finally {
    await session.close();
  }
  const primary = [...competitions].sort((a, b) => Number(a.order) - Number(b.order))[0];
  const loadedStages = [];
  for (const stage of stages) {
    const format = String(stage.format || '').toLowerCase();
    const row = {
      id: stage.id,
      name: stage.name,
      order: stage.order,
      format,
      standings: [],
      matches: [],
      groups: [],
    };
    if (format === 'elimination') {
      row.matches = await matchService.getStageMatches(driver, stage.id);
      row.matches = row.matches.map(mapMatchForHistory);
    } else if (format === 'groups') {
      const groups = await groupService.getStageGroups(driver, stage.id);
      row.groups = await Promise.all(
        groups.map(async (g) => ({
          id: g.id,
          name: g.name,
          order: g.order,
          standings: await standingsService.getGroupStandings(driver, g.id),
          matches: (await matchService.getGroupMatches(driver, g.id)).map(mapMatchForHistory),
        }))
      );
    } else {
      row.standings = await standingsService.getStageStandings(driver, stage.id);
      row.matches = (await matchService.getStageMatches(driver, stage.id)).map(mapMatchForHistory);
    }
    loadedStages.push(row);
  }
  return { id: primary.id, name: primary.name, order: primary.order, stages: loadedStages };
}

function mapMatchForHistory(m) {
  return {
    id: m.id,
    round: m.round,
    leg: m.leg,
    slotIndex: m.slotIndex,
    fixtureCode: m.fixtureCode,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    matchKind: m.matchKind,
    homeAssignedInscription: m.homeInscriptionId
      ? {
          inscriptionId: String(m.homeInscriptionId),
          displayName: String(m.homeDisplayName || m.homeInscriptionId),
        }
      : null,
    awayAssignedInscription: m.awayInscriptionId
      ? {
          inscriptionId: String(m.awayInscriptionId),
          displayName: String(m.awayDisplayName || m.awayInscriptionId),
        }
      : null,
  };
}
