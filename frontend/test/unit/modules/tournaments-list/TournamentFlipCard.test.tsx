import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TournamentFlipCard } from '../../../../modules/tournaments-list/TournamentFlipCard';

vi.mock('../../../../services/tournamentsApi', () => ({
  getTournamentDetailById: vi.fn().mockResolvedValue(null),
}));

describe('TournamentFlipCard edition display', () => {
  it('muestra edición desde season cuando no hay editionLabel', () => {
    render(
      <TournamentFlipCard
        tournament={{
          id: 't-1',
          name: 'Liga Demo',
          season: '2026',
          status: 'published',
          competitions: [],
        }}
      />
    );

    expect(screen.getAllByText(/Edición 2026/).length).toBeGreaterThan(0);
  });

  it('prioriza editionLabel sobre season', () => {
    render(
      <TournamentFlipCard
        tournament={{
          id: 't-2',
          name: 'Mundial',
          season: '2022',
          editionLabel: '2022',
          status: 'finished',
          competitions: [],
        }}
      />
    );

    expect(screen.getAllByText(/Edición 2022/).length).toBeGreaterThan(0);
  });

  it('combina serie y edición en la etiqueta', () => {
    render(
      <TournamentFlipCard
        tournament={{
          id: 't-3',
          name: 'Mundial Qatar',
          seriesName: 'Mundial FIFA',
          editionLabel: '2022',
          status: 'finished',
          competitions: [],
        }}
      />
    );

    expect(screen.getAllByText('Mundial FIFA · Edición 2022').length).toBeGreaterThan(0);
  });
});
