import { describe, expect, it } from 'vitest';
import { filterAdminUsers, formatBannedAt } from '../../../pages/admin/adminUsersFilters';
import type { AdminUser } from '../../../services/admin/adminUsers';

const users: AdminUser[] = [
  { id: 1, username: 'admin', email: 'admin@liga360.com.ar', type: 'admin', isVerified: true, bannedAt: null },
  { id: 2, username: 'lobo_fc', email: 'lobo@example.com', type: 'team', isVerified: true, bannedAt: null },
  { id: 3, username: 'juanp', email: 'juan@example.com', type: 'participant', isVerified: true, bannedAt: '2026-06-12T10:00:00.000Z' },
  { id: 4, username: 'liga_norte', email: 'norte@example.com', type: 'organizer', isVerified: false, bannedAt: null },
];

describe('filterAdminUsers', () => {
  it('sin query ni tipo devuelve todos', () => {
    expect(filterAdminUsers(users, '', 'all')).toHaveLength(4);
  });

  it('filtra por tipo de cuenta', () => {
    expect(filterAdminUsers(users, '', 'team').map((u) => u.id)).toEqual([2]);
    expect(filterAdminUsers(users, '', 'participant').map((u) => u.id)).toEqual([3]);
    expect(filterAdminUsers(users, '', 'organizer').map((u) => u.id)).toEqual([4]);
  });

  it('busca por username, email e id (case-insensitive)', () => {
    expect(filterAdminUsers(users, 'LOBO', 'all').map((u) => u.id)).toEqual([2]);
    expect(filterAdminUsers(users, 'juan@', 'all').map((u) => u.id)).toEqual([3]);
    expect(filterAdminUsers(users, '4', 'all').map((u) => u.id)).toEqual([4]);
  });

  it('busca por etiqueta del tipo', () => {
    expect(filterAdminUsers(users, 'organizador', 'all').map((u) => u.id)).toEqual([4]);
  });

  it('combina query y tipo', () => {
    expect(filterAdminUsers(users, 'example.com', 'team').map((u) => u.id)).toEqual([2]);
    expect(filterAdminUsers(users, 'juan', 'team')).toHaveLength(0);
  });

  it('filtra por estado de baneo', () => {
    expect(filterAdminUsers(users, '', 'all', 'banned').map((u) => u.id)).toEqual([3]);
    expect(filterAdminUsers(users, '', 'all', 'active').map((u) => u.id)).toEqual([1, 2, 4]);
    expect(filterAdminUsers(users, '', 'all', 'all')).toHaveLength(4);
  });

  it('combina estado de baneo con tipo y query', () => {
    expect(filterAdminUsers(users, '', 'participant', 'banned').map((u) => u.id)).toEqual([3]);
    expect(filterAdminUsers(users, '', 'team', 'banned')).toHaveLength(0);
    expect(filterAdminUsers(users, 'juan', 'all', 'active')).toHaveLength(0);
  });
});

describe('formatBannedAt', () => {
  it('formatea un timestamp ISO', () => {
    // No fijamos el formato exacto (depende del locale del runner), solo que no sea el ISO crudo.
    const formatted = formatBannedAt('2026-06-12T10:00:00.000Z');
    expect(formatted).toBeTruthy();
    expect(formatted).not.toBe('2026-06-12T10:00:00.000Z');
  });

  it('devuelve el valor crudo si no es una fecha válida', () => {
    expect(formatBannedAt('no-date')).toBe('no-date');
  });
});
