import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StandingsTable } from '../../../components/standings';
import type { ClassificationZone } from '../../../components/standings';

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

  it('aplica color de zona a las filas dentro del rango', () => {
    const zones: ClassificationZone[] = [
      { fromPos: 1, toPos: 2, label: '→ Final', colorIndex: 0 },
    ];
    render(<StandingsTable rows={rows} zones={zones} />);
    const atlasRow = screen.getByText('Atlas').closest('tr');
    const bocaRow  = screen.getByText('Boca').closest('tr');
    const colonRow = screen.getByText('Colon').closest('tr');
    expect(atlasRow?.className).toContain('border-l-emerald-500');
    expect(bocaRow?.className).toContain('border-l-emerald-500');
    expect(colonRow?.className).not.toContain('border-l-emerald-500');
    expect(colonRow?.className).toContain('border-l-transparent');
  });

  it('muestra la leyenda de zonas debajo de la tabla', () => {
    const zones: ClassificationZone[] = [
      { fromPos: 1, toPos: 1, label: '→ Liguilla', colorIndex: 0 },
    ];
    render(<StandingsTable rows={rows} zones={zones} />);
    expect(screen.getByText('→ Liguilla')).toBeInTheDocument();
  });

  it('no renderiza tabla cuando rows es vacio', () => {
    const { queryByRole } = render(<StandingsTable rows={[]} />);
    expect(queryByRole('table')).toBeNull();
  });

  it('aplica clases de tokens dark por defecto', () => {
    const { container } = render(<StandingsTable rows={rows} />);
    const tableWrapper = container.querySelector('.overflow-x-auto');
    expect(tableWrapper?.className).toContain('bg-surface-1');
    expect(container.querySelector('table')?.className).toContain('text-text-primary');
  });
});
