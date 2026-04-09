import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDni, hashTeamCode, generateTeamCode, normalizeInvitePrefix, randomThreeDigits } from './utils.js';

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

describe('hashTeamCode', () => {
  test('genera hash consistente', () => {
    const hash1 = hashTeamCode('ABC12345');
    const hash2 = hashTeamCode('ABC12345');
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 hex
  });

  test('hashes diferentes para códigos diferentes', () => {
    const hash1 = hashTeamCode('CODE1');
    const hash2 = hashTeamCode('CODE2');
    assert.notEqual(hash1, hash2);
  });
});

describe('generateTeamCode', () => {
  test('genera código de longitud por defecto 8', () => {
    const code = generateTeamCode();
    assert.equal(code.length, 8);
  });

  test('genera código de longitud personalizada', () => {
    const code = generateTeamCode(6);
    assert.equal(code.length, 6);
  });

  test('solo usa caracteres del alfabeto permitido', () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 100; i++) {
      const code = generateTeamCode();
      for (const char of code) {
        assert.ok(alphabet.includes(char), `Carácter inválido: ${char}`);
      }
    }
  });

  test('genera códigos únicos', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(generateTeamCode());
    }
    assert.equal(codes.size, 50);
  });
});

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
    for (let i = 0; i < 100; i++) {
      const digits = randomThreeDigits();
      assert.equal(digits.length, 3);
      assert.ok(/^\d{3}$/.test(digits));
    }
  });
});
