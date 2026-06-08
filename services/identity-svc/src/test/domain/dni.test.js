import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDni } from '../../domain/dni.js';

describe('normalizeDni', () => {
  test('normaliza DNI de 7 y 8 dígitos', () => {
    assert.equal(normalizeDni('1234567'), '1234567');
    assert.equal(normalizeDni('12345678'), '12345678');
  });

  test('remueve separadores', () => {
    assert.equal(normalizeDni('12.345.678'), '12345678');
  });

  test('rechaza longitudes inválidas y valores nulos', () => {
    assert.equal(normalizeDni('123456'), null);
    assert.equal(normalizeDni('123456789'), null);
    assert.equal(normalizeDni(null), null);
    assert.equal(normalizeDni(''), null);
    assert.equal(normalizeDni('abc'), null);
  });
});
