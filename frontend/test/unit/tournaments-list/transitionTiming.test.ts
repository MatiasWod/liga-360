import { describe, expect, it } from 'vitest';
import {
  isNextEditionTransition,
  normalizeTransitionTiming,
  parseTransitionPlacementSnapshot,
} from '../../../modules/tournaments-list/transitionTiming';

describe('transitionTiming', () => {
  it('normalizeTransitionTiming default in_season', () => {
    expect(normalizeTransitionTiming(null)).toBe('in_season');
    expect(normalizeTransitionTiming('next_edition')).toBe('next_edition');
  });

  it('isNextEditionTransition', () => {
    expect(isNextEditionTransition({ timing: 'next_edition' })).toBe(true);
    expect(isNextEditionTransition({ timing: 'in_season' })).toBe(false);
  });

  it('parseTransitionPlacementSnapshot', () => {
    const snap = parseTransitionPlacementSnapshot(
      JSON.stringify({
        savedAt: '2026-01-01T00:00:00.000Z',
        sourceStageId: 's1',
        placements: [{ inscriptionId: '1', displayName: 'Alpha' }],
      })
    );
    expect(snap?.placements).toHaveLength(1);
    expect(parseTransitionPlacementSnapshot('not-json')).toBeNull();
  });
});
