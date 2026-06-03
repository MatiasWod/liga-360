import { describe, expect, it } from 'vitest';
import {
  aggregateMatchRecordFromLegs,
  computeTwoLeggedAggregate,
  isTwoLeggedSeries,
} from '../../../components/tournament-schedule/eliminationSeriesUtils';
import type { MatchRecord } from '../../../components/tournament-schedule/types';

function leg(
  id: string,
  legNum: number,
  homeScore: number | null,
  awayScore: number | null,
  status: MatchRecord['status'] = 'completed'
): MatchRecord {
  return {
    id,
    leg: legNum,
    slotIndex: 1,
    homeTeam: { id: 'h', name: 'Local' },
    awayTeam: { id: 'a', name: 'Visitante' },
    homeScore: homeScore ?? undefined,
    awayScore: awayScore ?? undefined,
    status,
  };
}

describe('eliminationSeriesUtils', () => {
  it('isTwoLeggedSeries detecta ida y vuelta', () => {
    expect(isTwoLeggedSeries([{ leg: 1 }, { leg: 2 }])).toBe(true);
    expect(isTwoLeggedSeries([{ leg: 1 }])).toBe(false);
  });

  it('computeTwoLeggedAggregate suma global con roles invertidos en vuelta', () => {
    const agg = computeTwoLeggedAggregate([
      leg('m1', 1, 2, 1),
      leg('m2', 2, 0, 1),
    ]);
    expect(agg?.scoreA).toBe(3);
    expect(agg?.scoreB).toBe(1);
    expect(agg?.bothFinished).toBe(true);
  });

  it('aggregateMatchRecordFromLegs devuelve una sola serie con marcador global', () => {
    const out = aggregateMatchRecordFromLegs([
      leg('m1', 1, 1, 0),
      leg('m2', 2, 0, 2),
    ]);
    expect(out?.homeScore).toBe(3);
    expect(out?.awayScore).toBe(0);
    expect(out?.matchSubtitle).toContain('Global');
  });
});
