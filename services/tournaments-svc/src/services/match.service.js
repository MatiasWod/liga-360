/**
 * Lógica de negocio de partidos: creación, reprogramación, asignación de slots, fecha/sede,
 * transición de ganador, y carga de resultado con auto-avance del bracket de eliminación.
 */
import {
  normalizeInscriptionId,
  isSyntheticSlotInscriptionId,
  deriveStageCapacity,
  parseJsonSafe,
} from '../domain/stage/stageConfig.js';
import { isPhysicalInscriptionId, isPlaceholderParticipantLabel } from '../domain/shared/participantLabels.js';
import { isMatchFinishedStatus } from '../domain/match/matchUtils.js';
import {
  isThirdPlaceMatchProps,
  resolveEliminationBracketConfig,
  shouldCreateThirdPlaceMatch,
} from '../domain/elimination/bracketElimination.js';
import { findPersistableWinnerFromLegs } from '../domain/match/seriesResult.js';
import {
  buildWinnerSlotRefs,
  defaultBracketAdvanceTarget,
  resolveAdvanceRoleForLeg,
} from '../domain/elimination/eliminationAdvance.js';
import { assertStageAllowsMatchResults } from '../domain/stage/stageStatus.js';
import * as teamsClient from '../clients/teams.client.js';
import {
  resolveMatchRefs,
  resolvePositionRef,
  resolveEliminationSeriesWinnerFromResolvedLegs,
  resolveEliminationSeriesLoserFromResolvedLegs,
} from '../repositories/matchResolution.repository.js';
import {
  findRefBasedAdvanceTargets,
  syncEliminationDoubleLegPair,
  assertEliminationPhysicalNotDuplicateElsewhere,
} from '../repositories/elimination.repository.js';
import * as matchRepo from '../repositories/match.repository.js';
import * as stageRepo from '../repositories/stage.repository.js';
import * as groupRepo from '../repositories/group.repository.js';
import * as competitorRepo from '../repositories/competitor.repository.js';
import * as transitionRepo from '../repositories/transition.repository.js';

export async function updateMatchScheduling(driver, { stageId, matchId, round, leg, slotIndex }) {
  const session = driver.session();
  try {
    const found = await matchRepo.findInStageWithStage(session, stageId, matchId);
    if (!found) throw new Error('BAD_REQUEST: partido no encontrado en la etapa');
    const stageFmt = String(found.stage?.format || '').toLowerCase();
    if (!['league', 'groups'].includes(stageFmt)) {
      throw new Error('BAD_REQUEST: solo liga o grupos admiten reordenar fechas');
    }
    const gid = found.match.groupId ?? null;
    const rNum = Number(round);
    const lNum = Number(leg);
    const siNum = Number(slotIndex);
    if (!Number.isFinite(rNum) || rNum < 1) throw new Error('BAD_REQUEST: round inválido');
    if (!Number.isFinite(lNum) || lNum < 1) throw new Error('BAD_REQUEST: leg inválido');
    if (!Number.isFinite(siNum) || siNum < 1) throw new Error('BAD_REQUEST: slotIndex inválido');

    let fixtureCode = found.match.fixtureCode ?? null;
    if (stageFmt === 'league') {
      fixtureCode = `L${rNum}-M${siNum}`;
    } else if (stageFmt === 'groups' && gid) {
      const group = await groupRepo.findInStage(session, stageId, gid);
      const ord = Number(group?.order ?? 0);
      fixtureCode = `G${ord}-F${rNum}-M${siNum}`;
    } else {
      throw new Error('BAD_REQUEST: partido de grupo sin groupId');
    }

    await matchRepo.updateScheduling(session, matchId, rNum, lNum, siNum, fixtureCode);
    return true;
  } finally {
    await session.close();
  }
}

export async function updateMatchDateTime(driver, { matchId, scheduledAt, venue, referee }) {
  const session = driver.session();
  try {
    const existing = await matchRepo.findRawById(session, matchId);
    if (!existing) throw new Error('NOT_FOUND: match no existe');
    await matchRepo.updateDateTime(session, matchId, scheduledAt, venue, referee);
    const mp = await matchRepo.findRawById(session, matchId);
    return {
      id: matchId,
      scheduledAt: mp.scheduledAt ?? null,
      venue: mp.venue ?? null,
      referee: mp.referee ?? null,
    };
  } finally {
    await session.close();
  }
}

export async function setMatchWinnerAdvancement(driver, { matchId, transitionId }) {
  const session = driver.session();
  try {
    const meta = await matchRepo.findStageMetaForMatch(session, matchId);
    if (!meta) throw new Error('NOT_FOUND: match no existe o no está enlazado a una etapa');
    const stageId = String(meta.stageId || '');
    const tidNorm = transitionId ? String(transitionId).trim() : '';
    if (!tidNorm) {
      await matchRepo.setAdvancement(session, matchId, null);
    } else {
      const emitted = await transitionRepo.isEmittedByStage(session, stageId, tidNorm);
      if (!emitted) {
        throw new Error('BAD_REQUEST: la transición no está emitida por la etapa de este partido');
      }
      await matchRepo.setAdvancement(session, matchId, tidNorm);
    }
    return await matchRepo.findById(session, matchId);
  } finally {
    await session.close();
  }
}

export async function assignInscriptionToMatchSlot(driver, { stageId, matchId, slotRole, inscriptionId, tournamentId, displayName }) {
  const iidNorm = normalizeInscriptionId(inscriptionId);
  const role = String(slotRole || '').toLowerCase();
  if (!['home', 'away'].includes(role)) throw new Error('BAD_REQUEST: slotRole inválido');
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    const stageFmt = String(stageProps?.format || '').toLowerCase();
    if (!['elimination', 'league', 'groups'].includes(stageFmt)) {
      throw new Error('BAD_REQUEST: la etapa no admite partidos con slots');
    }
    const stageCap = deriveStageCapacity(stageProps);

    const currentMatch = await matchRepo.findInStage(session, stageId, matchId);
    if (!currentMatch) throw new Error('BAD_REQUEST: match no pertenece a la etapa');

    if (!inscriptionId) {
      await matchRepo.clearSlot(session, matchId, role);
      if (stageFmt === 'elimination') {
        await syncEliminationDoubleLegPair(session, stageId, stageProps, matchId);
      }
      return true;
    }

    const currentRound = Number(currentMatch.round ?? 1);
    const currentSlot = Number(currentMatch.slotIndex ?? 0);
    const alreadyInAnother = await matchRepo.existsInscriptionInOtherKey(
      session, stageId, iidNorm, matchId, currentRound, currentSlot
    );
    if (alreadyInAnother) throw new Error('BAD_REQUEST: la inscripción ya está ubicada en otra llave');

    if (stageFmt === 'elimination' && iidNorm) {
      await assertEliminationPhysicalNotDuplicateElsewhere({
        session,
        driver,
        stageId,
        matchId,
        round: currentRound,
        slotIndex: currentSlot,
        candidateInscriptionId: iidNorm,
        resolvePositionRefFn: resolvePositionRef,
      });
    }

    if (
      (role === 'home' && String(currentMatch.awayInscriptionId || '') === iidNorm) ||
      (role === 'away' && String(currentMatch.homeInscriptionId || '') === iidNorm)
    ) {
      throw new Error('BAD_REQUEST: la inscripción no puede ocupar ambos lados de la misma llave');
    }

    if (stageCap && stageCap > 0) {
      const stageCount = await stageRepo.countPhysicalAssignedInscriptions(session, stageId, tournamentId);
      const idAlreadyInMatches = await matchRepo.existsInscriptionInStageMatches(session, stageId, iidNorm);
      const assigningSynthetic = isSyntheticSlotInscriptionId(iidNorm);
      if (!assigningSynthetic && !idAlreadyInMatches && stageCount >= stageCap) {
        throw new Error('STAGE_CAPACITY_REACHED');
      }
    }

    await matchRepo.setSlot(session, matchId, role, iidNorm, displayName, tournamentId);

    if (stageFmt === 'elimination' && inscriptionId) {
      await matchRepo.markBracketIfBothAssigned(session, matchId);
    }
    if (isPhysicalInscriptionId(iidNorm)) {
      const dn = String(displayName || '').trim();
      const safeDn = dn && !isPlaceholderParticipantLabel(dn) ? dn : null;
      await stageRepo.mergeStageInscription(session, { stageId, tournamentId, iid: iidNorm, displayName: safeDn, seedOrder: null });
    }
    if (stageFmt === 'elimination') {
      await syncEliminationDoubleLegPair(session, stageId, stageProps, matchId);
    }
    return true;
  } finally {
    await session.close();
  }
}

/** Dispara recálculo ELO en teams-svc (fire-and-forget vía cliente resiliente). */
async function triggerEloAfterResult(session, matchId, matchProps, finalHomeScore, finalAwayScore) {
  const meta = await matchRepo.findTournamentMetaForMatch(session, matchId);
  if (!meta) return;
  const hid = String(matchProps?.homeInscriptionId ?? '').trim();
  const aid = String(matchProps?.awayInscriptionId ?? '').trim();
  if (!isPhysicalInscriptionId(hid) || !isPhysicalInscriptionId(aid)) return;
  if (finalHomeScore == null || finalAwayScore == null) return;
  void teamsClient.processEloMatch({
    matchId: String(matchId),
    tournamentId: String(meta.tournamentId ?? ''),
    tournamentStatus: String(meta.status ?? ''),
    homeInscriptionId: hid,
    awayInscriptionId: aid,
    homeScore: finalHomeScore,
    awayScore: finalAwayScore,
  });
}

export async function updateMatchResult(driver, { matchId, homeScore, awayScore, status }) {
  const session = driver.session();
  try {
    const m = await matchRepo.findRawById(session, matchId);
    if (!m) throw new Error('NOT_FOUND: match no existe');

    const stageId = await matchRepo.findStageIdForMatch(session, matchId);
    if (stageId) {
      const effectiveStageStatus = await stageRepo.resolveEffectiveStageStatusForMatch(session, matchId);
      assertStageAllowsMatchResults(effectiveStageStatus);
    }

    const homeScoreNum = homeScore != null ? Number(homeScore) : null;
    const awayScoreNum = awayScore != null ? Number(awayScore) : null;
    if (homeScoreNum != null && (!Number.isInteger(homeScoreNum) || homeScoreNum < 0)) {
      throw new Error('BAD_REQUEST: homeScore debe ser entero no negativo');
    }
    if (awayScoreNum != null && (!Number.isInteger(awayScoreNum) || awayScoreNum < 0)) {
      throw new Error('BAD_REQUEST: awayScore debe ser entero no negativo');
    }

    // Normalizar 'completed'/'finished' → 'finished' para que computeStandings lo cuente.
    const rawStatus = status ?? m.status ?? 'scheduled';
    const rawLower = String(rawStatus).toLowerCase();
    const matchStatus = (rawLower === 'completed' || rawLower === 'finished') ? 'finished' : rawStatus;

    await matchRepo.updateResultScores(session, matchId, homeScoreNum, awayScoreNum, matchStatus);

    // Valores finales: si el usuario no envió score, usar el previo del nodo.
    const neoHomeScore = m.homeScore != null ? Number(m.homeScore) : null;
    const neoAwayScore = m.awayScore != null ? Number(m.awayScore) : null;
    const finalHomeScore = homeScoreNum != null ? homeScoreNum : neoHomeScore;
    const finalAwayScore = awayScoreNum != null ? awayScoreNum : neoAwayScore;

    if (matchStatus === 'finished') {
      await propagateEliminationResult(session, driver, matchId);
      await triggerEloAfterResult(session, matchId, m, finalHomeScore, finalAwayScore);
    }

    return {
      id: matchId,
      homeScore: finalHomeScore,
      awayScore: finalAwayScore,
      status: matchStatus,
    };
  } finally {
    await session.close();
  }
}

/** Auto-avance del ganador (y perdedor → tercer puesto) en brackets de eliminación. */
async function propagateEliminationResult(session, driver, matchId) {
  const meta = await matchRepo.findStageMetaForMatch(session, matchId);
  if (!meta || String(meta.format || '').toLowerCase() !== 'elimination') return;
  const stageId = meta.stageId;

  const curMatchMeta = await matchRepo.getMatchAdvanceMeta(session, matchId);
  if (!curMatchMeta) return;
  const { round, slotIndex } = curMatchMeta;
  if (isThirdPlaceMatchProps(curMatchMeta)) return;

  const resolvedLegs = await matchRepo.findLegsByRoundSlot(session, stageId, round, slotIndex);
  for (const leg of resolvedLegs) {
    await resolveMatchRefs(leg, driver);
  }
  if (!resolvedLegs.every((l) => isMatchFinishedStatus(l.status))) return;

  // Ganador → siguiente llave
  const winner = await resolveEliminationSeriesWinnerFromResolvedLegs(driver, resolvedLegs);
  if (winner?.inscriptionId && winner.displayName) {
    const persistable = findPersistableWinnerFromLegs(
      { inscriptionId: winner.inscriptionId, displayName: winner.displayName },
      resolvedLegs
    );
    const winnerId = isPhysicalInscriptionId(persistable?.inscriptionId ?? '')
      ? persistable.inscriptionId
      : winner.inscriptionId;
    const winnerDisplay = persistable?.displayName ?? winner.displayName;
    const winnerTournamentId = persistable?.tournamentId ?? null;

    const legMatchIds = resolvedLegs.map((l) => l.id).filter(Boolean);
    const winnerRefs = buildWinnerSlotRefs(String(stageId), legMatchIds);
    const refTargets = await findRefBasedAdvanceTargets(session, stageId, winnerRefs);

    const persist = (nextMatchId, role) =>
      matchRepo.setSlot(session, nextMatchId, role, winnerId, winnerDisplay, winnerTournamentId);

    if (refTargets.length > 0) {
      for (const target of refTargets) {
        await persist(target.nextMatchId, resolveAdvanceRoleForLeg(target.side, target.leg));
      }
    } else {
      const { nextRound, nextSlotIndex, isHomeInLeg1 } = defaultBracketAdvanceTarget(round, slotIndex);
      const nextMatches = await matchRepo.findNextBracketMatches(session, stageId, nextRound, nextSlotIndex);
      for (const next of nextMatches) {
        const putAsHome = next.leg === 2 ? !isHomeInLeg1 : isHomeInLeg1;
        await persist(next.id, putAsHome ? 'home' : 'away');
      }
    }
  }

  // Perdedor de semifinal → partido de tercer puesto (si está configurado)
  const stageProps = await stageRepo.findRawProps(session, stageId);
  const stageCfg = parseJsonSafe(stageProps?.configJson) || {};
  const bracketCfg = resolveEliminationBracketConfig(stageCfg, false);
  const maxRound = await matchRepo.maxBracketRound(session, stageId);
  const semiRound = maxRound - 1;
  if (
    shouldCreateThirdPlaceMatch(maxRound, bracketCfg) &&
    round === semiRound &&
    (slotIndex === 1 || slotIndex === 2)
  ) {
    const loserPick = await resolveEliminationSeriesLoserFromResolvedLegs(driver, resolvedLegs);
    if (loserPick?.displayName) {
      const persistableLoser = findPersistableWinnerFromLegs(loserPick, resolvedLegs);
      const loserId = isPhysicalInscriptionId(persistableLoser?.inscriptionId ?? '')
        ? persistableLoser.inscriptionId
        : loserPick.inscriptionId;
      const loserDisplay = persistableLoser?.displayName ?? loserPick.displayName;
      const loserTid = persistableLoser?.tournamentId ?? null;
      const role = slotIndex === 1 ? 'home' : 'away';
      await matchRepo.setThirdPlaceParticipant(session, stageId, role, {
        iid: loserId,
        displayName: loserDisplay,
        tournamentId: loserTid,
      });
    }
  }
}

// --- Resolvers de campo de Match / lecturas de partidos por etapa/grupo ---

export async function getStageMatches(driver, stageId) {
  const session = driver.session();
  try {
    const matches = await matchRepo.findByStage(session, stageId);
    await Promise.all(matches.map((mm) => resolveMatchRefs(mm, driver)));
    return matches;
  } finally {
    await session.close();
  }
}

export async function getGroupMatches(driver, groupId) {
  const session = driver.session();
  try {
    const matches = await matchRepo.findByGroup(session, groupId);
    await Promise.all(matches.map((mm) => resolveMatchRefs(mm, driver)));
    return matches;
  } finally {
    await session.close();
  }
}

export async function getMatchCompetitor(driver, matchId, role, inscriptionId) {
  const session = driver.session();
  try {
    return await competitorRepo.findMatchCompetitor(session, matchId, role, inscriptionId);
  } finally {
    await session.close();
  }
}

const MAX_INSCRIPTION_IDS = 200;

/** Partidos públicos por lote de inscripciones físicas (historial / calendario). */
export async function getMatchesByInscriptionIds(driver, ids) {
  const physicalIds = [...new Set(
    (ids || []).map(String).filter((id) => isPhysicalInscriptionId(id))
  )];
  if (physicalIds.length === 0) return [];
  if (physicalIds.length > MAX_INSCRIPTION_IDS) {
    throw new Error(`BAD_REQUEST: maximo ${MAX_INSCRIPTION_IDS} inscripciones por consulta`);
  }
  const session = driver.session();
  try {
    const matches = await matchRepo.findByInscriptionIds(session, physicalIds);
    await Promise.all(matches.map((mm) => resolveMatchRefs(mm, driver)));
    return matches;
  } finally {
    await session.close();
  }
}
