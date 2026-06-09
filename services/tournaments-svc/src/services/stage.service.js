/** Lógica de negocio de etapas: creación, estado (con cascada) y asignación de inscripciones. */
import { genId } from '../domain/shared/ids.js';
import {
  stageSubtypeLabelFromFormat,
  deriveStageCapacity,
  normalizeInscriptionId,
} from '../domain/stage/stageConfig.js';
import { isPhysicalInscriptionId, isPlaceholderParticipantLabel } from '../domain/shared/participantLabels.js';
import { computeEffectiveStageStatus } from '../domain/stage/stageStatus.js';
import * as stageRepo from '../repositories/stage.repository.js';

const ALLOWED_STATUSES = ['not_started', 'active', 'finished'];

export async function create(driver, { competitionId, name, order, format, configJson, childrenJson }) {
  const session = driver.session();
  try {
    return await stageRepo.create(session, {
      id: genId('s'),
      competitionId,
      name,
      order,
      format,
      configJson,
      childrenJson,
      subtype: stageSubtypeLabelFromFormat(format),
    });
  } finally {
    await session.close();
  }
}

export async function update(driver, { stageId, name, order, format, configJson, childrenJson }) {
  const session = driver.session();
  try {
    const updated = await stageRepo.update(session, { stageId, name, order, format, configJson, childrenJson });
    if (!updated) throw new Error('NOT_FOUND: stage no existe');
    return updated;
  } finally {
    await session.close();
  }
}

export async function setStatus(driver, stageId, status) {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new Error(`BAD_REQUEST: status debe ser uno de ${ALLOWED_STATUSES.join(', ')}`);
  }
  const session = driver.session();
  try {
    const s = await stageRepo.setStatus(session, stageId, status);
    if (!s) throw new Error('NOT_FOUND: stage no existe');
    if (status === 'finished') {
      await stageRepo.cascadeFinish(session, stageId);
    }
    return {
      id: s.id,
      name: s.name,
      order: Number(s.order) || 0,
      format: s.format,
      configJson: s.configJson ?? null,
      childrenJson: s.childrenJson ?? null,
      stageStatus: s.stageStatus,
    };
  } finally {
    await session.close();
  }
}

export async function assignInscription(driver, stageId, tournamentId, inscriptionId, displayName, force, seedOrder) {
  const iid = normalizeInscriptionId(inscriptionId);
  const session = driver.session();
  try {
    const stageProps = await stageRepo.findInTournament(session, tournamentId, stageId);
    if (!stageProps) throw new Error('BAD_REQUEST: stage no pertenece al torneo');

    if (!force) {
      const initial = await stageRepo.isInitial(session, stageId);
      if (!initial) throw new Error('BAD_REQUEST: solo se puede asignar a una fase inicial');
    }

    const stageCapacity = deriveStageCapacity(stageProps);
    if (!force && stageCapacity && stageCapacity > 0) {
      const totalCount = await stageRepo.countPhysicalAssignedInscriptions(session, stageId, tournamentId);
      const exists = await stageRepo.inscriptionExistsInStage(session, stageId, tournamentId, iid);
      if (!exists && totalCount >= stageCapacity) {
        throw new Error('STAGE_CAPACITY_REACHED');
      }
    }

    if (isPhysicalInscriptionId(iid)) {
      const dn = String(displayName || '').trim();
      const safeDn = dn && !isPlaceholderParticipantLabel(dn) ? dn : null;
      const seed = seedOrder != null && Number.isFinite(Number(seedOrder)) ? Math.trunc(Number(seedOrder)) : null;
      await stageRepo.mergeStageInscription(session, { stageId, tournamentId, iid, displayName: safeDn, seedOrder: seed });
    }
    return true;
  } finally {
    await session.close();
  }
}

export async function unassignInscription(driver, stageId, tournamentId, inscriptionId) {
  const iid = normalizeInscriptionId(inscriptionId);
  const session = driver.session();
  try {
    await stageRepo.unassignFromStage(session, stageId, tournamentId, iid);
    return true;
  } finally {
    await session.close();
  }
}

export async function clearAssignments(driver, tournamentId, inscriptionId) {
  const iid = normalizeInscriptionId(inscriptionId);
  const session = driver.session();
  try {
    await stageRepo.clearAssignments(session, tournamentId, iid);
    return true;
  } finally {
    await session.close();
  }
}

// --- Resolvers de campo de Stage ---

export async function getStageStatus(driver, parent) {
  if (parent.stageStatus != null) return parent.stageStatus;
  const session = driver.session();
  try {
    const inputs = await stageRepo.fetchStageStatusInputs(session, parent.id);
    if (inputs.sourceCount === 0 && inputs.persisted == null) {
      // Sin registro en Neo4j (p. ej. tests unitarios con parent parcial).
      return 'active';
    }
    return computeEffectiveStageStatus(inputs);
  } finally {
    await session.close();
  }
}

export async function isInitial(driver, stageId) {
  const session = driver.session();
  try {
    return await stageRepo.isInitial(session, stageId);
  } finally {
    await session.close();
  }
}

export async function getAssignedInscriptions(driver, stageId) {
  const session = driver.session();
  try {
    return await stageRepo.assignedInscriptions(session, stageId);
  } finally {
    await session.close();
  }
}
