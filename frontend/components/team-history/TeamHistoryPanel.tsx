import React from 'react';
import { Card } from '../ui/Card';
import { TeamHistoryFilterBar } from './TeamHistoryFilterBar';
import { TeamHistoryKpiGrid } from './TeamHistoryKpiGrid';
import { HistoricalBreakdownTable } from './HistoricalBreakdownTable';
import { computeHistoricalTotals } from './historicalTotals';
import {
  ALL_FILTER,
  collectTournamentFilterOptions,
  collectYearFilterOptions,
  filterHistoricalMatches,
  type TeamHistoryViewFilters,
} from './teamHistoryFilters';
import { useTeamHistoricalMatches, type TeamHistoricalData } from './useTeamHistoricalMatches';

const DEFAULT_FILTERS: TeamHistoryViewFilters = {
  tournamentId: ALL_FILTER,
  year: ALL_FILTER,
  search: '',
};

export interface TeamHistoryPanelProps {
  teamId: number;
  /** Si true, no envuelve en Card (p. ej. dentro de otro layout). */
  embedded?: boolean;
  /** Datos externos para evitar doble fetch cuando ya los tiene el padre. */
  data?: TeamHistoricalData | null;
  loading?: boolean;
  error?: string;
}

/**
 * Totales históricos del equipo (cross-torneo) y desglose por torneo/competencia.
 * Vista pública: solo partidos finalizados con inscripciones físicas.
 */
export const TeamHistoryPanel: React.FC<TeamHistoryPanelProps> = ({
  teamId,
  embedded = false,
  data: externalData,
  loading: externalLoading,
  error: externalError,
}) => {
  const internal = useTeamHistoricalMatches(externalData !== undefined ? null : teamId);
  const data = externalData !== undefined ? externalData : internal.data;
  const loading = externalLoading ?? internal.loading;
  const error = externalError ?? internal.error;

  const [filters, setFilters] = React.useState<TeamHistoryViewFilters>(DEFAULT_FILTERS);

  const tournamentOptions = React.useMemo(
    () => collectTournamentFilterOptions(data?.matches ?? []),
    [data?.matches]
  );
  const yearOptions = React.useMemo(
    () => collectYearFilterOptions(data?.matches ?? []),
    [data?.matches]
  );

  const filteredMatches = React.useMemo(
    () => filterHistoricalMatches(data?.matches ?? [], filters),
    [data?.matches, filters]
  );

  const { totals, byTournament } = React.useMemo(() => {
    if (!data) return { totals: null, byTournament: [] };
    return computeHistoricalTotals(filteredMatches, data.inscriptionIds, data.inscriptions);
  }, [data, filteredMatches]);

  const body = (
    <>
      <h3 className="text-base font-semibold text-text-primary">Historia del equipo</h3>
      <p className="mt-1 text-sm text-text-muted">
        Totales acumulados en todos los torneos donde participó (solo partidos finalizados).
      </p>

      {loading ? <p className="mt-3 text-sm text-text-muted">Cargando historial…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data && data.inscriptionIds.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Este equipo todavía no tiene inscripciones registradas.</p>
      ) : null}

      {!loading && !error && (data?.matches.length ?? 0) > 0 ? (
        <div className="mt-4">
          <TeamHistoryFilterBar
            filters={filters}
            tournamentOptions={tournamentOptions}
            yearOptions={yearOptions}
            onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
            onClear={() => setFilters(DEFAULT_FILTERS)}
          />
        </div>
      ) : null}

      {!loading && !error && totals && totals.played === 0 && data && data.inscriptionIds.length > 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-text-muted">
          {filters.tournamentId !== ALL_FILTER || filters.year !== ALL_FILTER || filters.search.trim()
            ? 'Ningún partido finalizado coincide con los filtros.'
            : 'Todavía no hay partidos finalizados registrados para este equipo.'}
        </p>
      ) : null}

      {!loading && !error && totals && totals.played > 0 ? (
        <div className="mt-5 space-y-5">
          <TeamHistoryKpiGrid totals={totals} />
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted">Desglose por torneo</p>
            <HistoricalBreakdownTable rows={byTournament} />
          </div>
        </div>
      ) : null}
    </>
  );

  if (embedded) return <div>{body}</div>;
  return <Card>{body}</Card>;
};
