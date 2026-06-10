/** Acceso a datos de Tournament en Neo4j. Recibe siempre una sesión abierta por el servicio. */

function mapTournament(t) {
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
    editionLabel: t.editionLabel ?? null,
  };
}

export async function list(session) {
  const res = await session.run('MATCH (t:Tournament) RETURN t ORDER BY t.name');
  return res.records.map((r) => mapTournament(r.get('t').properties));
}

export async function findById(session, id) {
  const res = await session.run('MATCH (t:Tournament {id:$id}) RETURN t', { id });
  if (res.records.length === 0) return null;
  return mapTournament(res.records[0].get('t').properties);
}

/** Devuelve las propiedades crudas (sin mapear) para chequeos de propiedad/cascada. */
export async function findRawById(session, id) {
  const res = await session.run('MATCH (t:Tournament {id:$id}) RETURN t LIMIT 1', { id });
  if (res.records.length === 0) return null;
  return res.records[0].get('t').properties;
}

export async function create(session, { id, name, sport, season, venue, organizer, participantType, maxSlots, inscriptionMode, status }) {
  await session.run(
    `CREATE (t:Tournament {id:$id, name:$name, sport:$sport, season:$season, venue:$venue, organizer:$organizer, participantType:$pt, maxSlots:$maxSlots, inscriptionMode:$inscriptionMode, status:$status}) RETURN t`,
    {
      id,
      name,
      sport,
      season: season || null,
      venue: venue || null,
      organizer,
      pt: participantType || null,
      maxSlots,
      inscriptionMode,
      status,
    }
  );
  return mapTournament({ id, name, sport, season, venue, organizer, participantType, maxSlots, inscriptionMode, status });
}

export async function update(session, id, { name, sport, season, venue, participantType, inscriptionMode, status }) {
  const res = await session.run(
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
  if (res.records.length === 0) return null;
  return mapTournament(res.records[0].get('t').properties);
}

/** Borra el subgrafo completo del torneo (competiciones, etapas, grupos, partidos, transiciones, inscripciones). */
export async function cascadeDelete(session, id) {
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
}

/** Competiciones de un torneo (para el resolver Tournament.competitions). */
export async function findCompetitions(session, tournamentId) {
  const res = await session.run(
    `MATCH (t:Tournament {id:$id})-[hc:HAS_COMPETITION]->(c:Competition)
     RETURN c ORDER BY hc.order`,
    { id: tournamentId }
  );
  return res.records.map((r) => {
    const c = r.get('c').properties;
    return { id: c.id, name: c.name, order: Number(c.order) || 0 };
  });
}
