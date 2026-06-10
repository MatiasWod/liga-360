/**
 * Helpers puros del editor de presencias del equipo: extraen los partidos de la
 * inscripción del equipo desde el detalle GraphQL del torneo. Sin React ni fetch.
 */
import type { TournamentEntity, TournamentMatchRow } from '../tournaments-list/types';

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
  const items: TeamMatchItem[] = [];
  for (const c of tournament.competitions || []) {
    for (const s of c.stages || []) {
      const allMatches = [
        ...(s.matches || []),
        ...((s.groups || []).flatMap((g) => g.matches || [])),
      ];
      for (const m of allMatches) {
        const home = slotInscriptionId(m.homeAssignedInscription);
        const away = slotInscriptionId(m.awayAssignedInscription);
        if (home === inscriptionId || away === inscriptionId) {
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

/** Inscripción del equipo en el torneo (linked_team_id), o null si no está inscripto. */
export function findTeamInscriptionId(
  inscriptions: { id: number | string; linked_team_id?: number | null; status?: string | null }[],
  teamId: number
): number | null {
  const active = inscriptions.find(
    (i) => Number(i.linked_team_id || 0) === teamId && String(i.status || '').toUpperCase() !== 'RECHAZADO'
  );
  return active ? Number(active.id) : null;
}
