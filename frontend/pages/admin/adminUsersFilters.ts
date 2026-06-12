import type { AdminUser } from '../../services/admin/adminUsers';
import type { FilterOption } from '../../components/ui/FilterDropdown';

export type AdminUserTypeFilter = 'all' | 'participant' | 'team' | 'organizer';
export type AdminUserBanFilter = 'all' | 'banned' | 'active';

export const TYPE_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'Todos' },
  { id: 'participant', label: 'Perfiles' },
  { id: 'team', label: 'Equipos' },
  { id: 'organizer', label: 'Organizadores' },
];

export const BAN_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'banned', label: 'Baneados' },
];

export const TYPE_LABELS: Record<AdminUser['type'], string> = {
  participant: 'Perfil',
  team: 'Equipo',
  organizer: 'Organizador',
  admin: 'Admin',
};

/**
 * Filtro combinado del listado de usuarios: por tipo de cuenta, por estado de baneo y por
 * texto libre sobre username, email, id y etiqueta del tipo (la "info básica" de la tabla).
 */
export function filterAdminUsers(
  users: AdminUser[],
  query: string,
  typeFilter: AdminUserTypeFilter,
  banFilter: AdminUserBanFilter = 'all'
): AdminUser[] {
  const q = query.trim().toLowerCase();
  return users.filter((user) => {
    if (typeFilter !== 'all' && user.type !== typeFilter) return false;
    if (banFilter === 'banned' && !user.bannedAt) return false;
    if (banFilter === 'active' && user.bannedAt) return false;
    if (!q) return true;
    return (
      user.username.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      String(user.id).includes(q) ||
      TYPE_LABELS[user.type].toLowerCase().includes(q)
    );
  });
}

export function formatBannedAt(bannedAt: string): string {
  const date = new Date(bannedAt);
  if (Number.isNaN(date.getTime())) return bannedAt;
  return date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}
