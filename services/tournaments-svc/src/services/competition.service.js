/** Lógica de negocio de competiciones. El maxSlots efectivo se resuelve en el resolver de campo. */
import { genId } from '../domain/shared/ids.js';
import * as competitionRepo from '../repositories/competition.repository.js';

/** maxSlots opcional: entero positivo o null. */
function normalizeMaxSlots(maxSlots) {
  const parsed = maxSlots == null ? null : Number(maxSlots);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function getById(driver, id) {
  const session = driver.session();
  try {
    return await competitionRepo.findById(session, id);
  } finally {
    await session.close();
  }
}

export async function create(driver, { tournamentId, name, order, maxSlots }) {
  const session = driver.session();
  try {
    return await competitionRepo.create(session, {
      tournamentId,
      id: genId('c'),
      name,
      order,
      maxSlots: normalizeMaxSlots(maxSlots),
    });
  } finally {
    await session.close();
  }
}

export async function update(driver, id, { name, order, maxSlots }) {
  const session = driver.session();
  try {
    const updated = await competitionRepo.update(session, id, { name, order, maxSlots: normalizeMaxSlots(maxSlots) });
    if (!updated) throw new Error('NOT_FOUND: competition no existe');
    return updated;
  } finally {
    await session.close();
  }
}

export async function getEffectiveMaxSlots(driver, competitionId) {
  const session = driver.session();
  try {
    return await competitionRepo.resolveEffectiveMaxSlots(session, competitionId);
  } finally {
    await session.close();
  }
}

export async function getStages(driver, competitionId) {
  const session = driver.session();
  try {
    return await competitionRepo.findStages(session, competitionId);
  } finally {
    await session.close();
  }
}
