import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TeamHistoryPanel } from '../../../components/team-history/TeamHistoryPanel';
import * as teamInscriptions from '../../../services/inscriptions/teamInscriptions';
import * as matchesApi from '../../../services/tournaments/matchesByInscriptions';

vi.mock('../../../services/inscriptions/teamInscriptions', () => ({
  listTeamInscriptions: vi.fn(),
}));

vi.mock('../../../services/tournaments/matchesByInscriptions', () => ({
  getMatchesByInscriptionIds: vi.fn(),
}));

describe('TeamHistoryPanel', () => {
  beforeEach(() => {
    vi.mocked(teamInscriptions.listTeamInscriptions).mockReset();
    vi.mocked(matchesApi.getMatchesByInscriptionIds).mockReset();
  });

  it('muestra empty state sin partidos finalizados', async () => {
    vi.mocked(teamInscriptions.listTeamInscriptions).mockResolvedValue([
      {
        id: 5,
        tournament_id: 't1',
        competition_id: null,
        display_name: 'Equipo',
        linked_team_id: 1,
        status: 'ACEPTADO',
      },
    ]);
    vi.mocked(matchesApi.getMatchesByInscriptionIds).mockResolvedValue([]);

    render(<TeamHistoryPanel teamId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/todavía no hay partidos finalizados/i)).toBeInTheDocument();
    });
  });

  it('muestra totales cuando hay partidos finalizados', async () => {
    vi.mocked(teamInscriptions.listTeamInscriptions).mockResolvedValue([
      {
        id: 10,
        tournament_id: 't1',
        competition_id: 'c1',
        display_name: 'Mi club',
        linked_team_id: 1,
        status: 'ACEPTADO',
      },
    ]);
    vi.mocked(matchesApi.getMatchesByInscriptionIds).mockResolvedValue([
      {
        id: 'm1',
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
        tournamentId: 't1',
        tournamentName: 'Copa',
        competitionId: 'c1',
        homeAssignedInscription: { inscriptionId: '10', tournamentId: 't1', displayName: 'Mi club' },
        awayAssignedInscription: { inscriptionId: '20', tournamentId: 't1', displayName: 'Rival' },
      },
    ]);

    render(<TeamHistoryPanel teamId={1} />);
    await waitFor(() => {
      expect(screen.getAllByText(/1 PJ · 1 G · 0 E · 0 P · 2:1 · 3 pts/).length).toBeGreaterThan(0);
      expect(screen.getByText('Copa')).toBeInTheDocument();
    });
  });
});
