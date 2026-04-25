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

export interface GoalRecord {
  display_name: string;
  minute?: number | null;
}

interface MatchCardProps {
  match: MatchRecord;
  theme?: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  goals?: GoalRecord[];
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, theme = 'light', onEdit, goals }) => {
  const isDark = theme === 'dark';
  const scoreLine =
    match.status === 'completed' && match.homeScore != null && match.awayScore != null
      ? `${match.homeScore} – ${match.awayScore}`
      : null;

  const statusCls = isDark ? STATUS_CLASS_DARK[match.status] : STATUS_CLASS[match.status];
  const shellCls = isDark
    ? 'border-border-subtle bg-surface-1/80 shadow-none hover:bg-surface-2/90'
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>{formatDateTime(match.scheduledAt)}</span>
            {match.venue ? (
              <span className={`flex items-center gap-1 ${isDark ? 'text-white/45' : 'text-slate-400'}`}>
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
                </svg>
                {match.venue}
              </span>
            ) : null}
            {match.referee ? (
              <span className={`flex items-center gap-1 ${isDark ? 'text-white/45' : 'text-slate-400'}`}>
                <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                </svg>
                {match.referee}
              </span>
            ) : null}
          </div>
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(match.id)}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                isDark
                  ? 'text-white/50 hover:bg-surface-2 hover:text-white/90'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
          ) : null}
        </div>
      </div>
      {goals && goals.length > 0 ? (
        <div
          className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs ${
            isDark ? 'border-white/10 text-emerald-300/80' : 'border-slate-100 text-emerald-700'
          }`}
        >
          {goals.map((g, i) => (
            <span key={i} className="flex items-center gap-1">
              <span>⚽</span>
              {g.display_name}
              {g.minute != null ? <span className={isDark ? 'text-white/40' : 'text-slate-400'}>{g.minute}'</span> : null}
            </span>
          ))}
        </div>
      ) : null}
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
