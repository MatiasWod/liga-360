import React from 'react';
import type { MatchRecord } from './types';
import { MatchCard } from './MatchCard';
import type { GoalRecord } from './MatchCard';

export const MatchRoundList: React.FC<{
  matches: MatchRecord[];
  theme?: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}> = ({ matches, theme = 'light', onEdit, goalsByMatchId }) => (
  <div className="space-y-3">
    {matches.map((m) => (
      <MatchCard
        key={m.id}
        match={m}
        theme={theme}
        onEdit={onEdit}
        goals={goalsByMatchId?.[m.id]}
      />
    ))}
  </div>
);
