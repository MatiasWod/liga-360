/** Cálculo de posiciones (standings) para etapas de liga y para grupos. */
import { computeStandings } from '../domain/standings/standings.js';
import * as standingsRepo from '../repositories/standings.repository.js';

export async function getStageStandings(driver, stageId) {
  const session = driver.session();
  try {
    const { inscriptions, matches } = await standingsRepo.getStageStandingsInputs(session, stageId);
    return computeStandings(matches, inscriptions);
  } finally {
    await session.close();
  }
}

export async function getGroupStandings(driver, groupId) {
  const session = driver.session();
  try {
    const { inscriptions, matches } = await standingsRepo.getGroupStandingsInputs(session, groupId);
    return computeStandings(matches, inscriptions);
  } finally {
    await session.close();
  }
}
