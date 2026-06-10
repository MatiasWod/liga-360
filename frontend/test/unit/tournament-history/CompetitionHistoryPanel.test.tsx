import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CompetitionHistoryPanel } from '../../../modules/tournaments-list/history/CompetitionHistoryPanel';
import * as statsApi from '../../../services/matchEvents/stats';
import * as seriesApi from '../../../services/tournaments/series';
import type { TournamentCompetition } from '../../../modules/tournaments-list/types';

vi.mock('../../../services/matchEvents/stats', () => ({
  getScorerStats: vi.fn(),
}));

vi.mock('../../../services/tournaments/series', () => ({
  getCompetitionSeriesById: vi.fn(),
}));

const scorer = (displayName: string, goals: number) => ({
  playerKey: `name:${displayName}`,
  displayName,
  inscriptionId: null,
  linkedMemberId: null,
  goals,
});

const finishedCompetition: TournamentCompetition = {
  id: 'c1',
  name: 'Copa Demo',
  order: 1,
  stages: [
    {
      id: 'st1',
      name: 'Llave final',
      order: 1,
      format: 'elimination',
      matches: [
        {
          id: 'final',
          round: 1,
          status: 'finished',
          homeScore: 2,
          awayScore: 1,
          homeAssignedInscription: { inscriptionId: '10', displayName: 'Alpha' },
          awayAssignedInscription: { inscriptionId: '20', displayName: 'Beta' },
        },
      ],
    },
  ],
};

const tiedCompetition: TournamentCompetition = {
  ...finishedCompetition,
  stages: [
    {
      ...finishedCompetition.stages[0],
      matches: [{ ...finishedCompetition.stages[0].matches![0], awayScore: 2 }],
    },
  ],
};

describe('CompetitionHistoryPanel', () => {
  beforeEach(() => {
    vi.mocked(statsApi.getScorerStats).mockReset();
  });

  it('muestra campeón, subcampeón, goleadores empatados y podio por etapa', async () => {
    vi.mocked(statsApi.getScorerStats).mockResolvedValue([
      scorer('Ana Pérez', 5),
      scorer('Juan Gómez', 5),
      scorer('Otro Jugador', 2),
    ]);

    render(
      <CompetitionHistoryPanel
        tournamentId="t1"
        competition={finishedCompetition}
        nameById={new Map([['10', 'Alpha FC']])}
      />
    );

    // KPI + fila del podio de la etapa
    expect(screen.getAllByText('Campeón')).toHaveLength(2);
    // nameById tiene prioridad sobre el displayName embebido
    expect(screen.getAllByText('Alpha FC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByText('Ana Pérez, Juan Gómez (5)')).toBeInTheDocument();
    });
    expect(screen.getByText('Goleadores')).toBeInTheDocument();
    expect(screen.getByText('Posiciones finales por etapa')).toBeInTheDocument();
  });

  it('muestra "—" para campeón no derivable y goleador sin goles', async () => {
    vi.mocked(statsApi.getScorerStats).mockResolvedValue([]);

    render(
      <CompetitionHistoryPanel tournamentId="t1" competition={tiedCompetition} nameById={new Map()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Goleador')).toBeInTheDocument();
    });
    // Campeón, subcampeón (final empatada), goleador (sin goles) y las dos filas del podio
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Posiciones finales por etapa')).toBeInTheDocument();
  });

  it('muestra enlace a histórico de serie cuando hay seriesId', async () => {
    vi.mocked(statsApi.getScorerStats).mockResolvedValue([]);
    vi.mocked(seriesApi.getCompetitionSeriesById).mockResolvedValue({
      id: 'cs1',
      name: 'Mundial FIFA',
      slug: 'mundial-fifa',
      sport: 'football',
      editions: [],
    });
    const onViewSeries = vi.fn();

    render(
      <CompetitionHistoryPanel
        tournamentId="t1"
        competition={finishedCompetition}
        nameById={new Map()}
        seriesId="cs1"
        editionLabel="2022"
        onViewSeries={onViewSeries}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ver histórico de Mundial FIFA/i })).toBeInTheDocument();
    });
    screen.getByRole('button', { name: /Ver histórico de Mundial FIFA/i }).click();
    expect(onViewSeries).toHaveBeenCalledWith('cs1');
  });

  it('no muestra tablas de grupos en Detalle, solo podio de eliminación', async () => {
    vi.mocked(statsApi.getScorerStats).mockResolvedValue([]);
    const groupsAndElim: TournamentCompetition = {
      id: 'c-mundial',
      name: 'Mundial',
      order: 1,
      stages: [
        {
          id: 'st-grupos',
          name: 'Fase de grupos',
          order: 1,
          format: 'groups',
          groups: [
            {
              id: 'g1',
              name: 'Grupo A',
              order: 1,
              standings: [
                {
                  position: 1,
                  inscriptionId: '10',
                  displayName: 'Argentina',
                  played: 3,
                  won: 2,
                  drawn: 1,
                  lost: 0,
                  goalsFor: 5,
                  goalsAgainst: 2,
                  goalDifference: 3,
                  points: 7,
                },
              ],
            },
          ],
        },
        {
          id: 'st-elim',
          name: 'Eliminatorias',
          order: 2,
          format: 'elimination',
          matches: [
            {
              id: 'final',
              round: 1,
              status: 'finished',
              homeScore: 2,
              awayScore: 1,
              homeAssignedInscription: { inscriptionId: '10', displayName: 'Argentina' },
              awayAssignedInscription: { inscriptionId: '20', displayName: 'Brasil' },
            },
          ],
        },
      ],
    };

    render(
      <CompetitionHistoryPanel tournamentId="t1" competition={groupsAndElim} nameById={new Map()} />
    );

    expect(screen.queryByText('Grupo A')).not.toBeInTheDocument();
    expect(screen.getByText('Eliminatorias')).toBeInTheDocument();
    expect(screen.getAllByText('Argentina').length).toBeGreaterThan(0);
  });
});
