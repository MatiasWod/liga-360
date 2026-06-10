/** Lógica de negocio de membresías equipo↔participante. */
import { pool } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import * as membershipRepo from '../repositories/membership.repository.js';
import { canWriteTeam, forbidden } from './teamAccess.js';

export async function addMember({ teamId, participantId, teamCode, userId }) {
  if (!(await canWriteTeam(pool, teamId, userId, teamCode))) throw forbidden();
  await membershipRepo.add(pool, teamId, Number(participantId), nowIso());
  return { ok: true };
}

export async function removeMember({ teamId, participantId, teamCode, userId }) {
  if (!(await canWriteTeam(pool, teamId, userId, teamCode))) throw forbidden();
  const removed = await membershipRepo.remove(pool, teamId, participantId);
  if (removed === 0) {
    throw Object.assign(new Error('participant is not member of this team'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  return { ok: true };
}
