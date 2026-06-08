import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStageAllowsMatchResults,
  computeEffectiveStageStatus,
} from './stageStatus.js';

test('etapa inicial sin fuentes → active', () => {
  assert.equal(
    computeEffectiveStageStatus({ persisted: null, sourceCount: 0, finishedCount: 0 }),
    'active'
  );
});

test('etapa con fuentes sin finalizar → not_started', () => {
  assert.equal(
    computeEffectiveStageStatus({ persisted: null, sourceCount: 1, finishedCount: 0 }),
    'not_started'
  );
  assert.equal(
    computeEffectiveStageStatus({ persisted: null, sourceCount: 2, finishedCount: 1 }),
    'not_started'
  );
});

test('todas las fuentes finalizadas → active', () => {
  assert.equal(
    computeEffectiveStageStatus({ persisted: null, sourceCount: 2, finishedCount: 2 }),
    'active'
  );
});

test('respeta stageStatus persistido', () => {
  assert.equal(
    computeEffectiveStageStatus({ persisted: 'finished', sourceCount: 0, finishedCount: 0 }),
    'finished'
  );
  assert.equal(
    computeEffectiveStageStatus({ persisted: 'active', sourceCount: 1, finishedCount: 0 }),
    'active'
  );
});

test('assertStageAllowsMatchResults bloquea not_started y finished', () => {
  assert.throws(() => assertStageAllowsMatchResults('not_started'), /STAGE_NOT_STARTED/);
  assert.throws(() => assertStageAllowsMatchResults('finished'), /STAGE_FINISHED/);
  assert.doesNotThrow(() => assertStageAllowsMatchResults('active'));
});
