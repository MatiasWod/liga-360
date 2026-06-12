import React from 'react';
import {
  getSeriesAggregates,
  type CompetitionSeries,
  type SeriesAggregates,
  type SeriesRollOfHonorRow,
} from '../../../services/tournaments/series';
import { formatKpiNames, topScorersFromSeriesRows, topTitlesFromRows } from './seriesKpis';
import { Button } from '../../../components/ui/Button';
import { CreateNextEditionModal } from '../CreateNextEditionModal';

const NOT_AVAILABLE = '—';

function entryLabel(entry: { displayName?: string } | null | undefined): string {
  return entry?.displayName?.trim() || NOT_AVAILABLE;
}

function KpiCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-border-subtle p-3 ${accent ? 'bg-accent-soft' : 'bg-surface-2'}`}>
      <p className="text-[11px] font-medium text-text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold leading-snug ${accent ? 'text-success-base' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  );
}

function RollOfHonorTable({ rows }: { rows: SeriesRollOfHonorRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-text-muted">Todavía no hay ediciones finalizadas en esta serie.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs text-text-muted">
          <tr>
            <th className="px-3 py-2">Edición</th>
            <th className="px-3 py-2">Campeón</th>
            <th className="px-3 py-2">Subcampeón</th>
            <th className="px-3 py-2">3.er puesto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <tr key={row.tournamentId}>
              <td className="px-3 py-2 font-medium">{row.editionLabel || row.tournamentName}</td>
              <td className="px-3 py-2">{entryLabel(row.champion)}</td>
              <td className="px-3 py-2">{entryLabel(row.runnerUp)}</td>
              <td className="px-3 py-2">{entryLabel(row.thirdPlace)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface SeriesHistoryPageProps {
  series: CompetitionSeries;
  onBack: () => void;
  onOpenEdition: (tournamentId: string) => void;
  onNextEditionCreated?: (payload: {
    tournamentId: string;
    name: string;
    warnings: string[];
    inscriptionsCreated: number;
  }) => void;
}

export const SeriesHistoryPage: React.FC<SeriesHistoryPageProps> = ({
  series,
  onBack,
  onOpenEdition,
  onNextEditionCreated,
}) => {
  const [aggregates, setAggregates] = React.useState<SeriesAggregates | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [nextEditionModalOpen, setNextEditionModalOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getSeriesAggregates(series.id)
      .then((data) => {
        if (!cancelled) setAggregates(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar histórico');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [series.id]);

  const topScorers = topScorersFromSeriesRows(aggregates?.topScorers ?? []);
  const topTitles = topTitlesFromRows(aggregates?.titlesByTeam ?? []);
  const latestFinished = aggregates?.rollOfHonor?.[0] ?? null;

  return (
    <div className="space-y-4">
      {latestFinished ? (
        <CreateNextEditionModal
          open={nextEditionModalOpen}
          onClose={() => setNextEditionModalOpen(false)}
          sourceTournamentId={latestFinished.tournamentId}
          sourceTournamentName={latestFinished.tournamentName}
          sourceEditionLabel={latestFinished.editionLabel}
          seriesId={series.id}
          onSuccess={(result) => {
            onNextEditionCreated?.({
              tournamentId: result.tournament.id,
              name: result.tournament.name,
              warnings: result.warnings,
              inscriptionsCreated: result.inscriptionsCreated,
            });
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-success-base hover:underline">
          ← Volver al histórico
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-text-primary">{series.name}</h3>
          <p className="text-xs text-text-muted">Histórico agregado cross-edición</p>
        </div>
        {latestFinished ? (
          <Button type="button" variant="secondary" onClick={() => setNextEditionModalOpen(true)}>
            Crear próxima edición
          </Button>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-text-muted">Cargando palmarés y récords…</p> : null}
      {error ? <p className="text-sm text-danger-base">{error}</p> : null}

      {aggregates ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard
              label={topTitles.names.length > 1 ? 'Más títulos' : 'Más títulos'}
              value={formatKpiNames(topTitles.names, topTitles.titles, topTitles.titles === 1 ? 'título' : 'títulos')}
              accent
            />
            <KpiCard
              label={topScorers.names.length > 1 ? 'Goleadores históricos' : 'Goleador histórico'}
              value={formatKpiNames(topScorers.names, topScorers.goals, 'goles')}
            />
            <KpiCard
              label="Ediciones finalizadas"
              value={String(aggregates.rollOfHonor.length || NOT_AVAILABLE)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted">Palmarés</p>
            <RollOfHonorTable rows={aggregates.rollOfHonor} />
          </div>

          {aggregates.editionsInProgress.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-text-muted">Ediciones en curso</p>
              <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
                {aggregates.editionsInProgress.map((e) => (
                  <li key={e.tournamentId}>
                    <button
                      type="button"
                      onClick={() => onOpenEdition(e.tournamentId)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-2"
                    >
                      <span>
                        {e.editionLabel ? `Edición ${e.editionLabel}` : e.name}
                        <span className="ml-2 text-xs text-text-subtle">{e.status}</span>
                      </span>
                      <span className="text-success-base">Ver →</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted">Ediciones finalizadas</p>
            <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
              {aggregates.rollOfHonor.map((row) => (
                <li key={row.tournamentId}>
                  <button
                    type="button"
                    onClick={() => onOpenEdition(row.tournamentId)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-2"
                  >
                    <span>
                      {row.editionLabel ? `Edición ${row.editionLabel}` : row.tournamentName}
                      {row.champion ? ` · 🏆 ${row.champion.displayName}` : ''}
                    </span>
                    <span className="text-success-base">Detalle →</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
};
