import type { StandingsRow, TournamentMatchRow, TournamentStage, TournamentTransition } from './types';

export type AutoAdvanceTeam = {
  inscriptionId: string;
  displayName: string;
};

type TransitionLike = Pick<
  TournamentTransition,
  'selectionKind' | 'topN' | 'rangeFrom' | 'rangeTo' | 'bottomN'
>;

type SourceStageLike = Pick<TournamentStage, 'format' | 'standings' | 'groups' | 'matches'>;

function pickFromStandings(
  standings: StandingsRow[],
  tr: TransitionLike
): AutoAdvanceTeam[] {
  const kind = String(tr.selectionKind || 'top').toLowerCase();
  const sorted = [...standings].sort((a, b) => Number(a.position) - Number(b.position));

  if (kind === 'top') {
    const n = Number(tr.topN) || 0;
    return sorted
      .filter((r) => Number(r.position) >= 1 && Number(r.position) <= n)
      .map((r) => ({
        inscriptionId: String(r.inscriptionId),
        displayName: String(r.displayName || r.inscriptionId),
      }));
  }

  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    if (from <= 0 || to < from) return [];
    return sorted
      .filter((r) => Number(r.position) >= from && Number(r.position) <= to)
      .map((r) => ({
        inscriptionId: String(r.inscriptionId),
        displayName: String(r.displayName || r.inscriptionId),
      }));
  }

  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    return sorted.slice(-b).map((r) => ({
      inscriptionId: String(r.inscriptionId),
      displayName: String(r.displayName || r.inscriptionId),
    }));
  }

  return [];
}

function pickBestNFromGroups(
  groups: NonNullable<TournamentStage['groups']>,
  tr: TransitionLike
): AutoAdvanceTeam[] {
  const count = Number(tr.topN) || 0;
  const fromPos = Number(tr.rangeFrom) || 0;
  if (count <= 0 || fromPos <= 0) return [];

  const candidates = groups.flatMap((g) =>
    (g.standings || []).filter((r) => Number(r.position) === fromPos)
  );

  candidates.sort((a, b) =>
    b.points !== a.points
      ? b.points - a.points
      : b.goalDifference !== a.goalDifference
        ? b.goalDifference - a.goalDifference
        : b.goalsFor - a.goalsFor
  );

  return candidates.slice(0, count).map((r) => ({
    inscriptionId: String(r.inscriptionId),
    displayName: String(r.displayName || r.inscriptionId),
  }));
}

/**
 * Equipos que avanzan al destino según la transición y el estado final de la etapa origen.
 */
export function computeAutoAdvance(sourceStage: SourceStageLike, tr: TransitionLike): AutoAdvanceTeam[] {
  const kind = String(tr.selectionKind || 'top').toLowerCase();
  const fmt = String(sourceStage.format || '').toLowerCase();

  if (fmt === 'league') {
    return pickFromStandings(sourceStage.standings || [], tr);
  }

  if (fmt === 'groups') {
    if (kind === 'bestn') {
      return pickBestNFromGroups(sourceStage.groups || [], tr);
    }

    const seen = new Set<string>();
    const result: AutoAdvanceTeam[] = [];
    for (const group of sourceStage.groups || []) {
      for (const row of pickFromStandings(group.standings || [], tr)) {
        if (!seen.has(row.inscriptionId)) {
          seen.add(row.inscriptionId);
          result.push(row);
        }
      }
    }
    return result;
  }

  if (fmt === 'elimination') {
    const maxRoundWon: Record<string, { round: number; displayName: string }> = {};
    for (const m of (sourceStage.matches || []) as TournamentMatchRow[]) {
      const status = String(m.status ?? '').toLowerCase();
      if (status !== 'finished' && status !== 'completed') continue;
      const hs = Number(m.homeScore ?? 0);
      const as_ = Number(m.awayScore ?? 0);
      if (hs === as_) continue;
      const round = Number(m.round ?? 1);
      const isHomeWinner = hs > as_;
      const winnerId = isHomeWinner
        ? m.homeAssignedInscription?.inscriptionId
        : m.awayAssignedInscription?.inscriptionId;
      const winnerDisplay = isHomeWinner
        ? (m.homeAssignedInscription?.displayName ?? '')
        : (m.awayAssignedInscription?.displayName ?? '');
      if (!winnerId || winnerId.startsWith('liga360-slot:') || winnerId.startsWith('pos:')) continue;
      if (!maxRoundWon[winnerId] || maxRoundWon[winnerId].round < round) {
        maxRoundWon[winnerId] = { round, displayName: winnerDisplay };
      }
    }
    const sorted = Object.entries(maxRoundWon)
      .sort((a, b) => b[1].round - a[1].round)
      .map(([inscriptionId, info]) => ({ inscriptionId, displayName: info.displayName }));

    if (kind === 'top') {
      const n = Number(tr.topN) || 0;
      return sorted.slice(0, n);
    }
    if (kind === 'range') {
      const from = Number(tr.rangeFrom) || 0;
      const to = Number(tr.rangeTo) || 0;
      if (from <= 0 || to < from) return [];
      return sorted.slice(from - 1, to);
    }
    if (kind === 'bottom') {
      const b = Number(tr.bottomN) || 0;
      return sorted.slice(-b);
    }
    return [];
  }

  return [];
}

function isPhysicalAutoAdvanceId(raw: string): boolean {
  const id = String(raw || '').trim();
  return !!id && !id.startsWith('liga360-slot:') && !id.startsWith('pos:');
}

/**
 * Agrupa clasificados por etapa destino y deduplica inscripciones físicas
 * (p. ej. top 2 por grupo + mejores terceros hacia la misma eliminatoria).
 */
export function collectAutoAdvancePlacementsByDest(
  sourceStage: SourceStageLike,
  transitions: ReadonlyArray<{ toStageId?: string | null } & TransitionLike>
): Map<string, AutoAdvanceTeam[]> {
  const byDest = new Map<string, Map<string, AutoAdvanceTeam>>();

  for (const tr of transitions) {
    const destId = String(tr.toStageId ?? '').trim();
    if (!destId) continue;
    if (!byDest.has(destId)) byDest.set(destId, new Map());
    const bucket = byDest.get(destId)!;
    for (const row of computeAutoAdvance(sourceStage, tr)) {
      const id = String(row.inscriptionId ?? '').trim();
      if (!isPhysicalAutoAdvanceId(id)) continue;
      if (!bucket.has(id)) bucket.set(id, row);
    }
  }

  const out = new Map<string, AutoAdvanceTeam[]>();
  for (const [destId, bucket] of byDest) {
    out.set(destId, [...bucket.values()]);
  }
  return out;
}
