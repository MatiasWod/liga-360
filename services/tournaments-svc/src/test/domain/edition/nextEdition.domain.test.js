import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectOutgoingSnapshotInscriptionIds,
  computePermanencyInscriptions,
  dedupeRowsByTeam,
  parsePlacementSnapshot,
  resolveDestinationStageId,
} from '../../../domain/edition/nextEdition.domain.js';

test('parsePlacementSnapshot valida placements', () => {
  const raw = JSON.stringify({
    savedAt: '2026-01-01T00:00:00.000Z',
    sourceStageId: 's-1',
    placements: [{ inscriptionId: '10', displayName: 'Equipo A' }],
  });
  const parsed = parsePlacementSnapshot(raw);
  assert.equal(parsed?.placements.length, 1);
  assert.equal(parsed?.placements[0].inscriptionId, '10');
});

test('resolveDestinationStageId prioriza toStageId y resuelve external this', () => {
  assert.equal(resolveDestinationStageId({ toStageId: 's-dest' }, 't-1'), 's-dest');
  assert.equal(
    resolveDestinationStageId({ toExternalTournamentId: 'this', toExternalStageId: 's-ext' }, 't-1'),
    's-ext'
  );
  assert.equal(resolveDestinationStageId({ toExternalTournamentId: 'other', toExternalStageId: 's-ext' }, 't-1'), null);
});

test('permanencias excluyen inscripciones en snapshots salientes', () => {
  const transitions = [
    {
      fromStageId: 's-a',
      timing: 'next_edition',
      placementSnapshotJson: JSON.stringify({
        sourceStageId: 's-a',
        placements: [{ inscriptionId: '2', displayName: 'B' }],
      }),
    },
  ];
  const outgoing = collectOutgoingSnapshotInscriptionIds(transitions, ['s-a']);
  const accepted = [
    { id: 1, display_name: 'A', status: 'ACEPTADO', competition_id: 'c-1' },
    { id: 2, display_name: 'B', status: 'ACEPTADO', competition_id: 'c-1' },
    { id: 3, display_name: 'C', status: 'ACEPTADO', competition_id: 'c-1' },
  ];
  const permanencies = computePermanencyInscriptions(accepted, outgoing);
  assert.deepEqual(permanencies.map((r) => r.id), [1, 3]);
});

test('dedupeRowsByTeam evita duplicados por linked_team_id en misma competencia', () => {
  const rows = dedupeRowsByTeam([
    {
      targetCompetitionId: 'c-new',
      linked_team_id: 5,
      display_name: 'Alpha',
    },
    {
      targetCompetitionId: 'c-new',
      linked_team_id: 5,
      display_name: 'Alpha FC',
    },
  ]);
  assert.equal(rows.length, 1);
});
