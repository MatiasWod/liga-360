import React from 'react';
import { MatchEditDrawer } from '../../components/match-edit/MatchEditDrawer';
import { MatchRoundList } from '../../components/tournament-schedule/MatchRoundList';
import { bothTeamsResolvedFromSlots } from '../../components/tournament-schedule/matchParticipantUtils';
import type { TournamentEntity } from '../tournaments-list/types';
import { tournamentMatchToRecord } from './agendaMatchRecord';
import type { AgendaOrganizerRowData } from './agendaPickers';
import { useOrganizerMatchActions } from './useOrganizerMatchActions';

function formatScheduledAt(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AgendaOrganizerRow: React.FC<{
  row: AgendaOrganizerRowData;
  tournament: TournamentEntity | null;
  onRefreshTournament: (tournamentId: string) => Promise<void>;
  onViewTournament: () => void;
}> = ({ row, tournament, onRefreshTournament, onViewTournament }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const [drawerMatchId, setDrawerMatchId] = React.useState<string | null>(null);

  const onRefresh = React.useCallback(async () => {
    await onRefreshTournament(row.tournamentId);
  }, [onRefreshTournament, row.tournamentId]);

  const { handleQuickMatchAction, matchById } = useOrganizerMatchActions(row.pendingMatches, {
    onRefresh,
    setSaving,
    setError: setActionError,
  });

  const matchRecords = React.useMemo(
    () => row.pendingMatches.map(tournamentMatchToRecord),
    [row.pendingMatches]
  );

  const whenLabel = row.earliestScheduledAt
    ? ` · ${formatScheduledAt(row.earliestScheduledAt)}`
    : '';

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-1 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-surface-2"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{row.tournamentName}</p>
          <p className="mt-1 text-xs text-text-muted">
            {row.competitionName} · {row.roundLabel} · {row.pendingCount}{' '}
            {row.pendingCount === 1 ? 'partido pendiente' : 'partidos pendientes'}
            {whenLabel}
          </p>
        </div>
        <span className="shrink-0 text-xs text-text-muted">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded ? (
        <div className="border-t border-border-subtle px-4 pb-4 pt-3 space-y-3">
          {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
          {saving ? <p className="text-xs text-text-muted">Guardando…</p> : null}
          <MatchRoundList
            matches={matchRecords}
            theme="dark"
            onEdit={(matchId) => setDrawerMatchId(matchId)}
            onQuickMatchAction={handleQuickMatchAction}
          />
          <button
            type="button"
            onClick={onViewTournament}
            className="text-xs font-medium text-brand-greenAccent hover:underline"
          >
            Ver torneo
          </button>
        </div>
      ) : null}

      {drawerMatchId && tournament ? (() => {
        const matchRow = matchById.get(drawerMatchId);
        const teamsResolved = matchRow
          ? bothTeamsResolvedFromSlots(
              matchRow.homeAssignedInscription,
              matchRow.awayAssignedInscription
            )
          : false;
        const isMatchFinished = ['finished', 'completed', 'suspended'].includes(
          String(matchRow?.status ?? '').toLowerCase()
        );
        return (
          <MatchEditDrawer
            matchId={drawerMatchId}
            tournamentId={tournament.id}
            competitionId={row.competitionId}
            homeSlot={matchRow?.homeAssignedInscription}
            awaySlot={matchRow?.awayAssignedInscription}
            teamsResolved={teamsResolved}
            defaultTab={teamsResolved ? (isMatchFinished ? 'schedule' : 'result') : 'schedule'}
            initialData={{
              scheduledAt: matchRow?.scheduledAt,
              venue: matchRow?.venue,
              referee: matchRow?.referee,
              homeScore: matchRow?.homeScore,
              awayScore: matchRow?.awayScore,
              status: matchRow?.status,
              homeDisplayName: matchRow?.homeAssignedInscription?.displayName,
              awayDisplayName: matchRow?.awayAssignedInscription?.displayName,
            }}
            onClose={() => setDrawerMatchId(null)}
            onSaved={async () => {
              await onRefresh();
              setDrawerMatchId(null);
            }}
          />
        );
      })() : null}
    </div>
  );
};
