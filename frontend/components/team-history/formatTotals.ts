import type { HistoricalTotals } from './historicalTotals';

export function formatTotalsLine(t: HistoricalTotals): string {
  return `${t.played} PJ · ${t.won} G · ${t.drawn} E · ${t.lost} P · ${t.goalsFor}:${t.goalsAgainst} · ${t.points} pts`;
}
