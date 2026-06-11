import { describe, expect, it } from 'vitest';
import {
  agendaFixtureFocusFromRow,
  buildOrganizerRowsFromTournament,
  buildParticipantRowsFromTournament,
  isCompetitionActive,
  isTournamentAgendaEligible,
  pickNextPendingMatchInCompetition,
  sortAgendaRows,
} from '../../../modules/agenda/agendaPickers';
import type { TournamentEntity } from '../../../modules/tournaments-list/types';

function baseTournament(overrides: Partial<TournamentEntity> = {}): TournamentEntity {
  return {
    id: 't1',
    name: 'Torneo Demo',
    status: 'published',
    competitions: [
      {
        id: 'c-liga',
        name: 'Liga',
        order: 1,
        stages: [
          {
            id: 's1',
            name: 'Etapa Liga',
            order: 1,
            format: 'league',
            stageStatus: 'active',
            matches: [
              {
                id: 'm1',
                round: 1,
                leg: 1,
                status: 'completed',
                homeAssignedInscription: { inscriptionId: '10', displayName: 'Alpha' },
                awayAssignedInscription: { inscriptionId: '11', displayName: 'Beta' },
              },
              {
                id: 'm2',
                round: 2,
                leg: 1,
                status: 'scheduled',
                scheduledAt: '2026-06-10T15:00:00.000Z',
                homeAssignedInscription: { inscriptionId: '10', displayName: 'Alpha' },
                awayAssignedInscription: { inscriptionId: '11', displayName: 'Beta' },
              },
            ],
          },
        ],
      },
      {
        id: 'c-copa',
        name: 'Copa',
        order: 2,
        stages: [
          {
            id: 's2',
            name: 'Copa',
            order: 1,
            format: 'elimination',
            stageStatus: 'not_started',
            matches: [
              {
                id: 'm3',
                round: 1,
                status: 'scheduled',
                homeAssignedInscription: { inscriptionId: '10', displayName: 'Alpha' },
                awayAssignedInscription: { inscriptionId: '12', displayName: 'Gamma' },
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('agendaPickers', () => {
  it('excluye torneos draft y finished', () => {
    expect(isTournamentAgendaEligible('published')).toBe(true);
    expect(isTournamentAgendaEligible('draft')).toBe(false);
    expect(isTournamentAgendaEligible('finished')).toBe(false);
  });

  it('solo competencia activa genera fila', () => {
    const t = baseTournament();
    expect(isCompetitionActive(t.competitions[0])).toBe(true);
    expect(isCompetitionActive(t.competitions[1])).toBe(false);
    const rows = buildParticipantRowsFromTournament(t, 10, 'Equipo Alpha');
    expect(rows).toHaveLength(1);
    expect(rows[0].competitionName).toBe('Liga');
    expect(rows[0].match.id).toBe('m2');
  });

  it('orden global: scheduledAt antes que sin fecha', () => {
    const dated = buildParticipantRowsFromTournament(baseTournament(), 10, 'A')[0];
    const undatedT = baseTournament({
      competitions: [
        {
          id: 'c2',
          name: 'Liga 2',
          order: 1,
          stages: [
            {
              id: 's3',
              name: 'L',
              order: 1,
              format: 'league',
              stageStatus: 'active',
              matches: [
                {
                  id: 'mx',
                  round: 3,
                  status: 'scheduled',
                  homeAssignedInscription: { inscriptionId: '10', displayName: 'A' },
                  awayAssignedInscription: { inscriptionId: '11', displayName: 'B' },
                },
              ],
            },
          ],
        },
      ],
    });
    const undated = buildParticipantRowsFromTournament(undatedT, 10, 'A')[0];
    const sorted = sortAgendaRows([undated, dated]);
    expect(sorted[0].match.id).toBe('m2');
    expect(sorted[1].match.id).toBe('mx');
  });

  it('incluye rival TBD', () => {
    const t = baseTournament({
      competitions: [
        {
          id: 'c1',
          name: 'Liga',
          order: 1,
          stages: [
            {
              id: 's1',
              name: 'L',
              order: 1,
              format: 'league',
              stageStatus: 'active',
              matches: [
                {
                  id: 'm-tbd',
                  round: 1,
                  status: 'scheduled',
                  homeAssignedInscription: { inscriptionId: '10', displayName: 'Alpha' },
                  awayAssignedInscription: { inscriptionId: 'liga360-slot:x', displayName: 'Por definir' },
                },
              ],
            },
          ],
        },
      ],
    });
    const row = buildParticipantRowsFromTournament(t, 10, 'A')[0];
    expect(row.opponentName).toBe('Por definir');
  });

  it('organizador: fecha en juego y conteo', () => {
    const t = baseTournament({
      competitions: [
        {
          id: 'c1',
          name: 'Liga',
          order: 1,
          stages: [
            {
              id: 's1',
              name: 'L',
              order: 1,
              format: 'league',
              stageStatus: 'active',
              matches: [
                { id: 'a', round: 2, status: 'scheduled', homeAssignedInscription: { inscriptionId: '1', displayName: 'A' }, awayAssignedInscription: { inscriptionId: '2', displayName: 'B' } },
                { id: 'b', round: 2, status: 'scheduled', homeAssignedInscription: { inscriptionId: '3', displayName: 'C' }, awayAssignedInscription: { inscriptionId: '4', displayName: 'D' } },
                { id: 'c', round: 3, status: 'scheduled', homeAssignedInscription: { inscriptionId: '5', displayName: 'E' }, awayAssignedInscription: { inscriptionId: '6', displayName: 'F' } },
              ],
            },
          ],
        },
      ],
    });
    const rows = buildOrganizerRowsFromTournament(t);
    expect(rows).toHaveLength(1);
    expect(rows[0].activeRound).toBe(2);
    expect(rows[0].pendingCount).toBe(2);
    expect(rows[0].roundLabel).toBe('Fecha 2');
  });

  it('pickNext salta partidos completados', () => {
    const comp = baseTournament().competitions[0];
    const next = pickNextPendingMatchInCompetition(comp, 10);
    expect(next?.match.id).toBe('m2');
  });

  it('agendaFixtureFocusFromRow arma competición, etapa y fecha', () => {
    const row = buildParticipantRowsFromTournament(baseTournament(), 10, 'Equipo Alpha')[0];
    expect(agendaFixtureFocusFromRow(row)).toEqual({
      competitionId: 'c-liga',
      stageId: 's1',
      roundKey: '2|1',
    });
  });
});
