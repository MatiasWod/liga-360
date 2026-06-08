/** Lógica de negocio de equipos: alta/listado/lectura/edición, access code e invite code. */
import { pool, withTransaction } from '../config/db.js';
import { nowIso } from '../domain/time.js';
import { generateTeamCode, hashTeamCode } from '../domain/codes.js';
import * as teamRepo from '../repositories/team.repository.js';
import { canWriteTeam, isTeamOwner, forbidden } from './teamAccess.js';
import * as identityClient from '../clients/identity.client.js';

function notFound(message) {
  return Object.assign(new Error(message), { statusCode: 404, code: 'NOT_FOUND' });
}

export async function listTeams({ onlyMine, userId }) {
  if (!onlyMine) {
    return { teams: await teamRepo.listAll(pool) };
  }
  const profileId = await identityClient.getProfileIdByUser(userId);
  return { teams: await teamRepo.listMine(pool, userId, profileId) };
}

export async function createTeam({ name, badgeUrl, ownerUserId }) {
  const accessCode = generateTeamCode();
  const team = await withTransaction(async (client) => {
    const inviteCode = await teamRepo.generateUniqueInviteCode(client, String(name).trim());
    return teamRepo.create(client, {
      name: String(name).trim(),
      ownerUserId,
      badgeUrl: badgeUrl || null,
      accessCodeHash: hashTeamCode(accessCode),
      inviteCode,
      now: nowIso(),
    });
  });
  return { team, accessCode };
}

export async function getTeam(teamId) {
  const team = await teamRepo.findById(pool, teamId);
  if (!team) throw notFound('team not found');
  const members = await teamRepo.getMembers(pool, teamId);
  return { team, members };
}

export async function updateTeam({ teamId, name, badgeUrl, teamCode, userId }) {
  if (!(await canWriteTeam(pool, teamId, userId, teamCode))) throw forbidden();
  const team = await teamRepo.update(pool, teamId, { name: name?.trim() || null, badgeUrl: badgeUrl || null, now: nowIso() });
  return { team };
}

export async function rotateAccessCode({ teamId, userId }) {
  if (!(await isTeamOwner(pool, teamId, userId))) throw forbidden('only owner can rotate access code');
  const accessCode = generateTeamCode();
  await teamRepo.updateAccessCodeHash(pool, teamId, hashTeamCode(accessCode), nowIso());
  return { teamId, accessCode };
}

export async function getMyInviteCode(userId) {
  const team = await teamRepo.findFirstOwnedByUser(pool, userId);
  if (!team) throw notFound('team not found for current user');
  return { teamId: team.id, teamName: team.name, inviteCode: team.invite_code };
}

export async function resolveByInviteCode(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z]{3}-\d{3}$/.test(code)) {
    throw Object.assign(new Error('invalid invite code format'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
  const team = await teamRepo.findByInviteCode(pool, code);
  if (!team) throw notFound('team not found');
  return { team };
}

// --- Lecturas para consumidores (identity-svc, inscriptions-svc) ---

export async function listOwnedByUser(userId) {
  return { teams: await teamRepo.listOwnedByUser(pool, userId) };
}

export async function listByProfile(personProfileId) {
  return { teams: await teamRepo.listByProfileId(pool, personProfileId) };
}

export async function resolveTeams({ ids, names }) {
  return { teams: await teamRepo.findByIdsOrNames(pool, ids, names) };
}
