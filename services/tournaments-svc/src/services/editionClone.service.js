/** Clona estructura de torneo (competiciones, etapas, transiciones) sin partidos ni inscripciones. */
import { genId } from '../domain/shared/ids.js';
import { stageSubtypeLabelFromFormat } from '../domain/stage/stageConfig.js';
import { isNextEditionTiming } from '../domain/stage/stageTransitionTiming.js';
import * as competitionRepo from '../repositories/competition.repository.js';
import * as stageRepo from '../repositories/stage.repository.js';
import * as transitionRepo from '../repositories/transition.repository.js';
import * as editionCloneRepo from '../repositories/editionClone.repository.js';

function mapStageIds(stageIdMap, rawId) {
  if (!rawId) return null;
  return stageIdMap.get(String(rawId)) ?? null;
}

function remapExternalTarget(transition, sourceTournamentId, newTournamentId, stageIdMap) {
  const extTid = String(transition.toExternalTournamentId ?? '').trim();
  const extSid = String(transition.toExternalStageId ?? '').trim();
  if (!extSid) {
    return {
      toExternalTournamentId: transition.toExternalTournamentId ?? null,
      toExternalStageId: transition.toExternalStageId ?? null,
      toExternalTournamentName: transition.toExternalTournamentName ?? null,
    };
  }
  if (extTid === sourceTournamentId || extTid === 'this') {
    const mapped = mapStageIds(stageIdMap, extSid);
    return {
      toExternalTournamentId: newTournamentId,
      toExternalStageId: mapped ?? extSid,
      toExternalTournamentName: transition.toExternalTournamentName ?? null,
    };
  }
  return {
    toExternalTournamentId: transition.toExternalTournamentId ?? null,
    toExternalStageId: transition.toExternalStageId ?? null,
    toExternalTournamentName: transition.toExternalTournamentName ?? null,
  };
}

export async function cloneTournamentStructure(driver, { sourceTournamentId, newTournamentId }) {
  const session = driver.session();
  try {
    const structure = await editionCloneRepo.loadTournamentStructure(session, sourceTournamentId);
    const competitionIdMap = new Map();
    const stageIdMap = new Map();

    for (const comp of structure.competitions) {
      const newCompId = genId('c');
      competitionIdMap.set(comp.id, newCompId);
      await competitionRepo.create(session, {
        tournamentId: newTournamentId,
        id: newCompId,
        name: comp.name,
        order: comp.order,
        maxSlots: comp.maxSlots,
      });
    }

    for (const stage of structure.stages) {
      const newStageId = genId('s');
      stageIdMap.set(stage.id, newStageId);
      const newCompetitionId = competitionIdMap.get(stage.competitionId);
      if (!newCompetitionId) continue;
      await stageRepo.create(session, {
        id: newStageId,
        competitionId: newCompetitionId,
        name: stage.name,
        order: stage.order,
        format: stage.format,
        configJson: stage.configJson,
        childrenJson: stage.childrenJson,
        subtype: stageSubtypeLabelFromFormat(stage.format),
      });
    }

    for (const tr of structure.transitions) {
      const newTrId = genId('tr');
      const fromStageId = mapStageIds(stageIdMap, tr.fromStageId);
      if (!fromStageId) continue;

      const mappedToStageId = mapStageIds(stageIdMap, tr.toStageId);
      const timing = tr.timing ?? 'in_season';
      const nextEdition = isNextEditionTiming(timing);

      if (mappedToStageId) {
        await transitionRepo.createGeneric(session, {
          id: newTrId,
          fromStageId,
          toStageId: mappedToStageId,
          label: tr.label,
          selectionKind: tr.selectionKind,
          topN: tr.topN,
          rangeFrom: tr.rangeFrom,
          rangeTo: tr.rangeTo,
          bottomN: tr.bottomN,
          carryOverJson: tr.carryOverJson,
          timing,
        });
        if (!nextEdition) {
          await transitionRepo.mergeAdvancesTo(session, fromStageId, mappedToStageId);
        }
      } else {
        const ext = remapExternalTarget(tr, sourceTournamentId, newTournamentId, stageIdMap);
        await transitionRepo.createExternal(session, {
          id: newTrId,
          fromStageId,
          label: tr.label,
          selectionKind: tr.selectionKind,
          topN: tr.topN,
          rangeFrom: tr.rangeFrom,
          rangeTo: tr.rangeTo,
          bottomN: tr.bottomN,
          toExternalTournamentId: ext.toExternalTournamentId,
          toExternalStageId: ext.toExternalStageId,
          toExternalTournamentName: ext.toExternalTournamentName,
          carryOverJson: tr.carryOverJson,
          timing,
        });
      }
    }

    return {
      structure,
      competitionIdMap,
      stageIdMap,
    };
  } finally {
    await session.close();
  }
}
