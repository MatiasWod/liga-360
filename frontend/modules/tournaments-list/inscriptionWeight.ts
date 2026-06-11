import { assignInscriptionToStage } from '../../services/tournaments/configuration';
import type { InscriptionItem } from '../../services/inscriptionsApi';
import type { AssignedInscription, TournamentStage } from './types';

export const NEUTRAL_WEIGHT = 5;

export function effectiveWeight(weight: number | null | undefined): number {
  if (weight == null || !Number.isFinite(weight)) return NEUTRAL_WEIGHT;
  const w = Math.trunc(weight);
  if (w < 1 || w > 10) return NEUTRAL_WEIGHT;
  return w;
}

export type WeightSortable = {
  inscriptionId: string;
  displayName: string;
  weight?: number | null;
};

/** Mayor peso primero; desempate por displayName (es). */
export function sortInscriptionsByWeight<T extends WeightSortable>(items: T[]): T[] {
  return items.slice().sort((a, b) => {
    const diff = effectiveWeight(b.weight) - effectiveWeight(a.weight);
    if (diff !== 0) return diff;
    return a.displayName.localeCompare(b.displayName, 'es', { sensitivity: 'base' });
  });
}

function toWeightEntry(
  assigned: AssignedInscription,
  inscriptionById: ReadonlyMap<string, InscriptionItem>
): WeightSortable {
  const item = inscriptionById.get(String(assigned.inscriptionId));
  return {
    inscriptionId: String(assigned.inscriptionId),
    displayName:
      item?.display_name?.trim() ||
      assigned.displayName?.trim() ||
      `Inscripción ${assigned.inscriptionId}`,
    weight: item?.weight ?? null,
  };
}

async function applySeedOrder(
  stageId: string,
  tournamentId: string,
  entries: WeightSortable[]
): Promise<void> {
  const sorted = sortInscriptionsByWeight(entries);
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    await assignInscriptionToStage({
      stageId,
      tournamentId,
      inscriptionId: entry.inscriptionId,
      displayName: entry.displayName,
      force: true,
      seedOrder: i + 1,
    });
  }
}

/** Sincroniza seedOrder en Neo4j según ponderación Postgres antes de generar fixture. */
export async function applyStageSeedingFromWeights(params: {
  stage: TournamentStage;
  tournamentId: string;
  inscriptionById: ReadonlyMap<string, InscriptionItem>;
}): Promise<void> {
  const { stage, tournamentId, inscriptionById } = params;

  if (stage.format === 'groups') {
    for (const group of stage.groups || []) {
      const entries = (group.assignedInscriptions || []).map((assigned) =>
        toWeightEntry(assigned, inscriptionById)
      );
      if (entries.length > 0) {
        await applySeedOrder(stage.id, tournamentId, entries);
      }
    }
    return;
  }

  const entries = (stage.assignedInscriptions || []).map((assigned) =>
    toWeightEntry(assigned, inscriptionById)
  );
  if (entries.length === 0) return;
  await applySeedOrder(stage.id, tournamentId, entries);
}
