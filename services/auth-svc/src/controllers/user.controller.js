import * as userService from '../services/user.service.js';
import { parsePagination } from '@liga360/shared';
import { logger } from '../logger.js';

// El id viene como string en la URL; en DB es SERIAL (number).
function parseUserId(req, res) {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid user id' } });
    return null;
  }
  return userId;
}

export async function listUsers(req, res, next) {
  try {
    const { limit, offset } = parsePagination(req.query);
    const users = await userService.listUsers({ limit, offset });
    return res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function banUser(req, res, next) {
  try {
    const userId = parseUserId(req, res);
    if (userId === null) return;

    logger.info({ adminId: req.user.sub, targetId: userId }, 'ban request');
    const user = await userService.banUser(userId);
    return res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function unbanUser(req, res, next) {
  try {
    const userId = parseUserId(req, res);
    if (userId === null) return;

    logger.info({ adminId: req.user.sub, targetId: userId }, 'unban request');
    const user = await userService.unbanUser(userId);
    return res.json({ user });
  } catch (err) {
    next(err);
  }
}
