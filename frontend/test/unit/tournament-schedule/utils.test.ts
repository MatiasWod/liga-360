import { describe, expect, it } from 'vitest';
import type { LeagueScheduleData } from '../../../components/tournament-schedule/types';
import { getDefaultRoundId, resolveSelectedRoundId, reorderArray } from '../../../components/tournament-schedule/utils';

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

describe('resolveSelectedRoundId', () => {
  const data: LeagueScheduleData = {
    rounds: [
      { id: 'lr-1|1', label: 'Fecha 1', matches: [] },
      { id: 'lr-2|1', label: 'Fecha 2', matches: [] },
    ],
  };

  it('conserva la fecha seleccionada tras recargar datos', () => {
    expect(resolveSelectedRoundId('league', data, 'lr-2|1')).toBe('lr-2|1');
  });

  it('vuelve al default si la fecha previa ya no existe', () => {
    expect(resolveSelectedRoundId('league', data, 'lr-9|1')).toBe('lr-1|1');
  });
});
