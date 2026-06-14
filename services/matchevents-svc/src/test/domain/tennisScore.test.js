import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateTennisSetExtra } from '../../domain/tennisScore.js';

describe('tennisScore domain (validación de un set vía /events)', () => {
  test('acepta un set válido y normaliza', () => {
    const r = validateTennisSetExtra({ setNumber: 1, homeGames: 6, awayGames: 4 });
    assert.equal(r.ok, true);
    assert.deepEqual(r.value, { setNumber: 1, homeGames: 6, awayGames: 4 });
  });

  test('rechaza games iguales en un set', () => {
    const r = validateTennisSetExtra({ setNumber: 1, homeGames: 6, awayGames: 6 });
    assert.equal(r.ok, false);
    assert.match(r.error, /empatado/);
  });

  test('rechaza set parcialmente completado', () => {
    const r = validateTennisSetExtra({ setNumber: 1, homeGames: 6, awayGames: '' });
    assert.equal(r.ok, false);
  });

  test('rechaza setNumber fuera de rango', () => {
    assert.equal(validateTennisSetExtra({ setNumber: 0, homeGames: 6, awayGames: 4 }).ok, false);
    assert.equal(validateTennisSetExtra({ setNumber: 4, homeGames: 6, awayGames: 4 }).ok, false);
  });

  test('rechaza games negativos o no enteros', () => {
    assert.equal(validateTennisSetExtra({ setNumber: 1, homeGames: -1, awayGames: 4 }).ok, false);
    assert.equal(validateTennisSetExtra({ setNumber: 1, homeGames: 6.5, awayGames: 4 }).ok, false);
  });

  test('rechaza extra_json ausente', () => {
    assert.equal(validateTennisSetExtra(undefined).ok, false);
    assert.equal(validateTennisSetExtra(null).ok, false);
  });
});
