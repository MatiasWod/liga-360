import { describe, expect, it } from 'vitest';
import {
  aggregateCompetitionStandings,
  collectCompetitionMatchesForInscription,
  mergeTeamStats,
} from '../../../modules/tournaments-list/stats/teamStatsMerge';
import type { TournamentCompetition } from '../../../modules/tournaments-list/types';

function standingsRow(over: Partial<any> = {}) {
  return {
    position: 1,
    inscriptionId: '10',
    displayName: 'Boca Norte',
    played: 3,
    won: 2,
    drawn: 1,
    lost: 0,
    goalsFor: 7,
    goalsAgainst: 2,
    goalDifference: 5,
    points: 7,
    ...over,
  };
}

const competition: TournamentCompetition = {
  id: 'c-1',
  name: 'Primera',
  order: 1,
  stages: [
    {
      id: 's-1',
      name: 'Grupos',
      order: 1,
      format: 'groups',
      groups: [
        {
          id: 'g-1',
          name: 'Grupo A',
          order: 1,
          standings: [
            standingsRow(),
            standingsRow({ position: 2, inscriptionId: '11', displayName: 'River Sur', points: 4, won: 1, goalsFor: 3 }),
          ],
          matches: [
            {
              id: 'm-1',
              homeAssignedInscription: { inscriptionId: '10', displayName: 'Boca Norte' },
              awayAssignedInscription: { inscriptionId: '11', displayName: 'River Sur' },
            },
          ],
        },
      ],
    },
    {
      id: 's-2',
      name: 'Liga',
      order: 2,
      format: 'league',
      standings: [standingsRow({ played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 2, goalsAgainst: 3, points: 3 })],
      matches: [
        {
          id: 'm-2',
          homeAssignedInscription: { inscriptionId: '12', displayName: 'Otro' },
          awayAssignedInscription: { inscriptionId: '10', displayName: 'Boca Norte' },
        },
      ],
    },
  ],
};

describe('aggregateCompetitionStandings', () => {
  it('suma standings de liga y grupos por inscripción', () => {
    const agg = aggregateCompetitionStandings(competition);
    const boca = agg.get('10')!;
    expect(boca.played).toBe(5);
    expect(boca.won).toBe(3);
    expect(boca.points).toBe(10);
    expect(boca.goalsFor).toBe(9);
    expect(agg.get('11')!.points).toBe(4);
  });

  it('devuelve mapa vacío sin competencia', () => {
    expect(aggregateCompetitionStandings(null).size).toBe(0);
  });
});

describe('mergeTeamStats', () => {
  const nameById = new Map([['99', 'Sin Tabla FC']]);

  it('mergea tarjetas por inscriptionId y ordena por puntos', () => {
    const rows = mergeTeamStats(
      aggregateCompetitionStandings(competition),
      [
        { inscriptionId: 10, goals: 9, yellowCards: 3, redCards: 1 },
        { inscriptionId: 11, goals: 3, yellowCards: 5, redCards: 0 },
      ],
      nameById
    );
    expect(rows[0].inscriptionId).toBe('10');
    expect(rows[0].yellowCards).toBe(3);
    expect(rows[0].redCards).toBe(1);
    expect(rows[1].inscriptionId).toBe('11');
    expect(rows[1].yellowCards).toBe(5);
  });

  it('equipos sin tarjetas quedan con ceros (empty state parcial)', () => {
    const rows = mergeTeamStats(aggregateCompetitionStandings(competition), [], nameById);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.yellowCards === 0 && r.redCards === 0)).toBe(true);
  });

  it('equipos con eventos pero sin standings entran con nombre del lookup', () => {
    const rows = mergeTeamStats(
      aggregateCompetitionStandings(competition),
      [{ inscriptionId: 99, goals: 1, yellowCards: 2, redCards: 0 }],
      nameById
    );
    const extra = rows.find((r) => r.inscriptionId === '99')!;
    expect(extra.displayName).toBe('Sin Tabla FC');
    expect(extra.played).toBe(0);
    expect(extra.yellowCards).toBe(2);
  });

  it('todo vacío produce lista vacía', () => {
    expect(mergeTeamStats(new Map(), [], new Map())).toEqual([]);
  });
});

describe('collectCompetitionMatchesForInscription', () => {
  it('junta partidos de liga y grupos donde juega la inscripción', () => {
    const matches = collectCompetitionMatchesForInscription(competition, '10');
    expect(matches.map((m) => m.id)).toEqual(['m-1', 'm-2']);
  });

  it('inscripción sin partidos devuelve vacío', () => {
    expect(collectCompetitionMatchesForInscription(competition, '404')).toEqual([]);
  });
});
