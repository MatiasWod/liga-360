/** Datos reales (simplificados) del Mundial Qatar 2022 para seed local. */

export const TOURNAMENT_NAME = 'Mundial Qatar 2022';
export const COMPETITION_NAME = 'Copa del Mundo';

/** Grupos oficiales A–H (32 selecciones). */
export const GROUPS = [
  ['Catar', 'Ecuador', 'Senegal', 'Países Bajos'],
  ['Inglaterra', 'Irán', 'Estados Unidos', 'Gales'],
  ['Argentina', 'Arabia Saudita', 'México', 'Polonia'],
  ['Francia', 'Australia', 'Dinamarca', 'Túnez'],
  ['España', 'Costa Rica', 'Alemania', 'Japón'],
  ['Bélgica', 'Canadá', 'Marruecos', 'Croacia'],
  ['Brasil', 'Serbia', 'Suiza', 'Camerún'],
  ['Portugal', 'Ghana', 'Uruguay', 'Corea del Sur'],
];

export const ALL_TEAMS = GROUPS.flat();

/** Clasificados a octavos (2 por grupo), ordenados como seeds 1–16 para el cuadro. */
export const KNOCKOUT_TEAMS = [
  'Argentina',
  'Francia',
  'Brasil',
  'Inglaterra',
  'Países Bajos',
  'Croacia',
  'Marruecos',
  'Portugal',
  'Japón',
  'España',
  'Senegal',
  'Estados Unidos',
  'Polonia',
  'Suiza',
  'Corea del Sur',
  'Australia',
];

/** Resultados de fase de grupos: [local, visitante, golesLocal, golesVisitante]. */
export const GROUP_MATCH_RESULTS = [
  // Grupo A
  ['Catar', 'Ecuador', 0, 2],
  ['Senegal', 'Países Bajos', 0, 2],
  ['Catar', 'Senegal', 1, 3],
  ['Países Bajos', 'Ecuador', 1, 1],
  ['Ecuador', 'Senegal', 1, 2],
  ['Países Bajos', 'Catar', 2, 0],
  // Grupo B
  ['Inglaterra', 'Irán', 6, 2],
  ['Estados Unidos', 'Gales', 1, 1],
  ['Gales', 'Irán', 0, 2],
  ['Inglaterra', 'Estados Unidos', 0, 0],
  ['Gales', 'Inglaterra', 0, 3],
  ['Irán', 'Estados Unidos', 0, 1],
  // Grupo C
  ['Argentina', 'Arabia Saudita', 1, 2],
  ['México', 'Polonia', 0, 0],
  ['Polonia', 'Arabia Saudita', 2, 0],
  ['Argentina', 'México', 2, 0],
  ['Polonia', 'Argentina', 0, 2],
  ['Arabia Saudita', 'México', 1, 2],
  // Grupo D
  ['Dinamarca', 'Túnez', 0, 0],
  ['Francia', 'Australia', 4, 1],
  ['Túnez', 'Australia', 0, 1],
  ['Francia', 'Dinamarca', 2, 1],
  ['Australia', 'Dinamarca', 0, 0],
  ['Túnez', 'Francia', 1, 0],
  // Grupo E
  ['Alemania', 'Japón', 1, 2],
  ['España', 'Costa Rica', 7, 0],
  ['Japón', 'Costa Rica', 0, 1],
  ['España', 'Alemania', 1, 1],
  ['Japón', 'España', 2, 1],
  ['Costa Rica', 'Alemania', 2, 4],
  // Grupo F
  ['Marruecos', 'Croacia', 0, 0],
  ['Bélgica', 'Canadá', 1, 0],
  ['Bélgica', 'Marruecos', 0, 2],
  ['Croacia', 'Canadá', 4, 1],
  ['Croacia', 'Bélgica', 0, 0],
  ['Canadá', 'Marruecos', 1, 2],
  // Grupo G
  ['Serbia', 'Brasil', 0, 1],
  ['Suiza', 'Camerún', 1, 0],
  ['Camerún', 'Serbia', 3, 3],
  ['Brasil', 'Suiza', 1, 0],
  ['Camerún', 'Brasil', 1, 0],
  ['Suiza', 'Serbia', 3, 2],
  // Grupo H
  ['Uruguay', 'Corea del Sur', 0, 0],
  ['Portugal', 'Ghana', 3, 2],
  ['Corea del Sur', 'Ghana', 2, 3],
  ['Portugal', 'Uruguay', 2, 0],
  ['Ghana', 'Uruguay', 0, 2],
  ['Corea del Sur', 'Portugal', 2, 1],
];

/**
 * Eliminatorias. Empates en 90' resueltos con marcador que deja ganador claro
 * (penales representados como goles extra, p. ej. final ARG 4-2).
 */
export const KNOCKOUT_MATCH_RESULTS = [
  ['Países Bajos', 'Estados Unidos', 3, 1],
  ['Argentina', 'Australia', 2, 1],
  ['Francia', 'Polonia', 3, 1],
  ['Inglaterra', 'Senegal', 3, 0],
  ['Japón', 'Croacia', 1, 3],
  ['Brasil', 'Corea del Sur', 4, 1],
  ['Marruecos', 'España', 3, 0],
  ['Portugal', 'Suiza', 6, 1],
  ['Países Bajos', 'Argentina', 2, 3],
  ['Croacia', 'Brasil', 1, 2],
  ['Inglaterra', 'Francia', 1, 2],
  ['Marruecos', 'Portugal', 1, 0],
  ['Argentina', 'Croacia', 3, 0],
  ['Francia', 'Marruecos', 2, 0],
  ['Croacia', 'Marruecos', 2, 1],
  ['Argentina', 'Francia', 4, 2],
];
