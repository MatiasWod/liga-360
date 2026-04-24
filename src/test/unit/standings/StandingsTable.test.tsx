import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StandingsTable } from '../../../components/standings';

const rows = [
  {
    position: 1,
    inscriptionId: 'ins-1',
    displayName: 'Atlas',
    played: 2,
    won: 2,
    drawn: 0,
    lost: 0,
    goalsFor: 5,
    goalsAgainst: 1,
    goalDifference: 4,
    points: 6,
  },
  {
    position: 2,
    inscriptionId: 'ins-2',
    displayName: 'Boca',
    played: 2,
    won: 1,
    drawn: 0,
    lost: 1,
    goalsFor: 2,
    goalsAgainst: 2,
    goalDifference: 0,
    points: 3,
  },
  {
    position: 3,
    inscriptionId: 'ins-3',
    displayName: 'Colon',
    played: 2,
    won: 0,
    drawn: 0,
    lost: 2,
    goalsFor: 1,
    goalsAgainst: 5,
    goalDifference: -4,
    points: 0,
  },
];

describe('StandingsTable', () => {
  it('renderiza una fila por row con valores en columnas', () => {
    render(<StandingsTable rows={rows} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Atlas')).toBeInTheDocument();
    expect(screen.getByText('Boca')).toBeInTheDocument();
    expect(screen.getByText('Colon')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('resalta filas con position <= 2', () => {
    render(<StandingsTable rows={rows} />);
    const atlasRow = screen.getByText('Atlas').closest('tr');
    const bocaRow = screen.getByText('Boca').closest('tr');
    const colonRow = screen.getByText('Colon').closest('tr');
    expect(atlasRow?.className).toContain('bg-brand-green/10');
    expect(bocaRow?.className).toContain('bg-brand-green/10');
    expect(colonRow?.className).not.toContain('bg-brand-green/10');
  });

  it('no renderiza tabla cuando rows es vacio', () => {
    const { queryByRole } = render(<StandingsTable rows={[]} />);
    expect(queryByRole('table')).toBeNull();
  });

  it('aplica clases de texto dark theme', () => {
    const { container } = render(<StandingsTable rows={rows} theme="dark" />);
    expect(container.firstElementChild?.className).toContain('bg-white/5');
    expect(container.querySelector('table')?.className).toContain('text-white/90');
  });
});
