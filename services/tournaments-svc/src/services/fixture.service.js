/**
 * Generación de calendarios (fixtures): liga round-robin, grupos round-robin y brackets de
 * eliminación, más la hidratación de partidos desde los seeds/orden de inscripciones.
 * Toda lectura/escritura en Neo4j pasa por repositorios; este servicio solo orquesta.
 */
import { genId } from '../domain/shared/ids.js';
import { parseJsonSafe, deriveStageCapacity, deriveGroupsConfig } from '../domain/stage/stageConfig.js';
import {
  singleRoundRobinSchedule,
  doubleRoundRobinFromSingle,
  validateSingleRoundRobin,
} from '../domain/scheduling/roundRobin.js';
import {
  nextPowerOf2,
  eliminationMatchSlots,
  eliminationMaxRound,
  eliminationFixtureCode,
  legsForEliminationSlot,
  resolveEliminationBracketConfig,
  shouldCreateThirdPlaceMatch,
  eliminationFirstRoundBracketPositions,
  THIRD_PLACE_SLOT_INDEX,
} from '../domain/elimination/bracketElimination.js';
import * as stageRepo from '../repositories/stage.repository.js';
import * as matchRepo from '../repositories/match.repository.js';
import * as groupRepo from '../repositories/group.repository.js';
import * as fixtureRepo from '../repositories/fixture.repository.js';

const PARTICIPANT_COUNT_ERROR =
  'BAD_REQUEST: no se pudo determinar el número de participantes (definí numParticipants en la etapa o asigná al menos dos inscripciones a la fase)';

async function resolveFixtureParticipantCount(session, stageId, stageProps) {
  const cfgN = deriveStageCapacity(stageProps);
  const assignedN = await stageRepo.countPhysicalAssignedInscriptions(session, stageId);
  if (assignedN >= 2) return assignedN;
  if (cfgN != null && cfgN >= 2) return cfgN;
  if (assignedN === 1 && cfgN != null && cfgN >= 2) return cfgN;
  return null;
}

function inscriptionAtSeed(teams, seed) {
  if (seed == null || seed === '') return null;
  const idx = Number(seed);
  if (!Number.isInteger(idx) || idx < 0 || idx >= teams.length) return null;
  return teams[idx];
}

async function listGroupsWithOrder(session, stageId) {
  const raw = await groupRepo.listRawByStage(session, stageId);
  return raw.map((g) => ({ id: g.id, order: Number(g.order) || 0 }));
}

// --- Hidratación de seeds → inscripciones reales (lecturas vía fixtureRepo) ---

async function hydrateLeagueMatchesFromSeeds(session, stageId) {
  const teams = await fixtureRepo.loadOrderedStageInscriptions(session, stageId);
  if (teams.length === 0) return;
  const seedMatches = await fixtureRepo.listLeagueSeedMatches(session, stageId);
  for (const m of seedMatches) {
    const home = inscriptionAtSeed(teams, m.lhs);
    const away = inscriptionAtSeed(teams, m.las);
    await matchRepo.setParticipants(session, m.id, { home, away });
  }
}

async function hydrateGroupRoundRobinMatchesFromSeeds(session, stageId) {
  const gids = await fixtureRepo.listDistinctGroupIds(session, stageId);
  for (const gid of gids) {
    if (!gid) continue;
    const teams = await fixtureRepo.loadOrderedGroupInscriptions(session, gid);
    if (teams.length === 0) continue;
    const seedMatches = await fixtureRepo.listGroupSeedMatches(session, stageId, gid);
    for (const m of seedMatches) {
      const home = inscriptionAtSeed(teams, m.lhs);
      const away = inscriptionAtSeed(teams, m.las);
      await matchRepo.setParticipants(session, m.id, { home, away });
    }
  }
}

/**
 * Primera ronda de eliminación: empareja índices de llave clásica (0 vs P-1, 1 vs P-2, …).
 * Si el índice >= n de equipos reales, el slot queda vacío (BYE).
 */
async function hydrateEliminationFirstRoundFromBracket(session, stageId) {
  const teams = await fixtureRepo.loadOrderedStageInscriptions(session, stageId);
  const n = teams.length;
  if (n < 2) return;
  const P = nextPowerOf2(n);
  const firstRound = await fixtureRepo.listFirstRoundMatches(session, stageId);
  for (const rec of firstRound) {
    const slotIndex = Number(rec.si);
    const leg = Number(rec.leg) || 1;
    if (!Number.isFinite(slotIndex) || slotIndex < 1) continue;
    let idxA;
    let idxB;
    try {
      ({ idxA, idxB } = eliminationFirstRoundBracketPositions(P, slotIndex));
    } catch {
      continue;
    }
    const swap = leg === 2;
    const homeIdx = swap ? idxB : idxA;
    const awayIdx = swap ? idxA : idxB;
    const home = homeIdx >= 0 && homeIdx < n ? teams[homeIdx] : null;
    const away = awayIdx >= 0 && awayIdx < n ? teams[awayIdx] : null;
    const matchKind = (home && !away) || (!home && away) ? 'bye' : 'bracket';
    await matchRepo.setParticipants(session, rec.id, { home, away, matchKind });
  }
}

// --- Operaciones públicas ---

export async function ensureEliminationBracket(driver, stageId, totalSlots) {
  const safeTotalSlots = Number(totalSlots);
  if (!Number.isInteger(safeTotalSlots) || safeTotalSlots <= 1) {
    throw new Error('BAD_REQUEST: totalSlots debe ser entero mayor a 1');
  }
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
      throw new Error('BAD_REQUEST: la etapa no es de eliminación');
    }

    const existingCount = await matchRepo.countByStage(session, stageId);
    const requiredMatches = Math.ceil(safeTotalSlots / 2);
    for (let i = existingCount; i < requiredMatches; i += 1) {
      await matchRepo.createEliminationEmpty(session, {
        stageId,
        id: genId('m'),
        slotIndex: i + 1,
        fixtureCode: eliminationFixtureCode(i + 1, 1),
      });
    }
    return await matchRepo.listEliminationOrdered(session, stageId);
  } finally {
    await session.close();
  }
}

export async function generateLeagueRoundRobin(driver, stageId, doubleRound, maxRounds) {
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    if (String(stageProps?.format || '').toLowerCase() !== 'league') {
      throw new Error('BAD_REQUEST: la etapa no es de liga');
    }
    const n = await resolveFixtureParticipantCount(session, stageId, stageProps);
    if (!n || n < 2) throw new Error(PARTICIPANT_COUNT_ERROR);

    const single = singleRoundRobinSchedule(n);
    if (!validateSingleRoundRobin(single, n).ok) {
      throw new Error('INTERNAL: calendario inválido');
    }
    const fullSchedule = doubleRound ? doubleRoundRobinFromSingle(single) : single;
    const half = single.length;
    const maxR = maxRounds != null && Number.isInteger(Number(maxRounds)) && Number(maxRounds) > 0
      ? Math.min(Number(maxRounds), fullSchedule.length)
      : fullSchedule.length;
    const schedule = fullSchedule.slice(0, maxR);

    await matchRepo.deleteByStage(session, stageId);

    for (let r = 0; r < schedule.length; r += 1) {
      const roundNum = r + 1;
      const leg = doubleRound ? (roundNum <= half ? 1 : 2) : 1;
      let slotIndex = 1;
      for (const p of schedule[r]) {
        await matchRepo.createLeague(session, {
          stageId,
          id: genId('m'),
          roundNum,
          leg,
          slotIndex,
          code: `L${roundNum}-M${slotIndex}`,
          lhs: p.homeSeed != null ? Number(p.homeSeed) : null,
          las: p.awaySeed != null ? Number(p.awaySeed) : null,
        });
        slotIndex += 1;
      }
    }

    await hydrateLeagueMatchesFromSeeds(session, stageId);
    return await matchRepo.findByStage(session, stageId);
  } finally {
    await session.close();
  }
}

export async function generateSingleEliminationBracket(driver, stageId, doubleRound) {
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
      throw new Error('BAD_REQUEST: la etapa no es de eliminación');
    }
    const n = await resolveFixtureParticipantCount(session, stageId, stageProps);
    if (!n || n < 2) throw new Error(PARTICIPANT_COUNT_ERROR);

    const P = nextPowerOf2(n);
    const allSlots = eliminationMatchSlots(P);

    const stageCfg = parseJsonSafe(stageProps?.configJson) || {};
    const bracketCfg = resolveEliminationBracketConfig(stageCfg, Boolean(doubleRound));
    const numAdvancing = bracketCfg.numAdvancing;
    let slots = allSlots;
    if (numAdvancing > 1) {
      const maxRounds = Math.round(Math.log2(P / numAdvancing));
      if (maxRounds >= 1) slots = allSlots.filter((s) => s.round <= maxRounds);
    }
    const maxRound = eliminationMaxRound(slots);

    await matchRepo.deleteByStage(session, stageId);

    for (const slot of slots) {
      const slotLegs = legsForEliminationSlot(slot.round, maxRound, bracketCfg);
      for (const leg of slotLegs) {
        const slotDouble = slotLegs.length > 1;
        await matchRepo.createEliminationSlot(session, {
          stageId,
          id: genId('m'),
          round: slot.round,
          leg,
          slotIndex: slot.slotIndex,
          code: eliminationFixtureCode(slot.slotIndex, slot.round, leg, { doubleRound: slotDouble }),
        });
      }
    }

    if (shouldCreateThirdPlaceMatch(maxRound, bracketCfg)) {
      await matchRepo.createThirdPlace(session, {
        stageId,
        id: genId('m'),
        round: maxRound,
        slotIndex: THIRD_PLACE_SLOT_INDEX,
      });
    }

    await hydrateEliminationFirstRoundFromBracket(session, stageId);
    return await matchRepo.listEliminationOrdered(session, stageId);
  } finally {
    await session.close();
  }
}

export async function generateGroupsStageRoundRobin(driver, stageId, doubleRound, maxRounds) {
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    if (String(stageProps?.format || '').toLowerCase() !== 'groups') {
      throw new Error('BAD_REQUEST: la etapa no es de grupos');
    }
    const { teamsPerGroup } = deriveGroupsConfig(stageProps);
    const groups = await listGroupsWithOrder(session, stageId);
    if (groups.length === 0) throw new Error('BAD_REQUEST: la etapa no tiene grupos');

    await matchRepo.deleteByStage(session, stageId);

    for (const g of groups) {
      const gid = g.id;
      const gOrder = g.order;
      const assignedN = await fixtureRepo.countAssignedInscriptionsOnGroup(session, gid);
      const n = assignedN >= 2 ? assignedN : teamsPerGroup >= 2 ? teamsPerGroup : 0;
      if (n < 2) continue;

      const single = singleRoundRobinSchedule(n);
      if (!validateSingleRoundRobin(single, n).ok) continue;
      const fullSchedule = doubleRound ? doubleRoundRobinFromSingle(single) : single;
      const half = single.length;
      const maxR = maxRounds != null && Number.isInteger(Number(maxRounds)) && Number(maxRounds) > 0
        ? Math.min(Number(maxRounds), fullSchedule.length)
        : fullSchedule.length;
      const schedule = fullSchedule.slice(0, maxR);

      for (let r = 0; r < schedule.length; r += 1) {
        const roundNum = r + 1;
        const leg = doubleRound ? (roundNum <= half ? 1 : 2) : 1;
        let slotIndex = 1;
        for (const p of schedule[r]) {
          await matchRepo.createGroup(session, {
            stageId,
            gid,
            id: genId('m'),
            roundNum,
            leg,
            slotIndex,
            code: `G${gOrder}-F${roundNum}-M${slotIndex}`,
            lhs: p.homeSeed != null ? Number(p.homeSeed) : null,
            las: p.awaySeed != null ? Number(p.awaySeed) : null,
          });
          slotIndex += 1;
        }
      }
    }

    await hydrateGroupRoundRobinMatchesFromSeeds(session, stageId);

    const out = await matchRepo.listByStageGroupedOrdered(session, stageId);
    if (out.length === 0) {
      throw new Error(
        'BAD_REQUEST: no se generó ningún partido de grupo (cada grupo necesita al menos 2 equipos por asignación o teamsPerGroup en la config)'
      );
    }
    return out;
  } finally {
    await session.close();
  }
}

export async function trimEliminationBracketAfterRound(driver, stageId, tournamentId, lastRoundInclusive) {
  const L = Number(lastRoundInclusive);
  if (!Number.isFinite(L) || L < 1 || !Number.isInteger(L)) {
    throw new Error('BAD_REQUEST: lastRoundInclusive debe ser entero >= 1');
  }
  const session = driver.session();
  try {
    const props = await stageRepo.findInTournament(session, tournamentId, stageId);
    if (!props) throw new Error('BAD_REQUEST: stage no pertenece al torneo');
    if (String(props?.format || '').toLowerCase() !== 'elimination') {
      throw new Error('BAD_REQUEST: la etapa no es de eliminación');
    }
    await matchRepo.trimAfterRound(session, stageId, L);
    return true;
  } finally {
    await session.close();
  }
}

export async function hydrateEliminationFirstRoundFromRoster(driver, stageId) {
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
      throw new Error('BAD_REQUEST: la etapa no es de eliminación');
    }
    await hydrateEliminationFirstRoundFromBracket(session, stageId);
    return true;
  } finally {
    await session.close();
  }
}
