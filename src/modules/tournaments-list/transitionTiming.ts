export type TransitionTiming = 'in_season' | 'next_edition';

export function normalizeTransitionTiming(raw: string | null | undefined): TransitionTiming {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'next_edition' ? 'next_edition' : 'in_season';
}

export function isNextEditionTransition(tr: { timing?: string | null } | null | undefined): boolean {
  return normalizeTransitionTiming(tr?.timing) === 'next_edition';
}

export type TransitionPlacementSnapshot = {
  savedAt: string;
  sourceStageId: string;
  placements: Array<{
    inscriptionId: string;
    displayName: string;
    position?: number;
  }>;
};

export function parseTransitionPlacementSnapshot(
  raw: string | null | undefined
): TransitionPlacementSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TransitionPlacementSnapshot;
    if (!parsed || !Array.isArray(parsed.placements)) return null;
    return parsed;
  } catch {
    return null;
  }
}
