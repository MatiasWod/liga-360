import { describe, expect, it } from 'vitest';
import { effectiveStageStatus } from '../../../modules/tournaments-list/stageLifecycle';

describe('effectiveStageStatus', () => {
  it('usa stageStatus del backend cuando viene definido', () => {
    expect(effectiveStageStatus({ stageStatus: 'not_started' })).toBe('not_started');
    expect(effectiveStageStatus({ stageStatus: 'active' })).toBe('active');
  });

  it('etapa inicial sin status → active', () => {
    expect(effectiveStageStatus({ isInitial: true })).toBe('active');
  });

  it('etapa no inicial sin status → not_started', () => {
    expect(effectiveStageStatus({ isInitial: false })).toBe('not_started');
  });
});
