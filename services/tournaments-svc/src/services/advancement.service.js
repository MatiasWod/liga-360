/** Lógica de negocio de transiciones/avances entre etapas (con chequeo de ciclos y timing). */
import { genId } from '../domain/shared/ids.js';
import { STAGE_CYCLE_ERROR } from '../domain/stage/stageTransitionCycle.js';
import { normalizeTransitionTiming, isNextEditionTiming } from '../domain/stage/stageTransitionTiming.js';
import * as transitionRepo from '../repositories/transition.repository.js';

export async function addTopNTransition(driver, fromStageId, toStageId, topN) {
  const id = genId('tr');
  const session = driver.session();
  try {
    await transitionRepo.pruneOrphanAdvancesToBetweenStages(session, fromStageId, toStageId);
    if (await transitionRepo.hasCycle(session, fromStageId, toStageId)) {
      throw new Error(STAGE_CYCLE_ERROR);
    }
    await transitionRepo.createTopN(session, { id, fromStageId, toStageId, topN });
    return { id, type: 'top', label: 'avance', selectionKind: 'top', topN };
  } finally {
    await session.close();
  }
}

export async function addTransition(driver, args) {
  const {
    fromStageId,
    toStageId,
    label,
    selectionKind,
    topN,
    rangeFrom,
    rangeTo,
    bottomN,
    toExternalTournamentId,
    toExternalStageId,
    toExternalTournamentName,
    carryOverJson,
    timing: timingArg,
  } = args;
  const id = genId('tr');
  const timing = normalizeTransitionTiming(timingArg);
  const nextEdition = isNextEditionTiming(timing);
  const session = driver.session();
  try {
    if (toStageId) {
      if (!nextEdition) {
        await transitionRepo.pruneOrphanAdvancesToBetweenStages(session, fromStageId, toStageId);
        if (await transitionRepo.hasCycle(session, fromStageId, toStageId)) {
          throw new Error(STAGE_CYCLE_ERROR);
        }
      }
      await transitionRepo.createGeneric(session, {
        id, fromStageId, toStageId, label, selectionKind, topN, rangeFrom, rangeTo, bottomN, carryOverJson, timing,
      });
      if (!nextEdition) {
        await transitionRepo.mergeAdvancesTo(session, fromStageId, toStageId);
      }
    } else {
      await transitionRepo.createExternal(session, {
        id, fromStageId, label, selectionKind, topN, rangeFrom, rangeTo, bottomN,
        toExternalTournamentId, toExternalStageId, toExternalTournamentName, carryOverJson, timing,
      });
    }
    return {
      id,
      type: toStageId ? 'generic' : 'external',
      label,
      selectionKind,
      topN: topN ?? null,
      rangeFrom: rangeFrom ?? null,
      rangeTo: rangeTo ?? null,
      bottomN: bottomN ?? null,
      toExternalTournamentId: toExternalTournamentId ?? null,
      toExternalStageId: toExternalStageId ?? null,
      toExternalTournamentName: toExternalTournamentName ?? null,
      carryOverJson: carryOverJson ?? null,
      timing,
      placementSnapshotJson: null,
    };
  } finally {
    await session.close();
  }
}

export async function savePlacementSnapshot(driver, transitionId, snapshotJson) {
  const raw = String(snapshotJson ?? '').trim();
  if (!raw) throw new Error('BAD_REQUEST: snapshotJson requerido');
  try {
    JSON.parse(raw);
  } catch {
    throw new Error('BAD_REQUEST: snapshotJson debe ser JSON válido');
  }
  const session = driver.session();
  try {
    const result = await transitionRepo.savePlacementSnapshot(session, transitionId, raw);
    if (!result) throw new Error('NOT_FOUND: transición no existe');
    return result;
  } finally {
    await session.close();
  }
}

export async function deleteTransition(driver, transitionId) {
  const session = driver.session();
  try {
    const endpoints = await transitionRepo.findEndpoints(session, transitionId);
    if (!endpoints) throw new Error('NOT_FOUND: transición no existe');
    if (endpoints.aid && endpoints.bid) {
      await transitionRepo.deleteAdvancesTo(session, endpoints.aid, endpoints.bid);
    }
    await transitionRepo.detachDelete(session, transitionId);
    return true;
  } finally {
    await session.close();
  }
}

export async function getStageTransitions(driver, stageId) {
  const session = driver.session();
  try {
    return await transitionRepo.findByStage(session, stageId);
  } finally {
    await session.close();
  }
}
