/** Carga del subgrafo estructural de un torneo (sin partidos ni inscripciones). */

export async function loadTournamentStructure(session, tournamentId) {
  const compsRes = await session.run(
    `MATCH (t:Tournament {id:$tid})-[hc:HAS_COMPETITION]->(c:Competition)
     RETURN c, hc.order AS relOrder
     ORDER BY relOrder`,
    { tid: tournamentId }
  );
  const competitions = compsRes.records.map((r) => {
    const c = r.get('c').properties;
    return {
      id: c.id,
      name: c.name,
      order: Number(c.order) || Number(r.get('relOrder')) || 0,
      maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
    };
  });

  const stagesRes = await session.run(
    `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(c:Competition)-[hs:HAS_STAGE]->(s:Stage)
     RETURN c.id AS competitionId, s, hs.order AS relOrder
     ORDER BY competitionId, relOrder`,
    { tid: tournamentId }
  );
  const stages = stagesRes.records.map((r) => {
    const s = r.get('s').properties;
    return {
      id: s.id,
      competitionId: r.get('competitionId'),
      name: s.name,
      order: Number(s.order) || Number(r.get('relOrder')) || 0,
      format: s.format,
      configJson: s.configJson ?? null,
      childrenJson: s.childrenJson ?? null,
    };
  });

  const transRes = await session.run(
    `MATCH (t:Tournament {id:$tid})-[:HAS_COMPETITION]->(:Competition)-[:HAS_STAGE]->(s:Stage)-[:EMITS]->(tr:Transition)
     OPTIONAL MATCH (tr)-[:TO|TO_STAGE]->(dst:Stage)
     RETURN s.id AS fromStageId, tr, dst.id AS toStageId`,
    { tid: tournamentId }
  );
  const transitions = transRes.records.map((r) => {
    const tr = r.get('tr').properties;
    const dst = r.get('toStageId');
    return {
      id: tr.id,
      fromStageId: r.get('fromStageId'),
      toStageId: dst ?? null,
      type: tr.type ?? 'generic',
      label: tr.label ?? null,
      selectionKind: tr.selectionKind ?? null,
      topN: tr.topN != null ? Number(tr.topN) : null,
      rangeFrom: tr.rangeFrom != null ? Number(tr.rangeFrom) : null,
      rangeTo: tr.rangeTo != null ? Number(tr.rangeTo) : null,
      bottomN: tr.bottomN != null ? Number(tr.bottomN) : null,
      toExternalTournamentId: tr.toExternalTournamentId ?? null,
      toExternalStageId: tr.toExternalStageId ?? null,
      toExternalTournamentName: tr.toExternalTournamentName ?? null,
      carryOverJson: tr.carryOverJson ?? null,
      timing: tr.timing ?? 'in_season',
      placementSnapshotJson: tr.placementSnapshotJson ?? null,
    };
  });

  const stageToCompetition = new Map(stages.map((s) => [s.id, s.competitionId]));

  return { competitions, stages, transitions, stageToCompetition };
}
