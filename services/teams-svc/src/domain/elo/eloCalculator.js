/** Cálculo ELO estándar (W/D/L, sin margen de goles). */

export const DEFAULT_ELO = 1200;
export const ELO_K = 32;

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function actualScores(homeScore, awayScore) {
  if (homeScore > awayScore) return { home: 1, away: 0 };
  if (homeScore < awayScore) return { home: 0, away: 1 };
  return { home: 0.5, away: 0.5 };
}

export function applyEloDelta(rating, expected, actual, k = ELO_K) {
  return Math.round(rating + k * (actual - expected));
}

/** Calcula ratings post-partido sin persistir. */
export function computeMatchElo({ homeRating, awayRating, homeScore, awayScore, k = ELO_K }) {
  const { home: homeActual, away: awayActual } = actualScores(homeScore, awayScore);
  const homeExpected = expectedScore(homeRating, awayRating);
  const awayExpected = expectedScore(awayRating, homeRating);
  const homeAfter = applyEloDelta(homeRating, homeExpected, homeActual, k);
  const awayAfter = applyEloDelta(awayRating, awayExpected, awayActual, k);
  return {
    homeBefore: homeRating,
    awayBefore: awayRating,
    homeDelta: homeAfter - homeRating,
    awayDelta: awayAfter - awayRating,
    homeAfter,
    awayAfter,
  };
}
