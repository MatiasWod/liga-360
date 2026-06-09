/** Acceso a datos de Competition en Neo4j. */
import { deriveCompetitionCapacityFromStage } from '../domain/stage/stageConfig.js';

function mapCompetition(c) {
  return {
    id: c.id,
    name: c.name,
    order: Number(c.order) || 0,
    maxSlots: c.maxSlots != null ? Number(c.maxSlots) : null,
  };
}

export async function findById(session, id) {
  const r = await session.run('MATCH (c:Competition {id:$id}) RETURN c LIMIT 1', { id });
  if (r.records.length === 0) return null;
  return mapCompetition(r.records[0].get('c').properties);
}

export async function create(session, { tournamentId, id, name, order, maxSlots }) {
  await session.run(
    `MATCH (t:Tournament {id:$tid})
     CREATE (t)-[:HAS_COMPETITION {order:$order}]->(c:Competition {id:$id, name:$name, order:$order, maxSlots:$maxSlots})
     RETURN c`,
    { tid: tournamentId, id, name, order, maxSlots }
  );
  return { id, name, order, maxSlots };
}

export async function update(session, id, { name, order, maxSlots }) {
  const r = await session.run(
    `MATCH (c:Competition {id:$id})
     SET c.name = $name,
         c.order = $order,
         c.maxSlots = $maxSlots
     RETURN c
     LIMIT 1`,
    { id, name, order, maxSlots }
  );
  if (r.records.length === 0) return null;
  return mapCompetition(r.records[0].get('c').properties);
}

/**
 * maxSlots efectivo: explícito si está seteado (>0); si no, capacidad derivada de la primera
 * etapa que la defina; si nada, 16 por defecto.
 */
export async function resolveEffectiveMaxSlots(session, competitionId) {
  const compR = await session.run('MATCH (c:Competition {id:$id}) RETURN c LIMIT 1', { id: competitionId });
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

/** Etapas de una competición (para el resolver Competition.stages). */
export async function findStages(session, competitionId) {
  const res = await session.run(
    `MATCH (c:Competition {id:$id})-[hs:HAS_STAGE]->(s:Stage)
     RETURN s ORDER BY hs.order`,
    { id: competitionId }
  );
  return res.records.map((r) => {
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
}
