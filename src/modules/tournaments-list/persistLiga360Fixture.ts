import type { Match as FxMatch, Round as FxRound } from '../../components/fixture-viewer/types';
import {
  assignInscriptionToMatchSlot,
  updateMatchResultFromViewer as updateMatchResult,
  updateMatchScheduling,
  updateMatchScheduledAt,
} from '../../services/tournaments/configuration';
import type { TournamentMatchRow, TournamentStage } from './types';

export function buildMatchRowMap(stage: TournamentStage): Map<string, TournamentMatchRow> {
  const m = new Map<string, TournamentMatchRow>();
  const add = (list?: TournamentMatchRow[]) => {
    for (const x of list || []) m.set(x.id, x);
  };
  add(stage.matches);
  for (const g of stage.groups || []) add(g.matches);
  return m;
}

/** `lr-1|2` o `gr-1|2` → ronda / pierna */
export function parseLeagueLikeRoundId(roundId: string): { round: number; leg: number } | null {
  const match = roundId.match(/^(?:lr|gr)-(\d+)\|(\d+)$/);
  if (!match) return null;
  return { round: Number(match[1]), leg: Number(match[2]) };
}

function normId(a: string | null | undefined): string | null {
  if (a == null || a === '') return null;
  return String(a);
}

function teamLabelFromTeams(map: Map<string, string>, id: string | null): string {
  if (!id) return '';
  return map.get(id) || id;
}

export type PersistContext = {
  stageId: string;
  tournamentId: string;
  /** id inscripción → nombre para displayName al asignar */
  teamLabels: Map<string, string>;
  canEditResults?: boolean;
};

async function persistMatchDiff(
  prev: TournamentMatchRow | undefined,
  next: FxMatch,
  ctx: PersistContext
): Promise<void> {
  const oldH = normId(prev?.homeAssignedInscription?.inscriptionId);
  const oldA = normId(prev?.awayAssignedInscription?.inscriptionId);
  const newH = normId(next.homeTeamId);
  const newA = normId(next.awayTeamId);

  if (oldH !== newH) {
    await assignInscriptionToMatchSlot({
      stageId: ctx.stageId,
      matchId: next.id,
      slotRole: 'home',
      inscriptionId: newH,
      tournamentId: ctx.tournamentId,
      displayName: newH ? teamLabelFromTeams(ctx.teamLabels, newH) : null,
    });
  }
  if (oldA !== newA) {
    await assignInscriptionToMatchSlot({
      stageId: ctx.stageId,
      matchId: next.id,
      slotRole: 'away',
      inscriptionId: newA,
      tournamentId: ctx.tournamentId,
      displayName: newA ? teamLabelFromTeams(ctx.teamLabels, newA) : null,
    });
  }

  const oldDate = prev?.scheduledAt ?? null;
  const newDate = next.date?.trim() ? next.date : null;
  if (oldDate !== newDate) {
    await updateMatchScheduledAt({
      tournamentId: ctx.tournamentId,
      stageId: ctx.stageId,
      matchId: next.id,
      scheduledAt: newDate,
    });
  }

  if (ctx.canEditResults) {
    const nh = next.homeScore;
    const na = next.awayScore;
    if (nh != null && na != null && Number.isFinite(nh) && Number.isFinite(na)) {
      const hi = Math.trunc(Number(nh));
      const ai = Math.trunc(Number(na));
      if (hi >= 0 && ai >= 0) {
        const oh = prev?.homeScore != null ? Math.trunc(Number(prev.homeScore)) : null;
        const oa = prev?.awayScore != null ? Math.trunc(Number(prev.awayScore)) : null;
        if (oh !== hi || oa !== ai) {
          await updateMatchResult({
            tournamentId: ctx.tournamentId,
            stageId: ctx.stageId,
            matchId: next.id,
            homeScore: hi,
            awayScore: ai,
          });
        }
      }
    }
  }
}

async function persistSchedulingForRounds(
  rounds: FxRound[],
  baseline: Map<string, TournamentMatchRow>,
  ctx: Pick<PersistContext, 'stageId'>
): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  for (const round of rounds) {
    const meta = parseLeagueLikeRoundId(round.id);
    if (!meta) continue;
    round.matches.forEach((m, idx) => {
      const slotIndex = idx + 1;
      const prev = baseline.get(m.id);
      if (!prev) return;
      const pr = prev.round ?? 1;
      const pl = prev.leg ?? 1;
      const psi = prev.slotIndex ?? slotIndex;
      if (pr !== meta.round || pl !== meta.leg || psi !== slotIndex) {
        tasks.push(
          updateMatchScheduling({
            stageId: ctx.stageId,
            matchId: m.id,
            round: meta.round,
            leg: meta.leg,
            slotIndex,
          })
        );
      }
    });
  }
  await Promise.all(tasks);
}

function buildTeamLabels(stage: TournamentStage): Map<string, string> {
  const labels = new Map<string, string>();
  for (const ai of stage.assignedInscriptions || []) {
    labels.set(String(ai.inscriptionId), String(ai.displayName || ai.inscriptionId));
  }
  for (const g of stage.groups || []) {
    for (const ai of g.assignedInscriptions || []) {
      labels.set(String(ai.inscriptionId), String(ai.displayName || ai.inscriptionId));
    }
  }
  return labels;
}

export type PersistFixtureOptions = {
  canEditResults?: boolean;
};

/** Persiste `Round[]` respecto al estado actual de la etapa en servidor (reorden + cupos + horario + marcadores). */
export async function persistFixtureRoundsChange(
  nextRounds: FxRound[],
  stage: TournamentStage,
  tournamentId: string,
  options?: PersistFixtureOptions
): Promise<void> {
  const fmt = String(stage.format || '').toLowerCase();
  if (fmt !== 'league' && fmt !== 'groups') return;

  const baseline = buildMatchRowMap(stage);
  const ctx: PersistContext = {
    stageId: stage.id,
    tournamentId,
    teamLabels: buildTeamLabels(stage),
    canEditResults: options?.canEditResults,
  };

  await persistSchedulingForRounds(nextRounds, baseline, ctx);

  const nextFlat: FxMatch[] = [];
  for (const r of nextRounds) nextFlat.push(...r.matches);

  for (const m of nextFlat) {
    const serverRow = baseline.get(m.id);
    if (!serverRow) continue;
    await persistMatchDiff(serverRow, m, ctx);
  }
}

/** Eliminación: asignación de cupos, horario y marcadores; sin `updateMatchScheduling`. */
export async function persistKnockoutFixtureChange(
  nextRounds: FxRound[],
  stage: TournamentStage,
  tournamentId: string,
  options?: PersistFixtureOptions
): Promise<void> {
  if (String(stage.format || '').toLowerCase() !== 'elimination') return;

  const baseline = buildMatchRowMap(stage);
  const ctx: PersistContext = {
    stageId: stage.id,
    tournamentId,
    teamLabels: buildTeamLabels(stage),
    canEditResults: options?.canEditResults,
  };

  const nextFlat: FxMatch[] = [];
  for (const r of nextRounds) nextFlat.push(...r.matches);

  for (const m of nextFlat) {
    const serverRow = baseline.get(m.id);
    if (!serverRow) continue;
    await persistMatchDiff(serverRow, m, ctx);
  }
}

/** Persiste cambios en todos los grupos (cada uno con sus `Round[]`). */
export async function persistFixtureGroupsChange(
  nextGroups: Array<{ id: string; rounds: FxRound[] }>,
  stage: TournamentStage,
  tournamentId: string,
  options?: PersistFixtureOptions
): Promise<void> {
  for (const g of nextGroups) {
    const subStage: TournamentStage = {
      ...stage,
      format: 'groups',
      matches: [],
      groups: stage.groups?.filter((x) => x.id === g.id) || [],
    };
    await persistFixtureRoundsChange(g.rounds, subStage, tournamentId, options);
  }
}
