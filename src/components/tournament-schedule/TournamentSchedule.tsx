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
import { getDefaultRoundId } from './utils';
import type { GoalRecord } from './MatchCard';

export const TournamentSchedule: React.FC<
  TournamentScheduleProps & {
    onEdit?: (matchId: string) => void;
    goalsByMatchId?: Record<string, GoalRecord[]>;
  }
> = ({
  type,
  data,
  theme = 'dark',
  className = '',
  onEdit,
  goalsByMatchId,
}) => {
  const [selectedRoundId, setSelectedRoundId] = React.useState<string | null>(() =>
    getDefaultRoundId(type, data as LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData)
  );

  React.useEffect(() => {
    const id = getDefaultRoundId(type, data as LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData);
    if (id) setSelectedRoundId(id);
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
            <LeagueRound data={data as LeagueScheduleData} roundId={selectedRoundId} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />
          ) : null}

          {type === 'groups' && selectedRoundId ? (
            <GroupsRounds data={data as GroupsScheduleData} roundId={selectedRoundId} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />
          ) : null}

          {type === 'knockout' ? (
            <KnockoutBracket data={data as KnockoutScheduleData} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />
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
  goalsByMatchId,
}: {
  data: LeagueScheduleData;
  roundId: string;
  theme: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}) {
  const round = data.rounds.find((r) => r.id === roundId);
  const matches = round?.matches ?? [];
  return <MatchRoundList matches={matches} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />;
}

function GroupsRounds({
  data,
  roundId,
  theme,
  onEdit,
  goalsByMatchId,
}: {
  data: GroupsScheduleData;
  roundId: string;
  theme: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.groups.map((g) => {
        const round = g.rounds.find((r) => r.id === roundId);
        const matches = round?.matches ?? [];
        return (
          <GroupSection key={g.id} title={g.name} theme={theme}>
            <MatchRoundList matches={matches} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />
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
  goalsByMatchId,
}: {
  data: KnockoutScheduleData;
  theme: 'light' | 'dark';
  onEdit?: (matchId: string) => void;
  goalsByMatchId?: Record<string, GoalRecord[]>;
}) {
  const columns = data.rounds.map((r) => ({
    id: r.id,
    label: r.label,
    matches: r.matches,
  }));
  return <BracketView columns={columns} theme={theme} onEdit={onEdit} goalsByMatchId={goalsByMatchId} />;
}
