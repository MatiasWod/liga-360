import { describe, expect, it } from 'vitest';
import {
  ALL_FILTER,
  collectYearFilterOptions,
  filterMyStatsBlocks,
  formatMatchesPlayed,
  groupMyEventsByMatch,
  matchYearFilterKey,
  mergeMyStats,
  type MyStatsMatchBlock,
} from '../../../components/profile/myStats';
import type { ParticipantStats } from '../../../services/matchEvents/presences';
import type { MatchEvent } from '../../../services/matchEvents/types';
import type { TeamMatchItem } from '../../../modules/team-presences/teamMatches';

const stats = (memberId: number, goals: number, matchesPlayed: number | null): ParticipantStats => ({
  memberId,
  totals: { goals, yellowCards: 1, redCards: 0, suspensionMatches: 0, matchesPlayed },
  byTournament: [
    { tournamentId: `t${memberId}`, competitionId: null, goals, yellowCards: 1, redCards: 0, suspensionMatches: 0, matchesPlayed },
  ],
});

describe('mergeMyStats', () => {
  it('suma totales de varios participants vinculados', () => {
    const { totals, byTournament } = mergeMyStats([stats(1, 3, 5), stats(2, 2, 4)]);
    expect(totals.goals).toBe(5);
    expect(totals.matchesPlayed).toBe(9);
    expect(byTournament).toHaveLength(2);
  });

  it('PJ queda null si ningún equipo carga presencias (nunca se inventa)', () => {
    const { totals } = mergeMyStats([stats(1, 3, null), stats(2, 2, null)]);
    expect(totals.matchesPlayed).toBeNull();
    expect(totals.goals).toBe(5);
  });

  it('PJ parcial: suma solo lo registrado', () => {
    const { totals } = mergeMyStats([stats(1, 3, 5), stats(2, 2, null)]);
    expect(totals.matchesPlayed).toBe(5);
  });
});

describe('formatMatchesPlayed', () => {
  it('muestra "—" sin presencias y el número con presencias', () => {
    expect(formatMatchesPlayed(null)).toBe('—');
    expect(formatMatchesPlayed(undefined)).toBe('—');
    expect(formatMatchesPlayed(0)).toBe('0');
    expect(formatMatchesPlayed(7)).toBe('7');
  });
});

describe('groupMyEventsByMatch', () => {
  const ev = (id: number, matchId: string, member: number | null): MatchEvent =>
    ({ id, match_id: matchId, event_type: 'goal', display_name: 'X', linked_member_id: member } as unknown as MatchEvent);

  it('agrupa solo los eventos propios por partido', () => {
    const map = groupMyEventsByMatch([ev(1, 'm1', 100), ev(2, 'm1', 999), ev(3, 'm2', 100), ev(4, 'm2', null)], [100]);
    expect(map.get('m1')?.map((e) => e.id)).toEqual([1]);
    expect(map.get('m2')?.map((e) => e.id)).toEqual([3]);
  });

  it('eventos de texto libre (sin linked_member_id) no se atribuyen', () => {
    const map = groupMyEventsByMatch([ev(1, 'm1', null)], [100]);
    expect(map.size).toBe(0);
  });
});

function sampleBlock(overrides: Partial<MyStatsMatchBlock> = {}): MyStatsMatchBlock {
  const item: TeamMatchItem = {
    match: {
      id: 'm1',
      scheduledAt: '2026-03-15T18:00:00.000Z',
      homeAssignedInscription: { inscriptionId: '1', displayName: 'Alpha FC' },
      awayAssignedInscription: { inscriptionId: '2', displayName: 'Beta United' },
      round: 3,
    },
    competitionId: 'c1',
    competitionName: 'Primera',
    stageName: 'Regular',
  };
  return {
    tournamentId: 't1',
    tournamentName: 'Liga Demo',
    teamId: 10,
    teamName: 'Alpha FC',
    matches: [item],
    ...overrides,
  };
}

describe('myStats filters', () => {
  it('extrae año desde scheduledAt', () => {
    expect(matchYearFilterKey({ scheduledAt: '2026-03-15T18:00:00.000Z' })).toBe('2026');
    expect(matchYearFilterKey({ scheduledAt: null })).toBe('unknown');
  });

  it('collectYearFilterOptions ordena años desc y agrega Sin fecha', () => {
    const blocks = [
      sampleBlock(),
      sampleBlock({
        matches: [
          {
            ...sampleBlock().matches[0],
            match: { ...sampleBlock().matches[0].match, id: 'm2', scheduledAt: null },
          },
        ],
      }),
    ];
    const opts = collectYearFilterOptions(blocks);
    expect(opts[0]).toEqual({ id: '2026', label: '2026' });
    expect(opts.some((o) => o.id === 'unknown')).toBe(true);
  });

  it('filterMyStatsBlocks filtra por torneo, año y búsqueda', () => {
    const blocks = [
      sampleBlock(),
      sampleBlock({
        tournamentId: 't2',
        tournamentName: 'Copa Demo',
        matches: [
          {
            match: {
              id: 'm3',
              scheduledAt: '2025-01-10T12:00:00.000Z',
              homeAssignedInscription: { inscriptionId: '1', displayName: 'Alpha FC' },
              awayAssignedInscription: { inscriptionId: '3', displayName: 'Gamma SC' },
            },
            competitionId: 'c2',
            competitionName: 'Copa',
            stageName: 'Final',
          },
        ],
      }),
    ];
    const byTournament = filterMyStatsBlocks(blocks, {
      teamId: ALL_FILTER,
      tournamentId: 't2',
      year: ALL_FILTER,
      search: '',
    });
    expect(byTournament).toHaveLength(1);
    expect(byTournament[0].tournamentName).toBe('Copa Demo');

    const bySearch = filterMyStatsBlocks(blocks, {
      teamId: ALL_FILTER,
      tournamentId: ALL_FILTER,
      year: ALL_FILTER,
      search: 'beta',
    });
    expect(countFilteredMatches(bySearch)).toBe(1);

    const byYear = filterMyStatsBlocks(blocks, {
      teamId: ALL_FILTER,
      tournamentId: ALL_FILTER,
      year: '2025',
      search: '',
    });
    expect(countFilteredMatches(byYear)).toBe(1);
  });
});

function countFilteredMatches(blocks: MyStatsMatchBlock[]): number {
  return blocks.reduce((n, b) => n + b.matches.length, 0);
}
