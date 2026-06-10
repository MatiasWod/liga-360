/**
 * Filtros client-side del historial de equipo (sin React ni fetch).
 */
import type { HistoricalMatchRow } from '../../services/tournaments/matchesByInscriptions';
import type { TournamentBreakdownRow } from './historicalTotals';

export const ALL_FILTER = 'all';
export const UNKNOWN_YEAR = 'unknown';

export interface TeamHistoryViewFilters {
  tournamentId: string;
  year: string;
  search: string;
}

export function matchYearKey(match: Pick<HistoricalMatchRow, 'scheduledAt'>): string {
  const raw = match.scheduledAt;
  if (!raw) return UNKNOWN_YEAR;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return UNKNOWN_YEAR;
  return String(new Date(ts).getFullYear());
}

export function collectYearFilterOptions(
  matches: HistoricalMatchRow[]
): { id: string; label: string }[] {
  const years = new Set<string>();
  for (const m of matches) years.add(matchYearKey(m));
  const numeric = [...years]
    .filter((y) => y !== UNKNOWN_YEAR)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const options = numeric.map((y) => ({ id: String(y), label: String(y) }));
  if (years.has(UNKNOWN_YEAR)) options.push({ id: UNKNOWN_YEAR, label: 'Sin fecha' });
  return options;
}

export function collectTournamentFilterOptions(
  matches: HistoricalMatchRow[]
): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const m of matches) {
    const id = String(m.tournamentId || '');
    if (!id) continue;
    if (!map.has(id)) map.set(id, m.tournamentName || id);
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function historicalMatchSearchText(m: HistoricalMatchRow): string {
  return [
    m.tournamentName,
    m.stageName,
    m.homeAssignedInscription?.displayName,
    m.awayAssignedInscription?.displayName,
    m.round != null ? `fecha ${m.round}` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Filtra partidos históricos por torneo, año calendario y texto libre. */
export function filterHistoricalMatches(
  matches: HistoricalMatchRow[],
  filters: TeamHistoryViewFilters
): HistoricalMatchRow[] {
  const q = normalizeSearch(filters.search);
  return matches.filter((m) => {
    if (filters.tournamentId !== ALL_FILTER && String(m.tournamentId || '') !== filters.tournamentId) {
      return false;
    }
    if (filters.year !== ALL_FILTER && matchYearKey(m) !== filters.year) return false;
    if (q && !historicalMatchSearchText(m).includes(q)) return false;
    return true;
  });
}

export function filterTournamentBreakdownRows(
  rows: TournamentBreakdownRow[],
  filters: Pick<TeamHistoryViewFilters, 'tournamentId' | 'search'>
): TournamentBreakdownRow[] {
  const q = normalizeSearch(filters.search);
  return rows.filter((row) => {
    if (filters.tournamentId !== ALL_FILTER && row.tournamentId !== filters.tournamentId) return false;
    if (!q) return true;
    return [row.tournamentName, row.displayName].join(' ').toLowerCase().includes(q);
  });
}

export function hasActiveTeamHistoryFilters(filters: TeamHistoryViewFilters): boolean {
  return (
    filters.tournamentId !== ALL_FILTER ||
    filters.year !== ALL_FILTER ||
    filters.search.trim().length > 0
  );
}
