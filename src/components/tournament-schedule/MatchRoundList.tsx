import React from 'react';
import type { MatchFixtureEditingOptions, MatchRecord } from './types';
import { MatchCard } from './MatchCard';

export const MatchRoundList: React.FC<{
  matches: MatchRecord[];
  theme?: 'light' | 'dark';
  fixtureEditing?: MatchFixtureEditingOptions | null;
}> = ({ matches, theme = 'light', fixtureEditing = null }) => (
  <div className="space-y-4">
    {matches.map((m) => (
      <MatchCard key={m.id} match={m} theme={theme} fixtureEditing={fixtureEditing} />
    ))}
  </div>
);
