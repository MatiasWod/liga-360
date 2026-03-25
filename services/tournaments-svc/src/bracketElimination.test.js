import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eliminationFirstRoundBracketPositions,
  eliminationMatchCount,
  eliminationMatchSlots,
  nextPowerOf2,
} from './bracketElimination.js';

test('nextPowerOf2', () => {
  assert.equal(nextPowerOf2(1), 1);
  assert.equal(nextPowerOf2(5), 8);
  assert.equal(nextPowerOf2(6), 8);
});

test('elimination P=8: 7 partidos y rondas', () => {
  const slots = eliminationMatchSlots(8);
  assert.equal(slots.length, 7);
  assert.equal(eliminationMatchCount(8), 7);
  const r1 = slots.filter((s) => s.round === 1);
  assert.equal(r1.length, 4);
  const r3 = slots.filter((s) => s.round === 3);
  assert.equal(r3.length, 1);
});

test('primera ronda: posiciones de llave 0 vs P-1, …', () => {
  assert.deepEqual(eliminationFirstRoundBracketPositions(8, 1), { idxA: 0, idxB: 7 });
  assert.deepEqual(eliminationFirstRoundBracketPositions(8, 2), { idxA: 1, idxB: 6 });
  assert.deepEqual(eliminationFirstRoundBracketPositions(8, 4), { idxA: 3, idxB: 4 });
});
