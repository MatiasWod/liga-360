import React from 'react';
import type { StandingsRow } from './types';

type StandingsTableProps = {
  rows: StandingsRow[];
  theme?: 'light' | 'dark';
  className?: string;
};

export const StandingsTable: React.FC<StandingsTableProps> = ({ rows, theme = 'light', className = '' }) => {
  if (rows.length === 0) return null;

  const isDark = theme === 'dark';
  const wrapperClassName = isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white';
  const textClassName = isDark ? 'text-white/90' : 'text-slate-700';
  const headerClassName = isDark ? 'text-white/70' : 'text-slate-500';
  const rowClassName = isDark ? 'border-white/10' : 'border-slate-100';

  return (
    <div className={`overflow-x-auto rounded-xl border ${wrapperClassName} ${className}`.trim()}>
      <table className={`min-w-full text-xs sm:text-sm ${textClassName}`}>
        <thead>
          <tr className={`${headerClassName} border-b ${rowClassName}`}>
            <th className="px-3 py-2 text-left font-semibold">Pos</th>
            <th className="px-3 py-2 text-left font-semibold">Equipo</th>
            <th className="px-3 py-2 text-center font-semibold">PJ</th>
            <th className="px-3 py-2 text-center font-semibold">G</th>
            <th className="px-3 py-2 text-center font-semibold">E</th>
            <th className="px-3 py-2 text-center font-semibold">P</th>
            <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">GF</th>
            <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">GC</th>
            <th className="hidden px-3 py-2 text-center font-semibold sm:table-cell">DG</th>
            <th className="px-3 py-2 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.inscriptionId}
              className={`border-b last:border-b-0 ${rowClassName} ${row.position <= 2 ? 'bg-brand-green/10' : ''}`}
            >
              <td className="px-3 py-2">{row.position}</td>
              <td className="px-3 py-2 font-medium">{row.displayName}</td>
              <td className="px-3 py-2 text-center">{row.played}</td>
              <td className="px-3 py-2 text-center">{row.won}</td>
              <td className="px-3 py-2 text-center">{row.drawn}</td>
              <td className="px-3 py-2 text-center">{row.lost}</td>
              <td className="hidden px-3 py-2 text-center sm:table-cell">{row.goalsFor}</td>
              <td className="hidden px-3 py-2 text-center sm:table-cell">{row.goalsAgainst}</td>
              <td className="hidden px-3 py-2 text-center sm:table-cell">{row.goalDifference}</td>
              <td className="px-3 py-2 text-center font-semibold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
