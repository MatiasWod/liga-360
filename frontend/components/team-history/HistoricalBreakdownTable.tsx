import React from 'react';
import { Table } from '../ui/Table';
import type { TournamentBreakdownRow } from './historicalTotals';

export interface HistoricalBreakdownTableProps {
  rows: TournamentBreakdownRow[];
}

export const HistoricalBreakdownTable: React.FC<HistoricalBreakdownTableProps> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-text-muted">
        Ningún torneo coincide con los filtros.
      </p>
    );
  }

  return (
    <Table headers={['Torneo', 'Inscripción', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'Pts']}>
      {rows.map((row) => (
        <tr key={`${row.tournamentId}|${row.competitionId ?? ''}`}>
          <td className="px-4 py-2.5 text-sm font-medium text-text-primary">{row.tournamentName}</td>
          <td className="px-4 py-2.5 text-sm text-text-muted">{row.displayName || '—'}</td>
          <td className="px-4 py-2.5 text-center text-sm tabular-nums text-text-muted">{row.played}</td>
          <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.won}</td>
          <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.drawn}</td>
          <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.lost}</td>
          <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.goalsFor}</td>
          <td className="px-4 py-2.5 text-center text-sm tabular-nums">{row.goalsAgainst}</td>
          <td className="px-4 py-2.5 text-center text-sm font-semibold tabular-nums text-success-base">
            {row.points}
          </td>
        </tr>
      ))}
    </Table>
  );
};
