/** Validacion de un set de tenis individual (event_type='tennis_set' via /events). Logica pura. */

export const TENNIS_SET_EVENT_TYPE = 'tennis_set';
export const MAX_TENNIS_SET_ROWS = 3;

function parseNonNegativeInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return NaN;
  return n;
}

/**
 * Valida el extra_json de un set (setNumber, homeGames, awayGames) de un evento tennis_set.
 * Devuelve { ok: true, value } normalizado o { ok: false, error }.
 */
export function validateTennisSetExtra(extra) {
  const setNumber = parseNonNegativeInt(extra?.setNumber);
  const homeGames = parseNonNegativeInt(extra?.homeGames);
  const awayGames = parseNonNegativeInt(extra?.awayGames);

  if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > MAX_TENNIS_SET_ROWS) {
    return { ok: false, error: `setNumber invalido (1-${MAX_TENNIS_SET_ROWS})` };
  }
  if (homeGames === null || awayGames === null) {
    return { ok: false, error: 'homeGames y awayGames son requeridos' };
  }
  if (Number.isNaN(homeGames) || Number.isNaN(awayGames)) {
    return { ok: false, error: 'homeGames y awayGames deben ser enteros no negativos' };
  }
  if (homeGames === awayGames) {
    return { ok: false, error: 'Un set no puede terminar empatado en games' };
  }
  return { ok: true, value: { setNumber, homeGames, awayGames } };
}
