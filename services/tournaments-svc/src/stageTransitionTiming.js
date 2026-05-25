export const TRANSITION_TIMING = {
  IN_SEASON: 'in_season',
  NEXT_EDITION: 'next_edition',
};

export function normalizeTransitionTiming(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === TRANSITION_TIMING.NEXT_EDITION) return TRANSITION_TIMING.NEXT_EDITION;
  return TRANSITION_TIMING.IN_SEASON;
}

export function isNextEditionTiming(raw) {
  return normalizeTransitionTiming(raw) === TRANSITION_TIMING.NEXT_EDITION;
}
