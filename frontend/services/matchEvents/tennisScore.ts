import type { MatchEvent } from './types';

export type TennisSetInput = {
  setNumber: number;
  homeGames: number | '';
  awayGames: number | '';
};

export type TennisSetDetail = {
  setNumber: number;
  homeGames: number;
  awayGames: number;
};

export const EMPTY_TENNIS_SET_ROWS: TennisSetInput[] = [
  { setNumber: 1, homeGames: '', awayGames: '' },
  { setNumber: 2, homeGames: '', awayGames: '' },
  { setNumber: 3, homeGames: '', awayGames: '' },
];

export function parseTennisSetEvents(events: MatchEvent[]): TennisSetDetail[] {
  return events
    .filter((e) => e.event_type === 'tennis_set')
    .map((e) => {
      const extra = (e.extra_json || {}) as Record<string, unknown>;
      return {
        setNumber: Number(extra.setNumber),
        homeGames: Number(extra.homeGames),
        awayGames: Number(extra.awayGames),
      };
    })
    .filter((s) => Number.isFinite(s.setNumber) && Number.isFinite(s.homeGames) && Number.isFinite(s.awayGames))
    .sort((a, b) => a.setNumber - b.setNumber);
}

export function tennisSetsToFormRows(events: MatchEvent[]): TennisSetInput[] {
  const details = parseTennisSetEvents(events);
  const rows = EMPTY_TENNIS_SET_ROWS.map((row) => ({ ...row }));
  for (const detail of details) {
    const idx = detail.setNumber - 1;
    if (idx >= 0 && idx < rows.length) {
      rows[idx] = {
        setNumber: detail.setNumber,
        homeGames: detail.homeGames,
        awayGames: detail.awayGames,
      };
    }
  }
  return rows;
}

export function formatTennisSetLine(set: TennisSetDetail): string {
  return `Set ${set.setNumber}: ${set.homeGames}–${set.awayGames}`;
}

/** Filas con ambos games cargados (las que se persisten como eventos tennis_set). */
export function filledTennisSets(sets: TennisSetInput[]): TennisSetDetail[] {
  return sets
    .filter((s) => s.homeGames !== '' && s.awayGames !== '')
    .map((s) => ({ setNumber: s.setNumber, homeGames: Number(s.homeGames), awayGames: Number(s.awayGames) }));
}

/**
 * Valida las filas del formulario antes de persistir. Devuelve el mensaje de error o null.
 * Reglas: no se permite un set a medias (un solo lado cargado), games enteros no negativos
 * y un set no puede terminar empatado.
 */
export function validateTennisSets(sets: TennisSetInput[]): string | null {
  for (const s of sets) {
    const homeEmpty = s.homeGames === '';
    const awayEmpty = s.awayGames === '';
    if (homeEmpty !== awayEmpty) return `Completá ambos games del set ${s.setNumber}`;
    if (!homeEmpty && !awayEmpty) {
      const h = Number(s.homeGames);
      const a = Number(s.awayGames);
      if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
        return `Games inválidos en el set ${s.setNumber}`;
      }
      if (h === a) return `El set ${s.setNumber} no puede terminar empatado`;
    }
  }
  return null;
}

/** Sets ganados por cada lado (el marcador del partido en tenis = sets ganados). */
export function computeSetsWon(sets: TennisSetInput[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const s of filledTennisSets(sets)) {
    if (s.homeGames > s.awayGames) home += 1;
    else if (s.awayGames > s.homeGames) away += 1;
  }
  return { home, away };
}
