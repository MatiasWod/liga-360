import React from 'react';
import { TeamNameLink } from '../team/TeamNameLink';
import type { ClassificationZone, StandingsRow } from './types';

const ZONE_STYLES = [
  { bg: 'bg-emerald-500/10', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  { bg: 'bg-sky-500/10',     border: 'border-l-sky-500',     dot: 'bg-sky-500'     },
  { bg: 'bg-amber-500/10',   border: 'border-l-amber-500',   dot: 'bg-amber-500'   },
  { bg: 'bg-orange-500/10',  border: 'border-l-orange-500',  dot: 'bg-orange-500'  },
  { bg: 'bg-red-500/10',     border: 'border-l-red-500',     dot: 'bg-red-500'     },
];

function zoneStyle(idx: number) {
  return ZONE_STYLES[Math.min(idx, ZONE_STYLES.length - 1)];
}

type StandingsTableProps = {
  rows: StandingsRow[];
  zones?: ClassificationZone[];
  theme?: 'light' | 'dark';
  className?: string;
};

export const StandingsTable: React.FC<StandingsTableProps> = ({
  rows,
  zones = [],
  theme = 'dark',
  className = '',
}) => {
  if (rows.length === 0) return null;

  const isDark = theme === 'dark';
  const wrapperClass = isDark ? 'border-border-subtle bg-surface-1' : 'border-slate-200 bg-white';
  const textClass    = isDark ? 'text-text-primary' : 'text-slate-700';
  const headerClass  = isDark ? 'text-text-muted'   : 'text-slate-500';
  const rowClass     = isDark ? 'border-border-subtle' : 'border-slate-100';

  function rowZone(pos: number): ClassificationZone | undefined {
    return zones.find((z) => pos >= z.fromPos && pos <= z.toPos);
  }

  // Agrupar zonas por label para la leyenda (evitar duplicados si hay múltiples grupos)
  const legendZones = zones.filter(
    (z, i, arr) => arr.findIndex((x) => x.label === z.label) === i
  );

  return (
    <div className={className}>
      <div className={`overflow-x-auto rounded-xl border ${wrapperClass}`}>
        <table className={`min-w-full text-xs sm:text-sm ${textClass}`}>
          <thead>
            <tr className={`${headerClass} border-b ${rowClass}`}>
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
            {rows.map((row) => {
              const zone = rowZone(row.position);
              const style = zone ? zoneStyle(zone.colorIndex) : null;
              return (
                <tr
                  key={row.inscriptionId}
                  className={[
                    'border-b last:border-b-0',
                    rowClass,
                    style ? `border-l-4 ${style.border} ${style.bg}` : 'border-l-4 border-l-transparent',
                  ].join(' ')}
                >
                  <td className="px-3 py-2">{row.position}</td>
                  <td className="px-3 py-2 font-medium">
                    <TeamNameLink teamName={row.displayName} />
                  </td>
                  <td className="px-3 py-2 text-center">{row.played}</td>
                  <td className="px-3 py-2 text-center">{row.won}</td>
                  <td className="px-3 py-2 text-center">{row.drawn}</td>
                  <td className="px-3 py-2 text-center">{row.lost}</td>
                  <td className="hidden px-3 py-2 text-center sm:table-cell">{row.goalsFor}</td>
                  <td className="hidden px-3 py-2 text-center sm:table-cell">{row.goalsAgainst}</td>
                  <td className="hidden px-3 py-2 text-center sm:table-cell">{row.goalDifference}</td>
                  <td className="px-3 py-2 text-center font-semibold">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {legendZones.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {legendZones.map((z) => {
            const style = zoneStyle(z.colorIndex);
            return (
              <span key={z.label} className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <span className={`inline-block h-2.5 w-2.5 rounded-sm ${style.dot}`} />
                {z.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
