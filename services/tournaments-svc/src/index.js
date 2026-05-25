import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { readFileSync } from 'fs';
import { parse } from 'graphql';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@apollo/server/express4';
import neo4j from 'neo4j-driver';
import { requireOrganizerFromAuthHeader } from './auth.js';
import {
  eliminationFirstRoundBracketPositions,
  eliminationFixtureCode,
  eliminationMatchSlots,
  eliminationMaxRound,
  aggregateEliminationSeriesScores,
  formatEliminationMatchCodeFromProps,
  isThirdPlaceMatchProps,
  legsForEliminationSlot,
  nextPowerOf2,
  pickSeriesWinnerFromScoreMap,
  resolveEliminationBracketConfig,
  shouldCreateThirdPlaceMatch,
  THIRD_PLACE_SLOT_INDEX,
} from './bracketElimination.js';
import {
  buildWinnerSlotRefs,
  defaultBracketAdvanceTarget,
  findRefBasedAdvanceTargets,
  resolveAdvanceRoleForLeg,
} from './eliminationAdvance.js';
import { httpLogger, logger } from './logger.js';
import {
  doubleRoundRobinFromSingle,
  singleRoundRobinSchedule,
  validateSingleRoundRobin,
} from './roundRobin.js';
import { computeStandings } from './standings.js';
import { STAGE_CYCLE_CHECK_CYPHER, STAGE_CYCLE_ERROR } from './stageTransitionCycle.js';
import {
  assertEliminationPhysicalNotDuplicateElsewhere,
} from './eliminationSlotAssignment.js';
import { syncEliminationDoubleLegPair } from './eliminationLegSync.js';
import {
  assertStageAllowsMatchResults,
  computeEffectiveStageStatus,
  fetchStageStatusInputs,
  resolveEffectiveStageStatusForMatch,
} from './stageStatus.js';
import { isNextEditionTiming, normalizeTransitionTiming } from './stageTransitionTiming.js';
import {
  isPhysicalInscriptionId,
  isPlaceholderParticipantLabel,
  pickPhysicalStandingsRow,
} from './participantLabels.js';

const PORT = process.env.PORT || 4001;
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// GraphQL schema (parseamos SDL a AST para Apollo Subgraph)
const sdlString = readFileSync(new URL('../schema.graphql', import.meta.url), 'utf8');
const typeDefs = parse(sdlString);

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function stageSubtypeLabelFromFormat(format) {
  if (format === 'league') return 'LeagueStage';
  if (format === 'groups') return 'GroupStage';
  if (format === 'elimination') return 'EliminationStage';
  return 'ComposedStage';
}

function parseJsonSafe(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

/** Neo4j MERGE distingue 44 (int) de "44" (str): duplica nodos. Siempre usar string. */
function normalizeInscriptionId(raw) {
  if (raw == null) return '';
  return String(raw);
}

/** Slots pendientes desde UI (`liga360-slot:*`, `pos:*`); no ocupan cupo físico de equipos reales en la etapa. */
function isSyntheticSlotInscriptionId(raw) {
  const s = normalizeInscriptionId(raw);
  return s.startsWith('liga360-slot:') || s.startsWith('pos:');
}

async function countPhysicalAssignedInscriptionsOnStage(session, stageId, tournamentId = null) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     WHERE NOT toString(i.inscriptionId) STARTS WITH 'liga360-slot:'
       AND NOT toString(i.inscriptionId) STARTS WITH 'pos:'
       AND ($tid IS NULL OR i.tournamentId = $tid)
     RETURN count(DISTINCT toString(i.inscriptionId)) AS c`,
    { stageId, tid: tournamentId }
  );
  return Number(r.records[0]?.get('c') || 0);
}

function deriveCompetitionCapacityFromStage(stageProps) {
  const format = String(stageProps?.format || '').toLowerCase();
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  if (format === 'league' || format === 'elimination') {
    const participants = Number(cfg.numParticipants);
    if (Number.isInteger(participants) && participants > 0) return participants;
  }
  if (format === 'groups') {
    const groups = Number(cfg.numGroups);
    const perGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(groups) && groups > 0 && Number.isInteger(perGroup) && perGroup > 0) {
      return groups * perGroup;
    }
  }
  return null;
}

function deriveStageCapacity(stageProps) {
  const format = String(stageProps?.format || '').toLowerCase();
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  if (format === 'league' || format === 'elimination') {
    const raw =
      cfg.numParticipants ??
      cfg.num_participants ??
      cfg.participants ??
      cfg.totalParticipants ??
      cfg.slots;
    const numParticipants = Number(raw);
    if (Number.isInteger(numParticipants) && numParticipants > 0) return numParticipants;
  }
  if (format === 'groups') {
    const numGroups = Number(cfg.numGroups);
    const teamsPerGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(numGroups) && numGroups > 0 && Number.isInteger(teamsPerGroup) && teamsPerGroup > 0) {
      return numGroups * teamsPerGroup;
    }
  }
  return null;
}

async function countAssignedInscriptionsOnStage(session, stageId) {
  return countPhysicalAssignedInscriptionsOnStage(session, stageId);
}

async function countAssignedInscriptionsOnGroup(session, groupId) {
  const r = await session.run(
    `MATCH (:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN count(DISTINCT i.inscriptionId) AS c`,
    { groupId }
  );
  return Number(r.records[0]?.get('c') || 0);
}

async function resolveFixtureParticipantCount(session, stageId, stageProps) {
  const cfgN = deriveStageCapacity(stageProps);
  const assignedN = await countAssignedInscriptionsOnStage(session, stageId);
  if (assignedN >= 2) return assignedN;
  if (cfgN != null && cfgN >= 2) return cfgN;
  if (assignedN === 1 && cfgN != null && cfgN >= 2) return cfgN;
  return null;
}

function deriveGroupsConfig(stageProps) {
  const cfg = parseJsonSafe(stageProps?.configJson) || {};
  const numGroups = Number(cfg.numGroups);
  const teamsPerGroup = Number(cfg.teamsPerGroup);
  return {
    numGroups: Number.isInteger(numGroups) && numGroups > 0 ? numGroups : 0,
    teamsPerGroup: Number.isInteger(teamsPerGroup) && teamsPerGroup > 0 ? teamsPerGroup : 0,
  };
}

async function resolveCompetitionEffectiveMaxSlots(session, competitionId) {
  const compR = await session.run(
    `MATCH (c:Competition {id:$id})
     RETURN c
     LIMIT 1`,
    { id: competitionId }
  );
  if (compR.records.length === 0) throw new Error('NOT_FOUND: competition no existe');
  const competition = compR.records[0].get('c').properties;
  const explicit = Number(competition.maxSlots);
  if (Number.isInteger(explicit) && explicit > 0) return explicit;

  const stagesR = await session.run(
    `MATCH (c:Competition {id:$id})-[hs:HAS_STAGE]->(s:Stage)
     RETURN s
     ORDER BY hs.order`,
    { id: competitionId }
  );
  for (const record of stagesR.records) {
    const capacity = deriveCompetitionCapacityFromStage(record.get('s').properties);
    if (capacity && capacity > 0) return capacity;
  }
  return 16;
}

async function upsertCompetitorSnapshot(session, {
  competitorId,
  kind,
  displayName,
  shortName,
  avatarUrl,
  badgeUrl,
}) {
  const updatedAt = new Date().toISOString();
  const res = await session.run(
    `MERGE (c:Competitor {id:$id})
     REMOVE c:Team:Participant
     SET c:Competitor
     FOREACH (_ IN CASE WHEN $kind = 'team' THEN [1] ELSE [] END | SET c:Team)
     FOREACH (_ IN CASE WHEN $kind = 'participant' THEN [1] ELSE [] END | SET c:Participant)
     ON CREATE SET
       c.kind = $kind,
       c.displayName = $displayName,
       c.shortName = $shortName,
       c.avatarUrl = $avatarUrl,
       c.badgeUrl = $badgeUrl,
       c.source = 'sql-snapshot',
       c.updatedAt = $updatedAt
     ON MATCH SET
       c.kind = coalesce($kind, c.kind),
       c.displayName = coalesce($displayName, c.displayName),
       c.shortName = coalesce($shortName, c.shortName),
       c.avatarUrl = coalesce($avatarUrl, c.avatarUrl),
       c.badgeUrl = coalesce($badgeUrl, c.badgeUrl),
       c.source = coalesce(c.source, 'sql-snapshot'),
       c.updatedAt = $updatedAt
     RETURN c`,
    {
      id: competitorId,
      kind,
      displayName,
      shortName: shortName ?? null,
      avatarUrl: avatarUrl ?? null,
      badgeUrl: badgeUrl ?? null,
      updatedAt,
    }
  );
  return res.records[0]?.get('c')?.properties;
}

function requireOrganizer(context) {
  return requireOrganizerFromAuthHeader(context?.headers?.authorization || '');
}

function matchFromNeoProps(m) {
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

/** Misma orden que el resolver Stage.assignedInscriptions (seedOrder, displayName, inscriptionId). */
async function loadOrderedInscriptionsFromStage(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i ORDER BY coalesce(i.seedOrder, 999999), i.displayName, i.inscriptionId`,
    { stageId }
  );
  return res.records.map((r) => {
    const i = r.get('i').properties;
    return {
      inscriptionId: String(i.inscriptionId ?? ''),
      tournamentId: String(i.tournamentId ?? ''),
      displayName: String(i.displayName ?? i.inscriptionId ?? ''),
    };
  });
}

async function loadOrderedInscriptionsFromGroup(session, groupId) {
  const res = await session.run(
    `MATCH (g:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i ORDER BY i.displayName, i.inscriptionId`,
    { groupId }
  );
  return res.records.map((r) => {
    const i = r.get('i').properties;
    return {
      inscriptionId: String(i.inscriptionId ?? ''),
      tournamentId: String(i.tournamentId ?? ''),
      displayName: String(i.displayName ?? i.inscriptionId ?? ''),
    };
  });
}

function inscriptionAtSeed(teams, seed) {
  if (seed == null || seed === '') return null;
  const idx = Number(seed);
  if (!Number.isInteger(idx) || idx < 0 || idx >= teams.length) return null;
  return teams[idx];
}

/** Tras generar liga, copia nombres e IDs desde seeds 0..n-1 al orden de inscripciones de la etapa. */
async function hydrateLeagueMatchesFromSeeds(session, stageId) {
  const teams = await loadOrderedInscriptionsFromStage(session, stageId);
  if (teams.length === 0) return;
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.groupId IS NULL
     RETURN m.id AS id, m.leagueHomeSeed AS lhs, m.leagueAwaySeed AS las`,
    { stageId }
  );
  for (const rec of res.records) {
    const id = rec.get('id');
    const home = inscriptionAtSeed(teams, rec.get('lhs'));
    const away = inscriptionAtSeed(teams, rec.get('las'));
    await session.run(
      `MATCH (m:Match {id:$id})
       SET m.homeInscriptionId = $hid,
           m.homeDisplayName = $hdn,
           m.homeTournamentId = $htid,
           m.awayInscriptionId = $aid,
           m.awayDisplayName = $adn,
           m.awayTournamentId = $atid`,
      {
        id,
        hid: home?.inscriptionId ?? null,
        hdn: home?.displayName ?? null,
        htid: home?.tournamentId ?? null,
        aid: away?.inscriptionId ?? null,
        adn: away?.displayName ?? null,
        atid: away?.tournamentId ?? null,
      }
    );
  }
}

/** Round-robin por grupo: seeds relativos al orden de inscripciones de cada grupo. */
async function hydrateGroupRoundRobinMatchesFromSeeds(session, stageId) {
  const distinctR = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.groupId IS NOT NULL AND m.groupId <> ''
     RETURN DISTINCT m.groupId AS gid`,
    { stageId }
  );
  for (const rec of distinctR.records) {
    const gid = String(rec.get('gid') ?? '');
    if (!gid) continue;
    const teams = await loadOrderedInscriptionsFromGroup(session, gid);
    if (teams.length === 0) continue;
    const matchesR = await session.run(
      `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {groupId:$gid})
       RETURN m.id AS id, m.leagueHomeSeed AS lhs, m.leagueAwaySeed AS las`,
      { stageId, gid }
    );
    for (const mrec of matchesR.records) {
      const id = mrec.get('id');
      const home = inscriptionAtSeed(teams, mrec.get('lhs'));
      const away = inscriptionAtSeed(teams, mrec.get('las'));
      await session.run(
        `MATCH (m:Match {id:$id})
         SET m.homeInscriptionId = $hid,
             m.homeDisplayName = $hdn,
             m.homeTournamentId = $htid,
             m.awayInscriptionId = $aid,
             m.awayDisplayName = $adn,
             m.awayTournamentId = $atid`,
        {
          id,
          hid: home?.inscriptionId ?? null,
          hdn: home?.displayName ?? null,
          htid: home?.tournamentId ?? null,
          aid: away?.inscriptionId ?? null,
          adn: away?.displayName ?? null,
          atid: away?.tournamentId ?? null,
        }
      );
    }
  }
}

/**
 * Primera ronda de eliminación: empareja índices de llave clásica (0 vs P-1, 1 vs P-2, …).
 * Si el índice >= n de equipos reales, el slot queda vacío (BYE).
 */
async function hydrateEliminationFirstRoundFromBracket(session, stageId) {
  const teams = await loadOrderedInscriptionsFromStage(session, stageId);
  const n = teams.length;
  if (n < 2) return;
  const P = nextPowerOf2(n);
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(toInteger(m.round), 0) = 1
     RETURN m.id AS id, m.slotIndex AS si, coalesce(toInteger(m.leg), 1) AS leg
     ORDER BY m.slotIndex, m.leg`,
    { stageId }
  );
  for (const rec of res.records) {
    const id = rec.get('id');
    const slotIndex = Number(rec.get('si'));
    const leg = Number(rec.get('leg')) || 1;
    if (!Number.isFinite(slotIndex) || slotIndex < 1) continue;
    let idxA;
    let idxB;
    try {
      ({ idxA, idxB } = eliminationFirstRoundBracketPositions(P, slotIndex));
    } catch {
      continue;
    }
    const swap = leg === 2;
    const homeIdx = swap ? idxB : idxA;
    const awayIdx = swap ? idxA : idxB;
    const home = homeIdx >= 0 && homeIdx < n ? teams[homeIdx] : null;
    const away = awayIdx >= 0 && awayIdx < n ? teams[awayIdx] : null;
    const matchKind = (home && !away) || (!home && away) ? 'bye' : 'bracket';
    await session.run(
      `MATCH (m:Match {id:$id})
       SET m.homeInscriptionId = $hid,
           m.homeDisplayName = $hdn,
           m.homeTournamentId = $htid,
           m.awayInscriptionId = $aid,
           m.awayDisplayName = $adn,
           m.awayTournamentId = $atid,
           m.matchKind = $matchKind`,
      {
        id,
        hid: home?.inscriptionId ?? null,
        hdn: home?.displayName ?? null,
        htid: home?.tournamentId ?? null,
        aid: away?.inscriptionId ?? null,
        adn: away?.displayName ?? null,
        atid: away?.tournamentId ?? null,
        matchKind,
      }
    );
  }
}

/**
 * Refs de ganador de llave (`liga360-slot:ew:` / `pos:ew:`): conservar el ref en inscriptionId
 * y solo actualizar displayName, para no confundir con posiciones de liga/grupos al resolver.
 */
function isWinnerSlotRef(raw) {
  const s = String(raw || '');
  return s.startsWith('liga360-slot:ew:') || s.startsWith('pos:ew:');
}

/** Parsea `liga360-slot:ew:{stageId}:{matchId}` (matchId puede contener guiones, no `:`). */
function parseWinnerSlotRef(str) {
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

/**
 * Resuelve los position refs (liga360-slot:/pos:) en los slots de un partido.
 * Muta el objeto match y lo devuelve.
 */
async function resolveMatchRefs(match, driver) {
  const hid = String(match.homeInscriptionId || '');
  const aid = String(match.awayInscriptionId || '');
  try {
    if (hid && (hid.startsWith('liga360-slot:') || hid.startsWith('pos:'))) {
      let r = await resolvePositionRef(driver, hid);
      if (r?.displayName && isPlaceholderParticipantLabel(r.displayName)) {
        const deeper = await resolveInscriptionToTeamDisplay(driver, hid);
        if (deeper?.displayName) r = deeper;
      }
      if (r) applyResolvedSlot(match, 'home', r, isWinnerSlotRef(hid));
    } else if (hid && isPhysicalInscriptionId(hid)) {
      const dn = String(match.homeDisplayName || '').trim();
      if (isPlaceholderParticipantLabel(dn)) {
        const looked = await lookupInscriptionDisplayName(driver, hid);
        if (looked) match.homeDisplayName = looked;
      }
    }
    if (aid && (aid.startsWith('liga360-slot:') || aid.startsWith('pos:'))) {
      let r = await resolvePositionRef(driver, aid);
      if (r?.displayName && isPlaceholderParticipantLabel(r.displayName)) {
        const deeper = await resolveInscriptionToTeamDisplay(driver, aid);
        if (deeper?.displayName) r = deeper;
      }
      if (r) applyResolvedSlot(match, 'away', r, isWinnerSlotRef(aid));
    } else if (aid && isPhysicalInscriptionId(aid)) {
      const dn = String(match.awayDisplayName || '').trim();
      if (isPlaceholderParticipantLabel(dn)) {
        const looked = await lookupInscriptionDisplayName(driver, aid);
        if (looked) match.awayDisplayName = looked;
      }
    }
  } catch (e) {
    logger.error({ err: e }, 'resolveMatchRefs error');
  }
  return match;
}

async function lookupInscriptionDisplayName(driver, inscriptionId) {
  const id = String(inscriptionId || '').trim();
  if (!id || !isPhysicalInscriptionId(id)) return null;
  const session = driver.session();
  try {
    const byRef = await session.run(
      `MATCH (i:InscriptionRef {inscriptionId: $iid})
       RETURN i.displayName AS dn LIMIT 1`,
      { iid: id }
    );
    let dn = byRef.records[0]?.get('dn');
    if (dn && String(dn).trim() && !isPlaceholderParticipantLabel(dn)) {
      return String(dn).trim();
    }
    const byStage = await session.run(
      `MATCH (:Stage)-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {inscriptionId: $iid})
       RETURN i.displayName AS dn LIMIT 1`,
      { iid: id }
    );
    dn = byStage.records[0]?.get('dn');
    if (dn && String(dn).trim() && !isPlaceholderParticipantLabel(dn)) {
      return String(dn).trim();
    }
    const fromMatch = await session.run(
      `MATCH (m:Match)
       WHERE toString(m.homeInscriptionId) = $iid OR toString(m.awayInscriptionId) = $iid
       RETURN m.homeInscriptionId AS hid, m.homeDisplayName AS hd,
              m.awayInscriptionId AS aid, m.awayDisplayName AS ad
       LIMIT 10`,
      { iid: id }
    );
    for (const rec of fromMatch.records) {
      const useHome = String(rec.get('hid') ?? '') === id;
      const dnMatch = String(useHome ? rec.get('hd') : rec.get('ad') ?? '').trim();
      if (dnMatch && !isPlaceholderParticipantLabel(dnMatch)) return dnMatch;
    }
  } finally {
    await session.close();
  }
  return null;
}

/**
 * Resuelve cualquier inscriptionId/ref hasta nombre de equipo real (con límite anti-ciclos).
 */
async function resolveInscriptionToTeamDisplay(driver, inscriptionId, resolving = new Set()) {
  const id = String(inscriptionId || '').trim();
  if (!id || resolving.has(id)) return null;
  resolving.add(id);

  try {
    if (isPhysicalInscriptionId(id)) {
      const dn = await lookupInscriptionDisplayName(driver, id);
      if (dn) return { inscriptionId: id, displayName: dn };
      return null;
    }

    if (id.startsWith('liga360-slot:') || id.startsWith('pos:')) {
      const r = await resolvePositionRef(driver, id);
      if (!r) return null;
      const dn = String(r.displayName ?? '').trim();
      const resolvedId = String(r.inscriptionId ?? '').trim();
      if (dn && !isPlaceholderParticipantLabel(dn) && isPhysicalInscriptionId(resolvedId)) {
        return { inscriptionId: resolvedId, displayName: dn };
      }
      if (dn && !isPlaceholderParticipantLabel(dn)) {
        return { inscriptionId: resolvedId || id, displayName: dn };
      }
      if (resolvedId && resolvedId !== id && !resolving.has(resolvedId)) {
        return resolveInscriptionToTeamDisplay(driver, resolvedId, resolving);
      }
    }
    return null;
  } finally {
    resolving.delete(id);
  }
}

/**
 * Ganador de una pierna ya resuelta (refs expandidos, scores reales).
 */
async function resolveFinishedMatchWinnerFromResolvedLeg(driver, leg) {
  const hs = leg.homeScore != null ? Number(leg.homeScore) : null;
  const as_ = leg.awayScore != null ? Number(leg.awayScore) : null;
  if (hs == null || as_ == null || !Number.isFinite(hs) || !Number.isFinite(as_) || hs === as_) {
    return null;
  }

  const winnerId = String(hs > as_ ? leg.homeInscriptionId : leg.awayInscriptionId || '').trim();
  if (!winnerId) return null;

  const winnerDisplay = String(hs > as_ ? leg.homeDisplayName : leg.awayDisplayName || '').trim();
  if (winnerDisplay && !isPlaceholderParticipantLabel(winnerDisplay) && isPhysicalInscriptionId(winnerId)) {
    return { inscriptionId: winnerId, displayName: winnerDisplay };
  }

  return resolveInscriptionToTeamDisplay(driver, winnerId);
}

function resolveFinishedMatchLoserFromResolvedLeg(leg) {
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

function isMatchFinishedStatus(raw) {
  const st = String(raw || '').toLowerCase();
  return st === 'finished' || st === 'completed';
}

/** Mapea ganador agregado (puede ser dn:*) al id físico persistible en Neo4j. */
function findPersistableWinnerFromLegs(picked, legs) {
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

async function finalizeSeriesWinnerPick(driver, picked, legs) {
  const persistable = findPersistableWinnerFromLegs(picked, legs);
  if (!persistable?.displayName || isPlaceholderParticipantLabel(persistable.displayName)) return null;
  if (isPhysicalInscriptionId(persistable.inscriptionId)) {
    return { inscriptionId: persistable.inscriptionId, displayName: persistable.displayName, tournamentId: persistable.tournamentId };
  }
  const deeper = await resolveInscriptionToTeamDisplay(driver, persistable.inscriptionId);
  if (deeper?.displayName && !isPlaceholderParticipantLabel(deeper.displayName)) {
    const id = isPhysicalInscriptionId(deeper.inscriptionId) ? deeper.inscriptionId : persistable.inscriptionId;
    return { inscriptionId: id, displayName: deeper.displayName, tournamentId: persistable.tournamentId };
  }
  return persistable;
}

/** Ganador de serie eliminatoria a partir de piernas ya resueltas (resolveMatchRefs aplicado). */
async function resolveEliminationSeriesWinnerFromResolvedLegs(driver, resolvedLegs) {
  if (!resolvedLegs?.length) return null;
  if (resolvedLegs.length === 1) {
    return resolveFinishedMatchWinnerFromResolvedLeg(driver, resolvedLegs[0]);
  }
  const scoreMap = aggregateEliminationSeriesScores(resolvedLegs);
  const picked = pickSeriesWinnerFromScoreMap(scoreMap);
  return finalizeSeriesWinnerPick(driver, picked, resolvedLegs);
}

async function resolveEliminationSeriesLoserFromResolvedLegs(driver, resolvedLegs) {
  if (!resolvedLegs?.length) return null;
  if (resolvedLegs.length === 1) {
    return resolveFinishedMatchLoserFromResolvedLeg(resolvedLegs[0]);
  }
  const scoreMap = aggregateEliminationSeriesScores(resolvedLegs);
  const entries = [...scoreMap.entries()].sort((a, b) => b[1].score - a[1].score);
  if (entries.length < 2) return null;
  if (entries[0][1].score === entries[1][1].score) return null;
  const picked = {
    inscriptionId: entries[1][0],
    displayName: entries[1][1].displayName,
  };
  return finalizeSeriesWinnerPick(driver, picked, resolvedLegs);
}

/**
 * Ganador de serie eliminatoria (ida/vuelta o pierna única): resuelve refs y agrega goles.
 */
async function resolveEliminationSeriesWinnerFromMatch(driver, mProps, stageIdHint = null) {
  const session = driver.session();
  try {
    const seed = matchFromNeoProps(mProps);
    const matchId = seed.id;
    if (!matchId) return null;

    let stageId = stageIdHint;
    if (!stageId) {
      const sR = await session.run(
        `MATCH (s:Stage)-[:HAS_MATCH]->(:Match {id:$id}) RETURN s.id AS sid LIMIT 1`,
        { id: matchId }
      );
      stageId = sR.records[0]?.get('sid');
    }
    if (!stageId) return null;

    const round = Number(seed.round ?? 1);
    const slotIndex = Number(seed.slotIndex ?? 1);

    const allLegsR = await session.run(
      `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(leg:Match)
       WHERE leg.round = $round AND leg.slotIndex = $slotIndex
       RETURN leg
       ORDER BY COALESCE(leg.leg, 1), leg.id`,
      { stageId, round, slotIndex }
    );
    if (allLegsR.records.length === 0) return null;

    const legs = [];
    for (const rec of allLegsR.records) {
      const leg = matchFromNeoProps(rec.get('leg').properties);
      await resolveMatchRefs(leg, driver);
      legs.push(leg);
    }

    const allFinished = legs.every((l) => isMatchFinishedStatus(l.status));
    if (!allFinished) return null;

    return resolveEliminationSeriesWinnerFromResolvedLegs(driver, legs);
  } finally {
    await session.close();
  }
}

/**
 * Resuelve el ganador de un partido eliminatorio ya finalizado: siempre prioriza nombre de equipo real.
 */
async function resolveFinishedMatchWinner(driver, m) {
  const leg = matchFromNeoProps(m);
  await resolveMatchRefs(leg, driver);
  return resolveFinishedMatchWinnerFromResolvedLeg(driver, leg);
}

function applyResolvedSlot(match, role, resolved, keepWinnerRef) {
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

/**
 * Resuelve dinámicamente un ID de referencia de posición al equipo real (o label pendiente).
 *
 * Formatos soportados:
 *   pos:sg:{stageId}:{groupId}:{n}                   → posición N del grupo en etapa de grupos
 *   pos:bestN:{stageId}:{position}:{n}:{rank}        → rank-th mejor equipo en posición {position} entre todos los grupos
 *   pos:l:{stageId}:{n}                              → posición N de una etapa liga
 *   pos:ew:{matchId}                                 → ganador del partido (eliminación)
 *   liga360-slot:sg:{sid}:{tid}:{gid}:{n}            → formato legado de grupos
 *   liga360-slot:ew:{sid}:{matchId}                  → formato legado de ganador
 */
async function resolvePositionRef(driver, posRef) {
  const str = String(posRef || '');
  if (!str) return null;

  const parts = str.split(':');
  let type = null;
  let groupId = null;
  let stageId = null;
  let matchId = null;
  let position = 0;

  // pos:bestN:{stageId}:{fromPosition}:{n}:{rank}
  // Selects the rank-th best team that finished at fromPosition across all groups in the stage
  let bestNStageId = null; let bestNPosition = 0; let bestNTotal = 0; let bestNRank = 0;
  if (str.startsWith('pos:bestN:') && parts.length >= 6) {
    bestNStageId = parts[2]; bestNPosition = parseInt(parts[3], 10); bestNTotal = parseInt(parts[4], 10); bestNRank = parseInt(parts[5], 10);
    type = 'bestN';
  }

  if (str.startsWith('pos:sg:') && parts.length >= 5) {
    type = 'sg'; stageId = parts[2]; groupId = parts[3]; position = parseInt(parts[4], 10);
  } else if (str.startsWith('liga360-slot:sg:') && parts.length >= 6) {
    type = 'sg'; stageId = parts[2]; groupId = parts[4]; position = parseInt(parts[5], 10);
  } else if (str.startsWith('pos:l:') && parts.length >= 4) {
    type = 'l'; stageId = parts[2]; position = parseInt(parts[3], 10);
  } else {
    const winnerRef = parseWinnerSlotRef(str);
    if (winnerRef) {
      type = 'ew';
      stageId = winnerRef.stageId;
      matchId = winnerRef.matchId;
    }
  }

  if (!type) return null;

  const session = driver.session();
  try {
    if (type === 'bestN' && bestNStageId && bestNPosition > 0 && bestNRank > 0) {
      const label = `${bestNRank}° mejor ${bestNPosition}° entre grupos`;

      // Load all groups in the stage
      const groupsR = await session.run(
        `MATCH (s:Stage {id:$sid})-[:HAS_GROUP]->(g:Group) RETURN g.id AS gid ORDER BY g.order`,
        { sid: bestNStageId }
      );
      if (groupsR.records.length === 0) return { inscriptionId: posRef, displayName: label };

      // For each group compute standings and extract the team at bestNPosition
      const candidates = [];
      for (const gr of groupsR.records) {
        const gid = gr.get('gid');
        const inscR = await session.run(
          `MATCH (g:Group {id:$gid})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i.inscriptionId AS iid, i.displayName AS dn
           ORDER BY i.displayName, i.inscriptionId`,
          { gid }
        );
        const inscriptions = inscR.records.map((r) => ({ inscriptionId: r.get('iid'), displayName: r.get('dn') }));
        if (inscriptions.length === 0) continue;
        const mR = await session.run(
          `MATCH (g:Group {id:$gid})-[:HAS_MATCH]->(m:Match)
           RETURN m.homeInscriptionId AS h, m.awayInscriptionId AS a,
                  m.homeDisplayName AS hd, m.awayDisplayName AS ad,
                  m.homeScore AS hs, m.awayScore AS as_,
                  coalesce(m.status, m.matchStatus, 'scheduled') AS matchStatus`,
          { gid }
        );
        const matches = mR.records.map((r) => ({
          homeInscriptionId: r.get('h'), awayInscriptionId: r.get('a'),
          homeDisplayName: r.get('hd'), awayDisplayName: r.get('ad'),
          homeScore: r.get('hs'), awayScore: r.get('as_'), matchStatus: r.get('matchStatus'),
        }));
        const standings = computeStandings(matches, inscriptions);
        const row = standings.find((r) => r.position === bestNPosition);
        if (row) candidates.push(row);
      }

      if (candidates.length === 0) return { inscriptionId: posRef, displayName: label };

      // Sort by pts desc → goalDifference desc → goalsFor desc
      candidates.sort((a, b) =>
        b.points !== a.points ? b.points - a.points :
        b.goalDifference !== a.goalDifference ? b.goalDifference - a.goalDifference :
        b.goalsFor - a.goalsFor
      );

      const team = candidates[bestNRank - 1];
      if (!team) return { inscriptionId: posRef, displayName: label };
      return { inscriptionId: team.inscriptionId, displayName: team.displayName };
    }

    if (type === 'sg' && groupId && position > 0) {
      const gR = await session.run(`MATCH (g:Group {id:$id}) RETURN g.name AS name`, { id: groupId });
      const groupName = gR.records[0]?.get('name') || 'Grupo';
      const label = `${position}° ${groupName}`;

      const inscR = await session.run(
        `MATCH (g:Group {id:$gid})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
         RETURN i.inscriptionId AS iid, i.displayName AS dn
         ORDER BY i.displayName, i.inscriptionId`,
        { gid: groupId }
      );
      const inscriptions = inscR.records.map((r) => ({
        inscriptionId: r.get('iid'), displayName: r.get('dn'),
      }));
      if (inscriptions.length === 0) return { inscriptionId: posRef, displayName: label };

      const mR = await session.run(
        `MATCH (g:Group {id:$gid})-[:HAS_MATCH]->(m:Match)
         RETURN m.homeInscriptionId AS h, m.awayInscriptionId AS a,
                m.homeDisplayName AS hd, m.awayDisplayName AS ad,
                m.homeScore AS hs, m.awayScore AS as_,
                coalesce(m.status, m.matchStatus, 'scheduled') AS matchStatus`,
        { gid: groupId }
      );
      const matches = mR.records.map((r) => ({
        homeInscriptionId: r.get('h'), awayInscriptionId: r.get('a'),
        homeDisplayName: r.get('hd'), awayDisplayName: r.get('ad'),
        homeScore: r.get('hs'), awayScore: r.get('as_'), matchStatus: r.get('matchStatus'),
      }));
      const standings = computeStandings(matches, inscriptions);
      const row = standings.find((r) => r.position === position);
      if (!row) return { inscriptionId: posRef, displayName: label };
      return { inscriptionId: row.inscriptionId, displayName: row.displayName };
    }

    if (type === 'l' && stageId && position > 0) {
      const sR = await session.run(`MATCH (s:Stage {id:$id}) RETURN s.name AS name`, { id: stageId });
      const stageName = sR.records[0]?.get('name') || 'Etapa';
      const label = `${position}° ${stageName}`;

      const inscR = await session.run(
        `MATCH (s:Stage {id:$sid})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
         RETURN i.inscriptionId AS iid, i.displayName AS dn
         ORDER BY i.displayName, i.inscriptionId`,
        { sid: stageId }
      );
      const inscriptions = inscR.records.map((r) => ({
        inscriptionId: r.get('iid'), displayName: r.get('dn'),
      }));
      if (inscriptions.length === 0) return { inscriptionId: posRef, displayName: label };

      const mR = await session.run(
        `MATCH (s:Stage {id:$sid})-[:HAS_MATCH]->(m:Match)
         RETURN m.homeInscriptionId AS h, m.awayInscriptionId AS a,
                m.homeDisplayName AS hd, m.awayDisplayName AS ad,
                m.homeScore AS hs, m.awayScore AS as_,
                coalesce(m.status, m.matchStatus, 'scheduled') AS matchStatus`,
        { sid: stageId }
      );
      const matches = mR.records.map((r) => ({
        homeInscriptionId: r.get('h'), awayInscriptionId: r.get('a'),
        homeDisplayName: r.get('hd'), awayDisplayName: r.get('ad'),
        homeScore: r.get('hs'), awayScore: r.get('as_'), matchStatus: r.get('matchStatus'),
      }));
      const standings = computeStandings(matches, inscriptions);
      const physicalRow = pickPhysicalStandingsRow(standings, position);
      if (physicalRow) {
        return { inscriptionId: physicalRow.inscriptionId, displayName: physicalRow.displayName };
      }
      const row = standings.find((r) => r.position === position);
      if (row && isPhysicalInscriptionId(String(row.inscriptionId ?? ''))) {
        const dn = String(row.displayName ?? '').trim();
        if (dn && !isPlaceholderParticipantLabel(dn)) {
          return { inscriptionId: row.inscriptionId, displayName: dn };
        }
      }
      return { inscriptionId: posRef, displayName: label };
    }

    if (type === 'ew' && matchId) {
      const mR = await session.run(`MATCH (m:Match {id:$id}) RETURN m`, { id: matchId });
      if (mR.records.length === 0) return { inscriptionId: posRef, displayName: 'Gan. pendiente' };
      const m = mR.records[0].get('m').properties;
      const status = String(m.status || m.matchStatus || '').toLowerCase();
      if (status !== 'finished' && status !== 'completed') {
        const si = m.slotIndex != null ? Number(m.slotIndex) : 0;
        let stageName = 'Etapa';
        if (stageId) {
          const sR = await session.run(`MATCH (s:Stage {id:$id}) RETURN s.name AS name`, { id: stageId });
          stageName = sR.records[0]?.get('name') || stageName;
        } else {
          const sR = await session.run(
            `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$id}) RETURN s.name AS name LIMIT 1`,
            { id: matchId }
          );
          stageName = sR.records[0]?.get('name') || stageName;
        }
        return { inscriptionId: posRef, displayName: `Ganador Partido ${si} - ${stageName}` };
      }
      const winner = await resolveEliminationSeriesWinnerFromMatch(driver, m, stageId);
      if (winner?.displayName) {
        return { inscriptionId: posRef, displayName: winner.displayName };
      }
      const si = m.slotIndex != null ? Number(m.slotIndex) : 0;
      let stageName = 'Etapa';
      if (stageId) {
        const sR = await session.run(`MATCH (s:Stage {id:$id}) RETURN s.name AS name`, { id: stageId });
        stageName = sR.records[0]?.get('name') || stageName;
      }
      return { inscriptionId: posRef, displayName: `Ganador Partido ${si} - ${stageName}` };
    }

    return null;
  } finally {
    await session.close();
  }
}

/**
 * Elimina ADVANCES_TO entre dos etapas si no hay un nodo Transition que respalde ese avance.
 * Evita falsos positivos en el chequeo de ciclos tras borrar transiciones a mano o inconsistencias.
 */
async function pruneOrphanAdvancesToBetweenStages(session, fromStageId, toStageId) {
  await session.run(
    `MATCH (a:Stage)-[adv:ADVANCES_TO]->(b:Stage)
     WHERE a.id IN $ids AND b.id IN $ids
     AND NOT EXISTS {
       MATCH (a)-[:EMITS|HAS_TRANSITION]->(tr:Transition)
       WHERE coalesce(tr.timing, 'in_season') <> 'next_edition'
         AND ((tr)-[:TO]->(b) OR (tr)-[:TO_STAGE]->(b))
     }
     DELETE adv`,
    { ids: [fromStageId, toStageId] }
  );
}

function mapTransitionGraphql(t, dst) {
  return {
    id: t.id,
    type: t.type,
    label: t.label ?? null,
    toStageId: dst?.id ?? null,
    selectionKind: t.selectionKind ?? null,
    topN: t.topN != null ? Number(t.topN) : null,
    rangeFrom: t.rangeFrom != null ? Number(t.rangeFrom) : null,
    rangeTo: t.rangeTo != null ? Number(t.rangeTo) : null,
    bottomN: t.bottomN != null ? Number(t.bottomN) : null,
    toExternalTournamentId: t.toExternalTournamentId ?? null,
    toExternalStageId: t.toExternalStageId ?? null,
    toExternalTournamentName: t.toExternalTournamentName ?? null,
    carryOverJson: t.carryOverJson ?? null,
    timing: t.timing ?? 'in_season',
    placementSnapshotJson: t.placementSnapshotJson ?? null,
  };
}

async function deleteMatchesForStage(session, stageId) {
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     DETACH DELETE m`,
    { stageId }
  );
}

// Basic resolvers (mock con persistencia mínima en Neo4j)
const resolvers = {
  Query: {
    health: () => 'ok',
    version: () => '0.1.0',
    tournaments: async (_,_args,{ driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          'MATCH (t:Tournament) RETURN t ORDER BY t.name'
        );
        return res.records.map(r => {
          const t = r.get('t').properties;
          return {
            id: t.id,
            name: t.name,
            sport: t.sport ?? 'football',
            season: t.season ?? null,
            venue: t.venue ?? null,
            organizer: t.organizer ?? null,
            participantType: t.participantType ?? null,
            maxSlots: Number(t.maxSlots) || 16,
            inscriptionMode: t.inscriptionMode ?? 'public',
            status: t.status ?? 'draft',
          };
        });
      } finally {
        await session.close();
      }
    },
    tournament: async (_,{ id },{ driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          'MATCH (t:Tournament {id:$id}) RETURN t',
          { id }
        );
        if (res.records.length === 0) return null;
        const t = res.records[0].get('t').properties;
        return {
          id: t.id,
          name: t.name,
          sport: t.sport ?? 'football',
          season: t.season ?? null,
          venue: t.venue ?? null,
          organizer: t.organizer ?? null,
          participantType: t.participantType ?? null,
          maxSlots: Number(t.maxSlots) || 16,
          inscriptionMode: t.inscriptionMode ?? 'public',
          status: t.status ?? 'draft',
        };
      } finally {
        await session.close();
      }
    },
    competition: async (_,{ id },{ driver }) => {
      const session = driver.session();
      try {
        const r = await session.run(
          `MATCH (c:Competition {id:$id})
           RETURN c
           LIMIT 1`,
          { id }
        );
        if (r.records.length === 0) return null;
        const c = r.records[0].get('c').properties;
        const effective = await resolveCompetitionEffectiveMaxSlots(session, id);
        return {
          id: c.id,
          name: c.name,
          order: Number(c.order) || 0,
          maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
          effectiveMaxSlots: effective,
        };
      } finally {
        await session.close();
      }
    },
  },
  Mutation: {
    createTournament: async (_, { name, sport, season, venue, participantType, maxSlots, inscriptionMode, status }, context) => {
      const user = requireOrganizer(context);
      const organizer = String(user?.username || '').trim() || `organizer-${String(user?.sub || '')}`;
      const parsedMaxSlots = Number(maxSlots ?? 0);
      const safeMaxSlots = Number.isInteger(parsedMaxSlots) && parsedMaxSlots > 0 ? parsedMaxSlots : 16;
      const id = genId('t');
      const session = context.driver.session();
      try {
        await session.run(
          'CREATE (t:Tournament {id:$id, name:$name, sport:$sport, season:$season, venue:$venue, organizer:$organizer, participantType:$pt, maxSlots:$maxSlots, inscriptionMode:$inscriptionMode, status:$status}) RETURN t',
          {
            id,
            name,
            sport,
            season: season || null,
            venue: venue || null,
            organizer,
            pt: participantType || null,
            maxSlots: safeMaxSlots,
            inscriptionMode,
            status,
          }
        );
        return {
          id,
          name,
          sport,
          season: season || null,
          venue: venue || null,
          organizer,
          participantType: participantType || null,
          maxSlots: safeMaxSlots,
          inscriptionMode,
          status,
        };
      } finally {
        await session.close();
      }
    },
    updateTournament: async (
      _,
      { id, name, sport, season, venue, participantType, inscriptionMode, status },
      context
    ) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const updated = await session.run(
          `MATCH (t:Tournament {id:$id})
           SET t.name = $name,
               t.sport = $sport,
               t.season = $season,
               t.venue = $venue,
               t.participantType = $participantType,
               t.inscriptionMode = $inscriptionMode,
               t.status = $status
           RETURN t
           LIMIT 1`,
          {
            id,
            name,
            sport,
            season: season || null,
            venue: venue || null,
            participantType: participantType || null,
            inscriptionMode,
            status,
          }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: tournament no existe');
        const t = updated.records[0].get('t').properties;
        return {
          id: t.id,
          name: t.name,
          sport: t.sport ?? 'football',
          season: t.season ?? null,
          venue: t.venue ?? null,
          organizer: t.organizer ?? null,
          participantType: t.participantType ?? null,
          maxSlots: Number(t.maxSlots) || 16,
          inscriptionMode: t.inscriptionMode ?? 'public',
          status: t.status ?? 'draft',
        };
      } finally {
        await session.close();
      }
    },
    deleteTournament: async (_, { id }, context) => {
      const user = requireOrganizer(context);
      const session = context.driver.session();
      try {
        const found = await session.run(
          `MATCH (t:Tournament {id:$id})
           RETURN t
           LIMIT 1`,
          { id }
        );
        if (found.records.length === 0) return false;
        const tournament = found.records[0].get('t').properties;
        const owner = String(tournament.organizer || '').trim().toLowerCase();
        const requester = String(user?.username || '').trim().toLowerCase();
        if (!owner || !requester || owner !== requester) {
          throw new Error('FORBIDDEN: solo el organizador creador puede eliminar este torneo');
        }
        // Cascada real: borrar todo el subgrafo del torneo
        // DETACH DELETE t solo borra relaciones directas; Competition, Stage, etc. están a más hops
        await session.run(
          `MATCH (t:Tournament {id:$id})
           OPTIONAL MATCH (t)-[:HAS_COMPETITION]->(c:Competition)
           OPTIONAL MATCH (c)-[:HAS_STAGE]->(s:Stage)
           OPTIONAL MATCH (s)-[:HAS_GROUP]->(g:Group)
           OPTIONAL MATCH (s)-[:HAS_MATCH]->(m:Match)
           OPTIONAL MATCH (g)-[:HAS_MATCH]->(gm:Match)
           OPTIONAL MATCH (s)-[:EMITS|HAS_TRANSITION]->(tr:Transition)
           OPTIONAL MATCH (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           DETACH DELETE tr, gm, m, g, i, s, c, t`,
          { id }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Competition y relación con Tournament
    createCompetition: async (_, { tournamentId, name, order, maxSlots }, { driver }) => {
      const id = genId('c');
      const session = driver.session();
      try {
        const parsed = maxSlots == null ? null : Number(maxSlots);
        const safeMaxSlots = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        await session.run(
          `MATCH (t:Tournament {id:$tid})
           CREATE (t)-[:HAS_COMPETITION {order:$order}]->(c:Competition {id:$id, name:$name, order:$order, maxSlots:$maxSlots})
           RETURN c`,
          { tid: tournamentId, id, name, order, maxSlots: safeMaxSlots }
        );
        const effective = safeMaxSlots ?? 16;
        return { id, name, order, maxSlots: safeMaxSlots, effectiveMaxSlots: effective };
      } finally {
        await session.close();
      }
    },
    updateCompetition: async (_, { competitionId, name, order, maxSlots }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const parsed = maxSlots == null ? null : Number(maxSlots);
        const safeMaxSlots = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
        const updated = await session.run(
          `MATCH (c:Competition {id:$id})
           SET c.name = $name,
               c.order = $order,
               c.maxSlots = $maxSlots
           RETURN c
           LIMIT 1`,
          { id: competitionId, name, order, maxSlots: safeMaxSlots }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: competition no existe');
        const c = updated.records[0].get('c').properties;
        const effective = await resolveCompetitionEffectiveMaxSlots(session, competitionId);
        return {
          id: c.id,
          name: c.name,
          order: Number(c.order) || 0,
          maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
          effectiveMaxSlots: effective,
        };
      } finally {
        await session.close();
      }
    },
    updateCompetitionMaxSlots: async (_, { competitionId, maxSlots }, { driver }) => {
      const session = driver.session();
      try {
        const parsed = maxSlots == null ? null : Number(maxSlots);
        if (parsed != null && (!Number.isInteger(parsed) || parsed <= 0)) {
          throw new Error('BAD_REQUEST: maxSlots debe ser entero positivo o null');
        }
        const updated = await session.run(
          `MATCH (c:Competition {id:$id})
           SET c.maxSlots = $maxSlots
           RETURN c
           LIMIT 1`,
          { id: competitionId, maxSlots: parsed }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: competition no existe');
        const c = updated.records[0].get('c').properties;
        const effective = await resolveCompetitionEffectiveMaxSlots(session, competitionId);
        return {
          id: c.id,
          name: c.name,
          order: Number(c.order) || 0,
          maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
          effectiveMaxSlots: effective,
        };
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Stage y relación con Competition
    addStage: async (_, { competitionId, name, order, format, configJson, childrenJson }, { driver }) => {
      const id = genId('s');
      const subtype = stageSubtypeLabelFromFormat(format);
      const session = driver.session();
      try {
        const query =
          `MATCH (c:Competition {id:$cid})
           CREATE (c)-[:HAS_STAGE {order:$order}]->(st:Stage:${subtype} {id:$id, name:$name, order:$order, format:$format, configJson:$configJson, childrenJson:$childrenJson})
           RETURN st`;
        await session.run(
          query,
          {
            cid: competitionId,
            id,
            name,
            order,
            format,
            configJson: configJson ?? null,
            childrenJson: childrenJson ?? null,
          }
        );
        return {
          id,
          name,
          order,
          format,
          configJson: configJson ?? null,
          childrenJson: childrenJson ?? null,
        };
      } finally {
        await session.close();
      }
    },
    updateStage: async (_, { stageId, name, order, format, configJson, childrenJson }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const updated = await session.run(
          `MATCH (st:Stage {id:$id})
           SET st.name = $name,
               st.order = $order,
               st.format = $format,
               st.configJson = $configJson,
               st.childrenJson = $childrenJson
           RETURN st
           LIMIT 1`,
          {
            id: stageId,
            name,
            order,
            format,
            configJson: configJson ?? null,
            childrenJson: childrenJson ?? null,
          }
        );
        if (updated.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const st = updated.records[0].get('st').properties;
        return {
          id: st.id,
          name: st.name,
          order: Number(st.order) || 0,
          format: st.format,
          configJson: st.configJson ?? null,
          childrenJson: st.childrenJson ?? null,
        };
      } finally {
        await session.close();
      }
    },
    // Persistencia mínima de Transition (como nodo) y relaciones entre Stage origen/destino
    addTransitionTopN: async (_, { fromStageId, toStageId, topN }, { driver }) => {
      const id = genId('tr');
      const session = driver.session();
      try {
        await pruneOrphanAdvancesToBetweenStages(session, fromStageId, toStageId);
        const cycleCheck = await session.run(
          `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
           ${STAGE_CYCLE_CHECK_CYPHER}`,
          { from: fromStageId, to: toStageId }
        );
        if (cycleCheck.records[0]?.get('hasCycle')) {
          throw new Error(STAGE_CYCLE_ERROR);
        }
        await session.run(
          `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
           CREATE (a)-[:EMITS]->(tr:Transition {id:$id, type:'top', label:'avance', selectionKind:'top', topN:$n})-[:TO]->(b)
           CREATE (a)-[:HAS_TRANSITION]->(tr)
           CREATE (tr)-[:TO_STAGE]->(b)
           CREATE (a)-[:ADVANCES_TO]->(b)
           RETURN tr`,
          { from: fromStageId, to: toStageId, id, n: topN }
        );
        return { id, type: 'top', label: 'avance', selectionKind: 'top', topN };
      } finally {
        await session.close();
      }
    },
    addTransition: async (_, {
      fromStageId,
      toStageId,
      label,
      selectionKind,
      topN,
      rangeFrom,
      rangeTo,
      bottomN,
      toExternalTournamentId,
      toExternalStageId,
      toExternalTournamentName,
      carryOverJson,
      timing: timingArg,
    }, { driver }) => {
      const id = genId('tr');
      const timing = normalizeTransitionTiming(timingArg);
      const nextEdition = isNextEditionTiming(timing);
      const session = driver.session();
      try {
        if (toStageId) {
          if (!nextEdition) {
            await pruneOrphanAdvancesToBetweenStages(session, fromStageId, toStageId);
            const cycleCheck = await session.run(
              `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
               ${STAGE_CYCLE_CHECK_CYPHER}`,
              { from: fromStageId, to: toStageId }
            );
            if (cycleCheck.records[0]?.get('hasCycle')) {
              throw new Error(STAGE_CYCLE_ERROR);
            }
          }
          await session.run(
            `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
             CREATE (a)-[:EMITS]->(tr:Transition {
               id:$id,
               type:'generic',
               label:$label,
               selectionKind:$selectionKind,
               topN:$topN,
               rangeFrom:$rangeFrom,
               rangeTo:$rangeTo,
               bottomN:$bottomN,
               carryOverJson:$carryOverJson,
               timing:$timing
             })-[:TO]->(b)
             CREATE (a)-[:HAS_TRANSITION]->(tr)
             CREATE (tr)-[:TO_STAGE]->(b)
             RETURN tr`,
            {
              from: fromStageId,
              to: toStageId,
              id,
              label,
              selectionKind,
              topN: topN ?? null,
              rangeFrom: rangeFrom ?? null,
              rangeTo: rangeTo ?? null,
              bottomN: bottomN ?? null,
              carryOverJson: carryOverJson ?? null,
              timing,
            }
          );
          if (!nextEdition) {
            await session.run(
              `MATCH (a:Stage {id:$from}), (b:Stage {id:$to})
               MERGE (a)-[:ADVANCES_TO]->(b)`,
              { from: fromStageId, to: toStageId }
            );
          }
        } else {
          await session.run(
            `MATCH (a:Stage {id:$from})
             CREATE (a)-[:EMITS]->(tr:Transition {
               id:$id,
               type:'external',
               label:$label,
               selectionKind:$selectionKind,
               topN:$topN,
               rangeFrom:$rangeFrom,
               rangeTo:$rangeTo,
               bottomN:$bottomN,
               toExternalTournamentId:$toExternalTournamentId,
               toExternalStageId:$toExternalStageId,
               toExternalTournamentName:$toExternalTournamentName,
               carryOverJson:$carryOverJson,
               timing:$timing
             })
             CREATE (a)-[:HAS_TRANSITION]->(tr)
             RETURN tr`,
            {
              from: fromStageId,
              id,
              label,
              selectionKind,
              topN: topN ?? null,
              rangeFrom: rangeFrom ?? null,
              rangeTo: rangeTo ?? null,
              bottomN: bottomN ?? null,
              toExternalTournamentId: toExternalTournamentId ?? null,
              toExternalStageId: toExternalStageId ?? null,
              toExternalTournamentName: toExternalTournamentName ?? null,
              carryOverJson: carryOverJson ?? null,
              timing,
            }
          );
        }
        return {
          id,
          type: toStageId ? 'generic' : 'external',
          label,
          selectionKind,
          topN: topN ?? null,
          rangeFrom: rangeFrom ?? null,
          rangeTo: rangeTo ?? null,
          bottomN: bottomN ?? null,
          toExternalTournamentId: toExternalTournamentId ?? null,
          toExternalStageId: toExternalStageId ?? null,
          toExternalTournamentName: toExternalTournamentName ?? null,
          carryOverJson: carryOverJson ?? null,
          timing,
          placementSnapshotJson: null,
        };
      } finally {
        await session.close();
      }
    },
    saveTransitionPlacementSnapshot: async (_, { transitionId, snapshotJson }, context) => {
      requireOrganizer(context);
      const raw = String(snapshotJson ?? '').trim();
      if (!raw) throw new Error('BAD_REQUEST: snapshotJson requerido');
      try {
        JSON.parse(raw);
      } catch {
        throw new Error('BAD_REQUEST: snapshotJson debe ser JSON válido');
      }
      const session = context.driver.session();
      try {
        const res = await session.run(
          `MATCH (tr:Transition {id:$id})
           SET tr.placementSnapshotJson = $snapshot
           WITH tr
           OPTIONAL MATCH (tr)-[:TO_STAGE]->(dst:Stage)
           RETURN tr, dst`,
          { id: transitionId, snapshot: raw }
        );
        if (res.records.length === 0) throw new Error('NOT_FOUND: transición no existe');
        const t = res.records[0].get('tr').properties;
        const dst = res.records[0].get('dst')?.properties || null;
        return mapTransitionGraphql(t, dst);
      } finally {
        await session.close();
      }
    },
    deleteTransition: async (_, { transitionId }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const meta = await session.run(
          `MATCH (tr:Transition {id:$id})
           OPTIONAL MATCH (a:Stage)-[:EMITS|HAS_TRANSITION]->(tr)
           OPTIONAL MATCH (tr)-[:TO|TO_STAGE]->(b:Stage)
           RETURN a.id AS aid, b.id AS bid`,
          { id: transitionId }
        );
        if (meta.records.length === 0) {
          throw new Error('NOT_FOUND: transición no existe');
        }
        const aid = meta.records[0]?.get('aid') ?? null;
        const bid = meta.records[0]?.get('bid') ?? null;
        if (aid && bid) {
          await session.run(
            `MATCH (a:Stage {id:$aid})-[adv:ADVANCES_TO]->(b:Stage {id:$bid})
             DELETE adv`,
            { aid, bid }
          );
        }
        await session.run(
          `MATCH (tr:Transition {id:$id})
           DETACH DELETE tr`,
          { id: transitionId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    addGroup: async (_, { stageId, name, order }, { driver }) => {
      const id = genId('g');
      const session = driver.session();
      try {
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           CREATE (s)-[:HAS_GROUP {order:$order}]->(g:Group {id:$id, name:$name, order:$order})
           RETURN g`,
          { stageId, id, name, order }
        );
        return { id, name, order };
      } finally {
        await session.close();
      }
    },
    syncStageGroups: async (_, { stageId, totalGroups }, context) => {
      requireOrganizer(context);
      const safeTotalGroups = Number(totalGroups);
      if (!Number.isInteger(safeTotalGroups) || safeTotalGroups <= 0) {
        throw new Error('BAD_REQUEST: totalGroups debe ser entero positivo');
      }
      const session = context.driver.session();
      try {
        const check = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (check.records.length === 0) throw new Error('NOT_FOUND: stage no existe');

        const existing = await session.run(
          `MATCH (s:Stage {id:$stageId})-[r:HAS_GROUP]->(g:Group)
           RETURN g
           ORDER BY r.order`,
          { stageId }
        );
        const existingGroups = existing.records.map((record) => record.get('g').properties);
        if (existingGroups.length > safeTotalGroups) {
          throw new Error('BAD_REQUEST: no se puede reducir grupos cuando ya existen más grupos persistidos');
        }

        for (let i = existingGroups.length; i < safeTotalGroups; i++) {
          const groupId = genId('g');
          const order = i + 1;
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             CREATE (s)-[:HAS_GROUP {order:$order}]->(g:Group {id:$id, name:$name, order:$order})
             RETURN g`,
            {
              stageId,
              id: groupId,
              name: `Grupo ${order}`,
              order,
            }
          );
        }

        const listed = await session.run(
          `MATCH (s:Stage {id:$stageId})-[r:HAS_GROUP]->(g:Group)
           RETURN g
           ORDER BY r.order`,
          { stageId }
        );
        return listed.records.map((record) => {
          const g = record.get('g').properties;
          return { id: g.id, name: g.name, order: Number(g.order) || 0 };
        });
      } finally {
        await session.close();
      }
    },
    addTeamToGroup: async (_, { groupId, teamId }, { driver }) => {
      const session = driver.session();
      try {
        await upsertCompetitorSnapshot(session, {
          competitorId: teamId,
          kind: 'team',
          displayName: `Equipo ${teamId}`,
          shortName: null,
          avatarUrl: null,
          badgeUrl: null,
        });
        await session.run(
          `MATCH (g:Group {id:$groupId}), (c:Competitor {id:$teamId})
           MERGE (g)-[:HAS_COMPETITOR]->(c)`,
          { groupId, teamId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    addCompetitorToGroup: async (_, {
      groupId,
      competitorId,
      kind,
      displayName,
      shortName,
      avatarUrl,
      badgeUrl,
    }, { driver }) => {
      const session = driver.session();
      try {
        await upsertCompetitorSnapshot(session, {
          competitorId,
          kind,
          displayName,
          shortName,
          avatarUrl,
          badgeUrl,
        });
        await session.run(
          `MATCH (g:Group {id:$groupId}), (c:Competitor {id:$competitorId})
           MERGE (g)-[:HAS_COMPETITOR]->(c)`,
          { groupId, competitorId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    assignInscriptionToGroup: async (_, { stageId, groupId, inscriptionId, tournamentId, displayName }, context) => {
      requireOrganizer(context);
      const iid = normalizeInscriptionId(inscriptionId);
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        const format = String(stageProps?.format || '').toLowerCase();
        if (format !== 'groups') throw new Error('BAD_REQUEST: la etapa no es de grupos');

        const groupR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_GROUP]->(g:Group {id:$groupId})
           RETURN g
           LIMIT 1`,
          { stageId, groupId }
        );
        if (groupR.records.length === 0) throw new Error('BAD_REQUEST: grupo no pertenece a la etapa');

        const dn = String(displayName || '').trim();
        if (!dn || isPlaceholderParticipantLabel(dn)) {
          throw new Error('BAD_REQUEST: displayName debe ser el nombre real del equipo');
        }

        const { teamsPerGroup } = deriveGroupsConfig(stageProps);
        if (teamsPerGroup > 0) {
          const countR = await session.run(
            `MATCH (:Group {id:$groupId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
             RETURN count(DISTINCT toString(i.inscriptionId)) AS count`,
            { groupId }
          );
          const count = Number(countR.records[0]?.get('count') || 0);
          if (count >= teamsPerGroup) throw new Error('GROUP_CAPACITY_REACHED');
        }

        const stageCap = deriveStageCapacity(stageProps);
        if (stageCap && stageCap > 0) {
          const stageCount = await countPhysicalAssignedInscriptionsOnStage(session, stageId, tournamentId);
          const existsInStageR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
             RETURN i LIMIT 1`,
            { stageId, tid: tournamentId, iid }
          );
          const alreadyInStage = existsInStageR.records.length > 0;
          if (!alreadyInStage && stageCount >= stageCap) throw new Error('STAGE_CAPACITY_REACHED');
        }

        await session.run(
          `MATCH (s:Stage {id:$stageId}), (g:Group {id:$groupId})
           MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           SET i.displayName = $displayName
           MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)
           MERGE (g)-[:HAS_ASSIGNED_INSCRIPTION]->(i)
           WITH s, i
           OPTIONAL MATCH (s)-[:HAS_GROUP]->(other:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i)
           WHERE other.id <> $groupId
           DELETE r`,
          {
            stageId,
            groupId,
            tid: tournamentId,
            iid,
            displayName,
          }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    unassignInscriptionFromGroup: async (_, { groupId, inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      const iid = normalizeInscriptionId(inscriptionId);
      const session = context.driver.session();
      try {
        await session.run(
          `MATCH (:Group {id:$groupId})-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { groupId, tid: tournamentId, iid }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    upsertCompetitor: async (_, {
      competitorId,
      kind,
      displayName,
      shortName,
      avatarUrl,
      badgeUrl,
    }, { driver }) => {
      const session = driver.session();
      try {
        const competitor = await upsertCompetitorSnapshot(session, {
          competitorId,
          kind,
          displayName,
          shortName,
          avatarUrl,
          badgeUrl,
        });
        return {
          id: competitor.id,
          kind: competitor.kind,
          displayName: competitor.displayName,
          shortName: competitor.shortName ?? null,
          avatarUrl: competitor.avatarUrl ?? null,
          badgeUrl: competitor.badgeUrl ?? null,
          source: competitor.source ?? null,
          updatedAt: competitor.updatedAt ?? null,
        };
      } finally {
        await session.close();
      }
    },
    ensureEliminationBracket: async (_, { stageId, totalSlots }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      const safeTotalSlots = Number(totalSlots);
      if (!Number.isInteger(safeTotalSlots) || safeTotalSlots <= 1) {
        throw new Error('BAD_REQUEST: totalSlots debe ser entero mayor a 1');
      }
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
          throw new Error('BAD_REQUEST: la etapa no es de eliminación');
        }

        const existingR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN COUNT(m) AS count`,
          { stageId }
        );
        const existingCount = Number(existingR.records[0]?.get('count') || 0);
        const requiredMatches = Math.ceil(safeTotalSlots / 2);
        for (let i = existingCount; i < requiredMatches; i++) {
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             CREATE (m:Match {
               id:$id,
               round:1,
               leg:1,
               slotIndex:$slotIndex,
               fixtureCode:$fixtureCode,
               groupId:null,
               homeInscriptionId:null,
               awayInscriptionId:null,
               homeDisplayName:null,
               awayDisplayName:null,
               homeTournamentId:null,
               awayTournamentId:null
             })
             CREATE (s)-[:HAS_MATCH]->(m)`,
            {
              stageId,
              id: genId('m'),
              slotIndex: i + 1,
              fixtureCode: eliminationFixtureCode(i + 1, 1),
            }
          );
        }

        const listed = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN m
           ORDER BY COALESCE(m.round, 1), COALESCE(m.slotIndex, 999), m.id`,
          { stageId }
        );
        return listed.records.map((record) => matchFromNeoProps(record.get('m').properties));
      } finally {
        await session.close();
      }
    },
    generateLeagueRoundRobin: async (_, { stageId, doubleRound, maxRounds }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId}) RETURN s LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'league') {
          throw new Error('BAD_REQUEST: la etapa no es de liga');
        }
        const n = await resolveFixtureParticipantCount(session, stageId, stageProps);
        if (!n || n < 2) {
          throw new Error(
            'BAD_REQUEST: no se pudo determinar el número de participantes (definí numParticipants en la etapa o asigná al menos dos inscripciones a la fase)'
          );
        }

        const single = singleRoundRobinSchedule(n);
        if (!validateSingleRoundRobin(single, n).ok) {
          throw new Error('INTERNAL: calendario inválido');
        }
        const fullSchedule = doubleRound ? doubleRoundRobinFromSingle(single) : single;
        const half = single.length;
        const maxR = maxRounds != null && Number.isInteger(Number(maxRounds)) && Number(maxRounds) > 0
          ? Math.min(Number(maxRounds), fullSchedule.length)
          : fullSchedule.length;
        const schedule = fullSchedule.slice(0, maxR);

        await deleteMatchesForStage(session, stageId);

        for (let r = 0; r < schedule.length; r += 1) {
          const roundNum = r + 1;
          const leg = doubleRound ? (roundNum <= half ? 1 : 2) : 1;
          const round = schedule[r];
          let slotIndex = 1;
          for (const p of round) {
            const id = genId('m');
            const code = `L${roundNum}-M${slotIndex}`;
            await session.run(
              `MATCH (s:Stage {id:$stageId})
               CREATE (m:Match {
                 id:$id,
                 round:$roundNum,
                 leg:$leg,
                 slotIndex:$slotIndex,
                 fixtureCode:$code,
                 groupId:null,
                 leagueHomeSeed:$lhs,
                 leagueAwaySeed:$las,
                 homeInscriptionId:null,
                 awayInscriptionId:null,
                 homeDisplayName:null,
                 awayDisplayName:null,
                 homeTournamentId:null,
                 awayTournamentId:null
               })
               CREATE (s)-[:HAS_MATCH]->(m)`,
              {
                stageId,
                id,
                roundNum,
                leg,
                slotIndex,
                code,
                lhs: p.homeSeed != null ? Number(p.homeSeed) : null,
                las: p.awaySeed != null ? Number(p.awaySeed) : null,
              }
            );
            slotIndex += 1;
          }
        }

        await hydrateLeagueMatchesFromSeeds(session, stageId);

        const listed = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN m
           ORDER BY COALESCE(m.round, 1), COALESCE(m.leg, 1), COALESCE(m.slotIndex, 999), m.id`,
          { stageId }
        );
        return listed.records.map((record) => matchFromNeoProps(record.get('m').properties));
      } finally {
        await session.close();
      }
    },
    generateSingleEliminationBracket: async (_, { stageId, doubleRound }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId}) RETURN s LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
          throw new Error('BAD_REQUEST: la etapa no es de eliminación');
        }
        const n = await resolveFixtureParticipantCount(session, stageId, stageProps);
        if (!n || n < 2) {
          throw new Error(
            'BAD_REQUEST: no se pudo determinar el número de participantes (definí numParticipants en la etapa o asigná al menos dos inscripciones a la fase)'
          );
        }
        const P = nextPowerOf2(n);
        const allSlots = eliminationMatchSlots(P);

        // Recortar rondas según numAdvancing del configJson.
        // Si numAdvancing > 1, solo se necesitan log2(P / numAdvancing) rondas.
        const stageCfg = parseJsonSafe(stageProps?.configJson) || {};
        const bracketCfg = resolveEliminationBracketConfig(stageCfg, Boolean(doubleRound));
        const numAdvancing = bracketCfg.numAdvancing;
        let slots = allSlots;
        if (numAdvancing > 1) {
          const maxRounds = Math.round(Math.log2(P / numAdvancing));
          if (maxRounds >= 1) slots = allSlots.filter(s => s.round <= maxRounds);
        }
        const maxRound = eliminationMaxRound(slots);

        await deleteMatchesForStage(session, stageId);

        for (const slot of slots) {
          const slotLegs = legsForEliminationSlot(slot.round, maxRound, bracketCfg);
          for (const leg of slotLegs) {
            const id = genId('m');
            const slotDouble = slotLegs.length > 1;
            const code = eliminationFixtureCode(slot.slotIndex, slot.round, leg, { doubleRound: slotDouble });
            await session.run(
              `MATCH (s:Stage {id:$stageId})
               CREATE (m:Match {
                 id:$id,
                 round:$round,
                 leg:$leg,
                 slotIndex:$slotIndex,
                 fixtureCode:$code,
                 matchKind:'bracket',
                 groupId:null,
                 leagueHomeSeed:null,
                 leagueAwaySeed:null,
                 homeInscriptionId:null,
                 awayInscriptionId:null,
                 homeDisplayName:null,
                 awayDisplayName:null,
                 homeTournamentId:null,
                 awayTournamentId:null
               })
               CREATE (s)-[:HAS_MATCH]->(m)`,
              {
                stageId,
                id,
                round: slot.round,
                leg,
                slotIndex: slot.slotIndex,
                code,
              }
            );
          }
        }

        if (shouldCreateThirdPlaceMatch(maxRound, bracketCfg)) {
          const id = genId('m');
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             CREATE (m:Match {
               id:$id,
               round:$round,
               leg:1,
               slotIndex:$slotIndex,
               fixtureCode:'3P',
               matchKind:'third_place',
               groupId:null,
               leagueHomeSeed:null,
               leagueAwaySeed:null,
               homeInscriptionId:null,
               awayInscriptionId:null,
               homeDisplayName:'Perdedor SF1',
               awayDisplayName:'Perdedor SF2',
               homeTournamentId:null,
               awayTournamentId:null
             })
             CREATE (s)-[:HAS_MATCH]->(m)`,
            { stageId, id, round: maxRound, slotIndex: THIRD_PLACE_SLOT_INDEX }
          );
        }

        await hydrateEliminationFirstRoundFromBracket(session, stageId);

        const listed = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN m
           ORDER BY COALESCE(m.round, 1), COALESCE(m.slotIndex, 999), COALESCE(m.leg, 1), m.id`,
          { stageId }
        );
        return listed.records.map((record) => matchFromNeoProps(record.get('m').properties));
      } finally {
        await session.close();
      }
    },
    trimEliminationBracketAfterRound: async (_, { stageId, tournamentId, lastRoundInclusive }, context) => {
      requireOrganizer(context);
      const L = Number(lastRoundInclusive);
      if (!Number.isFinite(L) || L < 1 || !Number.isInteger(L)) {
        throw new Error('BAD_REQUEST: lastRoundInclusive debe ser entero >= 1');
      }
      const session = context.driver.session();
      try {
        const chk = await session.run(
          `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { tid: tournamentId, stageId }
        );
        if (chk.records.length === 0) {
          throw new Error('BAD_REQUEST: stage no pertenece al torneo');
        }
        const props = chk.records[0].get('s').properties;
        if (String(props?.format || '').toLowerCase() !== 'elimination') {
          throw new Error('BAD_REQUEST: la etapa no es de eliminación');
        }
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE coalesce(toInteger(m.round), 1) > $last
           DETACH DELETE m`,
          { stageId, last: Math.trunc(L) }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    generateGroupsStageRoundRobin: async (_, { stageId, doubleRound, maxRounds }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId}) RETURN s LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'groups') {
          throw new Error('BAD_REQUEST: la etapa no es de grupos');
        }
        const { teamsPerGroup } = deriveGroupsConfig(stageProps);
        const groupsR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[hg:HAS_GROUP]->(g:Group)
           RETURN g, hg.order AS ord
           ORDER BY hg.order`,
          { stageId }
        );
        if (groupsR.records.length === 0) throw new Error('BAD_REQUEST: la etapa no tiene grupos');

        await deleteMatchesForStage(session, stageId);

        for (const record of groupsR.records) {
          const g = record.get('g').properties;
          const gid = g.id;
          const gOrder = Number(g.order) || 0;
          const assignedN = await countAssignedInscriptionsOnGroup(session, gid);
          const n = assignedN >= 2 ? assignedN : teamsPerGroup >= 2 ? teamsPerGroup : 0;
          if (n < 2) continue;

          const single = singleRoundRobinSchedule(n);
          if (!validateSingleRoundRobin(single, n).ok) continue;
          const fullSchedule = doubleRound ? doubleRoundRobinFromSingle(single) : single;
          const half = single.length;
          const maxR = maxRounds != null && Number.isInteger(Number(maxRounds)) && Number(maxRounds) > 0
            ? Math.min(Number(maxRounds), fullSchedule.length)
            : fullSchedule.length;
          const schedule = fullSchedule.slice(0, maxR);

          for (let r = 0; r < schedule.length; r += 1) {
            const roundNum = r + 1;
            const leg = doubleRound ? (roundNum <= half ? 1 : 2) : 1;
            const round = schedule[r];
            let slotIndex = 1;
            for (const p of round) {
              const id = genId('m');
              const code = `G${gOrder}-F${roundNum}-M${slotIndex}`;
              await session.run(
                `MATCH (s:Stage {id:$stageId}), (g:Group {id:$gid})
                 CREATE (m:Match {
                   id:$id,
                   round:$roundNum,
                   leg:$leg,
                   slotIndex:$slotIndex,
                   fixtureCode:$code,
                   groupId:$gid,
                   leagueHomeSeed:$lhs,
                   leagueAwaySeed:$las,
                   homeInscriptionId:null,
                   awayInscriptionId:null,
                   homeDisplayName:null,
                   awayDisplayName:null,
                   homeTournamentId:null,
                   awayTournamentId:null
                 })
                 CREATE (s)-[:HAS_MATCH]->(m)
                 CREATE (g)-[:HAS_MATCH]->(m)`,
                {
                  stageId,
                  gid,
                  id,
                  roundNum,
                  leg,
                  slotIndex,
                  code,
                  lhs: p.homeSeed != null ? Number(p.homeSeed) : null,
                  las: p.awaySeed != null ? Number(p.awaySeed) : null,
                }
              );
              slotIndex += 1;
            }
          }
        }

        await hydrateGroupRoundRobinMatchesFromSeeds(session, stageId);

        const outR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           RETURN m
           ORDER BY m.groupId, COALESCE(m.round, 1), COALESCE(m.leg, 1), COALESCE(m.slotIndex, 999), m.id`,
          { stageId }
        );
        if (outR.records.length === 0) {
          throw new Error(
            'BAD_REQUEST: no se generó ningún partido de grupo (cada grupo necesita al menos 2 equipos por asignación o teamsPerGroup en la config)'
          );
        }
        return outR.records.map((rec) => matchFromNeoProps(rec.get('m').properties));
      } finally {
        await session.close();
      }
    },
    assignInscriptionToMatchSlot: async (
      _,
      { stageId, matchId, slotRole, inscriptionId, tournamentId, displayName },
      context
    ) => {
      requireOrganizer(context);
      const iidNorm = normalizeInscriptionId(inscriptionId);
      const role = String(slotRole || '').toLowerCase();
      if (!['home', 'away'].includes(role)) throw new Error('BAD_REQUEST: slotRole inválido');
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId})
           RETURN s
           LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        const stageFmt = String(stageProps?.format || '').toLowerCase();
        if (!['elimination', 'league', 'groups'].includes(stageFmt)) {
          throw new Error('BAD_REQUEST: la etapa no admite partidos con slots');
        }
        const stageCap = deriveStageCapacity(stageProps);

        const matchR = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {id:$matchId})
           RETURN m
           LIMIT 1`,
          { stageId, matchId }
        );
        if (matchR.records.length === 0) throw new Error('BAD_REQUEST: match no pertenece a la etapa');

        if (!inscriptionId) {
          const clearField = role === 'home'
            ? `m.homeInscriptionId = null, m.homeDisplayName = null, m.homeTournamentId = null`
            : `m.awayInscriptionId = null, m.awayDisplayName = null, m.awayTournamentId = null`;
          await session.run(
            `MATCH (m:Match {id:$matchId})
             SET ${clearField}`,
            { matchId }
          );
          if (stageFmt === 'elimination') {
            await syncEliminationDoubleLegPair(session, stageId, stageProps, matchId);
          }
          return true;
        }

        const currentMatch = matchR.records[0].get('m').properties;
        const currentRound = Number(currentMatch.round ?? 1);
        const currentSlot = Number(currentMatch.slotIndex ?? 0);
        const duplicateR = await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE (toString(m.homeInscriptionId) = $iid OR toString(m.awayInscriptionId) = $iid)
             AND m.id <> $matchId
             AND NOT (toInteger(coalesce(m.round, 1)) = $round AND toInteger(coalesce(m.slotIndex, 0)) = $slot)
           RETURN m
           LIMIT 1`,
          { stageId, iid: iidNorm, matchId, round: currentRound, slot: currentSlot }
        );
        const alreadyInAnother = duplicateR.records.length > 0;
        if (alreadyInAnother) throw new Error('BAD_REQUEST: la inscripción ya está ubicada en otra llave');
        if (stageFmt === 'elimination' && iidNorm) {
          await assertEliminationPhysicalNotDuplicateElsewhere({
            session,
            driver: context.driver,
            stageId,
            matchId,
            round: currentRound,
            slotIndex: currentSlot,
            candidateInscriptionId: iidNorm,
            resolvePositionRefFn: resolvePositionRef,
          });
        }
        if (
          (role === 'home' && String(currentMatch.awayInscriptionId || '') === iidNorm) ||
          (role === 'away' && String(currentMatch.homeInscriptionId || '') === iidNorm)
        ) {
          throw new Error('BAD_REQUEST: la inscripción no puede ocupar ambos lados de la misma llave');
        }

        if (stageCap && stageCap > 0) {
          const stageCount = await countPhysicalAssignedInscriptionsOnStage(session, stageId, tournamentId);
          const idExistsR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
             WHERE toString(m.homeInscriptionId) = $iid OR toString(m.awayInscriptionId) = $iid
             RETURN m LIMIT 1`,
            { stageId, iid: iidNorm }
          );
          const idAlreadyInMatches = idExistsR.records.length > 0;
          const assigningSynthetic = isSyntheticSlotInscriptionId(iidNorm);
          if (!assigningSynthetic && !idAlreadyInMatches && stageCount >= stageCap) {
            throw new Error('STAGE_CAPACITY_REACHED');
          }
        }

        const setField = role === 'home'
          ? `m.homeInscriptionId = $iid, m.homeDisplayName = $displayName, m.homeTournamentId = $tid`
          : `m.awayInscriptionId = $iid, m.awayDisplayName = $displayName, m.awayTournamentId = $tid`;
        await session.run(
          `MATCH (m:Match {id:$matchId})
           SET ${setField}`,
          { matchId, iid: iidNorm, displayName: displayName || null, tid: tournamentId }
        );
        if (stageFmt === 'elimination' && inscriptionId) {
          await session.run(
            `MATCH (m:Match {id:$matchId})
             WITH m
             WHERE m.homeInscriptionId IS NOT NULL AND trim(toString(m.homeInscriptionId)) <> ''
               AND m.awayInscriptionId IS NOT NULL AND trim(toString(m.awayInscriptionId)) <> ''
             SET m.matchKind = 'bracket'`,
            { matchId }
          );
        }
        if (isPhysicalInscriptionId(iidNorm)) {
          const dn = String(displayName || '').trim();
          const safeDn = dn && !isPlaceholderParticipantLabel(dn) ? dn : null;
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
             SET i.displayName = coalesce($displayName, i.displayName)
             MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)`,
            { stageId, tid: tournamentId, iid: iidNorm, displayName: safeDn }
          );
        }
        if (stageFmt === 'elimination') {
          await syncEliminationDoubleLegPair(session, stageId, stageProps, matchId);
        }
        return true;
      } finally {
        await session.close();
      }
    },
    updateMatchScheduling: async (_, { stageId, matchId, round, leg, slotIndex }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const r = await session.run(
          `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {id:$matchId})
           RETURN s, m`,
          { stageId, matchId }
        );
        if (r.records.length === 0) throw new Error('BAD_REQUEST: partido no encontrado en la etapa');
        const stageFmt = String(r.records[0].get('s').properties?.format || '').toLowerCase();
        if (!['league', 'groups'].includes(stageFmt)) {
          throw new Error('BAD_REQUEST: solo liga o grupos admiten reordenar fechas');
        }
        const mprops = r.records[0].get('m').properties;
        const gid = mprops.groupId ?? null;
        const rNum = Number(round);
        const lNum = Number(leg);
        const siNum = Number(slotIndex);
        if (!Number.isFinite(rNum) || rNum < 1) throw new Error('BAD_REQUEST: round inválido');
        if (!Number.isFinite(lNum) || lNum < 1) throw new Error('BAD_REQUEST: leg inválido');
        if (!Number.isFinite(siNum) || siNum < 1) throw new Error('BAD_REQUEST: slotIndex inválido');

        let fixtureCode = mprops.fixtureCode ?? null;
        if (stageFmt === 'league') {
          fixtureCode = `L${rNum}-M${siNum}`;
        } else if (stageFmt === 'groups' && gid) {
          const gR = await session.run(`MATCH (g:Group {id:$gid}) RETURN g.order AS ord`, { gid });
          const ord = Number(gR.records[0]?.get('ord') ?? 0);
          fixtureCode = `G${ord}-F${rNum}-M${siNum}`;
        } else {
          throw new Error('BAD_REQUEST: partido de grupo sin groupId');
        }

        await session.run(
          `MATCH (m:Match {id:$matchId})
           SET m.round = $round, m.leg = $leg, m.slotIndex = $slotIndex, m.fixtureCode = $fixtureCode`,
          { matchId, round: rNum, leg: lNum, slotIndex: siNum, fixtureCode }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    createMatch: async (_, { stageId, groupId, homeTeamId, awayTeamId, round, leg, scheduledAt }, { driver }) => {
      const id = genId('m');
      const session = driver.session();
      try {
        await upsertCompetitorSnapshot(session, {
          competitorId: homeTeamId,
          kind: 'team',
          displayName: `Equipo ${homeTeamId}`,
          shortName: null,
          avatarUrl: null,
          badgeUrl: null,
        });
        await upsertCompetitorSnapshot(session, {
          competitorId: awayTeamId,
          kind: 'team',
          displayName: `Equipo ${awayTeamId}`,
          shortName: null,
          avatarUrl: null,
          badgeUrl: null,
        });
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           OPTIONAL MATCH (g:Group {id:$groupId})
           MATCH (home:Competitor {id:$homeTeamId})
           MATCH (away:Competitor {id:$awayTeamId})
           CREATE (m:Match {
             id:$id,
             round:$round,
             leg:$leg,
             scheduledAt:$scheduledAt,
             homeTeamId:$homeTeamId,
             awayTeamId:$awayTeamId
           })
           CREATE (s)-[:HAS_MATCH]->(m)
           FOREACH (_ IN CASE WHEN g IS NULL THEN [] ELSE [1] END | CREATE (g)-[:HAS_MATCH]->(m))
           CREATE (m)-[:HAS_COMPETITOR {role:'home'}]->(home)
           CREATE (m)-[:HAS_COMPETITOR {role:'away'}]->(away)
           RETURN m`,
          {
            stageId,
            groupId: groupId ?? null,
            id,
            round: round ?? null,
            leg: leg ?? null,
            scheduledAt: scheduledAt ?? null,
            homeTeamId,
            awayTeamId,
          }
        );
        return {
          id,
          round: round ?? null,
          leg: leg ?? null,
          scheduledAt: scheduledAt ?? null,
          homeTeamId,
          awayTeamId,
        };
      } finally {
        await session.close();
      }
    },
    addKey: async (_, { stageId, name, order }, { driver }) => {
      const id = genId('k');
      const session = driver.session();
      try {
        await session.run(
          `MATCH (s:Stage {id:$stageId})
           CREATE (s)-[:HAS_KEY {order:$order}]->(k:Key {id:$id, name:$name, order:$order})
           RETURN k`,
          { stageId, id, name, order }
        );
        return { id, name, order };
      } finally {
        await session.close();
      }
    },
    linkGroupToKey: async (_, { keyId, groupId }, { driver }) => {
      const session = driver.session();
      try {
        await session.run(
          `MATCH (k:Key {id:$keyId}), (g:Group {id:$groupId})
           MERGE (k)-[:HAS_GROUP]->(g)`,
          { keyId, groupId }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    hydrateEliminationFirstRoundFromRoster: async (_, { stageId }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageR = await session.run(
          `MATCH (s:Stage {id:$stageId}) RETURN s LIMIT 1`,
          { stageId }
        );
        if (stageR.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const stageProps = stageR.records[0].get('s').properties;
        if (String(stageProps?.format || '').toLowerCase() !== 'elimination') {
          throw new Error('BAD_REQUEST: la etapa no es de eliminación');
        }
        await hydrateEliminationFirstRoundFromBracket(session, stageId);
        return true;
      } finally {
        await session.close();
      }
    },
    assignInscriptionToStage: async (_, { stageId, inscriptionId, tournamentId, displayName, force, seedOrder }, context) => {
      requireOrganizer(context);
      const iid = normalizeInscriptionId(inscriptionId);
      const session = context.driver.session();
      try {
        const stageCheck = await session.run(
          `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage {id:$stageId})
           RETURN s LIMIT 1`,
          { tid: tournamentId, stageId }
        );
        if (stageCheck.records.length === 0) {
          throw new Error('BAD_REQUEST: stage no pertenece al torneo');
        }
        if (!force) {
          const initialCheck = await session.run(
            `MATCH (c:Competition)-[:HAS_STAGE]->(s:Stage {id:$stageId})
             OPTIONAL MATCH (c)-[:HAS_STAGE]->(other:Stage)-[:ADVANCES_TO]->(s)
             RETURN COUNT(other) AS incoming`,
            { stageId }
          );
          const incoming = Number(initialCheck.records[0]?.get('incoming') || 0);
          if (incoming > 0) {
            throw new Error('BAD_REQUEST: solo se puede asignar a una fase inicial');
          }
        }
        const stageProps = stageCheck.records[0].get('s').properties;
        const stageCapacity = deriveStageCapacity(stageProps);
        if (!force && stageCapacity && stageCapacity > 0) {
          const totalCount = await countPhysicalAssignedInscriptionsOnStage(session, stageId, tournamentId);
          const existsR = await session.run(
            `MATCH (:Stage {id:$stageId})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
             RETURN i LIMIT 1`,
            { stageId, tid: tournamentId, iid }
          );
          if (existsR.records.length === 0 && totalCount >= stageCapacity) {
            throw new Error('STAGE_CAPACITY_REACHED');
          }
        }
        if (isPhysicalInscriptionId(iid)) {
          const dn = String(displayName || '').trim();
          const safeDn = dn && !isPlaceholderParticipantLabel(dn) ? dn : null;
          const seed =
            seedOrder != null && Number.isFinite(Number(seedOrder)) ? Math.trunc(Number(seedOrder)) : null;
          await session.run(
            `MATCH (s:Stage {id:$stageId})
             MERGE (i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
             SET i.displayName = coalesce($displayName, i.displayName),
                 i.seedOrder = coalesce($seedOrder, i.seedOrder)
             MERGE (s)-[:HAS_ASSIGNED_INSCRIPTION]->(i)`,
            { stageId, tid: tournamentId, iid, displayName: safeDn, seedOrder: seed }
          );
        }
        return true;
      } finally {
        await session.close();
      }
    },
    unassignInscriptionFromStage: async (_, { stageId, inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      const iid = normalizeInscriptionId(inscriptionId);
      const session = context.driver.session();
      try {
        await session.run(
          `MATCH (:Stage {id:$stageId})-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { stageId, tid: tournamentId, iid }
        );
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_GROUP]->(:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { stageId, tid: tournamentId, iid }
        );
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE m.homeTournamentId = $tid AND m.homeInscriptionId = $iid
           SET m.homeTournamentId = null, m.homeInscriptionId = null, m.homeDisplayName = null`,
          { stageId, tid: tournamentId, iid }
        );
        await session.run(
          `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
           WHERE m.awayTournamentId = $tid AND m.awayInscriptionId = $iid
           SET m.awayTournamentId = null, m.awayInscriptionId = null, m.awayDisplayName = null`,
          { stageId, tid: tournamentId, iid }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    clearInscriptionAssignments: async (_, { inscriptionId, tournamentId }, context) => {
      requireOrganizer(context);
      const iid = normalizeInscriptionId(inscriptionId);
      const session = context.driver.session();
      try {
        await session.run(
          `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage)
           OPTIONAL MATCH (s)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { tid: tournamentId, iid }
        );
        await session.run(
          `MATCH (:Group)-[r:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef {tournamentId:$tid, inscriptionId:$iid})
           DELETE r`,
          { tid: tournamentId, iid }
        );
        await session.run(
          `MATCH (m:Match)
           WHERE m.homeTournamentId = $tid AND m.homeInscriptionId = $iid
           SET m.homeTournamentId = null, m.homeInscriptionId = null, m.homeDisplayName = null`,
          { tid: tournamentId, iid }
        );
        await session.run(
          `MATCH (m:Match)
           WHERE m.awayTournamentId = $tid AND m.awayInscriptionId = $iid
           SET m.awayTournamentId = null, m.awayInscriptionId = null, m.awayDisplayName = null`,
          { tid: tournamentId, iid }
        );
        return true;
      } finally {
        await session.close();
      }
    },
    updateMatchDateTime: async (_, { matchId, scheduledAt, venue, referee }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const matchR = await session.run(
          `MATCH (m:Match {id:$matchId}) RETURN m LIMIT 1`,
          { matchId }
        );
        if (matchR.records.length === 0) throw new Error('NOT_FOUND: match no existe');
        await session.run(
          `MATCH (m:Match {id:$matchId})
           SET m.scheduledAt = coalesce($scheduledAt, m.scheduledAt),
               m.venue = coalesce($venue, m.venue),
               m.referee = coalesce($referee, m.referee),
               m.updatedAt = $updatedAt`,
          {
            matchId,
            scheduledAt: scheduledAt ?? null,
            venue: venue ?? null,
            referee: referee ?? null,
            updatedAt: new Date().toISOString(),
          }
        );
        const updated = await session.run(
          `MATCH (m:Match {id:$matchId}) RETURN m LIMIT 1`,
          { matchId }
        );
        const mp = updated.records[0].get('m').properties;
        return {
          id: matchId,
          scheduledAt: mp.scheduledAt ?? null,
          venue: mp.venue ?? null,
          referee: mp.referee ?? null,
        };
      } finally {
        await session.close();
      }
    },
    setMatchWinnerAdvancement: async (_, { matchId, transitionId }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const stageMatch = await session.run(
          `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$matchId})
           RETURN s.id AS stageId, m
           LIMIT 1`,
          { matchId }
        );
        if (stageMatch.records.length === 0) {
          throw new Error('NOT_FOUND: match no existe o no está enlazado a una etapa');
        }
        const stageId = String(stageMatch.records[0].get('stageId') || '');
        const tidNorm = transitionId ? String(transitionId).trim() : '';
        if (!tidNorm) {
          await session.run(
            `MATCH (m:Match {id:$matchId})
             SET m.winnerAdvancementTransitionId = null`,
            { matchId }
          );
        } else {
          const trR = await session.run(
            `MATCH (s:Stage {id:$stageId})-[:EMITS|HAS_TRANSITION]->(tr:Transition {id:$tid})
             RETURN tr.id AS id LIMIT 1`,
            { stageId, tid: tidNorm }
          );
          if (trR.records.length === 0) {
            throw new Error('BAD_REQUEST: la transición no está emitida por la etapa de este partido');
          }
          await session.run(
            `MATCH (m:Match {id:$matchId})
             SET m.winnerAdvancementTransitionId = $tid`,
            { matchId, tid: tidNorm }
          );
        }
        const out = await session.run(
          `MATCH (m:Match {id:$matchId}) RETURN m LIMIT 1`,
          { matchId }
        );
        return matchFromNeoProps(out.records[0].get('m').properties);
      } finally {
        await session.close();
      }
    },
    setStageStatus: async (_, { stageId, status }, context) => {
      requireOrganizer(context);
      const allowed = ['not_started', 'active', 'finished'];
      if (!allowed.includes(status)) throw new Error(`BAD_REQUEST: status debe ser uno de ${allowed.join(', ')}`);
      const session = context.driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})
           SET s.stageStatus = $status
           RETURN s`,
          { id: stageId, status }
        );
        if (res.records.length === 0) throw new Error('NOT_FOUND: stage no existe');
        const s = res.records[0].get('s').properties;

        // Cascade: all stages finished → mark competition finished; all competitions finished → mark tournament finished
        if (status === 'finished') {
          await session.run(
            `MATCH (c:Competition)-[:HAS_STAGE]->(target:Stage {id: $stageId})
             MATCH (c)-[:HAS_STAGE]->(allS:Stage)
             WITH c, count(allS) AS total,
                  sum(CASE WHEN allS.stageStatus = 'finished' THEN 1 ELSE 0 END) AS done
             WHERE total > 0 AND total = done
             SET c.status = 'finished'
             WITH c
             MATCH (t:Tournament)-[:HAS_COMPETITION]->(c)
             WITH t
             MATCH (t)-[:HAS_COMPETITION]->(allC:Competition)
             WITH t, count(allC) AS totalC,
                  sum(CASE WHEN allC.status = 'finished' THEN 1 ELSE 0 END) AS doneC
             WHERE totalC > 0 AND totalC = doneC
             SET t.status = 'finished'`,
            { stageId }
          );
        }

        return {
          id: s.id,
          name: s.name,
          order: Number(s.order) || 0,
          format: s.format,
          configJson: s.configJson ?? null,
          childrenJson: s.childrenJson ?? null,
          stageStatus: s.stageStatus,
        };
      } finally {
        await session.close();
      }
    },
    updateMatchResult: async (_, { matchId, homeScore, awayScore, status }, context) => {
      requireOrganizer(context);
      const session = context.driver.session();
      try {
        const matchR = await session.run(
          `MATCH (m:Match {id:$matchId}) RETURN m LIMIT 1`,
          { matchId }
        );
        if (matchR.records.length === 0) throw new Error('NOT_FOUND: match no existe');
        const stageR = await session.run(
          `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$matchId}) RETURN s.id AS stageId LIMIT 1`,
          { matchId }
        );
        if (stageR.records.length > 0) {
          const effectiveStageStatus = await resolveEffectiveStageStatusForMatch(session, matchId);
          assertStageAllowsMatchResults(effectiveStageStatus);
        }
        const m = matchR.records[0].get('m').properties;
        const homeScoreNum = homeScore != null ? Number(homeScore) : null;
        const awayScoreNum = awayScore != null ? Number(awayScore) : null;
        if (homeScoreNum != null && (!Number.isInteger(homeScoreNum) || homeScoreNum < 0)) {
          throw new Error('BAD_REQUEST: homeScore debe ser entero no negativo');
        }
        if (awayScoreNum != null && (!Number.isInteger(awayScoreNum) || awayScoreNum < 0)) {
          throw new Error('BAD_REQUEST: awayScore debe ser entero no negativo');
        }
        // Normalizar 'completed'/'finished' → 'finished' para que computeStandings lo cuente.
        const rawStatus = status ?? m.status ?? 'scheduled';
        const rawLower = String(rawStatus).toLowerCase();
        const matchStatus = (rawLower === 'completed' || rawLower === 'finished') ? 'finished' : rawStatus;
        // COALESCE preserva scores existentes cuando el frontend envía null (el usuario no tocó los campos).
        await session.run(
          `MATCH (m:Match {id:$matchId})
           SET m.homeScore = coalesce($homeScore, m.homeScore),
               m.awayScore = coalesce($awayScore, m.awayScore),
               m.status = $status,
               m.matchStatus = $status,
               m.updatedAt = $updatedAt`,
          { matchId, homeScore: homeScoreNum, awayScore: awayScoreNum, status: matchStatus, updatedAt: new Date().toISOString() }
        );
        // Valores finales: si el usuario no envió score, usar el previo del nodo.
        const neoHomeScore = m.homeScore != null ? Number(m.homeScore) : null;
        const neoAwayScore = m.awayScore != null ? Number(m.awayScore) : null;
        const finalHomeScore = homeScoreNum != null ? homeScoreNum : neoHomeScore;
        const finalAwayScore = awayScoreNum != null ? awayScoreNum : neoAwayScore;

        // Auto-avance en bracket de eliminación
        if (matchStatus === 'finished') {
          const elimStageR = await session.run(
            `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$matchId})
             RETURN s.format AS format, s.id AS stageId LIMIT 1`,
            { matchId }
          );
          if (
            elimStageR.records.length > 0 &&
            String(elimStageR.records[0].get('format') || '').toLowerCase() === 'elimination'
          ) {
            const stageId = elimStageR.records[0].get('stageId');
            const curMatchR = await session.run(
              `MATCH (m:Match {id:$matchId})
               RETURN m.round AS round, m.slotIndex AS slotIndex, m.matchKind AS matchKind, m.fixtureCode AS fixtureCode LIMIT 1`,
              { matchId }
            );
            if (curMatchR.records.length > 0) {
              const round = Number(curMatchR.records[0].get('round') || 1);
              const slotIndex = Number(curMatchR.records[0].get('slotIndex') || 1);
              const curMatchMeta = {
                round,
                slotIndex,
                matchKind: curMatchR.records[0].get('matchKind'),
                fixtureCode: curMatchR.records[0].get('fixtureCode'),
              };
              const isThirdPlace = isThirdPlaceMatchProps(curMatchMeta);

              if (!isThirdPlace) {
              // Traer todas las patas del mismo slot (soporta double round)
              const allLegsR = await session.run(
                `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
                 WHERE m.round = $round AND m.slotIndex = $slotIndex
                 RETURN m
                 ORDER BY COALESCE(m.leg, 1), m.id`,
                { stageId, round, slotIndex }
              );
              const resolvedLegs = [];
              for (const rec of allLegsR.records) {
                const leg = matchFromNeoProps(rec.get('m').properties);
                await resolveMatchRefs(leg, context.driver);
                resolvedLegs.push(leg);
              }

              if (resolvedLegs.every((l) => isMatchFinishedStatus(l.status))) {
                const winner = await resolveEliminationSeriesWinnerFromResolvedLegs(
                  context.driver,
                  resolvedLegs
                );
                if (winner?.inscriptionId && winner.displayName) {
                  const persistable = findPersistableWinnerFromLegs(
                    {
                      inscriptionId: winner.inscriptionId,
                      displayName: winner.displayName,
                    },
                    resolvedLegs
                  );
                  const winnerId = isPhysicalInscriptionId(persistable?.inscriptionId ?? '')
                    ? persistable.inscriptionId
                    : winner.inscriptionId;
                  const winnerDisplay = persistable?.displayName ?? winner.displayName;
                  const winnerTournamentId = persistable?.tournamentId ?? null;

                  const legMatchIds = resolvedLegs.map((l) => l.id).filter(Boolean);
                  const winnerRefs = buildWinnerSlotRefs(String(stageId), legMatchIds);
                  const refTargets = await findRefBasedAdvanceTargets(session, stageId, winnerRefs);

                  async function persistWinnerToNextMatch(nextMatchId, role) {
                    const inscField = role === 'home' ? 'homeInscriptionId' : 'awayInscriptionId';
                    const displayField = role === 'home' ? 'homeDisplayName' : 'awayDisplayName';
                    const tidField = role === 'home' ? 'homeTournamentId' : 'awayTournamentId';
                    await session.run(
                      `MATCH (m:Match {id:$nextMatchId})
                       SET m.${inscField} = $iid, m.${displayField} = $dn, m.${tidField} = $tid`,
                      {
                        nextMatchId,
                        iid: winnerId,
                        dn: winnerDisplay,
                        tid: winnerTournamentId,
                      }
                    );
                  }

                  if (refTargets.length > 0) {
                    for (const target of refTargets) {
                      const role = resolveAdvanceRoleForLeg(target.side, target.leg);
                      await persistWinnerToNextMatch(target.nextMatchId, role);
                    }
                  } else {
                    const { nextRound, nextSlotIndex, isHomeInLeg1 } = defaultBracketAdvanceTarget(
                      round,
                      slotIndex
                    );

                    const nextMatchesR = await session.run(
                      `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
                       WHERE m.round = $nextRound AND m.slotIndex = $nextSlotIndex
                         AND coalesce(m.matchKind, 'bracket') <> 'third_place'
                       RETURN m.id AS id, COALESCE(m.leg, 1) AS leg`,
                      { stageId, nextRound, nextSlotIndex }
                    );
                    for (const nRec of nextMatchesR.records) {
                      const nextMatchId = nRec.get('id');
                      const nextLeg = Number(nRec.get('leg') || 1);
                      const putAsHome = nextLeg === 2 ? !isHomeInLeg1 : isHomeInLeg1;
                      await persistWinnerToNextMatch(nextMatchId, putAsHome ? 'home' : 'away');
                    }
                  }
                }
              }

              // Perdedor de semifinal → partido de tercer puesto (si está configurado)
              if (!isThirdPlace && resolvedLegs.every((l) => isMatchFinishedStatus(l.status))) {
                const stageCfgR = await session.run(
                  `MATCH (s:Stage {id:$stageId}) RETURN s.configJson AS cfg LIMIT 1`,
                  { stageId }
                );
                const stageCfg = parseJsonSafe(stageCfgR.records[0]?.get('cfg')) || {};
                const bracketCfg = resolveEliminationBracketConfig(stageCfg, false);
                const maxRoundR = await session.run(
                  `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
                   WHERE coalesce(m.matchKind, 'bracket') <> 'third_place'
                   RETURN max(coalesce(toInteger(m.round), 1)) AS maxRound`,
                  { stageId }
                );
                const maxRound = Number(maxRoundR.records[0]?.get('maxRound') || 0);
                const semiRound = maxRound - 1;
                if (
                  shouldCreateThirdPlaceMatch(maxRound, bracketCfg) &&
                  round === semiRound &&
                  (slotIndex === 1 || slotIndex === 2)
                ) {
                  const loserPick = await resolveEliminationSeriesLoserFromResolvedLegs(
                    context.driver,
                    resolvedLegs
                  );
                  if (loserPick?.displayName) {
                    const persistableLoser = findPersistableWinnerFromLegs(loserPick, resolvedLegs);
                    const loserId = isPhysicalInscriptionId(persistableLoser?.inscriptionId ?? '')
                      ? persistableLoser.inscriptionId
                      : loserPick.inscriptionId;
                    const loserDisplay = persistableLoser?.displayName ?? loserPick.displayName;
                    const loserTid = persistableLoser?.tournamentId ?? null;
                    const inscField = slotIndex === 1 ? 'homeInscriptionId' : 'awayInscriptionId';
                    const displayField = slotIndex === 1 ? 'homeDisplayName' : 'awayDisplayName';
                    const tidField = slotIndex === 1 ? 'homeTournamentId' : 'awayTournamentId';
                    await session.run(
                      `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {matchKind:'third_place'})
                       SET m.${inscField} = $iid, m.${displayField} = $dn, m.${tidField} = $tid`,
                      { stageId, iid: loserId, dn: loserDisplay, tid: loserTid }
                    );
                  }
                }
              }
              }
            }
          }
        }

        return {
          id: matchId,
          homeScore: finalHomeScore,
          awayScore: finalAwayScore,
          status: matchStatus,
        };
      } finally {
        await session.close();
      }
    },
  },
  Tournament: {
    competitions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (t:Tournament {id:$id})- [hc:HAS_COMPETITION]->(c:Competition)
           RETURN c ORDER BY hc.order`,
          { id: parent.id }
        );
        return res.records.map(r => {
          const c = r.get('c').properties;
          return { id: c.id, name: c.name, order: Number(c.order) || 0 };
        });
      } finally {
        await session.close();
      }
    }
  },
  Competition: {
    maxSlots: (parent) => (parent.maxSlots != null ? Number(parent.maxSlots) : null),
    effectiveMaxSlots: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        return await resolveCompetitionEffectiveMaxSlots(session, parent.id);
      } finally {
        await session.close();
      }
    },
    stages: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (c:Competition {id:$id})- [hs:HAS_STAGE]->(s:Stage)
           RETURN s ORDER BY hs.order`,
          { id: parent.id }
        );
        return res.records.map(r => {
          const s = r.get('s').properties;
          return {
            id: s.id,
            name: s.name,
            order: Number(s.order) || 0,
            format: s.format,
            configJson: s.configJson ?? null,
            childrenJson: s.childrenJson ?? null,
            stageStatus: s.stageStatus ?? null,
          };
        });
      } finally {
        await session.close();
      }
    }
  },
  Stage: {
    stageStatus: async (parent, _args, { driver }) => {
      if (parent.stageStatus != null) return parent.stageStatus;
      const session = driver.session();
      try {
        const inputs = await fetchStageStatusInputs(session, parent.id);
        if (inputs.sourceCount === 0 && inputs.persisted == null) {
          // Sin registro en Neo4j (p. ej. tests unitarios con parent parcial).
          return 'active';
        }
        return computeEffectiveStageStatus(inputs);
      } finally {
        await session.close();
      }
    },
    isInitial: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (c:Competition)-[:HAS_STAGE]->(s:Stage {id:$id})
           OPTIONAL MATCH (c)-[:HAS_STAGE]->(other:Stage)-[:ADVANCES_TO]->(s)
           RETURN COUNT(other) AS incoming`,
          { id: parent.id }
        );
        const incoming = Number(res.records[0]?.get('incoming') || 0);
        return incoming === 0;
      } finally {
        await session.close();
      }
    },
    assignedInscriptions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i ORDER BY coalesce(i.seedOrder, 999999), i.displayName, i.inscriptionId`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const i = r.get('i').properties;
          return {
            inscriptionId: i.inscriptionId,
            tournamentId: i.tournamentId,
            displayName: i.displayName ?? i.inscriptionId,
          };
        });
      } finally {
        await session.close();
      }
    },
    standings: async (parent, _args, { driver }) => {
      if (parent.format === 'elimination') return [];
      const session = driver.session();
      try {
        const inscriptionsResult = await session.run(
          `MATCH (s:Stage {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i.inscriptionId AS inscriptionId, i.displayName AS displayName
           ORDER BY i.displayName, i.inscriptionId`,
          { id: parent.id }
        );
        const inscriptions = inscriptionsResult.records.map((record) => ({
          inscriptionId: record.get('inscriptionId'),
          displayName: record.get('displayName'),
        }));

        const matchesResult = await session.run(
          `MATCH (s:Stage {id:$id})-[:HAS_MATCH]->(m:Match)
           RETURN m.homeInscriptionId AS homeInscriptionId,
                  m.awayInscriptionId AS awayInscriptionId,
                  m.homeDisplayName AS homeDisplayName,
                  m.awayDisplayName AS awayDisplayName,
                  m.homeScore AS homeScore,
                  m.awayScore AS awayScore,
                  m.status AS status,
                  coalesce(m.status, m.matchStatus, 'scheduled') AS matchStatus`,
          { id: parent.id }
        );
        const matches = matchesResult.records.map((record) => ({
          homeInscriptionId: record.get('homeInscriptionId'),
          awayInscriptionId: record.get('awayInscriptionId'),
          homeDisplayName: record.get('homeDisplayName'),
          awayDisplayName: record.get('awayDisplayName'),
          homeScore: record.get('homeScore'),
          awayScore: record.get('awayScore'),
          status: record.get('status'),
          matchStatus: record.get('matchStatus'),
        }));

        return computeStandings(matches, inscriptions);
      } finally {
        await session.close();
      }
    },
    transitions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        // Solo EMITS: cada transición tiene EMITS y a veces HAS_TRANSITION desde la misma etapa; evitar filas duplicadas.
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:EMITS]->(tr:Transition)
           OPTIONAL MATCH (tr)-[:TO_STAGE]->(dst:Stage)
           RETURN tr, dst`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const t = r.get('tr').properties;
          const dst = r.get('dst')?.properties || null;
          return mapTransitionGraphql(t, dst);
        });
      } finally {
        await session.close();
      }
    },
    groups: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[hg:HAS_GROUP]->(g:Group)
           RETURN g ORDER BY hg.order`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const g = r.get('g').properties;
          return {
            id: g.id,
            name: g.name,
            order: Number(g.order) || 0,
          };
        });
      } finally {
        await session.close();
      }
    },
    keys: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[hk:HAS_KEY]->(k:Key)
           RETURN k ORDER BY hk.order`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const k = r.get('k').properties;
          return {
            id: k.id,
            name: k.name,
            order: Number(k.order) || 0,
          };
        });
      } finally {
        await session.close();
      }
    },
    matches: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (s:Stage {id:$id})-[:HAS_MATCH]->(m:Match)
           RETURN m ORDER BY COALESCE(m.round, 1), COALESCE(m.leg, 1), COALESCE(m.slotIndex, 999), m.id`,
          { id: parent.id }
        );
        const matches = res.records.map((r) => matchFromNeoProps(r.get('m').properties));
        await Promise.all(matches.map((m) => resolveMatchRefs(m, driver)));
        return matches;
      } finally {
        await session.close();
      }
    },
  },
  Group: {
    competitorIds: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_COMPETITOR]->(c:Competitor)
           RETURN c.id AS cid ORDER BY c.id`,
          { id: parent.id }
        );
        return res.records.map((r) => r.get('cid'));
      } finally {
        await session.close();
      }
    },
    competitors: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_COMPETITOR]->(c:Competitor)
           RETURN c ORDER BY c.displayName, c.id`,
          { id: parent.id }
        );
        return res.records.map((r) => {
          const c = r.get('c').properties;
          return {
            id: c.id,
            kind: c.kind ?? 'team',
            displayName: c.displayName ?? c.id,
            shortName: c.shortName ?? null,
            avatarUrl: c.avatarUrl ?? null,
            badgeUrl: c.badgeUrl ?? null,
            source: c.source ?? null,
            updatedAt: c.updatedAt ?? null,
          };
        });
      } finally {
        await session.close();
      }
    },
    assignedInscriptions: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i
           ORDER BY i.displayName, i.inscriptionId`,
          { id: parent.id }
        );
        return res.records.map((record) => {
          const i = record.get('i').properties;
          return {
            inscriptionId: i.inscriptionId,
            tournamentId: i.tournamentId,
            displayName: i.displayName ?? i.inscriptionId,
          };
        });
      } finally {
        await session.close();
      }
    },
    standings: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const inscriptionsResult = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
           RETURN i.inscriptionId AS inscriptionId, i.displayName AS displayName
           ORDER BY i.displayName, i.inscriptionId`,
          { id: parent.id }
        );
        const inscriptions = inscriptionsResult.records.map((record) => ({
          inscriptionId: record.get('inscriptionId'),
          displayName: record.get('displayName'),
        }));

        const matchesResult = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_MATCH]->(m:Match)
           RETURN m.homeInscriptionId AS homeInscriptionId,
                  m.awayInscriptionId AS awayInscriptionId,
                  m.homeDisplayName AS homeDisplayName,
                  m.awayDisplayName AS awayDisplayName,
                  m.homeScore AS homeScore,
                  m.awayScore AS awayScore,
                  m.status AS status,
                  coalesce(m.status, m.matchStatus, 'scheduled') AS matchStatus`,
          { id: parent.id }
        );
        const matches = matchesResult.records.map((record) => ({
          homeInscriptionId: record.get('homeInscriptionId'),
          awayInscriptionId: record.get('awayInscriptionId'),
          homeDisplayName: record.get('homeDisplayName'),
          awayDisplayName: record.get('awayDisplayName'),
          homeScore: record.get('homeScore'),
          awayScore: record.get('awayScore'),
          status: record.get('status'),
          matchStatus: record.get('matchStatus'),
        }));

        return computeStandings(matches, inscriptions);
      } finally {
        await session.close();
      }
    },
    capacity: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (:Stage)-[:HAS_GROUP]->(g:Group {id:$id})
           RETURN g LIMIT 1`,
          { id: parent.id }
        );
        if (res.records.length === 0) return null;
        const group = res.records[0].get('g').properties;
        if (group.capacity != null) return Number(group.capacity);

        const cfgR = await session.run(
          `MATCH (:Stage)-[:HAS_GROUP]->(g:Group {id:$id})<-[:HAS_GROUP]-(s:Stage)
           RETURN s
           LIMIT 1`,
          { id: parent.id }
        );
        if (cfgR.records.length === 0) return null;
        const stageProps = cfgR.records[0].get('s').properties;
        const { teamsPerGroup } = deriveGroupsConfig(stageProps);
        return teamsPerGroup > 0 ? teamsPerGroup : null;
      } finally {
        await session.close();
      }
    },
    matches: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (g:Group {id:$id})-[:HAS_MATCH]->(m:Match)
           RETURN m ORDER BY COALESCE(m.round, 1), COALESCE(m.leg, 1), COALESCE(m.slotIndex, 999), m.id`,
          { id: parent.id }
        );
        const matches = res.records.map((r) => matchFromNeoProps(r.get('m').properties));
        await Promise.all(matches.map((m) => resolveMatchRefs(m, driver)));
        return matches;
      } finally {
        await session.close();
      }
    },
  },
  Match: {
    matchKind: (parent) => (parent.matchKind != null ? String(parent.matchKind) : null),
    homeCompetitor: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        // Primero intentar por relación HAS_COMPETITOR (modelo legacy de createMatch)
        const res = await session.run(
          `MATCH (m:Match {id:$id})-[:HAS_COMPETITOR {role:'home'}]->(c:Competitor)
           RETURN c LIMIT 1`,
          { id: parent.id }
        );
        if (res.records.length > 0) {
          const c = res.records[0].get('c').properties;
          return {
            id: c.id,
            kind: c.kind ?? 'team',
            displayName: c.displayName ?? c.id,
            shortName: c.shortName ?? null,
            avatarUrl: c.avatarUrl ?? null,
            badgeUrl: c.badgeUrl ?? null,
            source: c.source ?? null,
            updatedAt: c.updatedAt ?? null,
          };
        }
        // Fallback: resolver desde InscriptionRef (modelo de generateLeagueRoundRobin, etc.)
        if (parent.homeInscriptionId) {
          const ir = await session.run(
            `MATCH (i:InscriptionRef {inscriptionId:$iid})
             RETURN i LIMIT 1`,
            { iid: String(parent.homeInscriptionId) }
          );
          if (ir.records.length > 0) {
            const i = ir.records[0].get('i').properties;
            return {
              id: String(i.inscriptionId),
              kind: 'team',
              displayName: i.displayName ?? String(i.inscriptionId),
              shortName: null,
              avatarUrl: null,
              badgeUrl: null,
              source: 'inscription-ref',
              updatedAt: null,
            };
          }
        }
        return null;
      } finally {
        await session.close();
      }
    },
    awayCompetitor: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (m:Match {id:$id})-[:HAS_COMPETITOR {role:'away'}]->(c:Competitor)
           RETURN c LIMIT 1`,
          { id: parent.id }
        );
        if (res.records.length > 0) {
          const c = res.records[0].get('c').properties;
          return {
            id: c.id,
            kind: c.kind ?? 'team',
            displayName: c.displayName ?? c.id,
            shortName: c.shortName ?? null,
            avatarUrl: c.avatarUrl ?? null,
            badgeUrl: c.badgeUrl ?? null,
            source: c.source ?? null,
            updatedAt: c.updatedAt ?? null,
          };
        }
        if (parent.awayInscriptionId) {
          const ir = await session.run(
            `MATCH (i:InscriptionRef {inscriptionId:$iid})
             RETURN i LIMIT 1`,
            { iid: String(parent.awayInscriptionId) }
          );
          if (ir.records.length > 0) {
            const i = ir.records[0].get('i').properties;
            return {
              id: String(i.inscriptionId),
              kind: 'team',
              displayName: i.displayName ?? String(i.inscriptionId),
              shortName: null,
              avatarUrl: null,
              badgeUrl: null,
              source: 'inscription-ref',
              updatedAt: null,
            };
          }
        }
        return null;
      } finally {
        await session.close();
      }
    },
    homeAssignedInscription: (parent) => {
      if (!parent.homeInscriptionId) return null;
      return {
        inscriptionId: String(parent.homeInscriptionId),
        tournamentId: parent.homeTournamentId ?? '',
        displayName: parent.homeDisplayName ?? String(parent.homeInscriptionId),
      };
    },
    awayAssignedInscription: (parent) => {
      if (!parent.awayInscriptionId) return null;
      return {
        inscriptionId: String(parent.awayInscriptionId),
        tournamentId: parent.awayTournamentId ?? '',
        displayName: parent.awayDisplayName ?? String(parent.awayInscriptionId),
      };
    },
  },
  Key: {
    groupIds: async (parent, _args, { driver }) => {
      const session = driver.session();
      try {
        const res = await session.run(
          `MATCH (k:Key {id:$id})-[:HAS_GROUP]->(g:Group)
           RETURN g.id AS gid ORDER BY g.id`,
          { id: parent.id }
        );
        return res.records.map((r) => r.get('gid'));
      } finally {
        await session.close();
      }
    },
  }
};

async function waitForNeo4jConnection(driver, maxAttempts = 20, delayMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await driver.getServerInfo();
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function bootstrap() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD));
  await waitForNeo4jConnection(driver);

  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  app.use(httpLogger);

  // Health endpoint
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const schema = buildSubgraphSchema({ typeDefs, resolvers });
  const server = new ApolloServer({ schema });
  await server.start();

  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({
      driver,
      headers: {
        authorization: req.headers.authorization || '',
      },
    }),
  }));

  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'running');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'fatal error');
  process.exit(1);
});



