/** Lógica de negocio de torneos: validación de cupos y borrado restringido al organizador creador. */
import { genId } from '../domain/shared/ids.js';
import * as tournamentRepo from '../repositories/tournament.repository.js';

function safeMaxSlots(maxSlots) {
  const parsed = Number(maxSlots ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 16;
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

export async function create(driver, { name, sport, season, venue, participantType, maxSlots, inscriptionMode, status, organizer }) {
  const session = driver.session();
  try {
    return await tournamentRepo.create(session, {
      id: genId('t'),
      name,
      sport,
      season,
      venue,
      organizer,
      participantType,
      maxSlots: safeMaxSlots(maxSlots),
      inscriptionMode,
      status,
    });
  } finally {
    await session.close();
  }
}

export async function update(driver, id, updates) {
  const session = driver.session();
  try {
    const updated = await tournamentRepo.update(session, id, updates);
    if (!updated) throw new Error('NOT_FOUND: tournament no existe');
    return updated;
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
