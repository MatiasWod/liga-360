import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoundSelector } from '../../../components/tournament-schedule/RoundSelector';

describe('RoundSelector', () => {
  const rounds = [
    { id: '1|1', label: 'Fecha 1' },
    { id: '2|1', label: 'Fecha 2' },
    { id: '3|1', label: 'Fecha 3' },
  ];

  it('renderiza un trigger personalizado con la fecha seleccionada', () => {
    render(
      <RoundSelector rounds={rounds} selectedId="1|1" onChange={() => {}} theme="light" />
    );
    expect(screen.getByLabelText('Seleccionar fecha')).toHaveTextContent('Fecha 1');
  });

  it('abre el menú y notifica al elegir otra fecha', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RoundSelector rounds={rounds} selectedId="1|1" onChange={onChange} theme="light" />
    );

    await user.click(screen.getByLabelText('Seleccionar fecha'));
    await user.click(screen.getByRole('option', { name: 'Fecha 2' }));

    expect(onChange).toHaveBeenCalledWith('2|1');
    expect(screen.queryByRole('option', { name: 'Fecha 3' })).not.toBeInTheDocument();
  });
});
