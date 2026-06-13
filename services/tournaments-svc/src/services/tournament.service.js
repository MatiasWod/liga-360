/** Lógica de negocio de torneos: validación de cupos y borrado restringido al organizador creador. */
import { genId } from '../domain/shared/ids.js';
import { normalizeCategoryLabel } from '../domain/categoryLabel.js';
import * as tournamentRepo from '../repositories/tournament.repository.js';
import * as seriesService from './competition-series.service.js';

function safeMaxSlots(maxSlots) {
  const parsed = Number(maxSlots ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 16;
}

function rethrowDomain(err) {
  if (err.code === 'CONFLICT') {
    throw Object.assign(new Error(err.message), { extensions: { code: 'CONFLICT' } });
  }
  if (err.code === 'NOT_FOUND') {
    throw Object.assign(new Error(err.message), { extensions: { code: 'NOT_FOUND' } });
  }
  throw err;
}

async function applySeriesLink(driver, tournamentId, seriesId, editionLabel, categoryLabel = null) {
  try {
    await seriesService.assignTournamentToSeries(driver, { tournamentId, seriesId: seriesId || null, editionLabel, categoryLabel });
  } catch (err) {
    rethrowDomain(err);
  }
}

export async function list(driver) {
  const session = driver.session();
  try {
    return await tournamentRepo.list(session);
  } finally {
    await session.close();
  }
}

export async function getById(driver, id) {
  const session = driver.session();
  try {
    return await tournamentRepo.findById(session, id);
  } finally {
    await session.close();
  }
}

export async function create(driver, { name, sport, season, venue, participantType, maxSlots, inscriptionMode, status, organizer, seriesId, editionLabel, categoryLabel }) {
  const session = driver.session();
  try {
    const id = genId('t');
    const normalizedCategoryLabel = normalizeCategoryLabel(categoryLabel);
    const created = await tournamentRepo.create(session, {
      id,
      name,
      sport,
      season,
      venue,
      organizer,
      participantType,
      maxSlots: safeMaxSlots(maxSlots),
      inscriptionMode,
      status,
      categoryLabel: normalizedCategoryLabel,
    });
    if (seriesId) {
      await applySeriesLink(driver, id, seriesId, editionLabel, normalizedCategoryLabel);
    }
    const linked = await seriesService.getSeriesForTournament(driver, id);
    return { ...created, seriesId: linked?.id ?? null };
  } finally {
    await session.close();
  }
}

export async function update(driver, id, updates) {
  const session = driver.session();
  try {
    const { seriesId, editionLabel, categoryLabel, ...tournamentUpdates } = updates;
    if (categoryLabel !== undefined) {
      tournamentUpdates.categoryLabel = normalizeCategoryLabel(categoryLabel);
    }
    const updated = await tournamentRepo.update(session, id, tournamentUpdates);
    if (!updated) throw new Error('NOT_FOUND: tournament no existe');
    if (seriesId !== undefined || editionLabel !== undefined) {
      let targetSeriesId = seriesId;
      if (targetSeriesId === undefined) {
        const current = await seriesService.getSeriesForTournament(driver, id);
        targetSeriesId = current?.id ?? null;
      }
      const resolvedCategory = updates.categoryLabel !== undefined
        ? normalizeCategoryLabel(updates.categoryLabel)
        : (await tournamentRepo.findRawById(session, id))?.categoryLabel ?? null;
      await applySeriesLink(driver, id, targetSeriesId, editionLabel, resolvedCategory);
    }
    const linked = await seriesService.getSeriesForTournament(driver, id);
    return { ...updated, seriesId: linked?.id ?? null };
  } finally {
    await session.close();
  }
}

export async function getCompetitions(driver, tournamentId) {
  const session = driver.session();
  try {
    return await tournamentRepo.findCompetitions(session, tournamentId);
  } finally {
    await session.close();
  }
}

export async function remove(driver, id, user) {
  const session = driver.session();
  try {
    const tournament = await tournamentRepo.findRawById(session, id);
    if (!tournament) return false;
    const owner = String(tournament.organizer || '').trim().toLowerCase();
    const requester = String(user?.username || '').trim().toLowerCase();
    if (!owner || !requester || owner !== requester) {
      throw new Error('FORBIDDEN: solo el organizador creador puede eliminar este torneo');
    }
    await tournamentRepo.cascadeDelete(session, id);
    return true;
  } finally {
    await session.close();
  }
}
