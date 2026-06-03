import type {
  GroupsScheduleData,
  KnockoutScheduleData,
  LeagueScheduleData,
  TournamentFormat,
} from './types';

export function listRoundIds(
  type: TournamentFormat,
  data: LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData
): string[] {
  if (type === 'league') {
    return (data as LeagueScheduleData).rounds.map((r) => r.id);
  }
  if (type === 'knockout') {
    return (data as KnockoutScheduleData).rounds.map((r) => r.id);
  }
  if (type === 'groups') {
    const groups = (data as GroupsScheduleData).groups;
    const g = groups[0];
    return (g?.rounds ?? []).map((r) => r.id);
  }
  return [];
}

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

/** Mantiene la fecha activa tras recargar datos (p. ej. al guardar un resultado). */
export function resolveSelectedRoundId(
  type: TournamentFormat,
  data: LeagueScheduleData | GroupsScheduleData | KnockoutScheduleData,
  previousId: string | null | undefined
): string | null {
  const ids = listRoundIds(type, data);
  if (previousId && ids.includes(previousId)) return previousId;
  return getDefaultRoundId(type, data);
}

export function reorderArray<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}
