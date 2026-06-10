import React from 'react';
import { Card } from '../ui/Card';
import { HeadToHeadPanel } from './HeadToHeadPanel';
import { HistoricalBreakdownTable } from './HistoricalBreakdownTable';
import { TeamHistoryFilterBar } from './TeamHistoryFilterBar';
import { TeamHistoryKpiGrid } from './TeamHistoryKpiGrid';
import { computeHistoricalTotals } from './historicalTotals';
import {
  ALL_FILTER,
  collectTournamentFilterOptions,
  collectYearFilterOptions,
  filterHistoricalMatches,
  type TeamHistoryViewFilters,
} from './teamHistoryFilters';
import { useTeamHistoricalMatches } from './useTeamHistoricalMatches';

export interface TeamHistorySectionProps {
  teamId: number;
  teamName?: string;
}

const DEFAULT_FILTERS: TeamHistoryViewFilters = {
  tournamentId: ALL_FILTER,
  year: ALL_FILTER,
  search: '',
};

/**
 * Bloque unificado Historial + Mano a mano en el home del equipo.
 * Una sola carga de datos, filtros compartidos y KPIs legibles.
 */
export const TeamHistorySection: React.FC<TeamHistorySectionProps> = ({ teamId, teamName }) => {
  const { data, loading, error } = useTeamHistoricalMatches(teamId);
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

  const h2hData = React.useMemo(() => {
    if (!data) return null;
    return { ...data, matches: filteredMatches };
  }, [data, filteredMatches]);

  function patchFilters(patch: Partial<TeamHistoryViewFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  return (
    <Card>
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-lg font-semibold text-text-primary">Historial y rivales</h2>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          Rendimiento acumulado de <span className="font-medium text-text-primary">{teamName || 'tu equipo'}</span>{' '}
          en todos los torneos donde compitió, más la comparación directa contra otros clubes. Solo cuenta
          partidos finalizados con resultado oficial.
        </p>
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-medium text-text-primary">PJ</span> = partidos jugados ·{' '}
          <span className="font-medium text-text-primary">PG / PE / PP</span> = victorias, empates y derrotas ·{' '}
          <span className="font-medium text-text-primary">GF:GC</span> = goles a favor y en contra ·{' '}
          <span className="font-medium text-text-primary">Pts</span> = puntos de tabla (3 por victoria, 1 por empate)
        </p>
      </div>

      {!loading && !error && (data?.matches.length ?? 0) > 0 ? (
        <div className="mt-4">
          <TeamHistoryFilterBar
            filters={filters}
            tournamentOptions={tournamentOptions}
            yearOptions={yearOptions}
            onChange={patchFilters}
            onClear={() => setFilters(DEFAULT_FILTERS)}
          />
        </div>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-text-muted">Cargando historial…</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {!loading && !error && data && data.inscriptionIds.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">Este equipo todavía no tiene inscripciones registradas.</p>
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
          <TeamHistoryKpiGrid totals={totals} caption="Totales con filtros aplicados" />
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted">Desglose por torneo</p>
            <HistoricalBreakdownTable rows={byTournament} />
          </div>
        </div>
      ) : null}

      <div className="mt-8 border-t border-border-subtle pt-6">
        <HeadToHeadPanel
          teamId={teamId}
          embedded
          data={h2hData}
          loading={loading}
          error={error}
          skipOuterFiltersNote
        />
      </div>
    </Card>
  );
};
