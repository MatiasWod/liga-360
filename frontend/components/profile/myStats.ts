/**
 * Helpers puros del panel "Mis estadísticas" del participante (sin React ni fetch).
 * PJ (presencias) solo proviene de registros cargados: null = dato no disponible ("—").
 */
import type { ParticipantStats, ParticipantTournamentStats } from '../../services/matchEvents/presences';
import type { MatchEvent } from '../../services/matchEvents/types';
import type { TeamMatchItem } from '../../modules/team-presences/teamMatches';
import type { TournamentMatchRow } from '../../modules/tournaments-list/types';

export const ALL_FILTER = 'all';
export const UNKNOWN_YEAR = 'unknown';

export interface MyStatsMatchBlock {
  tournamentId: string;
  tournamentName: string;
  teamId: number;
  teamName: string;
  matches: TeamMatchItem[];
}

export interface MyStatsViewFilters {
  teamId: number | 'all';
  tournamentId: string;
  year: string;
  search: string;
}

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

/** Año calendario del partido (scheduledAt) o null si no hay fecha. */
export function extractMatchYear(match: Pick<TournamentMatchRow, 'scheduledAt'>): number | null {
  const raw = match.scheduledAt;
  if (!raw) return null;
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).getFullYear();
}

/** Clave de filtro por año: número como string o UNKNOWN_YEAR. */
export function matchYearFilterKey(match: Pick<TournamentMatchRow, 'scheduledAt'>): string {
  const year = extractMatchYear(match);
  return year != null ? String(year) : UNKNOWN_YEAR;
}

/** Años únicos presentes en los bloques, orden descendente. */
export function collectYearFilterOptions(blocks: MyStatsMatchBlock[]): { id: string; label: string }[] {
  const years = new Set<string>();
  for (const block of blocks) {
    for (const item of block.matches) {
      years.add(matchYearFilterKey(item.match));
    }
  }
  const numeric = [...years]
    .filter((y) => y !== UNKNOWN_YEAR)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  const options = numeric.map((y) => ({ id: String(y), label: String(y) }));
  if (years.has(UNKNOWN_YEAR)) {
    options.push({ id: UNKNOWN_YEAR, label: 'Sin fecha' });
  }
  return options;
}

/** Torneos únicos en los bloques (orden alfabético). */
export function collectTournamentFilterOptions(
  blocks: MyStatsMatchBlock[]
): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const b of blocks) {
    if (!map.has(b.tournamentId)) map.set(b.tournamentId, b.tournamentName);
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

/** Texto buscable de un partido del panel Mis estadísticas. */
export function myStatsMatchSearchText(
  block: MyStatsMatchBlock,
  item: TeamMatchItem
): string {
  const m = item.match;
  const home = m.homeAssignedInscription?.displayName ?? '';
  const away = m.awayAssignedInscription?.displayName ?? '';
  return [
    block.tournamentName,
    block.teamName,
    item.competitionName,
    item.stageName,
    home,
    away,
    m.round != null ? `fecha ${m.round}` : '',
  ]
    .join(' ')
    .toLowerCase();
}

/** Filtra bloques y partidos según equipo, torneo, año y búsqueda. */
export function filterMyStatsBlocks(
  blocks: MyStatsMatchBlock[],
  filters: Pick<MyStatsViewFilters, 'teamId' | 'tournamentId' | 'year' | 'search'>
): MyStatsMatchBlock[] {
  const q = normalizeSearch(filters.search);
  return blocks
    .filter((b) => {
      if (filters.teamId !== ALL_FILTER && b.teamId !== Number(filters.teamId)) return false;
      if (filters.tournamentId !== ALL_FILTER && b.tournamentId !== filters.tournamentId) return false;
      return true;
    })
    .map((b) => {
      const matches = b.matches.filter((item) => {
        if (filters.year !== ALL_FILTER && matchYearFilterKey(item.match) !== filters.year) return false;
        if (q && !myStatsMatchSearchText(b, item).includes(q)) return false;
        return true;
      });
      return { ...b, matches };
    })
    .filter((b) => b.matches.length > 0);
}

export function countMyStatsMatches(blocks: MyStatsMatchBlock[]): number {
  return blocks.reduce((acc, b) => acc + b.matches.length, 0);
}

export function hasActiveMyStatsFilters(filters: MyStatsViewFilters): boolean {
  return (
    filters.teamId !== ALL_FILTER ||
    filters.tournamentId !== ALL_FILTER ||
    filters.year !== ALL_FILTER ||
    filters.search.trim().length > 0
  );
}
