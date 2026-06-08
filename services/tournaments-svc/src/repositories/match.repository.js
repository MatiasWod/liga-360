/** Acceso a datos de Match en Neo4j. El mapeo de nodo→objeto usa matchFromNeoProps. */
import { matchFromNeoProps } from '../domain/match/matchUtils.js';

const ORDER_STAGE = 'ORDER BY COALESCE(m.round, 1), COALESCE(m.leg, 1), COALESCE(m.slotIndex, 999), m.id';

export async function findByStage(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$id})-[:HAS_MATCH]->(m:Match)
     RETURN m ${ORDER_STAGE}`,
    { id: stageId }
  );
  return res.records.map((r) => matchFromNeoProps(r.get('m').properties));
}

export async function findByGroup(session, groupId) {
  const res = await session.run(
    `MATCH (g:Group {id:$id})-[:HAS_MATCH]->(m:Match)
     RETURN m ${ORDER_STAGE}`,
    { id: groupId }
  );
  return res.records.map((r) => matchFromNeoProps(r.get('m').properties));
}

export async function findRawById(session, matchId) {
  const r = await session.run('MATCH (m:Match {id:$id}) RETURN m LIMIT 1', { id: matchId });
  if (r.records.length === 0) return null;
  return r.records[0].get('m').properties;
}

export async function findById(session, matchId) {
  const props = await findRawById(session, matchId);
  return props ? matchFromNeoProps(props) : null;
}

export async function findStageIdForMatch(session, matchId) {
  const r = await session.run(
    `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$id}) RETURN s.id AS stageId LIMIT 1`,
    { id: matchId }
  );
  return r.records[0]?.get('stageId') ?? null;
}

export async function findStageMetaForMatch(session, matchId) {
  const r = await session.run(
    `MATCH (s:Stage)-[:HAS_MATCH]->(m:Match {id:$id})
     RETURN s.id AS stageId, s.format AS format LIMIT 1`,
    { id: matchId }
  );
  if (r.records.length === 0) return null;
  return { stageId: r.records[0].get('stageId'), format: r.records[0].get('format') };
}

export async function findInStage(session, stageId, matchId) {
  const r = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {id:$matchId})
     RETURN m LIMIT 1`,
    { stageId, matchId }
  );
  if (r.records.length === 0) return null;
  return r.records[0].get('m').properties;
}

export async function findInStageWithStage(session, stageId, matchId) {
  const r = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {id:$matchId})
     RETURN s, m`,
    { stageId, matchId }
  );
  if (r.records.length === 0) return null;
  return { stage: r.records[0].get('s').properties, match: r.records[0].get('m').properties };
}

export async function countByStage(session, stageId) {
  const r = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match) RETURN COUNT(m) AS count`,
    { stageId }
  );
  return Number(r.records[0]?.get('count') || 0);
}

export async function deleteByStage(session, stageId) {
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match) DETACH DELETE m`,
    { stageId }
  );
}

export async function trimAfterRound(session, stageId, lastRoundInclusive) {
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(toInteger(m.round), 1) > $last
     DETACH DELETE m`,
    { stageId, last: Math.trunc(lastRoundInclusive) }
  );
}

/** Lista de partidos de la etapa (eliminación) ordenada como devuelve ensureEliminationBracket. */
export async function listEliminationOrdered(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     RETURN m
     ORDER BY COALESCE(m.round, 1), COALESCE(m.slotIndex, 999), COALESCE(m.leg, 1), m.id`,
    { stageId }
  );
  return res.records.map((record) => matchFromNeoProps(record.get('m').properties));
}

/** Lista ordenada incluyendo groupId primero (para generateGroupsStageRoundRobin). */
export async function listByStageGroupedOrdered(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     RETURN m
     ORDER BY m.groupId, COALESCE(m.round, 1), COALESCE(m.leg, 1), COALESCE(m.slotIndex, 999), m.id`,
    { stageId }
  );
  return res.records.map((record) => matchFromNeoProps(record.get('m').properties));
}

export async function createEliminationEmpty(session, { stageId, id, slotIndex, fixtureCode }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     CREATE (m:Match {
       id:$id, round:1, leg:1, slotIndex:$slotIndex, fixtureCode:$fixtureCode,
       groupId:null, homeInscriptionId:null, awayInscriptionId:null,
       homeDisplayName:null, awayDisplayName:null, homeTournamentId:null, awayTournamentId:null
     })
     CREATE (s)-[:HAS_MATCH]->(m)`,
    { stageId, id, slotIndex, fixtureCode }
  );
}

export async function createEliminationSlot(session, { stageId, id, round, leg, slotIndex, code }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     CREATE (m:Match {
       id:$id, round:$round, leg:$leg, slotIndex:$slotIndex, fixtureCode:$code,
       matchKind:'bracket', groupId:null, leagueHomeSeed:null, leagueAwaySeed:null,
       homeInscriptionId:null, awayInscriptionId:null,
       homeDisplayName:null, awayDisplayName:null, homeTournamentId:null, awayTournamentId:null
     })
     CREATE (s)-[:HAS_MATCH]->(m)`,
    { stageId, id, round, leg, slotIndex, code }
  );
}

export async function createThirdPlace(session, { stageId, id, round, slotIndex }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     CREATE (m:Match {
       id:$id, round:$round, leg:1, slotIndex:$slotIndex, fixtureCode:'3P',
       matchKind:'third_place', groupId:null, leagueHomeSeed:null, leagueAwaySeed:null,
       homeInscriptionId:null, awayInscriptionId:null,
       homeDisplayName:'Perdedor SF1', awayDisplayName:'Perdedor SF2',
       homeTournamentId:null, awayTournamentId:null
     })
     CREATE (s)-[:HAS_MATCH]->(m)`,
    { stageId, id, round, slotIndex }
  );
}

export async function createLeague(session, { stageId, id, roundNum, leg, slotIndex, code, lhs, las }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     CREATE (m:Match {
       id:$id, round:$roundNum, leg:$leg, slotIndex:$slotIndex, fixtureCode:$code,
       groupId:null, leagueHomeSeed:$lhs, leagueAwaySeed:$las,
       homeInscriptionId:null, awayInscriptionId:null,
       homeDisplayName:null, awayDisplayName:null, homeTournamentId:null, awayTournamentId:null
     })
     CREATE (s)-[:HAS_MATCH]->(m)`,
    { stageId, id, roundNum, leg, slotIndex, code, lhs, las }
  );
}

export async function createGroup(session, { stageId, gid, id, roundNum, leg, slotIndex, code, lhs, las }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId}), (g:Group {id:$gid})
     CREATE (m:Match {
       id:$id, round:$roundNum, leg:$leg, slotIndex:$slotIndex, fixtureCode:$code,
       groupId:$gid, leagueHomeSeed:$lhs, leagueAwaySeed:$las,
       homeInscriptionId:null, awayInscriptionId:null,
       homeDisplayName:null, awayDisplayName:null, homeTournamentId:null, awayTournamentId:null
     })
     CREATE (s)-[:HAS_MATCH]->(m)
     CREATE (g)-[:HAS_MATCH]->(m)`,
    { stageId, gid, id, roundNum, leg, slotIndex, code, lhs, las }
  );
}

/** Setea ambos lados (y opcionalmente matchKind) de un partido por sus seeds hidratados. */
export async function setParticipants(session, id, { home, away, matchKind }) {
  const setKind = matchKind !== undefined ? ', m.matchKind = $matchKind' : '';
  await session.run(
    `MATCH (m:Match {id:$id})
     SET m.homeInscriptionId = $hid,
         m.homeDisplayName = $hdn,
         m.homeTournamentId = $htid,
         m.awayInscriptionId = $aid,
         m.awayDisplayName = $adn,
         m.awayTournamentId = $atid${setKind}`,
    {
      id,
      hid: home?.inscriptionId ?? null,
      hdn: home?.displayName ?? null,
      htid: home?.tournamentId ?? null,
      aid: away?.inscriptionId ?? null,
      adn: away?.displayName ?? null,
      atid: away?.tournamentId ?? null,
      matchKind: matchKind ?? null,
    }
  );
}

export async function updateScheduling(session, matchId, round, leg, slotIndex, fixtureCode) {
  await session.run(
    `MATCH (m:Match {id:$matchId})
     SET m.round = $round, m.leg = $leg, m.slotIndex = $slotIndex, m.fixtureCode = $fixtureCode`,
    { matchId, round, leg, slotIndex, fixtureCode }
  );
}

export async function updateDateTime(session, matchId, scheduledAt, venue, referee) {
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
}

export async function setAdvancement(session, matchId, transitionId) {
  await session.run(
    `MATCH (m:Match {id:$matchId})
     SET m.winnerAdvancementTransitionId = $tid`,
    { matchId, tid: transitionId ?? null }
  );
}

export async function updateResultScores(session, matchId, homeScore, awayScore, status) {
  await session.run(
    `MATCH (m:Match {id:$matchId})
     SET m.homeScore = coalesce($homeScore, m.homeScore),
         m.awayScore = coalesce($awayScore, m.awayScore),
         m.status = $status,
         m.matchStatus = $status,
         m.updatedAt = $updatedAt`,
    { matchId, homeScore, awayScore, status, updatedAt: new Date().toISOString() }
  );
}

// --- Asignación de slots (assignInscriptionToMatchSlot) ---

export async function clearSlot(session, matchId, role) {
  const clearField = role === 'home'
    ? 'm.homeInscriptionId = null, m.homeDisplayName = null, m.homeTournamentId = null'
    : 'm.awayInscriptionId = null, m.awayDisplayName = null, m.awayTournamentId = null';
  await session.run(`MATCH (m:Match {id:$matchId}) SET ${clearField}`, { matchId });
}

export async function setSlot(session, matchId, role, iid, displayName, tournamentId) {
  const setField = role === 'home'
    ? 'm.homeInscriptionId = $iid, m.homeDisplayName = $displayName, m.homeTournamentId = $tid'
    : 'm.awayInscriptionId = $iid, m.awayDisplayName = $displayName, m.awayTournamentId = $tid';
  await session.run(
    `MATCH (m:Match {id:$matchId}) SET ${setField}`,
    { matchId, iid, displayName: displayName || null, tid: tournamentId }
  );
}

export async function existsInscriptionInOtherKey(session, stageId, iid, matchId, round, slot) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE (toString(m.homeInscriptionId) = $iid OR toString(m.awayInscriptionId) = $iid)
       AND m.id <> $matchId
       AND NOT (toInteger(coalesce(m.round, 1)) = $round AND toInteger(coalesce(m.slotIndex, 0)) = $slot)
     RETURN m LIMIT 1`,
    { stageId, iid, matchId, round, slot }
  );
  return r.records.length > 0;
}

export async function existsInscriptionInStageMatches(session, stageId, iid) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE toString(m.homeInscriptionId) = $iid OR toString(m.awayInscriptionId) = $iid
     RETURN m LIMIT 1`,
    { stageId, iid }
  );
  return r.records.length > 0;
}

export async function markBracketIfBothAssigned(session, matchId) {
  await session.run(
    `MATCH (m:Match {id:$matchId})
     WITH m
     WHERE m.homeInscriptionId IS NOT NULL AND trim(toString(m.homeInscriptionId)) <> ''
       AND m.awayInscriptionId IS NOT NULL AND trim(toString(m.awayInscriptionId)) <> ''
     SET m.matchKind = 'bracket'`,
    { matchId }
  );
}

/** Partidos del mismo slot/ronda (todas las piernas), ordenados por leg. */
export async function findLegsByRoundSlot(session, stageId, round, slotIndex) {
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.round = $round AND m.slotIndex = $slotIndex
     RETURN m
     ORDER BY COALESCE(m.leg, 1), m.id`,
    { stageId, round, slotIndex }
  );
  return res.records.map((rec) => matchFromNeoProps(rec.get('m').properties));
}

/** Partido legado creado con relaciones HAS_COMPETITOR (mutation createMatch). */
export async function createLegacyMatch(session, { stageId, groupId, id, round, leg, scheduledAt, homeTeamId, awayTeamId }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     OPTIONAL MATCH (g:Group {id:$groupId})
     MATCH (home:Competitor {id:$homeTeamId})
     MATCH (away:Competitor {id:$awayTeamId})
     CREATE (m:Match {
       id:$id, round:$round, leg:$leg, scheduledAt:$scheduledAt,
       homeTeamId:$homeTeamId, awayTeamId:$awayTeamId
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
}

/** Partidos de la siguiente ronda/slot del bracket (excluye tercer puesto). */
export async function findNextBracketMatches(session, stageId, nextRound, nextSlotIndex) {
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE m.round = $nextRound AND m.slotIndex = $nextSlotIndex
       AND coalesce(m.matchKind, 'bracket') <> 'third_place'
     RETURN m.id AS id, COALESCE(m.leg, 1) AS leg`,
    { stageId, nextRound, nextSlotIndex }
  );
  return res.records.map((r) => ({ id: r.get('id'), leg: Number(r.get('leg') || 1) }));
}

/** Ronda máxima del bracket, excluyendo el partido de tercer puesto. */
export async function maxBracketRound(session, stageId) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(m.matchKind, 'bracket') <> 'third_place'
     RETURN max(coalesce(toInteger(m.round), 1)) AS maxRound`,
    { stageId }
  );
  return Number(r.records[0]?.get('maxRound') || 0);
}

/** Setea un lado del partido de tercer puesto de la etapa. */
export async function setThirdPlaceParticipant(session, stageId, role, { iid, displayName, tournamentId }) {
  const inscField = role === 'home' ? 'homeInscriptionId' : 'awayInscriptionId';
  const displayField = role === 'home' ? 'homeDisplayName' : 'awayDisplayName';
  const tidField = role === 'home' ? 'homeTournamentId' : 'awayTournamentId';
  await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match {matchKind:'third_place'})
     SET m.${inscField} = $iid, m.${displayField} = $dn, m.${tidField} = $tid`,
    { stageId, iid, dn: displayName, tid: tournamentId }
  );
}

export async function getMatchAdvanceMeta(session, matchId) {
  const r = await session.run(
    `MATCH (m:Match {id:$matchId})
     RETURN m.round AS round, m.slotIndex AS slotIndex, m.matchKind AS matchKind, m.fixtureCode AS fixtureCode LIMIT 1`,
    { matchId }
  );
  if (r.records.length === 0) return null;
  return {
    round: Number(r.records[0].get('round') || 1),
    slotIndex: Number(r.records[0].get('slotIndex') || 1),
    matchKind: r.records[0].get('matchKind'),
    fixtureCode: r.records[0].get('fixtureCode'),
  };
}
