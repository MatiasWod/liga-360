import React from 'react';
import { TeamNameLink } from '../team/TeamNameLink';
import { bothMatchTeamsResolved, isByeMatchRecord, isByeMatchTeam } from './matchParticipantUtils';
import type { MatchRecord, MatchStatus, TeamRef } from './types';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface GoalRecord {
  display_name: string;
  minute?: number | null;
}

export type MatchQuickAction =
  | { type: 'save_score'; homeScore: number; awayScore: number }
  | { type: 'start' }
  | { type: 'finish'; homeScore: number; awayScore: number };

interface MatchCardProps {
  match: MatchRecord;
  theme?: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  /** Acciones rápidas: guardar marcador (en vivo), iniciar o finalizar partido. */
  onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
  goals?: GoalRecord[];
}

// ---------------------------------------------------------------------------
// Helper: StatusShell — clases de borde y fondo por estado
// ---------------------------------------------------------------------------

function statusShell(status: MatchStatus, isDark: boolean): string {
  if (isDark) {
    const base = 'rounded-xl border transition-colors';
    switch (status) {
      case 'live':
        return `${base} border-red-500/40 bg-red-950/30`;
      case 'completed':
        return `${base} border-emerald-500/30 bg-emerald-950/20`;
      case 'postponed':
        return `${base} border-amber-500/30 bg-amber-950/20 opacity-70`;
      default: // scheduled
        return `${base} border-border-subtle bg-surface-1/80`;
    }
  } else {
    const base = 'rounded-xl border transition-colors';
    switch (status) {
      case 'live':
        return `${base} border-red-200 bg-red-50/60`;
      case 'completed':
        return `${base} border-emerald-200 bg-emerald-50/60`;
      case 'postponed':
        return `${base} border-amber-200 bg-amber-50/60 opacity-70`;
      default: // scheduled
        return `${base} border-slate-200 bg-white shadow-sm`;
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: InlineScoreEditor — inputs rápidos al hacer click en el marcador
// ---------------------------------------------------------------------------

function InlineScoreEditor({
  homeInput,
  awayInput,
  isDark,
  saving,
  error,
  onHomeChange,
  onAwayChange,
  onCommit,
  onCancel,
}: {
  homeInput: string;
  awayInput: string;
  isDark: boolean;
  saving: boolean;
  error: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const inputCls = `w-10 rounded-md border px-1 py-0.5 text-center text-xl font-bold tabular-nums focus:outline-none focus:ring-2 ${
    isDark
      ? 'border-white/25 bg-white/10 text-white focus:ring-accent-primary/50'
      : 'border-slate-300 bg-white text-slate-900 focus:ring-accent-primary/40'
  }`;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-col items-center px-1" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          autoFocus
          disabled={saving}
          aria-label="Goles local"
          className={inputCls}
          value={homeInput}
          onChange={(e) => onHomeChange(e.target.value)}
        />
        <span className={`text-lg font-light ${isDark ? 'text-white/40' : 'text-slate-400'}`}>–</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          disabled={saving}
          aria-label="Goles visitante"
          className={inputCls}
          value={awayInput}
          onChange={(e) => onAwayChange(e.target.value)}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onCommit}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            isDark
              ? 'bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-50'
              : 'bg-brand-green text-white hover:bg-brand-greenDark disabled:opacity-50'
          }`}
        >
          {saving ? 'Guardando…' : 'Confirmar'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            isDark
              ? 'text-white/60 hover:bg-white/10'
              : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          Cancelar
        </button>
      </div>
      {error ? (
        <span className={`mt-1 max-w-[160px] text-center text-[10px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: ScoreDisplay — marcador central (solo lectura)
// ---------------------------------------------------------------------------

function ScoreDisplay({
  match,
  isDark,
  quickEditHint,
  isBye = false,
}: {
  match: MatchRecord;
  isDark: boolean;
  quickEditHint?: boolean;
  isBye?: boolean;
}) {
  const textBase = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-white/40' : 'text-slate-400';

  if (isBye && match.status === 'scheduled') {
    return (
      <div className="flex flex-col items-center px-3">
        <span className={`text-xs font-medium italic ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
          Fecha libre
        </span>
      </div>
    );
  }

  if (match.status === 'postponed') {
    return (
      <div className="flex flex-col items-center gap-0.5 px-2">
        <span className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? 'text-amber-300/80' : 'text-amber-600'}`}>
          Aplazado
        </span>
      </div>
    );
  }

  if (match.status === 'completed') {
    const hs = match.homeScore ?? 0;
    const as_ = match.awayScore ?? 0;
    return (
      <div className="flex flex-col items-center px-3">
        <span className={`text-2xl font-bold tabular-nums leading-none ${textBase}`}>
          {hs}
          <span className={`mx-1.5 font-light ${textMuted}`}>–</span>
          {as_}
        </span>
        <span className={`mt-1 text-[10px] font-medium uppercase tracking-wide ${isDark ? 'text-emerald-400/70' : 'text-emerald-600/80'}`}>
          Finalizado
        </span>
      </div>
    );
  }

  if (match.status === 'live') {
    const hasScore = match.homeScore != null && match.awayScore != null;
    return (
      <div className="flex flex-col items-center px-3">
        {hasScore ? (
          <span className={`text-2xl font-bold tabular-nums leading-none ${isDark ? 'text-red-100' : 'text-red-700'}`}>
            {match.homeScore}
            <span className={`mx-1.5 font-light ${isDark ? 'text-red-300/60' : 'text-red-300'}`}>–</span>
            {match.awayScore}
          </span>
        ) : (
          <span className={`text-xl font-bold ${isDark ? 'text-red-100' : 'text-red-700'}`}>En vivo</span>
        )}
        <span className="mt-1 flex items-center gap-1">
          <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${isDark ? 'bg-red-400' : 'bg-red-500'}`} />
          <span className={`text-[10px] font-medium uppercase tracking-wide ${isDark ? 'text-red-400/80' : 'text-red-600'}`}>Live</span>
        </span>
      </div>
    );
  }

  // scheduled
  return (
    <div className="flex flex-col items-center px-3">
      <span className={`text-xl font-light ${textMuted}`}>—</span>
      {match.scheduledAt ? (
        <span className={`mt-0.5 text-[11px] font-medium ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
          {formatTime(match.scheduledAt)}
        </span>
      ) : null}
      {quickEditHint ? (
        <span className={`mt-0.5 text-[10px] ${isDark ? 'text-white/35' : 'text-slate-400'}`}>
          Click para cargar
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  theme = 'light',
  onEdit,
  onQuickMatchAction,
  goals,
}) => {
  const isDark = theme === 'dark';
  const [expanded, setExpanded] = React.useState(false);
  const [scoreEditing, setScoreEditing] = React.useState(false);
  const [homeInput, setHomeInput] = React.useState('');
  const [awayInput, setAwayInput] = React.useState('');
  const [scoreSaving, setScoreSaving] = React.useState(false);
  const [scoreError, setScoreError] = React.useState('');
  const [lifecycleError, setLifecycleError] = React.useState('');
  const [lifecycleLoading, setLifecycleLoading] = React.useState<'start' | 'finish' | null>(null);

  const teamsResolved = bothMatchTeamsResolved(match);
  const isBye = isByeMatchRecord(match);
  const canQuickManage = Boolean(onQuickMatchAction) && match.status !== 'postponed' && match.status !== 'completed';
  const canEditScore =
    canQuickManage && teamsResolved && (match.status === 'scheduled' || match.status === 'live');
  const canStartMatch = canQuickManage && match.status === 'scheduled' && teamsResolved;
  const canEditMatch = Boolean(onEdit) && teamsResolved;
  const showLifecycleBar =
    canQuickManage && !scoreEditing && teamsResolved && (canStartMatch || match.status === 'live');

  React.useEffect(() => {
    setScoreEditing(false);
    setScoreError('');
    setLifecycleError('');
  }, [match.id, match.homeScore, match.awayScore, match.status]);

  function parseScores(): { homeScore: number; awayScore: number } | null {
    const h = Number.parseInt(homeInput, 10);
    const a = Number.parseInt(awayInput, 10);
    if (!Number.isFinite(h) || h < 0 || !Number.isFinite(a) || a < 0) return null;
    return { homeScore: h, awayScore: a };
  }

  function startScoreEdit() {
    if (!canEditScore || scoreSaving || lifecycleLoading) return;
    setHomeInput(match.homeScore != null ? String(match.homeScore) : '0');
    setAwayInput(match.awayScore != null ? String(match.awayScore) : '0');
    setScoreError('');
    setLifecycleError('');
    setScoreEditing(true);
  }

  async function commitScoreEdit() {
    if (!onQuickMatchAction) return;
    const parsed = parseScores();
    if (!parsed) {
      setScoreError('Marcadores enteros ≥ 0');
      return;
    }
    setScoreSaving(true);
    setScoreError('');
    setLifecycleError('');
    try {
      await onQuickMatchAction(match.id, {
        type: 'save_score',
        homeScore: parsed.homeScore,
        awayScore: parsed.awayScore,
      });
      setScoreEditing(false);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setScoreSaving(false);
    }
  }

  async function handleStartMatch() {
    if (!onQuickMatchAction || lifecycleLoading || scoreSaving) return;
    setLifecycleLoading('start');
    setLifecycleError('');
    try {
      await onQuickMatchAction(match.id, { type: 'start' });
    } catch (e) {
      setLifecycleError(e instanceof Error ? e.message : 'Error al iniciar');
    } finally {
      setLifecycleLoading(null);
    }
  }

  async function handleFinishMatch() {
    if (!onQuickMatchAction || lifecycleLoading || scoreSaving) return;
    const h = match.homeScore;
    const a = match.awayScore;
    if (h == null || a == null) {
      setLifecycleError('Cargá el marcador antes de finalizar');
      startScoreEdit();
      return;
    }
    setLifecycleLoading('finish');
    setLifecycleError('');
    try {
      await onQuickMatchAction(match.id, { type: 'finish', homeScore: h, awayScore: a });
    } catch (e) {
      setLifecycleError(e instanceof Error ? e.message : 'Error al finalizar');
    } finally {
      setLifecycleLoading(null);
    }
  }

  const busy = scoreSaving || lifecycleLoading != null;

  const hasDetail = !!(match.venue || match.referee || (goals && goals.length > 0));

  const homeWins =
    match.status === 'completed' &&
    (match.homeScore ?? 0) > (match.awayScore ?? 0);

  const awayWins =
    match.status === 'completed' &&
    (match.awayScore ?? 0) > (match.homeScore ?? 0);

  return (
    <div className={`relative p-3 ${statusShell(match.status, isDark)}`}>
      {/* Botón de edición — esquina superior derecha, siempre visible */}
      {canEditMatch ? (
        <button
          type="button"
          onClick={() => onEdit!(match.id)}
          aria-label="Editar partido"
          className={`absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-md opacity-50 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${
            isDark ? 'text-white/70 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      ) : null}

      {match.matchCode ? (
        <div className={`mb-2 text-center ${isDark ? 'text-white/55' : 'text-slate-500'}`}>
          <span className="font-mono text-xs font-semibold tracking-tight text-success-base">{match.matchCode}</span>
          {match.matchSubtitle ? (
            <span className={`mt-0.5 block text-[10px] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
              {match.matchSubtitle}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Layout scorecard: local | marcador | visitante */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        {/* Equipo local */}
        <div className="flex min-w-0 flex-col items-end gap-1 pr-1">
          <TeamName
            team={match.homeTeam}
            side="home"
            winner={homeWins}
            isDark={isDark}
            hasEditButton={canEditMatch}
          />
        </div>

        {/* Marcador central — click abre edición rápida si está habilitada */}
        {scoreEditing ? (
          <InlineScoreEditor
            homeInput={homeInput}
            awayInput={awayInput}
            isDark={isDark}
            saving={scoreSaving}
            error={scoreError}
            onHomeChange={setHomeInput}
            onAwayChange={setAwayInput}
            onCommit={commitScoreEdit}
            onCancel={() => {
              setScoreEditing(false);
              setScoreError('');
            }}
          />
        ) : (
          <button
            type="button"
            disabled={!canEditScore || busy}
            onClick={canEditScore ? startScoreEdit : undefined}
            className={`rounded-lg px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 ${
              canEditScore
                ? isDark
                  ? 'cursor-pointer hover:bg-white/10'
                  : 'cursor-pointer hover:bg-slate-100'
                : 'cursor-default'
            }`}
            aria-label={canEditScore ? 'Editar marcador' : undefined}
          >
            <ScoreDisplay
              match={match}
              isDark={isDark}
              quickEditHint={canEditScore && !scoreEditing}
              isBye={isBye}
            />
          </button>
        )}

        {/* Equipo visitante */}
        <div className="flex min-w-0 flex-col items-start gap-1 pl-1">
          <TeamName
            team={match.awayTeam}
            side="away"
            winner={awayWins}
            isDark={isDark}
            hasEditButton={false}
          />
        </div>
      </div>

      {/* Acciones de ciclo de vida del partido */}
      {showLifecycleBar ? (
        <div
          className={`mt-2.5 flex flex-wrap items-center justify-center gap-2 border-t pt-2 ${
            isDark ? 'border-white/10' : 'border-slate-100'
          }`}
        >
          {canStartMatch ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleStartMatch}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                isDark
                  ? 'bg-red-600/80 text-white hover:bg-red-600'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {lifecycleLoading === 'start' ? 'Iniciando…' : '▶ Iniciar partido'}
            </button>
          ) : null}
          {match.status === 'live' ? (
            <>
              <span className={`text-[10px] ${isDark ? 'text-white/45' : 'text-slate-400'}`}>
                Click en el marcador para actualizar
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleFinishMatch}
                className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                  isDark
                    ? 'bg-emerald-600/80 text-white hover:bg-emerald-600'
                    : 'bg-brand-green text-white hover:bg-brand-greenDark'
                }`}
              >
                {lifecycleLoading === 'finish' ? 'Finalizando…' : 'Finalizar partido'}
              </button>
            </>
          ) : null}
          {lifecycleError ? (
            <span className={`w-full text-center text-[10px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              {lifecycleError}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Footer: fecha (scheduled) y toggle de detalle */}
      {(match.status === 'scheduled' && match.scheduledAt) || hasDetail ? (
        <div
          className={`mt-2.5 flex items-center justify-between border-t pt-2 text-xs ${
            isDark ? 'border-white/10' : 'border-slate-100'
          }`}
        >
          {/* Fecha completa en scheduled */}
          {match.status === 'scheduled' && match.scheduledAt ? (
            <span className={isDark ? 'text-white/50' : 'text-slate-400'}>
              {formatDateTime(match.scheduledAt)}
            </span>
          ) : (
            <span />
          )}

          {/* Toggle detalle */}
          {hasDetail ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                isDark
                  ? 'text-white/40 hover:bg-white/5 hover:text-white/70'
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              {expanded ? 'Ocultar ▴' : 'Ver detalles ▾'}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Sección de detalle expandible */}
      {expanded && hasDetail ? (
        <div
          className={`mt-2 space-y-1.5 border-t pt-2 text-xs ${
            isDark ? 'border-white/10 text-white/60' : 'border-slate-100 text-slate-500'
          }`}
        >
          {match.venue ? (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
              </svg>
              <span>{match.venue}</span>
            </div>
          ) : null}

          {match.referee ? (
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
              </svg>
              <span>{match.referee}</span>
            </div>
          ) : null}

          {goals && goals.length > 0 ? (
            <div className="space-y-1 pt-0.5">
              {goals.map((g, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[11px]">⚽</span>
                  <span>{g.display_name}</span>
                  {g.minute != null ? (
                    <span className={isDark ? 'text-white/35' : 'text-slate-400'}>{g.minute}'</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-componente: nombre del equipo
// ---------------------------------------------------------------------------

function TeamName({
  team,
  side,
  winner,
  isDark,
  hasEditButton,
}: {
  team: TeamRef;
  side: 'home' | 'away';
  winner: boolean;
  isDark: boolean;
  hasEditButton: boolean;
}) {
  const align = side === 'home' ? 'items-end text-right' : 'items-start text-left';

  const isByeSide = isByeMatchTeam(team);

  return (
    <div className={`flex min-w-0 w-full flex-col gap-1 ${align}`}>
      {/* Avatar */}
      {!isByeSide ? <TeamAvatar team={team} side={side} isDark={isDark} /> : null}

      {/* Nombre (clickeable para usuarios logueados → roster + stats del equipo) */}
      <span
        className={`w-full truncate text-sm leading-tight transition-all ${
          isByeSide
            ? isDark
              ? 'italic text-white/45'
              : 'italic text-slate-400'
            : winner
            ? isDark
              ? 'font-semibold text-white'
              : 'font-semibold text-slate-900'
            : isDark
              ? 'font-normal text-white/75'
              : 'font-normal text-slate-600'
        } ${hasEditButton ? 'pr-7' : ''}`}
      >
        {isByeSide ? team.name : <TeamNameLink teamName={team.name} className="max-w-full truncate align-bottom" />}
      </span>
    </div>
  );
}

function TeamAvatar({
  team,
  side,
  isDark,
}: {
  team: TeamRef;
  side: 'home' | 'away';
  isDark: boolean;
}) {
  if (team.badgeUrl) {
    return (
      <img
        src={team.badgeUrl}
        alt=""
        className={`h-9 w-9 rounded-full object-cover ${
          isDark ? 'border border-white/20 bg-white/10' : 'border border-slate-100 bg-slate-50'
        }`}
      />
    );
  }
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
        side === 'home' ? 'bg-slate-600' : 'bg-slate-500'
      }`}
    >
      {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers de fecha
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
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

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return '';
  }
}
