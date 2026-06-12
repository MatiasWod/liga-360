import React from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { SearchField } from '../../components/ui/SearchField';
import { Table } from '../../components/ui/Table';
import { banUser, listUsers, unbanUser, type AdminUser } from '../../services/admin/adminUsers';
import {
  BAN_FILTER_OPTIONS,
  filterAdminUsers,
  formatBannedAt,
  TYPE_FILTER_OPTIONS,
  TYPE_LABELS,
  type AdminUserBanFilter,
  type AdminUserTypeFilter,
} from './adminUsersFilters';

export const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<AdminUserTypeFilter>('all');
  const [banFilter, setBanFilter] = React.useState<AdminUserBanFilter>('all');
  // Id del usuario con acción de ban/unban en vuelo (deshabilita su botón).
  const [busyUserId, setBusyUserId] = React.useState<number | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setUsers(await listUsers());
      } catch (err: any) {
        setError(err?.message || 'No se pudieron cargar los usuarios');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleUsers = React.useMemo(
    () => filterAdminUsers(users, query, typeFilter, banFilter),
    [users, query, typeFilter, banFilter]
  );

  async function handleToggleBan(user: AdminUser) {
    const banning = !user.bannedAt;
    if (banning && !window.confirm(`¿Banear a "${user.username}"? No podrá iniciar sesión hasta que lo desbanees.`)) {
      return;
    }
    setBusyUserId(user.id);
    setError('');
    try {
      const updated = banning ? await banUser(user.id) : await unbanUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar el usuario');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Usuarios</h1>
          <p className="mt-1 text-sm text-text-muted">
            Administra las cuentas de la plataforma: busca, filtra y banea o desbanea usuarios.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            value={query}
            onChange={setQuery}
            label="Buscar"
            placeholder="Usuario, email, id…"
            className="w-64"
          />
          <FilterDropdown
            label="Tipo de cuenta"
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={(id) => setTypeFilter(id as AdminUserTypeFilter)}
          />
          <FilterDropdown
            label="Estado"
            options={BAN_FILTER_OPTIONS}
            value={banFilter}
            onChange={(id) => setBanFilter(id as AdminUserBanFilter)}
            minWidthClass="min-w-[9rem]"
          />
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-danger-base/40 bg-danger-soft px-3 py-2 text-sm text-danger-base">
          {error}
        </div>
      ) : null}

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-text-muted">Cargando usuarios…</p>
        ) : visibleUsers.length === 0 ? (
          <p className="text-sm text-text-muted">No hay usuarios que coincidan con la búsqueda.</p>
        ) : (
          <Table headers={['Usuario', 'Email', 'Tipo', 'Estado', 'Acciones']}>
            {visibleUsers.map((user) => {
              const banned = Boolean(user.bannedAt);
              return (
                <tr key={user.id} className={banned ? 'bg-danger-soft/20' : undefined}>
                  <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={user.type === 'admin' ? 'warning' : 'default'}>
                      {TYPE_LABELS[user.type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {banned ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="danger">Baneado</Badge>
                        <span className="text-xs text-text-muted">
                          desde {formatBannedAt(user.bannedAt as string)}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="success">Activo</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.type === 'admin' ? (
                      <span className="text-xs text-text-muted">—</span>
                    ) : (
                      <Button
                        variant={banned ? 'secondary' : 'destructive'}
                        disabled={busyUserId === user.id}
                        onClick={() => handleToggleBan(user)}
                        className="px-3 py-1.5"
                      >
                        {banned ? 'Desbanear' : 'Banear'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </div>
    </Card>
  );
};
