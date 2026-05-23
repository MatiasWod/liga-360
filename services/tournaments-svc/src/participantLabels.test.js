import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPhysicalInscriptionId,
  isPlaceholderParticipantLabel,
  pickPhysicalStandingsRow,
} from './participantLabels.js';

test('isPlaceholderParticipantLabel detecta etiquetas sintéticas', () => {
  assert.equal(isPlaceholderParticipantLabel(''), true);
  assert.equal(isPlaceholderParticipantLabel('Gan. E1-M1'), true);
  assert.equal(isPlaceholderParticipantLabel('Ganador Partido 1 - Repechaje'), true);
  assert.equal(isPlaceholderParticipantLabel('Posición 10 · Liga única'), true);
  assert.equal(isPlaceholderParticipantLabel('10° Liga'), true);
  assert.equal(isPlaceholderParticipantLabel('P1R1'), true);
  assert.equal(isPlaceholderParticipantLabel('pos:l:st:10'), true);
  assert.equal(isPlaceholderParticipantLabel('Boca Juniors'), false);
  assert.equal(isPlaceholderParticipantLabel('River Plate'), false);
});

test('isPhysicalInscriptionId', () => {
  assert.equal(isPhysicalInscriptionId('42'), true);
  assert.equal(isPhysicalInscriptionId('pos:l:x:3'), false);
  assert.equal(isPhysicalInscriptionId('liga360-slot:ew:a:b'), false);
});

test('pickPhysicalStandingsRow prefiere equipo real en la posición', () => {
  const row = pickPhysicalStandingsRow(
    [{ position: 10, inscriptionId: '99', displayName: 'Equipo Real' }],
    10
  );
  assert.equal(row?.displayName, 'Equipo Real');
  assert.equal(
    pickPhysicalStandingsRow(
      [{ position: 10, inscriptionId: 'pos:l:liga:10', displayName: 'Posición 10 · Liga' }],
      10
    ),
    null
  );
});
