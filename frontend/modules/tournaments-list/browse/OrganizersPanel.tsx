import React from 'react';
import { filterOrganizersByQuery, type OrganizerIndexEntry } from './organizersIndex';

export type OrganizersPanelProps = {
  organizers: OrganizerIndexEntry[];
  loading?: boolean;
  error?: string | null;
  selectedOrganizer: string | null;
  onSelectOrganizer: (organizer: string | null) => void;
  currentUserOrganizer?: string;
  variant?: 'light' | 'dark';
  className?: string;
};

function panelClass(variant: 'light' | 'dark'): string {
  return variant === 'light'
    ? 'border-slate-200 bg-white text-[#0F2A33]'
    : 'border-border-subtle bg-surface-1 text-text-primary';
}

function searchClass(variant: 'light' | 'dark'): string {
  return variant === 'light'
    ? 'border-slate-200 bg-white text-[#0F2A33] placeholder:text-slate-400 focus:border-[#2E7D32] focus:ring-[#2E7D32]/30'
    : 'border-white/15 bg-surface-2 text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:ring-accent-primary/40';
}

function itemClass(variant: 'light' | 'dark', selected: boolean): string {
  if (variant === 'light') {
    return selected
      ? 'border-[#2E7D32]/30 bg-[#2E7D32]/10 text-[#0F2A33]'
      : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900';
  }
  return selected
    ? 'border-accent-primary/30 bg-accent-soft text-text-primary'
    : 'border-transparent text-text-muted hover:border-border-subtle hover:bg-surface-2 hover:text-text-primary';
}

export const OrganizersPanel: React.FC<OrganizersPanelProps> = ({
  organizers,
  loading = false,
  error = null,
  selectedOrganizer,
  onSelectOrganizer,
  currentUserOrganizer,
  variant = 'dark',
  className = '',
}) => {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(
    () => filterOrganizersByQuery(organizers, query),
    [organizers, query]
  );

  const currentUserKey = (currentUserOrganizer || '').trim().toLowerCase();

  return (
    <aside
      className={`flex w-full shrink-0 flex-col rounded-xl border lg:w-64 xl:w-72 ${panelClass(variant)} ${className}`}
      aria-label="Organizadores"
    >
      <div className="border-b border-inherit px-4 py-3">
        <h3 className="text-sm font-semibold">Organizadores</h3>
        <p className="mt-0.5 text-xs opacity-70">Filtrá torneos por quien los organiza</p>
        <p className="mt-1 text-[10px] opacity-60">Números: activos · finalizados</p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar organizador…"
          className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 ${searchClass(variant)}`}
        />
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2 lg:max-h-[calc(100vh-18rem)]">
        <button
          type="button"
          onClick={() => onSelectOrganizer(null)}
          className={`mb-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${itemClass(variant, selectedOrganizer === null)}`}
        >
          <span className="font-medium">Todos</span>
          <span className="text-xs opacity-70">{organizers.reduce((sum, row) => sum + row.totalCount, 0)}</span>
        </button>

        {loading ? (
          <p className="px-3 py-4 text-sm opacity-70">Cargando organizadores…</p>
        ) : error ? (
          <p className="px-3 py-4 text-sm text-red-500">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-sm opacity-70">No hay organizadores que coincidan.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((entry) => {
              const selected =
                selectedOrganizer != null &&
                selectedOrganizer.trim().toLowerCase() === entry.name.toLowerCase();
              const isCurrentUser = currentUserKey === entry.name.toLowerCase();

              return (
                <li key={entry.name}>
                  <button
                    type="button"
                    onClick={() => onSelectOrganizer(entry.name)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${itemClass(variant, selected)}`}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {entry.name}
                      {isCurrentUser ? (
                        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          (vos)
                        </span>
                      ) : null}
                    </span>
                    <span
                      className="shrink-0 text-[11px] tabular-nums opacity-70"
                      title={`${entry.activeCount} activo${entry.activeCount === 1 ? '' : 's'}, ${entry.finishedCount} finalizado${entry.finishedCount === 1 ? '' : 's'}`}
                    >
                      <span className="text-brand-greenAccent">{entry.activeCount}</span>
                      <span className="mx-0.5 opacity-50">·</span>
                      <span>{entry.finishedCount}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
};
