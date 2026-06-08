import {
  legsForEliminationSlot,
  resolveEliminationBracketConfig,
} from './bracketElimination.js';

function matchProps(record) {
  return record?.get('m')?.properties ?? null;
}

async function loadStageMaxRound(session, stageId) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(m.matchKind, 'bracket') <> 'third_place'
     RETURN max(toInteger(coalesce(m.round, 1))) AS mr`,
    { stageId }
  );
  return Number(r.records[0]?.get('mr') || 1);
}

async function loadLegInSlot(session, stageId, round, slotIndex, leg) {
  const r = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(toInteger(m.round), 0) = $round
       AND coalesce(toInteger(m.slotIndex), 0) = $slot
       AND coalesce(toInteger(m.leg), 1) = $leg
     RETURN m
     LIMIT 1`,
    { stageId, round, slot: slotIndex, leg }
  );
  return r.records[0] ? matchProps(r.records[0]) : null;
}

async function writeMatchSides(session, matchId, sides) {
  await session.run(
    `MATCH (m:Match {id:$matchId})
     SET m.homeInscriptionId = $hid,
         m.homeDisplayName = $hdn,
         m.homeTournamentId = $htid,
         m.awayInscriptionId = $aid,
         m.awayDisplayName = $adn,
         m.awayTournamentId = $atid`,
    {
      matchId,
      hid: sides.homeInscriptionId ?? null,
      hdn: sides.homeDisplayName ?? null,
      htid: sides.homeTournamentId ?? null,
      aid: sides.awayInscriptionId ?? null,
      adn: sides.awayDisplayName ?? null,
      atid: sides.awayTournamentId ?? null,
    }
  );
}

function sidesFromMatch(m) {
  return {
    homeInscriptionId: m.homeInscriptionId ?? null,
    homeDisplayName: m.homeDisplayName ?? null,
    homeTournamentId: m.homeTournamentId ?? null,
    awayInscriptionId: m.awayInscriptionId ?? null,
    awayDisplayName: m.awayDisplayName ?? null,
    awayTournamentId: m.awayTournamentId ?? null,
  };
}

function invertSides(sides) {
  return {
    homeInscriptionId: sides.awayInscriptionId,
    homeDisplayName: sides.awayDisplayName,
    homeTournamentId: sides.awayTournamentId,
    awayInscriptionId: sides.homeInscriptionId,
    awayDisplayName: sides.homeDisplayName,
    awayTournamentId: sides.homeTournamentId,
  };
}

/**
 * Tras asignar en ida o vuelta, mantiene la vuelta como espejo de la ida:
 * leg2.home = leg1.away, leg2.away = leg1.home.
 */
export async function syncEliminationDoubleLegPair(session, stageId, stageProps, editedMatchId) {
  const edited = await session.run(`MATCH (m:Match {id:$id}) RETURN m`, { id: editedMatchId });
  const editedMatch = edited.records[0] ? matchProps(edited.records[0]) : null;
  if (!editedMatch) return;

  const round = Number(editedMatch.round ?? 1);
  const slotIndex = Number(editedMatch.slotIndex ?? 0);
  const editedLeg = Number(editedMatch.leg ?? 1);
  if (!Number.isFinite(slotIndex) || slotIndex < 1) return;

  const stageCfg = typeof stageProps?.configJson === 'string'
    ? JSON.parse(stageProps.configJson || '{}')
    : (stageProps?.configJson || {});
  const maxRound = await loadStageMaxRound(session, stageId);
  const bracketCfg = resolveEliminationBracketConfig(stageCfg, false);
  const slotLegs = legsForEliminationSlot(round, maxRound, bracketCfg);
  if (slotLegs.length < 2) return;

  let leg1 = await loadLegInSlot(session, stageId, round, slotIndex, 1);
  let leg2 = await loadLegInSlot(session, stageId, round, slotIndex, 2);
  if (!leg1?.id || !leg2?.id) return;

  if (editedLeg === 2) {
    const leg2Sides = sidesFromMatch(editedMatch);
    await writeMatchSides(session, leg1.id, invertSides(leg2Sides));
    leg1 = await loadLegInSlot(session, stageId, round, slotIndex, 1);
    if (!leg1) return;
  }

  await writeMatchSides(session, leg2.id, invertSides(sidesFromMatch(leg1)));
}
