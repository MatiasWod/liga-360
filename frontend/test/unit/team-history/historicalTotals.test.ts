import { describe, expect, it } from 'vitest';
import type { HistoricalMatchRow } from '../../../services/tournaments/matchesByInscriptions';
import {
  computeHeadToHeadSummary,
  computeHistoricalTotals,
  extractOpponentInscriptionIds,
  filterHeadToHeadMatches,
  isPhysicalInscriptionId,
} from '../../../components/team-history/historicalTotals';

const finished = (
  id: string,
  homeId: number | string,
  awayId: number | string,
  hs: number,
  as: number,
  extra: Partial<HistoricalMatchRow> = {}
): HistoricalMatchRow => ({
  id,
  status: 'finished',
  homeScore: hs,
  awayScore: as,
  tournamentId: 't1',
  tournamentName: 'Torneo A',
  competitionId: 'c1',
  homeAssignedInscription: { inscriptionId: String(homeId), tournamentId: 't1', displayName: `H${homeId}` },
  awayAssignedInscription: { inscriptionId: String(awayId), tournamentId: 't1', displayName: `A${awayId}` },
  ...extra,
});

describe('isPhysicalInscriptionId', () => {
  it('excluye slots sintéticos', () => {
    expect(isPhysicalInscriptionId(10)).toBe(true);
    expect(isPhysicalInscriptionId('pos:1:2')).toBe(false);
    expect(isPhysicalInscriptionId('liga360-slot:abc')).toBe(false);
    expect(isPhysicalInscriptionId('')).toBe(false);
  });
});

describe('computeHistoricalTotals', () => {
  it('suma W/D/L y goles solo de partidos finalizados', () => {
    const matches = [
      finished('m1', 10, 20, 2, 1),
      finished('m2', 30, 10, 0, 0),
      { ...finished('m3', 10, 40, 1, 3), status: 'scheduled' },
      finished('m4', 10, 50, 1, 1),
    ];
    const { totals, byTournament } = computeHistoricalTotals(matches, [10], [
      { id: 10, tournament_id: 't1', display_name: 'Mi equipo' },
    ]);
    expect(totals.played).toBe(3);
    expect(totals.won).toBe(1);
    expect(totals.drawn).toBe(2);
    expect(totals.lost).toBe(0);
    expect(totals.goalsFor).toBe(3);
    expect(totals.goalsAgainst).toBe(2);
    expect(totals.points).toBe(5);
    expect(byTournament).toHaveLength(1);
    expect(byTournament[0].displayName).toBe('Mi equipo');
  });

  it('ignora inscripciones sintéticas en el fixture', () => {
    const matches = [finished('m1', 'pos:1:1', 10, 2, 0)];
    const { totals } = computeHistoricalTotals(matches, [10]);
    expect(totals.played).toBe(0);
  });

  it('deduplica el mismo cruce con distinto id Neo4j', () => {
    const matches = [
      finished('m1', 10, 20, 2, 1, { round: 1 }),
      finished('m1-dup', 10, 20, 2, 1, { round: 1 }),
    ];
    const { totals } = computeHistoricalTotals(matches, [10]);
    expect(totals.played).toBe(1);
  });
});

describe('head to head helpers', () => {
  const mine = [10];
  const rival = [20];
  const matches = [
    finished('h1', 10, 20, 2, 1, { tournamentId: 't1', tournamentName: 'A' }),
    finished('h2', 20, 10, 3, 0, { tournamentId: 't2', tournamentName: 'B' }),
    finished('h3', 10, 30, 1, 0),
  ];

  it('filterHeadToHeadMatches solo cruces entre ambos conjuntos', () => {
    const h2h = filterHeadToHeadMatches(matches, mine, rival);
    expect(h2h.map((m) => m.id)).toEqual(['h1', 'h2']);
  });

  it('computeHeadToHeadSummary cuenta victorias desde la perspectiva del equipo', () => {
    const s = computeHeadToHeadSummary(matches, mine, rival);
    expect(s.myWins).toBe(1);
    expect(s.rivalWins).toBe(1);
    expect(s.draws).toBe(0);
    expect(s.played).toBe(2);
  });

  it('extractOpponentInscriptionIds devuelve rivales únicos', () => {
    const ids = extractOpponentInscriptionIds(matches, mine);
    expect(ids.sort((a, b) => a - b)).toEqual([20, 30]);
  });
});
