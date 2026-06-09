import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDni } from '../../domain/dni.js';

describe('normalizeDni', () => {
  test('normaliza DNI de 7 dígitos', () => {
    assert.equal(normalizeDni('1234567'), '1234567');
  });

  test('normaliza DNI de 8 dígitos', () => {
    assert.equal(normalizeDni('12345678'), '12345678');
  });

  test('remueve caracteres no numéricos', () => {
    assert.equal(normalizeDni('12.345.678'), '12345678');
    assert.equal(normalizeDni('12 345 678'), '12345678');
  });

  test('rechaza DNI con menos de 7 dígitos', () => {
    assert.equal(normalizeDni('123456'), null);
    assert.equal(normalizeDni('12345'), null);
  });

  test('rechaza DNI con más de 8 dígitos', () => {
    assert.equal(normalizeDni('123456789'), null);
  });

  test('rechaza valores nulos e inválidos', () => {
    assert.equal(normalizeDni(null), null);
    assert.equal(normalizeDni(undefined), null);
    assert.equal(normalizeDni(''), null);
    assert.equal(normalizeDni('abc'), null);
  });
});
