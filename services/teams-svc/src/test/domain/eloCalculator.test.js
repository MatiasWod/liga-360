import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ELO,
  actualScores,
  computeMatchElo,
  expectedScore,
} from '../../domain/elo/eloCalculator.js';
import { eloToSuggestedWeight } from '../../domain/elo/eloToSuggestedWeight.js';

test('expectedScore favorito tiene expectativa alta', () => {
  assert.ok(expectedScore(1400, 1200) > 0.6);
});

test('upset: débil gana a fuerte y sube bastante', () => {
  const r = computeMatchElo({ homeRating: 1300, awayRating: 1450, homeScore: 2, awayScore: 1 });
  assert.ok(r.homeDelta > 15);
  assert.ok(r.awayDelta < -10);
});

test('favorito gana y sube poco', () => {
  const r = computeMatchElo({ homeRating: 1450, awayRating: 1300, homeScore: 1, awayScore: 0 });
  assert.ok(r.homeDelta > 0);
  assert.ok(r.homeDelta < 12);
});

test('empate entre iguales no mueve rating', () => {
  const r = computeMatchElo({ homeRating: 1200, awayRating: 1200, homeScore: 1, awayScore: 1 });
  assert.equal(r.homeDelta, 0);
  assert.equal(r.awayDelta, 0);
});

test('actualScores empate', () => {
  assert.deepEqual(actualScores(0, 0), { home: 0.5, away: 0.5 });
});

test('eloToSuggestedWeight mapeo anclas', () => {
  assert.equal(eloToSuggestedWeight(800), 1);
  assert.equal(eloToSuggestedWeight(DEFAULT_ELO), 5);
  assert.equal(eloToSuggestedWeight(1600), 10);
});
