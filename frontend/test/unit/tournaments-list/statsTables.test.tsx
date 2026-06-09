import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScorersTable } from '../../../modules/tournaments-list/stats/ScorersTable';
import { CardsTable } from '../../../modules/tournaments-list/stats/CardsTable';

const nameById = new Map([['10', 'Boca Norte']]);

describe('ScorersTable', () => {
  it('muestra empty state sin goles', () => {
    render(<ScorersTable rows={[]} nameById={nameById} />);
    expect(screen.getByText(/no hay goles registrados/i)).toBeTruthy();
  });

  it('renderiza filas con equipo resuelto y legacy con "—"', () => {
    render(
      <ScorersTable
        rows={[
          { playerKey: 'member:100', displayName: 'Juan Pérez', inscriptionId: 10, linkedMemberId: 100, goals: 5 },
          { playerKey: 'name:-:sin atribuir', displayName: 'Sin Atribuir', inscriptionId: null, linkedMemberId: null, goals: 1 },
        ]}
        nameById={nameById}
      />
    );
    expect(screen.getByText('Juan Pérez')).toBeTruthy();
    expect(screen.getByText('Boca Norte')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('clickear el equipo dispara onSelectTeam con el inscriptionId', () => {
    const onSelect = vi.fn();
    render(
      <ScorersTable
        rows={[{ playerKey: 'member:100', displayName: 'Juan', inscriptionId: 10, linkedMemberId: 100, goals: 2 }]}
        nameById={nameById}
        onSelectTeam={onSelect}
      />
    );
    fireEvent.click(screen.getByText('Boca Norte'));
    expect(onSelect).toHaveBeenCalledWith('10');
  });
});

describe('CardsTable', () => {
  it('muestra empty state sin tarjetas', () => {
    render(<CardsTable rows={[]} nameById={nameById} />);
    expect(screen.getByText(/no hay tarjetas ni sanciones/i)).toBeTruthy();
  });

  it('renderiza amarillas, rojas y fechas de suspensión', () => {
    render(
      <CardsTable
        rows={[
          {
            playerKey: 'name:10:carlos',
            displayName: 'Carlos Gómez',
            inscriptionId: 10,
            linkedMemberId: null,
            yellowCards: 2,
            redCards: 1,
            suspensionMatches: 3,
          },
        ]}
        nameById={nameById}
      />
    );
    expect(screen.getByText('Carlos Gómez')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
