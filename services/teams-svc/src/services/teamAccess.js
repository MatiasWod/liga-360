/** Reglas de autorización de escritura sobre un equipo: dueño o access code válido. */
import { hashTeamCode } from '../domain/codes.js';
import * as teamRepo from '../repositories/team.repository.js';

export async function isTeamOwner(client, teamId, userId) {
  return teamRepo.isOwner(client, teamId, userId);
}

export async function canWriteTeam(client, teamId, userId, teamCode) {
  if (await teamRepo.isOwner(client, teamId, userId)) return true;
  if (!teamCode) return false;
  const storedHash = await teamRepo.getAccessCodeHash(client, teamId);
  if (!storedHash) return false;
  return storedHash === hashTeamCode(teamCode);
}

export function forbidden(message = 'team code or owner token required') {
  return Object.assign(new Error(message), { statusCode: 403, code: 'FORBIDDEN' });
}
