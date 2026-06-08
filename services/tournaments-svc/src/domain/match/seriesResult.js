/**
 * Selección pura de ganador/perdedor de una serie a partir de piernas ya resueltas
 * (refs expandidos y scores reales). Sin acceso a Neo4j.
 */
import { isPhysicalInscriptionId } from '../shared/participantLabels.js';

export function resolveFinishedMatchLoserFromResolvedLeg(leg) {
  const hs = leg.homeScore != null ? Number(leg.homeScore) : null;
  const as_ = leg.awayScore != null ? Number(leg.awayScore) : null;
  if (hs == null || as_ == null || !Number.isFinite(hs) || !Number.isFinite(as_) || hs === as_) {
    return null;
  }
  const loserId = String(hs > as_ ? leg.awayInscriptionId : leg.homeInscriptionId || '').trim();
  if (!loserId) return null;
  const loserDisplay = String(hs > as_ ? leg.awayDisplayName : leg.homeDisplayName || '').trim();
  return { inscriptionId: loserId, displayName: loserDisplay || loserId };
}

/** Mapea un ganador agregado (puede venir como dn:*) al id físico persistible en Neo4j. */
export function findPersistableWinnerFromLegs(picked, legs) {
  if (!picked) return null;
  const pickId = String(picked.inscriptionId ?? '');
  const pickName = String(picked.displayName ?? '').trim().toLowerCase();
  if (isPhysicalInscriptionId(pickId)) {
    let tournamentId = null;
    for (const leg of legs) {
      if (String(leg.homeInscriptionId ?? '') === pickId) tournamentId = leg.homeTournamentId ?? null;
      if (String(leg.awayInscriptionId ?? '') === pickId) tournamentId = leg.awayTournamentId ?? null;
    }
    return {
      inscriptionId: pickId,
      displayName: picked.displayName,
      tournamentId,
    };
  }
  for (const leg of legs) {
    for (const side of [
      { id: leg.homeInscriptionId, dn: leg.homeDisplayName, tid: leg.homeTournamentId },
      { id: leg.awayInscriptionId, dn: leg.awayDisplayName, tid: leg.awayTournamentId },
    ]) {
      const sideId = String(side.id ?? '');
      const sideName = String(side.dn ?? '').trim().toLowerCase();
      if (pickName && sideName === pickName && isPhysicalInscriptionId(sideId)) {
        return { inscriptionId: sideId, displayName: side.dn, tournamentId: side.tid ?? null };
      }
    }
  }
  return {
    inscriptionId: pickId,
    displayName: picked.displayName,
    tournamentId: null,
  };
}
