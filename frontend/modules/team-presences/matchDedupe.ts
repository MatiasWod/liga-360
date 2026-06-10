/**
 * Helpers para deduplicar partidos cuando el torneo tiene competiciones/fixtures
 * repetidos (p. ej. re-seed parcial en Neo4j).
 */
import type { TournamentEntity, TournamentMatchRow } from '../tournaments-list/types';
import type { HistoricalMatchRow } from '../../services/tournaments/matchesByInscriptions';

function slotInscriptionId(slot?: { inscriptionId?: string | number | null } | null): number | null {
  const raw = slot?.inscriptionId;
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

type CompLike = {
  stages?: {
    matches?: { status?: string | null }[];
    groups?: { matches?: { status?: string | null }[] }[];
  }[];
};

function countMatchesInCompetition(c: CompLike): number {
  let n = 0;
  for (const s of c.stages || []) {
    n += (s.matches || []).length;
    for (const g of s.groups || []) n += (g.matches || []).length;
  }
  return n;
}

function countFinishedMatchesInCompetition(c: CompLike): number {
  let n = 0;
  for (const s of c.stages || []) {
    for (const m of s.matches || []) {
      const st = String(m.status || '').toLowerCase();
      if (st === 'finished' || st === 'completed') n += 1;
    }
    for (const g of s.groups || []) {
      for (const m of g.matches || []) {
        const st = String(m.status || '').toLowerCase();
        if (st === 'finished' || st === 'completed') n += 1;
      }
    }
  }
  return n;
}

/** true si `next` tiene más datos útiles que `prev` (p. ej. más resultados cargados). */
function isRicherCompetition(next: CompLike, prev: CompLike): boolean {
  const nextFinished = countFinishedMatchesInCompetition(next);
  const prevFinished = countFinishedMatchesInCompetition(prev);
  if (nextFinished !== prevFinished) return nextFinished > prevFinished;
  const nextTotal = countMatchesInCompetition(next);
  const prevTotal = countMatchesInCompetition(prev);
  return nextTotal > prevTotal;
}

/** Una competición por nombre: la más completa (más partidos finalizados, luego más partidos). */
export function dedupeCompetitionsByName<T extends { name: string; order?: number | null; stages?: TournamentEntity['competitions'][number]['stages'] }>(
  competitions: T[]
): T[] {
  const byName = new Map<string, T>();
  for (const c of competitions) {
    const prev = byName.get(c.name);
    if (!prev || isRicherCompetition(c, prev)) {
      byName.set(c.name, c);
    }
  }
  return [...byName.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Clave estable del cruce (inscripciones + ronda), independiente del id Neo4j. */
export function matchFixtureKey(m: {
  id: string;
  round?: number | null;
  leg?: number | null;
  homeAssignedInscription?: { inscriptionId?: string | number | null } | null;
  awayAssignedInscription?: { inscriptionId?: string | number | null } | null;
}): string {
  const home = slotInscriptionId(m.homeAssignedInscription);
  const away = slotInscriptionId(m.awayAssignedInscription);
  const round = m.round ?? 0;
  const leg = m.leg ?? 1;
  if (home != null && away != null) {
    const lo = Math.min(home, away);
    const hi = Math.max(home, away);
    const hs = m.homeScore ?? 'x';
    const as = m.awayScore ?? 'x';
    return `${lo}|${hi}|${round}|${leg}|${hs}|${as}`;
  }
  return `id:${m.id}`;
}

export function dedupeHistoricalMatches(matches: HistoricalMatchRow[]): HistoricalMatchRow[] {
  const seen = new Set<string>();
  const out: HistoricalMatchRow[] = [];
  for (const m of matches) {
    const key = matchFixtureKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export function dedupeTournamentMatches(matches: TournamentMatchRow[]): TournamentMatchRow[] {
  const seen = new Set<string>();
  const out: TournamentMatchRow[] = [];
  for (const m of matches) {
    const key = matchFixtureKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}
