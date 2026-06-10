import { describe, expect, it } from 'vitest';
import type { HistoricalMatchRow } from '../../../services/tournaments/matchesByInscriptions';
import {
  ALL_FILTER,
  collectYearFilterOptions,
  filterHistoricalMatches,
  matchYearKey,
} from '../../../components/team-history/teamHistoryFilters';

function match(overrides: Partial<HistoricalMatchRow> = {}): HistoricalMatchRow {
  return {
    id: 'm1',
    status: 'finished',
    homeScore: 1,
    awayScore: 0,
    tournamentId: 't1',
    tournamentName: 'Liga Demo',
    homeAssignedInscription: { inscriptionId: '10', tournamentId: 't1', displayName: 'Alpha' },
    awayAssignedInscription: { inscriptionId: '20', tournamentId: 't1', displayName: 'Beta' },
    ...overrides,
  };
}

describe('teamHistoryFilters', () => {
  it('extrae año desde scheduledAt', () => {
    expect(matchYearKey({ scheduledAt: '2026-06-01T12:00:00.000Z' })).toBe('2026');
    expect(matchYearKey({ scheduledAt: null })).toBe('unknown');
  });

  it('collectYearFilterOptions incluye Sin fecha', () => {
    const opts = collectYearFilterOptions([
      match({ scheduledAt: '2026-06-15T12:00:00.000Z' }),
      match({ id: 'm2', scheduledAt: null }),
    ]);
    expect(opts.some((o) => o.id === '2026')).toBe(true);
    expect(opts.some((o) => o.id === 'unknown')).toBe(true);
  });

  it('filterHistoricalMatches filtra por torneo, año y búsqueda', () => {
    const rows = [
      match({ id: 'm1', tournamentId: 't1', scheduledAt: '2026-03-01T00:00:00.000Z' }),
      match({
        id: 'm2',
        tournamentId: 't2',
        tournamentName: 'Copa Demo',
        scheduledAt: '2025-01-01T00:00:00.000Z',
        awayAssignedInscription: { inscriptionId: '30', tournamentId: 't2', displayName: 'Gamma' },
      }),
    ];
    expect(
      filterHistoricalMatches(rows, {
        tournamentId: 't2',
        year: ALL_FILTER,
        search: '',
      })
    ).toHaveLength(1);

    expect(
      filterHistoricalMatches(rows, {
        tournamentId: ALL_FILTER,
        year: '2026',
        search: '',
      })
    ).toHaveLength(1);

    expect(
      filterHistoricalMatches(rows, {
        tournamentId: ALL_FILTER,
        year: ALL_FILTER,
        search: 'gamma',
      })
    ).toHaveLength(1);
  });
});
