/** Lógica de negocio de llaves (Key) dentro de una etapa. */
import * as keyRepo from '../repositories/key.repository.js';

export async function getGroupIds(driver, keyId) {
  const session = driver.session();
  try {
    return await keyRepo.groupIds(session, keyId);
  } finally {
    await session.close();
  }
}

export async function getStageKeys(driver, stageId) {
  const session = driver.session();
  try {
    return await keyRepo.findByStage(session, stageId);
  } finally {
    await session.close();
  }
}
