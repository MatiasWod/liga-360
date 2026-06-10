import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MatchPresenceEditor } from '../../../modules/team-presences/MatchPresenceEditor';
import * as presencesApi from '../../../services/matchEvents/presences';
import type { TeamParticipant } from '../../../types/domain';

vi.mock('../../../services/matchEvents/presences', () => ({
  listMatchPresences: vi.fn(),
  replaceMatchPresences: vi.fn(),
}));

const roster: TeamParticipant[] = [
  { id: '100', firstName: 'Juan', lastName: 'Pérez', status: 'activo' as any },
  { id: '101', firstName: 'Carlos', lastName: 'Gómez', status: 'activo' as any },
];

const baseProps = {
  matchId: 'm1',
  tournamentId: 't1',
  competitionId: 'c1',
  inscriptionId: 10,
  matchLabel: 'Equipo A vs Equipo B',
  roster,
  onClose: vi.fn(),
};

describe('MatchPresenceEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(presencesApi.listMatchPresences).mockResolvedValue([
      {
        id: 1,
        match_id: 'm1',
        tournament_id: 't1',
        competition_id: 'c1',
        inscription_id: 10,
        linked_member_id: 100,
        display_name: 'Juan Pérez',
        is_guest: false,
      },
      {
        id: 2,
        match_id: 'm1',
        tournament_id: 't1',
        competition_id: 'c1',
        inscription_id: 10,
        linked_member_id: null,
        display_name: 'Invitado X',
        is_guest: true,
      },
      // Presencia de otra inscripción: no debe aparecer marcada
      {
        id: 3,
        match_id: 'm1',
        tournament_id: 't1',
        competition_id: 'c1',
        inscription_id: 20,
        linked_member_id: 999,
        display_name: 'Rival',
        is_guest: false,
      },
    ]);
    vi.mocked(presencesApi.replaceMatchPresences).mockResolvedValue([]);
  });

  it('precarga checks de la plantilla e invitados solo de la propia inscripción', async () => {
    render(<MatchPresenceEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].checked).toBe(true); // Juan presente
    expect(checkboxes[1].checked).toBe(false); // Carlos no
    expect(screen.getByText('Invitado X')).toBeTruthy();
    expect(screen.queryByText('Rival')).toBeNull();
  });

  it('guardar envía el reemplazo bulk con presentes e invitados (snapshot de nombre)', async () => {
    render(<MatchPresenceEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());

    // Marcar también a Carlos
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByText('Guardar presencias'));

    await waitFor(() => expect(presencesApi.replaceMatchPresences).toHaveBeenCalledTimes(1));
    const [matchId, payload] = vi.mocked(presencesApi.replaceMatchPresences).mock.calls[0];
    expect(matchId).toBe('m1');
    expect(payload.inscription_id).toBe(10);
    expect(payload.entries).toEqual([
      { linked_member_id: 100, display_name: 'Juan Pérez', is_guest: false },
      { linked_member_id: 101, display_name: 'Carlos Gómez', is_guest: false },
      { linked_member_id: null, display_name: 'Invitado X', is_guest: true },
    ]);
  });

  it('permite agregar un invitado nuevo antes de guardar', async () => {
    render(<MatchPresenceEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());

    fireEvent.change(screen.getByPlaceholderText('Nombre del invitado'), { target: { value: 'Invitado Nuevo' } });
    fireEvent.click(screen.getByText('Agregar'));
    fireEvent.click(screen.getByText('Guardar presencias'));

    await waitFor(() => expect(presencesApi.replaceMatchPresences).toHaveBeenCalled());
    const [, payload] = vi.mocked(presencesApi.replaceMatchPresences).mock.calls[0];
    expect(payload.entries).toContainEqual({ linked_member_id: null, display_name: 'Invitado Nuevo', is_guest: true });
  });

  it('muestra el error del backend (p. ej. 403 de no-dueño)', async () => {
    vi.mocked(presencesApi.replaceMatchPresences).mockRejectedValue(new Error('solo el dueño del equipo puede editar presencias'));
    render(<MatchPresenceEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());

    fireEvent.click(screen.getByText('Guardar presencias'));
    await waitFor(() => expect(screen.getByText(/solo el dueño del equipo/i)).toBeTruthy());
  });
});
