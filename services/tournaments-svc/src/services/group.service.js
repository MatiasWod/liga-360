/** Lógica de negocio de grupos: creación/sincronización, competidores e inscripciones por grupo. */
import { genId } from '../domain/shared/ids.js';
import {
  deriveGroupsConfig,
  deriveStageCapacity,
  normalizeInscriptionId,
} from '../domain/stage/stageConfig.js';
import { isPlaceholderParticipantLabel } from '../domain/shared/participantLabels.js';
import * as groupRepo from '../repositories/group.repository.js';
import * as stageRepo from '../repositories/stage.repository.js';
import * as competitorRepo from '../repositories/competitor.repository.js';

export async function addGroup(driver, { stageId, name, order }) {
  const session = driver.session();
  try {
    return await groupRepo.create(session, { stageId, id: genId('g'), name, order });
  } finally {
    await session.close();
  }
}

export async function syncStageGroups(driver, stageId, totalGroups) {
  const safeTotalGroups = Number(totalGroups);
  if (!Number.isInteger(safeTotalGroups) || safeTotalGroups <= 0) {
    throw new Error('BAD_REQUEST: totalGroups debe ser entero positivo');
  }
  const session = driver.session();
  try {
    const stage = await stageRepo.findRawProps(session, stageId);
    if (!stage) throw new Error('NOT_FOUND: stage no existe');

    const existingGroups = await groupRepo.listRawByStage(session, stageId);
    if (existingGroups.length > safeTotalGroups) {
      throw new Error('BAD_REQUEST: no se puede reducir grupos cuando ya existen más grupos persistidos');
    }

    for (let i = existingGroups.length; i < safeTotalGroups; i += 1) {
      const order = i + 1;
      await groupRepo.create(session, { stageId, id: genId('g'), name: `Grupo ${order}`, order });
    }

    return await groupRepo.findByStage(session, stageId);
  } finally {
    await session.close();
  }
}

export async function addTeamToGroup(driver, { groupId, teamId }) {
  const session = driver.session();
  try {
    await competitorRepo.upsertSnapshot(session, {
      competitorId: teamId,
      kind: 'team',
      displayName: `Equipo ${teamId}`,
      shortName: null,
      avatarUrl: null,
      badgeUrl: null,
    });
    await groupRepo.linkCompetitor(session, groupId, teamId);
    return true;
  } finally {
    await session.close();
  }
}

export async function addCompetitorToGroup(driver, { groupId, competitorId, kind, displayName, shortName, avatarUrl, badgeUrl }) {
  const session = driver.session();
  try {
    await competitorRepo.upsertSnapshot(session, { competitorId, kind, displayName, shortName, avatarUrl, badgeUrl });
    await groupRepo.linkCompetitor(session, groupId, competitorId);
    return true;
  } finally {
    await session.close();
  }
}

export async function assignInscriptionToGroup(driver, { stageId, groupId, inscriptionId, tournamentId, displayName }) {
  const iid = normalizeInscriptionId(inscriptionId);
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findRawProps(session, stageId);
    if (!stageProps) throw new Error('NOT_FOUND: stage no existe');
    if (String(stageProps?.format || '').toLowerCase() !== 'groups') {
      throw new Error('BAD_REQUEST: la etapa no es de grupos');
    }

    const group = await groupRepo.findInStage(session, stageId, groupId);
    if (!group) throw new Error('BAD_REQUEST: grupo no pertenece a la etapa');

    const dn = String(displayName || '').trim();
    if (!dn || isPlaceholderParticipantLabel(dn)) {
      throw new Error('BAD_REQUEST: displayName debe ser el nombre real del equipo');
    }

    const { teamsPerGroup } = deriveGroupsConfig(stageProps);
    if (teamsPerGroup > 0) {
      const count = await groupRepo.countDistinctAssignedInscriptions(session, groupId);
      if (count >= teamsPerGroup) throw new Error('GROUP_CAPACITY_REACHED');
    }

    const stageCap = deriveStageCapacity(stageProps);
    if (stageCap && stageCap > 0) {
      const stageCount = await stageRepo.countPhysicalAssignedInscriptions(session, stageId, tournamentId);
      const alreadyInStage = await stageRepo.inscriptionExistsInStage(session, stageId, tournamentId, iid);
      if (!alreadyInStage && stageCount >= stageCap) throw new Error('STAGE_CAPACITY_REACHED');
    }

    await groupRepo.mergeInscription(session, { stageId, groupId, tournamentId, iid, displayName });
    return true;
  } finally {
    await session.close();
  }
}

export async function unassignInscriptionFromGroup(driver, { groupId, inscriptionId, tournamentId }) {
  const iid = normalizeInscriptionId(inscriptionId);
  const session = driver.session();
  try {
    await groupRepo.unassignInscription(session, groupId, tournamentId, iid);
    return true;
  } finally {
    await session.close();
  }
}

// --- Resolvers de campo de Group ---

export async function getCompetitorIds(driver, groupId) {
  const session = driver.session();
  try {
    return await groupRepo.competitorIds(session, groupId);
  } finally {
    await session.close();
  }
}

export async function getCompetitors(driver, groupId) {
  const session = driver.session();
  try {
    return await groupRepo.competitors(session, groupId);
  } finally {
    await session.close();
  }
}

export async function getAssignedInscriptions(driver, groupId) {
  const session = driver.session();
  try {
    return await groupRepo.assignedInscriptions(session, groupId);
  } finally {
    await session.close();
  }
}

export async function getCapacity(driver, groupId) {
  const session = driver.session();
  try {
    return await groupRepo.capacity(session, groupId, deriveGroupsConfig);
  } finally {
    await session.close();
  }
}

export async function getStageGroups(driver, stageId) {
  const session = driver.session();
  try {
    return await groupRepo.findByStage(session, stageId);
  } finally {
    await session.close();
  }
}
