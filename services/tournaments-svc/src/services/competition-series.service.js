/** CRUD de CompetitionSeries y vínculo torneo↔serie. */
import { genId } from '../domain/shared/ids.js';
import * as seriesRepo from '../repositories/competition-series.repository.js';
import * as tournamentRepo from '../repositories/tournament.repository.js';

function conflict(message) {
  const err = new Error(message);
  err.code = 'CONFLICT';
  throw err;
}

function notFound(message) {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  throw err;
}

export async function getById(driver, id) {
  const session = driver.session();
  try {
    return await seriesRepo.findById(session, id);
  } finally {
    await session.close();
  }
}

export async function getBySlug(driver, slug) {
  const session = driver.session();
  try {
    return await seriesRepo.findBySlug(session, slug);
  } finally {
    await session.close();
  }
}

export async function listPublic(driver) {
  const session = driver.session();
  try {
    return await seriesRepo.listPublic(session);
  } finally {
    await session.close();
  }
}

export async function listByOrganizer(driver, organizer) {
  const session = driver.session();
  try {
    return await seriesRepo.listByOrganizer(session, String(organizer || '').trim());
  } finally {
    await session.close();
  }
}

export async function getEditions(driver, seriesId) {
  const session = driver.session();
  try {
    const raw = await seriesRepo.listEditions(session, seriesId);
    return raw.map(mapEdition);
  } finally {
    await session.close();
  }
}

function mapEdition(t) {
  return {
    tournamentId: t.id,
    name: t.name,
    status: t.status ?? 'draft',
    editionLabel: t.editionLabel ?? null,
    season: t.season ?? null,
  };
}

export async function create(driver, { name, slug, sport, organizer }) {
  const session = driver.session();
  try {
    const normalizedSlug = seriesRepo.normalizeSlug(slug);
    if (!normalizedSlug) conflict('CONFLICT: slug inválido');
    if (await seriesRepo.slugExists(session, normalizedSlug)) {
      conflict('CONFLICT: slug de serie ya existe');
    }
    return await seriesRepo.create(session, {
      id: genId('cs'),
      name: String(name || '').trim(),
      slug: normalizedSlug,
      sport: sport || 'football',
      organizer: organizer || null,
    });
  } finally {
    await session.close();
  }
}

export async function update(driver, id, { name, sport }) {
  const session = driver.session();
  try {
    const updated = await seriesRepo.update(session, id, {
      name: String(name || '').trim(),
      sport: sport || 'football',
    });
    if (!updated) notFound('NOT_FOUND: serie no existe');
    return updated;
  } finally {
    await session.close();
  }
}

/** Valida y persiste vínculo torneo↔serie (editionLabel único por serie). */
export async function assignTournamentToSeries(driver, { tournamentId, seriesId, editionLabel }) {
  const session = driver.session();
  try {
    const tournament = await tournamentRepo.findRawById(session, tournamentId);
    if (!tournament) notFound('NOT_FOUND: tournament no existe');

    if (!seriesId) {
      await seriesRepo.unlinkTournament(session, tournamentId);
      return null;
    }

    const series = await seriesRepo.findById(session, seriesId);
    if (!series) notFound('NOT_FOUND: serie no existe');

    const label = seriesRepo.normalizeEditionLabel(editionLabel);
    if (!label) conflict('CONFLICT: editionLabel requerido cuando hay seriesId');

    if (await seriesRepo.editionLabelTaken(session, seriesId, label, tournamentId)) {
      conflict('CONFLICT: editionLabel ya existe en la serie');
    }

    await seriesRepo.linkTournament(session, { tournamentId, seriesId, editionLabel: label });
    return series;
  } finally {
    await session.close();
  }
}

export async function getSeriesForTournament(driver, tournamentId) {
  const session = driver.session();
  try {
    return await seriesRepo.findSeriesForTournament(session, tournamentId);
  } finally {
    await session.close();
  }
}

export async function getEditionLabel(driver, tournamentId) {
  const session = driver.session();
  try {
    const t = await tournamentRepo.findRawById(session, tournamentId);
    return t?.editionLabel ?? null;
  } finally {
    await session.close();
  }
}
