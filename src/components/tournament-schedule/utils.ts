import type {
  GroupsScheduleData,
  KnockoutScheduleData,
  LeagueScheduleData,
  TournamentFormat,
} from './types';

export function getDefaultRoundId(
  type: TournamentFormat,
  data: LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData,
  selectedGroupId?: string | null
): string | null {
  if (type === 'league') {
    const r = (data as LeagueScheduleData).rounds[0];
    return r?.id ?? null;
  }
  if (type === 'knockout') {
    const r = (data as KnockoutScheduleData).rounds[0];
    return r?.id ?? null;
  }
  if (type === 'groups') {
    const groups = (data as GroupsScheduleData).groups;
    const g = groups.find((x) => x.id === selectedGroupId) ?? groups[0];
    return g?.rounds[0]?.id ?? null;
  }
  return null;
}

export function reorderArray<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
