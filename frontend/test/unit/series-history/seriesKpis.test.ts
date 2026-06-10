import { describe, expect, it } from 'vitest';
import {
  formatKpiNames,
  topScorersFromSeriesRows,
  topTitlesFromRows,
} from '../../../modules/tournaments-list/series/seriesKpis';

describe('seriesKpis', () => {
  it('topScorersFromSeriesRows lista empatados en el máximo', () => {
    const result = topScorersFromSeriesRows([
      { playerKey: 'a', displayName: 'Alpha', goals: 4, identityApproximate: false },
      { playerKey: 'b', displayName: 'Beta', goals: 6, identityApproximate: true },
      { playerKey: 'c', displayName: 'Gamma', goals: 6, identityApproximate: false },
    ]);
    expect(result.goals).toBe(6);
    expect(result.names.sort()).toEqual(['Beta', 'Gamma']);
  });

  it('topTitlesFromRows lista empates en títulos', () => {
    const result = topTitlesFromRows([
      { teamKey: 't1', displayName: 'Alpha', titles: 2, identityApproximate: false },
      { teamKey: 't2', displayName: 'Beta', titles: 3, identityApproximate: true },
      { teamKey: 't3', displayName: 'Gamma', titles: 3, identityApproximate: false },
    ]);
    expect(result.titles).toBe(3);
    expect(result.names.sort()).toEqual(['Beta', 'Gamma']);
  });

  it('formatKpiNames devuelve — sin datos', () => {
    expect(formatKpiNames([], 0, 'goles')).toBe('—');
  });
});
