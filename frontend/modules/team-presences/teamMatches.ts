/**
 * Helpers puros del editor de presencias del equipo: extraen los partidos de la
 * inscripción del equipo desde el detalle GraphQL del torneo. Sin React ni fetch.
 */
import type { TournamentEntity, TournamentMatchRow } from '../tournaments-list/types';
import { dedupeCompetitionsByName, matchFixtureKey } from './matchDedupe';

export interface TeamMatchItem {
  match: TournamentMatchRow;
  competitionId: string;
  competitionName: string;
  stageName: string;
}

function slotInscriptionId(slot?: { inscriptionId?: string | number | null } | null): number | null {
  const raw = slot?.inscriptionId;
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Partidos donde juega la inscripción, recorriendo todas las competencias,
 * etapas y grupos. Los partidos sin fecha igual aparecen (orden: ronda → fecha).
 */
export function collectMatchesForInscription(
  tournament: TournamentEntity | null,
  inscriptionId: number
): TeamMatchItem[] {
  if (!tournament) return [];
  const competitions = dedupeCompetitionsByName(tournament.competitions || []);
  const items: TeamMatchItem[] = [];
  const seenKeys = new Set<string>();
  for (const c of competitions) {
    for (const s of c.stages || []) {
      const allMatches = [
        ...(s.matches || []),
        ...((s.groups || []).flatMap((g) => g.matches || [])),
      ];
      for (const m of allMatches) {
        const fixtureKey = matchFixtureKey(m);
        if (seenKeys.has(fixtureKey)) continue;
        const home = slotInscriptionId(m.homeAssignedInscription);
        const away = slotInscriptionId(m.awayAssignedInscription);
        if (home === inscriptionId || away === inscriptionId) {
          seenKeys.add(fixtureKey);
          items.push({ match: m, competitionId: c.id, competitionName: c.name, stageName: s.name });
        }
      }
    }
  }
  return items.sort((a, b) => {
    const r = (a.match.round ?? 0) - (b.match.round ?? 0);
    if (r !== 0) return r;
    return (a.match.leg ?? 1) - (b.match.leg ?? 1);
  });
}

/** Inscripción activa del equipo en el torneo (linked_team_id). Si hay varias, la de menor id. */
export function findTeamInscriptionId(
  inscriptions: { id: number | string; linked_team_id?: number | null; status?: string | null }[],
  teamId: number
): number | null {
  const active = inscriptions
    .filter(
      (i) => Number(i.linked_team_id || 0) === teamId && String(i.status || '').toUpperCase() !== 'RECHAZADO'
    )
    .map((i) => Number(i.id))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return active.length ? active[0] : null;
}
