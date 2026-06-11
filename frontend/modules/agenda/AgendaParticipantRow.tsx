import React from 'react';
import { roundLabelForStage, type AgendaParticipantRowData } from './agendaPickers';

function formatScheduledAt(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha asignada';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AgendaParticipantRow: React.FC<{
  row: AgendaParticipantRowData;
  onOpen: () => void;
}> = ({ row, onOpen }) => {
  const round = row.match.round ?? 0;
  const roundLabel = round > 0 ? roundLabelForStage(row.stageFormat, round) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-border-subtle bg-surface-1 p-4 text-left transition-colors hover:border-white/20 hover:bg-surface-2"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span className="rounded-md bg-surface-2 px-2 py-0.5 font-medium text-text-primary">{row.badge}</span>
        <span className="font-medium text-text-primary">{row.tournamentName}</span>
        <span aria-hidden>·</span>
        <span>{row.competitionName}</span>
        {roundLabel ? (
          <>
            <span aria-hidden>·</span>
            <span>{roundLabel}</span>
          </>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-semibold text-text-primary">
        {row.isHome ? 'Local' : 'Visitante'} vs {row.opponentName}
      </p>
      <p className="mt-1 text-xs text-text-muted">{formatScheduledAt(row.match.scheduledAt)}</p>
    </button>
  );
};
