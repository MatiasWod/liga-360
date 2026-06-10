import React from 'react';
import { FilterDropdown } from '../ui/FilterDropdown';
import { SearchField } from '../ui/SearchField';
import {
  ALL_FILTER,
  hasActiveTeamHistoryFilters,
  type TeamHistoryViewFilters,
} from './teamHistoryFilters';

export interface TeamHistoryFilterBarProps {
  filters: TeamHistoryViewFilters;
  tournamentOptions: { id: string; label: string }[];
  yearOptions: { id: string; label: string }[];
  onChange: (patch: Partial<TeamHistoryViewFilters>) => void;
  onClear: () => void;
}

export const TeamHistoryFilterBar: React.FC<TeamHistoryFilterBarProps> = ({
  filters,
  tournamentOptions,
  yearOptions,
  onChange,
  onClear,
}) => {
  const active = hasActiveTeamHistoryFilters(filters);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tournamentOptions.length > 0 ? (
          <FilterDropdown
            label="Torneo"
            value={
              filters.tournamentId === ALL_FILTER ||
              tournamentOptions.some((o) => o.id === filters.tournamentId)
                ? filters.tournamentId
                : ALL_FILTER
            }
            onChange={(id) => onChange({ tournamentId: id })}
            options={[{ id: ALL_FILTER, label: 'Todos los torneos' }, ...tournamentOptions]}
            searchable={tournamentOptions.length > 4}
          />
        ) : null}
        {yearOptions.length > 0 ? (
          <FilterDropdown
            label="Año"
            value={
              filters.year === ALL_FILTER || yearOptions.some((o) => o.id === filters.year)
                ? filters.year
                : ALL_FILTER
            }
            onChange={(id) => onChange({ year: id })}
            options={[{ id: ALL_FILTER, label: 'Todos los años' }, ...yearOptions]}
          />
        ) : null}
        <SearchField
          label="Buscar"
          value={filters.search}
          onChange={(search) => onChange({ search })}
          placeholder="Torneo, rival, fecha…"
          className="sm:col-span-2 lg:col-span-2"
        />
      </div>

      {active ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Filtros activos:</span>
          {filters.tournamentId !== ALL_FILTER ? (
            <FilterChip
              label={tournamentOptions.find((o) => o.id === filters.tournamentId)?.label ?? 'Torneo'}
              onRemove={() => onChange({ tournamentId: ALL_FILTER })}
            />
          ) : null}
          {filters.year !== ALL_FILTER ? (
            <FilterChip
              label={yearOptions.find((o) => o.id === filters.year)?.label ?? filters.year}
              onRemove={() => onChange({ year: ALL_FILTER })}
            />
          ) : null}
          {filters.search.trim() ? (
            <FilterChip
              label={`"${filters.search.trim()}"`}
              onRemove={() => onChange({ search: '' })}
            />
          ) : null}
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-accent-primary hover:underline"
          >
            Limpiar todo
          </button>
        </div>
      ) : null}
    </div>
  );
};

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-full border border-accent-primary/40 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-success-base hover:bg-accent-soft/80"
    >
      {label}
      <span aria-hidden>×</span>
    </button>
  );
}
