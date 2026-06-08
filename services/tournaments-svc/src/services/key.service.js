/** Lógica de negocio de llaves (Key) dentro de una etapa. */
import { genId } from '../domain/shared/ids.js';
import * as keyRepo from '../repositories/key.repository.js';

export async function addKey(driver, { stageId, name, order }) {
  const session = driver.session();
  try {
    return await keyRepo.create(session, { stageId, id: genId('k'), name, order });
  } finally {
    await session.close();
  }
}

export async function linkGroupToKey(driver, keyId, groupId) {
  const session = driver.session();
  try {
    await keyRepo.linkGroup(session, keyId, groupId);
    return true;
  } finally {
    await session.close();
  }
}

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
