import assert from 'node:assert/strict';
import test from 'node:test';
import { isPhysicalInscriptionId } from '../../../domain/shared/participantLabels.js';

/** Espejo de isSyntheticSlotInscriptionId en index.js */
function isSyntheticSlotInscriptionId(raw) {
  const s = String(raw ?? '').trim();
  return s.startsWith('liga360-slot:') || s.startsWith('pos:');
}

test('refs sintéticos pos:/liga360-slot: no son inscripciones físicas', () => {
  assert.equal(isPhysicalInscriptionId('ins-123'), true);
  assert.equal(isPhysicalInscriptionId('liga360-slot:ew:s:m1'), false);
  assert.equal(isPhysicalInscriptionId('pos:l:stage:5'), false);
  assert.equal(isSyntheticSlotInscriptionId('pos:l:stage:5'), true);
  assert.equal(isSyntheticSlotInscriptionId('liga360-slot:ew:s:m1'), true);
  assert.equal(isSyntheticSlotInscriptionId('team-uuid'), false);
});
