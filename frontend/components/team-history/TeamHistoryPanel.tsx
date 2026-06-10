import React from 'react';
import { Card } from '../ui/Card';
import { computeHistoricalTotals } from './historicalTotals';
import { formatTotalsLine } from './formatTotals';
import { useTeamHistoricalMatches } from './useTeamHistoricalMatches';

export interface TeamHistoryPanelProps {
  teamId: number;
}

/**
 * Totales históricos del equipo (cross-torneo) y desglose por torneo/competencia.
 * Vista pública: solo partidos finalizados con inscripciones físicas.
 */
export const TeamHistoryPanel: React.FC<TeamHistoryPanelProps> = ({ teamId }) => {
  const { data, loading, error } = useTeamHistoricalMatches(teamId);

  const { totals, byTournament } = React.useMemo(() => {
    if (!data) return { totals: null, byTournament: [] };
    return computeHistoricalTotals(data.matches, data.inscriptionIds, data.inscriptions);
  }, [data]);

  return (
    <Card>
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Historia del equipo</h2>
      <p className="mt-1 text-xs text-slate-500">
        Totales acumulados en todos los torneos donde participó (solo partidos finalizados).
      </p>

      {loading ? <p className="mt-3 text-sm text-slate-500">Cargando historial…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error && totals && totals.played === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Todavía no hay partidos finalizados registrados para este equipo.
        </p>
      ) : null}

      {!loading && !error && totals && totals.played > 0 ? (
        <>
          <p className="mt-3 text-base font-semibold text-[#0F2A33]">{formatTotalsLine(totals)}</p>
          {byTournament.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Torneo</th>
                    <th className="py-2 pr-3 font-medium">Inscripción</th>
                    <th className="py-2 font-medium">Resumen</th>
                  </tr>
                </thead>
                <tbody>
                  {byTournament.map((row) => (
                    <tr key={`${row.tournamentId}|${row.competitionId ?? ''}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-800">
                        <span className="font-medium">{row.tournamentName}</span>
                        {row.competitionId ? (
                          <span className="mt-0.5 block text-[11px] text-slate-500">{row.competitionId}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-slate-700">{row.displayName || '—'}</td>
                      <td className="py-2 text-slate-700 tabular-nums">{formatTotalsLine(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
};
