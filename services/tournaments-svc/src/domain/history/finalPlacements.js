/**
 * Posiciones finales de una Competencia (port de frontend/history/finalPlacements.ts).
 * Campeón/sub de la última etapa por order; nunca estima datos faltantes.
 */
import { isByeMatch, isThirdPlaceMatchRow } from './eliminationHelpers.js';

const EMPTY = { champion: null, runnerUp: null, thirdPlace: null, perStage: [] };

function isPhysicalInscriptionId(raw) {
  const id = String(raw ?? '').trim();
  return !!id && !id.startsWith('liga360-slot:') && !id.startsWith('pos:');
}

function podiumEntryFromAssigned(assigned) {
  if (!assigned || !isPhysicalInscriptionId(assigned.inscriptionId)) return null;
  return {
    inscriptionId: String(assigned.inscriptionId),
    displayName: String(assigned.displayName || assigned.inscriptionId),
  };
}

function podiumEntryFromStandingsRow(row) {
  if (!row || !isPhysicalInscriptionId(String(row.inscriptionId))) return null;
  return {
    inscriptionId: String(row.inscriptionId),
    displayName: String(row.displayName || row.inscriptionId),
  };
}

function isFinishedMatch(m) {
  const s = String(m?.status ?? '').toLowerCase();
  return s === 'finished' || s === 'completed';
}

function decideTie(legs) {
  const none = { winner: null, loser: null };
  if (!legs?.length || !legs.every(isFinishedMatch)) return none;

  const home = podiumEntryFromAssigned(legs[0].homeAssignedInscription);
  const away = podiumEntryFromAssigned(legs[0].awayAssignedInscription);
  if (!home || !away) return none;

  let homeGoals = 0;
  let awayGoals = 0;
  for (const leg of legs) {
    const h = podiumEntryFromAssigned(leg.homeAssignedInscription);
    const a = podiumEntryFromAssigned(leg.awayAssignedInscription);
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

function eliminationPodium(stage) {
  const matches = (stage.matches ?? []).filter((m) => !isByeMatch(m));
  const thirdPlaceLegs = matches.filter((m) => isThirdPlaceMatchRow(m));
  const bracketMatches = matches.filter((m) => !isThirdPlaceMatchRow(m));
  const maxRound = bracketMatches.reduce((acc, m) => Math.max(acc, Number(m.round ?? 0)), 0);
  const finalLegs = bracketMatches.filter((m) => Number(m.round ?? 0) === maxRound);
  const { winner: champion, loser: runnerUp } = decideTie(finalLegs);
  const { winner: thirdPlace } = decideTie(thirdPlaceLegs);
  return { champion, runnerUp, thirdPlace };
}

function stagePlacements(stage) {
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
  return { ...base, kind: 'table', standings: stage.standings ?? [] };
}

export function computeFinalPlacements(competition) {
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

  return { champion: null, runnerUp: null, thirdPlace: null, perStage };
}
