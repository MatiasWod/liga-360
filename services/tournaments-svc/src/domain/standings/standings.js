export const STANDINGS_DEFAULTS = {
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
};

function toSafeNumber(value) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createEmptyRow(inscription) {
  return {
    position: 0,
    inscriptionId: String(inscription?.inscriptionId ?? ''),
    displayName: String(inscription?.displayName ?? inscription?.inscriptionId ?? ''),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function ensureTeamRow(rowsByInscriptionId, inscriptionId, displayName) {
  const normalizedId = String(inscriptionId ?? '');
  if (!normalizedId) return null;
  if (!rowsByInscriptionId.has(normalizedId)) {
    rowsByInscriptionId.set(normalizedId, createEmptyRow({ inscriptionId: normalizedId, displayName }));
  }
  const row = rowsByInscriptionId.get(normalizedId);
  if (displayName && !row.displayName) {
    row.displayName = String(displayName);
  }
  return row;
}

/** Estado efectivo del partido (status y matchStatus pueden divergir en Neo4j). */
export function effectiveMatchStatus(match) {
  const ms = String(match?.matchStatus ?? '').toLowerCase();
  const st = String(match?.status ?? '').toLowerCase();
  if (ms === 'finished' || ms === 'completed') return 'finished';
  if (st === 'finished' || st === 'completed') return 'finished';
  return ms || st || 'scheduled';
}

export function computeStandings(matches = [], inscriptions = [], config = {}) {
  const scoring = {
    ...STANDINGS_DEFAULTS,
    ...config,
  };

  const rowsByInscriptionId = new Map();
  for (const inscription of inscriptions) {
    const inscriptionId = String(inscription?.inscriptionId ?? '');
    if (!inscriptionId) continue;
    rowsByInscriptionId.set(inscriptionId, createEmptyRow(inscription));
  }

  for (const match of matches) {
    const ms = effectiveMatchStatus(match);
    if (ms !== 'finished' && ms !== 'completed') continue;
    // Para partidos finalizados, un score null se trata como 0 (consistente con la UI).
    const homeScore = toSafeNumber(match?.homeScore) ?? 0;
    const awayScore = toSafeNumber(match?.awayScore) ?? 0;

    const homeRow = ensureTeamRow(rowsByInscriptionId, match?.homeInscriptionId, match?.homeDisplayName);
    const awayRow = ensureTeamRow(rowsByInscriptionId, match?.awayInscriptionId, match?.awayDisplayName);
    if (!homeRow || !awayRow) continue;

    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += homeScore;
    homeRow.goalsAgainst += awayScore;
    awayRow.goalsFor += awayScore;
    awayRow.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      homeRow.won += 1;
      awayRow.lost += 1;
    } else if (homeScore < awayScore) {
      awayRow.won += 1;
      homeRow.lost += 1;
    } else {
      homeRow.drawn += 1;
      awayRow.drawn += 1;
    }
  }

  const rows = Array.from(rowsByInscriptionId.values()).map((row) => {
    const goalDifference = row.goalsFor - row.goalsAgainst;
    const points =
      row.won * Number(scoring.winPoints ?? STANDINGS_DEFAULTS.winPoints) +
      row.drawn * Number(scoring.drawPoints ?? STANDINGS_DEFAULTS.drawPoints) +
      row.lost * Number(scoring.lossPoints ?? STANDINGS_DEFAULTS.lossPoints);
    return {
      ...row,
      goalDifference,
      points,
    };
  });

  rows.sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.goalDifference !== left.goalDifference) return right.goalDifference - left.goalDifference;
    if (right.goalsFor !== left.goalsFor) return right.goalsFor - left.goalsFor;
    const byName = left.displayName.localeCompare(right.displayName);
    if (byName !== 0) return byName;
    return String(left.inscriptionId).localeCompare(String(right.inscriptionId));
  });

  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}
