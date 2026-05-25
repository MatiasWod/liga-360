import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import type {
  GroupsScheduleData,
  KnockoutScheduleData,
  LeagueScheduleData,
  TournamentScheduleProps,
} from './types';
import { BracketView } from './BracketView';
import { GroupSection } from './GroupSection';
import { MatchRoundList } from './MatchRoundList';
import { RoundSelector } from './RoundSelector';
import { getDefaultRoundId, resolveSelectedRoundId } from './utils';
import type { GoalRecord, MatchQuickAction } from './MatchCard';

export const TournamentSchedule: React.FC<
  TournamentScheduleProps & {
    onEdit?: (matchId: string) => void;
    onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
    goalsByMatchId?: Record<string, GoalRecord[]>;
  }
> = ({
  type,
  data,
  theme = 'dark',
  className = '',
  onEdit,
  onQuickMatchAction,
  goalsByMatchId,
}) => {
  const [selectedRoundId, setSelectedRoundId] = React.useState<string | null>(() =>
    getDefaultRoundId(type, data as LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData)
  );

  React.useEffect(() => {
    setSelectedRoundId((prev) =>
      resolveSelectedRoundId(
        type,
        data as LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData,
        prev
      )
    );
  }, [data, type]);

  const roundTabs = React.useMemo(() => {
    if (type === 'league') {
      return (data as LeagueScheduleData).rounds.map((r) => ({ id: r.id, label: r.label }));
    }
    if (type === 'knockout') {
      return (data as KnockoutScheduleData).rounds.map((r) => ({ id: r.id, label: r.label }));
    }
    const g = (data as GroupsScheduleData).groups[0];
    return (g?.rounds ?? []).map((r) => ({ id: r.id, label: r.label }));
  }, [type, data]);

  const showRoundTabs = type === 'league' || type === 'groups';

  return (
    <div className={`space-y-4 ${className}`}>
      {showRoundTabs ? (
        <RoundSelector
          rounds={roundTabs}
          selectedId={selectedRoundId}
          onChange={setSelectedRoundId}
          theme={theme}
        />
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={type === 'knockout' ? 'knockout' : selectedRoundId ?? 'x'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {type === 'league' && selectedRoundId ? (
            <LeagueRound data={data as LeagueScheduleData} roundId={selectedRoundId} theme={theme} onEdit={onEdit} onQuickMatchAction={onQuickMatchAction} goalsByMatchId={goalsByMatchId} />
          ) : null}

          {type === 'groups' && selectedRoundId ? (
            <GroupsRounds data={data as GroupsScheduleData} roundId={selectedRoundId} theme={theme} onEdit={onEdit} onQuickMatchAction={onQuickMatchAction} goalsByMatchId={goalsByMatchId} />
          ) : null}

          {type === 'knockout' ? (
            <KnockoutBracket data={data as KnockoutScheduleData} theme={theme} onEdit={onEdit} onQuickMatchAction={onQuickMatchAction} goalsByMatchId={goalsByMatchId} />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

function LeagueRound({
  data,
  roundId,
  theme,
  onEdit,
  onQuickMatchAction,
  goalsByMatchId,
}: {
  data: LeagueScheduleData;
  roundId: string;
  theme: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}) {
  const round = data.rounds.find((r) => r.id === roundId);
  const matches = round?.matches ?? [];
  return (
    <MatchRoundList
      matches={matches}
      theme={theme}
      onEdit={onEdit}
      onQuickMatchAction={onQuickMatchAction}
      goalsByMatchId={goalsByMatchId}
    />
  );
}

function GroupsRounds({
  data,
  roundId,
  theme,
  onEdit,
  onQuickMatchAction,
  goalsByMatchId,
}: {
  data: GroupsScheduleData;
  roundId: string;
  theme: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.groups.map((g) => {
        const round = g.rounds.find((r) => r.id === roundId);
        const matches = round?.matches ?? [];
        return (
          <GroupSection key={g.id} title={g.name} theme={theme}>
            <MatchRoundList
              matches={matches}
              theme={theme}
              onEdit={onEdit}
              onQuickMatchAction={onQuickMatchAction}
              goalsByMatchId={goalsByMatchId}
            />
          </GroupSection>
        );
      })}
    </div>
  );
}

function KnockoutBracket({
  data,
  theme,
  onEdit,
  onQuickMatchAction,
  goalsByMatchId,
}: {
  data: KnockoutScheduleData;
  theme: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  onQuickMatchAction?: (matchId: string, action: MatchQuickAction) => Promise<void>;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}) {
  const columns = data.rounds.map((r) => ({
    id: r.id,
    label: r.label,
    matches: r.matches,
  }));
  return (
    <BracketView
      columns={columns}
      theme={theme}
      onEdit={onEdit}
      onQuickMatchAction={onQuickMatchAction}
      goalsByMatchId={goalsByMatchId}
    />
  );
}
