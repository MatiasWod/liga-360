/**
 * Helpers puros para la tabla por equipo de la sección Estadísticas:
 * agrega los standings de las etapas de una Competencia y los mergea
 * client-side con las tarjetas de matchevents-svc por inscriptionId (ADR-0001).
 */
import type { TournamentCompetition, TournamentMatchRow, StandingsRow } from '../types';
import type { TeamStatsRow } from '../../../services/matchEvents/stats';

export interface TeamStatsTableRow {
  inscriptionId: string;
  displayName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  yellowCards: number;
  redCards: number;
}

/**
 * Suma los standings de todas las etapas (liga y grupos) de la Competencia por
 * inscripción. En etapas `groups` solo cuenta tablas por grupo (stage.standings
 * agrega los mismos PJ otra vez porque los partidos cuelgan del stage y del grupo).
 */
export function aggregateCompetitionStandings(competition: TournamentCompetition | null): Map<string, Omit<TeamStatsTableRow, 'yellowCards' | 'redCards'>> {
  const acc = new Map<string, Omit<TeamStatsTableRow, 'yellowCards' | 'redCards'>>();
  if (!competition) return acc;
  const allStandings: StandingsRow[] = [];
  for (const stage of competition.stages || []) {
    if (stage.format === 'groups') {
      for (const g of stage.groups || []) allStandings.push(...(g.standings || []));
    } else if (stage.format === 'league') {
      allStandings.push(...(stage.standings || []));
    }
  }
  for (const row of allStandings) {
    const key = String(row.inscriptionId);
    const prev = acc.get(key);
    if (!prev) {
      acc.set(key, {
        inscriptionId: key,
        displayName: row.displayName,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
      });
    } else {
      prev.played += row.played;
      prev.won += row.won;
      prev.drawn += row.drawn;
      prev.lost += row.lost;
      prev.goalsFor += row.goalsFor;
      prev.goalsAgainst += row.goalsAgainst;
      prev.points += row.points;
      if (!prev.displayName && row.displayName) prev.displayName = row.displayName;
    }
  }
  return acc;
}

/**
 * Merge standings agregados + tarjetas por inscriptionId. Equipos con eventos
 * pero sin standings (p. ej. solo eliminación) entran con ceros y nombre del lookup.
 */
export function mergeTeamStats(
  standingsByInscription: Map<string, Omit<TeamStatsTableRow, 'yellowCards' | 'redCards'>>,
  teamStats: TeamStatsRow[],
  nameById: Map<string, string>
): TeamStatsTableRow[] {
  const statsByInscription = new Map(teamStats.map((s) => [String(s.inscriptionId), s]));
  const rows: TeamStatsTableRow[] = [];

  for (const [key, base] of standingsByInscription) {
    const stats = statsByInscription.get(key);
    rows.push({
      ...base,
      displayName: base.displayName || nameById.get(key) || `Equipo #${key}`,
      yellowCards: stats?.yellowCards ?? 0,
      redCards: stats?.redCards ?? 0,
    });
    statsByInscription.delete(key);
  }

  // Equipos con eventos pero sin filas de standings
  for (const [key, stats] of statsByInscription) {
    rows.push({
      inscriptionId: key,
      displayName: nameById.get(key) || `Equipo #${key}`,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      yellowCards: stats.yellowCards,
      redCards: stats.redCards,
    });
  }

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const dgA = a.goalsFor - a.goalsAgainst;
    const dgB = b.goalsFor - b.goalsAgainst;
    if (dgB !== dgA) return dgB - dgA;
    return a.displayName.localeCompare(b.displayName);
  });
  return rows;
}

/** Partidos de la Competencia donde juega la inscripción (para el drill-down). */
export function collectCompetitionMatchesForInscription(
  competition: TournamentCompetition | null,
  inscriptionId: string
): TournamentMatchRow[] {
  if (!competition) return [];
  const target = String(inscriptionId);
  const out: TournamentMatchRow[] = [];
  const seen = new Set<string>();
  const playsHere = (m: TournamentMatchRow) =>
    String(m.homeAssignedInscription?.inscriptionId ?? '') === target ||
    String(m.awayAssignedInscription?.inscriptionId ?? '') === target;
  const push = (m: TournamentMatchRow) => {
    const id = String(m.id || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(m);
  };
  for (const stage of competition.stages || []) {
    if (stage.format === 'groups') {
      for (const g of stage.groups || []) {
        for (const m of g.matches || []) if (playsHere(m)) push(m);
      }
    } else {
      for (const m of stage.matches || []) if (playsHere(m)) push(m);
    }
  }
  return out;
}
