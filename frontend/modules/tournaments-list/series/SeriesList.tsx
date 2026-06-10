import React from 'react';
import type { CompetitionSeries } from '../../../services/tournaments/series';

export interface SeriesListProps {
  series: CompetitionSeries[];
  loading?: boolean;
  error?: string;
  onOpen: (seriesId: string) => void;
}

export const SeriesList: React.FC<SeriesListProps> = ({ series, loading, error, onOpen }) => {
  if (loading) return <p className="py-3 text-sm text-slate-600">Cargando series…</p>;
  if (error) return <p className="py-3 text-sm text-red-600">{error}</p>;
  if (!series.length) {
    return (
      <p className="py-3 text-sm text-slate-600">
        No hay series públicas con ediciones publicadas o finalizadas.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200">
      {series.map((s) => {
        const finished = s.editions.filter((e) => String(e.status).toLowerCase() === 'finished').length;
        const inProgress = s.editions.length - finished;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-white hover:text-[#0F2A33]"
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
