import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNextEditionTiming,
  normalizeTransitionTiming,
  TRANSITION_TIMING,
} from '../../../domain/stage/stageTransitionTiming.js';

test('normalizeTransitionTiming default in_season', () => {
  assert.equal(normalizeTransitionTiming(null), TRANSITION_TIMING.IN_SEASON);
  assert.equal(normalizeTransitionTiming(''), TRANSITION_TIMING.IN_SEASON);
  assert.equal(normalizeTransitionTiming('in_season'), TRANSITION_TIMING.IN_SEASON);
});

test('normalizeTransitionTiming next_edition', () => {
  assert.equal(normalizeTransitionTiming('next_edition'), TRANSITION_TIMING.NEXT_EDITION);
  assert.equal(isNextEditionTiming('next_edition'), true);
  assert.equal(isNextEditionTiming('in_season'), false);
});
