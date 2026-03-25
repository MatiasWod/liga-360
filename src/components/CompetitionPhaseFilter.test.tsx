import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CompetitionPhaseFilter,
  type Competition,
  type CompetitionPhaseFilterChange,
} from './CompetitionPhaseFilter';

const competitions: Competition[] = [
  {
    id: 'comp-1',
    name: 'Primera Division',
    phases: [
      { id: 'fase-a', name: 'Apertura' },
      { id: 'fase-b', name: 'Clausura' },
    ],
  },
  {
    id: 'comp-2',
    name: 'Copa de Oro',
    phases: [{ id: 'fase-c', name: 'Fase Final' }],
  },
];

describe('CompetitionPhaseFilter', () => {
  it('emite onChange con modo y fases seleccionadas', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(filters: CompetitionPhaseFilterChange) => void>();

    render(<CompetitionPhaseFilter competitions={competitions} onChange={onChange} />);

    const toggle = screen.getByRole('button', { name: 'Desplegar filtro de fases' });
    await user.click(toggle);
    await user.click(screen.getByRole('checkbox', { name: 'Alternar fase Apertura de Primera Division' }));
    await user.click(screen.getByRole('button', { name: 'No mostrar' }));

    await waitFor(() => {
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(lastCallArg).toEqual({
        mode: 'exclude',
        selections: [{ competitionId: 'comp-1', phaseId: 'fase-a' }],
      });
    });
  });

  it('permite seleccionar todas las fases desde la competencia', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(filters: CompetitionPhaseFilterChange) => void>();

    render(<CompetitionPhaseFilter competitions={competitions} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Desplegar filtro de fases' }));
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar todas las fases de Primera Division' }));

    await waitFor(() => {
      const lastCallArg = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
      expect(lastCallArg?.selections).toEqual(
        expect.arrayContaining([
          { competitionId: 'comp-1', phaseId: 'fase-a' },
          { competitionId: 'comp-1', phaseId: 'fase-b' },
        ])
      );
    });
  });
});
