import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from '../../../pages/admin/AdminUsersPage';
import type { AdminUser } from '../../../services/admin/adminUsers';

const listUsersMock = vi.fn();
const banUserMock = vi.fn();
const unbanUserMock = vi.fn();

vi.mock('../../../services/admin/adminUsers', () => ({
  listUsers: (...args: unknown[]) => listUsersMock(...args),
  banUser: (...args: unknown[]) => banUserMock(...args),
  unbanUser: (...args: unknown[]) => unbanUserMock(...args),
}));

const baseUsers: AdminUser[] = [
  { id: 1, username: 'admin', email: 'admin@liga360.com.ar', type: 'admin', isVerified: true, bannedAt: null },
  { id: 2, username: 'lobo_fc', email: 'lobo@example.com', type: 'team', isVerified: true, bannedAt: null },
  { id: 3, username: 'juanp', email: 'juan@example.com', type: 'participant', isVerified: true, bannedAt: '2026-06-12T10:00:00.000Z' },
];

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminUsersPage', () => {
  it('lista usuarios con estado y timestamp de baneo', async () => {
    listUsersMock.mockResolvedValue(baseUsers);
    render(<AdminUsersPage />);

    expect(await screen.findByText('lobo_fc')).toBeInTheDocument();
    expect(screen.getByText('Baneado')).toBeInTheDocument();
    expect(screen.getByText(/desde /)).toBeInTheDocument();
    // El admin no tiene botón de ban; los demás sí.
    expect(screen.getByRole('button', { name: 'Banear' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desbanear' })).toBeInTheDocument();
  });

  it('banea con confirmación y actualiza la fila', async () => {
    listUsersMock.mockResolvedValue(baseUsers);
    banUserMock.mockResolvedValue({ ...baseUsers[1], bannedAt: '2026-06-12T12:00:00.000Z' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminUsersPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Banear' }));

    await waitFor(() => expect(banUserMock).toHaveBeenCalledWith(2));
    expect(await screen.findAllByText('Baneado')).toHaveLength(2);
  });

  it('no banea si se cancela la confirmación', async () => {
    listUsersMock.mockResolvedValue(baseUsers);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminUsersPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Banear' }));

    expect(banUserMock).not.toHaveBeenCalled();
  });

  it('desbanea sin confirmación', async () => {
    listUsersMock.mockResolvedValue(baseUsers);
    unbanUserMock.mockResolvedValue({ ...baseUsers[2], bannedAt: null });
    render(<AdminUsersPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Desbanear' }));

    await waitFor(() => expect(unbanUserMock).toHaveBeenCalledWith(3));
    expect(screen.queryByText('Baneado')).not.toBeInTheDocument();
  });

  it('filtra por texto', async () => {
    listUsersMock.mockResolvedValue(baseUsers);
    render(<AdminUsersPage />);
    await screen.findByText('lobo_fc');

    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'juan' } });

    expect(screen.queryByText('lobo_fc')).not.toBeInTheDocument();
    expect(screen.getByText('juanp')).toBeInTheDocument();
  });

  it('muestra el error del backend si la carga falla', async () => {
    listUsersMock.mockRejectedValue(new Error('token requerido'));
    render(<AdminUsersPage />);

    expect(await screen.findByText('token requerido')).toBeInTheDocument();
  });
});
