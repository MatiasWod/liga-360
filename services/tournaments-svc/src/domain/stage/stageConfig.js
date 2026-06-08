/**
 * Helpers puros sobre la configuración de una etapa (Stage.configJson) y normalización
 * de identificadores de inscripción. Sin acceso a Neo4j.
 */

export function parseJsonSafe(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export function stageSubtypeLabelFromFormat(format) {
  if (format === 'league') return 'LeagueStage';
  if (format === 'groups') return 'GroupStage';
  if (format === 'elimination') return 'EliminationStage';
  return 'ComposedStage';
}

/** Neo4j MERGE distingue 44 (int) de "44" (str): duplica nodos. Siempre usar string. */
export function normalizeInscriptionId(raw) {
  if (raw == null) return '';
  return String(raw);
}

/** Slots pendientes desde UI (`liga360-slot:*`, `pos:*`); no ocupan cupo físico de equipos reales en la etapa. */
export function isSyntheticSlotInscriptionId(raw) {
  const s = normalizeInscriptionId(raw);
  return s.startsWith('liga360-slot:') || s.startsWith('pos:');
}

export function deriveCompetitionCapacityFromStage(stageProps) {
  const format = String(stageProps?.format || '').toLowerCase();
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  if (format === 'league' || format === 'elimination') {
    const participants = Number(cfg.numParticipants);
    if (Number.isInteger(participants) && participants > 0) return participants;
  }
  if (format === 'groups') {
    const groups = Number(cfg.numGroups);
    const perGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(groups) && groups > 0 && Number.isInteger(perGroup) && perGroup > 0) {
      return groups * perGroup;
    }
  }
  return null;
}

export function deriveStageCapacity(stageProps) {
  const format = String(stageProps?.format || '').toLowerCase();
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  if (format === 'league' || format === 'elimination') {
    const raw =
      cfg.numParticipants ??
      cfg.num_participants ??
      cfg.participants ??
      cfg.totalParticipants ??
      cfg.slots;
    const numParticipants = Number(raw);
    if (Number.isInteger(numParticipants) && numParticipants > 0) return numParticipants;
  }
  if (format === 'groups') {
    const numGroups = Number(cfg.numGroups);
    const teamsPerGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(numGroups) && numGroups > 0 && Number.isInteger(teamsPerGroup) && teamsPerGroup > 0) {
      return numGroups * teamsPerGroup;
    }
  }
  return null;
}

export function deriveGroupsConfig(stageProps) {
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  const numGroups = Number(cfg.numGroups);
  const teamsPerGroup = Number(cfg.teamsPerGroup);
  return {
    numGroups: Number.isInteger(numGroups) && numGroups > 0 ? numGroups : 0,
    teamsPerGroup: Number.isInteger(teamsPerGroup) && teamsPerGroup > 0 ? teamsPerGroup : 0,
  };
}
