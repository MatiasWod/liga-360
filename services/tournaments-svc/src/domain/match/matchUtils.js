/**
 * Helpers puros de partidos: mapeo de nodos Neo4j a objetos GraphQL, detección de estado
 * y parseo de referencias de ganador (`liga360-slot:ew:` / `pos:ew:`). Sin acceso a Neo4j.
 */
import { isPhysicalInscriptionId } from '../shared/participantLabels.js';

export function matchFromNeoProps(m) {
  return {
    id: m.id,
    round: m.round != null ? Number(m.round) : null,
    leg: m.leg != null ? Number(m.leg) : null,
    scheduledAt: m.scheduledAt ?? null,
    slotIndex: m.slotIndex != null ? Number(m.slotIndex) : null,
    fixtureCode: m.fixtureCode ?? null,
    groupId: m.groupId ?? null,
    leagueHomeSeed: m.leagueHomeSeed != null ? Number(m.leagueHomeSeed) : null,
    leagueAwaySeed: m.leagueAwaySeed != null ? Number(m.leagueAwaySeed) : null,
    homeTeamId: m.homeTeamId ?? m.homeInscriptionId ?? null,
    awayTeamId: m.awayTeamId ?? m.awayInscriptionId ?? null,
    homeInscriptionId: m.homeInscriptionId ?? null,
    awayInscriptionId: m.awayInscriptionId ?? null,
    homeDisplayName: m.homeDisplayName ?? null,
    awayDisplayName: m.awayDisplayName ?? null,
    homeTournamentId: m.homeTournamentId ?? null,
    awayTournamentId: m.awayTournamentId ?? null,
    homeScore: m.homeScore != null ? Number(m.homeScore) : null,
    awayScore: m.awayScore != null ? Number(m.awayScore) : null,
    status: m.status ?? null,
    venue: m.venue ?? null,
    referee: m.referee ?? null,
    winnerAdvancementTransitionId: m.winnerAdvancementTransitionId
      ? String(m.winnerAdvancementTransitionId)
      : null,
    matchKind: m.matchKind ?? null,
  };
}

export function isMatchFinishedStatus(raw) {
  const st = String(raw || '').toLowerCase();
  return st === 'finished' || st === 'completed';
}

/**
 * Refs de ganador de llave (`liga360-slot:ew:` / `pos:ew:`): conservar el ref en inscriptionId
 * y solo actualizar displayName, para no confundir con posiciones de liga/grupos al resolver.
 */
export function isWinnerSlotRef(raw) {
  const s = String(raw || '');
  return s.startsWith('liga360-slot:ew:') || s.startsWith('pos:ew:');
}

/** Parsea `liga360-slot:ew:{stageId}:{matchId}` (matchId puede contener guiones, no `:`). */
export function parseWinnerSlotRef(str) {
  const s = String(str || '');
  if (s.startsWith('pos:ew:')) {
    const matchId = s.slice('pos:ew:'.length).trim();
    return matchId ? { stageId: null, matchId } : null;
  }
  if (s.startsWith('liga360-slot:ew:')) {
    const rest = s.slice('liga360-slot:ew:'.length);
    const idx = rest.indexOf(':');
    if (idx <= 0) return null;
    const stageId = rest.slice(0, idx).trim();
    const matchId = rest.slice(idx + 1).trim();
    if (!stageId || !matchId) return null;
    return { stageId, matchId };
  }
  return null;
}

export function applyResolvedSlot(match, role, resolved, keepWinnerRef) {
  if (!resolved?.displayName) return;
  const idKey = role === 'home' ? 'homeInscriptionId' : 'awayInscriptionId';
  const dnKey = role === 'home' ? 'homeDisplayName' : 'awayDisplayName';
  if (keepWinnerRef) {
    match[dnKey] = resolved.displayName;
  } else if (isPhysicalInscriptionId(resolved.inscriptionId)) {
    match[idKey] = resolved.inscriptionId;
    match[dnKey] = resolved.displayName;
  } else {
    match[dnKey] = resolved.displayName;
  }
}
