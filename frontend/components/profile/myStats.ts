/**
 * Helpers puros del panel "Mis estadísticas" del participante (sin React ni fetch).
 * PJ (presencias) solo proviene de registros cargados: null = dato no disponible ("—").
 */
import type { ParticipantStats, ParticipantTournamentStats } from '../../services/matchEvents/presences';
import type { MatchEvent } from '../../services/matchEvents/types';

export interface MyTotals {
  goals: number;
  yellowCards: number;
  redCards: number;
  suspensionMatches: number;
  matchesPlayed: number | null;
}

/** Combina stats de varios Participants vinculados al mismo perfil. */
export function mergeMyStats(statsList: ParticipantStats[]): {
  totals: MyTotals;
  byTournament: ParticipantTournamentStats[];
} {
  const totals: MyTotals = { goals: 0, yellowCards: 0, redCards: 0, suspensionMatches: 0, matchesPlayed: null };
  const byTournament: ParticipantTournamentStats[] = [];
  for (const s of statsList) {
    totals.goals += s.totals.goals;
    totals.yellowCards += s.totals.yellowCards;
    totals.redCards += s.totals.redCards;
    totals.suspensionMatches += s.totals.suspensionMatches;
    if (s.totals.matchesPlayed != null) {
      totals.matchesPlayed = (totals.matchesPlayed ?? 0) + s.totals.matchesPlayed;
    }
    byTournament.push(...s.byTournament);
  }
  return { totals, byTournament };
}

/** Formato de PJ honesto: nunca inventa un número. */
export function formatMatchesPlayed(value: number | null | undefined): string {
  return value == null ? '—' : String(value);
}

/** Agrupa los eventos del propio jugador (linked_member_id ∈ memberIds) por partido. */
export function groupMyEventsByMatch(events: MatchEvent[], memberIds: number[]): Map<string, MatchEvent[]> {
  const mine = new Set(memberIds.map(Number));
  const map = new Map<string, MatchEvent[]>();
  for (const ev of events) {
    if (ev.linked_member_id == null || !mine.has(Number(ev.linked_member_id))) continue;
    const arr = map.get(ev.match_id) ?? [];
    arr.push(ev);
    map.set(ev.match_id, arr);
  }
  return map;
}
