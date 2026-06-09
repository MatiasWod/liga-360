import React from 'react';
import type { ScorerStatsRow } from '../../../services/matchEvents/stats';

export interface ScorersTableProps {
  rows: ScorerStatsRow[];
  /** Lookup inscriptionId → nombre de equipo (los eventos legacy sin equipo muestran "—"). */
  nameById: Map<string, string>;
  onSelectTeam?: (inscriptionId: string) => void;
}

export const ScorersTable: React.FC<ScorersTableProps> = ({ rows, nameById, onSelectTeam }) => {
  if (rows.length === 0) {
    return <p className="py-3 text-xs text-text-muted">Todavía no hay goles registrados en esta competencia.</p>;
  }
  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
      <table className="w-full text-xs text-text-primary">
        <thead>
          <tr className="text-text-muted border-b border-border-subtle">
            <th className="px-2 py-1 text-left font-medium w-6">#</th>
            <th className="px-2 py-1 text-left font-medium">Jugador</th>
            <th className="px-2 py-1 text-left font-medium">Equipo</th>
            <th className="px-2 py-1 text-center font-semibold w-12">Goles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const teamKey = row.inscriptionId != null ? String(row.inscriptionId) : null;
            const teamName = teamKey ? nameById.get(teamKey) || `Equipo #${teamKey}` : '—';
            return (
              <tr key={row.playerKey} className="border-b last:border-b-0 border-border-subtle">
                <td className="px-2 py-1 text-text-muted">{i + 1}</td>
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
                <td className="px-2 py-1 text-center font-bold tabular-nums">{row.goals}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
