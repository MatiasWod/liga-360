import React from 'react';
import type { TennisSetDetail } from '../../services/matchEvents/tennisScore';

export type SideGoalRecord = {
  display_name: string;
  minute?: number | null;
  inscription_id?: number | null;
};

export type SplitGoals = {
  home: SideGoalRecord[];
  away: SideGoalRecord[];
  unknown: SideGoalRecord[];
};

export function splitGoalsBySide(
  goals: SideGoalRecord[] | undefined,
  homeInscriptionId?: string | number | null,
  awayInscriptionId?: string | number | null
): SplitGoals {
  const homeId = String(homeInscriptionId ?? '').trim();
  const awayId = String(awayInscriptionId ?? '').trim();
  const home: SideGoalRecord[] = [];
  const away: SideGoalRecord[] = [];
  const unknown: SideGoalRecord[] = [];

  for (const goal of goals ?? []) {
    const goalId = goal.inscription_id != null ? String(goal.inscription_id) : '';
    if (homeId && goalId === homeId) {
      home.push(goal);
      continue;
    }
    if (awayId && goalId === awayId) {
      away.push(goal);
      continue;
    }
    unknown.push(goal);
  }

  return { home, away, unknown };
}

function sortGoals(goals: SideGoalRecord[]): SideGoalRecord[] {
  return [...goals].sort((a, b) => {
    const am = a.minute ?? 9999;
    const bm = b.minute ?? 9999;
    if (am !== bm) return am - bm;
    return a.display_name.localeCompare(b.display_name, 'es', { sensitivity: 'base' });
  });
}

type ScorerColumnProps = {
  goals: SideGoalRecord[];
  align: 'left' | 'right';
  isDark?: boolean;
  emptyLabel?: string;
};

export function ScorerColumn({ goals, align, isDark = false, emptyLabel }: ScorerColumnProps) {
  const sorted = sortGoals(goals);
  const textPrimary = isDark ? 'text-white/90' : 'text-text-primary';
  const textMuted = isDark ? 'text-white/45' : 'text-text-muted';
  const rowBg = isDark ? 'bg-white/5' : 'bg-surface-2';

  if (sorted.length === 0) {
    if (!emptyLabel) return <div className="min-h-[1px]" />;
    return (
      <p className={`text-[10px] italic ${textMuted} ${align === 'right' ? 'text-right' : 'text-left'}`}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className={`space-y-1 ${align === 'right' ? 'items-end' : 'items-start'} flex flex-col`}>
      {sorted.map((goal, index) => (
        <li
          key={`${goal.display_name}-${goal.minute ?? 'x'}-${index}`}
          className={`flex w-full max-w-full items-center gap-1.5 rounded-md px-2 py-1 ${rowBg} ${
            align === 'right' ? 'flex-row-reverse text-right' : 'text-left'
          }`}
        >
          <span className={`min-w-0 truncate text-[11px] font-medium ${textPrimary}`}>{goal.display_name}</span>
          {goal.minute != null ? (
            <span className={`shrink-0 text-[10px] tabular-nums ${textMuted}`}>{goal.minute}&apos;</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type SetGamesPillsProps = {
  sets: TennisSetDetail[];
  side: 'home' | 'away';
  align: 'left' | 'right';
  isDark?: boolean;
};

function SetGamesPills({ sets, side, align, isDark = false }: SetGamesPillsProps) {
  const wonCls = isDark
    ? 'border-brand-greenAccent bg-brand-green text-brand-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
    : 'border-brand-greenDark bg-brand-green text-white';
  const lostCls = isDark
    ? 'border-border-strong bg-surface-1 text-text-muted'
    : 'border-border-subtle bg-surface-2 text-text-subtle';

  return (
    <div className={`flex flex-wrap gap-1 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      {sets.map((set) => {
        const homeGames = set.homeGames;
        const awayGames = set.awayGames;
        const games = side === 'home' ? homeGames : awayGames;
        const won = side === 'home' ? homeGames > awayGames : awayGames > homeGames;
        return (
          <span
            key={`${side}-${set.setNumber}`}
            title={`Set ${set.setNumber}: ${homeGames}-${awayGames}`}
            className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              won ? wonCls : lostCls
            }`}
          >
            {games}
          </span>
        );
      })}
    </div>
  );
}

type TennisSetsSideRowProps = {
  sets: TennisSetDetail[];
  isDark?: boolean;
  /** Ancho del bloque central (marcador), para alinear con la fila de nombres. */
  centerWidthClass?: string;
};

/**
 * Games por set bajo cada jugador, alineado al scoreboard (sin estirar al ancho completo).
 * Replica la grilla del marcador: local | centro | visitante.
 */
export function TennisSetsSideRow({
  sets,
  isDark = false,
  centerWidthClass = 'w-10',
}: TennisSetsSideRowProps) {
  if (!sets.length) return null;

  return (
    <div
      className="grid items-center gap-x-1"
      style={{ gridTemplateColumns: '1fr auto 1fr' }}
    >
      <div className="min-w-0">
        <SetGamesPills sets={sets} side="home" align="right" isDark={isDark} />
      </div>
      <div className={`shrink-0 ${centerWidthClass}`} aria-hidden />
      <div className="min-w-0">
        <SetGamesPills sets={sets} side="away" align="left" isDark={isDark} />
      </div>
    </div>
  );
}

type MatchSidesFooterProps = {
  homeInscriptionId?: string | number | null;
  awayInscriptionId?: string | number | null;
  goals?: SideGoalRecord[];
  tennisSets?: TennisSetDetail[];
  isDark?: boolean;
  showEmptyScorers?: boolean;
  /** Sin borde superior (p. ej. fila compacta del detalle). */
  embedded?: boolean;
};

export function matchHasExtras(
  goals: SideGoalRecord[] | undefined,
  tennisSets: TennisSetDetail[] | undefined
): boolean {
  return (goals?.length ?? 0) > 0 || (tennisSets?.length ?? 0) > 0;
}

/** Enlace "Ver detalles" / "Ocultar" abajo a la derecha del partido. */
export function MatchDetailsToggle({
  expanded,
  onToggle,
  isDark = false,
}: {
  expanded: boolean;
  onToggle: () => void;
  isDark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
        isDark
          ? 'text-white/40 hover:bg-white/5 hover:text-white/70'
          : 'text-text-muted hover:bg-surface-3/50 hover:text-text-primary'
      }`}
    >
      {expanded ? 'Ocultar ▴' : 'Ver detalles ▾'}
    </button>
  );
}

/** Goleadores por lado y/o sets de tenis bajo el marcador. */
export function MatchSidesFooter({
  homeInscriptionId,
  awayInscriptionId,
  goals,
  tennisSets,
  isDark = false,
  showEmptyScorers = false,
  embedded = false,
}: MatchSidesFooterProps) {
  const split = splitGoalsBySide(goals, homeInscriptionId, awayInscriptionId);
  const hasGoals = split.home.length + split.away.length + split.unknown.length > 0;
  const hasSets = Boolean(tennisSets?.length);

  if (!hasGoals && !hasSets) return null;

  return (
    <div className={`space-y-1.5 ${embedded ? 'mt-1' : 'mt-2 border-t border-border-subtle/60 pt-2'}`}>
      {hasSets ? <TennisSetsSideRow sets={tennisSets!} isDark={isDark} /> : null}
      {hasGoals ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ScorerColumn
              goals={split.home}
              align="left"
              isDark={isDark}
              emptyLabel={showEmptyScorers ? 'Sin goles' : undefined}
            />
            <ScorerColumn
              goals={split.away}
              align="right"
              isDark={isDark}
              emptyLabel={showEmptyScorers ? 'Sin goles' : undefined}
            />
          </div>
          {split.unknown.length > 0 ? (
            <ul className="space-y-1">
              {sortGoals(split.unknown).map((goal, index) => (
                <li
                  key={`unk-${goal.display_name}-${index}`}
                  className={`text-center text-[10px] ${isDark ? 'text-white/55' : 'text-text-muted'}`}
                >
                  {goal.display_name}
                  {goal.minute != null ? ` ${goal.minute}'` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
