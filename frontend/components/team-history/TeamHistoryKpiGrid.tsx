import React from 'react';
import type { HistoricalTotals } from './historicalTotals';

const KPI_ITEMS: {
  key: keyof HistoricalTotals | 'goalDiff';
  label: string;
  help: string;
  accent?: boolean;
}[] = [
  { key: 'played', label: 'Partidos (PJ)', help: 'Partidos finalizados con resultado oficial.' },
  { key: 'won', label: 'Victorias (PG)', help: 'Partidos ganados (3 puntos c/u en liga).' },
  { key: 'drawn', label: 'Empates (PE)', help: 'Partidos empatados (1 punto c/u).' },
  { key: 'lost', label: 'Derrotas (PP)', help: 'Partidos perdidos.' },
  {
    key: 'goalDiff',
    label: 'Goles (GF:GC)',
    help: 'Goles a favor y en contra acumulados.',
  },
  { key: 'points', label: 'Puntos', help: 'Puntos de tabla según victorias y empates.', accent: true },
];

function kpiValue(totals: HistoricalTotals, key: (typeof KPI_ITEMS)[number]['key']): string {
  if (key === 'goalDiff') return `${totals.goalsFor}:${totals.goalsAgainst}`;
  return String(totals[key]);
}

export interface TeamHistoryKpiGridProps {
  totals: HistoricalTotals;
  /** Etiqueta opcional sobre la grilla (p. ej. "Totales globales"). */
  caption?: string;
}

export const TeamHistoryKpiGrid: React.FC<TeamHistoryKpiGridProps> = ({ totals, caption }) => {
  return (
    <div className="space-y-2">
      {caption ? <p className="text-xs font-medium text-text-muted">{caption}</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPI_ITEMS.map((kpi) => (
          <div
            key={kpi.key}
            className={`rounded-xl border border-border-subtle p-3 ${
              kpi.accent ? 'bg-accent-soft/40' : 'bg-surface-2'
            }`}
            title={kpi.help}
          >
            <p className="text-[11px] font-medium text-text-muted">{kpi.label}</p>
            <p
              className={`mt-1 text-xl font-semibold tabular-nums ${
                kpi.accent ? 'text-success-base' : 'text-text-primary'
              }`}
            >
              {kpiValue(totals, kpi.key)}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-text-muted">{kpi.help}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
