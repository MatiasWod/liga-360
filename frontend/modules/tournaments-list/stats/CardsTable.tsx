import React from 'react';
import type { CardStatsRow } from '../../../services/matchEvents/stats';

export interface CardsTableProps {
  rows: CardStatsRow[];
  nameById: Map<string, string>;
  onSelectTeam?: (inscriptionId: string) => void;
}

export const CardsTable: React.FC<CardsTableProps> = ({ rows, nameById, onSelectTeam }) => {
  if (rows.length === 0) {
    return <p className="py-3 text-xs text-text-muted">Todavía no hay tarjetas ni sanciones registradas en esta competencia.</p>;
  }
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
      <table className="w-full text-xs text-text-primary">
        <thead>
          <tr className="text-text-muted border-b border-border-subtle">
            <th className="px-2 py-1 text-left font-medium">Jugador</th>
            <th className="px-2 py-1 text-left font-medium">Equipo</th>
            <th className="px-2 py-1 text-center font-medium w-10" title="Partidos jugados (solo con presencias cargadas)">PJ</th>
            <th className="px-2 py-1 text-center font-medium w-10" title="Tarjetas amarillas">
              <span className="inline-block h-2.5 w-2 rounded-[2px] bg-amber-400 align-middle" />
            </th>
            <th className="px-2 py-1 text-center font-medium w-10" title="Tarjetas rojas">
              <span className="inline-block h-2.5 w-2 rounded-[2px] bg-red-500 align-middle" />
            </th>
            <th className="px-2 py-1 text-center font-medium w-14" title="Fechas de suspensión">Susp.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const teamKey = row.inscriptionId != null ? String(row.inscriptionId) : null;
            const teamName = teamKey ? nameById.get(teamKey) || `Equipo #${teamKey}` : '—';
            return (
              <tr key={row.playerKey} className="border-b last:border-b-0 border-border-subtle">
                <td className="px-2 py-1 font-medium truncate">{row.displayName}</td>
                <td className="px-2 py-1 truncate">
                  {teamKey && onSelectTeam ? (
                    <button
                      type="button"
                      onClick={() => onSelectTeam(teamKey)}
                      className="text-left hover:text-accent-primary hover:underline transition-colors"
                    >
                      {teamName}
                    </button>
                  ) : (
                    <span className="text-text-muted">{teamName}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-center tabular-nums text-text-muted">{row.matchesPlayed ?? '—'}</td>
                <td className="px-2 py-1 text-center tabular-nums">{row.yellowCards || ''}</td>
                <td className="px-2 py-1 text-center tabular-nums">{row.redCards || ''}</td>
                <td className="px-2 py-1 text-center tabular-nums text-text-muted">
                  {row.suspensionMatches > 0 ? row.suspensionMatches : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
