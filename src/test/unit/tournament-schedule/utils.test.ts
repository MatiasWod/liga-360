import { describe, expect, it } from 'vitest';
import type { LeagueScheduleData } from '../../../components/tournament-schedule/types';
import { getDefaultRoundId, reorderArray } from '../../../components/tournament-schedule/utils';

describe('reorderArray', () => {
  it('moves item from index 0 to 2', () => {
    expect(reorderArray(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
});

describe('getDefaultRoundId', () => {
  it('returns first round id for league', () => {
    const data: LeagueScheduleData = {
      rounds: [
        { id: 'r1', label: 'F1', matches: [] },
        { id: 'r2', label: 'F2', matches: [] },
      ],
    };
    expect(getDefaultRoundId('league', data)).toBe('r1');
  });
});
