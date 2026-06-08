/** Lecturas para el cálculo de standings: inscripciones + partidos de una etapa o grupo. */

const MATCHES_RETURN = `RETURN m.homeInscriptionId AS homeInscriptionId,
                  m.awayInscriptionId AS awayInscriptionId,
                  m.homeDisplayName AS homeDisplayName,
                  m.awayDisplayName AS awayDisplayName,
                  m.homeScore AS homeScore,
                  m.awayScore AS awayScore,
                  m.status AS status,
                  coalesce(m.status, m.matchStatus, 'scheduled') AS matchStatus`;

function mapMatchRow(record) {
  return {
    homeInscriptionId: record.get('homeInscriptionId'),
    awayInscriptionId: record.get('awayInscriptionId'),
    homeDisplayName: record.get('homeDisplayName'),
    awayDisplayName: record.get('awayDisplayName'),
    homeScore: record.get('homeScore'),
    awayScore: record.get('awayScore'),
    status: record.get('status'),
    matchStatus: record.get('matchStatus'),
  };
}

async function fetchInputs(session, scopeMatch, scopeId) {
  const inscriptionsResult = await session.run(
    `MATCH ${scopeMatch}-[:HAS_ASSIGNED_INSCRIPTION]->(i:InscriptionRef)
     RETURN i.inscriptionId AS inscriptionId, i.displayName AS displayName
     ORDER BY i.displayName, i.inscriptionId`,
    { id: scopeId }
  );
  const inscriptions = inscriptionsResult.records.map((record) => ({
    inscriptionId: record.get('inscriptionId'),
    displayName: record.get('displayName'),
  }));

  const matchesResult = await session.run(
    `MATCH ${scopeMatch}-[:HAS_MATCH]->(m:Match)
     ${MATCHES_RETURN}`,
    { id: scopeId }
  );
  return { inscriptions, matches: matchesResult.records.map(mapMatchRow) };
}

export function getStageStandingsInputs(session, stageId) {
  return fetchInputs(session, '(s:Stage {id:$id})', stageId);
}

export function getGroupStandingsInputs(session, groupId) {
  return fetchInputs(session, '(g:Group {id:$id})', groupId);
}
