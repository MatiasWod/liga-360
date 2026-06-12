/** Etiquetas de marcador según deporte (sin cambiar el modelo de datos: homeScore/awayScore). */

export type SportScoreLabels = {
  sportKey: 'football' | 'tennis';
  /** Texto corto para inputs (sets / goles). */
  scoreUnit: string;
  /** Ayuda visible al cargar resultado. */
  scoreHint: string;
  entityColumn: string;
  forShort: string;
  againstShort: string;
  diffShort: string;
  /** Oculta goleadores, tarjetas y pestaña de eventos con goles. */
  hideGoalEvents: boolean;
};

function norm(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isTennisSport(sport?: string | null): boolean {
  const raw = norm(sport);
  return raw === 'tennis' || raw === 'tenis' || raw.includes('tenis');
}

export function isIndividualsParticipantType(participantType?: string | null): boolean {
  const raw = norm(participantType);
  return (
    raw === 'participant' ||
    raw === 'participants' ||
    raw === 'individual' ||
    raw === 'individuals'
  );
}

export function sportDisplayName(sport?: string | null): string {
  if (isTennisSport(sport)) return 'Tenis';
  const raw = norm(sport);
  if (raw === 'football' || raw === 'futbol' || raw.includes('futbol')) return 'Fútbol';
  return sport?.trim() || 'Fútbol';
}

export function resolveSportScoreLabels(
  sport?: string | null,
  participantType?: string | null,
): SportScoreLabels {
  if (isTennisSport(sport)) {
    return {
      sportKey: 'tennis',
      scoreUnit: 'sets',
      scoreHint: 'Ingresá games por set (hasta 3). El marcador en sets se calcula al guardar.',
      entityColumn: isIndividualsParticipantType(participantType) ? 'Jugador' : 'Participante',
      forShort: 'SF',
      againstShort: 'SC',
      diffShort: 'DS',
      hideGoalEvents: true,
    };
  }
  return {
    sportKey: 'football',
    scoreUnit: 'goles',
    scoreHint: 'Cargá goles de cada lado.',
    entityColumn: isIndividualsParticipantType(participantType) ? 'Participante' : 'Equipo',
    forShort: 'GF',
    againstShort: 'GC',
    diffShort: 'DG',
    hideGoalEvents: false,
  };
}
