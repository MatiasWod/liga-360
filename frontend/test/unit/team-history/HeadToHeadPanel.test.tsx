import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HeadToHeadPanel } from '../../../components/team-history/HeadToHeadPanel';
import * as teamInscriptions from '../../../services/inscriptions/teamInscriptions';
import * as matchesApi from '../../../services/tournaments/matchesByInscriptions';
import * as teamsApi from '../../../services/teams/teams';

vi.mock('../../../services/inscriptions/teamInscriptions', () => ({
  listTeamInscriptions: vi.fn(),
  lookupInscriptions: vi.fn(),
}));

vi.mock('../../../services/tournaments/matchesByInscriptions', () => ({
  getMatchesByInscriptionIds: vi.fn(),
}));

vi.mock('../../../services/teams/teams', () => ({
  lookupTeamsByIds: vi.fn(),
}));

vi.mock('../../../services/matchEvents/stats', () => ({
  getEventsByInscription: vi.fn().mockResolvedValue([]),
}));

describe('HeadToHeadPanel', () => {
  beforeEach(() => {
    vi.mocked(teamInscriptions.listTeamInscriptions).mockReset();
    vi.mocked(teamInscriptions.lookupInscriptions).mockReset();
    vi.mocked(matchesApi.getMatchesByInscriptionIds).mockReset();
    vi.mocked(teamsApi.lookupTeamsByIds).mockReset();
  });

  it('muestra empty state sin rivales vinculados', async () => {
    vi.mocked(teamInscriptions.listTeamInscriptions).mockResolvedValue([
      {
        id: 10,
        tournament_id: 't1',
        competition_id: null,
        display_name: 'Yo',
        linked_team_id: 1,
        status: 'ACEPTADO',
      },
    ]);
    vi.mocked(matchesApi.getMatchesByInscriptionIds).mockResolvedValue([
      {
        id: 'm1',
        status: 'finished',
        homeScore: 1,
        awayScore: 0,
        tournamentId: 't1',
        homeAssignedInscription: { inscriptionId: '10', tournamentId: 't1', displayName: 'Yo' },
        awayAssignedInscription: { inscriptionId: 'pos:1:1', tournamentId: 't1', displayName: 'Slot' },
      },
    ]);
    vi.mocked(teamInscriptions.lookupInscriptions).mockResolvedValue([]);

    render(<HeadToHeadPanel teamId={1} />);
    await waitFor(() => {
      expect(screen.getByText(/sin rivales vinculados/i)).toBeInTheDocument();
    });
  });

  it('permite elegir rival y muestra resumen mano a mano', async () => {
    vi.mocked(teamInscriptions.listTeamInscriptions).mockImplementation(async (teamId) => {
      if (Number(teamId) === 1) {
        return [
          {
            id: 10,
            tournament_id: 't1',
            competition_id: null,
            display_name: 'Yo',
            linked_team_id: 1,
            status: 'ACEPTADO',
          },
        ];
      }
      return [
        {
          id: 20,
          tournament_id: 't1',
          competition_id: null,
          display_name: 'Ellos',
          linked_team_id: 2,
          status: 'ACEPTADO',
        },
      ];
    });
    vi.mocked(matchesApi.getMatchesByInscriptionIds).mockResolvedValue([
      {
        id: 'm1',
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
        tournamentId: 't1',
        tournamentName: 'Copa',
        stageName: 'Final',
        round: 3,
        homeAssignedInscription: { inscriptionId: '10', tournamentId: 't1', displayName: 'Yo' },
        awayAssignedInscription: { inscriptionId: '20', tournamentId: 't1', displayName: 'Ellos' },
      },
    ]);
    vi.mocked(teamInscriptions.lookupInscriptions).mockResolvedValue([
      {
        id: 20,
        tournament_id: 't1',
        competition_id: null,
        display_name: 'Ellos',
        linked_team_id: 2,
        status: 'ACEPTADO',
      },
    ]);
    vi.mocked(teamsApi.lookupTeamsByIds).mockResolvedValue([{ id: 2, name: 'Rival FC' }]);

    render(<HeadToHeadPanel teamId={1} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/^rival$/i)).toBeInTheDocument();
    });
    // Con un solo rival el panel lo preselecciona automáticamente.
    expect(await screen.findByText('Partidos (PJ)')).toBeInTheDocument();
    expect(screen.getAllByText('Rival FC').length).toBeGreaterThan(0);
    expect(await screen.findByText('Copa')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('2–1')).toBeInTheDocument();
  });
});
