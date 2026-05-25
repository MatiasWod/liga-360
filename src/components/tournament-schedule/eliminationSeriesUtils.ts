import type { MatchRecord, TeamRef } from './types';

export type TwoLeggedAggregate = {
  teamA: TeamRef;
  teamB: TeamRef;
  scoreA: number;
  scoreB: number;
  hasData: boolean;
  bothFinished: boolean;
  partial: boolean;
  status: MatchRecord['status'];
};

type LegLike = {
  leg?: number | null;
  homeTeam?: TeamRef;
  awayTeam?: TeamRef;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: MatchRecord['status'];
};

export function isTwoLeggedSeries(legs: ReadonlyArray<{ leg?: number | null }>): boolean {
  if (legs.length < 2) return false;
  const legNums = new Set(legs.map((l) => Number(l.leg ?? 0)).filter((n) => n > 0));
  return legNums.has(1) && legNums.has(2);
}

export function computeTwoLeggedAggregate(legs: ReadonlyArray<LegLike>): TwoLeggedAggregate | null {
  if (legs.length === 0) return null;
  const sorted = legs.slice().sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
  const leg1 = sorted[0];
  const leg2 = sorted[1];
  const teamA = leg1.homeTeam ?? { id: '', name: '—' };
  const teamB = leg1.awayTeam ?? { id: '', name: '—' };

  let scoreA = 0;
  let scoreB = 0;
  let hasData = false;

  if (leg1.homeScore != null) {
    scoreA += leg1.homeScore;
    hasData = true;
  }
  if (leg1.awayScore != null) {
    scoreB += leg1.awayScore;
    hasData = true;
  }

  if (leg2) {
    if (leg2.homeScore != null) {
      scoreB += leg2.homeScore;
      hasData = true;
    }
    if (leg2.awayScore != null) {
      scoreA += leg2.awayScore;
      hasData = true;
    }
  }

  const statuses = sorted.map((l) => l.status ?? 'scheduled');
  const bothFinished = statuses.every((s) => s === 'completed');
  const status: MatchRecord['status'] = bothFinished
    ? 'completed'
    : statuses.some((s) => s === 'live')
      ? 'live'
      : statuses.some((s) => s === 'postponed')
        ? 'postponed'
        : 'scheduled';

  return {
    teamA,
    teamB,
    scoreA,
    scoreB,
    hasData,
    bothFinished,
    partial: hasData && !bothFinished,
    status,
  };
}

export function aggregateMatchRecordFromLegs(legs: MatchRecord[]): MatchRecord | null {
  if (legs.length === 0) return null;
  const sorted = legs.slice().sort((a, b) => (a.leg ?? 0) - (b.leg ?? 0));
  const primary = sorted[0];
  if (!isTwoLeggedSeries(sorted)) return primary;

  const agg = computeTwoLeggedAggregate(sorted);
  if (!agg) return primary;

  return {
    ...primary,
    id: primary.id,
    homeTeam: agg.teamA,
    awayTeam: agg.teamB,
    homeScore: agg.hasData ? agg.scoreA : undefined,
    awayScore: agg.hasData ? agg.scoreB : undefined,
    status: agg.status,
    matchSubtitle: primary.matchSubtitle
      ? `${primary.matchSubtitle} · Global`
      : 'Serie · Global',
  };
}
