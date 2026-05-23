import React from 'react';
import type { MatchRecord } from './types';
import { MatchRoundList } from './MatchRoundList';
import type { GoalRecord } from './MatchCard';

interface BracketColumn {
  id: string;
  label: string;
  matches: MatchRecord[];
}

interface BracketViewProps {
  columns: BracketColumn[];
  theme?: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}

export const BracketView: React.FC<BracketViewProps> = ({ columns, theme = 'light', onEdit, goalsByMatchId }) => {
  const isDark = theme === 'dark';
  const labelCls = isDark ? 'text-white/60' : 'text-slate-500';

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-min gap-4 md:gap-6">
        {columns.map((col) => (
          <div key={col.id} className="w-[min(100vw-2rem,320px)] shrink-0">
            <div className={`mb-3 text-center text-xs font-bold uppercase tracking-wider ${labelCls}`}>
              {col.label}
            </div>
            <MatchRoundList matches={col.matches} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />
          </div>
        ))}
      </div>
    </div>
  );
};
