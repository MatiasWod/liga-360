import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TournamentsList } from './TournamentsList';

const tournamentsMock = [
  {
    id: 't-team-1',
    name: 'Torneo Equipos A',
    venue: 'Sede A',
    organizer: 'org1',
    participantType: 'teams',
    inscriptionMode: 'public',
    competitions: [],
  },
  {
    id: 't-team-2',
    name: 'Torneo Equipos B',
    venue: 'Sede B',
    organizer: 'org1',
    participantType: 'team',
    inscriptionMode: 'invitation',
    competitions: [],
  },
  {
    id: 't-ind-1',
    name: 'Torneo Participantes A',
    venue: 'Sede C',
    organizer: 'org2',
    participantType: 'individuals',
    inscriptionMode: 'public',
    competitions: [],
  },
  {
    id: 't-ind-2',
    name: 'Torneo Participantes B',
    venue: 'Sede D',
    organizer: 'org2',
    participantType: 'participant',
    inscriptionMode: 'public',
    competitions: [],
  },
];

function mockGraphqlTournaments() {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ data: { tournaments: tournamentsMock } }),
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TournamentsList filters', () => {
  it('filtra por participantType teams con normalización', async () => {
    mockGraphqlTournaments();

    render(<TournamentsList participantTypeFilter="teams" />);

    await waitFor(() => {
      expect(screen.getByText('Torneo Equipos A')).toBeInTheDocument();
    });
    expect(screen.getByText('Torneo Equipos B')).toBeInTheDocument();
    expect(screen.queryByText('Torneo Participantes A')).not.toBeInTheDocument();
    expect(screen.queryByText('Torneo Participantes B')).not.toBeInTheDocument();
  });

  it('filtra por participantType individuals con normalización', async () => {
    mockGraphqlTournaments();

    render(<TournamentsList participantTypeFilter="individuals" />);

    await waitFor(() => {
      expect(screen.getByText('Torneo Participantes A')).toBeInTheDocument();
    });
    expect(screen.getByText('Torneo Participantes B')).toBeInTheDocument();
    expect(screen.queryByText('Torneo Equipos A')).not.toBeInTheDocument();
    expect(screen.queryByText('Torneo Equipos B')).not.toBeInTheDocument();
  });

  it('aplica idsFilter y excludeIdsFilter', async () => {
    mockGraphqlTournaments();

    render(
      <TournamentsList
        idsFilter={['t-team-1', 't-ind-1', 't-ind-2']}
        excludeIdsFilter={['t-ind-2']}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Torneo Equipos A')).toBeInTheDocument();
    });
    expect(screen.getByText('Torneo Participantes A')).toBeInTheDocument();
    expect(screen.queryByText('Torneo Participantes B')).not.toBeInTheDocument();
    expect(screen.queryByText('Torneo Equipos B')).not.toBeInTheDocument();
  });
});
