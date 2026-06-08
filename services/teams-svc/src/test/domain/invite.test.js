import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInvitePrefix, randomThreeDigits } from '../../domain/invite.js';

describe('normalizeInvitePrefix', () => {
  test('extrae prefijo de 3 letras del nombre', () => {
    assert.equal(normalizeInvitePrefix('River Plate'), 'RIV');
    assert.equal(normalizeInvitePrefix('Boca Juniors'), 'BOC');
  });

  test('normaliza caracteres con acento', () => {
    assert.equal(normalizeInvitePrefix('Unión'), 'UNI');
  });

  test('rellena con X si el nombre es corto', () => {
    assert.equal(normalizeInvitePrefix('AB'), 'ABX');
    assert.equal(normalizeInvitePrefix('A'), 'AXX');
  });

  test('usa TEAM como fallback para nombres vacíos', () => {
    assert.equal(normalizeInvitePrefix(''), 'TEA');
    assert.equal(normalizeInvitePrefix(null), 'TEA');
  });

  test('remueve números', () => {
    assert.equal(normalizeInvitePrefix('Team 123'), 'TEA');
  });
});

describe('randomThreeDigits', () => {
  test('genera string de 3 dígitos', () => {
    for (let i = 0; i < 100; i += 1) {
      const digits = randomThreeDigits();
      assert.equal(digits.length, 3);
      assert.ok(/^\d{3}$/.test(digits));
    }
  });
});
