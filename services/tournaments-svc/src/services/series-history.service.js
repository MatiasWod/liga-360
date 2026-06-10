/**
 * Histórico agregado por serie: palmarés, títulos por equipo, goleadores cross-edición.
 * Palmarés derivado con computeFinalPlacements (competencia principal order === 1).
 */
import { computeFinalPlacements } from '../domain/history/finalPlacements.js';
import { loadPrimaryCompetitionForHistory } from './history-competition-loader.js';
import * as seriesService from './competition-series.service.js';
import * as inscriptionsClient from '../clients/inscriptions.client.js';
import * as matcheventsClient from '../clients/matchevents.client.js';

const MAX_EDITIONS = 50;

function normalizeTeamName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/^(el|la|los|las)\s+/i, '');
}

function teamKey(linkedTeamId, displayName) {
  if (linkedTeamId != null && Number.isFinite(Number(linkedTeamId))) {
    return { key: `team:${linkedTeamId}`, identityApproximate: false };
  }
  return { key: `name:${normalizeTeamName(displayName)}`, identityApproximate: true };
}

function mapPodiumEntry(entry, linkedTeamMap) {
  if (!entry) return null;
  const linkedTeamId = linkedTeamMap.get(entry.inscriptionId) ?? null;
  return {
    inscriptionId: entry.inscriptionId,
    displayName: entry.displayName,
    linkedTeamId: linkedTeamId != null ? String(linkedTeamId) : null,
  };
}

export async function seriesRollOfHonor(driver, seriesId) {
  const editions = await seriesService.getEditions(driver, seriesId);
  const finished = editions.filter((e) => String(e.status).toLowerCase() === 'finished').slice(0, MAX_EDITIONS);
  const rows = [];

  for (const edition of finished) {
    const competition = await loadPrimaryCompetitionForHistory(driver, edition.tournamentId);
    const placements = computeFinalPlacements(competition);
    const championIds = [placements.champion, placements.runnerUp, placements.thirdPlace]
      .filter(Boolean)
      .map((e) => e.inscriptionId);
    const linkedTeamMap = await inscriptionsClient.lookupLinkedTeamIds(championIds);

    rows.push({
      editionLabel: edition.editionLabel,
      tournamentId: edition.tournamentId,
      tournamentName: edition.name,
      champion: mapPodiumEntry(placements.champion, linkedTeamMap),
      runnerUp: mapPodiumEntry(placements.runnerUp, linkedTeamMap),
      thirdPlace: mapPodiumEntry(placements.thirdPlace, linkedTeamMap),
    });
  }

  return rows;
}

export async function editionsInProgress(driver, seriesId) {
  const editions = await seriesService.getEditions(driver, seriesId);
  return editions.filter((e) => {
    const s = String(e.status).toLowerCase();
    return s === 'published' || s === 'draft';
  });
}

export async function titlesByTeam(driver, seriesId) {
  const roll = await seriesRollOfHonor(driver, seriesId);
  const counts = new Map();

  for (const row of roll) {
    const champ = row.champion;
    if (!champ) continue;
    const linkedTeamId = champ.linkedTeamId != null ? Number(champ.linkedTeamId) : null;
    const { key, identityApproximate } = teamKey(linkedTeamId, champ.displayName);
    const prev = counts.get(key) || {
      teamKey: key,
      displayName: champ.displayName,
      linkedTeamId: linkedTeamId != null ? String(linkedTeamId) : null,
      titles: 0,
      identityApproximate,
    };
    prev.titles += 1;
    counts.set(key, prev);
  }

  return [...counts.values()].sort((a, b) => b.titles - a.titles || a.displayName.localeCompare(b.displayName));
}

function mapScorerRow(row) {
  const linkedMemberId = row.linkedMemberId != null ? Number(row.linkedMemberId) : null;
  return {
    playerKey: String(row.playerKey || row.player_key || ''),
    displayName: String(row.displayName || row.display_name || ''),
    goals: Number(row.goals) || 0,
    linkedMemberId: linkedMemberId != null ? String(linkedMemberId) : null,
    identityApproximate: linkedMemberId == null,
  };
}

export async function seriesAggregates(driver, seriesId) {
  const editions = await seriesService.getEditions(driver, seriesId);
  const finishedIds = editions
    .filter((e) => String(e.status).toLowerCase() === 'finished')
    .map((e) => e.tournamentId)
    .slice(0, MAX_EDITIONS);

  const [rollOfHonor, inProgress, titles, rawScorers] = await Promise.all([
    seriesRollOfHonor(driver, seriesId),
    editionsInProgress(driver, seriesId),
    titlesByTeam(driver, seriesId),
    matcheventsClient.getMultiTournamentScorers(finishedIds, { limit: 50 }),
  ]);

  return {
    seriesId,
    rollOfHonor,
    editionsInProgress: inProgress,
    titlesByTeam: titles,
    topScorers: rawScorers.map(mapScorerRow),
    finishedTournamentIds: finishedIds,
  };
}
