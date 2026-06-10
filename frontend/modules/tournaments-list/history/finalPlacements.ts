import type {
  AssignedInscription,
  StandingsRow,
  TournamentCompetition,
  TournamentMatchRow,
  TournamentStage,
} from '../types';
import { isThirdPlaceMatchRow } from '../eliminationInitHelpers';

export type PodiumEntry = {
  inscriptionId: string;
  displayName: string;
};

export type StageFinalPlacements =
  | { stageId: string; stageName: string; kind: 'table'; standings: StandingsRow[] }
  | {
      stageId: string;
      stageName: string;
      kind: 'groupTables';
      groups: { id: string; name: string; standings: StandingsRow[] }[];
    }
  | {
      stageId: string;
      stageName: string;
      kind: 'podium';
      champion: PodiumEntry | null;
      runnerUp: PodiumEntry | null;
      thirdPlace: PodiumEntry | null;
    };

export type FinalPlacements = {
  champion: PodiumEntry | null;
  runnerUp: PodiumEntry | null;
  /** Solo derivable de un partido de 3er puesto en eliminación; null en liga. */
  thirdPlace: PodiumEntry | null;
  perStage: StageFinalPlacements[];
};

const EMPTY: FinalPlacements = { champion: null, runnerUp: null, thirdPlace: null, perStage: [] };

/** Ids sintéticos de slots sin resolver: nunca pueden ser campeón. */
function isPhysicalInscriptionId(raw: string | null | undefined): boolean {
  const id = String(raw ?? '').trim();
  return !!id && !id.startsWith('liga360-slot:') && !id.startsWith('pos:');
}

function podiumEntryFrom(assigned: AssignedInscription | null | undefined): PodiumEntry | null {
  if (!assigned || !isPhysicalInscriptionId(assigned.inscriptionId)) return null;
  return {
    inscriptionId: String(assigned.inscriptionId),
    displayName: String(assigned.displayName || assigned.inscriptionId),
  };
}

function podiumEntryFromStandingsRow(row: StandingsRow | undefined): PodiumEntry | null {
  if (!row || !isPhysicalInscriptionId(String(row.inscriptionId))) return null;
  return {
    inscriptionId: String(row.inscriptionId),
    displayName: String(row.displayName || row.inscriptionId),
  };
}

function isFinishedMatch(m: TournamentMatchRow): boolean {
  const s = String(m.status ?? '').toLowerCase();
  return s === 'finished' || s === 'completed';
}

function isByeMatch(m: TournamentMatchRow): boolean {
  return String(m.matchKind ?? '').toLowerCase() === 'bye';
}

/** Ganador y perdedor de un set de piernas de una misma llave (1 o 2 partidos). Empate global → nulls. */
function decideTie(legs: TournamentMatchRow[]): { winner: PodiumEntry | null; loser: PodiumEntry | null } {
  const none = { winner: null, loser: null };
  if (legs.length === 0 || !legs.every(isFinishedMatch)) return none;

  const home = podiumEntryFrom(legs[0].homeAssignedInscription);
  const away = podiumEntryFrom(legs[0].awayAssignedInscription);
  if (!home || !away) return none;

  let homeGoals = 0;
  let awayGoals = 0;
  for (const leg of legs) {
    const h = podiumEntryFrom(leg.homeAssignedInscription);
    const a = podiumEntryFrom(leg.awayAssignedInscription);
    // Todas las piernas deben ser entre las mismas dos inscripciones (ida/vuelta).
    const ids = new Set([h?.inscriptionId, a?.inscriptionId]);
    if (!ids.has(home.inscriptionId) || !ids.has(away.inscriptionId)) return none;
    const hs = Number(leg.homeScore ?? 0);
    const as_ = Number(leg.awayScore ?? 0);
    if (h?.inscriptionId === home.inscriptionId) {
      homeGoals += hs;
      awayGoals += as_;
    } else {
      homeGoals += as_;
      awayGoals += hs;
    }
  }
  if (homeGoals === awayGoals) return none;
  return homeGoals > awayGoals ? { winner: home, loser: away } : { winner: away, loser: home };
}

/** Podio de una etapa de eliminación: final = partido(s) de mayor round, excluyendo byes y 3er puesto. */
function eliminationPodium(stage: TournamentStage): {
  champion: PodiumEntry | null;
  runnerUp: PodiumEntry | null;
  thirdPlace: PodiumEntry | null;
} {
  const matches = (stage.matches ?? []).filter((m) => !isByeMatch(m));
  const thirdPlaceLegs = matches.filter((m) => isThirdPlaceMatchRow(m));
  const bracketMatches = matches.filter((m) => !isThirdPlaceMatchRow(m));

  const maxRound = bracketMatches.reduce((acc, m) => Math.max(acc, Number(m.round ?? 0)), 0);
  const finalLegs = bracketMatches.filter((m) => Number(m.round ?? 0) === maxRound);
  const { winner: champion, loser: runnerUp } = decideTie(finalLegs);

  const { winner: thirdPlace } = decideTie(thirdPlaceLegs);
  return { champion, runnerUp, thirdPlace };
}

function stagePlacements(stage: TournamentStage): StageFinalPlacements {
  const base = { stageId: stage.id, stageName: stage.name };
  if (stage.format === 'elimination') {
    return { ...base, kind: 'podium', ...eliminationPodium(stage) };
  }
  if (stage.format === 'groups') {
    return {
      ...base,
      kind: 'groupTables',
      groups: [...(stage.groups ?? [])]
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map((g) => ({ id: g.id, name: g.name, standings: g.standings ?? [] })),
    };
  }
  // league y composed: tabla plana (composed sin standings queda vacía y la UI muestra "—")
  return { ...base, kind: 'table', standings: stage.standings ?? [] };
}

/**
 * Posiciones finales de una Competencia, derivadas client-side (nunca estimadas):
 * campeón/subcampeón salen de la etapa de mayor `order` — liga → posiciones 1/2 de
 * standings; eliminación → ganador/perdedor de la final (+3er puesto si existe ese
 * partido). Última etapa grupos/composed, final empatada o slots placeholder → null.
 */
export function computeFinalPlacements(
  competition: Pick<TournamentCompetition, 'stages'> | null | undefined
): FinalPlacements {
  const stages = [...(competition?.stages ?? [])].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)
  );
  if (stages.length === 0) return EMPTY;

  const perStage = stages.map(stagePlacements);
  const lastStage = stages[stages.length - 1];

  if (lastStage.format === 'elimination') {
    const { champion, runnerUp, thirdPlace } = eliminationPodium(lastStage);
    return { champion, runnerUp, thirdPlace, perStage };
  }

  if (lastStage.format === 'league') {
    const sorted = [...(lastStage.standings ?? [])].sort(
      (a, b) => Number(a.position) - Number(b.position)
    );
    return {
      champion: podiumEntryFromStandingsRow(sorted.find((r) => Number(r.position) === 1)),
      runnerUp: podiumEntryFromStandingsRow(sorted.find((r) => Number(r.position) === 2)),
      thirdPlace: null,
      perStage,
    };
  }

  // groups / composed como última etapa: sin campeón derivable.
  return { champion: null, runnerUp: null, thirdPlace: null, perStage };
}
