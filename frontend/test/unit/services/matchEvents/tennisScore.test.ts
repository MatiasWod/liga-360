import { describe, expect, it } from 'vitest';
import {
  computeSetsWon,
  filledTennisSets,
  formatTennisSetLine,
  parseTennisSetEvents,
  tennisSetsToFormRows,
  validateTennisSets,
} from '../../../../services/matchEvents/tennisScore';
import type { MatchEvent } from '../../../../services/matchEvents/types';

function tennisSetEvent(id: number, setNumber: number, homeGames: number, awayGames: number): MatchEvent {
  return {
    id,
    match_id: 'm1',
    tournament_id: 't1',
    competition_id: null,
    event_type: 'tennis_set',
    inscription_id: null,
    linked_member_id: null,
    display_name: `Set ${setNumber}`,
    minute: null,
    suspension_matches: null,
    extra_json: { setNumber, homeGames, awayGames },
    created_by_user_id: null,
    created_at: '',
    updated_at: '',
  };
}

describe('tennisScore helpers', () => {
  it('parsea eventos tennis_set desde extra_json (ordenados por setNumber)', () => {
    const events: MatchEvent[] = [tennisSetEvent(1, 2, 3, 6), tennisSetEvent(2, 1, 6, 4)];
    expect(parseTennisSetEvents(events)).toEqual([
      { setNumber: 1, homeGames: 6, awayGames: 4 },
      { setNumber: 2, homeGames: 3, awayGames: 6 },
    ]);
  });

  it('rellena filas del formulario desde eventos', () => {
    const rows = tennisSetsToFormRows([tennisSetEvent(1, 1, 6, 4)]);
    expect(rows[0]).toEqual({ setNumber: 1, homeGames: 6, awayGames: 4 });
    expect(rows[1]).toEqual({ setNumber: 2, homeGames: '', awayGames: '' });
  });

  it('formatea línea de set para vista pública', () => {
    expect(formatTennisSetLine({ setNumber: 3, homeGames: 7, awayGames: 5 })).toBe('Set 3: 7–5');
  });

  it('computeSetsWon cuenta sets ganados por lado e ignora filas vacías', () => {
    const sets = [
      { setNumber: 1, homeGames: 6 as number | '', awayGames: 4 as number | '' },
      { setNumber: 2, homeGames: 3 as number | '', awayGames: 6 as number | '' },
      { setNumber: 3, homeGames: '' as number | '', awayGames: '' as number | '' },
    ];
    expect(computeSetsWon(sets)).toEqual({ home: 1, away: 1 });
    expect(filledTennisSets(sets)).toHaveLength(2);
  });

  it('validateTennisSets rechaza sets a medias y empatados, acepta vacíos', () => {
    expect(validateTennisSets([{ setNumber: 1, homeGames: 6, awayGames: '' }])).toMatch(/ambos games/);
    expect(validateTennisSets([{ setNumber: 1, homeGames: 6, awayGames: 6 }])).toMatch(/empatado/);
    expect(validateTennisSets([{ setNumber: 1, homeGames: '', awayGames: '' }])).toBeNull();
    expect(validateTennisSets([{ setNumber: 1, homeGames: 6, awayGames: 4 }])).toBeNull();
  });
});
