import { describe, expect, it } from 'vitest';
import { computeFinalPlacements } from '../../../modules/tournaments-list/history/finalPlacements';
import type {
  StandingsRow,
  TournamentMatchRow,
  TournamentStage,
} from '../../../modules/tournaments-list/types';

const row = (position: number, id: string, name: string, points = 0): StandingsRow => ({
  position,
  inscriptionId: id,
  displayName: name,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  points,
});

const match = (
  id: string,
  round: number,
  homeId: string,
  awayId: string,
  hs: number | null,
  as: number | null,
  extra: Partial<TournamentMatchRow> = {}
): TournamentMatchRow => ({
  id,
  round,
  homeScore: hs,
  awayScore: as,
  status: 'finished',
  homeAssignedInscription: { inscriptionId: homeId, displayName: `Equipo ${homeId}` },
  awayAssignedInscription: { inscriptionId: awayId, displayName: `Equipo ${awayId}` },
  ...extra,
});

const leagueStage = (order: number, standings: StandingsRow[]): TournamentStage => ({
  id: `st-liga-${order}`,
  name: 'Liga',
  order,
  format: 'league',
  standings,
});

const eliminationStage = (order: number, matches: TournamentMatchRow[]): TournamentStage => ({
  id: `st-elim-${order}`,
  name: 'Llave',
  order,
  format: 'elimination',
  matches,
});

describe('computeFinalPlacements', () => {
  it('liga: campeón = posición 1, subcampeón = posición 2, sin 3er puesto', () => {
    const result = computeFinalPlacements({
      stages: [leagueStage(1, [row(2, '20', 'Beta', 30), row(1, '10', 'Alpha', 35)])],
    });
    expect(result.champion).toEqual({ inscriptionId: '10', displayName: 'Alpha' });
    expect(result.runnerUp).toEqual({ inscriptionId: '20', displayName: 'Beta' });
    expect(result.thirdPlace).toBeNull();
    expect(result.perStage).toHaveLength(1);
    expect(result.perStage[0].kind).toBe('table');
  });

  it('eliminación: campeón = ganador del partido de mayor round, subcampeón = perdedor', () => {
    const result = computeFinalPlacements({
      stages: [
        eliminationStage(1, [
          match('semi1', 1, '10', '20', 2, 1),
          match('semi2', 1, '30', '40', 0, 3),
          match('final', 2, '10', '40', 1, 2),
        ]),
      ],
    });
    expect(result.champion?.inscriptionId).toBe('40');
    expect(result.runnerUp?.inscriptionId).toBe('10');
    expect(result.thirdPlace).toBeNull();
  });

  it('mixto grupos + llave: el campeón sale de la etapa de eliminación (mayor order)', () => {
    const groupsStage: TournamentStage = {
      id: 'st-grupos',
      name: 'Fase de grupos',
      order: 1,
      format: 'groups',
      groups: [
        { id: 'g1', name: 'Grupo A', order: 1, standings: [row(1, '10', 'Alpha')] },
        { id: 'g2', name: 'Grupo B', order: 2, standings: [row(1, '30', 'Gamma')] },
      ],
    };
    const result = computeFinalPlacements({
      stages: [eliminationStage(2, [match('final', 1, '10', '30', 0, 1)]), groupsStage],
    });
    expect(result.champion?.inscriptionId).toBe('30');
    expect(result.perStage.map((s) => s.kind)).toEqual(['groupTables', 'podium']);
  });

  it('final empatada: campeón y subcampeón null, perStage se mantiene', () => {
    const result = computeFinalPlacements({
      stages: [eliminationStage(1, [match('final', 1, '10', '20', 2, 2)])],
    });
    expect(result.champion).toBeNull();
    expect(result.runnerUp).toBeNull();
    expect(result.perStage).toHaveLength(1);
  });

  it('final sin resultado (scheduled): campeón null', () => {
    const result = computeFinalPlacements({
      stages: [
        eliminationStage(1, [match('final', 1, '10', '20', null, null, { status: 'scheduled' })]),
      ],
    });
    expect(result.champion).toBeNull();
  });

  it('byes no cuentan como final aunque tengan round mayor', () => {
    const result = computeFinalPlacements({
      stages: [
        eliminationStage(1, [
          match('final', 1, '10', '20', 3, 1),
          match('bye', 2, '10', 'liga360-slot:x', 1, 0, { matchKind: 'bye' }),
        ]),
      ],
    });
    expect(result.champion?.inscriptionId).toBe('10');
    expect(result.runnerUp?.inscriptionId).toBe('20');
  });

  it('partido de 3er puesto: se excluye de la final y aporta el 3er puesto', () => {
    const result = computeFinalPlacements({
      stages: [
        eliminationStage(1, [
          match('semi1', 1, '10', '20', 2, 0),
          match('semi2', 1, '30', '40', 1, 0),
          match('3p', 2, '20', '40', 2, 1, { matchKind: 'third_place' }),
          match('final', 2, '10', '30', 1, 0),
        ]),
      ],
    });
    expect(result.champion?.inscriptionId).toBe('10');
    expect(result.runnerUp?.inscriptionId).toBe('30');
    expect(result.thirdPlace?.inscriptionId).toBe('20');
  });

  it('final a doble pierna: agrega goles de ida y vuelta', () => {
    const result = computeFinalPlacements({
      stages: [
        eliminationStage(1, [
          match('ida', 2, '10', '20', 0, 2, { leg: 1 }),
          match('vuelta', 2, '20', '10', 0, 3, { leg: 2 }),
          match('semi', 1, '10', '30', 1, 0),
        ]),
      ],
    });
    // Global: 10 suma 0+3=3, 20 suma 2+0=2.
    expect(result.champion?.inscriptionId).toBe('10');
    expect(result.runnerUp?.inscriptionId).toBe('20');
  });

  it('última etapa de grupos: campeón null pero perStage trae las tablas', () => {
    const result = computeFinalPlacements({
      stages: [
        {
          id: 'st-grupos',
          name: 'Grupos',
          order: 1,
          format: 'groups',
          groups: [{ id: 'g1', name: 'Grupo A', order: 1, standings: [row(1, '10', 'Alpha')] }],
        },
      ],
    });
    expect(result.champion).toBeNull();
    expect(result.perStage[0].kind).toBe('groupTables');
  });

  it('placeholders liga360-slot:/pos: nunca son campeón', () => {
    const elim = computeFinalPlacements({
      stages: [eliminationStage(1, [match('final', 1, 'liga360-slot:a', '20', 3, 1)])],
    });
    expect(elim.champion).toBeNull();

    const league = computeFinalPlacements({
      stages: [leagueStage(1, [row(1, 'pos:1:1', 'Slot'), row(2, '20', 'Beta')])],
    });
    expect(league.champion).toBeNull();
    expect(league.runnerUp?.inscriptionId).toBe('20');
  });

  it('competencia vacía o null: todo null', () => {
    expect(computeFinalPlacements(null).champion).toBeNull();
    expect(computeFinalPlacements({ stages: [] }).perStage).toEqual([]);
  });
});
