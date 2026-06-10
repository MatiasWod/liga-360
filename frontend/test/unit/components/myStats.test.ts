import { describe, expect, it } from 'vitest';
import { formatMatchesPlayed, groupMyEventsByMatch, mergeMyStats } from '../../../components/profile/myStats';
import type { ParticipantStats } from '../../../services/matchEvents/presences';
import type { MatchEvent } from '../../../services/matchEvents/types';

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
