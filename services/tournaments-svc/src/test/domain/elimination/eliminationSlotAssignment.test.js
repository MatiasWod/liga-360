import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameEliminationTie, normalizeInscriptionIdStr } from '../../../domain/elimination/eliminationSlotAssignment.js';

test('normalizeInscriptionIdStr convierte números a string', () => {
  assert.equal(normalizeInscriptionIdStr(245), '245');
  assert.equal(normalizeInscriptionIdStr(null), '');
});

test('isSameEliminationTie agrupa ida y vuelta', () => {
  assert.equal(isSameEliminationTie(1, 4, 1, 4), true);
  assert.equal(isSameEliminationTie(1, 4, 1, 2), false);
});
