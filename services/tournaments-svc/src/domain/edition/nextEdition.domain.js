/** Lógica pura para próxima edición: snapshots, destinos y permanencias. */
import { isNextEditionTiming } from '../stage/stageTransitionTiming.js';

export function parsePlacementSnapshot(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || !Array.isArray(parsed.placements)) return null;
    return {
      savedAt: parsed.savedAt ?? null,
      sourceStageId: String(parsed.sourceStageId ?? ''),
      placements: parsed.placements.map((p) => ({
        inscriptionId: String(p.inscriptionId ?? ''),
        displayName: String(p.displayName ?? ''),
        position: p.position != null ? Number(p.position) : undefined,
      })),
    };
  } catch {
    return null;
  }
}

/** Etapa destino de una transición next_edition dentro del mismo torneo. */
export function resolveDestinationStageId(transition, sourceTournamentId) {
  const tid = String(sourceTournamentId ?? '').trim();
  if (transition?.toStageId) return String(transition.toStageId);
  const extTid = String(transition?.toExternalTournamentId ?? '').trim();
  const extSid = String(transition?.toExternalStageId ?? '').trim();
  if (!extSid) return null;
  if (extTid === tid || extTid === 'this') return extSid;
  return null;
}

export function isNextEditionTransitionRow(transition) {
  return isNextEditionTiming(transition?.timing);
}

/** IDs de inscripción que salen por snapshot next_edition desde etapas de una competencia. */
export function collectOutgoingSnapshotInscriptionIds(transitions, stageIdsInCompetition) {
  const stageSet = new Set(stageIdsInCompetition);
  const ids = new Set();
  for (const tr of transitions) {
    if (!isNextEditionTransitionRow(tr)) continue;
    if (!stageSet.has(tr.fromStageId)) continue;
    const snapshot = parsePlacementSnapshot(tr.placementSnapshotJson);
    if (!snapshot) continue;
    for (const p of snapshot.placements) {
      const iid = String(p.inscriptionId ?? '').trim();
      if (iid) ids.add(iid);
    }
  }
  return ids;
}

/** Inscripciones ACEPTADAS que permanecen (no aparecen en snapshots salientes de su competencia). */
export function computePermanencyInscriptions(acceptedInscriptions, outgoingSnapshotIds) {
  return acceptedInscriptions.filter((row) => {
    const id = String(row.id ?? '');
    return id && !outgoingSnapshotIds.has(id);
  });
}

export function dedupePlacementKey(row) {
  const teamId = row.linked_team_id != null ? String(row.linked_team_id) : '';
  const name = String(row.display_name ?? row.displayName ?? '').trim().toLowerCase();
  return teamId ? `team:${teamId}` : `name:${name}`;
}

/** Evita duplicar el mismo equipo en la misma competencia destino. */
export function dedupeRowsByTeam(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = `${row.targetCompetitionId}:${dedupePlacementKey(row)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
