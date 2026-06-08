import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashTeamCode, generateTeamCode } from '../../domain/codes.js';

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
    assert.equal(generateTeamCode().length, 8);
  });

  test('genera código de longitud personalizada', () => {
    assert.equal(generateTeamCode(6).length, 6);
  });

  test('solo usa caracteres del alfabeto permitido', () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 100; i += 1) {
      for (const char of generateTeamCode()) {
        assert.ok(alphabet.includes(char), `Carácter inválido: ${char}`);
      }
    }
  });

  test('genera códigos únicos', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i += 1) codes.add(generateTeamCode());
    assert.equal(codes.size, 50);
  });
});
