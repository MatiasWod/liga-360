/** Lógica de negocio de competidores (snapshots de equipos/participantes). */
import * as competitorRepo from '../repositories/competitor.repository.js';

export async function upsert(driver, { competitorId, kind, displayName, shortName, avatarUrl, badgeUrl }) {
  const session = driver.session();
  try {
    const competitor = await competitorRepo.upsertSnapshot(session, {
      competitorId,
      kind,
      displayName,
      shortName,
      avatarUrl,
      badgeUrl,
    });
    return competitorRepo.mapCompetitor(competitor);
  } finally {
    await session.close();
  }
}
