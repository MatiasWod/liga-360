import { describe, expect, it } from 'vitest';
import {
  formatTennisSetLine,
  parseTennisSetEvents,
  tennisSetsToFormRows,
} from '../../../../services/matchEvents/tennisScore';
import type { MatchEvent } from '../../../../services/matchEvents/types';

describe('tennisScore helpers', () => {
  it('parsea eventos tennis_set desde extra_json', () => {
    const events: MatchEvent[] = [
      {
        id: 1,
        match_id: 'm1',
        tournament_id: 't1',
        competition_id: null,
        event_type: 'tennis_set',
        inscription_id: null,
        linked_member_id: null,
        display_name: 'Set 2',
        minute: null,
        suspension_matches: null,
        extra_json: { setNumber: 2, homeGames: 3, awayGames: 6 },
        created_by_user_id: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: 2,
        match_id: 'm1',
        tournament_id: 't1',
        competition_id: null,
        event_type: 'tennis_set',
        inscription_id: null,
        linked_member_id: null,
        display_name: 'Set 1',
        minute: null,
        suspension_matches: null,
        extra_json: { setNumber: 1, homeGames: 6, awayGames: 4 },
        created_by_user_id: null,
        created_at: '',
        updated_at: '',
      },
    ];
    expect(parseTennisSetEvents(events)).toEqual([
      { setNumber: 1, homeGames: 6, awayGames: 4 },
      { setNumber: 2, homeGames: 3, awayGames: 6 },
    ]);
  });

  it('rellena filas del formulario desde eventos', () => {
    const rows = tennisSetsToFormRows([
      {
        id: 1,
        match_id: 'm1',
        tournament_id: 't1',
        competition_id: null,
        event_type: 'tennis_set',
        inscription_id: null,
        linked_member_id: null,
        display_name: 'Set 1',
        minute: null,
        suspension_matches: null,
        extra_json: { setNumber: 1, homeGames: 6, awayGames: 4 },
        created_by_user_id: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    expect(rows[0]).toEqual({ setNumber: 1, homeGames: 6, awayGames: 4 });
    expect(rows[1]).toEqual({ setNumber: 2, homeGames: '', awayGames: '' });
  });

  it('formatea línea de set para vista pública', () => {
    expect(formatTennisSetLine({ setNumber: 3, homeGames: 7, awayGames: 5 })).toBe('Set 3: 7–5');
  });
});
