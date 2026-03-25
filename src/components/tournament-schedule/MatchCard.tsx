import React from 'react';
import type { MatchRecord, MatchStatus, TeamRef } from './types';

const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: 'Programado',
  live: 'En vivo',
  completed: 'Finalizado',
  postponed: 'Aplazado',
};

const STATUS_CLASS: Record<MatchStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-700 ring-slate-200',
  live: 'bg-red-50 text-red-800 ring-red-200',
  completed: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  postponed: 'bg-amber-50 text-amber-900 ring-amber-200',
};

const STATUS_CLASS_DARK: Record<MatchStatus, string> = {
  scheduled: 'bg-white/10 text-white/90 ring-white/20',
  live: 'bg-red-500/20 text-red-100 ring-red-400/40',
  completed: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30',
  postponed: 'bg-amber-500/15 text-amber-100 ring-amber-400/30',
};

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

interface MatchCardProps {
  match: MatchRecord;
  theme?: 'light' | 'dark';
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, theme = 'light' }) => {
  const isDark = theme === 'dark';
  const scoreLine =
    match.status === 'completed' && match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} – ${match.awayScore}`
      : null;

  const statusCls = isDark ? STATUS_CLASS_DARK[match.status] : STATUS_CLASS[match.status];
  const shellCls = isDark
    ? 'border-white/15 bg-white/5 shadow-none hover:bg-white/10'
    : 'border-slate-200 bg-white shadow-sm hover:shadow-md';

  return (
    <div
      className={`group relative flex gap-3 rounded-xl border p-3 transition-shadow ${shellCls}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <TeamRow team={match.homeTeam} side="home" theme={theme} />
            <span
              className={`hidden shrink-0 text-xs font-semibold uppercase sm:inline ${
                isDark ? 'text-white/40' : 'text-slate-400'
              }`}
            >
              vs
            </span>
            <TeamRow team={match.awayTeam} side="away" theme={theme} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusCls}`}>
              {scoreLine ?? STATUS_LABEL[match.status]}
            </span>
          </div>
        </div>
        <div
          className={`mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-xs ${
            isDark ? 'border-white/10 text-white/60' : 'border-slate-100 text-slate-500'
          }`}
        >
          <span>{formatDateTime(match.scheduledAt)}</span>
        </div>
      </div>
    </div>
  );
};

function TeamRow({
  team,
  side,
  theme = 'light',
}: {
  team: TeamRef;
  side: 'home' | 'away';
  theme?: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {team.badgeUrl ? (
        <img
          src={team.badgeUrl}
          alt=""
          className={`h-8 w-8 shrink-0 rounded-full object-cover ${
            isDark ? 'border border-white/20 bg-white/10' : 'border border-slate-100 bg-slate-50'
          }`}
        />
      ) : (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            side === 'home' ? 'bg-slate-700' : 'bg-slate-500'
          }`}
        >
          {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className={`truncate font-medium ${isDark ? 'text-white/95' : 'text-slate-900'}`}>{team.name}</span>
    </div>
  );
}
