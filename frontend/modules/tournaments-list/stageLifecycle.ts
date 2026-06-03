export type StageLifecycleStatus = 'not_started' | 'active' | 'finished';

/** Estado de ciclo de vida para UI cuando el backend no envió stageStatus. */
export function effectiveStageStatus(
  stage: { stageStatus?: string | null; isInitial?: boolean | null } | null | undefined
): StageLifecycleStatus {
  const raw = String(stage?.stageStatus ?? '').trim().toLowerCase();
  if (raw === 'not_started' || raw === 'active' || raw === 'finished') {
    return raw;
  }
  if (stage?.isInitial) return 'active';
  return 'not_started';
}
