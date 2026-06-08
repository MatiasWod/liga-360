/** Refs sintéticos que apuntan al ganador de una llave concreta. */
export function buildWinnerSlotRefs(stageId, matchIds) {
  const refs = new Set();
  for (const mid of matchIds) {
    const id = String(mid || '').trim();
    if (!id) continue;
    if (stageId) refs.add(`liga360-slot:ew:${stageId}:${id}`);
    refs.add(`pos:ew:${id}`);
  }
  return [...refs];
}

/** Destino clásico del árbol (1+2→slot1, 3+4→slot2, …). */
export function defaultBracketAdvanceTarget(round, slotIndex) {
  const r = Math.max(1, Math.trunc(Number(round) || 1));
  const s = Math.max(1, Math.trunc(Number(slotIndex) || 1));
  return {
    nextRound: r + 1,
    nextSlotIndex: Math.ceil(s / 2),
    isHomeInLeg1: s % 2 === 1,
  };
}

/** ¿En qué lado del partido destino estaba el ref del ganador? */
export function pickAdvanceSideForRef(homeInscriptionId, awayInscriptionId, winnerRefs) {
  const refSet = winnerRefs instanceof Set ? winnerRefs : new Set(winnerRefs);
  const hid = String(homeInscriptionId || '');
  const aid = String(awayInscriptionId || '');
  if (refSet.has(hid)) return 'home';
  if (refSet.has(aid)) return 'away';
  return null;
}

/** Local/visitante en pierna N respetando ida y vuelta. */
export function resolveAdvanceRoleForLeg(side, leg) {
  const lg = Math.max(1, Math.trunc(Number(leg) || 1));
  const isHome = side === 'home';
  if (lg === 2) return isHome ? 'away' : 'home';
  return isHome ? 'home' : 'away';
}

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
