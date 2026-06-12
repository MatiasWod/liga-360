import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSetsWon,
  normalizeTennisSetsInput,
  validateTennisScorePayload,
} from '../../domain/tennisScore.js';

describe('tennisScore domain', () => {
  test('ignora filas vacías y calcula sets ganados', () => {
    const normalized = normalizeTennisSetsInput([
      { setNumber: 1, homeGames: 6, awayGames: 4 },
      { setNumber: 2, homeGames: '', awayGames: '' },
      { setNumber: 3, homeGames: 7, awayGames: 5 },
    ]);
    assert.equal(normalized.ok, true);
    assert.equal(normalized.sets.length, 2);
    assert.deepEqual(computeSetsWon(normalized.sets), { home: 2, away: 0 });
  });

  test('rechaza games iguales en un set', () => {
    const normalized = normalizeTennisSetsInput([{ setNumber: 1, homeGames: 6, awayGames: 6 }]);
    assert.equal(normalized.ok, false);
    assert.match(normalized.error, /empatado/);
  });

  test('rechaza fila parcialmente completada', () => {
    const normalized = normalizeTennisSetsInput([{ setNumber: 1, homeGames: 6, awayGames: '' }]);
    assert.equal(normalized.ok, false);
  });

  test('rechaza finalizar sin sets', () => {
    const validated = validateTennisScorePayload({ status: 'completed', sets: [] });
    assert.equal(validated.ok, false);
    assert.match(validated.error, /al menos un set/);
  });

  test('acepta status live sin sets', () => {
    const validated = validateTennisScorePayload({ status: 'live', sets: [] });
    assert.equal(validated.ok, true);
    assert.deepEqual(validated.setsWon, { home: 0, away: 0 });
  });
});
