/** Validación y cálculo de marcador de tenis por set × games (lógica pura). */

export const TENNIS_SET_EVENT_TYPE = 'tennis_set';
export const MAX_TENNIS_SET_ROWS = 3;

function parseNonNegativeInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return NaN;
  return n;
}

function isRowEmpty(row) {
  const home = row?.homeGames;
  const away = row?.awayGames;
  const homeEmpty = home === '' || home === null || home === undefined;
  const awayEmpty = away === '' || away === null || away === undefined;
  return homeEmpty && awayEmpty;
}

/**
 * Normaliza el payload de sets del organizador.
 * Filas vacías se ignoran; filas parciales o con empate en games fallan.
 */
export function normalizeTennisSetsInput(sets) {
  if (!Array.isArray(sets)) {
    return { ok: false, error: 'sets debe ser un arreglo' };
  }
  if (sets.length > MAX_TENNIS_SET_ROWS) {
    return { ok: false, error: `Máximo ${MAX_TENNIS_SET_ROWS} sets` };
  }

  const normalized = [];
  const seenSetNumbers = new Set();

  for (const raw of sets) {
    if (isRowEmpty(raw)) continue;

    const setNumber = parseNonNegativeInt(raw?.setNumber);
    const homeGames = parseNonNegativeInt(raw?.homeGames);
    const awayGames = parseNonNegativeInt(raw?.awayGames);

    if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > MAX_TENNIS_SET_ROWS) {
      return { ok: false, error: 'setNumber inválido (1–3)' };
    }
    if (Number.isNaN(homeGames) || Number.isNaN(awayGames)) {
      return { ok: false, error: 'homeGames y awayGames deben ser enteros no negativos' };
    }
    if (homeGames === null || awayGames === null) {
      return { ok: false, error: 'Completá games de local y visitante en cada set' };
    }
    if (homeGames === awayGames) {
      return { ok: false, error: 'Un set no puede terminar empatado en games' };
    }
    if (seenSetNumbers.has(setNumber)) {
      return { ok: false, error: `Set ${setNumber} duplicado` };
    }
    seenSetNumbers.add(setNumber);

    normalized.push({
      setNumber,
      homeGames,
      awayGames,
      displayName: `Set ${setNumber}`,
      extraJson: { setNumber, homeGames, awayGames },
    });
  }

  normalized.sort((a, b) => a.setNumber - b.setNumber);
  return { ok: true, sets: normalized };
}

export function computeSetsWon(sets) {
  let home = 0;
  let away = 0;
  for (const s of sets) {
    if (s.homeGames > s.awayGames) home += 1;
    else if (s.awayGames > s.homeGames) away += 1;
  }
  return { home, away };
}

export function isFinishedStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'finished';
}

export function validateTennisScorePayload({ status, sets }) {
  const normalized = normalizeTennisSetsInput(sets);
  if (!normalized.ok) return normalized;

  if (isFinishedStatus(status) && normalized.sets.length === 0) {
    return { ok: false, error: 'Ingresá al menos un set para finalizar el partido' };
  }

  const setsWon = computeSetsWon(normalized.sets);
  return { ok: true, sets: normalized.sets, setsWon };
}
