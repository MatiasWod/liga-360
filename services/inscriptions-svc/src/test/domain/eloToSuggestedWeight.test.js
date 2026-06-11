import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ELO, eloToSuggestedWeight } from '../../domain/eloToSuggestedWeight.js';

test('eloToSuggestedWeight anclas MVP', () => {
  assert.equal(eloToSuggestedWeight(800), 1);
  assert.equal(eloToSuggestedWeight(DEFAULT_ELO), 5);
  assert.equal(eloToSuggestedWeight(1600), 10);
});
