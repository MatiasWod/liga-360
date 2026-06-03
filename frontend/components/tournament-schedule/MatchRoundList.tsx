import React from 'react';
import type { MatchRecord } from './types';
import { MatchCard } from './MatchCard';
import type { GoalRecord, MatchQuickAction } from './MatchCard';
import { TwoLeggedSeriesCard } from './TwoLeggedSeriesCard';
// v2

type SlotGroup =
  | { type: 'single'; match: MatchRecord }
  | { type: 'series'; legs: MatchRecord[] };

function groupBySlot(matches: MatchRecord[]): SlotGroup[] {
  const bySlot = new Map<number, MatchRecord[]>();
  const noSlot: MatchRecord[] = [];

  for (const m of matches) {
    if (m.slotIndex != null && m.leg != null) {
      const arr = bySlot.get(m.slotIndex) ?? [];
      arr.push(m);
      bySlot.set(m.slotIndex, arr);
    } else {
      noSlot.push(m);
    }
  }

  const groups: SlotGroup[] = [];

  // Slots con 2 patas → series; con 1 pata → single
  for (const legs of bySlot.values()) {
    if (legs.length >= 2) {
      groups.push({ type: 'series', legs });
    } else {
      groups.push({ type: 'single', match: legs[0] });
    }
  }

  for (const m of noSlot) {
    groups.push({ type: 'single', match: m });
  }

  // Ordenar por primer slotIndex de cada grupo para mantener el orden de la llave
  groups.sort((a, b) => {
    const sa = a.type === 'series' ? (a.legs[0].slotIndex ?? 0) : (a.match.slotIndex ?? 999);
    const sb = b.type === 'series' ? (b.legs[0].slotIndex ?? 0) : (b.match.slotIndex ?? 999);
    return sa - sb;
  });

  return groups;
}

export const MatchRoundList: React.FC<{
  matches: MatchRecord[];
  theme?: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}> = ({ matches, theme = 'light', onEdit, onQuickMatchAction, goalsByMatchId }) => {
  const hasTwoLegged = matches.some((m) => m.leg != null && m.slotIndex != null);
  const groups = hasTwoLegged ? groupBySlot(matches) : null;

  if (groups) {
    return (
      <div className="space-y-3">
        {groups.map((g) =>
          g.type === 'series' ? (
            <TwoLeggedSeriesCard
              key={g.legs.map((l) => l.id).join('-')}
              legs={g.legs}
              theme={theme}
              onEdit={onEdit}
              onQuickMatchAction={onQuickMatchAction}
              goalsByMatchId={goalsByMatchId}
            />
          ) : (
            <MatchCard
              key={g.match.id}
              match={g.match}
              theme={theme}
              onEdit={onEdit}
              onQuickMatchAction={onQuickMatchAction}
              goals={goalsByMatchId?.[g.match.id]}
            />
          )
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          theme={theme}
          onEdit={onEdit}
          onQuickMatchAction={onQuickMatchAction}
          goals={goalsByMatchId?.[m.id]}
        />
      ))}
    </div>
  );
};
