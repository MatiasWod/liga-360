/**
 * Acceso a datos de resolución de referencias de posición/ganador a equipos reales sobre Neo4j.
 *
 * Las referencias dinámicas (`pos:*`, `liga360-slot:*`) se materializan a nombre/ID de equipo
 * leyendo standings de grupos/liga y ganadores de llaves de eliminación. La lógica pura de
 * selección de ganador/perdedor vive en domain/match/seriesResult.js.
 */
import { logger } from '../logger.js';
import {
  isPlaceholderParticipantLabel,
  isPhysicalInscriptionId,
  pickPhysicalStandingsRow,
} from '../domain/shared/participantLabels.js';
import {
  matchFromNeoProps,
  isMatchFinishedStatus,
  isWinnerSlotRef,
  parseWinnerSlotRef,
  applyResolvedSlot,
} from '../domain/match/matchUtils.js';
import {
  aggregateEliminationSeriesScores,
  pickSeriesWinnerFromScoreMap,
} from '../domain/elimination/bracketElimination.js';
import { computeStandings } from '../domain/standings/standings.js';
import {
  findPersistableWinnerFromLegs,
  resolveFinishedMatchLoserFromResolvedLeg,
} from '../domain/match/seriesResult.js';

/**
 * Resuelve los position refs (liga360-slot:/pos:) en los slots de un partido.
 * Muta el objeto match y lo devuelve.
 */
export async function resolveMatchRefs(match, driver) {
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

export async function lookupInscriptionDisplayName(driver, inscriptionId) {
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
export async function resolveInscriptionToTeamDisplay(driver, inscriptionId, resolving = new Set()) {
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
export async function resolveFinishedMatchWinnerFromResolvedLeg(driver, leg) {
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
export async function resolveEliminationSeriesWinnerFromResolvedLegs(driver, resolvedLegs) {
  if (!resolvedLegs?.length) return null;
  if (resolvedLegs.length === 1) {
    return resolveFinishedMatchWinnerFromResolvedLeg(driver, resolvedLegs[0]);
  }
  const scoreMap = aggregateEliminationSeriesScores(resolvedLegs);
  const picked = pickSeriesWinnerFromScoreMap(scoreMap);
  return finalizeSeriesWinnerPick(driver, picked, resolvedLegs);
}

export async function resolveEliminationSeriesLoserFromResolvedLegs(driver, resolvedLegs) {
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
export async function resolveEliminationSeriesWinnerFromMatch(driver, mProps, stageIdHint = null) {
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
export async function resolveFinishedMatchWinner(driver, m) {
  const leg = matchFromNeoProps(m);
  await resolveMatchRefs(leg, driver);
  return resolveFinishedMatchWinnerFromResolvedLeg(driver, leg);
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
export async function resolvePositionRef(driver, posRef) {
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

      const groupsR = await session.run(
        `MATCH (s:Stage {id:$sid})-[:HAS_GROUP]->(g:Group) RETURN g.id AS gid ORDER BY g.order`,
        { sid: bestNStageId }
      );
      if (groupsR.records.length === 0) return { inscriptionId: posRef, displayName: label };

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
