import React from 'react';
import { getScorerStats, type ScorerStatsRow } from '../../../services/matchEvents/stats';
import type { TournamentCompetition } from '../types';
import { getCompetitionSeriesById } from '../../../services/tournaments/series';
import {
  computeFinalPlacements,
  type PodiumEntry,
  type StageFinalPlacements,
} from './finalPlacements';

const NOT_AVAILABLE = '—';

export interface CompetitionHistoryPanelProps {
  tournamentId: string;
  competition: TournamentCompetition | null;
  /** Lookup inscriptionId → nombre (Postgres + grafo) ya armado por TournamentDetail. */
  nameById: Map<string, string>;
  seriesId?: string | null;
  editionLabel?: string | null;
  onViewSeries?: (seriesId: string) => void;
}

function entryName(entry: PodiumEntry | null, nameById: Map<string, string>): string {
  if (!entry) return NOT_AVAILABLE;
  return nameById.get(entry.inscriptionId) || entry.displayName || NOT_AVAILABLE;
}

/** Todos los empatados en el máximo de goles (> 0); vacío si no hay goles registrados. */
export function topScorersFromRows(rows: ScorerStatsRow[]): { names: string[]; goals: number } {
  const maxGoals = rows.reduce((acc, r) => Math.max(acc, Number(r.goals) || 0), 0);
  if (maxGoals <= 0) return { names: [], goals: 0 };
  return {
    names: rows.filter((r) => Number(r.goals) === maxGoals).map((r) => r.displayName),
    goals: maxGoals,
  };
}

function KpiCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-border-subtle p-3 ${
        accent ? 'bg-accent-soft/40' : 'bg-surface-2'
      }`}
    >
      <p className="text-[11px] font-medium text-text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold leading-snug ${
          accent ? 'text-success-base' : 'text-text-primary'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StagePodium({ stage, nameById }: { stage: Extract<StageFinalPlacements, { kind: 'podium' }>; nameById: Map<string, string> }) {
  const rows: { medal: string; label: string; entry: PodiumEntry | null }[] = [
    { medal: '🏆', label: 'Campeón', entry: stage.champion },
    { medal: '🥈', label: 'Subcampeón', entry: stage.runnerUp },
    ...(stage.thirdPlace ? [{ medal: '🥉', label: '3er puesto', entry: stage.thirdPlace }] : []),
  ];
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 divide-y divide-border-subtle">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 px-3 py-2 text-sm">
          <span aria-hidden="true">{r.medal}</span>
          <span className="text-text-muted text-xs w-24">{r.label}</span>
          <span className="font-medium text-text-primary">{entryName(r.entry, nameById)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Histórico de una Competencia de un torneo finalizado: campeón/subcampeón/3er
 * puesto derivados client-side, goleador(es) y posiciones finales por etapa.
 * Dato no derivable → "—", nunca estimado. Lecturas públicas: funciona sin sesión.
 */
export const CompetitionHistoryPanel: React.FC<CompetitionHistoryPanelProps> = ({
  tournamentId,
  competition,
  nameById,
  seriesId,
  editionLabel,
  onViewSeries,
}) => {
  const competitionId = competition?.id ?? null;
  const [scorers, setScorers] = React.useState<ScorerStatsRow[]>([]);
  const [scorersError, setScorersError] = React.useState('');
  const [loadingScorers, setLoadingScorers] = React.useState(true);
  const [seriesName, setSeriesName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!seriesId) {
      setSeriesName(null);
      return;
    }
    let cancelled = false;
    getCompetitionSeriesById(seriesId)
      .then((s) => {
        if (!cancelled) setSeriesName(s?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setSeriesName(null);
      });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  React.useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;
    setLoadingScorers(true);
    setScorersError('');
    getScorerStats(tournamentId, competitionId)
      .then((rows) => {
        if (!cancelled) setScorers(rows);
      })
      .catch((e) => {
        if (!cancelled) setScorersError(e instanceof Error ? e.message : 'Error al cargar goleadores');
      })
      .finally(() => {
        if (!cancelled) setLoadingScorers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, competitionId]);

  const placements = React.useMemo(() => computeFinalPlacements(competition), [competition]);

  if (!competitionId) {
    return <p className="py-3 text-sm text-text-muted">No hay competencias en este torneo.</p>;
  }

  const top = topScorersFromRows(scorers);
  const scorerValue = loadingScorers
    ? '…'
    : top.names.length === 0
      ? NOT_AVAILABLE
      : `${top.names.join(', ')} (${top.goals})`;

  const hasThirdPlace = placements.thirdPlace !== null;

  return (
    <div className="space-y-4">
      {seriesId && seriesName ? (
        <p className="text-xs text-text-muted">
          {editionLabel ? `Edición ${editionLabel}. ` : null}
          {onViewSeries ? (
            <button
              type="button"
              onClick={() => onViewSeries(seriesId)}
              className="font-medium text-success-base hover:underline"
            >
              Ver histórico de {seriesName}
            </button>
          ) : (
            <span>Serie: {seriesName}</span>
          )}
        </p>
      ) : null}
      <div className={`grid grid-cols-2 gap-3 ${hasThirdPlace ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <KpiCard label="Campeón" value={entryName(placements.champion, nameById)} accent />
        <KpiCard label="Subcampeón" value={entryName(placements.runnerUp, nameById)} />
        {hasThirdPlace && (
          <KpiCard label="3er puesto" value={entryName(placements.thirdPlace, nameById)} />
        )}
        <KpiCard label={top.names.length > 1 ? 'Goleadores' : 'Goleador'} value={scorerValue} />
      </div>
      {scorersError ? <p className="text-xs text-red-400">{scorersError}</p> : null}

      <div className="space-y-3">
        {placements.perStage.some((stage) => stage.kind === 'podium') ? (
          <>
            <p className="text-xs text-text-muted font-medium">Posiciones finales por etapa</p>
            {placements.perStage
              .filter((stage) => stage.kind === 'podium')
              .map((stage) => (
                <div key={stage.stageId} className="space-y-1.5">
                  <p className="text-xs text-text-muted">{stage.stageName}</p>
                  <StagePodium stage={stage} nameById={nameById} />
                </div>
              ))}
          </>
        ) : null}
      </div>
    </div>
  );
};
