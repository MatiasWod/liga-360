import React from 'react';
import { FixtureViewerLeagueKnockout } from './FixtureViewerLeagueKnockout';
import type { FixtureViewerGroupsProps } from './types';

export const FixtureViewerGroups: React.FC<FixtureViewerGroupsProps> = ({
  mode,
  layout: _layout,
  groups,
  teams,
  onChange,
  theme = 'light',
  className = '',
  disableDragDrop,
  disableStructureEdit,
  scoreEditing,
  schedulingAssistForScope,
}) => {
  const isDark = theme === 'dark';
  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {groups.map((g) => (
        <section key={g.id} className="min-w-0">
          <h2
            className={`mb-4 border-b pb-2 text-base font-bold ${
              isDark ? 'border-white/15 text-white' : 'border-slate-200 text-brand-dark'
            }`}
          >
            {g.name}
          </h2>
          <FixtureViewerLeagueKnockout
            mode={mode}
            layout="league"
            fixture={g.rounds}
            teams={teams}
            theme={theme}
            disableDragDrop={disableDragDrop}
            disableStructureEdit={disableStructureEdit}
            scoreEditing={scoreEditing}
            schedulingAssist={schedulingAssistForScope?.(g.id) ?? null}
            onChange={
              mode === 'edit' && onChange
                ? (nextRounds) => onChange(groups.map((x) => (x.id === g.id ? { ...x, rounds: nextRounds } : x)))
                : undefined
            }
          />
        </section>
      ))}
      {groups.length === 0 ? (
        <p className={`text-center text-sm ${isDark ? 'text-white/50' : 'text-slate-500'}`}>No hay grupos en el fixture.</p>
      ) : null}
    </div>
  );
};
