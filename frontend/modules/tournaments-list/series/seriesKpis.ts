import type { SeriesScorerEntry, SeriesTitleEntry } from '../../../services/tournaments/series';

const NOT_AVAILABLE = '—';

/** Empates en el máximo de goles (> 0). */
export function topScorersFromSeriesRows(rows: SeriesScorerEntry[]): { names: string[]; goals: number } {
  const maxGoals = rows.reduce((acc, r) => Math.max(acc, Number(r.goals) || 0), 0);
  if (maxGoals <= 0) return { names: [], goals: 0 };
  return {
    names: rows.filter((r) => Number(r.goals) === maxGoals).map((r) => r.displayName),
    goals: maxGoals,
  };
}

/** Empates en el máximo de títulos (> 0). */
export function topTitlesFromRows(rows: SeriesTitleEntry[]): { names: string[]; titles: number } {
  const maxTitles = rows.reduce((acc, r) => Math.max(acc, Number(r.titles) || 0), 0);
  if (maxTitles <= 0) return { names: [], titles: 0 };
  return {
    names: rows.filter((r) => Number(r.titles) === maxTitles).map((r) => r.displayName),
    titles: maxTitles,
  };
}

export function formatKpiNames(names: string[], count: number, unit: string): string {
  if (!names.length || count <= 0) return NOT_AVAILABLE;
  return `${names.join(', ')} (${count} ${unit})`;
}
