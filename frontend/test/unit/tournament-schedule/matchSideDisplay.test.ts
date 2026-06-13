import { describe, expect, it } from 'vitest';
import {
  matchHasExtras,
  splitGoalsBySide,
} from '../../../components/tournament-schedule/matchSideDisplay';

describe('splitGoalsBySide', () => {
  it('separa goles por inscripción local y visitante', () => {
    const split = splitGoalsBySide(
      [
        { display_name: 'Messi', minute: 12, inscription_id: 10 },
        { display_name: 'Álvarez', minute: 44, inscription_id: 10 },
        { display_name: 'Valverde', minute: 70, inscription_id: 20 },
      ],
      10,
      20
    );
    expect(split.home.map((g) => g.display_name)).toEqual(['Messi', 'Álvarez']);
    expect(split.away.map((g) => g.display_name)).toEqual(['Valverde']);
    expect(split.unknown).toEqual([]);
  });

  it('deja sin equipo los goles sin inscription_id reconocible', () => {
    const split = splitGoalsBySide(
      [{ display_name: 'Jugador X', minute: 5, inscription_id: null }],
      10,
      20
    );
    expect(split.home).toEqual([]);
    expect(split.away).toEqual([]);
    expect(split.unknown).toHaveLength(1);
  });
});

describe('matchHasExtras', () => {
  it('detecta goles o sets', () => {
    expect(matchHasExtras([], [])).toBe(false);
    expect(matchHasExtras([{ display_name: 'Ana' }], [])).toBe(true);
    expect(matchHasExtras([], [{ setNumber: 1, homeGames: 6, awayGames: 4 }])).toBe(true);
  });
});
