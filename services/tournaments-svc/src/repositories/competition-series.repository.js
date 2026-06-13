/** Acceso a datos de CompetitionSeries y vínculo IN_SERIES con Tournament. */

function mapSeries(s) {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    sport: s.sport ?? 'football',
    organizer: s.organizer ?? null,
  };
}

function normalizeSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeEditionLabel(label) {
  return String(label || '').trim();
}

export { normalizeSlug, normalizeEditionLabel };

export async function findById(session, id) {
  const r = await session.run('MATCH (s:CompetitionSeries {id:$id}) RETURN s LIMIT 1', { id });
  if (r.records.length === 0) return null;
  return mapSeries(r.records[0].get('s').properties);
}

export async function findBySlug(session, slug) {
  const r = await session.run(
    'MATCH (s:CompetitionSeries {slug:$slug}) RETURN s LIMIT 1',
    { slug: normalizeSlug(slug) }
  );
  if (r.records.length === 0) return null;
  return mapSeries(r.records[0].get('s').properties);
}

export async function slugExists(session, slug, excludeId = null) {
  const r = await session.run(
    `MATCH (s:CompetitionSeries {slug:$slug})
     WHERE $excludeId IS NULL OR s.id <> $excludeId
     RETURN s LIMIT 1`,
    { slug: normalizeSlug(slug), excludeId }
  );
  return r.records.length > 0;
}

export async function create(session, { id, name, slug, sport, organizer }) {
  const normalizedSlug = normalizeSlug(slug);
  await session.run(
    `CREATE (s:CompetitionSeries {id:$id, name:$name, slug:$slug, sport:$sport, organizer:$organizer})`,
    { id, name, slug: normalizedSlug, sport, organizer: organizer || null }
  );
  return mapSeries({ id, name, slug: normalizedSlug, sport, organizer });
}

export async function update(session, id, { name, sport }) {
  const r = await session.run(
    `MATCH (s:CompetitionSeries {id:$id})
     SET s.name = $name, s.sport = $sport
     RETURN s LIMIT 1`,
    { id, name, sport }
  );
  if (r.records.length === 0) return null;
  return mapSeries(r.records[0].get('s').properties);
}

/** Series con al menos una edición published/finished (listado público). */
export async function listPublic(session) {
  const r = await session.run(
    `MATCH (s:CompetitionSeries)<-[:IN_SERIES]-(t:Tournament)
     RETURN DISTINCT s
     ORDER BY s.name`
  );
  return r.records.map((rec) => mapSeries(rec.get('s').properties));
}

/** Series del organizador (incluye sin ediciones). */
export async function listByOrganizer(session, organizer) {
  const r = await session.run(
    `MATCH (s:CompetitionSeries)
     WHERE s.organizer = $organizer
     RETURN s
     ORDER BY s.name`,
    { organizer }
  );
  return r.records.map((rec) => mapSeries(rec.get('s').properties));
}

export async function listEditions(session, seriesId) {
  const r = await session.run(
    `MATCH (s:CompetitionSeries {id:$seriesId})<-[:IN_SERIES]-(t:Tournament)
     RETURN t
     ORDER BY coalesce(t.editionLabel, t.season, t.name)`,
    { seriesId }
  );
  return r.records.map((rec) => rec.get('t').properties);
}

export async function editionLabelTaken(session, seriesId, editionLabel, excludeTournamentId = null, categoryLabel = null) {
  const label = normalizeEditionLabel(editionLabel).toLowerCase();
  if (!label) return false;
  const normalizedCategory = categoryLabel ? String(categoryLabel).trim().toLowerCase() : null;
  const r = await session.run(
    `MATCH (s:CompetitionSeries {id:$seriesId})<-[:IN_SERIES]-(t:Tournament)
     WHERE toLower(trim(t.editionLabel)) = $label
       AND ($excludeTournamentId IS NULL OR t.id <> $excludeTournamentId)
       AND coalesce(toLower(trim(t.categoryLabel)), '') = coalesce($normalizedCategory, '')
     RETURN t LIMIT 1`,
    { seriesId, label, excludeTournamentId, normalizedCategory }
  );
  return r.records.length > 0;
}

export async function linkTournament(session, { tournamentId, seriesId, editionLabel }) {
  await session.run(
    `MATCH (t:Tournament {id:$tournamentId}), (s:CompetitionSeries {id:$seriesId})
     OPTIONAL MATCH (t)-[old:IN_SERIES]->(:CompetitionSeries)
     DELETE old
     SET t.editionLabel = $editionLabel
     CREATE (t)-[:IN_SERIES]->(s)`,
    {
      tournamentId,
      seriesId,
      editionLabel: normalizeEditionLabel(editionLabel) || null,
    }
  );
}

export async function unlinkTournament(session, tournamentId) {
  await session.run(
    `MATCH (t:Tournament {id:$tournamentId})
     OPTIONAL MATCH (t)-[r:IN_SERIES]->(:CompetitionSeries)
     DELETE r
     SET t.editionLabel = null`,
    { tournamentId }
  );
}

export async function findSeriesForTournament(session, tournamentId) {
  const r = await session.run(
    `MATCH (t:Tournament {id:$tournamentId})-[:IN_SERIES]->(s:CompetitionSeries)
     RETURN s LIMIT 1`,
    { tournamentId }
  );
  if (r.records.length === 0) return null;
  return mapSeries(r.records[0].get('s').properties);
}
