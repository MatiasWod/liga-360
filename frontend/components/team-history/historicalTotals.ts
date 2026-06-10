/**
 * Helpers puros para historial de equipo y mano a mano (sin React ni fetch).
 * Solo cuentan partidos finalizados; excluyen inscripciones sintéticas (pos:, liga360-slot:).
 */
import type { HistoricalMatchRow } from '../../services/tournaments/matchesByInscriptions';

export interface InscriptionRef {
  id: number;
  tournament_id: string;
  competition_id?: string | null;
  display_name: string;
  status?: string;
}

export interface HistoricalTotals {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface TournamentBreakdownRow extends HistoricalTotals {
  tournamentId: string;
  tournamentName: string;
  competitionId: string | null;
  displayName: string;
}

export interface HeadToHeadSummary extends HistoricalTotals {
  /** Victorias del equipo consultado sobre el rival. */
  myWins: number;
  draws: number;
  /** Victorias del rival sobre el equipo consultado. */
  rivalWins: number;
}

const EMPTY: HistoricalTotals = {
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  points: 0,
};

export function isPhysicalInscriptionId(raw: string | number | null | undefined): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (s.startsWith('liga360-slot:')) return false;
  if (s.startsWith('pos:')) return false;
  return true;
}

function isFinished(status: string | null | undefined): boolean {
  const s = String(status || '').toLowerCase();
  return s === 'finished' || s === 'completed';
}

function sideInscriptionId(match: HistoricalMatchRow, side: 'home' | 'away'): number | null {
  const assigned = side === 'home' ? match.homeAssignedInscription : match.awayAssignedInscription;
  const raw = assigned?.inscriptionId ?? null;
  if (!isPhysicalInscriptionId(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function accumulateRow(
  row: HistoricalTotals,
  gf: number,
  gc: number
): void {
  row.played += 1;
  row.goalsFor += gf;
  row.goalsAgainst += gc;
  if (gf > gc) {
    row.won += 1;
    row.points += 3;
  } else if (gf < gc) {
    row.lost += 1;
  } else {
    row.drawn += 1;
    row.points += 1;
  }
}

/** Totales acumulados + desglose por torneo/competencia desde partidos finalizados. */
export function computeHistoricalTotals(
  matches: HistoricalMatchRow[],
  inscriptionIds: number[],
  inscriptions: InscriptionRef[] = []
): { totals: HistoricalTotals; byTournament: TournamentBreakdownRow[] } {
  const idSet = new Set(inscriptionIds.map(Number).filter((n) => n > 0));
  const byKey = new Map<string, TournamentBreakdownRow>();

  for (const m of matches) {
    if (!isFinished(m.status)) continue;
    const homeId = sideInscriptionId(m, 'home');
    const awayId = sideInscriptionId(m, 'away');
    if (homeId == null || awayId == null) continue;
    let teamSide: 'home' | 'away' | null = null;
    if (idSet.has(homeId)) teamSide = 'home';
    else if (idSet.has(awayId)) teamSide = 'away';
    else continue;

    const hs = Number(m.homeScore ?? 0);
    const as = Number(m.awayScore ?? 0);
    const gf = teamSide === 'home' ? hs : as;
    const gc = teamSide === 'home' ? as : hs;
    const myId = teamSide === 'home' ? homeId! : awayId!;
    const tid = String(m.tournamentId || '');
    const cid = m.competitionId ?? null;
    const key = `${tid}|${cid ?? ''}`;
    const ins = inscriptions.find((i) => Number(i.id) === myId);
    const row = byKey.get(key) ?? {
      tournamentId: tid,
      tournamentName: m.tournamentName || tid,
      competitionId: cid,
      displayName: ins?.display_name || assignedName(m, teamSide),
      ...{ ...EMPTY },
    };
    accumulateRow(row, gf, gc);
    byKey.set(key, row);
  }

  const byTournament = [...byKey.values()].sort((a, b) =>
    a.tournamentName.localeCompare(b.tournamentName)
  );
  const totals = byTournament.reduce(
    (acc, r) => ({
      played: acc.played + r.played,
      won: acc.won + r.won,
      drawn: acc.drawn + r.drawn,
      lost: acc.lost + r.lost,
      goalsFor: acc.goalsFor + r.goalsFor,
      goalsAgainst: acc.goalsAgainst + r.goalsAgainst,
      points: acc.points + r.points,
    }),
    { ...EMPTY }
  );
  return { totals, byTournament };
}

function assignedName(match: HistoricalMatchRow, side: 'home' | 'away'): string {
  const a = side === 'home' ? match.homeAssignedInscription : match.awayAssignedInscription;
  return a?.displayName || '';
}

/** Cruces entre dos conjuntos de inscripciones (solo finalizados, ambos lados físicos). */
export function filterHeadToHeadMatches(
  matches: HistoricalMatchRow[],
  myIds: number[],
  rivalIds: number[]
): HistoricalMatchRow[] {
  const mine = new Set(myIds.map(Number));
  const rivals = new Set(rivalIds.map(Number));
  return matches.filter((m) => {
    if (!isFinished(m.status)) return false;
    const h = sideInscriptionId(m, 'home');
    const a = sideInscriptionId(m, 'away');
    if (h == null || a == null) return false;
    return (mine.has(h) && rivals.has(a)) || (mine.has(a) && rivals.has(h));
  });
}

/** Resumen W/D/L del equipo consultado frente al rival. */
export function computeHeadToHeadSummary(
  matches: HistoricalMatchRow[],
  myIds: number[],
  rivalIds: number[]
): HeadToHeadSummary {
  const mine = new Set(myIds.map(Number));
  const h2h = filterHeadToHeadMatches(matches, myIds, rivalIds);
  const summary: HeadToHeadSummary = { ...EMPTY, myWins: 0, draws: 0, rivalWins: 0 };

  for (const m of h2h) {
    const h = sideInscriptionId(m, 'home')!;
    const a = sideInscriptionId(m, 'away')!;
    const hs = Number(m.homeScore ?? 0);
    const as = Number(m.awayScore ?? 0);
    const myHome = mine.has(h);
    const gf = myHome ? hs : as;
    const gc = myHome ? as : hs;
    accumulateRow(summary, gf, gc);
    if (gf > gc) summary.myWins += 1;
    else if (gf < gc) summary.rivalWins += 1;
    else summary.draws += 1;
  }
  return summary;
}

/** Extrae ids de inscripción rival (oponente) desde partidos del equipo. */
export function extractOpponentInscriptionIds(
  matches: HistoricalMatchRow[],
  myIds: number[]
): number[] {
  const mine = new Set(myIds.map(Number));
  const opponents = new Set<number>();
  for (const m of matches) {
    const h = sideInscriptionId(m, 'home');
    const a = sideInscriptionId(m, 'away');
    if (h != null && mine.has(h) && a != null) opponents.add(a);
    if (a != null && mine.has(a) && h != null) opponents.add(h);
  }
  return [...opponents];
}
