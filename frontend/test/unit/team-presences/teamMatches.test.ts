import { describe, expect, it } from 'vitest';
import { collectMatchesForInscription, findTeamInscriptionId } from '../../../modules/team-presences/teamMatches';
import type { TournamentEntity } from '../../../modules/tournaments-list/types';

const match = (id: string, home: number | null, away: number | null, round: number | null, extra: object = {}) => ({
  id,
  status: 'scheduled',
  round,
  leg: 1,
  homeAssignedInscription: home != null ? { inscriptionId: home, displayName: `Equipo ${home}` } : null,
  awayAssignedInscription: away != null ? { inscriptionId: away, displayName: `Equipo ${away}` } : null,
  ...extra,
});

const tournament = {
  id: 't1',
  name: 'Torneo Test',
  competitions: [
    {
      id: 'c1',
      name: 'Primera',
      order: 1,
      stages: [
        {
          id: 's1',
          name: 'Liga',
          format: 'league',
          order: 1,
          matches: [match('m2', 10, 20, 2), match('m1', 20, 10, 1), match('m3', 20, 30, 3)],
        },
        {
          id: 's2',
          name: 'Grupos',
          format: 'groups',
          order: 2,
          groups: [{ id: 'g1', name: 'Grupo A', matches: [match('m4', 10, 30, null)] }],
        },
      ],
    },
  ],
} as unknown as TournamentEntity;

describe('collectMatchesForInscription', () => {
  it('junta partidos de etapas y grupos donde juega la inscripción, ordenados por ronda', () => {
    const items = collectMatchesForInscription(tournament, 10);
    expect(items.map((i) => i.match.id)).toEqual(['m4', 'm1', 'm2']);
    expect(items[1].competitionName).toBe('Primera');
    expect(items[0].stageName).toBe('Grupos');
  });

  it('incluye partidos sin fecha asignada (round null primero)', () => {
    const items = collectMatchesForInscription(tournament, 10);
    expect(items.some((i) => i.match.id === 'm4')).toBe(true);
  });

  it('deduplica partidos repetidos entre competiciones/etapas', () => {
    const dupTournament = {
      ...tournament,
      competitions: [
        ...(tournament.competitions || []),
        {
          id: 'c2',
          name: 'Primera',
          order: 2,
          stages: [
            {
              id: 's3',
              name: 'Copia',
              format: 'league',
              order: 1,
              matches: [
                match('m2-dup', 10, 20, 2, { round: 2 }),
                match('m1-dup', 20, 10, 1, { round: 1 }),
              ],
            },
          ],
        },
      ],
    } as unknown as TournamentEntity;
    const items = collectMatchesForInscription(dupTournament, 10);
    expect(items.map((i) => i.match.id)).toEqual(['m4', 'm1', 'm2']);
  });

  it('devuelve vacío sin torneo o sin partidos del equipo', () => {
    expect(collectMatchesForInscription(null, 10)).toEqual([]);
    expect(collectMatchesForInscription(tournament, 99)).toEqual([]);
  });
});

describe('findTeamInscriptionId', () => {
  const inscriptions = [
    { id: 7, linked_team_id: 5, status: 'RECHAZADO' },
    { id: 8, linked_team_id: 5, status: 'ACEPTADO' },
    { id: 9, linked_team_id: 6, status: 'ACEPTADO' },
  ];

  it('encuentra la inscripción activa del equipo (ignora rechazadas)', () => {
    expect(findTeamInscriptionId(inscriptions, 5)).toBe(8);
  });

  it('devuelve null si el equipo no está inscripto', () => {
    expect(findTeamInscriptionId(inscriptions, 99)).toBeNull();
  });
});
