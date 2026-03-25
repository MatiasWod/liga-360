import React from 'react';
import type { MatchRecord } from './types';
import { MatchCard } from './MatchCard';

export const MatchRoundList: React.FC<{
  matches: MatchRecord[];
  theme?: 'light' | 'dark';
}> = ({ matches, theme = 'light' }) => (
  <div className="space-y-3">
    {matches.map((m) => (
      <MatchCard key={m.id} match={m} theme={theme} />
    ))}
  </div>
);
