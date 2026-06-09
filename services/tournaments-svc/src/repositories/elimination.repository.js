/**
 * Acceso a datos específico de brackets de eliminación: detección de destinos de avance por ref,
 * sincronización ida/vuelta y verificación de duplicados físicos entre llaves.
 * La lógica pura (matemática de bracket, comparación de llaves) vive en domain/elimination/.
 */
import { pickAdvanceSideForRef } from '../domain/elimination/eliminationAdvance.js';
import {
  legsForEliminationSlot,
  resolveEliminationBracketConfig,
} from '../domain/elimination/bracketElimination.js';
import {
  isSameEliminationTie,
  normalizeInscriptionIdStr,
} from '../domain/elimination/eliminationSlotAssignment.js';
import { isPhysicalInscriptionId } from '../domain/shared/participantLabels.js';

// --- Avance por referencia de ganador ---

/**
 * Partidos destino que ya tienen un ref `liga360-slot:ew:` / `pos:ew:` apuntando al ganador.
 * Respeta la configuración manual del organizador (p. ej. G1 vs G8 en cuartos).
 */
export async function findRefBasedAdvanceTargets(session, stageId, winnerRefs) {
  const refs = (winnerRefs || []).map((r) => String(r || '').trim()).filter(Boolean);
  if (!refs.length || !stageId) return [];
  const res = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     WHERE coalesce(m.matchKind, 'bracket') <> 'third_place'
       AND (m.homeInscriptionId IN $refs OR m.awayInscriptionId IN $refs)
     RETURN m.id AS id, coalesce(toInteger(m.leg), 1) AS leg,
            m.homeInscriptionId AS hid, m.awayInscriptionId AS aid`,
    { stageId, refs }
  );
  const refSet = new Set(refs);
  const out = [];
  for (const rec of res.records) {
    const side = pickAdvanceSideForRef(rec.get('hid'), rec.get('aid'), refSet);
    if (!side) continue;
    out.push({
      nextMatchId: rec.get('id'),
      leg: Number(rec.get('leg') || 1),
      side,
    });
  }
  return out;
}

// --- Sincronización ida/vuelta ---

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
  const leg2 = await loadLegInSlot(session, stageId, round, slotIndex, 2);
  if (!leg1?.id || !leg2?.id) return;

  if (editedLeg === 2) {
    const leg2Sides = sidesFromMatch(editedMatch);
    await writeMatchSides(session, leg1.id, invertSides(leg2Sides));
    leg1 = await loadLegInSlot(session, stageId, round, slotIndex, 1);
    if (!leg1) return;
  }

  await writeMatchSides(session, leg2.id, invertSides(sidesFromMatch(leg1)));
}

// --- Anti-duplicado de equipo físico entre llaves ---

/**
 * Resuelve un id de slot (físico o pos:/liga360-slot:) al inscriptionId físico del equipo, si aplica.
 */
export async function resolveAssignmentPhysicalKey(driver, inscriptionId, resolvePositionRefFn) {
  const iid = normalizeInscriptionIdStr(inscriptionId);
  if (!iid) return null;
  if (isPhysicalInscriptionId(iid)) return iid;
  if (iid.startsWith('liga360-slot:')) return null;
  if (iid.startsWith('pos:')) {
    const resolved = await resolvePositionRefFn(driver, iid);
    const rid = normalizeInscriptionIdStr(resolved?.inscriptionId);
    return isPhysicalInscriptionId(rid) ? rid : null;
  }
  return null;
}

/** Impide que el mismo equipo real ocupe dos llaves distintas (ida/vuelta de la misma llave sí comparte equipo). */
export async function assertEliminationPhysicalNotDuplicateElsewhere({
  session,
  driver,
  stageId,
  matchId,
  round,
  slotIndex,
  candidateInscriptionId,
  resolvePositionRefFn,
}) {
  const candidatePhysical = await resolveAssignmentPhysicalKey(
    driver,
    candidateInscriptionId,
    resolvePositionRefFn
  );
  if (!candidatePhysical) return;

  const rows = await session.run(
    `MATCH (:Stage {id:$stageId})-[:HAS_MATCH]->(m:Match)
     RETURN m.id AS id,
            toInteger(coalesce(m.round, 1)) AS round,
            toInteger(coalesce(m.slotIndex, 0)) AS slotIndex,
            m.homeInscriptionId AS home,
            m.awayInscriptionId AS away`,
    { stageId }
  );

  const curRound = Number(round ?? 1);
  const curSlot = Number(slotIndex ?? 0);

  for (const rec of rows.records) {
    const mid = rec.get('id');
    if (mid === matchId) continue;
    const mRound = Number(rec.get('round') ?? 1);
    const mSlot = Number(rec.get('slotIndex') ?? 0);
    if (isSameEliminationTie(curRound, curSlot, mRound, mSlot)) continue;

    for (const sideId of [rec.get('home'), rec.get('away')]) {
      const sid = normalizeInscriptionIdStr(sideId);
      if (!sid) continue;
      const otherPhysical = await resolveAssignmentPhysicalKey(driver, sid, resolvePositionRefFn);
      if (otherPhysical && otherPhysical === candidatePhysical) {
        throw new Error('BAD_REQUEST: el equipo ya está asignado en otra llave de este cuadro');
      }
    }
  }
}
