import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countRoundRobinMatchesSingle,
  doubleRoundRobinFromSingle,
  singleRoundRobinSchedule,
  validateSingleRoundRobin,
} from '../../../domain/scheduling/roundRobin.js';

test('N=4: cantidad de partidos y rondas', () => {
  const s = singleRoundRobinSchedule(4);
  assert.equal(s.length, 3);
  const total = s.reduce((acc, r) => acc + r.length, 0);
  assert.equal(total, 6);
  assert.equal(countRoundRobinMatchesSingle(4), 6);
  assert.equal(validateSingleRoundRobin(s, 4).ok, true);
});

test('N=5 impar: validación y bye', () => {
  const s = singleRoundRobinSchedule(5);
  assert.equal(s.length, 5);
  const competitive = s.reduce(
    (acc, r) => acc + r.filter((m) => m.homeSeed != null && m.awaySeed != null).length,
    0
  );
  assert.equal(competitive, 10);
  assert.equal(validateSingleRoundRobin(s, 5).ok, true);
  const byesPerRound = s.map((r) => r.filter((m) => m.awaySeed === null && m.homeSeed !== null).length);
  assert.ok(byesPerRound.every((c) => c === 1));
});

test('N=6 y N=7: sin duplicados', () => {
  for (const n of [6, 7]) {
    const s = singleRoundRobinSchedule(n);
    const v = validateSingleRoundRobin(s, n);
    assert.equal(v.ok, true, `n=${n}`);
  }
});

test('doble ronda: duplica partidos con localía invertida', () => {
  const s = singleRoundRobinSchedule(4);
  const d = doubleRoundRobinFromSingle(s);
  assert.equal(d.length, 6);
  let total = 0;
  for (const r of d) total += r.length;
  assert.equal(total, 12);
});
