import type { CompetitionMeta } from '../components/CompetitionsBuilder';
import {
  collectRemovedTransitionIds,
  mapStageKindToFormat,
  selectionToVariables,
  strOrNull,
} from './tournamentMapping';
import {
  createCompetition,
  createStage,
  createTransition,
  generateEliminationBracket,
  updateCompetition,
  updateStage,
} from './tournamentStructureApi';
import { trimEliminationBracketAfterRound } from '../../../services/tournaments/configuration';

export async function persistTournamentStructure(params: {
  tournamentId: string;
  competitions: CompetitionMeta[];
  isEdit?: boolean;
  existingCompetitionIds?: Set<string>;
  existingStageIds?: Set<string>;
  existingTransitionIds?: Set<string>;
}): Promise<void> {
  const {
    tournamentId,
    competitions,
    isEdit = false,
    existingCompetitionIds = new Set<string>(),
    existingStageIds = new Set<string>(),
    existingTransitionIds = new Set<string>(),
  } = params;

  const competitionIdMap = new Map<string, string>();
  const stageIdMap = new Map<string, string>();

  for (let i = 0; i < competitions.length; i++) {
    const comp = competitions[i];
    if (isEdit && existingCompetitionIds.has(comp.id)) {
      const updatedComp = await updateCompetition(comp.id, comp.name, i + 1, comp.maxSlots ?? null);
      competitionIdMap.set(comp.id, updatedComp.id);
    } else {
      const createdComp = await createCompetition(tournamentId, comp.name, i + 1, comp.maxSlots ?? null);
      competitionIdMap.set(comp.id, createdComp.id);
    }
  }

  for (let i = 0; i < competitions.length; i++) {
    const comp = competitions[i];
    const createdCompetitionId = competitionIdMap.get(comp.id);
    if (!createdCompetitionId) continue;
    for (let j = 0; j < (comp.stages ?? []).length; j++) {
      const st = comp.stages[j];
      const format = mapStageKindToFormat(st.kind);
      if (isEdit && existingStageIds.has(st.id)) {
        const updatedStage = await updateStage(
          st.id,
          st.name,
          j + 1,
          format,
          st.config ?? {},
          st.children ?? []
        );
        stageIdMap.set(st.id, updatedStage.id);
      } else {
        const createdStage = await createStage(
          createdCompetitionId,
          st.name,
          j + 1,
          format,
          st.config ?? {},
          st.children ?? []
        );
        stageIdMap.set(st.id, createdStage.id);
        if (format === 'elimination') {
          const cfg = (st.config as Record<string, unknown>) ?? {};
          const numParticipants = Number(cfg.numParticipants);
          if (Number.isInteger(numParticipants) && numParticipants >= 2) {
            const doubleRound = cfg.matchesPerTie === 'double';
            await generateEliminationBracket(createdStage.id, doubleRound);
            const numAdvancing = Number(cfg.numAdvancing);
            if (Number.isInteger(numAdvancing) && numAdvancing > 1 && numParticipants > numAdvancing) {
              const lastRound = Math.round(Math.log2(numParticipants / numAdvancing));
              if (lastRound >= 1) {
                await trimEliminationBracketAfterRound({
                  stageId: createdStage.id,
                  tournamentId,
                  lastRoundInclusive: lastRound,
                });
              }
            }
          }
        }
      }
    }
  }

  for (const comp of competitions) {
    for (const st of comp.stages ?? []) {
      for (const rel of st.relations ?? []) {
        if (isEdit && existingTransitionIds.has(rel.id)) continue;
        const fromId = stageIdMap.get(st.id);
        if (!fromId) continue;

        let toId: string | null = null;
        if (rel.toStageId) {
          toId = stageIdMap.get(rel.toStageId) ?? null;
        } else if (rel.toExternal?.tournamentId === 'this' && rel.toExternal?.stageId) {
          toId = stageIdMap.get(rel.toExternal.stageId) ?? null;
        }

        if (rel.toStageId && !toId) {
          throw new Error(
            `No se pudo resolver la etapa destino para la relación "${rel.label}". Revisá que la etapa siga existiendo.`
          );
        }
        if (rel.toExternal?.tournamentId === 'this' && rel.toExternal?.stageId && !toId) {
          throw new Error(
            `No se pudo resolver el destino entre competiciones para "${rel.label}" (etapa destino no encontrada). Guardá primero todas las etapas y volvé a intentar.`
          );
        }

        const selectionVars = selectionToVariables(rel.selection);
        const extTid = strOrNull(rel.toExternal?.tournamentId ?? null);
        const extSid = strOrNull(rel.toExternal?.stageId ?? null);
        const extName = strOrNull(rel.toExternal?.tournamentName ?? null);
        await createTransition({
          from: fromId,
          to: toId,
          label: rel.label || 'avance',
          selectionKind: rel.selection.kind,
          ...selectionVars,
          toExternalTournamentId: toId ? null : extTid,
          toExternalStageId: toId ? null : extSid,
          toExternalTournamentName: toId ? null : extName,
          carryOverJson: rel.carryOver ? JSON.stringify(rel.carryOver) : null,
          timing: rel.timing ?? 'in_season',
        });
      }
    }
  }
}

export { collectRemovedTransitionIds };
