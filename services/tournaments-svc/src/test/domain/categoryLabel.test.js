import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_CATEGORY_LABEL_LENGTH, normalizeCategoryLabel } from '../../domain/categoryLabel.js';

test('normalizeCategoryLabel acepta null o vacío', () => {
  assert.equal(normalizeCategoryLabel(null), null);
  assert.equal(normalizeCategoryLabel(''), null);
  assert.equal(normalizeCategoryLabel('   '), null);
});

test('normalizeCategoryLabel recorta y valida caracteres', () => {
  assert.equal(normalizeCategoryLabel('  Femenino '), 'Femenino');
  assert.equal(normalizeCategoryLabel('Sub-23'), 'Sub-23');
  assert.equal(normalizeCategoryLabel('+60'), '+60');
});

test('normalizeCategoryLabel rechaza longitud y caracteres inválidos', () => {
  assert.throws(
    () => normalizeCategoryLabel('a'.repeat(MAX_CATEGORY_LABEL_LENGTH + 1)),
    (err) => err.code === 'VALIDATION'
  );
  assert.throws(
    () => normalizeCategoryLabel('Femenino!'),
    (err) => err.code === 'VALIDATION'
  );
});
