import React from 'react';
import type { CompetitionSeries } from '../../../services/tournaments/series';

export interface SeriesListProps {
  series: CompetitionSeries[];
  loading?: boolean;
  error?: string;
  organizerFilter?: string;
  onOpen: (seriesId: string) => void;
}

export const SeriesList: React.FC<SeriesListProps> = ({
  series,
  loading,
  error,
  organizerFilter,
  onOpen,
}) => {
  const filteredSeries = React.useMemo(() => {
    const needle = (organizerFilter || '').trim().toLowerCase();
    if (!needle) return series;
    return series.filter((row) => (row.organizer || '').trim().toLowerCase() === needle);
  }, [series, organizerFilter]);
  if (loading) return <p className="py-3 text-sm text-slate-600">Cargando series…</p>;
  if (error) return <p className="py-3 text-sm text-red-600">{error}</p>;
  if (!filteredSeries.length) {
    return (
      <p className="py-3 text-sm text-slate-600">
        {organizerFilter?.trim()
          ? 'Este organizador no tiene series con histórico publicado.'
          : 'No hay series públicas con ediciones publicadas o finalizadas.'}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200">
      {filteredSeries.map((s) => {
        const finished = s.editions.filter((e) => String(e.status).toLowerCase() === 'finished').length;
        const inProgress = s.editions.length - finished;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-3 text-left text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <div>
                <p className="font-medium text-[#0F2A33]">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {finished} edición{finished === 1 ? '' : 'es'} finalizada{finished === 1 ? '' : 's'}
                  {inProgress > 0 ? ` · ${inProgress} en curso` : ''}
                </p>
              </div>
              <span className="text-sm text-[#2E7D32]">Ver histórico →</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
