import * as userRepository from '../repositories/user.repository.js';
import { ROLES } from '@liga360/shared/constants/constants.js';

// Representación pública del usuario para el admin (nunca incluye password).
function toUserDto(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    type: row.type,
    isVerified: row.isVerified,
    bannedAt: row.banned_at,
  };
}

export async function listUsers() {
  const rows = await userRepository.findAll();
  return rows.map(toUserDto);
}

export async function banUser(id) {
  const user = await userRepository.findById(id);
  if (!user) {
    throw Object.assign(new Error('user not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  // Los admins no son baneables (cubre auto-baneo y lockout sin admins).
  if (user.type === ROLES.ADMIN) {
    throw Object.assign(new Error('admins cannot be banned'), { statusCode: 403, code: 'FORBIDDEN' });
  }
  const updated = await userRepository.ban(id);
  return toUserDto(updated);
}

export async function unbanUser(id) {
  const user = await userRepository.findById(id);
  if (!user) {
    throw Object.assign(new Error('user not found'), { statusCode: 404, code: 'NOT_FOUND' });
  }
  const updated = await userRepository.unban(id);
  return toUserDto(updated);
}
