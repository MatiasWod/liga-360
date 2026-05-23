import React from 'react';
import type { MatchRecord } from './types';
import { MatchCard } from './MatchCard';
import type { GoalRecord, MatchQuickAction } from './MatchCard';

interface TwoLeggedSeriesCardProps {
  legs: MatchRecord[];
  theme?: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}

function computeAggregate(legs: MatchRecord[]) {
  const leg1 = legs[0];
  const leg2 = legs[1];

  const teamA = leg1.homeTeam;
  const teamB = leg1.awayTeam;

  let scoreA = 0;
  let scoreB = 0;
  let hasData = false;

  if (leg1.homeScore != null) { scoreA += leg1.homeScore; hasData = true; }
  if (leg1.awayScore != null) { scoreB += leg1.awayScore; hasData = true; }

  if (leg2) {
    // En la vuelta los roles están invertidos: leg2 home = teamB, leg2 away = teamA
    if (leg2.homeScore != null) { scoreB += leg2.homeScore; hasData = true; }
    if (leg2.awayScore != null) { scoreA += leg2.awayScore; hasData = true; }
  }

  const bothFinished = legs.every((l) => l.status === 'completed');
  const partial = hasData && !bothFinished;

  return { teamA, teamB, scoreA, scoreB, hasData, bothFinished, partial };
}

export const TwoLeggedSeriesCard: React.FC<TwoLeggedSeriesCardProps> = ({
  legs,
  theme = 'light',
  onEdit,
  onQuickMatchAction,
  goalsByMatchId,
}) => {
  const isDark = theme === 'dark';
  const sortedLegs = legs.slice().sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const currentMatch = sortedLegs[selectedIdx] ?? sortedLegs[0];

  const agg = computeAggregate(sortedLegs);

  const mutedText = isDark ? 'text-white/40' : 'text-slate-400';
  const activeTab = isDark
    ? 'bg-white/10 text-white/90 font-semibold'
    : 'bg-slate-100 text-slate-800 font-semibold';
  const inactiveTab = isDark
    ? 'text-white/40 hover:text-white/60'
    : 'text-slate-400 hover:text-slate-600';

  return (
    <div className="space-y-1.5">
      {/* Fila superior: toggle + global */}
      <div className="flex items-center justify-between px-0.5">
        {/* Selector Ida / Vuelta */}
        <div className={`flex gap-0.5 rounded-lg p-0.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
          {sortedLegs.map((leg, idx) => {
            const label = idx === 0 ? 'Ida' : 'Vuelta';
            const isActive = selectedIdx === idx;
            return (
              <button
                key={leg.id}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-md px-2.5 py-0.5 text-[11px] transition-all ${isActive ? activeTab : inactiveTab}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Score global */}
        {agg.hasData ? (
          <div className={`flex items-center gap-1 text-[11px] ${mutedText}`}>
            <span className="font-medium uppercase tracking-wide">Global</span>
            <span className={`tabular-nums ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
              {agg.scoreA}
              <span className={`mx-0.5 ${mutedText}`}>–</span>
              {agg.scoreB}
            </span>
            {agg.partial && (
              <span className={`text-[9px] uppercase ${isDark ? 'text-white/25' : 'text-slate-300'}`}>parcial</span>
            )}
            {agg.bothFinished && agg.scoreA !== agg.scoreB && (
              <span className={`text-[9px] uppercase ${isDark ? 'text-emerald-400/60' : 'text-emerald-600/70'}`}>
                {agg.scoreA > agg.scoreB ? agg.teamA.name.split(' ')[0] : agg.teamB.name.split(' ')[0]} pasa
              </span>
            )}
          </div>
        ) : (
          <span className={`text-[11px] font-medium uppercase tracking-wide ${mutedText}`}>Global</span>
        )}
      </div>

      {/* MatchCard de la pata seleccionada */}
      <MatchCard
        match={currentMatch}
        theme={theme}
        onEdit={onEdit}
        onQuickMatchAction={onQuickMatchAction}
        goals={goalsByMatchId?.[currentMatch.id]}
      />
    </div>
  );
};
